use crate::constants;
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use rand::Rng;
use rusqlite::{Connection, params};
use tauri::State;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::Instant;
use tauri::AppHandle;
#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(not(target_os = "android"))]
const DEFAULT_PATH: &str = ".";
pub const LOGIN_MAX_ATTEMPTS: i32 = 5;
pub const LOGIN_BLOCK_SECS: u64 = 300;

pub fn check_action_rate_limit(
    attempts: &mut HashMap<String, (i32, Instant)>,
    action_key: &str,
) -> Result<(), String> {
    if let Some(&(count, until)) = attempts.get(action_key) {
        if count >= LOGIN_MAX_ATTEMPTS && Instant::now() < until {
            return Err(format!(
                "Demasiados intentos. Intente de nuevo en {} segundos.",
                until.duration_since(Instant::now()).as_secs()
            ));
        }
        if Instant::now() >= until {
            attempts.remove(action_key);
        }
    }
    Ok(())
}

pub fn rate_limit_fail(attempts: &mut HashMap<String, (i32, Instant)>, action_key: &str) {
    let entry = attempts.entry(action_key.to_string()).or_insert((0, Instant::now()));
    entry.0 += 1;
    if entry.0 >= LOGIN_MAX_ATTEMPTS {
        entry.1 = Instant::now() + std::time::Duration::from_secs(LOGIN_BLOCK_SECS);
    }
}

pub fn rate_limit_success(attempts: &mut HashMap<String, (i32, Instant)>, action_key: &str) {
    attempts.remove(action_key);
}

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
        conn.execute_batch("PRAGMA busy_timeout=5000;").ok();
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
    conn.execute_batch("PRAGMA busy_timeout=5000;").ok();

    conn.execute_batch(crate::migrations::SQL_CREATE_TABLES)
        .map_err(|e| format!("Error al crear tablas: {}", e))?;

    crate::migrations::run_migrations(&conn);

    insert_default_admin(&conn);
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
        let admin_pw = match crate::auth::hash_password(constants::DEFAULT_ADMIN_PASSWORD) {
            Ok(pw) => pw,
            Err(e) => { eprintln!("[db] Error al generar hash admin: {}", e); return; }
        };
        conn.execute(
            "INSERT INTO usuarios (username, password, rol, sync_id) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![constants::DEFAULT_ADMIN_USERNAME, admin_pw, constants::ROL_ADMIN, "admin-1"],
        )
        .unwrap_or_else(|e| { eprintln!("[db] Error al crear usuario admin por defecto: {}", e); 0 });
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
    conn.execute(
        &format!("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('{}', '{}')", constants::CFG_MAX_BACKUPS, constants::DEFAULT_MAX_BACKUPS),
        [],
    )
    .ok();
}

pub fn get_tasa_from_db(db: &Connection) -> Result<f64, String> {
    db.query_row(crate::constants::SQL_TASA, [], |row| row.get(0))
        .map_err(|e| format!("Error al obtener tasa de cambio: {}", e))
}

const SQL_GET_CONFIG: &str = "SELECT valor FROM configuracion WHERE clave = ?1";
const SQL_UPSERT_CONFIG: &str =
    "INSERT INTO configuracion (clave, valor) VALUES (?1, ?2) \
     ON CONFLICT(clave) DO UPDATE SET valor = ?2";

pub fn get_config_value(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    match conn.query_row(SQL_GET_CONFIG, params![key], |row| row.get::<_, String>(0)) {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Error al leer configuración '{}': {}", key, e)),
    }
}

pub fn set_config_value(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(SQL_UPSERT_CONFIG, params![key, value])
        .map(|_| ())
        .map_err(|e| format!("Error al guardar configuración '{}': {}", key, e))
}

pub fn add_stock(conn: &Connection, codigo: &str, cantidad: f64) -> Result<(), String> {
    conn.execute(
        "UPDATE productos SET stock = stock + ?1 WHERE codigo = ?2",
        params![cantidad, codigo],
    )
    .map(|_| ())
    .map_err(|e| format!("Error al restaurar stock: {}", e))
}

pub fn sub_stock(conn: &Connection, codigo: &str, cantidad: f64) -> Result<usize, String> {
    conn.execute(
        "UPDATE productos SET stock = stock - ?1 WHERE codigo = ?2 AND stock >= ?1",
        params![cantidad, codigo],
    )
    .map_err(|e| format!("Error al actualizar stock: {}", e))
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

fn sanitize_backup_path(path: &Path, db_path: &Path) -> Result<(), String> {
    let canonical = path
        .canonicalize()
        .map_err(|_| format!("Ruta no válida: {}", path.display()))?;
    let db_dir = db_path
        .parent()
        .ok_or_else(|| "No se pudo determinar el directorio de la BD".to_string())?
        .canonicalize()
        .map_err(|_| "No se pudo resolver el directorio de la BD".to_string())?;
    let temp_dir = std::env::temp_dir().canonicalize().unwrap_or_default();
    if canonical.starts_with(&db_dir) || canonical.starts_with(&temp_dir) {
        return Ok(());
    }
    Err("La ruta del backup debe estar en el directorio de la BD o en el directorio temporal".to_string())
}

#[tauri::command]
pub fn backup_database(state: State<AppState>, dest_path: String) -> Result<String, String> {
    let db_path = state.db_path.lock().map_err(|_| "Error interno")?.clone();
    let db = state.lock_db()?;
    let _admin = crate::auth::require_admin(&state, &db, "Respaldó la base de datos")?;
    do_backup(&db, &db_path, if dest_path.is_empty() { None } else { Some(&dest_path) })
}

/// Genera un backup cifrado en el directorio temporal y devuelve su contenido en
/// base64 con el nombre de archivo sugerido. Pensado para Android, donde el
/// frontend entrega el resultado a la carpeta Descargas vía plugin.
#[tauri::command]
pub fn backup_database_b64(state: State<AppState>) -> Result<serde_json::Value, String> {
    use base64::Engine;
    let db_path = state.db_path.lock().map_err(|_| "Error interno")?.clone();
    let db = state.lock_db()?;
    let _admin = crate::auth::require_admin(&state, &db, "Respaldó la base de datos")?;

    let dest = std::env::temp_dir().join("gestor_ventas_backup_download.enc");
    let _msg = do_backup(&db, &db_path, Some(dest.to_str().unwrap_or_default()))?;

    let bytes = std::fs::read(&dest).map_err(|e| format!("Error al leer backup: {}", e))?;
    let _ = std::fs::remove_file(&dest);
    let file_name = format!(
        "gestor_ventas_backup_{}.enc",
        chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    Ok(serde_json::json!({
        "file_name": file_name,
        "base64": base64::engine::general_purpose::STANDARD.encode(&bytes)
    }))
}

/// Copia y cifra la BD en una ruta de backup. `dest_path` opcional; si es None se
/// genera un nombre con timestamp. NO comprueba permisos de admin (usado también
/// desde cierre de caja). Requiere conexión `&Connection` viva para poder leer la
/// clave de cifrado antes de copiar.
pub fn do_backup(
    db: &rusqlite::Connection,
    db_path: &std::path::Path,
    dest_path: Option<&str>,
) -> Result<String, String> {
    let key = ensure_backup_key(db)?;

    // Forzar checkpoint WAL para que el archivo copiado incluya todas las transacciones
    // pendientes en el -wal (de lo contrario un backup con WAL activo perdería datos).
    db.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))
        .map_err(|e| format!("Error al checkpointear WAL antes del backup: {}", e))?;

    let backup_path = if let Some(dest) = dest_path.filter(|d| !d.is_empty()) {
        let p = std::path::PathBuf::from(dest);
        sanitize_backup_path(&p, db_path)?;
        p
    } else {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let parent = db_path.parent().unwrap_or(std::path::Path::new("."));
        parent.join(format!("{}_{}.enc", constants::BACKUP_FILENAME_PREFIX, timestamp))
    };

    let temp_path = backup_path.with_extension("tmp");
    std::fs::copy(db_path, &temp_path)
        .map_err(|e| format!("Error al copiar BD: {}", e))?;
    encrypt_file(&temp_path, &backup_path, &key)?;
    std::fs::remove_file(&temp_path).ok();

    let _ = prune_old_backups(db, db_path);

    Ok(format!("Base de datos respaldada y cifrada en: {}", backup_path.display()))
}

/// Elimina backups antiguos en el directorio de la BD hasta dejar `CFG_MAX_BACKUPS`.
/// Devuelve la cantidad de archivos eliminados. Si `CFG_MAX_BACKUPS` es 0 no elimina nada.
fn prune_old_backups(db: &rusqlite::Connection, db_path: &std::path::Path) -> Result<usize, String> {
    let max: usize = crate::db::get_config_value(db, constants::CFG_MAX_BACKUPS)
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(constants::DEFAULT_MAX_BACKUPS);
    if max == 0 {
        return Ok(0);
    }
    let parent = db_path.parent().unwrap_or(std::path::Path::new("."));
    let prefix = constants::BACKUP_FILENAME_PREFIX;
    let mut files: Vec<std::path::PathBuf> = std::fs::read_dir(parent)
        .map_err(|e| format!("Error al listar backups: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| {
            p.extension().and_then(|x| x.to_str()) == Some("enc")
                && p.file_name().and_then(|f| f.to_str()).map_or(false, |f| f.starts_with(prefix))
        })
        .collect();
    files.sort();
    files.reverse();
    let mut removed = 0;
    for old in files.iter().skip(max) {
        if std::fs::remove_file(old).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

/// Genera un backup diario si aún no se hizo uno hoy. Devuelve `Ok(None)` si ya
/// existe uno para el día. Pensado para llamarse al cerrar caja.
pub fn ensure_daily_backup(state: &AppState) -> Result<Option<String>, String> {
    let db_path = state.db_path.lock().map_err(|_| "Error interno")?.clone();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let db = state.lock_db()?;
    let last = crate::db::get_config_value(&db, constants::CFG_ULTIMO_BACKUP_DIARIO)
        .unwrap_or_default()
        .unwrap_or_default();
    if last == today {
        return Ok(None);
    }
    let msg = do_backup(&db, &db_path, None)?;
    crate::db::set_config_value(&db, constants::CFG_ULTIMO_BACKUP_DIARIO, &today)?;
    Ok(Some(msg))
}

#[tauri::command]
pub fn restore_backup(state: State<AppState>, backup_path: String) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "restore_backup",
    )?;
    let db_path = state.db_path.lock().map_err(|_| "Error interno")?.clone();
    let src = PathBuf::from(&backup_path);
    sanitize_backup_path(&src, &db_path)?;
    if !src.exists() {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "restore_backup");
        }
        return Err("Archivo de backup no encontrado".to_string());
    }

    let key = {
        let db = state.lock_db()?;
        crate::auth::require_admin(&state, &db, "Restauró backup desde archivo")?;
        get_backup_key_from_db(&db)?
    };

    let decrypted = decrypt_file(&src, &key)?;

    let temp_src = db_path.with_extension("db.restore");
    std::fs::write(&temp_src, &decrypted)
        .map_err(|e| format!("Error al escribir archivo temporal: {}", e))?;

    // Validate it's a valid SQLite DB
    let test_conn = Connection::open(&temp_src)
        .map_err(|_| "El archivo descifrado no es una base de datos válida".to_string())?;
    test_conn.query_row("SELECT COUNT(*) FROM sqlite_master", [], |_| Ok(()))
        .map_err(|_| "El archivo descifrado no contiene una base de datos válida".to_string())?;
    drop(test_conn);

    // Hold DB lock, checkpoint WAL, then copy — no race window
    let db = state.lock_db()?;
    let _ = db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    std::fs::copy(&temp_src, &db_path)
        .map_err(|e| format!("Error al restaurar BD: {}", e))?;
    drop(db);
    std::fs::remove_file(&temp_src).ok();

    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "restore_backup");
    }

    Ok("Base de datos restaurada exitosamente. Reinicie la aplicación para aplicar los cambios.".to_string())
}

#[tauri::command]
pub fn get_backup_key(state: State<AppState>) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "get_backup_key",
    )?;
    let db = state.lock_db()?;
    let _admin = crate::auth::check_admin_role(&state)?;
    let key = get_backup_key_from_db(&db)?;
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "get_backup_key");
    }
    Ok(hex::encode(key))
}

#[cfg(test)]
pub mod test_support {
    use super::*;

    /// Crea una BD SQLite en memoria con el esquema y migraciones completas,
    /// usuario admin por defecto y config base. Reutilizable en tests de otros módulos.
    pub fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        conn.execute_batch(crate::migrations::SQL_CREATE_TABLES).unwrap();
        crate::migrations::run_migrations(&conn);
        insert_default_admin(&conn);
        insert_default_config(&conn);
        conn
    }
}
