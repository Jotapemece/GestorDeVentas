use super::conflicts::{check_and_record_conflict, is_conflict};
use super::{api_url, get_config, now_iso, supabase_config, supabase_get, supabase_post, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::{params, Connection};
use serde_json::json;
use tauri::State;

pub fn upload_products_inner(
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
            &api_url(&supabase_url, "/categorias?on_conflict=id"),
            &supabase_key,
            &body,
        )?;
    }

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

    upsert_config(&db, constants::CFG_ULTIMO_UPLOAD, &ts);

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

pub fn download_products_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(&db, constants::CFG_ULTIMO_DOWNLOAD)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = api_url(
        &supabase_url,
        &format!(
            "/productos?updated_at=gt.{}&select=codigo,nombre,precio_usd,stock,stock_minimo,activo,categoria_id,updated_at",
            since,
        ),
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
            &format!("INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, \
             activo, categoria_id, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, {}, ?8)", constants::SQL_DATETIME_NOW),
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

        let local_ts: Option<String> = db
            .query_row(
                "SELECT updated_at FROM productos WHERE codigo = ?1",
                params![codigo],
                |row| row.get(0),
            )
            .ok();

        let remote_json = json!({
            "codigo": &codigo,
            "nombre": &nombre,
            "precio_usd": precio_usd,
            "stock_minimo": stock_minimo,
            "activo": activo,
            "categoria_id": cat_id,
        });

        if let Some(ref local) = local_ts {
            if is_conflict(Some(local), remote_ts, &last_sync) {
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
                    "codigo": &codigo,
                    "nombre": local_vals.0,
                    "precio_usd": local_vals.1,
                    "stock_minimo": local_vals.2,
                    "activo": local_vals.3,
                    "categoria_id": local_vals.4,
                });
                check_and_record_conflict(
                    db, "productos", &codigo,
                    Some(local), remote_ts, &last_sync,
                    local_json, remote_json,
                );
                conflicts += 1;
                continue;
            }
            upd.execute(params![
                nombre, precio_usd, stock_minimo, activo, cat_id,
                remote_ts.unwrap_or(&ts), codigo,
            ]).unwrap_or(0);
            updated += 1;
        } else {
            ins.execute(params![
                codigo, nombre, precio_usd, stock, stock_minimo, activo, cat_id,
                remote_ts.unwrap_or(&ts),
            ]).ok();
            inserted += 1;
        }
    }
    drop(upd);
    drop(ins);

    upsert_config(&db, constants::CFG_ULTIMO_DOWNLOAD, &ts);

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
