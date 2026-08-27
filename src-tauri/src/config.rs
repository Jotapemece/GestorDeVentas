use crate::db::AppState;
use tauri::State;

#[tauri::command]
pub fn get_config_value(state: State<AppState>, key: String) -> Result<String, String> {
    // Requiere sesión iniciada (bloquea exfiltración sin autenticación).
    state.get_username()?;
    // La clave maestra de cifrado de backups nunca se entrega por este comando.
    if key == crate::constants::CFG_BACKUP_KEY {
        return Err("Configuración protegida".to_string());
    }
    let db = state.lock_db()?;
    Ok(crate::db::get_config_value(&db, &key)?.unwrap_or_default())
}

#[tauri::command]
pub fn get_config_values(
    state: State<AppState>,
    keys: Vec<String>,
) -> Result<std::collections::HashMap<String, String>, String> {
    state.get_username()?;
    let db = state.lock_db()?;
    let mut out = std::collections::HashMap::new();
    for key in keys {
        // La clave maestra de cifrado de backups nunca se entrega por este comando.
        if key == crate::constants::CFG_BACKUP_KEY {
            continue;
        }
        if let Some(v) = crate::db::get_config_value(&db, &key)? {
            out.insert(key, v);
        }
    }
    Ok(out)
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
    // La clave maestra de cifrado de backups nunca se entrega por este comando
    // (mismo bloqueo que get_config_value; evita el bypass vía fallback global).
    if key == crate::constants::CFG_BACKUP_KEY {
        return Err("Configuración protegida".to_string());
    }
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
    // Bloquea la escritura de la clave maestra (rotar la clave dejaría los
    // backups existentes indescifrables y permitiría plantar una clave conocida).
    if key == crate::constants::CFG_BACKUP_KEY {
        return Err("Configuración protegida".to_string());
    }
    let db = state.lock_db()?;
    let username = state.get_username()?;
    let prefixed = format!("{}:{}", username, key);
    crate::db::set_config_value(&db, &prefixed, &value).map_err(|e| e.to_string())
}
