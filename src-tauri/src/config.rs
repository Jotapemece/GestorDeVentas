use crate::db::AppState;
use tauri::State;

#[tauri::command]
pub fn get_config_value(state: State<AppState>, key: String) -> Result<String, String> {
    let db = state.lock_db()?;
    Ok(crate::db::get_config_value(&db, &key)?.unwrap_or_default())
}

#[tauri::command]
pub fn set_config_value(
    state: State<AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "set_config_value",
    )?;
    let db = state.lock_db()?;
    crate::auth::check_admin_role(&state)?;
    crate::db::set_config_value(&db, &key, &value).map_err(|e| {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "set_config_value");
        }
        e
    })?;
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "set_config_value");
    }
    Ok(())
}

#[tauri::command]
pub fn get_user_config_value(state: State<AppState>, key: String) -> Result<String, String> {
    let db = state.lock_db()?;
    let username = state.get_username()?;
    let prefixed = format!("{}:{}", username, key);
    match crate::db::get_config_value(&db, &prefixed)? {
        Some(val) => Ok(val),
        None => Ok(crate::db::get_config_value(&db, &key)?.unwrap_or_default()),
    }
}

#[tauri::command]
pub fn set_user_config_value(
    state: State<AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let db = state.lock_db()?;
    let username = state.get_username()?;
    let prefixed = format!("{}:{}", username, key);
    crate::db::set_config_value(&db, &prefixed, &value).map_err(|e| e.to_string())
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
        assert_eq!(names.len(), 8);
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
