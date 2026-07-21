use crate::constants;
use rusqlite::{Connection, params};
use tauri::State;
use std::collections::HashMap;
#[cfg(not(target_os = "android"))]
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

#[tauri::command]
pub fn backup_database(state: State<AppState>, dest_path: String) -> Result<String, String> {
    let db_path = state.db_path.lock().map_err(|_| "Error interno")?.clone();

    let backup_path = if dest_path.is_empty() {
        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
        let parent = db_path.parent().unwrap_or(std::path::Path::new("."));
        parent.join(format!("{}_{}.db", constants::BACKUP_FILENAME_PREFIX, timestamp))
    } else {
        std::path::PathBuf::from(&dest_path)
    };

    std::fs::copy(&db_path, &backup_path)
        .map_err(|e| format!("Error al copiar BD: {}", e))?;

    Ok(format!("Base de datos respaldada en: {}", backup_path.display()))
}
