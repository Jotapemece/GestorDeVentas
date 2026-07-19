use crate::constants;
use crate::db::AppState;
use crate::models::*;
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rusqlite::params;
use sha2::{Digest, Sha256};
use std::time::Instant;
use tauri::State;

const SQL_USER_BY_USERNAME: &str = "SELECT id, username, password, rol FROM usuarios WHERE username = ?1";
const SQL_INSERT_USUARIO: &str = "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)";
const SQL_LIST_USUARIOS: &str = "SELECT id, username, rol FROM usuarios ORDER BY username";
const SQL_DELETE_USUARIO: &str = "DELETE FROM usuarios WHERE id = ?1 AND username != 'admin'";


pub fn hash_password(password: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("Error al generar hash argon2")
        .to_string()
}

pub fn verify_password(password: &str, stored_hash: &str) -> bool {
    if stored_hash.starts_with("$argon2") {
        PasswordHash::new(stored_hash)
            .ok()
            .map_or(false, |parsed| {
                Argon2::default()
                    .verify_password(password.as_bytes(), &parsed)
                    .is_ok()
            })
    } else {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        hex::encode(hasher.finalize()) == stored_hash
    }
}

pub(crate) fn check_admin_role(state: &State<AppState>) -> Result<String, String> {
    let current = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?;
    let user = current.clone().ok_or("No autenticado")?;
    if user.rol != constants::ROL_ADMIN {
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

    let username_clone = username.clone();
    let (stored_hash, usuario) = match db.query_row(
        SQL_USER_BY_USERNAME,
        rusqlite::params![username],
        |row| {
            Ok((
                row.get::<_, String>(2)?,
                Usuario {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    rol: row.get(3)?,
                },
            ))
        },
    ) {
        Ok(v) => v,
        Err(_) => {
            if let Ok(mut attempts) = state.login_attempts.lock() {
                let entry = attempts.entry(username_clone.clone()).or_insert((0, Instant::now()));
                entry.0 += 1;
                if entry.0 >= crate::db::LOGIN_MAX_ATTEMPTS {
                    entry.1 = Instant::now() + std::time::Duration::from_secs(crate::db::LOGIN_BLOCK_SECS);
                }
            }
            return LoginResponse {
                success: false,
                message: "Credenciales inválidas".to_string(),
                usuario: None,
            };
        }
    };

    if !verify_password(&password, &stored_hash) {
        if let Ok(mut attempts) = state.login_attempts.lock() {
            let entry = attempts.entry(username_clone.clone()).or_insert((0, Instant::now()));
            entry.0 += 1;
            if entry.0 >= crate::db::LOGIN_MAX_ATTEMPTS {
                entry.1 = Instant::now() + std::time::Duration::from_secs(crate::db::LOGIN_BLOCK_SECS);
            }
        }
        return LoginResponse {
            success: false,
            message: "Credenciales inválidas".to_string(),
            usuario: None,
        };
    }

    // Upgrade legacy SHA-256 hash to argon2
    if !stored_hash.starts_with("$argon2") {
        let new_hash = hash_password(&password);
        db.execute(
            "UPDATE usuarios SET password = ?1 WHERE id = ?2",
            rusqlite::params![new_hash, usuario.id],
        )
        .ok();
    }

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
    let db = state.lock_db()?;
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
    let db = state.lock_db()?;
    crate::auth::check_admin_role(&state)?;
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
    let db = state.lock_db()?;
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
    let db = state.lock_db()?;
    let user = state
        .current_user
        .lock()
        .map_err(|_| format!("Error interno"))?
        .clone()
        .ok_or("No autenticado")?;

    // Verify old password
    let stored_hash: String = db
        .query_row(
            "SELECT password FROM usuarios WHERE id = ?1",
            params![user.id],
            |r| r.get(0),
        )
        .map_err(|_| "Usuario no encontrado".to_string())?;

    if !verify_password(&request.old_password, &stored_hash) {
        return Err("La contraseña actual no es correcta".to_string());
    }

    let new_hashed = hash_password(&request.new_password);
    db.execute(
        "UPDATE usuarios SET password = ?1 WHERE id = ?2",
        params![new_hashed, user.id],
    )
    .map_err(|e| format!("Error al cambiar contraseña: {}", e))?;

    Ok("Contraseña cambiada exitosamente".to_string())
}

#[tauri::command]
pub fn admin_change_password(
    state: State<AppState>,
    usuario_id: i64,
    new_password: String,
) -> Result<String, String> {
    let admin_username = {
        let lock = state
            .current_user
            .lock()
            .map_err(|_| "Error interno".to_string())?;
        lock.as_ref()
            .filter(|u| u.rol == constants::ROL_ADMIN)
            .map(|u| u.username.clone())
            .ok_or("Solo administradores pueden realizar esta acción")?
    };

    {
        let mut attempts = state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?;
        if let Some(&(count, until)) = attempts.get("admin_change_password") {
            if count >= crate::db::LOGIN_MAX_ATTEMPTS && Instant::now() < until {
                return Err(format!(
                    "Demasiados intentos. Intente de nuevo en {} segundos.",
                    until.duration_since(Instant::now()).as_secs()
                ));
            }
            if Instant::now() >= until {
                attempts.remove("admin_change_password");
            }
        }
    }

    let db = state.lock_db()?;
    crate::audit::log_action(&db, &admin_username, &format!("Cambió password del usuario id={}", usuario_id)).ok();

    let new_hashed = hash_password(&new_password);
    let affected = db
        .execute("UPDATE usuarios SET password = ?1 WHERE id = ?2", params![new_hashed, usuario_id])
        .map_err(|e| format!("Error al cambiar contraseña: {}", e))?;

    if affected == 0 {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            let entry = attempts.entry("admin_change_password".to_string()).or_insert((0, Instant::now()));
            entry.0 += 1;
            if entry.0 >= crate::db::LOGIN_MAX_ATTEMPTS {
                entry.1 = Instant::now() + std::time::Duration::from_secs(crate::db::LOGIN_BLOCK_SECS);
            }
        }
        Err("Usuario no encontrado".to_string())
    } else {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            attempts.remove("admin_change_password");
        }
        Ok("Contraseña cambiada exitosamente".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_password_verify_roundtrip() {
        let pw = "admin";
        let hash = hash_password(pw);
        assert!(verify_password(pw, &hash));
        assert!(!verify_password("wrong", &hash));
    }

    #[test]
    fn test_hash_password_empty() {
        let hash = hash_password("");
        assert!(verify_password("", &hash));
        assert!(hash.starts_with("$argon2"));
    }

    #[test]
    fn test_hash_password_long() {
        let long = "a".repeat(1000);
        let hash = hash_password(&long);
        assert!(verify_password(&long, &hash));
    }

    #[test]
    fn test_verify_legacy_sha256() {
        let sha_hash = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
        assert!(verify_password("admin", sha_hash));
        assert!(!verify_password("wrong", sha_hash));
    }
}
