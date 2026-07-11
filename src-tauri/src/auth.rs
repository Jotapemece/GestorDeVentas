use crate::db::AppState;
use crate::models::*;
use sha2::{Digest, Sha256};
use tauri::State;

const SQL_LOGIN: &str = "SELECT id, username, rol FROM usuarios WHERE username = ?1 AND password = ?2";
const SQL_INSERT_USUARIO: &str = "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)";
const SQL_LIST_USUARIOS: &str = "SELECT id, username, rol FROM usuarios ORDER BY username";

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

pub(crate) fn require_admin(
    state: &State<AppState>,
    db: &rusqlite::Connection,
    action: &str,
) -> Result<String, String> {
    let current = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?;
    let user = current.clone().ok_or("No autenticado")?;
    if user.rol != "admin" {
        return Err("Solo administradores pueden realizar esta acción".to_string());
    }
    let username = user.username;
    drop(current);

    crate::audit::log_action(db, &username, action).ok();

    Ok(username)
}

#[tauri::command]
pub fn login(state: State<AppState>, username: String, password: String) -> LoginResponse {
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

    match db.query_row(SQL_LOGIN, rusqlite::params![username, hashed], |row| {
        Ok(Usuario {
            id: row.get(0)?,
            username: row.get(1)?,
            rol: row.get(2)?,
        })
    }) {
        Ok(usuario) => {
            let user_clone = usuario.clone();
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

            let db2 = match state.db.lock() {
                Ok(db) => db,
                Err(_) => {
                    return LoginResponse {
                        success: false,
                        message: "Error interno".to_string(),
                        usuario: Some(user_clone),
                    }
                }
            };
            crate::audit::log_action(&db2, &user_clone.username, "Inicio de sesión").ok();

            LoginResponse {
                success: true,
                message: "Inicio de sesión exitoso".to_string(),
                usuario: Some(user_clone),
            }
        }
        Err(_) => LoginResponse {
            success: false,
            message: "Credenciales inválidas".to_string(),
            usuario: None,
        },
    }
}

#[tauri::command]
pub fn logout(state: State<AppState>) -> bool {
    let mut current = match state.current_user.lock() {
        Ok(c) => c,
        Err(_) => return false,
    };
    let user = current.take();
    drop(current);

    if let Some(u) = user {
        let db = match state.db.lock() {
            Ok(db) => db,
            Err(_) => return false,
        };
        crate::audit::log_action(&db, &u.username, "Cierre de sesión").ok();
    }
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
}
