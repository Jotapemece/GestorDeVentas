use crate::constants;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::Rng;
use rusqlite::{Connection, params};
use tauri::State;
use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use std::time::Instant;
use tauri::AppHandle;
#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(not(target_os = "android"))]
const DEFAULT_PATH: &str = ".";
pub const LOGIN_MAX_ATTEMPTS: i32 = 5;
pub const LOGIN_BLOCK_SECS: u64 = 300;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub db_path: Mutex<PathBuf>,
    pub current_user: Mutex<Option<crate::models::Usuario>>,
    pub login_attempts: Mutex<HashMap<String, (i32, Instant)>>,
    pub admin_action_attempts: Mutex<HashMap<String, (i32, Instant)>>,
}

impl AppState {
    pub fn lock_db(&self) -> Result<MutexGuard<'_, Connection>, String> {
        self.db.lock().map_err(|e| format!("Error interno: {}", e))
    }

    pub fn secondary_conn(&self) -> Result<Connection, String> {
        let path = self.db_path.lock().map_err(|e| format!("Error interno: {}", e))?.clone();
        let conn = Connection::open(&path).map_err(|e| format!("Error al abrir conexión secundaria: {}", e))?;
        conn.execute_batch("PRAGMA journal_mode=WAL;").ok();
        conn.execute_batch("PRAGMA foreign_keys=ON;").ok();
        Ok(conn)
    }

    pub fn get_username(&self) -> Result<String, String> {
        self.current_user.lock()
            .map_err(|e| format!("Error interno: {}", e))?
            .clone()
            .map(|u| u.username)
            .ok_or_else(|| "No autenticado".to_string())
    }
}

fn get_db_path(_app_handle: &AppHandle) -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let data_dir = _app_handle.path().app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("/data/data/com.gestor-ventas.app/databases"));
        return data_dir.join(constants::DB_FILENAME);
    }

    #[cfg(not(target_os = "android"))]
    desktop_db_path()
}

#[cfg(not(target_os = "android"))]
fn desktop_db_path() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join(constants::DB_FILENAME);
        }
    }
    PathBuf::from(constants::DB_FILENAME)
}

pub fn init_db(app_handle: &AppHandle) -> Result<(Connection, PathBuf), String> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path).map_err(|e| format!("Error al abrir BD: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL;").ok();
    conn.execute_batch("PRAGMA foreign_keys=ON;").ok();

    conn.execute_batch(crate::migrations::SQL_CREATE_TABLES)
        .map_err(|e| format!("Error al crear tablas: {}", e))?;

    crate::migrations::run_migrations(&conn);

    insert_default_admin(&conn);
    insert_default_vendedor(&conn);
    insert_default_config(&conn);

    auto_import_products(&conn, app_handle);
    cleanup_old_history(&conn);

    Ok((conn, db_path))
}

fn cleanup_old_history(conn: &Connection) {
    let dias: i64 = conn
        .query_row(
            &format!("SELECT CAST(COALESCE(valor, '0') AS INTEGER) FROM configuracion WHERE clave = '{}'", constants::CFG_HISTORIAL_LIMPIEZA_DIAS),
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|e| { eprintln!("Error leyendo {}: {}", constants::CFG_HISTORIAL_LIMPIEZA_DIAS, e); 0 });
    if dias <= 0 {
        return;
    }
    let cutoff = chrono::Local::now() - chrono::Duration::days(dias);
    let cutoff_str = cutoff.format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "DELETE FROM historial_acciones WHERE fecha_hora < ?1",
        params![cutoff_str],
    )
    .ok();
}

fn insert_default_admin(conn: &Connection) {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM usuarios", [], |row| row.get(0))
        .unwrap_or_else(|e| { eprintln!("Error contando usuarios (admin): {}", e); 0 });

    if count == 0 {
        let admin_pw = crate::auth::hash_password(constants::DEFAULT_ADMIN_PASSWORD);
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)",
            rusqlite::params![constants::DEFAULT_ADMIN_USERNAME, admin_pw, constants::ROL_ADMIN],
        )
        .ok();

        let jota_pw = crate::auth::hash_password(constants::DEFAULT_JOTA_PASSWORD);
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)",
            rusqlite::params![constants::DEFAULT_JOTA_USERNAME, jota_pw, constants::ROL_ADMIN],
        )
        .ok();
    }
}

fn insert_default_vendedor(conn: &Connection) {
    let exists: bool = conn
        .query_row(
            &format!("SELECT COUNT(*) > 0 FROM usuarios WHERE username = '{}'", constants::DEFAULT_VENDEDOR_USERNAME),
            [], |row| row.get(0))
        .unwrap_or_else(|e| { eprintln!("Error verificando vendedor por defecto: {}", e); false });
    if !exists {
        let pw = crate::auth::hash_password(constants::DEFAULT_VENDEDOR_PASSWORD);
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES (?1, ?2, ?3)",
            rusqlite::params![constants::DEFAULT_VENDEDOR_USERNAME, pw, constants::ROL_VENDEDOR],
        )
        .ok();
    }
}

#[allow(unused_variables)]
fn auto_import_products(conn: &Connection, app_handle: &AppHandle) {
    #[cfg(not(target_os = "android"))]
    {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM productos", [], |row| row.get(0))
            .unwrap_or_else(|e| { eprintln!("Error contando productos (auto_import): {}", e); 0 });
        if count > 0 { return; }
        let db_path = get_db_path(app_handle);
        let dir = db_path.parent().unwrap_or(Path::new(DEFAULT_PATH));
        let file_path = dir.join(constants::AUTO_IMPORT_FILENAME);
        if !file_path.exists() { return; }
        let content = match std::fs::read_to_string(&file_path) {
            Ok(c) => c, Err(_) => return,
        };
        for (line_no, line) in content.lines().enumerate() {
            let line = line.trim();
            if line.is_empty() { continue; }
            match crate::products::parse_product_tsv_line(line, line_no, count) {
                Ok((codigo, nombre, stock, precio_usd)) => {
                    conn.execute(
                        &format!("INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, created_at) VALUES (?1, ?2, ?3, ?4, 0, {})", constants::SQL_DATETIME_NOW),
                        rusqlite::params![codigo, nombre, precio_usd, stock],
                    ).ok();
                }
                Err(_) => continue,
            }
        }
    }
}

fn insert_default_config(conn: &Connection) {
    conn.execute(
        &format!("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('{}', '0')", constants::CFG_TASA_DOLAR),
        [],
    )
    .ok();
    conn.execute(
        &format!("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('{}', 'true')", constants::CFG_CAJA_ABIERTA),
        [],
    )
    .ok();
    conn.execute(
        &format!("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('{}', '0')", constants::CFG_HISTORIAL_LIMPIEZA_DIAS),
        [],
    )
    .ok();
}

pub fn get_tasa_from_db(db: &Connection) -> Result<f64, String> {
    db.query_row(crate::constants::SQL_TASA, [], |row| row.get(0))
        .map_err(|e| format!("Error al obtener tasa de cambio: {}", e))
}

fn get_backup_key_from_db(db: &Connection) -> Result<Vec<u8>, String> {
    let hex_key: String = db.query_row(
        &format!("SELECT valor FROM configuracion WHERE clave = '{}'", constants::CFG_BACKUP_KEY),
        [],
        |row| row.get(0),
    ).map_err(|_| "Clave de cifrado de backups no encontrada".to_string())?;
    hex::decode(&hex_key).map_err(|e| format!("Error al decodificar clave: {}", e))
}

fn ensure_backup_key(db: &Connection) -> Result<Vec<u8>, String> {
    let exists: bool = db.query_row(
        &format!("SELECT COUNT(*) > 0 FROM configuracion WHERE clave = '{}'", constants::CFG_BACKUP_KEY),
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if exists {
        return get_backup_key_from_db(db);
    }

    let key_bytes: [u8; 32] = rand::thread_rng().gen();
    let hex_key = hex::encode(key_bytes);
    db.execute(
        &format!("INSERT INTO configuracion (clave, valor) VALUES ('{}', ?1)", constants::CFG_BACKUP_KEY),
        params![hex_key],
    ).map_err(|e| format!("Error al guardar clave de cifrado: {}", e))?;
    Ok(key_bytes.to_vec())
}

fn encrypt_file(src: &Path, dest: &Path, key: &[u8]) -> Result<(), String> {
    let data = std::fs::read(src).map_err(|e| format!("Error al leer archivo: {}", e))?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce_bytes: [u8; 12] = rand::thread_rng().gen();
    let nonce = Nonce::from_slice(&nonce_bytes);
    let encrypted = cipher.encrypt(nonce, data.as_ref())
        .map_err(|e| format!("Error al cifrar: {}", e))?;

    let mut out = Vec::with_capacity(12 + encrypted.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&encrypted);
    std::fs::write(dest, &out).map_err(|e| format!("Error al escribir archivo cifrado: {}", e))?;
    Ok(())
}

fn decrypt_file(src: &Path, key: &[u8]) -> Result<Vec<u8>, String> {
    let data = std::fs::read(src).map_err(|e| format!("Error al leer archivo cifrado: {}", e))?;
    if data.len() < 12 {
        return Err("Archivo cifrado inválido".to_string());
    }
    let (nonce_bytes, encrypted) = data.split_at(12);
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher.decrypt(nonce, encrypted)
        .map_err(|_| "Error al descifrar: clave incorrecta o archivo dañado".to_string())
}

#[tauri::command]
pub fn backup_database(state: State<AppState>, dest_path: String) -> Result<String, String> {
    let db_path = state.db_path.lock().map_err(|_| "Error interno")?.clone();
    let db = state.lock_db()?;
    let _admin = crate::auth::require_admin(&state, &db, "Respaldó la base de datos")?;
    let key = ensure_backup_key(&db)?;
    drop(db);

    let backup_path = if dest_path.is_empty() {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let parent = db_path.parent().unwrap_or(std::path::Path::new("."));
        parent.join(format!("{}_{}.enc", constants::BACKUP_FILENAME_PREFIX, timestamp))
    } else {
        std::path::PathBuf::from(&dest_path)
    };

    let temp_path = backup_path.with_extension("tmp");
    std::fs::copy(&db_path, &temp_path)
        .map_err(|e| format!("Error al copiar BD: {}", e))?;
    encrypt_file(&temp_path, &backup_path, &key)?;
    std::fs::remove_file(&temp_path).ok();

    Ok(format!("Base de datos respaldada y cifrada en: {}", backup_path.display()))
}

#[tauri::command]
pub fn restore_backup(state: State<AppState>, backup_path: String) -> Result<String, String> {
    let db_path = state.db_path.lock().map_err(|_| "Error interno")?.clone();
    let src = PathBuf::from(&backup_path);
    if !src.exists() {
        return Err("Archivo de backup no encontrado".to_string());
    }

    let db = state.lock_db()?;
    let _admin = crate::auth::require_admin(&state, &db, "Restauró backup desde archivo")?;
    let key = get_backup_key_from_db(&db)?;
    drop(db);

    let decrypted = decrypt_file(&src, &key)?;

    let mut temp_src = db_path.clone();
    temp_src.set_extension("db.restore");
    std::fs::write(&temp_src, &decrypted)
        .map_err(|e| format!("Error al escribir archivo temporal: {}", e))?;

    // Validate it's a valid SQLite DB
    let test_conn = Connection::open(&temp_src)
        .map_err(|_| "El archivo descifrado no es una base de datos válida".to_string())?;
    test_conn.query_row("SELECT COUNT(*) FROM sqlite_master", [], |_| Ok(()))
        .map_err(|_| "El archivo descifrado no contiene una base de datos válida".to_string())?;
    drop(test_conn);

    // Close current connection and replace
    let db = state.lock_db()?;
    let _ = db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    drop(db);
    drop(state.db.lock()); // force all locks released

    std::fs::copy(&temp_src, &db_path)
        .map_err(|e| format!("Error al restaurar BD: {}", e))?;
    std::fs::remove_file(&temp_src).ok();

    Ok("Base de datos restaurada exitosamente. Reinicie la aplicación para aplicar los cambios.".to_string())
}

#[tauri::command]
pub fn get_backup_key(state: State<AppState>) -> Result<String, String> {
    let db = state.lock_db()?;
    let _admin = crate::auth::check_admin_role(&state)?;
    let key = get_backup_key_from_db(&db)?;
    Ok(hex::encode(key))
}
