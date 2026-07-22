use super::conflicts::{check_and_record_conflict, is_conflict};
use super::{api_url, get_config, now_iso, supabase_config, supabase_get, supabase_post, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::{params, Connection};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;

pub(crate) fn upload_products_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

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
            &api_url(supabase_url, "/categorias?on_conflict=id"),
            supabase_key,
            &body,
        )?;
    }

    let mut stmt = db
        .prepare(
            "SELECT codigo, nombre, precio_usd, COALESCE(costo,0), stock, COALESCE(stock_minimo,0), \
             COALESCE(categoria_id,0) FROM productos WHERE activo = 1",
        )
        .map_err(|e| e.to_string())?;
    let products: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            let cat_id: i64 = row.get(6)?;
            Ok(json!({
                "codigo": row.get::<_, String>(0)?,
                "nombre": row.get::<_, String>(1)?,
                "precio_usd": row.get::<_, f64>(2)?,
                "costo": row.get::<_, f64>(3)?,
                "stock": row.get::<_, i64>(4)?,
                "stock_minimo": row.get::<_, i64>(5)?,
                "activo": 1i64,
                "categoria_id": if cat_id == 0 { serde_json::Value::Null } else { json!(cat_id) },
                "dispositivo_id": dispositivo_id,
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
        &api_url(supabase_url, "/productos?on_conflict=codigo"),
        supabase_key,
        &body,
    )?;

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD, &ts);

    Ok(format!(
        "Subida completada: {} categorías y {} productos subidos",
        cats.len(),
        products.len()
    ))
}

#[tauri::command]
pub fn upload_products(state: State<AppState>) -> Result<String, String> {
    let db = state.lock_db()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
    let dispositivo_id = get_config(&db, constants::CFG_DISPOSITIVO_ID)?;
    upload_products_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

pub(crate) fn download_products_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = api_url(
        supabase_url,
        &format!(
            "/productos?updated_at=gt.{}&select=codigo,nombre,precio_usd,costo,stock,stock_minimo,activo,categoria_id,updated_at",
            since,
        ),
    );

    let cloud_products: Vec<serde_json::Value> =
        supabase_get(&get_url, supabase_key)?;

    let count = cloud_products.len();
    if count == 0 {
        return Ok("No hay cambios nuevos para descargar".to_string());
    }

    let mut upd = db
        .prepare(
            "UPDATE productos SET nombre = ?1, precio_usd = ?2, \
             costo = ?3, stock_minimo = ?4, activo = ?5, categoria_id = ?6, updated_at = ?7 \
             WHERE codigo = ?8",
        )
        .map_err(|e| e.to_string())?;

    let mut ins = db
        .prepare(
            &format!("INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, costo, stock, stock_minimo, \
             activo, categoria_id, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, {}, ?9)", constants::SQL_DATETIME_NOW),
        )
        .map_err(|e| e.to_string())?;

    let local_map: HashMap<String, (String, String, f64, f64, i64, i64, Option<i64>)> = {
        let mut stmt = db
            .prepare(
                "SELECT codigo, updated_at, nombre, precio_usd, COALESCE(costo,0), stock_minimo, activo, categoria_id \
                 FROM productos",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, i64>(6)?,
                    row.get::<_, Option<i64>>(7)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut map = HashMap::new();
        for (codigo, updated_at, nombre, precio, costo, stock_min, activo, cat_id) in rows {
            map.insert(codigo, (updated_at.unwrap_or_default(), nombre, precio, costo, stock_min, activo, cat_id));
        }
        map
    };

    let mut updated = 0i64;
    let mut inserted = 0i64;
    let mut conflicts = 0i64;

    for prod in &cloud_products {
        let codigo = prod["codigo"].as_str().unwrap_or_default().to_string();
        let nombre = prod["nombre"].as_str().unwrap_or_default().to_string();
        let precio_usd = prod["precio_usd"].as_f64().unwrap_or(0.0);
        let costo = prod["costo"].as_f64().unwrap_or(0.0);
        let stock = prod["stock"].as_i64().unwrap_or(0);
        let stock_minimo = prod["stock_minimo"].as_i64().unwrap_or(0);
        let activo = prod["activo"].as_i64().unwrap_or(1);
        let cat_id = prod["categoria_id"].as_i64();
        let remote_ts = prod["updated_at"].as_str();

        let remote_json = json!({
            "codigo": &codigo,
            "nombre": &nombre,
            "precio_usd": precio_usd,
            "costo": costo,
            "stock_minimo": stock_minimo,
            "activo": activo,
            "categoria_id": cat_id,
        });

        if let Some((local_ts, local_nombre, local_precio, local_costo, local_stock_min, local_activo, local_cat_id)) = local_map.get(&codigo) {
            let local_ts = if local_ts.is_empty() { None } else { Some(local_ts.as_str()) };
            if is_conflict(local_ts, remote_ts, &last_sync) {
                let local_json = json!({
                    "codigo": &codigo,
                    "nombre": local_nombre,
                    "precio_usd": local_precio,
                    "costo": local_costo,
                    "stock_minimo": local_stock_min,
                    "activo": local_activo,
                    "categoria_id": local_cat_id,
                });
                check_and_record_conflict(
                    db, "productos", &codigo,
                    local_ts, remote_ts, &last_sync,
                    local_json, remote_json,
                );
                conflicts += 1;
                continue;
            }
            upd.execute(params![
                nombre, precio_usd, costo, stock_minimo, activo, cat_id,
                remote_ts.unwrap_or(&ts), codigo,
            ]).unwrap_or(0);
            updated += 1;
        } else {
            ins.execute(params![
                codigo, nombre, precio_usd, costo, stock, stock_minimo, activo, cat_id,
                remote_ts.unwrap_or(&ts),
            ]).ok();
            inserted += 1;
        }
    }
    drop(upd);
    drop(ins);

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD, &ts);

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
    let mut db = state.secondary_conn()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    let (supabase_url, supabase_key) = supabase_config(&tx)?;
    let result = download_products_inner(&tx, &supabase_url, &supabase_key)?;
    tx.commit().map_err(|e| format!("Error al confirmar descarga: {}", e))?;
    Ok(result)
}
