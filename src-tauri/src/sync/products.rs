use super::conflicts::{check_and_record_conflict, is_conflict};
use super::{api_url, now_iso, run_download, supabase_get_paginated, supabase_post, upsert_config, urlencoding};
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

    // Categorías: subir solo las que cambiaron desde el último upload (fix 10).
    // Como `categorias` no tiene comando CRUD en la app, tras la primera subida
    // post-migración 034 no vuelven a viajar a menos que cambie su `updated_at`.
    let last_upload = super::get_config(db, constants::CFG_ULTIMO_UPLOAD)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT id, nombre, COALESCE(color,'#CCCCCC'), COALESCE(updated_at,'') \
             FROM categorias WHERE updated_at IS NULL OR updated_at = '' OR updated_at > ?1",
        )
        .map_err(|e| e.to_string())?;
    let cats: Vec<serde_json::Value> = stmt
        .query_map(params![last_upload], |row| {
            let cat_ts: String = row.get(3)?;
            let cat_ts = if cat_ts.is_empty() { now_iso() } else { cat_ts };
            Ok(json!({
                "id": row.get::<_, i64>(0)?,
                "nombre": row.get::<_, String>(1)?,
                "color": row.get::<_, String>(2)?,
                "updated_at": cat_ts,
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
            "SELECT p.codigo, p.nombre, p.precio_usd, COALESCE(p.costo,0), p.stock, COALESCE(p.stock_minimo,0), \
             COALESCE(p.categoria_id,0), COALESCE(p.es_inari,0), COALESCE(p.subcategoria,''), COALESCE(p.activo,1), \
             COALESCE(p.updated_at,''), COALESCE(c.nombre,'') \
             FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id \
             WHERE p.updated_at IS NULL OR p.updated_at = '' OR p.updated_at > ?1",
        )
        .map_err(|e| e.to_string())?;
    let products: Vec<serde_json::Value> = stmt
        .query_map(params![last_upload], |row| {
            let cat_id: i64 = row.get(6)?;
            let prod_ts: String = row.get(10)?;
            let prod_ts = if prod_ts.is_empty() { now_iso() } else { prod_ts };
            Ok(json!({
                "codigo": row.get::<_, String>(0)?,
                "nombre": row.get::<_, String>(1)?,
                "precio_usd": row.get::<_, f64>(2)?,
                "costo": row.get::<_, f64>(3)?,
                "stock": row.get::<_, i64>(4)?,
                "stock_minimo": row.get::<_, i64>(5)?,
                "activo": row.get::<_, i64>(9)?,
                "categoria_id": if cat_id == 0 { serde_json::Value::Null } else { json!(cat_id) },
                "categoria_nombre": row.get::<_, String>(11)?,
                "es_inari": row.get::<_, i64>(7)?,
                "subcategoria": row.get::<_, String>(8)?,
                "dispositivo_origen": dispositivo_id,
                "updated_at": prod_ts,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    // F5: el watermark DEBE avanzar aunque no haya productos que subir, si las
    // categorías sí cambiaron. Antes el early-return se saltaba el bump y las
    // categorías se re-subían en cada sync (última subida sin avance).
    if !products.is_empty() {
        let body = serde_json::to_string(&products).map_err(|e| e.to_string())?;
        supabase_post(
            &api_url(supabase_url, "/productos?on_conflict=codigo"),
            supabase_key,
            &body,
        )?;
    }

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD, &ts);

    Ok(format!(
        "Subida completada: {} categorías y {} productos subidos",
        cats.len(),
        products.len()
    ))
}

/// Resuelve el nombre de una categoría remota al id local, creándola localmente
/// si no existe (fix C1). Devuelve `None` si el nombre viene vacío.
pub(crate) fn resolver_categoria_por_nombre(
    db: &Connection,
    nombre: &str,
) -> Result<Option<i64>, String> {
    let nombre = nombre.trim();
    if nombre.is_empty() {
        return Ok(None);
    }
    let existing: Option<i64> = db
        .query_row("SELECT id FROM categorias WHERE nombre = ?1", params![nombre], |row| row.get(0))
        .ok();
    if let Some(id) = existing {
        return Ok(Some(id));
    }
    db.execute(
        "INSERT INTO categorias (nombre, color, updated_at) VALUES (?1, '#CCCCCC', ?2) \
         ON CONFLICT(nombre) DO UPDATE SET updated_at = ?2",
        params![nombre, now_iso()],
    )
    .map_err(|e| format!("Error al crear categoría '{}': {}", nombre, e))?;
    let id: i64 = db
        .query_row("SELECT id FROM categorias WHERE nombre = ?1", params![nombre], |row| row.get(0))
        .map_err(|e| format!("Error al recuperar categoría '{}': {}", nombre, e))?;
    Ok(Some(id))
}

pub(crate) fn download_products_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    // Primera descarga del dispositivo (reinstalación/restauración con datos
    // viejos): forzar el remoto siempre (LWW off) para sanar la BD local.
    let first_sync = super::get_config(db, constants::CFG_FIRST_SYNC_DONE)
        .unwrap_or_default()
        .is_empty();

    let since = urlencoding(&last_sync);
    // No re-descargar productos que subió ESTE dispositivo (fix 3). Se incluye
    // `dispositivo_origen.is.null` para que filas legacy (sin la columna) sigan llegando.
    let get_url = api_url(
        supabase_url,
        &format!(
            "/productos?updated_at=gt.{}&or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=codigo,nombre,precio_usd,costo,stock,stock_minimo,activo,categoria_id,categoria_nombre,es_inari,subcategoria,updated_at,dispositivo_origen",
            since,
            urlencoding(dispositivo_id),
        ),
    );

    let cloud_products: Vec<serde_json::Value> =
        supabase_get_paginated(&get_url, supabase_key)?;

    let count = cloud_products.len();
    if count == 0 {
        if first_sync {
            upsert_config(db, constants::CFG_FIRST_SYNC_DONE, "1");
        }
        return Ok("No hay cambios nuevos para descargar".to_string());
    }

    let mut upd = db
        .prepare(
            "UPDATE productos SET nombre = ?1, precio_usd = ?2, \
             costo = ?3, stock = ?4, stock_minimo = ?5, activo = ?6, categoria_id = ?7, es_inari = ?8, subcategoria = ?9, updated_at = ?10 \
             WHERE codigo = ?11",
        )
        .map_err(|e| e.to_string())?;

    let mut ins = db
        .prepare(
            &format!("INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, costo, stock, stock_minimo, \
             activo, categoria_id, es_inari, subcategoria, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, {}, ?11)", constants::SQL_DATETIME_NOW),
        )
        .map_err(|e| e.to_string())?;

    let local_map: HashMap<String, (String, String, f64, f64, i64, i64, Option<i64>, i64, String)> = {
        let mut stmt = db
            .prepare(
                "SELECT codigo, updated_at, nombre, precio_usd, COALESCE(costo,0), stock_minimo, activo, categoria_id, \
                 COALESCE(es_inari,0), COALESCE(subcategoria,'') FROM productos",
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
                    row.get::<_, i64>(8)?,
                    row.get::<_, String>(9)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut map = HashMap::new();
        for (codigo, updated_at, nombre, precio, costo, stock_min, activo, cat_id, es_inari, subcategoria) in rows {
            map.insert(codigo, (updated_at.unwrap_or_default(), nombre, precio, costo, stock_min, activo, cat_id, es_inari, subcategoria));
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
        let cat_nombre = prod["categoria_nombre"].as_str().unwrap_or("").to_string();
        let es_inari = prod["es_inari"].as_i64().unwrap_or(0);
        let subcategoria = prod["subcategoria"].as_str().unwrap_or("").to_string();
        let remote_ts = prod["updated_at"].as_str();

        let remote_json = json!({
            "codigo": &codigo,
            "nombre": &nombre,
            "precio_usd": precio_usd,
            "costo": costo,
            "stock_minimo": stock_minimo,
            "activo": activo,
            "categoria_id": cat_id,
            "categoria_nombre": &cat_nombre,
            "es_inari": es_inari,
            "subcategoria": &subcategoria,
            "local_updated_at": remote_ts,
            "remote_updated_at": remote_ts,
        });

        // La categoría viaja por nombre (fix C1): resolver a id local, creándola
        // si no existe. Fallback al id remoto para filas legacy sin el nombre.
        let cat_id_uso: Option<i64> = if cat_nombre.trim().is_empty() {
            cat_id
        } else {
            resolver_categoria_por_nombre(db, &cat_nombre)?
        };

        if let Some((local_ts, local_nombre, local_precio, local_costo, local_stock_min, local_activo, local_cat_id, local_es_inari, local_subcategoria)) = local_map.get(&codigo) {
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
                    "es_inari": local_es_inari,
                    "subcategoria": local_subcategoria,
                    "local_updated_at": local_ts,
                    "remote_updated_at": remote_ts,
                });
                check_and_record_conflict(
                    db, "productos", &codigo,
                    local_ts, remote_ts, &last_sync,
                    local_json, remote_json,
                );
                conflicts += 1;
                continue;
            }
            // LWW: solo aplicar el remoto si es más nuevo que el local (no sobrescribir
            // una edición local posterior). Los clientes ya implementan esta simetría.
            // En el primer sync (flag vacío) el remoto SIEMPRE gana para sanar la BD local.
            if !first_sync {
                if let (Some(loc), Some(rem)) = (local_ts, remote_ts) {
                    if rem <= loc {
                        continue;
                    }
                }
            }
            upd.execute(params![
                nombre, precio_usd, costo, stock, stock_minimo, activo, cat_id_uso, es_inari, subcategoria,
                remote_ts.unwrap_or(&ts), codigo,
            ]).map(|affected| updated += affected as i64).map_err(|e| format!("Error actualizando producto remoto: {}", e))?;
        } else {
            ins.execute(params![
                codigo, nombre, precio_usd, costo, stock, stock_minimo, activo, cat_id_uso, es_inari, subcategoria,
                remote_ts.unwrap_or(&ts),
            ]).map(|affected| inserted += affected as i64).map_err(|e| format!("Error insertando producto remoto: {}", e))?;
        }
    }
    drop(upd);
    drop(ins);

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD, &ts);
    if first_sync {
        upsert_config(db, constants::CFG_FIRST_SYNC_DONE, "1");
    }

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
    run_download(&state, |tx, supabase_url, supabase_key, dispositivo_id| {
        download_products_inner(tx, supabase_url, supabase_key, dispositivo_id)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE, \
             color TEXT NOT NULL DEFAULT '#CCCCCC', updated_at TEXT DEFAULT '')",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_resolver_categoria_por_nombre_existente() {
        let db = in_memory_db();
        db.execute("INSERT INTO categorias (nombre) VALUES ('Bebidas')", []).unwrap();
        let id = resolver_categoria_por_nombre(&db, "Bebidas").unwrap();
        assert_eq!(id, Some(1));
    }

    #[test]
    fn test_resolver_categoria_por_nombre_crea() {
        let db = in_memory_db();
        let id = resolver_categoria_por_nombre(&db, "Carnes").unwrap();
        assert_eq!(id, Some(1));
        let nombres: Vec<String> = db
            .prepare("SELECT nombre FROM categorias")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(nombres, vec!["Carnes".to_string()]);
    }

    #[test]
    fn test_resolver_categoria_por_nombre_vacio() {
        let db = in_memory_db();
        assert_eq!(resolver_categoria_por_nombre(&db, "  ").unwrap(), None);
    }

    #[test]
    fn test_resolver_categoria_por_nombre_trim_y_estable() {
        let db = in_memory_db();
        let a = resolver_categoria_por_nombre(&db, " Lácteos ").unwrap();
        let b = resolver_categoria_por_nombre(&db, " Lácteos ").unwrap();
        assert_eq!(a, b, "el segundo lookup debe reutilizar la fila creada");
    }
}
