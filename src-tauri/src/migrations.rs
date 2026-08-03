use rusqlite::Connection;

pub const SQL_CREATE_TABLES: &str = "
    CREATE TABLE IF NOT EXISTS productos (
        codigo TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        precio_usd REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER NOT NULL DEFAULT 0,
        activo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        favorito INTEGER NOT NULL DEFAULT 0
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
        saldo_deuda_usd REAL NOT NULL DEFAULT 0.0,
        sync_id TEXT,
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        es_temporal INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT ''
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
        sync_id TEXT,
        dispositivo_origen TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        nota TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(cliente_id) REFERENCES clientes(id)
    );

    CREATE TABLE IF NOT EXISTS detalles_ventas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        venta_id INTEGER NOT NULL,
        producto_codigo TEXT NOT NULL,
        cantidad INTEGER NOT NULL,
        precio_usd_unitario REAL NOT NULL,
        sync_id TEXT,
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

#[allow(clippy::type_complexity)]
const MIGRATIONS: &[(&str, fn(&Connection) -> Result<(), String>)] = &[
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
    ("012_add_anulada_ventas", add_anulada_ventas),
    ("013_add_anulado_detalles", add_anulado_detalles),
    ("014_add_sync_fields", add_sync_fields),
    ("015_add_client_sync_fields", add_client_sync_fields),
    ("016_add_product_updated_at_conflictos", add_product_updated_at_conflictos),
    ("017_add_costo_productos", add_costo_productos),
    ("018_add_historial_tasas", add_historial_tasas),
    ("019_add_password_change_required", add_password_change_required),
    ("020_add_es_inari", add_es_inari),
    ("021_add_subcategoria_combos", add_subcategoria_combos),
    ("022_add_inari_products", add_inari_products),
    ("023_add_inari_bebidas", add_inari_bebidas),
    ("024_add_usuarios_sync_fields", add_usuarios_sync_fields),
    ("025_add_ventas_sync_refs", add_ventas_sync_refs),
    ("026_add_movimientos_caja", add_movimientos_caja),
    ("027_add_es_pesable", add_es_pesable),
    ("028_add_nota_anulacion_ventas", add_nota_anulacion_ventas),
    ("029_add_clientes_temporales", add_clientes_temporales),
    ("030_add_qol_fields", add_qol_fields),
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
        if let Err(e) = migration(conn) {
            eprintln!("Migración '{}' falló, no se marcará como aplicada: {}", name, e);
            continue;
        }
        if let Err(e) = conn.execute(
            "INSERT INTO schema_version (version) VALUES (?1)",
            rusqlite::params![name],
        ) {
            eprintln!("Error registrando versión '{}': {}", name, e);
        }
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

fn add_created_at_productos(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "created_at") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN created_at TEXT DEFAULT '';")
            .map_err(|e| format!("001 add created_at: {}", e))?;
        conn.execute_batch("UPDATE productos SET created_at = datetime('now','localtime') WHERE created_at = '';")
            .map_err(|e| format!("001 backfill created_at: {}", e))?;
    }
    Ok(())
}

fn add_stock_minimo_productos(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "stock_minimo") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN stock_minimo INTEGER NOT NULL DEFAULT 0;")
            .map_err(|e| format!("002 add stock_minimo: {}", e))?;
    }
    Ok(())
}

fn create_categorias_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL DEFAULT '#CCCCCC'
        );"
    ).map_err(|e| format!("003 create categorias: {}", e))
}

fn add_categoria_id_productos(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "categoria_id") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN categoria_id INTEGER REFERENCES categorias(id);")
            .map_err(|e| format!("004 add categoria_id: {}", e))?;
    }
    conn.execute_batch("CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);")
        .map_err(|e| format!("004 index categoria: {}", e))
}

fn migrate_ventas_check_constraint(conn: &Connection) -> Result<(), String> {
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
        ).map_err(|e| format!("005 rebuild ventas falló (BD podría estar a medias): {}", e))?;
    }
    Ok(())
}

fn add_pago_detalle_ventas(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "ventas", "pago_detalle") {
        conn.execute_batch("ALTER TABLE ventas ADD COLUMN pago_detalle TEXT DEFAULT '';")
            .map_err(|e| format!("006 add pago_detalle: {}", e))?;
    }
    Ok(())
}

fn add_activo_productos(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "activo") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1;")
            .map_err(|e| format!("007 add activo: {}", e))?;
    }
    Ok(())
}

fn add_tasa_cierre_cierres(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "cierres_caja", "tasa_cierre") {
        conn.execute_batch("ALTER TABLE cierres_caja ADD COLUMN tasa_cierre REAL NOT NULL DEFAULT 0;")
            .map_err(|e| format!("008 add tasa_cierre: {}", e))?;
    }
    Ok(())
}

fn clean_und_prefix(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "UPDATE productos SET nombre = REPLACE(nombre, '*UND*-', '') WHERE nombre LIKE '%*UND*-%';"
    ).map_err(|e| format!("009 clean und prefix: {}", e))
}

fn add_total_bs_cierres(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "cierres_caja", "total_bs") {
        conn.execute_batch(
            "ALTER TABLE cierres_caja ADD COLUMN total_bs REAL NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("011 add total_bs cierres: {}", e))?;
        conn.execute_batch(
            "UPDATE cierres_caja SET total_bs = ROUND(total_usd * tasa_cierre, 2);"
        ).map_err(|e| format!("011 backfill total_bs cierres: {}", e))?;
    }
    Ok(())
}

fn add_anulada_ventas(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "ventas", "anulada") {
        conn.execute_batch("ALTER TABLE ventas ADD COLUMN anulada INTEGER NOT NULL DEFAULT 0;")
            .map_err(|e| format!("012 add anulada: {}", e))?;
    }
    Ok(())
}

fn add_anulado_detalles(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "detalles_ventas", "anulado") {
        conn.execute_batch("ALTER TABLE detalles_ventas ADD COLUMN anulado INTEGER NOT NULL DEFAULT 0;")
            .map_err(|e| format!("013 add anulado: {}", e))?;
    }
    Ok(())
}

fn add_total_bs_ventas(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "ventas", "total_bs") {
        conn.execute_batch(
            "ALTER TABLE ventas ADD COLUMN total_bs REAL NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("010 add total_bs ventas: {}", e))?;
        conn.execute_batch(
            "UPDATE ventas SET total_bs = ROUND(total_usd * tasa_aplicada, 2);"
        ).map_err(|e| format!("010 backfill total_bs ventas: {}", e))?;
    }
    Ok(())
}

fn add_sync_fields(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "ventas", "sync_id") {
        conn.execute("ALTER TABLE ventas ADD COLUMN sync_id TEXT", []).map_err(|e| format!("014 sync_id ventas: {}", e))?;
    }
    if !column_exists(conn, "ventas", "dispositivo_origen") {
        conn.execute("ALTER TABLE ventas ADD COLUMN dispositivo_origen TEXT DEFAULT ''", []).map_err(|e| format!("014 dispositivo_origen: {}", e))?;
    }
    if !column_exists(conn, "ventas", "updated_at") {
        conn.execute(
            "ALTER TABLE ventas ADD COLUMN updated_at TEXT DEFAULT ''",
            [],
        ).map_err(|e| format!("014 updated_at ventas: {}", e))?;
        conn.execute(
            "UPDATE ventas SET updated_at = datetime('now','localtime') WHERE updated_at IS NULL OR updated_at = ''",
            [],
        ).map_err(|e| format!("014 backfill updated_at ventas: {}", e))?;
    }
    if !column_exists(conn, "detalles_ventas", "sync_id") {
        conn.execute("ALTER TABLE detalles_ventas ADD COLUMN sync_id TEXT", []).map_err(|e| format!("014 sync_id detalles: {}", e))?;
    }
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_sync_id ON ventas(sync_id)", []).map_err(|e| format!("014 index ventas: {}", e))?;
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_detalles_ventas_sync_id ON detalles_ventas(sync_id)", []).map_err(|e| format!("014 index detalles: {}", e))?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS ajustes_stock (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sync_id TEXT UNIQUE,
            producto_codigo TEXT NOT NULL,
            cantidad INTEGER NOT NULL,
            motivo TEXT DEFAULT '',
            dispositivo_origen TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY(producto_codigo) REFERENCES productos(codigo)
        );"
    ).map_err(|e| format!("014 ajustes_stock: {}", e))
}

fn add_client_sync_fields(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "clientes", "sync_id") {
        conn.execute("ALTER TABLE clientes ADD COLUMN sync_id TEXT", []).map_err(|e| format!("015 sync_id clientes: {}", e))?;
    }
    if !column_exists(conn, "clientes", "updated_at") {
        conn.execute(
            "ALTER TABLE clientes ADD COLUMN updated_at TEXT DEFAULT ''",
            [],
        ).map_err(|e| format!("015 updated_at clientes: {}", e))?;
        conn.execute(
            "UPDATE clientes SET updated_at = datetime('now','localtime') WHERE updated_at IS NULL OR updated_at = ''",
            [],
        ).map_err(|e| format!("015 backfill updated_at clientes: {}", e))?;
    }
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_sync_id ON clientes(sync_id)", []).map_err(|e| format!("015 index clientes: {}", e))?;
    Ok(())
}

fn add_costo_productos(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "costo") {
        conn.execute_batch(
            "ALTER TABLE productos ADD COLUMN costo REAL NOT NULL DEFAULT 0.0;"
        ).map_err(|e| format!("017 add costo: {}", e))?;
    }
    Ok(())
}

fn add_historial_tasas(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS historial_tasas (
            fecha TEXT PRIMARY KEY,
            tasa REAL NOT NULL,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );"
    ).map_err(|e| format!("018 historial_tasas: {}", e))
}

fn add_product_updated_at_conflictos(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "updated_at") {
        conn.execute(
            "ALTER TABLE productos ADD COLUMN updated_at TEXT DEFAULT ''",
            [],
        ).map_err(|e| format!("016 updated_at productos: {}", e))?;
        conn.execute(
            "UPDATE productos SET updated_at = datetime('now','localtime') WHERE updated_at IS NULL",
            [],
        ).map_err(|e| format!("016 backfill updated_at productos: {}", e))?;
    }
    conn.execute(
        "CREATE TABLE IF NOT EXISTS conflictos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tabla TEXT NOT NULL,
            item_id TEXT NOT NULL,
            local_json TEXT NOT NULL DEFAULT '{}',
            remote_json TEXT NOT NULL DEFAULT '{}',
            resuelto INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )",
        [],
    ).map_err(|e| format!("016 conflictos: {}", e))?;
    Ok(())
}

fn add_es_inari(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "es_inari") {
        conn.execute_batch(
            "ALTER TABLE productos ADD COLUMN es_inari INTEGER NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("020 add es_inari: {}", e))?;
    }
    Ok(())
}

fn add_subcategoria_combos(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "subcategoria") {
        conn.execute_batch("ALTER TABLE productos ADD COLUMN subcategoria TEXT;").map_err(|e| format!("021 subcategoria productos: {}", e))?;
    }
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS combos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            precio_usd REAL NOT NULL,
            subcategoria TEXT NOT NULL DEFAULT 'combos',
            created_at TEXT NOT NULL,
            updated_at TEXT
        );"
    ).map_err(|e| format!("021 combos: {}", e))?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS combo_productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
            producto_codigo TEXT NOT NULL REFERENCES productos(codigo),
            cantidad INTEGER NOT NULL DEFAULT 1
        );"
    ).map_err(|e| format!("021 combo_productos: {}", e))
}

fn add_inari_products(_conn: &Connection) -> Result<(), String> {
    Ok(())
}

fn add_inari_bebidas(_conn: &Connection) -> Result<(), String> {
    Ok(())
}

fn add_usuarios_sync_fields(conn: &Connection) -> Result<(), String> {
    for (col, def) in [
        ("sync_id", "TEXT"),
        ("updated_at", "TEXT DEFAULT (datetime('now','localtime'))"),
        ("dispositivo_origen", "TEXT DEFAULT ''"),
    ] {
        if !column_exists(conn, "usuarios", col) {
            let sql = format!("ALTER TABLE usuarios ADD COLUMN {} {}", col, def);
            conn.execute_batch(&sql).map_err(|e| format!("024 add {} a usuarios: {}", col, e))?;
        }
    }
    if column_exists(conn, "usuarios", "sync_id") {
        conn.execute_batch("CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_sync_id ON usuarios(sync_id)").map_err(|e| format!("024 index usuarios: {}", e))?;
        conn.execute("UPDATE usuarios SET updated_at = datetime('now','localtime'), sync_id = 'admin-' || id WHERE sync_id IS NULL", []).map_err(|e| format!("024 backfill sync_id usuarios: {}", e))?;
    }
    Ok(())
}

fn add_ventas_sync_refs(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "ventas", "usuario_sync_id") {
        conn.execute_batch("ALTER TABLE ventas ADD COLUMN usuario_sync_id TEXT;").map_err(|e| format!("025 usuario_sync_id: {}", e))?;
    }
    if !column_exists(conn, "ventas", "cliente_sync_id") {
        conn.execute_batch("ALTER TABLE ventas ADD COLUMN cliente_sync_id TEXT;").map_err(|e| format!("025 cliente_sync_id: {}", e))?;
    }
    Ok(())
}

fn add_password_change_required(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "usuarios", "password_change_required") {
        conn.execute_batch(
            "ALTER TABLE usuarios ADD COLUMN password_change_required INTEGER NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("019 add password_change_required: {}", e))?;
        conn.execute(
            "UPDATE usuarios SET password_change_required = 1 WHERE username IN ('admin', 'jota', 'vendedor')",
            [],
        ).map_err(|e| format!("019 marcar default users: {}", e))?;
    }
    Ok(())
}

fn add_movimientos_caja(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS movimientos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
            monto_bs REAL NOT NULL DEFAULT 0,
            monto_usd REAL NOT NULL DEFAULT 0,
            concepto TEXT NOT NULL,
            usuario_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
        );"
    ).map_err(|e| format!("026 movimientos_caja: {}", e))
}

fn add_es_pesable(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "productos", "es_pesable") {
        conn.execute_batch(
            "ALTER TABLE productos ADD COLUMN es_pesable INTEGER NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("027 add es_pesable: {}", e))?;
    }
    Ok(())
}

fn add_nota_anulacion_ventas(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "ventas", "nota_anulacion") {
        conn.execute_batch(
            "ALTER TABLE ventas ADD COLUMN nota_anulacion TEXT;"
        ).map_err(|e| format!("028 add nota_anulacion: {}", e))?;
    }
    Ok(())
}

fn add_clientes_temporales(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "clientes", "es_temporal") {
        conn.execute_batch(
            "ALTER TABLE clientes ADD COLUMN es_temporal INTEGER NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("029 add es_temporal: {}", e))?;
    }
    if !column_exists(conn, "clientes", "created_at") {
        conn.execute_batch(
            "ALTER TABLE clientes ADD COLUMN created_at TEXT DEFAULT '';"
        ).map_err(|e| format!("029 add created_at a clientes: {}", e))?;
        conn.execute_batch(
            "UPDATE clientes SET created_at = COALESCE(updated_at, datetime('now','localtime')) WHERE created_at IS NULL OR created_at = '';"
        ).map_err(|e| format!("029 backfill created_at clientes: {}", e))?;
    }
    if !column_exists(conn, "ajustes_stock", "usuario") {
        conn.execute_batch(
            "ALTER TABLE ajustes_stock ADD COLUMN usuario TEXT;"
        ).map_err(|e| format!("029 add usuario a ajustes_stock: {}", e))?;
    }
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS clientes_eliminados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            saldo_pagado_usd REAL NOT NULL DEFAULT 0,
            creado_en TEXT NOT NULL,
            eliminado_en TEXT NOT NULL,
            motivo TEXT NOT NULL DEFAULT ''
        );"
    ).map_err(|e| format!("029 clientes_eliminados: {}", e))
}

fn add_qol_fields(conn: &Connection) -> Result<(), String> {
    if !column_exists(conn, "ventas", "nota") {
        conn.execute_batch(
            "ALTER TABLE ventas ADD COLUMN nota TEXT NOT NULL DEFAULT '';"
        ).map_err(|e| format!("030 add nota a ventas: {}", e))?;
    }
    if !column_exists(conn, "productos", "favorito") {
        conn.execute_batch(
            "ALTER TABLE productos ADD COLUMN favorito INTEGER NOT NULL DEFAULT 0;"
        ).map_err(|e| format!("030 add favorito a productos: {}", e))?;
    }
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS historial_precios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_codigo TEXT NOT NULL,
            precio_anterior REAL NOT NULL,
            precio_nuevo REAL NOT NULL,
            usuario TEXT NOT NULL DEFAULT '',
            fecha_hora TEXT NOT NULL
        );"
    ).map_err(|e| format!("030 historial_precios: {}", e))?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_historial_precios_codigo ON historial_precios(producto_codigo)",
        [],
    ).map(|_| ()).map_err(|e| format!("030 index historial_precios: {}", e))
}
