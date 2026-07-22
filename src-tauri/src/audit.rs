use crate::constants;
use crate::db::AppState;
use crate::models::HistorialAccion;
use rusqlite::params;
use tauri::State;

fn row_to_historial(row: &rusqlite::Row) -> rusqlite::Result<HistorialAccion> {
    Ok(HistorialAccion {
        id: row.get(0)?,
        fecha_hora: row.get(1)?,
        usuario: row.get(2)?,
        accion: row.get(3)?,
    })
}

pub(crate) const SQL_INSERT_HISTORIAL: &str =
    "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)";

pub(crate) fn log_action(
    db: &rusqlite::Connection,
    usuario: &str,
    accion: &str,
) -> Result<(), String> {
    let now = crate::helpers::fecha_hora_local();
    db.execute(SQL_INSERT_HISTORIAL, rusqlite::params![now, usuario, accion])
        .map_err(|e| format!("Error al registrar auditoría: {}", e))?;
    Ok(())
}

const SQL_AUDIT_LOGS: &str =
    "SELECT id, fecha_hora, usuario, accion FROM historial_acciones ORDER BY id DESC LIMIT ?1 OFFSET ?2";
const SQL_CIERRES: &str =
    "SELECT id, fecha_hora, usuario, accion FROM historial_acciones WHERE accion LIKE 'Cierre de caja%' \
     ORDER BY id DESC LIMIT ?1 OFFSET ?2";

#[tauri::command]
pub fn get_audit_logs(
    state: State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<HistorialAccion>, String> {
    let db = state.lock_db()?;
    let lim = limit.unwrap_or(constants::AUDIT_LOG_DEFAULT_LIMIT);
    let off = offset.unwrap_or(0);

    let mut stmt = db.prepare(SQL_AUDIT_LOGS).map_err(|e| e.to_string())?;

    let logs: Vec<HistorialAccion> = stmt
        .query_map(params![lim, off], row_to_historial)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(logs)
}

#[tauri::command]
pub fn get_cierres(
    state: State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<HistorialAccion>, String> {
    let db = state.lock_db()?;
    let lim = limit.unwrap_or(constants::AUDIT_LOG_DEFAULT_LIMIT);
    let off = offset.unwrap_or(0).max(0);

    let mut stmt = db.prepare(SQL_CIERRES).map_err(|e| e.to_string())?;

    let cierres: Vec<HistorialAccion> = stmt
        .query_map(params![lim, off], row_to_historial)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(cierres)
}

#[tauri::command]
pub fn clear_audit(state: State<AppState>) -> Result<(), String> {
    let mut db = state.lock_db()?;
    crate::auth::require_admin(&state, &db, "Limpió el historial de auditoría")?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    tx.execute("DELETE FROM historial_acciones", [])
        .map_err(|e| format!("Error al limpiar auditoría: {}", e))?;
    log_action(&tx, "sistema", "Historial de auditoría limpiado")?;
    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
    Ok(())
}
