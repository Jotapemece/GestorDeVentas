use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use sha2::{Digest, Sha256};
use std::time::Instant;
use tauri::State;

const SQL_LOGIN: &str = "SELECT id, username, rol FROM usuarios WHERE username = ?1 AND password = ?2";
const SQL_INSERT_USUARIO: &str = "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)";
const SQL_LIST_USUARIOS: &str = "SELECT id, username, rol FROM usuarios ORDER BY username";
const SQL_DELETE_USUARIO: &str = "DELETE FROM usuarios WHERE id = ?1 AND username != 'admin'";
const SQL_CHANGE_PASSWORD: &str = "UPDATE usuarios SET password = ?1 WHERE id = ?2 AND password = ?3";

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

pub(crate) fn check_admin_role(state: &State<AppState>) -> Result<String, String> {
    let current = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?;
    let user = current.clone().ok_or("No autenticado")?;
    if user.rol != "admin" {
        return Err("Solo administradores pueden realizar esta acción".to_string());
    }
    Ok(user.username)
}

pub(crate) fn require_admin(
    state: &State<AppState>,
    db: &rusqlite::Connection,
    action: &str,
) -> Result<String, String> {
    let username = check_admin_role(state)?;
    crate::audit::log_action(db, &username, action).ok();
    Ok(username)
}

#[tauri::command]
pub fn login(state: State<AppState>, username: String, password: String) -> LoginResponse {
    {
        let mut attempts = match state.login_attempts.lock() {
            Ok(a) => a,
            Err(_) => {
                return LoginResponse {
                    success: false,
                    message: "Error interno".to_string(),
                    usuario: None,
                }
            }
        };
        if let Some(&(count, until)) = attempts.get(&username) {
            if count >= crate::db::LOGIN_MAX_ATTEMPTS && Instant::now() < until {
                return LoginResponse {
                    success: false,
                    message: format!(
                        "Demasiados intentos. Intente de nuevo en {} segundos.",
                        until.duration_since(Instant::now()).as_secs()
                    ),
                    usuario: None,
                };
            }
            if Instant::now() >= until {
                attempts.remove(&username);
            }
        }
    }

    let db = match state.db.lock() {
        Ok(db) => db,
        Err(_) => {
            return LoginResponse {
                success: false,
                message: "Error interno del servidor".to_string(),
                usuario: None,
            }
        }
    };
    let hashed = hash_password(&password);

    let username_clone = username.clone();
    match db.query_row(SQL_LOGIN, rusqlite::params![username, hashed], |row| {
        Ok(Usuario {
            id: row.get(0)?,
            username: row.get(1)?,
            rol: row.get(2)?,
        })
    }) {
        Ok(usuario) => {
            let user_clone = usuario.clone();
            if let Ok(mut attempts) = state.login_attempts.lock() {
                attempts.remove(&username_clone);
            }
            drop(db);
            let mut current = match state.current_user.lock() {
                Ok(c) => c,
                Err(_) => {
                    return LoginResponse {
                        success: false,
                        message: "Error interno".to_string(),
                        usuario: None,
                    }
                }
            };
            *current = Some(usuario);
            LoginResponse {
                success: true,
                message: "Inicio de sesión exitoso".to_string(),
                usuario: Some(user_clone),
            }
        }
        Err(_) => {
            if let Ok(mut attempts) = state.login_attempts.lock() {
                let entry = attempts.entry(username_clone.clone()).or_insert((0, Instant::now()));
                entry.0 += 1;
                if entry.0 >= crate::db::LOGIN_MAX_ATTEMPTS {
                    entry.1 = Instant::now() + std::time::Duration::from_secs(crate::db::LOGIN_BLOCK_SECS);
                }
            }
            LoginResponse {
                success: false,
                message: "Credenciales inválidas".to_string(),
                usuario: None,
            }
        },
    }
}

#[tauri::command]
pub fn logout(state: State<AppState>) -> bool {
    let mut current = match state.current_user.lock() {
        Ok(c) => c,
        Err(_) => return false,
    };
    *current = None;
    true
}

#[tauri::command]
pub fn get_current_user(state: State<AppState>) -> Option<Usuario> {
    let current = match state.current_user.lock() {
        Ok(c) => c,
        Err(_) => return None,
    };
    current.clone()
}

#[tauri::command]
pub fn create_usuario(
    state: State<AppState>,
    username: String,
    password: String,
    rol: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Creó usuario '{}' con rol '{}'", username, rol),
    )?;
    let hashed = hash_password(&password);

    match db.execute(SQL_INSERT_USUARIO, rusqlite::params![username, hashed, rol]) {
        Ok(_) => Ok("Usuario creado exitosamente".to_string()),
        Err(e) => Err(format!("Error al crear usuario: {}", e)),
    }
}

#[tauri::command]
pub fn list_usuarios(state: State<AppState>) -> Result<Vec<Usuario>, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    crate::auth::require_admin(&state, &db, "Listó usuarios")?;
    let mut stmt = db
        .prepare(SQL_LIST_USUARIOS)
        .map_err(|e| e.to_string())?;

    let usuarios = stmt
        .query_map([], |row| {
            Ok(Usuario {
                id: row.get(0)?,
                username: row.get(1)?,
                rol: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(usuarios)
}

#[tauri::command]
pub fn delete_usuario(state: State<AppState>, usuario_id: i64) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let admin_user = crate::auth::require_admin(&state, &db, &format!("Eliminó usuario id={}", usuario_id))?;
    if admin_user.is_empty() { return Err("No autenticado".to_string()); }
    let affected = db
        .execute(SQL_DELETE_USUARIO, params![usuario_id])
        .map_err(|e| format!("Error al eliminar usuario: {}", e))?;
    if affected == 0 {
        Err("No se puede eliminar: usuario no encontrado o es 'admin'".to_string())
    } else {
        Ok("Usuario eliminado exitosamente".to_string())
    }
}

#[tauri::command]
pub fn change_password(
    state: State<AppState>,
    request: ChangePasswordRequest,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|_| format!("Error interno"))?;
    let user = state
        .current_user
        .lock()
        .map_err(|_| format!("Error interno"))?
        .clone()
        .ok_or("No autenticado")?;

    let old_hashed = hash_password(&request.old_password);
    let new_hashed = hash_password(&request.new_password);

    let affected = db
        .execute(SQL_CHANGE_PASSWORD, params![new_hashed, user.id, old_hashed])
        .map_err(|e| format!("Error al cambiar contraseña: {}", e))?;

    if affected == 0 {
        Err("La contraseña actual no es correcta".to_string())
    } else {
        Ok("Contraseña cambiada exitosamente".to_string())
    }
}

#[tauri::command]
pub fn admin_change_password(
    state: State<AppState>,
    usuario_id: i64,
    new_password: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|_| format!("Error interno"))?;
    let admin_user = require_admin(&state, &db, &format!("Cambió password del usuario id={}", usuario_id))?;
    if admin_user.is_empty() { return Err("No autenticado".to_string()); }

    let new_hashed = hash_password(&new_password);
    let affected = db
        .execute("UPDATE usuarios SET password = ?1 WHERE id = ?2", params![new_hashed, usuario_id])
        .map_err(|e| format!("Error al cambiar contraseña: {}", e))?;

    if affected == 0 {
        Err("Usuario no encontrado".to_string())
    } else {
        Ok("Contraseña cambiada exitosamente".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_password_deterministic() {
        let a = hash_password("admin");
        let b = hash_password("admin");
        assert_eq!(a, b);
        assert_ne!(a, hash_password("admin2"));
    }

    #[test]
    fn test_hash_password_empty() {
        let a = hash_password("");
        let b = hash_password("");
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }

    #[test]
    fn test_hash_password_long() {
        let long = "a".repeat(1000);
        let a = hash_password(&long);
        let b = hash_password(&long);
        assert_eq!(a, b);
        assert_eq!(a.len(), 64);
    }

    #[test]
    fn test_hash_password_different_lengths() {
        let a = hash_password("abc");
        let b = hash_password("abcd");
        assert_ne!(a, b);
    }
}
