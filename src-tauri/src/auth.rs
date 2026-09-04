use crate::constants;
use crate::db::AppState;
use crate::models::*;
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use rusqlite::params;
use sha2::{Digest, Sha256};
use tauri::State;

const SQL_USER_BY_USERNAME: &str = "SELECT id, username, password, rol FROM usuarios WHERE username = ?1";
const SQL_INSERT_USUARIO: &str = "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)";
const SQL_LIST_USUARIOS: &str = "SELECT id, username, rol FROM usuarios ORDER BY username";
const SQL_DELETE_USUARIO: &str = "DELETE FROM usuarios WHERE id = ?1 AND username != 'admin' AND username != 'Jota_admin'";


pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| format!("Error al generar hash: {}", e))
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut result: u8 = 0;
    for (ca, cb) in a.bytes().zip(b.bytes()) {
        result |= ca ^ cb;
    }
    result == 0
}

pub fn verify_password(password: &str, stored_hash: &str) -> bool {
    if stored_hash.starts_with("$argon2") {
        PasswordHash::new(stored_hash)
            .ok()
            .is_some_and(|parsed| {
                Argon2::default()
                    .verify_password(password.as_bytes(), &parsed)
                    .is_ok()
            })
    } else {
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        constant_time_eq(&hex::encode(hasher.finalize()), stored_hash)
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
    if let Err(e) = crate::audit::log_action(db, &username, &crate::constants::sanitize_audit(action)) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }
    Ok(username)
}

pub(crate) fn require_employee(
    state: &State<AppState>,
    db: &rusqlite::Connection,
    action: &str,
) -> Result<String, String> {
    let username = check_employee_role(state)?;
    if let Err(e) = crate::audit::log_action(db, &username, &crate::constants::sanitize_audit(action)) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }
    Ok(username)
}

pub(crate) fn check_employee_role(state: &State<AppState>) -> Result<String, String> {
    let current = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?;
    let user = current.clone().ok_or("No autenticado")?;
    if user.rol != constants::ROL_ADMIN && user.rol != constants::ROL_VENDEDOR {
        return Err("No tienes permisos para realizar esta acción".to_string());
    }
    Ok(user.username)
}

pub(crate) fn admin_guard(
    state: &State<AppState>,
    action_key: &str,
    action: &str,
) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        action_key,
    )?;
    let db = state.lock_db()?;
    require_admin(state, &db, action)
}

pub(crate) fn employee_guard(
    state: &State<AppState>,
    action_key: &str,
    action: &str,
) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        action_key,
    )?;
    let db = state.lock_db()?;
    require_employee(state, &db, action)
}

#[tauri::command]
pub fn login(state: State<AppState>, username: String, password: String) -> LoginResponse {
    // M5: lockout por intentos fallidos POR USUARIO (clave tipo "login:alice").
    // No se cuenta cuando el usuario no existe (evita bloquear cuentas reales
    // bajo usernames inventados — DoS).
    let lock_key = format!("login:{}", username.to_lowercase());
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        if let Err(e) = crate::db::check_action_rate_limit(&mut attempts, &lock_key) {
            return LoginResponse { success: false, message: e, usuario: None };
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

    // Leer la fila del usuario y SOLTAR el lock de la BD antes de ejecutar Argon2
    // (verify_password es costoso; retener el mutex durante él degrada el resto).
    let (stored_hash, usuario) = {
        let row = db.query_row(
            SQL_USER_BY_USERNAME,
            rusqlite::params![&username],
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
        );
        match row {
            Ok(v) => v,
            // Usuario inexistente: responder igual que credencial invalida para no
            // filtrar que usernames existen.
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                return LoginResponse {
                    success: false,
                    message: "Credenciales inválidas".to_string(),
                    usuario: None,
                };
            }
            Err(_e) => {
                return LoginResponse {
                    success: false,
                    message: "Error interno al verificar credenciales".to_string(),
                    usuario: None,
                };
            }
        }
    };
    drop(db);

    if !verify_password(&password, &stored_hash) {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, &lock_key);
        }
        return LoginResponse {
            success: false,
            message: "Credenciales inválidas".to_string(),
            usuario: None,
        };
    }

    // Éxito: limpiar el contador de intentos fallidos de este usuario.
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, &lock_key);
    }

    // Upgrade legacy SHA-256 hash to argon2 (re-adquiere el lock solo para escribir).
    if !stored_hash.starts_with("$argon2") {
        if let Ok(new_hash) = hash_password(&password) {
            if let Ok(db2) = state.db.lock() {
                db2.execute(
                    "UPDATE usuarios SET password = ?1 WHERE id = ?2",
                    rusqlite::params![new_hash, usuario.id],
                )
                .ok();
            }
        }
    }

    let user_clone = usuario.clone();
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
pub fn create_usuario(
    state: State<AppState>,
    username: String,
    password: String,
    rol: String,
) -> Result<String, String> {
    if password.len() < constants::PASSWORD_MIN_LENGTH {
        return Err(format!(
            "La contrase\u{00f1}a debe tener al menos {} caracteres",
            constants::PASSWORD_MIN_LENGTH
        ));
    }
    crate::auth::admin_guard(
        &state,
        "create_usuario",
        &format!("Cre\u{00f3} usuario '{}' con rol '{}'", username, rol),
    )?;
    // Argon2 es costoso: hashear FUERA del lock de la BD para no degradar el resto.
    let hashed = hash_password(&password)?;
    let db = state.lock_db()?;

    match db.execute(SQL_INSERT_USUARIO, rusqlite::params![username, hashed, rol]) {
        Ok(_) => {
            if let Ok(mut attempts) = state.admin_action_attempts.lock() {
                crate::db::rate_limit_success(&mut attempts, "create_usuario");
            }
            Ok("Usuario creado exitosamente".to_string())
        }
        Err(e) => {
            if let Ok(mut attempts) = state.admin_action_attempts.lock() {
                crate::db::rate_limit_fail(&mut attempts, "create_usuario");
            }
            let msg = if e.to_string().contains("UNIQUE constraint failed") {
                "El nombre de usuario ya existe".to_string()
            } else {
                format!("Error al crear usuario: {}", e)
            };
            Err(msg)
        }
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
        .filter(|u| u.username != constants::DEFAULT_ADMIN_USERNAME)
        .collect();

    Ok(usuarios)
}

#[tauri::command]
pub fn delete_usuario(state: State<AppState>, usuario_id: i64) -> Result<String, String> {
    crate::auth::admin_guard(
        &state,
        "delete_usuario",
        &format!("Eliminó usuario id={}", usuario_id),
    )?;
    let db = state.lock_db()?;
    let affected = db
        .execute(SQL_DELETE_USUARIO, params![usuario_id])
        .map_err(|e| format!("Error al eliminar usuario: {}", e))?;
    if affected == 0 {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "delete_usuario");
        }
        Err("No se puede eliminar: usuario no encontrado o es 'admin'".to_string())
    } else {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_success(&mut attempts, "delete_usuario");
        }
        Ok("Usuario eliminado exitosamente".to_string())
    }
}

#[tauri::command]
pub fn change_password(
    state: State<AppState>,
    request: ChangePasswordRequest,
) -> Result<String, String> {
    if request.new_password.len() < constants::PASSWORD_MIN_LENGTH {
        return Err(format!(
            "La contrasena debe tener al menos {} caracteres",
            constants::PASSWORD_MIN_LENGTH
        ));
    }

    let user = state
        .current_user
        .lock()
        .map_err(|_| "Error interno".to_string())?
        .clone()
        .ok_or("No autenticado")?;

    let mut db = state.lock_db()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let stored_hash: String = tx
        .query_row(
            "SELECT password FROM usuarios WHERE id = ?1",
            params![user.id],
            |r| r.get(0),
        )
        .map_err(|_| "Usuario no encontrado".to_string())?;

    if !verify_password(&request.old_password, &stored_hash) {
        drop(tx);
        return Err("La contrasena actual no es correcta".to_string());
    }

    let new_hashed = hash_password(&request.new_password)?;
    tx.execute(
        "UPDATE usuarios SET password = ?1 WHERE id = ?2",
        params![new_hashed, user.id],
    )
    .map_err(|e| format!("Error al cambiar contrasena: {}", e))?;

    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;

    Ok("Contrasena cambiada exitosamente".to_string())
}

#[tauri::command]
pub fn admin_change_password(
    state: State<AppState>,
    usuario_id: i64,
    new_password: String,
) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "admin_change_password",
    )?;
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

    if new_password.len() < constants::PASSWORD_MIN_LENGTH {
        return Err(format!(
            "La contrasena debe tener al menos {} caracteres",
            constants::PASSWORD_MIN_LENGTH
        ));
    }

    let db = state.lock_db()?;
    if let Err(e) = crate::audit::log_action(&db, &admin_username, &format!("Cambió password del usuario id={}", usuario_id)) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }

    let new_hashed = hash_password(&new_password)?;
    let affected = db
        .execute("UPDATE usuarios SET password = ?1 WHERE id = ?2", params![new_hashed, usuario_id])
        .map_err(|e| format!("Error al cambiar contraseña: {}", e))?;

    if affected == 0 {
        Err("Usuario no encontrado".to_string())
    } else {
        Ok("Contraseña cambiada exitosamente".to_string())
    }
}

#[tauri::command]
pub fn reset_usuarios(state: State<AppState>) -> Result<String, String> {
    crate::auth::admin_guard(&state, "reset_usuarios", "Reset usuarios a solo superadmin")?;
    // Argon2 costoso: hashear fuera del lock.
    let hashed = hash_password(constants::DEFAULT_ADMIN_PASSWORD)?;
    let mut db = state.lock_db()?;

    // M6: transacción — si falla el INSERT del superadmin, el DELETE previo se
    // revierte (nunca queda la BD sin admin por una rotura a mitad).
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    match (|| -> Result<(), String> {
        tx.execute("DELETE FROM usuarios", [])
            .map_err(|e| format!("Error al eliminar usuarios: {}", e))?;
        tx.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)",
            params![constants::DEFAULT_ADMIN_USERNAME, hashed, constants::ROL_ADMIN],
        )
        .map_err(|e| format!("Error al crear superadmin: {}", e))?;
        Ok(())
    })() {
        Ok(()) => {}
        Err(e) => {
            if let Ok(mut attempts) = state.admin_action_attempts.lock() {
                crate::db::rate_limit_fail(&mut attempts, "reset_usuarios");
            }
            return Err(e);
        }
    }
    tx.commit().map_err(|e| format!("Error al confirmar reset: {}", e))?;

    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "reset_usuarios");
    }

    Ok(format!(
        "Usuarios reseteados. Solo queda '{}' (admin). Debe cerrar sesión y volver a iniciar.",
        constants::DEFAULT_ADMIN_USERNAME
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_password_verify_roundtrip() {
        let pw = "admin";
        let hash = hash_password(pw).unwrap();
        assert!(verify_password(pw, &hash));
        assert!(!verify_password("wrong", &hash));
    }

    #[test]
    fn test_hash_password_empty() {
        let hash = hash_password("").unwrap();
        assert!(verify_password("", &hash));
        assert!(hash.starts_with("$argon2"));
    }

    #[test]
    fn test_hash_password_long() {
        let long = "a".repeat(1000);
        let hash = hash_password(&long).unwrap();
        assert!(verify_password(&long, &hash));
    }

    #[test]
    fn test_verify_legacy_sha256() {
        let sha_hash = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918";
        assert!(verify_password("admin", sha_hash));
        assert!(!verify_password("wrong", sha_hash));
    }
}
