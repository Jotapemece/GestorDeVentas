use crate::db::AppState;
use chrono::Utc;
use rusqlite::params;
use serde_json::json;
use tauri::State;

fn now_iso() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

fn api_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    format!("{}/rest/v1{}", base, path)
}

fn supabase_post(url: &str, key: &str, body: &str) -> Result<(), String> {
    match ureq::post(url)
        .set("apikey", key)
        .set("Authorization", &format!("Bearer {}", key))
        .set("Content-Type", "application/json")
        .set("Prefer", "resolution=merge-duplicates")
        .send_string(body)
    {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(code, resp)) => {
            let text = resp.into_string().unwrap_or_default();
            Err(format!("HTTP {}: {}", code, text))
        }
        Err(e) => Err(format!("Error de conexión: {}", e)),
    }
}

fn supabase_get(url: &str, key: &str) -> Result<Vec<serde_json::Value>, String> {
    match ureq::get(url)
        .set("apikey", key)
        .set("Authorization", &format!("Bearer {}", key))
        .call()
    {
        Ok(resp) => resp.into_json().map_err(|e| format!("Error leyendo respuesta: {}", e)),
        Err(ureq::Error::Status(code, resp)) => {
            let text = resp.into_string().unwrap_or_default();
            Err(format!("HTTP {}: {}", code, text))
        }
        Err(e) => Err(format!("Error de conexión: {}", e)),
    }
}

fn get_config(db: &rusqlite::Connection, key: &str) -> Result<String, String> {
    db.query_row(
        "SELECT valor FROM configuracion WHERE clave = ?1",
        params![key],
        |r| r.get::<_, String>(0),
    )
    .map_err(|_| format!("Configura '{}' primero en Ajustes", key))
}

fn upsert_config(db: &rusqlite::Connection, key: &str, value: &str) {
    db.execute(
        "INSERT INTO configuracion (clave, valor) VALUES (?1, ?2) \
         ON CONFLICT(clave) DO UPDATE SET valor = ?2",
        params![key, value],
    )
    .ok();
}

#[tauri::command]
pub fn upload_products(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id")?;

    let ts = now_iso();

    // 1. Upload categories
    let mut stmt = db
        .prepare("SELECT id, nombre, COALESCE(color,'#CCCCCC') FROM categorias")
        .map_err(|e| e.to_string())?;
    let cats: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "nombre": row.get::<_, String>(1)?,
                "color": row.get::<_, String>(2)?,
                "updated_at": &*ts,
                "deleted": 0i64,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if !cats.is_empty() {
        let body = serde_json::to_string(&cats).map_err(|e| e.to_string())?;
        supabase_post(
            &api_url(&supabase_url, "/categorias?on_conflict=id"),
            &supabase_key,
            &body,
        )?;
    }

    // 2. Upload products
    let mut stmt = db
        .prepare(
            "SELECT codigo, nombre, precio_usd, stock, COALESCE(stock_minimo,0), \
             COALESCE(categoria_id,0) FROM productos WHERE activo = 1",
        )
        .map_err(|e| e.to_string())?;
    let products: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            let cat_id: i64 = row.get(5)?;
            Ok(json!({
                "codigo": row.get::<_, String>(0)?,
                "nombre": row.get::<_, String>(1)?,
                "precio_usd": row.get::<_, f64>(2)?,
                "stock": row.get::<_, i64>(3)?,
                "stock_minimo": row.get::<_, i64>(4)?,
                "activo": 1i64,
                "categoria_id": if cat_id == 0 { serde_json::Value::Null } else { json!(cat_id) },
                "dispositivo_id": &*dispositivo_id,
                "updated_at": &*ts,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if products.is_empty() {
        return Ok("No hay productos activos para subir".to_string());
    }

    let body = serde_json::to_string(&products).map_err(|e| e.to_string())?;
    supabase_post(
        &api_url(&supabase_url, "/productos?on_conflict=codigo"),
        &supabase_key,
        &body,
    )?;

    // Update last_upload timestamp
    upsert_config(&db, "ultimo_upload", &ts);

    Ok(format!(
        "Subida completada: {} categorías y {} productos subidos",
        cats.len(),
        products.len()
    ))
}

#[tauri::command]
pub fn download_products(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;

    let ts = now_iso();

    // Get last download sync timestamp
    let last_sync = db
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = 'ultimo_download'",
            [],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    // Download products updated after last download (any device)
    let since = urlencoding(&last_sync);
    let get_url = format!(
        "{}/rest/v1/productos?updated_at=gt.{}&select=codigo,nombre,precio_usd,stock,stock_minimo,activo,categoria_id",
        supabase_url.trim_end_matches('/'),
        since,
    );

    let cloud_products: Vec<serde_json::Value> =
        supabase_get(&get_url, &supabase_key).unwrap_or_default();

    let count = cloud_products.len();
    if count == 0 {
        return Ok("No hay cambios nuevos para descargar".to_string());
    }

    // Update local SQLite with cloud products
    // NOTE: stock is NOT updated for existing products — stock is derived from
    // sales events (ventas + ajustes_stock), not from absolute snapshots.
    let mut upd = db
        .prepare(
            "UPDATE productos SET nombre = ?1, precio_usd = ?2, \
             stock_minimo = ?3, activo = ?4, categoria_id = ?5 WHERE codigo = ?6",
        )
        .map_err(|e| e.to_string())?;

    let mut ins = db
        .prepare(
            "INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, \
             activo, categoria_id, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now','localtime'))",
        )
        .map_err(|e| e.to_string())?;

    for prod in &cloud_products {
        let codigo = prod["codigo"].as_str().unwrap_or_default().to_string();
        let nombre = prod["nombre"].as_str().unwrap_or_default().to_string();
        let precio_usd = prod["precio_usd"].as_f64().unwrap_or(0.0);
        let stock = prod["stock"].as_i64().unwrap_or(0);
        let stock_minimo = prod["stock_minimo"].as_i64().unwrap_or(0);
        let activo = prod["activo"].as_i64().unwrap_or(1);
        let cat_id = prod["categoria_id"].as_i64();

        // For existing products: update metadata but NOT stock
        let rows = upd
            .execute(params![nombre, precio_usd, stock_minimo, activo, cat_id, codigo])
            .unwrap_or(0);

        if rows == 0 {
            // New product: insert with all fields including stock
            ins.execute(params![codigo, nombre, precio_usd, stock, stock_minimo, activo, cat_id])
                .ok();
        }
    }
    drop(upd);
    drop(ins);

    // Store download timestamp
    upsert_config(&db, "ultimo_download", &ts);

    Ok(format!(
        "Descarga completada: {} productos procesados",
        count
    ))
}

#[tauri::command]
pub fn upload_sales(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id")?;

    let ts = now_iso();

    let last_upload = db
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = 'ultimo_upload_ventas'",
            [],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT v.id, v.sync_id, v.fecha_hora, v.usuario_id, v.metodo_pago, \
             v.referencia_pago_movil, v.pago_detalle, v.cliente_id, v.total_usd, \
             v.tasa_aplicada, v.total_bs, v.anulada, v.dispositivo_origen \
             FROM ventas v \
             WHERE v.sync_id IS NOT NULL AND v.sync_id != '' AND v.updated_at > ?1 \
             ORDER BY v.id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, String, i64, String, Option<String>, String, Option<i64>,
                   f64, f64, f64, bool, String)> = stmt
        .query_map(params![last_upload], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, f64>(8)?,
                row.get::<_, f64>(9)?,
                row.get::<_, f64>(10)?,
                { let a: i64 = row.get::<_, i64>(11)?; a != 0 },
                row.get::<_, String>(12)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay ventas nuevas para subir".to_string());
    }

    let mut uploaded = 0;
    for (id, sync_id, fecha, uid, metodo, refe, pago_det, cliente_id, total_usd, tasa, total_bs, anulada, disp_origen) in &rows {
        // Convert local fecha_hora (YYYY-MM-DD HH:MM:SS) to ISO 8601 for Supabase
        let fecha_iso = fecha.replace(' ', "T");
        // Use sync_id as the PK (id) for Supabase to avoid FK mismatch with detalles
        let venta_body = json!({
            "id": sync_id,
            "sync_id": sync_id,
            "local_id": id,
            "dispositivo_id": &dispositivo_id,
            "fecha_hora": fecha_iso,
            "usuario_id": uid,
            "metodo_pago": metodo,
            "referencia_pago_movil": refe,
            "pago_detalle": pago_det,
            "cliente_id": cliente_id,
            "total_usd": total_usd,
            "tasa_aplicada": tasa,
            "total_bs": total_bs,
            "anulada": if *anulada { 1i64 } else { 0i64 },
            "dispositivo_origen": disp_origen,
            "updated_at": &ts,
        });

        let venta_array = vec![venta_body];
        supabase_post(
            &api_url(&supabase_url, &format!("/ventas?on_conflict=sync_id")),
            &supabase_key,
            &serde_json::to_string(&venta_array).unwrap(),
        )?;

        // Upload detalles
        let mut d_stmt = db
            .prepare(
                "SELECT dv.producto_codigo, dv.cantidad, dv.precio_usd_unitario, dv.sync_id, dv.id \
                 FROM detalles_ventas dv WHERE dv.venta_id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let dets: Vec<(String, i64, f64, Option<String>, i64)> = d_stmt
            .query_map(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        drop(d_stmt);

        if !dets.is_empty() {
            let detalle_bodies: Vec<serde_json::Value> = dets
                .iter()
                .map(|(codigo, cantidad, precio, det_sync_id, local_det_id)| {
                    json!({
                        "venta_id": sync_id,
                        "local_id": local_det_id,
                        "producto_codigo": codigo,
                        "cantidad": cantidad,
                        "precio_usd_unitario": precio,
                        "sync_id": det_sync_id,
                        "anulado": 0,
                        "updated_at": &ts,
                    })
                })
                .collect();

            supabase_post(
                &api_url(&supabase_url, "/detalles_ventas?on_conflict=sync_id"),
                &supabase_key,
                &serde_json::to_string(&detalle_bodies).unwrap(),
            )?;
        }

        uploaded += 1;
    }

    upsert_config(&db, "ultimo_upload_ventas", &ts);

    Ok(format!("Subida completada: {} venta(s) subidas", uploaded))
}

#[tauri::command]
pub fn download_sales(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id").unwrap_or_default();

    let ts = now_iso();

    let last_sync = db
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = 'ultimo_download_ventas'",
            [],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = format!(
        "{}/rest/v1/ventas?updated_at=gt.{}&dispositivo_origen=neq.{}&select=*",
        supabase_url.trim_end_matches('/'),
        since,
        urlencoding(&dispositivo_id),
    );

    let cloud_ventas: Vec<serde_json::Value> =
        supabase_get(&get_url, &supabase_key).unwrap_or_default();

    if cloud_ventas.is_empty() {
        return Ok("No hay ventas nuevas para descargar".to_string());
    }

    let mut inserted_ventas = 0;
    let mut adjusted_stock_items = 0i64;

    for venta_json in &cloud_ventas {
        let sync_id = venta_json["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() {
            continue;
        }

        // Try to insert — if sync_id already exists (INSERT OR IGNORE), skip
        let venta_id = {
            let result = db.execute(
                "INSERT OR IGNORE INTO ventas \
                 (fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, pago_detalle, \
                  cliente_id, total_usd, tasa_aplicada, total_bs, sync_id, dispositivo_origen, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    venta_json["fecha_hora"].as_str().unwrap_or(""),
                    venta_json["usuario_id"].as_i64().unwrap_or(0),
                    venta_json["metodo_pago"].as_str().unwrap_or(""),
                    venta_json["referencia_pago_movil"].as_str(),
                    venta_json["pago_detalle"].as_str().unwrap_or(""),
                    venta_json["cliente_id"].as_i64(),
                    venta_json["total_usd"].as_f64().unwrap_or(0.0),
                    venta_json["tasa_aplicada"].as_f64().unwrap_or(0.0),
                    venta_json["total_bs"].as_f64().unwrap_or(0.0),
                    sync_id,
                    venta_json["dispositivo_origen"].as_str().unwrap_or(""),
                    venta_json["updated_at"].as_str().unwrap_or(""),
                ],
            ).map_err(|e| format!("Error insertando venta remota: {}", e))?;

            if result == 0 {
                // Already exists, skip
                continue;
            }
            inserted_ventas += 1;
            db.last_insert_rowid()
        };

        // Download detalles for this venta
        let det_url = format!(
            "{}/rest/v1/detalles_ventas?venta_id=eq.{}&select=*",
            supabase_url.trim_end_matches('/'),
            urlencoding(sync_id),
        );

        let cloud_detalles: Vec<serde_json::Value> =
            supabase_get(&det_url, &supabase_key).unwrap_or_default();

        for det in &cloud_detalles {
            let det_sync_id = det["sync_id"].as_str().unwrap_or("");
            if det_sync_id.is_empty() {
                continue;
            }

            let prod_codigo = det["producto_codigo"].as_str().unwrap_or("").to_string();
            let cantidad = det["cantidad"].as_i64().unwrap_or(0);
            let precio = det["precio_usd_unitario"].as_f64().unwrap_or(0.0);

            // Insert detalle (IGNORE if already exists by sync_id)
            let det_result = db.execute(
                "INSERT OR IGNORE INTO detalles_ventas \
                 (venta_id, producto_codigo, cantidad, precio_usd_unitario, sync_id) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![venta_id, prod_codigo, cantidad, precio, det_sync_id],
            ).map_err(|e| format!("Error insertando detalle remoto: {}", e))?;

            if det_result > 0 && venta_json["anulada"].as_i64().unwrap_or(0) == 0 {
                // Newly inserted and sale NOT voided: decrement local stock
                db.execute(
                    "UPDATE productos SET stock = stock - ?1 WHERE codigo = ?2 AND stock >= ?1",
                    params![cantidad, prod_codigo],
                ).ok();
                adjusted_stock_items += cantidad;
            }
        }

        // If remote venta is anulada, mark it locally
        if venta_json["anulada"].as_i64().unwrap_or(0) != 0 {
            db.execute("UPDATE ventas SET anulada = 1 WHERE id = ?1", params![venta_id]).ok();
        }
    }

    upsert_config(&db, "ultimo_download_ventas", &ts);

    Ok(format!(
        "Descarga completada: {} venta(s) nuevas, {} unidad(es) ajustadas en stock",
        inserted_ventas, adjusted_stock_items
    ))
}

#[tauri::command]
pub fn register_device(state: State<AppState>, nombre: String) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;

    if let Ok(id) = db.query_row(
        "SELECT valor FROM configuracion WHERE clave = 'dispositivo_id'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        return Ok(format!("Ya registrado: {}", id));
    }

    let body = json!({"nombre": nombre}).to_string();
    let resp = ureq::post(&api_url(&supabase_url, "/dispositivos"))
        .set("apikey", &supabase_key)
        .set("Authorization", &format!("Bearer {}", &supabase_key))
        .set("Content-Type", "application/json")
        .set("Prefer", "return=representation")
        .send_string(&body)
        .map_err(|e| format!("Error registrando dispositivo: {}", e))?;

    if resp.status() < 200 || resp.status() >= 300 {
        let text = resp.into_string().unwrap_or_default();
        return Err(format!("Error HTTP (registro): {}", text));
    }

    let json: serde_json::Value = resp
        .into_json()
        .map_err(|e| format!("Error leyendo respuesta: {}", e))?;
    let new_id = json[0]["id"].as_str().unwrap_or("").to_string();

    if new_id.is_empty() {
        return Err("No se recibió ID del dispositivo".to_string());
    }

    upsert_config(&db, "dispositivo_id", &new_id);

    Ok(format!("Dispositivo registrado: {}", new_id))
}

#[tauri::command]
pub fn get_ultimo_upload(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    match db.query_row(
        "SELECT valor FROM configuracion WHERE clave = 'ultimo_upload'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        Ok(v) => Ok(v),
        Err(_) => Ok("Nunca".to_string()),
    }
}

#[tauri::command]
pub fn get_ultimo_download(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    match db.query_row(
        "SELECT valor FROM configuracion WHERE clave = 'ultimo_download'",
        [],
        |r| r.get::<_, String>(0),
    ) {
        Ok(v) => Ok(v),
        Err(_) => Ok("Nunca".to_string()),
    }
}

fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            ' ' => out.push_str("%20"),
            '%' => out.push_str("%25"),
            '<' => out.push_str("%3C"),
            '>' => out.push_str("%3E"),
            '#' => out.push_str("%23"),
            '"' => out.push_str("%22"),
            '(' => out.push_str("%28"),
            ')' => out.push_str("%29"),
            '{' | '}' => out.push_str(if c == '{' { "%7B" } else { "%7D" }),
            '|' => out.push_str("%7C"),
            '\\' => out.push_str("%5C"),
            '^' => out.push_str("%5E"),
            '~' => out.push_str("%7E"),
            '[' | ']' => out.push_str(if c == '[' { "%5B" } else { "%5D" }),
            '`' => out.push_str("%60"),
            c => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_url_no_trailing_slash() {
        assert_eq!(
            api_url("https://x.supabase.co", "/productos?select=*"),
            "https://x.supabase.co/rest/v1/productos?select=*"
        );
    }
    #[test]
    fn test_api_url_with_trailing_slash() {
        assert_eq!(
            api_url("https://x.supabase.co/", "/productos"),
            "https://x.supabase.co/rest/v1/productos"
        );
    }
    #[test]
    fn test_now_iso_format() {
        let s = now_iso();
        assert!(s.len() >= 20);
        assert!(s.ends_with('Z'));
        assert!(s.contains('T'));
    }
    #[test]
    fn test_urlencoding_passes_safe_chars() {
        assert_eq!(urlencoding("2026-07-17T18:13:20.659Z"), "2026-07-17T18:13:20.659Z");
    }
    #[test]
    fn test_urlencoding_encodes_space() {
        assert_eq!(urlencoding("a b"), "a%20b");
    }
    #[test]
    fn test_urlencoding_encodes_percent() {
        assert_eq!(urlencoding("100%"), "100%25");
    }
}
