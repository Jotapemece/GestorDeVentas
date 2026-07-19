use super::now_iso;
use crate::db::AppState;
use chrono::NaiveDateTime;
use rusqlite::params;
use tauri::State;

pub fn parse_ts(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| d.with_timezone(&chrono::Utc))
        .or_else(|| {
            NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|d| d.and_utc())
        })
}

pub fn is_conflict(local_ts: Option<&str>, remote_ts: Option<&str>, last_sync: &str) -> bool {
    let local = match local_ts {
        Some(s) if !s.is_empty() => s,
        _ => return false,
    };
    let remote = match remote_ts {
        Some(s) if !s.is_empty() => s,
        _ => return false,
    };
    if local <= last_sync || remote <= last_sync {
        return false;
    }
    match (parse_ts(local), parse_ts(remote)) {
        (Some(l), Some(r)) => (l - r).num_minutes().abs() < 5,
        _ => false,
    }
}

#[tauri::command]
pub fn get_conflictos(state: State<AppState>) -> Result<Vec<crate::models::Conflicto>, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let mut stmt = db
        .prepare(
            "SELECT id, tabla, item_id, local_json, remote_json, resuelto, \
             COALESCE(created_at,'') FROM conflictos WHERE resuelto = 0 ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let conflictos = stmt
        .query_map([], |row| {
            let res: i64 = row.get(5)?;
            Ok(crate::models::Conflicto {
                id: row.get(0)?,
                tabla: row.get(1)?,
                item_id: row.get(2)?,
                local_json: row.get(3)?,
                remote_json: row.get(4)?,
                resuelto: res == 1,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(conflictos)
}

#[tauri::command]
pub fn resolve_conflicto(
    state: State<AppState>,
    conflicto_id: i64,
    use_remote: bool,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let (tabla, item_id, remote_json): (String, String, String) = db
        .query_row(
            "SELECT tabla, item_id, remote_json FROM conflictos WHERE id = ?1 AND resuelto = 0",
            params![conflicto_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Conflicto no encontrado o ya resuelto".to_string())?;

    if use_remote {
        let remote: serde_json::Value =
            serde_json::from_str(&remote_json).map_err(|e| format!("Error parseando JSON remoto: {}", e))?;
        let ts = now_iso();

        match tabla.as_str() {
            "productos" => {
                let codigo = remote["codigo"].as_str().unwrap_or(&item_id);
                let nombre = remote["nombre"].as_str().unwrap_or("");
                let precio_usd = remote["precio_usd"].as_f64().unwrap_or(0.0);
                let stock_minimo = remote["stock_minimo"].as_i64().unwrap_or(0);
                let activo = remote["activo"].as_i64().unwrap_or(1);
                let cat_id = remote["categoria_id"].as_i64();
                db.execute(
                    "UPDATE productos SET nombre = ?1, precio_usd = ?2, stock_minimo = ?3, \
                     activo = ?4, categoria_id = ?5, updated_at = ?6 WHERE codigo = ?7",
                    params![nombre, precio_usd, stock_minimo, activo, cat_id, ts, codigo],
                ).map_err(|e| format!("Error aplicando resolución remota: {}", e))?;
            }
            "clientes" => {
                let sync_id = remote["sync_id"].as_str().unwrap_or(&item_id);
                let nombre = remote["nombre"].as_str().unwrap_or("");
                let credito_activo = remote["credito_activo"].as_i64().unwrap_or(1);
                let saldo = remote["saldo_deuda_usd"].as_f64().unwrap_or(0.0);
                db.execute(
                    "UPDATE clientes SET nombre = ?1, credito_activo = ?2, \
                     saldo_deuda_usd = ?3, updated_at = ?4 WHERE sync_id = ?5",
                    params![nombre, credito_activo, saldo, ts, sync_id],
                ).map_err(|e| format!("Error aplicando resolución remota: {}", e))?;
            }
            _ => return Err(format!("Tabla desconocida: {}", tabla)),
        }
    }

    db.execute(
        "UPDATE conflictos SET resuelto = 1 WHERE id = ?1",
        params![conflicto_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(if use_remote {
        "Conflicto resuelto: se usó la versión remota".to_string()
    } else {
        "Conflicto resuelto: se mantuvo la versión local".to_string()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ts_rfc3339() {
        let dt = parse_ts("2026-07-17T18:13:20.659Z");
        assert!(dt.is_some());
        assert_eq!(dt.unwrap().format("%Y-%m-%d").to_string(), "2026-07-17");
    }
    #[test]
    fn test_parse_ts_sqlite_local() {
        let dt = parse_ts("2026-07-17 18:13:20");
        assert!(dt.is_some());
    }
    #[test]
    fn test_parse_ts_invalid() {
        assert!(parse_ts("").is_none());
        assert!(parse_ts("not-a-date").is_none());
    }
    #[test]
    fn test_is_conflict_both_after_sync_close() {
        assert!(is_conflict(
            Some("2026-07-18T10:00:00.000Z"),
            Some("2026-07-18T10:02:00.000Z"),
            "2026-07-18T09:00:00.000Z",
        ));
    }
    #[test]
    fn test_is_conflict_one_before_sync() {
        assert!(!is_conflict(
            Some("2026-07-18T08:00:00.000Z"),
            Some("2026-07-18T10:02:00.000Z"),
            "2026-07-18T09:00:00.000Z",
        ));
    }
    #[test]
    fn test_is_conflict_more_than_5_min() {
        assert!(!is_conflict(
            Some("2026-07-18T10:00:00.000Z"),
            Some("2026-07-18T10:10:00.000Z"),
            "2026-07-18T09:00:00.000Z",
        ));
    }
    #[test]
    fn test_is_conflict_none_ts() {
        assert!(!is_conflict(None, Some("2026-07-18T10:00:00.000Z"), "2026-07-18T09:00:00.000Z"));
        assert!(!is_conflict(Some("2026-07-18T10:00:00.000Z"), None, "2026-07-18T09:00:00.000Z"));
        assert!(!is_conflict(None, None, "2026-07-18T09:00:00.000Z"));
    }
}
