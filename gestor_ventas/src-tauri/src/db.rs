use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub current_user: Mutex<Option<crate::models::Usuario>>,
}

fn get_db_path() -> PathBuf {
    let mut path = std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("."))
        .parent()
        .unwrap_or_else(|| std::path::Path::new("."))
        .to_path_buf();
    path.push("gestor_ventas.db");
    path
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
            .expect("Failed to migrate productos table");
        conn.execute_batch("UPDATE productos SET created_at = datetime('now','localtime') WHERE created_at = '';")
            .ok();
    }
}

pub fn init_db() -> Connection {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).expect("Failed to open database");

    conn.execute_batch("PRAGMA journal_mode=WAL;").ok();
    conn.execute_batch("PRAGMA foreign_keys=ON;").ok();

    migrate_productos(&conn);

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS productos (
            codigo TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            precio_usd REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            stock_minimo INTEGER NOT NULL DEFAULT 0,
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
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
        );

        CREATE TABLE IF NOT EXISTS cierres_detalle (
            cierre_id INTEGER PRIMARY KEY,
            detalle_json TEXT NOT NULL,
            FOREIGN KEY(cierre_id) REFERENCES cierres_caja(id)
        );

        CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha_hora);
        CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);
        CREATE INDEX IF NOT EXISTS idx_detalles_venta ON detalles_ventas(venta_id);
        CREATE INDEX IF NOT EXISTS idx_historial_fecha ON historial_acciones(fecha_hora);
        ",
    )
    .expect("Failed to create tables");

    // Migration: add stock_minimo column
    conn.execute_batch("ALTER TABLE productos ADD COLUMN stock_minimo INTEGER NOT NULL DEFAULT 0;").ok();

    // Migration: add categorias table and categoria_id column
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

    // Migration: add pago_detalle column + remove CHECK constraint from ventas
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
        ).expect("Failed to migrate ventas table (remove CHECK constraint)");
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

    insert_default_admin(&conn);
    insert_default_vendedor(&conn);
    insert_default_config(&conn);

    conn
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
}
