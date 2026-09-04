use crate::constants;
use crate::db::AppState;
use crate::models::AlertaStock;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

/// Registra una alerta de stock. Solo se invoca para operaciones hechas por
/// VENDEDORES (no admin) para no generar ruido con la actividad del propio admin.
/// Genera sync_id y updated_at automáticamente para propagarse por Supabase.
pub fn insertar_alerta_stock(
    db: &rusqlite::Connection,
    producto_codigo: &str,
    producto_nombre: &str,
    cantidad: f64,
    motivo: &str,
    usuario: &str,
) -> Result<(), String> {
    let sync_id = Uuid::new_v4().to_string();
    let now_iso = crate::helpers::now_iso();
    let fecha_hora = crate::helpers::fecha_hora_local();
    db.execute(
        "INSERT INTO alertas_stock \
         (sync_id, producto_codigo, producto_nombre, cantidad, motivo, usuario, \
          fecha_hora, visto, updated_at, dispositivo_origen) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, '')",
        params![
            sync_id,
            producto_codigo,
            producto_nombre,
            cantidad,
            motivo,
            usuario,
            fecha_hora,
            now_iso,
        ],
    )
    .map_err(|e| format!("Error al registrar alerta de stock: {}", e))?;
    Ok(())
}

/// Registra una alerta de stock SOLO si el autor (por username) es vendedor.
/// Consulta el rol en la BD; las operaciones del admin no generan ruido.
pub fn insertar_alerta_stock_si_vendedor(
    db: &rusqlite::Connection,
    usuario: &str,
    producto_codigo: &str,
    producto_nombre: &str,
    cantidad: f64,
    motivo: &str,
) -> Result<(), String> {
    let rol: String = db
        .query_row(
            "SELECT COALESCE(rol, '') FROM usuarios WHERE username = ?1",
            params![usuario],
            |r| r.get(0),
        )
        .unwrap_or_default();
    if rol == constants::ROL_ADMIN {
        return Ok(());
    }
    insertar_alerta_stock(db, producto_codigo, producto_nombre, cantidad, motivo, usuario)
}

fn row_to_alerta_stock(row: &rusqlite::Row) -> rusqlite::Result<AlertaStock> {
    let visto: i64 = row.get(7)?;
    Ok(AlertaStock {
        id: row.get(0)?,
        producto_codigo: row.get(1)?,
        producto_nombre: row.get(2)?,
        cantidad: row.get(3)?,
        motivo: row.get(4)?,
        usuario: row.get(5)?,
        fecha_hora: row.get(6)?,
        visto: visto != 0,
    })
}

/// Lista las alertas de stock de más reciente a más antigua.
#[tauri::command]
pub fn get_alertas_stock(
    state: State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<AlertaStock>, String> {
    crate::auth::check_admin_role(&state)?;
    let lim = limit.unwrap_or(50).max(1).min(200);
    let off = offset.unwrap_or(0).max(0);
    let db = state.lock_db()?;
    let mut stmt = db
        .prepare(
            "SELECT id, producto_codigo, producto_nombre, cantidad, motivo, \
             usuario, fecha_hora, visto \
             FROM alertas_stock ORDER BY fecha_hora DESC, id DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;
    let alertas: Vec<AlertaStock> = stmt
        .query_map(params![lim, off], row_to_alerta_stock)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(alertas)
}

/// Cuenta las alertas de stock aún no vistas (para el badge del sidebar).
#[tauri::command]
pub fn get_alertas_stock_nuevas(state: State<AppState>) -> Result<i64, String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;
    let n: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM alertas_stock WHERE visto = 0",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n)
}

/// Marca todas las alertas de stock como vistas (baja el badge a 0).
#[tauri::command]
pub fn marcar_alertas_stock_vistas(state: State<AppState>) -> Result<(), String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;
    db.execute("UPDATE alertas_stock SET visto = 1 WHERE visto = 0", [])
        .map_err(|e| format!("Error al marcar alertas de stock vistas: {}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::migrations;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(migrations::SQL_CREATE_TABLES).unwrap();
        migrations::run_migrations(&conn);
        conn
    }

    #[test]
    fn test_insertar_alerta_stock_basico() {
        let conn = setup();
        insertar_alerta_stock(&conn, "P001", "Producto Test", 5.0, "reposición", "vendedor1").unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM alertas_stock", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
        let sync_id: String = conn
            .query_row("SELECT sync_id FROM alertas_stock", [], |r| r.get(0))
            .unwrap();
        assert!(!sync_id.is_empty());
    }

    #[test]
    fn test_insertar_alerta_stock_si_vendedor_inserta_para_vendedor() {
        let conn = setup();
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('v1', 'x', ?1)",
            params![constants::ROL_VENDEDOR],
        )
        .unwrap();
        insertar_alerta_stock_si_vendedor(&conn, "v1", "P001", "Prod", 3.0, "merma").unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM alertas_stock", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn test_insertar_alerta_stock_si_vendedor_omite_admin() {
        let conn = setup();
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('admin1', 'x', ?1)",
            params![constants::ROL_ADMIN],
        )
        .unwrap();
        insertar_alerta_stock_si_vendedor(&conn, "admin1", "P001", "Prod", 3.0, "test").unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM alertas_stock", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn test_get_alertas_stock_nuevas() {
        let conn = setup();
        assert_eq!(get_alertas_stock_nuevas_test(&conn), 0);
        insertar_alerta_stock(&conn, "P001", "Prod", 1.0, "m", "u").unwrap();
        assert_eq!(get_alertas_stock_nuevas_test(&conn), 1);
    }

    fn get_alertas_stock_nuevas_test(db: &Connection) -> i64 {
        db.query_row("SELECT COUNT(*) FROM alertas_stock WHERE visto = 0", [], |r| r.get(0)).unwrap()
    }
}
