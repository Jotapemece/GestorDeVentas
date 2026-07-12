use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

const SQL_CREATE_TABLES: &str = "
    CREATE TABLE IF NOT EXISTS productos (
        codigo TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        precio_usd REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER NOT NULL DEFAULT 0,
        activo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT NOT NULL CHECK(rol IN ('admin', 'vendedor'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        credito_activo INTEGER NOT NULL DEFAULT 1 CHECK(credito_activo IN (0, 1)),
        saldo_deuda_usd REAL NOT NULL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_hora TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        metodo_pago TEXT NOT NULL,
        referencia_pago_movil TEXT,
        pago_detalle TEXT DEFAULT '',
        cliente_id INTEGER,
        total_usd REAL NOT NULL,
        tasa_aplicada REAL NOT NULL,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS detalles_ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_codigo TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_usd_unitario REAL NOT NULL,
        FOREIGN KEY(venta_id) REFERENCES ventas(id),
        FOREIGN KEY(producto_codigo) REFERENCES productos(codigo)
    );

    CREATE TABLE IF NOT EXISTS historial_acciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_hora TEXT NOT NULL,
        usuario TEXT NOT NULL,
        accion TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cierres_caja (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fecha_hora TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        total_ventas INTEGER NOT NULL,
        total_usd REAL NOT NULL,
        tasa_cierre REAL NOT NULL DEFAULT 0,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS cierres_detalle (
        cierre_id INTEGER PRIMARY KEY,
        detalle_json TEXT NOT NULL,
        FOREIGN KEY(cierre_id) REFERENCES cierres_caja(id)
    );
";

pub struct AppState {
    pub db: Mutex<Connection>,
    pub current_user: Mutex<Option<crate::models::Usuario>>,
}

fn get_db_path(app_handle: &AppHandle) -> PathBuf {
    #[cfg(target_os = "android")]
    {
        let data_dir = app_handle.path().app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("/data/data/com.gestor-ventas.app/databases"));
        return data_dir.join("gestor_ventas.db");
    }

    #[cfg(not(target_os = "android"))]
    {
        let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        path.pop();
        path.push("gestor_ventas.db");
        let src_alt = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("gestor_ventas.db");
        if src_alt.exists() {
            return src_alt;
        }
        path
    }
}

fn migrate_productos(conn: &Connection) {
    let has_column: bool = conn
        .prepare("PRAGMA table_info(productos)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).any(|name| name == "created_at"))
        })
        .unwrap_or(false);
    if !has_column {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN created_at TEXT DEFAULT '';")
            .ok();
        conn.execute_batch("UPDATE productos SET created_at = datetime('now','localtime') WHERE created_at = '';")
            .ok();
    }
}

pub fn init_db(app_handle: &AppHandle) -> Result<Connection, String> {
    let db_path = get_db_path(app_handle);
    let conn = Connection::open(&db_path).map_err(|e| format!("Error al abrir BD: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL;").ok();
    conn.execute_batch("PRAGMA foreign_keys=ON;").ok();

    conn.execute_batch(SQL_CREATE_TABLES)
        .map_err(|e| format!("Error al crear tablas: {}", e))?;

    migrate_productos(&conn);

    conn.execute_batch("ALTER TABLE productos ADD COLUMN stock_minimo INTEGER NOT NULL DEFAULT 0;").ok();

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#CCCCCC'
        );"
    ).ok();

    let has_categoria_id: bool = conn
        .prepare("PRAGMA table_info(productos)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).any(|name| name == "categoria_id"))
        })
        .unwrap_or(false);
    if !has_categoria_id {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id);").ok();
    }

    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);").ok();

    let ventas_sql: String = conn
        .query_row("SELECT sql FROM sqlite_master WHERE type='table' AND name='ventas'", [], |row| row.get(0))
        .unwrap_or_default();
    let has_old_check = ventas_sql.contains("CHECK(metodo_pago IN ('biopago', 'punto', 'pago_movil', 'efectivo', 'credito'))");

    if has_old_check {
        conn.execute_batch(
            "PRAGMA foreign_keys=OFF;
             BEGIN TRANSACTION;
             CREATE TABLE ventas_new (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 fecha_hora TEXT NOT NULL,
                 usuario_id INTEGER NOT NULL,
                 metodo_pago TEXT NOT NULL,
                 referencia_pago_movil TEXT,
                 pago_detalle TEXT DEFAULT '',
                 cliente_id INTEGER,
                 total_usd REAL NOT NULL,
                 tasa_aplicada REAL NOT NULL,
                 FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
                 FOREIGN KEY(cliente_id) REFERENCES clientes(id)
             );
             INSERT INTO ventas_new SELECT id, fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, COALESCE(pago_detalle, ''), cliente_id, total_usd, tasa_aplicada FROM ventas;
             DROP TABLE ventas;
             ALTER TABLE ventas_new RENAME TO ventas;
             COMMIT;
             PRAGMA foreign_keys=ON;"
        ).map_err(|e| format!("Error al migrar tabla ventas: {}", e))?;
    } else {
        let has_pago_detalle: bool = conn
            .prepare("PRAGMA table_info(ventas)")
            .ok()
            .and_then(|mut stmt| {
                stmt.query_map([], |row| row.get::<_, String>(1))
                    .ok()
                    .map(|rows| rows.filter_map(|r| r.ok()).any(|name| name == "pago_detalle"))
            })
            .unwrap_or(false);
        if !has_pago_detalle {
            conn.execute_batch("ALTER TABLE ventas ADD COLUMN pago_detalle TEXT DEFAULT '';").ok();
        }
    }

    let has_activo: bool = conn
        .prepare("PRAGMA table_info(productos)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).any(|name| name == "activo"))
        })
        .unwrap_or(false);
    if !has_activo {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;").ok();
    }

    let has_tasa_cierre: bool = conn
        .prepare("PRAGMA table_info(cierres_caja)")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).any(|name| name == "tasa_cierre"))
        })
        .unwrap_or(false);
    if !has_tasa_cierre {
        conn.execute_batch("ALTER TABLE cierres_caja ADD COLUMN tasa_cierre REAL NOT NULL DEFAULT 0;").ok();
    }

    insert_default_admin(&conn);
    insert_default_vendedor(&conn);
    insert_default_config(&conn);

    conn.execute_batch(
        "UPDATE productos SET nombre = REPLACE(nombre, '*UND*-', '') WHERE nombre LIKE '%*UND*-%';"
    ).ok();

    auto_import_products(&conn, app_handle);
    cleanup_old_history(&conn);

    Ok(conn)
}

fn cleanup_old_history(conn: &Connection) {
    let dias: i64 = conn
        .query_row(
            "SELECT CAST(COALESCE(valor, '0') AS INTEGER) FROM configuracion WHERE clave = 'historial_limpieza_dias'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
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
        .unwrap_or(0);

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
        .unwrap_or(false);
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
            .unwrap_or(0);
        if count > 0 {
            return;
        }
        let db_path = get_db_path(app_handle);
        let dir = db_path.parent().unwrap_or(std::path::Path::new("."));
        let file_path = if dir.join("productos").exists() {
            dir.join("productos")
        } else {
            let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().unwrap_or(std::path::Path::new(".")).to_path_buf();
            let fallback = project_root.join("productos");
            if !fallback.exists() { return; }
            fallback
        };
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
                "INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, created_at) VALUES (?1, ?2, ?3, ?4, 0, datetime('now','localtime'))",
                rusqlite::params![codigo, nombre, precio_usd, stock],
            ).ok();
        }
    }
}

fn insert_default_config(conn: &Connection) {
    conn.execute(
        "INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('tasa_dolar', '0')",
        [],
    )
    .ok();
    conn.execute(
        "INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('caja_abierta', 'true')",
        [],
    )
    .ok();
    conn.execute(
        "INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('historial_limpieza_dias', '0')",
        [],
    )
    .ok();
}
