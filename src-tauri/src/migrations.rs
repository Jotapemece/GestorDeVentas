use rusqlite::Connection;

pub const SQL_CREATE_TABLES: &str = "
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
        total_bs REAL NOT NULL DEFAULT 0,
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
        total_bs REAL NOT NULL DEFAULT 0,
        tasa_cierre REAL NOT NULL DEFAULT 0,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS cierres_detalle (
        cierre_id INTEGER PRIMARY KEY,
        detalle_json TEXT NOT NULL,
        FOREIGN KEY(cierre_id) REFERENCES cierres_caja(id)
    );
";

const MIGRATIONS: &[(&str, fn(&Connection))] = &[
    ("001_add_created_at_productos", add_created_at_productos),
    ("002_add_stock_minimo_productos", add_stock_minimo_productos),
    ("003_create_categorias_table", create_categorias_table),
    ("004_add_categoria_id_productos", add_categoria_id_productos),
    ("005_migrate_ventas_check_constraint", migrate_ventas_check_constraint),
    ("006_add_pago_detalle_ventas", add_pago_detalle_ventas),
    ("007_add_activo_productos", add_activo_productos),
    ("008_add_tasa_cierre_cierres", add_tasa_cierre_cierres),
    ("009_clean_und_prefix", clean_und_prefix),
    ("010_add_total_bs_ventas", add_total_bs_ventas),
    ("011_add_total_bs_cierres", add_total_bs_cierres),
];

fn ensure_schema_version(conn: &Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );"
    ).ok();
}

pub fn run_migrations(conn: &Connection) {
    ensure_schema_version(conn);
    for (name, migration) in MIGRATIONS {
        let already_applied: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM schema_version WHERE version = ?1",
                rusqlite::params![name],
                |row| row.get(0),
            )
            .unwrap_or(false);
        if already_applied {
            continue;
        }
        migration(conn);
        conn.execute(
            "INSERT INTO schema_version (version) VALUES (?1)",
            rusqlite::params![name],
        )
        .ok();
    }
}

fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    conn.prepare(&sql)
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(1))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).any(|name| name == column))
        })
        .unwrap_or(false)
}

fn add_created_at_productos(conn: &Connection) {
    if !column_exists(conn, "productos", "created_at") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN created_at TEXT DEFAULT '';").ok();
        conn.execute_batch("UPDATE productos SET created_at = datetime('now','localtime') WHERE created_at = '';").ok();
    }
}

fn add_stock_minimo_productos(conn: &Connection) {
    conn.execute_batch("ALTER TABLE productos ADD COLUMN stock_minimo INTEGER NOT NULL DEFAULT 0;").ok();
}

fn create_categorias_table(conn: &Connection) {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#CCCCCC'
        );"
    ).ok();
}

fn add_categoria_id_productos(conn: &Connection) {
    if !column_exists(conn, "productos", "categoria_id") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id);").ok();
    }
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);").ok();
}

fn migrate_ventas_check_constraint(conn: &Connection) {
    let ventas_sql: String = conn
        .query_row("SELECT sql FROM sqlite_master WHERE type='table' AND name='ventas'", [], |row| row.get(0))
        .unwrap_or_default();
    if ventas_sql.contains("CHECK(metodo_pago IN ('biopago', 'punto', 'pago_movil', 'efectivo', 'credito'))") {
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
                  total_bs REAL NOT NULL DEFAULT 0,
                  FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
                  FOREIGN KEY(cliente_id) REFERENCES clientes(id)
              );
              INSERT INTO ventas_new SELECT id, fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, COALESCE(pago_detalle, ''), cliente_id, total_usd, tasa_aplicada, COALESCE(total_bs, 0) FROM ventas;
             DROP TABLE ventas;
             ALTER TABLE ventas_new RENAME TO ventas;
             COMMIT;
             PRAGMA foreign_keys=ON;"
        ).ok();
    }
}

fn add_pago_detalle_ventas(conn: &Connection) {
    if !column_exists(conn, "ventas", "pago_detalle") {
        conn.execute_batch("ALTER TABLE ventas ADD COLUMN pago_detalle TEXT DEFAULT '';").ok();
    }
}

fn add_activo_productos(conn: &Connection) {
    if !column_exists(conn, "productos", "activo") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;").ok();
    }
}

fn add_tasa_cierre_cierres(conn: &Connection) {
    if !column_exists(conn, "cierres_caja", "tasa_cierre") {
        conn.execute_batch("ALTER TABLE cierres_caja ADD COLUMN tasa_cierre REAL NOT NULL DEFAULT 0;").ok();
    }
}

fn clean_und_prefix(conn: &Connection) {
    conn.execute_batch(
        "UPDATE productos SET nombre = REPLACE(nombre, '*UND*-', '') WHERE nombre LIKE '%*UND*-%';"
    ).ok();
}

fn add_total_bs_cierres(conn: &Connection) {
    if !column_exists(conn, "cierres_caja", "total_bs") {
        conn.execute_batch(
            "ALTER TABLE cierres_caja ADD COLUMN total_bs REAL NOT NULL DEFAULT 0;"
        ).ok();
        conn.execute_batch(
            "UPDATE cierres_caja SET total_bs = ROUND(total_usd * tasa_cierre, 2);"
        ).ok();
    }
}

fn add_total_bs_ventas(conn: &Connection) {
    if !column_exists(conn, "ventas", "total_bs") {
        conn.execute_batch(
            "ALTER TABLE ventas ADD COLUMN total_bs REAL NOT NULL DEFAULT 0;"
        ).ok();
        conn.execute_batch(
            "UPDATE ventas SET total_bs = ROUND(total_usd * tasa_aplicada, 2);"
        ).ok();
    }
}
