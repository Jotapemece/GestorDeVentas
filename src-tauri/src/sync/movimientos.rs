use super::{api_url, now_iso, supabase_get_paginated, supabase_post, upsert_config, urlencoding};
use crate::constants;
use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

pub(crate) fn upload_movimientos_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();
    let last_upload = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_MOVIMIENTOS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT id, tipo, monto_bs, monto_usd, concepto, username, created_at, \
             sync_id, updated_at, cliente_id \
             FROM movimientos_caja WHERE ( \
               updated_at IS NULL OR updated_at = '' OR sync_id IS NULL OR sync_id = '' OR updated_at > ?1 \
             ) ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, f64, f64, String, String, String, Option<String>, Option<String>, Option<i64>)> =
        stmt.query_map(params![last_upload], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
                row.get::<_, Option<i64>>(9)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay movimientos para subir".to_string());
    }

    let mut movimientos_json: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    for (id, tipo, monto_bs, monto_usd, concepto, username, created_at, sync_id_opt, updated_opt, cliente_id) in &rows {
        let sync_id = match sync_id_opt {
            Some(sid) if !sid.is_empty() => sid.clone(),
            _ => {
                let new_id = Uuid::new_v4().to_string();
                db.execute(
                    "UPDATE movimientos_caja SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                    params![new_id, ts, id],
                )
                .map_err(|e| format!("Error generando sync_id de movimiento: {}", e))?;
                new_id
            }
        };
        let updated_at = updated_opt.as_deref().unwrap_or(&ts).to_string();
        movimientos_json.push(json!({
            "sync_id": sync_id,
            "local_id": id,
            "tipo": tipo,
            "monto_bs": monto_bs,
            "monto_usd": monto_usd,
            "concepto": concepto,
            "username": username,
            "created_at": created_at,
            "cliente_id": cliente_id,
            "dispositivo_origen": dispositivo_id,
            "updated_at": updated_at,
        }));
    }

    let body = serde_json::to_string(&movimientos_json)
        .map_err(|e| format!("Error serializando movimientos JSON: {}", e))?;
    supabase_post(
        &api_url(supabase_url, "/movimientos_caja?on_conflict=sync_id"),
        supabase_key,
        &body,
    )?;

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_MOVIMIENTOS, &ts)?;

    Ok(format!(
        "Subida completada: {} movimiento(s) subidos",
        movimientos_json.len()
    ))
}

pub(crate) fn download_movimientos_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();
    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_MOVIMIENTOS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = api_url(
        supabase_url,
        &format!(
            "/movimientos_caja?updated_at=gt.{}&or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=*",
            since,
            urlencoding(dispositivo_id),
        ),
    );

    let cloud_movimientos: Vec<serde_json::Value> = supabase_get_paginated(&get_url, supabase_key, "id")?;

    let count = cloud_movimientos.len();
    if count == 0 {
        return Ok("No hay movimientos nuevos para descargar".to_string());
    }

    let mut inserted = 0;
    let mut max_ts = String::new();
    for mv in &cloud_movimientos {
        let sync_id = mv["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() { continue; }
        let tipo = mv["tipo"].as_str().unwrap_or("ingreso");
        let monto_bs = mv["monto_bs"].as_f64().unwrap_or(0.0);
        let monto_usd = mv["monto_usd"].as_f64().unwrap_or(0.0);
        let concepto = mv["concepto"].as_str().unwrap_or("").to_string();
        let username = mv["username"].as_str().unwrap_or("system").to_string();
        let created_at = mv["created_at"].as_str().unwrap_or("").to_string();
        let remote_ts = mv["updated_at"].as_str().unwrap_or(&ts);
        let cliente_id = mv["cliente_id"].as_i64();
        if remote_ts > max_ts.as_str() {
            max_ts = remote_ts.to_string();
        }

        // Resolve usuario_id from username
        let usuario_id: i64 = db
            .query_row(
                "SELECT id FROM usuarios WHERE username = ?1",
                params![username],
                |r| r.get(0),
            )
            .unwrap_or(0);

        // INSERT OR IGNORE por sync_id
        let rows = db
            .execute(
                "INSERT OR IGNORE INTO movimientos_caja \
                 (sync_id, tipo, monto_bs, monto_usd, concepto, usuario_id, username, \
                  created_at, updated_at, cliente_id, dispositivo_origen) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    sync_id, tipo, monto_bs, monto_usd, concepto, usuario_id, username,
                    created_at, remote_ts, cliente_id, dispositivo_id,
                ],
            )
            .map_err(|e| format!("Error insertando movimiento remoto: {}", e))?;
        if rows > 0 {
            inserted += 1;
        }
    }

    let wm = if max_ts.is_empty() { ts.clone() } else { max_ts.clone() };
    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_MOVIMIENTOS, &wm)?;

    Ok(format!(
        "Descarga completada: {} movimiento(s) nuevos.",
        inserted
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrations;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(migrations::SQL_CREATE_TABLES).unwrap();
        migrations::run_migrations(&conn);
        conn
    }

    #[test]
    fn test_upload_movimientos_vacio() {
        let conn = setup();
        let r = upload_movimientos_inner(&conn, "https://x.supabase.co", "key", "dev1").unwrap();
        assert!(r.contains("No hay movimientos"));
    }
}
