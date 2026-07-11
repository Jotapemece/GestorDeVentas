use crate::db::AppState;
use crate::models::HistorialAccion;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn get_audit_logs(state: State<AppState>, limit: Option<i64>, offset: Option<i64>) -> Result<Vec<HistorialAccion>, String> {
    let db = state.db.lock().unwrap();
    let lim = limit.unwrap_or(50);
    let off = offset.unwrap_or(0);

    let mut stmt = db
        .prepare("SELECT id, fecha_hora, usuario, accion FROM historial_acciones ORDER BY id DESC LIMIT ?1 OFFSET ?2")
        .map_err(|e| e.to_string())?;

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
pub fn get_cierres(state: State<AppState>, limit: Option<i64>) -> Result<Vec<crate::models::HistorialAccion>, String> {
    let db = state.db.lock().unwrap();
    let lim = limit.unwrap_or(50);

    let mut stmt = db
        .prepare(
            "SELECT id, fecha_hora, usuario, accion FROM historial_acciones WHERE accion LIKE 'Cierre de caja%' ORDER BY id DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

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
