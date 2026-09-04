use super::{api_url, now_iso, supabase_get_paginated, supabase_post, upsert_config, urlencoding};
use crate::constants;
use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

pub(crate) fn upload_alertas_stock_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_upload = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_ALERTAS_STOCK)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT id, producto_codigo, producto_nombre, cantidad, motivo, usuario, \
             fecha_hora, sync_id, updated_at \
             FROM alertas_stock WHERE ( \
               updated_at IS NULL OR updated_at = '' OR sync_id IS NULL OR sync_id = '' OR updated_at > ?1 \
             ) ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, String, f64, String, String, String, Option<String>, Option<String>)> =
        stmt.query_map(params![last_upload], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, Option<String>>(8)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay alertas de stock para subir".to_string());
    }

    let mut alertas_json: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    for (id, codigo, nombre, cant, motivo, usuario, fecha, sync_id_opt, updated_opt) in &rows {
        let sync_id = match sync_id_opt {
            Some(sid) if !sid.is_empty() => sid.clone(),
            _ => {
                let new_id = Uuid::new_v4().to_string();
                db.execute(
                    "UPDATE alertas_stock SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                    params![new_id, ts, id],
                )
                .map_err(|e| format!("Error generando sync_id de alerta stock: {}", e))?;
                new_id
            }
        };

        let updated_at = updated_opt.as_deref().unwrap_or(&ts).to_string();
        alertas_json.push(json!({
            "sync_id": sync_id,
            "local_id": id,
            "producto_codigo": codigo,
            "producto_nombre": nombre,
            "cantidad": cant,
            "motivo": motivo,
            "usuario": usuario,
            "fecha_hora": fecha,
            "dispositivo_origen": dispositivo_id,
            "updated_at": updated_at,
        }));
    }

    let body = serde_json::to_string(&alertas_json)
        .map_err(|e| format!("Error serializando alertas stock JSON: {}", e))?;
    supabase_post(
        &api_url(supabase_url, "/alertas_stock?on_conflict=sync_id"),
        supabase_key,
        &body,
    )?;

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_ALERTAS_STOCK, &ts)?;

    Ok(format!(
        "Subida completada: {} alerta(s) de stock subidas",
        alertas_json.len()
    ))
}

pub(crate) fn download_alertas_stock_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_ALERTAS_STOCK)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = api_url(
        supabase_url,
        &format!(
            "/alertas_stock?updated_at=gt.{}&or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=*",
            since,
            urlencoding(dispositivo_id),
        ),
    );

    let cloud_alertas: Vec<serde_json::Value> = supabase_get_paginated(&get_url, supabase_key, "id")?;

    let count = cloud_alertas.len();
    if count == 0 {
        return Ok("No hay alertas de stock nuevas para descargar".to_string());
    }

    let mut inserted = 0;
    let mut max_ts = String::new();
    for al in &cloud_alertas {
        let sync_id = al["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() {
            continue;
        }
        let codigo = al["producto_codigo"].as_str().unwrap_or("").to_string();
        if codigo.is_empty() {
            continue;
        }
        let nombre = al["producto_nombre"].as_str().unwrap_or("").to_string();
        let cant = al["cantidad"].as_f64().unwrap_or(0.0);
        let motivo = al["motivo"].as_str().unwrap_or("").to_string();
        let usuario = al["usuario"].as_str().unwrap_or("").to_string();
        let fecha_hora = al["fecha_hora"].as_str().unwrap_or("").to_string();
        let remote_ts = al["updated_at"].as_str().unwrap_or(&ts);
        if remote_ts > max_ts.as_str() {
            max_ts = remote_ts.to_string();
        }

        // INSERT OR IGNORE por sync_id. `visto` NO se sincroniza.
        let rows = db
            .execute(
                "INSERT OR IGNORE INTO alertas_stock \
                 (sync_id, producto_codigo, producto_nombre, cantidad, motivo, usuario, \
                  fecha_hora, visto, updated_at, dispositivo_origen) \
                  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9)",
                params![
                    sync_id, codigo, nombre, cant, motivo, usuario,
                    fecha_hora, remote_ts, dispositivo_id,
                ],
            )
            .map_err(|e| format!("Error insertando alerta de stock remota: {}", e))?;
        if rows > 0 {
            inserted += 1;
        }
    }

    let wm = if max_ts.is_empty() { ts.clone() } else { max_ts.clone() };
    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_ALERTAS_STOCK, &wm)?;

    Ok(format!(
        "Descarga completada: {} alerta(s) de stock nuevas.",
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
    fn test_upload_alertas_stock_vacio() {
        let conn = setup();
        let r = upload_alertas_stock_inner(&conn, "https://x.supabase.co", "key", "dev1").unwrap();
        assert!(r.contains("No hay alertas"));
    }
}
