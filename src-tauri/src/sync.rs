use crate::db::AppState;
use chrono::{NaiveDateTime, Utc};
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::json;
use tauri::{Emitter, State};

fn now_iso() -> String {
    Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// Convierte timestamp ISO 8601 ("2026-07-18T10:00:00.000Z") al formato local SQLite
/// ("2026-07-18 10:00:00"). Si no tiene 'T', lo devuelve tal cual.
fn normalize_fecha(iso: &str) -> String {
    let s = iso.replace('T', " ");
    let s = s.trim_end_matches('Z');
    // Quitar fracción de segundos si existe
    if let Some(dot) = s.find('.') {
        s[..dot].to_string()
    } else {
        s.to_string()
    }
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

fn upload_products_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
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
pub fn upload_products(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id")?;
    upload_products_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

fn download_products_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<String, String> {
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
        "{}/rest/v1/productos?updated_at=gt.{}&select=codigo,nombre,precio_usd,stock,stock_minimo,activo,categoria_id,updated_at",
        supabase_url.trim_end_matches('/'),
        since,
    );

    let cloud_products: Vec<serde_json::Value> =
        supabase_get(&get_url, &supabase_key).unwrap_or_default();

    let count = cloud_products.len();
    if count == 0 {
        return Ok("No hay cambios nuevos para descargar".to_string());
    }

    let mut upd = db
        .prepare(
            "UPDATE productos SET nombre = ?1, precio_usd = ?2, \
             stock_minimo = ?3, activo = ?4, categoria_id = ?5, updated_at = ?6 \
             WHERE codigo = ?7",
        )
        .map_err(|e| e.to_string())?;

    let mut ins = db
        .prepare(
            "INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, \
             activo, categoria_id, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now','localtime'), ?8)",
        )
        .map_err(|e| e.to_string())?;

    let mut updated = 0i64;
    let mut inserted = 0i64;
    let mut conflicts = 0i64;

    for prod in &cloud_products {
        let codigo = prod["codigo"].as_str().unwrap_or_default().to_string();
        let nombre = prod["nombre"].as_str().unwrap_or_default().to_string();
        let precio_usd = prod["precio_usd"].as_f64().unwrap_or(0.0);
        let stock = prod["stock"].as_i64().unwrap_or(0);
        let stock_minimo = prod["stock_minimo"].as_i64().unwrap_or(0);
        let activo = prod["activo"].as_i64().unwrap_or(1);
        let cat_id = prod["categoria_id"].as_i64();
        let remote_ts = prod["updated_at"].as_str();

        // Check if product exists locally
        let local_ts: Option<String> = db
            .query_row(
                "SELECT updated_at FROM productos WHERE codigo = ?1",
                params![codigo],
                |row| row.get(0),
            )
            .ok();

        if local_ts.is_some() {
            // Existing product: check for conflict
            if is_conflict(local_ts.as_deref(), remote_ts, &last_sync) {
                // Read actual local values for conflict storage
                let local_vals: (String, f64, i64, i64, Option<i64>) = db
                    .query_row(
                        "SELECT nombre, precio_usd, stock_minimo, activo, categoria_id \
                         FROM productos WHERE codigo = ?1",
                        params![codigo],
                        |row| Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, f64>(1)?,
                            row.get::<_, i64>(2)?,
                            row.get::<_, i64>(3)?,
                            row.get::<_, Option<i64>>(4)?,
                        )),
                    )
                    .unwrap_or_else(|_| (String::new(), 0.0, 0, 1, None));

                let local_json = json!({
                    "codigo": codigo,
                    "nombre": local_vals.0,
                    "precio_usd": local_vals.1,
                    "stock_minimo": local_vals.2,
                    "activo": local_vals.3,
                    "categoria_id": local_vals.4,
                });
                let remote_json = json!({
                    "codigo": codigo,
                    "nombre": &nombre,
                    "precio_usd": precio_usd,
                    "stock_minimo": stock_minimo,
                    "activo": activo,
                    "categoria_id": cat_id,
                });
                db.execute(
                    "INSERT INTO conflictos (tabla, item_id, local_json, remote_json) \
                     VALUES ('productos', ?1, ?2, ?3)",
                    params![
                        codigo,
                        local_json.to_string(),
                        remote_json.to_string(),
                    ],
                ).ok();
                conflicts += 1;
                continue;
            }
            // No conflict: update metadata (NOT stock) + set remote updated_at
            upd.execute(params![
                nombre, precio_usd, stock_minimo, activo, cat_id,
                remote_ts.unwrap_or(&ts), codigo,
            ]).unwrap_or(0);
            updated += 1;
        } else {
            // New product: insert with all fields including stock
            ins.execute(params![
                codigo, nombre, precio_usd, stock, stock_minimo, activo, cat_id,
                remote_ts.unwrap_or(&ts),
            ]).ok();
            inserted += 1;
        }
    }
    drop(upd);
    drop(ins);

    upsert_config(&db, "ultimo_download", &ts);

    let parts: Vec<String> = [
        (updated > 0, format!("{} actualizados", updated)),
        (inserted > 0, format!("{} insertados", inserted)),
        (conflicts > 0, format!("{} conflictos detectados", conflicts)),
    ]
    .iter()
    .filter(|(b, _)| *b)
    .map(|(_, s)| s.clone())
    .collect();

    Ok(format!(
        "Descarga completada: {}. {}",
        if parts.is_empty() {
            "sin cambios".to_string()
        } else {
            parts.join(", ")
        },
        if conflicts > 0 {
            "Revisa la sección de conflictos en Configuración".to_string()
        } else {
            String::new()
        }
    ))
}

#[tauri::command]
pub fn download_products(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    download_products_inner(&db, &supabase_url, &supabase_key)
}

fn upload_sales_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
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
pub fn upload_sales(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id")?;
    upload_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

fn download_sales_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
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
                    &normalize_fecha(venta_json["fecha_hora"].as_str().unwrap_or("")),
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
pub fn download_sales(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id").unwrap_or_default();
    download_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

fn upload_clientes_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<String, String> {
    let ts = now_iso();

    // Get local clients, generate UUID for those that don't have one
    let mut stmt = db
        .prepare(
            "SELECT id, nombre, credito_activo, saldo_deuda_usd, sync_id, updated_at \
             FROM clientes ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, i64, f64, Option<String>, Option<String>)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay clientes para subir".to_string());
    }

    let mut uploaded = 0;
    for (id, nombre, credito_activo, saldo, sync_id_opt, updated_opt) in &rows {
        let sync_id = if let Some(sid) = sync_id_opt {
            if sid.is_empty() {
                let new_id = uuid::Uuid::new_v4().to_string();
                db.execute(
                    "UPDATE clientes SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                    rusqlite::params![new_id, ts, id],
                ).ok();
                new_id
            } else {
                sid.clone()
            }
        } else {
            let new_id = uuid::Uuid::new_v4().to_string();
            db.execute(
                "UPDATE clientes SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![new_id, ts, id],
            ).ok();
            new_id
        };

        let updated_at = updated_opt.as_deref().unwrap_or(&ts).to_string();
        let body = serde_json::json!([{
            "sync_id": sync_id,
            "local_id": id,
            "nombre": nombre,
            "credito_activo": credito_activo,
            "saldo_deuda_usd": saldo,
            "updated_at": updated_at,
        }]);

        supabase_post(
            &api_url(&supabase_url, "/clientes?on_conflict=sync_id"),
            &supabase_key,
            &serde_json::to_string(&body).unwrap(),
        )?;

        uploaded += 1;
    }

    upsert_config(&db, "ultimo_upload_clientes", &ts);

    Ok(format!("Subida completada: {} cliente(s) subidos", uploaded))
}

#[tauri::command]
pub fn upload_clientes(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    upload_clientes_inner(&db, &supabase_url, &supabase_key)
}

fn download_clientes_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = db
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = 'ultimo_download_clientes'",
            [],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = format!(
        "{}/rest/v1/clientes?updated_at=gt.{}&select=*",
        supabase_url.trim_end_matches('/'),
        since,
    );

    let cloud_clientes: Vec<serde_json::Value> =
        supabase_get(&get_url, &supabase_key).unwrap_or_default();

    let count = cloud_clientes.len();
    if count == 0 {
        return Ok("No hay cambios nuevos para descargar".to_string());
    }

    let mut inserted = 0;
    let mut updated = 0;
    let mut conflicts = 0;

    for cli in &cloud_clientes {
        let sync_id = cli["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() {
            continue;
        }

        let nombre = cli["nombre"].as_str().unwrap_or("").to_string();
        let credito_activo = cli["credito_activo"].as_i64().unwrap_or(1);
        let saldo = cli["saldo_deuda_usd"].as_f64().unwrap_or(0.0);
        let remote_ts = cli["updated_at"].as_str();

        // Check if client already exists locally by sync_id
        let local_ts: Option<String> = db
            .query_row(
                "SELECT updated_at FROM clientes WHERE sync_id = ?1",
                params![sync_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(ref local) = local_ts {
            // Existing client: check for conflict
            if is_conflict(Some(local), remote_ts, &last_sync) {
                // Read actual local values
                let local_vals: (String, i64, f64) = db
                    .query_row(
                        "SELECT nombre, credito_activo, saldo_deuda_usd \
                         FROM clientes WHERE sync_id = ?1",
                        params![sync_id],
                        |row| Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, i64>(1)?,
                            row.get::<_, f64>(2)?,
                        )),
                    )
                    .unwrap_or_else(|_| (String::new(), 1, 0.0));

                let local_json = json!({
                    "sync_id": sync_id,
                    "nombre": local_vals.0,
                    "credito_activo": local_vals.1,
                    "saldo_deuda_usd": local_vals.2,
                });
                let remote_json = json!({
                    "sync_id": sync_id,
                    "nombre": &nombre,
                    "credito_activo": credito_activo,
                    "saldo_deuda_usd": saldo,
                });
                db.execute(
                    "INSERT INTO conflictos (tabla, item_id, local_json, remote_json) \
                     VALUES ('clientes', ?1, ?2, ?3)",
                    params![sync_id, local_json.to_string(), remote_json.to_string()],
                ).ok();
                conflicts += 1;
                continue;
            }
            // No conflict: remote wins (LWW)
            let rows = db.execute(
                "UPDATE clientes SET nombre = ?1, credito_activo = ?2, \
                 saldo_deuda_usd = ?3, updated_at = ?4 WHERE sync_id = ?5",
                params![nombre, credito_activo, saldo, remote_ts.unwrap_or(&ts), sync_id],
            ).unwrap_or(0);
            if rows > 0 {
                updated += 1;
            }
        } else {
            // New client: INSERT OR IGNORE
            let result = db.execute(
                "INSERT OR IGNORE INTO clientes (nombre, credito_activo, saldo_deuda_usd, sync_id, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![nombre, credito_activo, saldo, sync_id, remote_ts.unwrap_or(&ts)],
            ).map_err(|e| format!("Error insertando cliente remoto: {}", e))?;
            if result > 0 {
                inserted += 1;
            }
        }
    }

    upsert_config(&db, "ultimo_download_clientes", &ts);

    let parts: Vec<String> = [
        (inserted > 0, format!("{} nuevos insertados", inserted)),
        (updated > 0, format!("{} actualizados", updated)),
        (conflicts > 0, format!("{} conflictos", conflicts)),
    ]
    .iter()
    .filter(|(b, _)| *b)
    .map(|(_, s)| s.clone())
    .collect();

    Ok(format!(
        "Descarga completada: {}.{}",
        if parts.is_empty() {
            "sin cambios".to_string()
        } else {
            parts.join(", ")
        },
        if conflicts > 0 {
            " Revisa conflictos en Configuración".to_string()
        } else {
            String::new()
        }
    ))
}

#[tauri::command]
pub fn download_clientes(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    download_clientes_inner(&db, &supabase_url, &supabase_key)
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

fn parse_ts(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&chrono::Utc))
        .or_else(|| {
            NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|d| d.and_utc())
        })
}

fn is_conflict(local_ts: Option<&str>, remote_ts: Option<&str>, last_sync: &str) -> bool {
    let local = match local_ts {
        Some(s) if !s.is_empty() => s,
        _ => return false,
    };
    let remote = match remote_ts {
        Some(s) if !s.is_empty() => s,
        _ => return false,
    };
    if local <= last_sync || remote <= last_sync {
        return false;
    }
    match (parse_ts(local), parse_ts(remote)) {
        (Some(l), Some(r)) => (l - r).num_minutes().abs() < 5,
        _ => false,
    }
}

#[tauri::command]
pub fn get_conflictos(state: State<AppState>) -> Result<Vec<crate::models::Conflicto>, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let mut stmt = db
        .prepare(
            "SELECT id, tabla, item_id, local_json, remote_json, resuelto, \
             COALESCE(created_at,'') FROM conflictos WHERE resuelto = 0 ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let conflictos = stmt
        .query_map([], |row| {
            let res: i64 = row.get(5)?;
            Ok(crate::models::Conflicto {
                id: row.get(0)?,
                tabla: row.get(1)?,
                item_id: row.get(2)?,
                local_json: row.get(3)?,
                remote_json: row.get(4)?,
                resuelto: res == 1,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(conflictos)
}

#[tauri::command]
pub fn resolve_conflicto(
    state: State<AppState>,
    conflicto_id: i64,
    use_remote: bool,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let (tabla, item_id, remote_json): (String, String, String) = db
        .query_row(
            "SELECT tabla, item_id, remote_json FROM conflictos WHERE id = ?1 AND resuelto = 0",
            params![conflicto_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Conflicto no encontrado o ya resuelto".to_string())?;

    if use_remote {
        let remote: serde_json::Value =
            serde_json::from_str(&remote_json).map_err(|e| format!("Error parseando JSON remoto: {}", e))?;
        let ts = now_iso();

        match tabla.as_str() {
            "productos" => {
                let codigo = remote["codigo"].as_str().unwrap_or(&item_id);
                let nombre = remote["nombre"].as_str().unwrap_or("");
                let precio_usd = remote["precio_usd"].as_f64().unwrap_or(0.0);
                let stock_minimo = remote["stock_minimo"].as_i64().unwrap_or(0);
                let activo = remote["activo"].as_i64().unwrap_or(1);
                let cat_id = remote["categoria_id"].as_i64();
                db.execute(
                    "UPDATE productos SET nombre = ?1, precio_usd = ?2, stock_minimo = ?3, \
                     activo = ?4, categoria_id = ?5, updated_at = ?6 WHERE codigo = ?7",
                    params![nombre, precio_usd, stock_minimo, activo, cat_id, ts, codigo],
                ).map_err(|e| format!("Error aplicando resolución remota: {}", e))?;
            }
            "clientes" => {
                let sync_id = remote["sync_id"].as_str().unwrap_or(&item_id);
                let nombre = remote["nombre"].as_str().unwrap_or("");
                let credito_activo = remote["credito_activo"].as_i64().unwrap_or(1);
                let saldo = remote["saldo_deuda_usd"].as_f64().unwrap_or(0.0);
                db.execute(
                    "UPDATE clientes SET nombre = ?1, credito_activo = ?2, \
                     saldo_deuda_usd = ?3, updated_at = ?4 WHERE sync_id = ?5",
                    params![nombre, credito_activo, saldo, ts, sync_id],
                ).map_err(|e| format!("Error aplicando resolución remota: {}", e))?;
            }
            _ => return Err(format!("Tabla desconocida: {}", tabla)),
        }
    }

    db.execute(
        "UPDATE conflictos SET resuelto = 1 WHERE id = ?1",
        params![conflicto_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(if use_remote {
        "Conflicto resuelto: se usó la versión remota".to_string()
    } else {
        "Conflicto resuelto: se mantuvo la versión local".to_string()
    })
}

fn emit_progress(app: &tauri::AppHandle, step: &str, current: u32, total: u32) {
    let payload = serde_json::json!({
        "step": step,
        "current": current,
        "total": total,
    });
    app.emit("sync-progress", payload).ok();
}

#[tauri::command]
pub fn upload_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id")?;

    let total = 3u32;
    emit_progress(&app_handle, "Subiendo productos...", 1, total);
    let r1 = upload_products_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;
    emit_progress(&app_handle, "Subiendo clientes...", 2, total);
    let r2 = upload_clientes_inner(&db, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Subiendo ventas...", 3, total);
    let r3 = upload_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;

    Ok(format!("{}\n{}\n{}", r1, r2, r3))
}

#[tauri::command]
pub fn download_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id").unwrap_or_default();

    let total = 3u32;
    emit_progress(&app_handle, "Descargando productos...", 1, total);
    let r1 = download_products_inner(&db, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando clientes...", 2, total);
    let r2 = download_clientes_inner(&db, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando ventas...", 3, total);
    let r3 = download_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;

    Ok(format!("{}\n{}\n{}", r1, r2, r3))
}

#[tauri::command]
pub fn sync_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;
    let dispositivo_id = get_config(&db, "dispositivo_id")?;

    let total = 6u32;
    emit_progress(&app_handle, "Subiendo productos...", 1, total);
    let r1 = upload_products_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;
    emit_progress(&app_handle, "Subiendo clientes...", 2, total);
    let r2 = upload_clientes_inner(&db, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Subiendo ventas...", 3, total);
    let r3 = upload_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;
    emit_progress(&app_handle, "Descargando productos...", 4, total);
    let r4 = download_products_inner(&db, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando clientes...", 5, total);
    let r5 = download_clientes_inner(&db, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando ventas...", 6, total);
    let r6 = download_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;

    Ok(format!("{}\n{}\n{}\n{}\n{}\n{}", r1, r2, r3, r4, r5, r6))
}

#[derive(Serialize)]
pub struct SyncStats {
    active_products: i64,
    total_clientes: i64,
    total_sales: i64,
    ultimo_upload: String,
    ultimo_download: String,
    ultimo_upload_ventas: String,
    ultimo_download_ventas: String,
    ultimo_upload_clientes: String,
    ultimo_download_clientes: String,
    dispositivo_id: String,
}

#[tauri::command]
pub fn get_sync_stats(state: State<AppState>) -> Result<SyncStats, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let active_products: i64 = db
        .query_row("SELECT COUNT(*) FROM productos WHERE activo = 1", [], |r| r.get(0))
        .unwrap_or(0);
    let total_clientes: i64 = db
        .query_row("SELECT COUNT(*) FROM clientes", [], |r| r.get(0))
        .unwrap_or(0);
    let total_sales: i64 = db
        .query_row("SELECT COUNT(*) FROM ventas", [], |r| r.get(0))
        .unwrap_or(0);

    let gc = |key: &str| -> String {
        db.query_row(
            "SELECT valor FROM configuracion WHERE clave = ?1",
            params![key],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_default()
    };

    Ok(SyncStats {
        active_products,
        total_clientes,
        total_sales,
        ultimo_upload: gc("ultimo_upload"),
        ultimo_download: gc("ultimo_download"),
        ultimo_upload_ventas: gc("ultimo_upload_ventas"),
        ultimo_download_ventas: gc("ultimo_download_ventas"),
        ultimo_upload_clientes: gc("ultimo_upload_clientes"),
        ultimo_download_clientes: gc("ultimo_download_clientes"),
        dispositivo_id: gc("dispositivo_id"),
    })
}

#[tauri::command]
pub fn test_supabase_connection(state: State<AppState>) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, "supabase_url")?;
    let supabase_key = get_config(&db, "supabase_key")?;

    let test_url = format!(
        "{}/rest/v1/productos?select=codigo&limit=1",
        supabase_url.trim_end_matches('/')
    );

    match ureq::get(&test_url)
        .set("apikey", &supabase_key)
        .set("Authorization", &format!("Bearer {}", &supabase_key))
        .call()
    {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
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
    #[test]
    fn test_parse_ts_rfc3339() {
        let dt = parse_ts("2026-07-17T18:13:20.659Z");
        assert!(dt.is_some());
        assert_eq!(dt.unwrap().format("%Y-%m-%d").to_string(), "2026-07-17");
    }
    #[test]
    fn test_parse_ts_sqlite_local() {
        let dt = parse_ts("2026-07-17 18:13:20");
        assert!(dt.is_some());
    }
    #[test]
    fn test_parse_ts_invalid() {
        assert!(parse_ts("").is_none());
        assert!(parse_ts("not-a-date").is_none());
    }
    #[test]
    fn test_is_conflict_both_after_sync_close() {
        // Both modified after last_sync, within 5 min → conflict
        assert!(is_conflict(
            Some("2026-07-18T10:00:00.000Z"),
            Some("2026-07-18T10:02:00.000Z"),
            "2026-07-18T09:00:00.000Z",
        ));
    }
    #[test]
    fn test_is_conflict_one_before_sync() {
        // Local modified before last_sync → no conflict
        assert!(!is_conflict(
            Some("2026-07-18T08:00:00.000Z"),
            Some("2026-07-18T10:02:00.000Z"),
            "2026-07-18T09:00:00.000Z",
        ));
    }
    #[test]
    fn test_is_conflict_more_than_5_min() {
        // Both after sync but 10 min apart → no conflict
        assert!(!is_conflict(
            Some("2026-07-18T10:00:00.000Z"),
            Some("2026-07-18T10:10:00.000Z"),
            "2026-07-18T09:00:00.000Z",
        ));
    }
    #[test]
    fn test_is_conflict_none_ts() {
        assert!(!is_conflict(None, Some("2026-07-18T10:00:00.000Z"), "2026-07-18T09:00:00.000Z"));
        assert!(!is_conflict(Some("2026-07-18T10:00:00.000Z"), None, "2026-07-18T09:00:00.000Z"));
        assert!(!is_conflict(None, None, "2026-07-18T09:00:00.000Z"));
    }
}
