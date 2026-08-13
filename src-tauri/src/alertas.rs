use crate::constants;
use crate::db::AppState;
use crate::models::AlertaCredito;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

/// Tipos de alerta de crédito.
pub const TIPO_VENTA_CREDITO: &str = "venta_credito";
pub const TIPO_ABONO: &str = "abono";
pub const TIPO_DEUDA_RAPIDA: &str = "deuda_rapida";
pub const TIPO_ANULACION: &str = "anulacion";

/// Registra una alerta de crédito. Solo se invoca para operaciones hechas por
/// VENDEDORES (no admin) para no generar ruido con la actividad del propio admin.
/// Genera sync_id y updated_at automáticamente para propagarse por Supabase.
pub fn insertar_alerta(
    db: &rusqlite::Connection,
    tipo: &str,
    monto_usd: f64,
    cliente_id: Option<i64>,
    cliente_nombre: &str,
    metodo_pago: &str,
    nota: &str,
    usuario: &str,
) -> Result<(), String> {
    let sync_id = Uuid::new_v4().to_string();
    let now_iso = crate::helpers::now_iso();
    let fecha_hora = crate::helpers::fecha_hora_local();
    db.execute(
        "INSERT INTO alertas_credito \
         (tipo, monto_usd, cliente_id, cliente_nombre, metodo_pago, nota, usuario, \
          fecha_hora, visto, sync_id, updated_at, dispositivo_origen) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?10, '')",
        params![
            tipo,
            monto_usd,
            cliente_id,
            cliente_nombre,
            metodo_pago,
            nota,
            usuario,
            fecha_hora,
            sync_id,
            now_iso,
        ],
    )
    .map_err(|e| format!("Error al registrar alerta de crédito: {}", e))?;
    Ok(())
}

fn row_to_alerta(row: &rusqlite::Row) -> rusqlite::Result<AlertaCredito> {
    let visto: i64 = row.get(9)?;
    Ok(AlertaCredito {
        id: row.get(0)?,
        tipo: row.get(1)?,
        monto_usd: row.get(2)?,
        cliente_id: row.get(3)?,
        cliente_nombre: row.get(4)?,
        metodo_pago: row.get(5)?,
        nota: row.get(6)?,
        usuario: row.get(7)?,
        fecha_hora: row.get(8)?,
        visto: visto != 0,
    })
}

/// Lista las alertas de crédito de más reciente a más antigua.
#[tauri::command]
pub fn get_alertas_credito(
    state: State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<AlertaCredito>, String> {
    crate::auth::check_admin_role(&state)?;
    let lim = limit.unwrap_or(50).max(1).min(200);
    let off = offset.unwrap_or(0).max(0);
    let db = state.lock_db()?;
    let mut stmt = db
        .prepare(
            "SELECT id, tipo, monto_usd, cliente_id, cliente_nombre, metodo_pago, \
             nota, usuario, fecha_hora, visto \
             FROM alertas_credito ORDER BY fecha_hora DESC, id DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;
    let alertas: Vec<AlertaCredito> = stmt
        .query_map(params![lim, off], row_to_alerta)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(alertas)
}

/// Cuenta las alertas de crédito aún no vistas (para el badge del sidebar).
#[tauri::command]
pub fn get_alertas_credito_nuevas(state: State<AppState>) -> Result<i64, String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;
    let n: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM alertas_credito WHERE visto = 0",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n)
}

/// Marca todas las alertas de crédito como vistas (baja el badge a 0).
#[tauri::command]
pub fn marcar_alertas_credito_vistas(state: State<AppState>) -> Result<(), String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;
    db.execute("UPDATE alertas_credito SET visto = 1 WHERE visto = 0", [])
        .map_err(|e| format!("Error al marcar alertas vistas: {}", e))?;
    Ok(())
}

/// True si el rol del autor NO es admin (es decir, operación de vendedor que
/// debe generar alerta). Helper usado en los puntos de negocio.
pub fn autor_es_admin(rol: &str) -> bool {
    rol == constants::ROL_ADMIN
}

/// Registra una alerta de crédito SOLO si el autor (por username) es vendedor.
/// Consulta el rol en la BD; las operaciones del admin no generan ruido.
pub fn insertar_alerta_si_vendedor(
    db: &rusqlite::Connection,
    usuario: &str,
    tipo: &str,
    monto_usd: f64,
    cliente_id: Option<i64>,
    cliente_nombre: &str,
    metodo_pago: &str,
    nota: &str,
) -> Result<(), String> {
    let rol: String = db
        .query_row(
            "SELECT COALESCE(rol, '') FROM usuarios WHERE username = ?1",
            params![usuario],
            |r| r.get(0),
        )
        .unwrap_or_default();
    if autor_es_admin(&rol) {
        return Ok(());
    }
    insertar_alerta(db, tipo, monto_usd, cliente_id, cliente_nombre, metodo_pago, nota, usuario)
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
    fn test_insertar_y_listar_alerta() {
        let conn = setup();
        insertar_alerta(
            &conn,
            TIPO_ABONO,
            25.0,
            Some(3),
            "Juan Pérez",
            "efectivo_bs",
            "Abono deuda",
            "vendedor1",
        )
        .unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM alertas_credito", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
        let sync_id: String = conn
            .query_row("SELECT sync_id FROM alertas_credito", [], |r| r.get(0))
            .unwrap();
        assert!(!sync_id.is_empty());

        // el mapeo de fila debe leer la col `visto` (índice correcto) sin fallar
        let mut stmt = conn
            .prepare(
                "SELECT id, tipo, monto_usd, cliente_id, cliente_nombre, metodo_pago, \
                 nota, usuario, fecha_hora, visto FROM alertas_credito",
            )
            .unwrap();
        let alertas: Vec<AlertaCredito> = stmt
            .query_map([], row_to_alerta)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(alertas.len(), 1);
        assert_eq!(alertas[0].tipo, TIPO_ABONO);
        assert_eq!(alertas[0].monto_usd, 25.0);
        assert_eq!(alertas[0].cliente_nombre, "Juan Pérez");
        assert!(!alertas[0].visto);
    }

    #[test]
    fn test_insertar_alerta_genera_sync_id_unico() {
        let conn = setup();
        insertar_alerta(&conn, TIPO_ABONO, 10.0, None, "A", "punto", "x", "vendedor").unwrap();
        insertar_alerta(&conn, TIPO_ABONO, 20.0, None, "B", "punto", "y", "vendedor").unwrap();
        let ids: Vec<String> = conn
            .prepare("SELECT sync_id FROM alertas_credito")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(ids.len(), 2);
        assert_ne!(ids[0], ids[1]);
    }

    #[test]
    fn test_autor_es_admin() {
        assert!(autor_es_admin(constants::ROL_ADMIN));
        assert!(!autor_es_admin(constants::ROL_VENDEDOR));
    }

    #[test]
    fn test_insertar_alerta_si_vendedor_inserta_para_vendedor() {
        let conn = setup();
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('vendedor1', 'x', ?1)",
            params![constants::ROL_VENDEDOR],
        )
        .unwrap();
        insertar_alerta_si_vendedor(
            &conn,
            "vendedor1",
            TIPO_ABONO,
            15.0,
            Some(1),
            "Cliente",
            "efectivo_usd",
            "nota",
        )
        .unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM alertas_credito", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 1);
        let (tipo, usuario): (String, String) = conn
            .query_row(
                "SELECT tipo, usuario FROM alertas_credito",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(tipo, TIPO_ABONO);
        assert_eq!(usuario, "vendedor1");
    }

    #[test]
    fn test_insertar_alerta_si_vendedor_omite_admin() {
        let conn = setup();
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('admin1', 'x', ?1)",
            params![constants::ROL_ADMIN],
        )
        .unwrap();
        insertar_alerta_si_vendedor(
            &conn,
            "admin1",
            TIPO_ABONO,
            15.0,
            Some(1),
            "Cliente",
            "efectivo_usd",
            "nota",
        )
        .unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM alertas_credito", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }

    #[test]
    fn test_insertar_alerta_si_vendedor_consulta_rol_en_bd() {
        // Un username que existe como admin en la BD no debe insertar, aunque se
        // le pase por parámetro un rol de vendedor (el rol SIEMPRE sale de la BD).
        let conn = setup();
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('jefe', 'x', ?1)",
            params![constants::ROL_ADMIN],
        )
        .unwrap();
        insertar_alerta_si_vendedor(&conn, "jefe", TIPO_DEUDA_RAPIDA, 5.0, None, "C", "", "n").unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM alertas_credito", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
    }
}
