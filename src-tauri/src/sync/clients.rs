use super::conflicts::{check_and_record_conflict, is_conflict};
use super::{api_url, now_iso, supabase_config, supabase_get, supabase_post, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::{params, Connection};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

pub(crate) fn upload_clientes_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let mut stmt = db
        .prepare(
            "SELECT id, nombre, credito_activo, saldo_deuda_usd, sync_id, updated_at \
             FROM clientes ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    #[allow(clippy::type_complexity)]
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

    let mut clientes_json: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    for (id, nombre, credito_activo, saldo, sync_id_opt, updated_opt) in &rows {
        let sync_id = if let Some(sid) = sync_id_opt {
            if sid.is_empty() {
                let new_id = Uuid::new_v4().to_string();
                db.execute(
                    "UPDATE clientes SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                    params![new_id, ts, id],
                ).ok();
                new_id
            } else {
                sid.clone()
            }
        } else {
            let new_id = Uuid::new_v4().to_string();
            db.execute(
                "UPDATE clientes SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_id, ts, id],
            ).ok();
            new_id
        };

        let updated_at = updated_opt.as_deref().unwrap_or(&ts).to_string();
        clientes_json.push(json!({
            "sync_id": sync_id,
            "local_id": id,
            "nombre": nombre,
            "credito_activo": credito_activo,
            "saldo_deuda_usd": saldo,
            "updated_at": updated_at,
        }));
    }

    let body = serde_json::to_string(&clientes_json)
        .map_err(|e| format!("Error serializando clientes JSON: {}", e))?;
    supabase_post(
        &api_url(supabase_url, "/clientes?on_conflict=sync_id"),
        supabase_key,
        &body,
    )?;

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_CLIENTES, &ts);

    Ok(format!("Subida completada: {} cliente(s) subidos", clientes_json.len()))
}

#[tauri::command]
pub fn upload_clientes(state: State<AppState>) -> Result<String, String> {
    let db = state.lock_db()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
    upload_clientes_inner(&db, &supabase_url, &supabase_key)
}

pub(crate) fn download_clientes_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_CLIENTES)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = api_url(
        supabase_url,
        &format!("/clientes?updated_at=gt.{}&select=*", since),
    );

    let cloud_clientes: Vec<serde_json::Value> =
        supabase_get(&get_url, supabase_key)?;

    let count = cloud_clientes.len();
    if count == 0 {
        return Ok("No hay cambios nuevos para descargar".to_string());
    }

    let local_map: HashMap<String, (String, String, i64, f64)> = {
        let mut stmt = db
            .prepare(
                "SELECT sync_id, updated_at, nombre, credito_activo, saldo_deuda_usd \
                 FROM clientes WHERE sync_id IS NOT NULL AND sync_id != ''",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, f64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut map = HashMap::new();
        for (sync_id, updated_at, nombre, credito, saldo) in rows {
            map.insert(sync_id, (updated_at.unwrap_or_default(), nombre, credito, saldo));
        }
        map
    };

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

        let remote_json = json!({
            "sync_id": sync_id,
            "nombre": &nombre,
            "credito_activo": credito_activo,
            "saldo_deuda_usd": saldo,
        });

        if let Some((local_ts, local_nombre, local_credito, local_saldo)) = local_map.get(sync_id) {
            let local_ts_opt = if local_ts.is_empty() { None } else { Some(local_ts.as_str()) };
            if is_conflict(local_ts_opt, remote_ts, &last_sync) {
                let local_json = json!({
                    "sync_id": sync_id,
                    "nombre": local_nombre,
                    "credito_activo": local_credito,
                    "saldo_deuda_usd": local_saldo,
                });
                check_and_record_conflict(
                    db, "clientes", sync_id,
                    local_ts_opt, remote_ts, &last_sync,
                    local_json, remote_json,
                );
                conflicts += 1;
                continue;
            }
            let rows = db.execute(
                "UPDATE clientes SET nombre = ?1, credito_activo = ?2, \
                 saldo_deuda_usd = ?3, updated_at = ?4 WHERE sync_id = ?5",
                params![nombre, credito_activo, saldo, remote_ts.unwrap_or(&ts), sync_id],
            ).unwrap_or(0);
            if rows > 0 {
                updated += 1;
            }
        } else {
            let result = db.execute(
                "INSERT OR IGNORE INTO clientes (nombre, credito_activo, saldo_deuda_usd, sync_id, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![nombre, credito_activo, saldo, sync_id, remote_ts.unwrap_or(&ts)],
            ).map_err(|e| format!("Error insertando cliente remoto: {}", e))?;
            if result > 0 {
                inserted += 1;
            }
        }
    }

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_CLIENTES, &ts);

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
    let mut db = state.secondary_conn()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    let (supabase_url, supabase_key) = supabase_config(&tx)?;
    let result = download_clientes_inner(&tx, &supabase_url, &supabase_key)?;
    tx.commit().map_err(|e| format!("Error al confirmar descarga: {}", e))?;
    Ok(result)
}
