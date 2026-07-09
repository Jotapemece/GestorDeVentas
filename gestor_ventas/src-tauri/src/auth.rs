use crate::db::AppState;
use crate::models::*;
use sha2::{Digest, Sha256};
use tauri::State;

pub fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

#[tauri::command]
pub fn login(state: State<AppState>, username: String, password: String) -> LoginResponse {
    let db = state.db.lock().unwrap();
    let hashed = hash_password(&password);

    match db.query_row(
        "SELECT id, username, rol FROM usuarios WHERE username = ?1 AND password = ?2",
        rusqlite::params![username, hashed],
        |row| {
            Ok(Usuario {
                id: row.get(0)?,
                username: row.get(1)?,
                rol: row.get(2)?,
            })
        },
    ) {
        Ok(usuario) => {
            let user_clone = usuario.clone();
            drop(db);
            let mut current = state.current_user.lock().unwrap();
            *current = Some(usuario);

            let db2 = state.db.lock().unwrap();
            let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            db2.execute(
                "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)",
                rusqlite::params![now, user_clone.username, "Inicio de sesión"],
            )
            .ok();

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
    let mut current = state.current_user.lock().unwrap();
    let user = current.take();
    drop(current);

    if let Some(u) = user {
        let db = state.db.lock().unwrap();
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        db.execute(
            "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)",
            rusqlite::params![now, u.username, "Cierre de sesión"],
        )
        .ok();
    }
    true
}

#[tauri::command]
pub fn get_current_user(state: State<AppState>) -> Option<Usuario> {
    let current = state.current_user.lock().unwrap();
    current.clone()
}

#[tauri::command]
pub fn create_usuario(
    state: State<AppState>,
    username: String,
    password: String,
    rol: String,
) -> Result<String, String> {
    let is_admin = {
        let current = state.current_user.lock().unwrap().clone();
        current.map(|u| u.rol == "admin").unwrap_or(false)
    };
    if !is_admin {
        return Err("Solo administradores pueden crear usuarios".to_string());
    }

    let admin = state.current_user.lock().unwrap().clone().map(|u| u.username).unwrap_or_default();

    let db = state.db.lock().unwrap();
    let hashed = hash_password(&password);

    match db.execute(
        "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)",
        rusqlite::params![username, hashed, rol],
    ) {
        Ok(_) => {
            let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            db.execute(
                "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)",
                rusqlite::params![now, admin, format!("Creó usuario '{}' con rol '{}'", username, rol)],
            )
            .ok();
            Ok("Usuario creado exitosamente".to_string())
        }
        Err(e) => Err(format!("Error al crear usuario: {}", e)),
    }
}

#[tauri::command]
pub fn list_usuarios(state: State<AppState>) -> Result<Vec<Usuario>, String> {
    let is_admin = {
        let current = state.current_user.lock().unwrap().clone();
        current.map(|u| u.rol == "admin").unwrap_or(false)
    };
    if !is_admin {
        return Err("Solo administradores pueden listar usuarios".to_string());
    }

    let db = state.db.lock().unwrap();
    let mut stmt = db
        .prepare("SELECT id, username, rol FROM usuarios ORDER BY username")
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
