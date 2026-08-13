use super::{api_url, now_iso, supabase_get_paginated, supabase_post, upsert_config, urlencoding};
use crate::constants;
use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

pub(crate) fn upload_alertas_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_upload = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_ALERTAS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT id, tipo, monto_usd, cliente_id, cliente_nombre, metodo_pago, nota, usuario, \
             fecha_hora, sync_id, updated_at \
             FROM alertas_credito WHERE ( \
               updated_at IS NULL OR updated_at = '' OR sync_id IS NULL OR sync_id = '' OR updated_at > ?1 \
             ) ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, f64, Option<i64>, String, String, String, String, String, Option<String>, Option<String>)> =
        stmt.query_map(params![last_upload], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, Option<i64>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<String>>(10)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay alertas de crédito para subir".to_string());
    }

    let mut alertas_json: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    for (id, tipo, monto, cliente_id, cliente_nombre, metodo, nota, usuario, fecha_hora, sync_id_opt, updated_opt) in &rows {
        let sync_id = match sync_id_opt {
            Some(sid) if !sid.is_empty() => sid.clone(),
            _ => {
                let new_id = Uuid::new_v4().to_string();
                db.execute(
                    "UPDATE alertas_credito SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                    params![new_id, ts, id],
                )
                .map_err(|e| format!("Error generando sync_id de alerta: {}", e))?;
                new_id
            }
        };

        let updated_at = updated_opt.as_deref().unwrap_or(&ts).to_string();
        alertas_json.push(json!({
            "sync_id": sync_id,
            "local_id": id,
            "tipo": tipo,
            "monto_usd": monto,
            "cliente_id": cliente_id,
            "cliente_nombre": cliente_nombre,
            "metodo_pago": metodo,
            "nota": nota,
            "usuario": usuario,
            "fecha_hora": fecha_hora,
            "dispositivo_origen": dispositivo_id,
            "updated_at": updated_at,
        }));
    }

    let body = serde_json::to_string(&alertas_json)
        .map_err(|e| format!("Error serializando alertas JSON: {}", e))?;
    supabase_post(
        &api_url(supabase_url, "/alertas_credito?on_conflict=sync_id"),
        supabase_key,
        &body,
    )?;

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_ALERTAS, &ts);

    Ok(format!(
        "Subida completada: {} alerta(s) de crédito subidas",
        alertas_json.len()
    ))
}

pub(crate) fn download_alertas_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_ALERTAS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    // No re-descargar alertas que subió ESTE dispositivo (incluye legacy NULL).
    let get_url = api_url(
        supabase_url,
        &format!(
            "/alertas_credito?updated_at=gt.{}&or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=*",
            since,
            urlencoding(dispositivo_id),
        ),
    );

    let cloud_alertas: Vec<serde_json::Value> = supabase_get_paginated(&get_url, supabase_key)?;

    let count = cloud_alertas.len();
    if count == 0 {
        return Ok("No hay alertas de crédito nuevas para descargar".to_string());
    }

    let mut inserted = 0;
    for al in &cloud_alertas {
        let sync_id = al["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() {
            continue;
        }
        let tipo = al["tipo"].as_str().unwrap_or("").to_string();
        if tipo.is_empty() {
            continue;
        }
        let monto = al["monto_usd"].as_f64().unwrap_or(0.0);
        let cliente_id = al["cliente_id"].as_i64();
        let cliente_nombre = al["cliente_nombre"].as_str().unwrap_or("").to_string();
        let metodo = al["metodo_pago"].as_str().unwrap_or("").to_string();
        let nota = al["nota"].as_str().unwrap_or("").to_string();
        let usuario = al["usuario"].as_str().unwrap_or("").to_string();
        let fecha_hora = al["fecha_hora"].as_str().unwrap_or("").to_string();
        let remote_ts = al["updated_at"].as_str().unwrap_or(&ts);

        // INSERT OR IGNORE por sync_id. `visto` NO se sincroniza: cada dispositivo
        // mantiene su propia lectura (el badge del admin depende solo del estado local).
        let rows = db
            .execute(
                "INSERT OR IGNORE INTO alertas_credito \
                 (tipo, monto_usd, cliente_id, cliente_nombre, metodo_pago, nota, usuario, \
                  fecha_hora, visto, sync_id, updated_at, dispositivo_origen) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10, ?11)",
                params![
                    tipo, monto, cliente_id, cliente_nombre, metodo, nota, usuario,
                    fecha_hora, sync_id, remote_ts, dispositivo_id,
                ],
            )
            .map_err(|e| format!("Error insertando alerta remota: {}", e))?;
        if rows > 0 {
            inserted += 1;
        }
    }

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_ALERTAS, &ts);

    Ok(format!(
        "Descarga completada: {} alerta(s) de crédito nuevas.",
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
    fn test_upload_alertas_vacio() {
        let conn = setup();
        let r = upload_alertas_inner(&conn, "https://x.supabase.co", "key", "dev1").unwrap();
        assert!(r.contains("No hay alertas"));
    }
}
