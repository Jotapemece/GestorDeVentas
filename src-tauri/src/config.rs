use crate::db::AppState;
use rusqlite::params;
use tauri::State;

const SQL_GET_CONFIG: &str = "SELECT valor FROM configuracion WHERE clave = ?1";
const SQL_UPSERT_CONFIG: &str =
    "INSERT INTO configuracion (clave, valor) VALUES (?1, ?2) \
     ON CONFLICT(clave) DO UPDATE SET valor = ?2";

#[tauri::command]
pub fn get_config_value(state: State<AppState>, key: String) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let val: String = db
        .query_row(SQL_GET_CONFIG, params![key], |row| row.get(0))
        .unwrap_or_default();
    Ok(val)
}

#[tauri::command]
pub fn set_config_value(
    state: State<AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Config: {} = {}", key, value),
    )?;
    db.execute(SQL_UPSERT_CONFIG, params![key, value])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_theme_names() -> Vec<String> {
    vec![
        "oscuro".to_string(),
        "claro".to_string(),
        "azul".to_string(),
        "verde".to_string(),
        "morado".to_string(),
        "turquesa".to_string(),
        "naranja".to_string(),
    ]
}
