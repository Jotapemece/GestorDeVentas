use crate::constants;
use crate::db::AppState;
use crate::models::HistorialAccion;
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

#[tauri::command]
pub fn get_audit_logs(
    state: State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
    search: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<HistorialAccion>, String> {
    crate::auth::check_employee_role(&state)?;
    let db = state.lock_db()?;
    let lim = limit.unwrap_or(constants::AUDIT_LOG_DEFAULT_LIMIT);
    let off = offset.unwrap_or(0);

    let mut sql = String::from(
        "SELECT id, fecha_hora, usuario, accion FROM historial_acciones WHERE 1=1",
    );
    let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(s) = search {
        if !s.trim().is_empty() {
            sql.push_str(" AND (usuario LIKE ? ESCAPE '\\' OR accion LIKE ? ESCAPE '\\')");
            let pattern = format!("%{}%", escape_like(&s.trim()));
            p.push(Box::new(pattern.clone()));
            p.push(Box::new(pattern));
        }
    }
    if let Some(sd) = start_date {
        if !sd.trim().is_empty() {
            sql.push_str(" AND date(fecha_hora) >= ?");
            p.push(Box::new(sd.trim().to_string()));
        }
    }
    if let Some(ed) = end_date {
        if !ed.trim().is_empty() {
            sql.push_str(" AND date(fecha_hora) <= ?");
            p.push(Box::new(ed.trim().to_string()));
        }
    }

    sql.push_str(" ORDER BY id DESC LIMIT ? OFFSET ?");
    p.push(Box::new(lim));
    p.push(Box::new(off));

    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

    let logs: Vec<HistorialAccion> = stmt
        .query_map(rusqlite::params_from_iter(p.iter().map(|b| &**b)), row_to_historial)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(logs)
}

fn escape_like(input: &str) -> String {
    input.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

#[tauri::command]
pub fn clear_audit(state: State<AppState>) -> Result<(), String> {
    crate::auth::admin_guard(&state, "clear_audit", "Limpió el historial de auditoría")?;
    let mut db = state.lock_db()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    tx.execute("DELETE FROM historial_acciones", [])
        .map_err(|e| format!("Error al limpiar auditoría: {}", e))?;
    log_action(&tx, "sistema", "Historial de auditoría limpiado")?;
    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "clear_audit");
    }
    Ok(())
}
