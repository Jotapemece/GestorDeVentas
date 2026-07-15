use crate::constants;
use crate::db::AppState;
use crate::models::HistorialAccion;
use chrono;
use rusqlite::params;
use tauri::State;

pub(crate) const SQL_INSERT_HISTORIAL: &str =
    "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)";

pub(crate) fn log_action(
    db: &rusqlite::Connection,
    usuario: &str,
    accion: &str,
) -> Result<(), String> {
    let now = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    db.execute(SQL_INSERT_HISTORIAL, rusqlite::params![now, usuario, accion])
        .map_err(|e| format!("Error al registrar auditoría: {}", e))?;
    Ok(())
}

const SQL_AUDIT_LOGS: &str =
    "SELECT id, fecha_hora, usuario, accion FROM historial_acciones ORDER BY id DESC LIMIT ?1 OFFSET ?2";
const SQL_CIERRES: &str =
    "SELECT id, fecha_hora, usuario, accion FROM historial_acciones WHERE accion LIKE 'Cierre de caja%' \
     ORDER BY id DESC LIMIT ?1";

#[tauri::command]
pub fn get_audit_logs(
    state: State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<HistorialAccion>, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let lim = limit.unwrap_or(constants::AUDIT_LOG_DEFAULT_LIMIT);
    let off = offset.unwrap_or(0);

    let mut stmt = db.prepare(SQL_AUDIT_LOGS).map_err(|e| e.to_string())?;

    let logs: Vec<HistorialAccion> = stmt
        .query_map(params![lim, off], |row| {
            Ok(HistorialAccion {
                id: row.get(0)?,
                fecha_hora: row.get(1)?,
                usuario: row.get(2)?,
                accion: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(logs)
}

#[tauri::command]
pub fn get_cierres(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<HistorialAccion>, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let lim = limit.unwrap_or(constants::AUDIT_LOG_DEFAULT_LIMIT);

    let mut stmt = db.prepare(SQL_CIERRES).map_err(|e| e.to_string())?;

    let cierres: Vec<HistorialAccion> = stmt
        .query_map(params![lim], |row| {
            Ok(HistorialAccion {
                id: row.get(0)?,
                fecha_hora: row.get(1)?,
                usuario: row.get(2)?,
                accion: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(cierres)
}
