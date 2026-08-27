use super::{api_url, now_iso, run_download, run_upload, supabase_get_paginated, supabase_post, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rand::Rng;
use rusqlite::{params, Connection};
use serde_json::json;
use tauri::State;

fn random_password_hash() -> String {
    let charset: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let pwd: String = (0..16)
        .map(|_| {
            let idx = rand::thread_rng().gen_range(0..charset.len());
            charset[idx] as char
        })
        .collect();
    crate::auth::hash_password(&pwd).unwrap_or_else(|_| "$argon2invalid".to_string())
}

pub(crate) fn upload_usuarios_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    // Solo usuarios modificados desde el último upload (o sin sync_id todavía).
    // Antes subía TODOS los usuarios cada vez y regeneraba un hash Argon2 aleatorio
    // por usuario en cada sync (costo CPU innecesario e inútil para filas sin cambios).
    let last_sync = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_USUARIOS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT id, username, password, rol, \
             COALESCE(sync_id,''), COALESCE(updated_at,'') FROM usuarios \
             WHERE updated_at IS NULL OR updated_at = '' OR sync_id IS NULL OR sync_id = '' OR \
                   updated_at > ?1 ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, String, String, String, String)> = stmt
        .query_map(params![last_sync], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
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
    for (id, username, _password, rol, sync_id, updated_at) in &rows {
        let sid = if sync_id.is_empty() {
            let new_id = format!("{}-{}", dispositivo_id, id);
            db.execute(
                "UPDATE usuarios SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_id, ts, id],
            )
            .map_err(|e| format!("Error persistiendo sync_id de usuario #{}: {}", id, e))?;
            new_id
        } else {
            sync_id.clone()
        };
        let upd_at = if updated_at.is_empty() { ts.clone() } else { updated_at.clone() };

        // No se sube el hash real de contraseña (la anon key de Supabase es
        // pública y expondría los hashes Argon2 a ataque offline). Se sube un
        // hash aleatorio como placeholder: la columna `password` es NOT NULL.
        let placeholder = random_password_hash();
        usuarios_json.push(json!({
            "sync_id": sid,
            "local_id": id,
            "username": username,
            "password": placeholder,
            "rol": rol,
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

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_USUARIOS, &ts)?;

    Ok(format!("Subida completada: {} usuario(s) subidos", usuarios_json.len()))
}

#[tauri::command]
pub fn upload_usuarios(state: State<AppState>) -> Result<String, String> {
    crate::auth::check_admin_role(&state)?;
    run_upload(&state, |db, supabase_url, supabase_key, dispositivo_id| {
        upload_usuarios_inner(db, supabase_url, supabase_key, dispositivo_id)
    })
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
        supabase_get_paginated(&get_url, supabase_key, "sync_id")?;

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
        let rol = user["rol"].as_str().unwrap_or("vendedor").to_string();
        let remote_ts = user["updated_at"].as_str().unwrap_or(&ts);

        let existing: Option<String> = db
            .query_row(
                "SELECT username FROM usuarios WHERE sync_id = ?1",
                params![sync_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(_existing_name) = existing {
            // El usuario ya existe localmente: su contraseña local sigue siendo
            // válida. Solo se refrescan username/rol.
            let rows = db.execute(
                "UPDATE usuarios SET username = ?1, rol = ?2, updated_at = ?3 WHERE sync_id = ?4",
                params![username, rol, remote_ts, sync_id],
            )
            .map_err(|e| format!("Error actualizando usuario remoto: {}", e))?;
            if rows > 0 {
                updated += 1;
            }
        } else {
            let local_id: i64 = db
                .query_row("SELECT COALESCE(MAX(id),0) + 1 FROM usuarios", [], |row| row.get(0))
                .map_err(|e| format!("Error generando id de usuario: {}", e))?;
            db.execute(
                "INSERT OR IGNORE INTO usuarios (id, username, password, rol, sync_id, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![local_id, username, random_password_hash(), rol, sync_id, remote_ts],
            )
            .map_err(|e| format!("Error insertando usuario remoto: {}", e))?;
            inserted += 1;
        }
    }

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_USUARIOS, &ts)?;

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
    crate::auth::check_admin_role(&state)?;
    run_download(&state, |tx, supabase_url, supabase_key, dispositivo_id| {
        download_usuarios_inner(tx, supabase_url, supabase_key, dispositivo_id)
    })
}
