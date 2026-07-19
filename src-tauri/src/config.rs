use crate::db::AppState;
use rusqlite::params;
use tauri::State;

const SQL_GET_CONFIG: &str = "SELECT valor FROM configuracion WHERE clave = ?1";
const SQL_UPSERT_CONFIG: &str =
    "INSERT INTO configuracion (clave, valor) VALUES (?1, ?2) \
     ON CONFLICT(clave) DO UPDATE SET valor = ?2";

#[tauri::command]
pub fn get_config_value(state: State<AppState>, key: String) -> Result<String, String> {
    let db = state.lock_db()?;
    match db.query_row(SQL_GET_CONFIG, params![key], |row| row.get::<_, String>(0)) {
        Ok(val) => Ok(val),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(String::new()),
        Err(e) => Err(format!("Error al leer configuración '{}': {}", key, e)),
    }
}

#[tauri::command]
pub fn set_config_value(
    state: State<AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.lock_db()?;
    crate::auth::check_admin_role(&state)?;
    db.execute(SQL_UPSERT_CONFIG, params![key, value])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_theme_names() -> Vec<String> {
    crate::constants::TEMAS_DISPONIBLES.iter().map(|s| s.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_theme_names_count() {
        let names = list_theme_names();
        assert_eq!(names.len(), 7);
    }

    #[test]
    fn test_list_theme_names_first_is_oscuro() {
        let names = list_theme_names();
        assert_eq!(names[0], "oscuro");
    }

    #[test]
    fn test_list_theme_names_all_strings() {
        let names = list_theme_names();
        for name in &names {
            assert!(!name.is_empty());
        }
    }
}
