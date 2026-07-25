use super::{api_url, now_iso, supabase_config, supabase_get, supabase_post, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::{params, Connection};
use serde_json::json;
use tauri::State;

pub(crate) fn upload_usuarios_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let mut stmt = db
        .prepare(
            "SELECT id, username, password, rol, COALESCE(password_change_required,0), \
             COALESCE(sync_id,''), COALESCE(updated_at,'') FROM usuarios ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    #[allow(clippy::type_complexity)]
    let rows: Vec<(i64, String, String, String, i64, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay usuarios para subir".to_string());
    }

    let mut usuarios_json: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    for (id, username, password, rol, pwd_change, sync_id, updated_at) in &rows {
        let sid = if sync_id.is_empty() {
            let new_id = format!("{}-{}", dispositivo_id, id);
            db.execute(
                "UPDATE usuarios SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_id, ts, id],
            ).ok();
            new_id
        } else {
            sync_id.clone()
        };
        let upd_at = if updated_at.is_empty() { ts.clone() } else { updated_at.clone() };

        usuarios_json.push(json!({
            "sync_id": sid,
            "local_id": id,
            "username": username,
            "password": password,
            "rol": rol,
            "password_change_required": pwd_change,
            "dispositivo_origen": dispositivo_id,
            "updated_at": upd_at,
        }));
    }

    let body = serde_json::to_string(&usuarios_json)
        .map_err(|e| format!("Error serializando usuarios JSON: {}", e))?;
    supabase_post(
        &api_url(supabase_url, "/usuarios?on_conflict=sync_id"),
        supabase_key,
        &body,
    )?;

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_USUARIOS, &ts);

    Ok(format!("Subida completada: {} usuario(s) subidos", usuarios_json.len()))
}

#[tauri::command]
pub fn upload_usuarios(state: State<AppState>) -> Result<String, String> {
    let db = state.lock_db()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
    let dispositivo_id = super::get_config(&db, constants::CFG_DISPOSITIVO_ID)?;
    upload_usuarios_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

pub(crate) fn download_usuarios_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_USUARIOS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = api_url(
        supabase_url,
        &format!(
            "/usuarios?updated_at=gt.{}&dispositivo_origen=neq.{}&select=*",
            since,
            urlencoding(dispositivo_id),
        ),
    );

    let cloud_usuarios: Vec<serde_json::Value> =
        supabase_get(&get_url, supabase_key)?;

    let count = cloud_usuarios.len();
    if count == 0 {
        return Ok("No hay cambios nuevos para descargar".to_string());
    }

    let mut inserted = 0;
    let mut updated = 0;

    for user in &cloud_usuarios {
        let sync_id = user["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() {
            continue;
        }
        let username = user["username"].as_str().unwrap_or("").to_string();
        let password = user["password"].as_str().unwrap_or("").to_string();
        let rol = user["rol"].as_str().unwrap_or("vendedor").to_string();
        let pwd_change = user["password_change_required"].as_i64().unwrap_or(0);
        let remote_ts = user["updated_at"].as_str().unwrap_or(&ts);

        let existing: Option<String> = db
            .query_row(
                "SELECT username FROM usuarios WHERE sync_id = ?1",
                params![sync_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(_existing_name) = existing {
            let rows = db.execute(
                "UPDATE usuarios SET username = ?1, password = ?2, rol = ?3, \
                 password_change_required = ?4, updated_at = ?5 WHERE sync_id = ?6",
                params![username, password, rol, pwd_change, remote_ts, sync_id],
            ).unwrap_or(0);
            if rows > 0 {
                updated += 1;
            }
        } else {
            let local_id: i64 = db
                .query_row("SELECT COALESCE(MAX(id),0) + 1 FROM usuarios", [], |row| row.get(0))
                .unwrap_or(1);
            db.execute(
                "INSERT OR IGNORE INTO usuarios (id, username, password, rol, password_change_required, sync_id, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![local_id, username, password, rol, pwd_change, sync_id, remote_ts],
            ).ok();
            inserted += 1;
        }
    }

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_USUARIOS, &ts);

    let parts: Vec<String> = [
        (inserted > 0, format!("{} nuevos insertados", inserted)),
        (updated > 0, format!("{} actualizados", updated)),
    ]
    .iter()
    .filter(|(b, _)| *b)
    .map(|(_, s)| s.clone())
    .collect();

    Ok(format!(
        "Descarga completada: {}.",
        if parts.is_empty() { "sin cambios".to_string() } else { parts.join(", ") }
    ))
}

#[tauri::command]
pub fn download_usuarios(state: State<AppState>) -> Result<String, String> {
    let mut db = state.secondary_conn()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    let (supabase_url, supabase_key) = supabase_config(&tx)?;
    let dispositivo_id = super::get_config(&tx, constants::CFG_DISPOSITIVO_ID)?;
    let result = download_usuarios_inner(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
    tx.commit().map_err(|e| format!("Error al confirmar descarga: {}", e))?;
    Ok(result)
}
