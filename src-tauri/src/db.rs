use crate::constants;
use rusqlite::{Connection, params};
use tauri::State;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Instant;
use tauri::AppHandle;
#[cfg(target_os = "android")]
use tauri::Manager;

const DEFAULT_PATH: &str = ".";
pub const LOGIN_MAX_ATTEMPTS: i32 = 5;
pub const LOGIN_BLOCK_SECS: u64 = 300;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub db_path: Mutex<PathBuf>,
    pub current_user: Mutex<Option<crate::models::Usuario>>,
    pub login_attempts: Mutex<HashMap<String, (i32, Instant)>>,
}

fn get_db_path(_app_handle: &AppHandle) -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let data_dir = _app_handle.path().app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("/data/data/com.gestor-ventas.app/databases"));
        return data_dir.join("gestor_ventas.db");
    }

    // Desktop: usar directorio del ejecutable (portable-friendly)
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("gestor_ventas.db");
        }
    }
    PathBuf::from("gestor_ventas.db")
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
        let admin_pw = crate::auth::hash_password("admin");
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('admin', ?1, 'admin')",
            rusqlite::params![admin_pw],
        )
        .ok();

        let jota_pw = crate::auth::hash_password("1234");
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('jota', ?1, 'admin')",
            rusqlite::params![jota_pw],
        )
        .ok();
    }
}

fn insert_default_vendedor(conn: &Connection) {
    let exists: bool = conn
        .query_row("SELECT COUNT(*) > 0 FROM usuarios WHERE username = 'vendedor'", [], |row| row.get(0))
        .unwrap_or_else(|e| { eprintln!("Error verificando vendedor por defecto: {}", e); false });
    if !exists {
        let pw = crate::auth::hash_password("1234");
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('vendedor', ?1, 'vendedor')",
            rusqlite::params![pw],
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
        if count > 0 {
            return;
        }
        let db_path = get_db_path(app_handle);
        let dir = db_path.parent().unwrap_or(Path::new(DEFAULT_PATH));
        let file_path = dir.join("productos");
        if !file_path.exists() { return; }
        let content = match std::fs::read_to_string(&file_path) {
            Ok(c) => c,
            Err(_) => return,
        };
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() { continue; }
            let cols: Vec<&str> = line.split('\t').collect();
            if cols.len() < 3 { continue; }
            let (codigo, nombre, stock_str, precio_str) = match cols.len() {
                7 => {
                    let code = cols[0].trim();
                    let name = cols[1].trim().trim_end_matches(',');
                    let stock = cols[2].trim().trim_end_matches(',');
                    let price = cols[5].trim().replace(',', ".");
                    (Some(code.to_string()), name, stock, price)
                }
                6 => {
                    let name = cols[0].trim().trim_end_matches(',');
                    let stock = cols[1].trim().trim_end_matches(',');
                    let price = cols[4].trim().replace(',', ".");
                    (None, name, stock, price)
                }
                _ => {
                    let name = cols[0].trim().trim_end_matches(',');
                    let stock = cols[1].trim().trim_end_matches(',');
                    let price = cols[2].trim().replace(',', ".");
                    (None, name, stock, price)
                }
            };
            let stock: i64 = match stock_str.parse() { Ok(s) => s, Err(_) => continue };
            let precio_usd: f64 = match precio_str.parse() { Ok(p) => p, Err(_) => continue };
            let codigo = codigo.unwrap_or_else(|| format!("P{:04}", count + 1));
            let nombre = nombre.trim_end_matches("*UND*-").trim_end_matches(',');
            conn.execute(
                &format!("INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, created_at) VALUES (?1, ?2, ?3, ?4, 0, {})", constants::SQL_DATETIME_NOW),
                rusqlite::params![codigo, nombre, precio_usd, stock],
            ).ok();
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
        parent.join(format!("gestor_ventas_backup_{}.db", timestamp))
    } else {
        std::path::PathBuf::from(&dest_path)
    };

    std::fs::copy(&db_path, &backup_path)
        .map_err(|e| format!("Error al copiar BD: {}", e))?;

    Ok(format!("Base de datos respaldada en: {}", backup_path.display()))
}
