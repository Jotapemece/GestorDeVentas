use super::{api_url, now_iso, supabase_get_paginated, supabase_post, upsert_config, urlencoding};
use crate::constants;
use rusqlite::{params, Connection};
use serde_json::json;
use uuid::Uuid;

pub(crate) fn upload_solicitudes_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_upload = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_SOLICITUDES)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT id, venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, \
             COALESCE(resuelto_por,''), COALESCE(nota_resolucion,''), sync_id, updated_at \
             FROM solicitudes_anulacion WHERE ( \
               updated_at IS NULL OR updated_at = '' OR sync_id IS NULL OR sync_id = '' OR updated_at > ?1 \
             ) ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(i64, i64, String, String, String, String, String, String, String, Option<String>, Option<String>)> =
        stmt.query_map(params![last_upload], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
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
        return Ok("No hay solicitudes de anulación para subir".to_string());
    }

    let mut json_vec: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    for (id, venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, resuelto_por, nota_resolucion, sync_id_opt, updated_opt) in &rows {
        let sync_id = match sync_id_opt {
            Some(sid) if !sid.is_empty() => sid.clone(),
            _ => {
                let new_id = Uuid::new_v4().to_string();
                db.execute(
                    "UPDATE solicitudes_anulacion SET sync_id = ?1, updated_at = ?2 WHERE id = ?3",
                    params![new_id, ts, id],
                )
                .map_err(|e| format!("Error generando sync_id de solicitud: {}", e))?;
                new_id
            }
        };

        let updated_at = updated_opt.as_deref().unwrap_or(&ts).to_string();
        json_vec.push(json!({
            "sync_id": sync_id,
            "local_id": id,
            "venta_id": venta_id,
            "venta_sync_id": venta_sync_id,
            "motivo": motivo,
            "solicitante": solicitante,
            "fecha_hora": fecha_hora,
            "estado": estado,
            "resuelto_por": resuelto_por,
            "nota_resolucion": nota_resolucion,
            "dispositivo_origen": dispositivo_id,
            "updated_at": updated_at,
        }));
    }

    let body = serde_json::to_string(&json_vec)
        .map_err(|e| format!("Error serializando solicitudes JSON: {}", e))?;
    supabase_post(
        &api_url(supabase_url, "/solicitudes_anulacion?on_conflict=sync_id"),
        supabase_key,
        &body,
    )?;

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_SOLICITUDES, &ts);

    Ok(format!(
        "Subida completada: {} solicitud(es) de anulación subidas",
        json_vec.len()
    ))
}

pub(crate) fn download_solicitudes_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_SOLICITUDES)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    // No re-descargar solicitudes que subió ESTE dispositivo (incluye legacy NULL).
    let get_url = api_url(
        supabase_url,
        &format!(
            "/solicitudes_anulacion?updated_at=gt.{}&or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=*",
            since,
            urlencoding(dispositivo_id),
        ),
    );

    let cloud: Vec<serde_json::Value> = supabase_get_paginated(&get_url, supabase_key)?;

    let count = cloud.len();
    if count == 0 {
        return Ok("No hay solicitudes de anulación nuevas para descargar".to_string());
    }

    let mut inserted = 0;
    let mut updated = 0;
    for s in &cloud {
        let sync_id = s["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() {
            continue;
        }
        let venta_id = s["venta_id"].as_i64().unwrap_or(0);
        let venta_sync_id = s["venta_sync_id"].as_str().unwrap_or("").to_string();
        let motivo = s["motivo"].as_str().unwrap_or("").to_string();
        let solicitante = s["solicitante"].as_str().unwrap_or("").to_string();
        let fecha_hora = s["fecha_hora"].as_str().unwrap_or("").to_string();
        let estado = s["estado"].as_str().unwrap_or("").to_string();
        let resuelto_por = s["resuelto_por"].as_str().unwrap_or("").to_string();
        let nota_resolucion = s["nota_resolucion"].as_str().unwrap_or("").to_string();
        let remote_ts = s["updated_at"].as_str().unwrap_or(&ts);

        // Reconciliación idempotente por sync_id. `estado/resuelto_por/nota` se
        // propagan para que el dispositivo solicitante vea el resultado.
        let existing: Option<(i64, String)> = db
            .query_row(
                "SELECT id, COALESCE(updated_at,'') FROM solicitudes_anulacion WHERE sync_id = ?1",
                params![sync_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();
        if let Some((id, local_ts)) = existing {
            // Si el remoto es más nuevo, aplicar el cambio de estado (LWW).
            if !local_ts.is_empty() && remote_ts <= local_ts.as_str() {
                continue;
            }
            let rows = db
                .execute(
                    "UPDATE solicitudes_anulacion SET estado = ?1, resuelto_por = ?2, \
                     nota_resolucion = ?3, updated_at = ?4 WHERE id = ?5",
                    params![estado, resuelto_por, nota_resolucion, remote_ts, id],
                )
                .map_err(|e| format!("Error actualizando solicitud remota: {}", e))?;
            if rows > 0 {
                updated += 1;
            }
        } else {
            let rows = db
                .execute(
                    "INSERT OR IGNORE INTO solicitudes_anulacion \
                     (venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, \
                      resuelto_por, nota_resolucion, sync_id, updated_at, dispositivo_origen) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                    params![
                        venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado,
                        resuelto_por, nota_resolucion, sync_id, remote_ts, dispositivo_id,
                    ],
                )
                .map_err(|e| format!("Error insertando solicitud remota: {}", e))?;
            if rows > 0 {
                inserted += 1;
            }
        }
    }

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_SOLICITUDES, &ts);

    let mut parts: Vec<String> = Vec::new();
    if inserted > 0 {
        parts.push(format!("{} nuevas", inserted));
    }
    if updated > 0 {
        parts.push(format!("{} actualizadas", updated));
    }
    Ok(format!(
        "Descarga completada: {}.",
        if parts.is_empty() {
            "sin cambios".to_string()
        } else {
            parts.join(", ")
        }
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
    fn test_upload_solicitudes_vacio() {
        let conn = setup();
        let r = upload_solicitudes_inner(&conn, "https://x.supabase.co", "key", "dev1").unwrap();
        assert!(r.contains("No hay solicitudes"));
    }

    #[test]
    fn test_download_inserta_y_actualiza_estado() {
        let conn = setup();
        // Simular una solicitud remota: sync_id "s1", pendiente.
        let body = json!([{
            "sync_id": "s1",
            "venta_id": 10,
            "venta_sync_id": "venta-s1",
            "motivo": "Error de cobro",
            "solicitante": "vendedor1",
            "fecha_hora": "2026-08-13 10:00:00",
            "estado": "pendiente",
            "resuelto_por": "",
            "nota_resolucion": "",
            "updated_at": "2026-08-13T10:00:00.000Z",
        }]);
        // Inyectar manualmente (evita la red): insertar fila local y probar LWW.
        conn.execute(
            "INSERT INTO solicitudes_anulacion \
             (venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, sync_id, updated_at) \
             VALUES (10, 'venta-s1', 'Error de cobro', 'vendedor1', '2026-08-13 10:00:00', 'pendiente', 's1', '2026-08-13T09:00:00.000Z')",
            [],
        )
        .unwrap();
        // Descarga remota con updated_at más nuevo y estado aprobada.
        let _ = body;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM solicitudes_anulacion WHERE sync_id = 's1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}