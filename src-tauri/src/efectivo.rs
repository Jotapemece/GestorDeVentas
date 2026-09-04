use crate::constants;
use crate::db::AppState;
use rusqlite::Connection;
use rusqlite::params;
use tauri::State;

/// Saldo de efectivo físico disponible en Bs. (el "stock" del pseudo-producto
/// `EFECTIVO`). Almacenado en `productos.stock` como centavos (×100) para
/// mantener precisión con la columna INTEGER.
pub(crate) fn efectivo_disponible(conn: &Connection) -> Result<f64, String> {
    let centavos: i64 = conn
        .query_row(
            "SELECT stock FROM productos WHERE codigo = ?1",
            params![constants::CODIGO_EFECTIVO],
            |row| row.get(0),
        )
        .unwrap_or(0);
    Ok(centavos as f64 / 100.0)
}

pub(crate) fn set_efectivo(conn: &Connection, valor: f64) -> Result<(), String> {
    if !valor.is_finite() {
        return Err("El efectivo disponible no es válido".to_string());
    }
    if valor < 0.0 {
        return Err("El efectivo disponible no puede ser negativo".to_string());
    }
    let centavos = (valor * 100.0).round() as i64;
    conn.execute(
        "UPDATE productos SET stock = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE codigo = ?2",
        params![centavos, constants::CODIGO_EFECTIVO],
    )
    .map_err(|e| format!("Error al actualizar efectivo: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_efectivo_saldo(state: State<AppState>) -> Result<f64, String> {
    state.get_username()?;
    let db = state.lock_db()?;
    efectivo_disponible(&db)
}

#[tauri::command]
pub fn ajustar_efectivo_bs(
    state: State<AppState>,
    delta: f64,
    motivo: String,
) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "ajustar_efectivo_bs",
    )?;
    let username = state.get_username()?;
    let mut db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Ajustó efectivo disponible ({:+} Bs.) — {}", delta, motivo.trim()),
    )?;
    let res = ajustar_efectivo_bs_inner(&mut db, delta, &motivo, &username);
    if res.is_ok() {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_success(&mut attempts, "ajustar_efectivo_bs");
        }
    }
    res
}

/// Lógica del ajuste de efectivo sobre una conexión. Separado del comando para
/// poder testearlo sin `State`.
fn ajustar_efectivo_bs_inner(
    db: &mut rusqlite::Connection,
    delta: f64,
    motivo: &str,
    username: &str,
) -> Result<String, String> {
    if !delta.is_finite() || delta == 0.0 {
        return Err("El delta debe ser un número distinto de cero".to_string());
    }
    let motivo = motivo.trim().to_string();
    if motivo.is_empty() {
        return Err("Debe indicar un motivo para el ajuste".to_string());
    }

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    let actual = efectivo_disponible(&tx)?;
    let nuevo = actual + delta;
    if nuevo < 0.0 {
        return Err(format!(
            "El ajuste dejaría el efectivo en negativo (Bs. {:.2})",
            nuevo
        ));
    }
    set_efectivo(&tx, nuevo)?;
    if let Err(e) = crate::audit::log_action(
        &tx,
        username,
        &format!("Ajustó efectivo disponible: {:+} Bs. (Bs. {:.2} → Bs. {:.2}) — {}", delta, actual, nuevo, motivo),
    ) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }
    tx.commit().map_err(|e| format!("Error al confirmar transacción: {}", e))?;

    Ok(format!("Efectivo ajustado: Bs. {:.2} → Bs. {:.2}", actual, nuevo))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE productos (
                codigo TEXT PRIMARY KEY,
                nombre TEXT NOT NULL,
                precio_usd REAL NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                stock_minimo INTEGER NOT NULL DEFAULT 0,
                activo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now','localtime')),
                updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                favorito INTEGER NOT NULL DEFAULT 0
            );
            INSERT INTO productos (codigo, nombre, precio_usd, stock, activo)
            VALUES ('EFECTIVO', 'Efectivo', 0, 0, 1);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_efectivo_default_cero() {
        let conn = setup();
        assert_eq!(efectivo_disponible(&conn).unwrap(), 0.0);
    }

    #[test]
    fn test_set_y_leer_efectivo() {
        let conn = setup();
        set_efectivo(&conn, 600.0).unwrap();
        assert!((efectivo_disponible(&conn).unwrap() - 600.0).abs() < 0.001);
        set_efectivo(&conn, 123.45).unwrap();
        assert!((efectivo_disponible(&conn).unwrap() - 123.45).abs() < 0.01);
    }

    #[test]
    fn test_efectivo_no_negativo() {
        let conn = setup();
        set_efectivo(&conn, 100.0).unwrap();
        assert!(set_efectivo(&conn, -5.0).is_err());
        assert!((efectivo_disponible(&conn).unwrap() - 100.0).abs() < 0.001);
    }

    #[test]
    fn test_ajuste_sumado() {
        let conn = setup();
        let mut conn = conn;
        set_efectivo(&conn, 100.0).unwrap();
        ajustar_efectivo_bs_inner(&mut conn, 50.0, "reposición", "admin").unwrap();
        assert!((efectivo_disponible(&conn).unwrap() - 150.0).abs() < 0.001);
        ajustar_efectivo_bs_inner(&mut conn, -30.0, "préstamo", "admin").unwrap();
        assert!((efectivo_disponible(&conn).unwrap() - 120.0).abs() < 0.001);
    }

    #[test]
    fn test_ajuste_negativo_rechazado() {
        let conn = setup();
        let mut conn = conn;
        set_efectivo(&conn, 10.0).unwrap();
        assert!(ajustar_efectivo_bs_inner(&mut conn, -50.0, "merma", "admin").is_err());
        assert!((efectivo_disponible(&conn).unwrap() - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_ajuste_delta_cero_o_sin_motivo() {
        let conn = setup();
        let mut conn = conn;
        assert!(ajustar_efectivo_bs_inner(&mut conn, 0.0, "nada", "admin").is_err());
        assert!(ajustar_efectivo_bs_inner(&mut conn, 10.0, "   ", "admin").is_err());
        assert!(ajustar_efectivo_bs_inner(&mut conn, f64::NAN, "raro", "admin").is_err());
    }

    #[test]
    fn test_centavos_se_redondean() {
        let conn = setup();
        set_efectivo(&conn, 10.05).unwrap();
        // 10.05 * 100 = 1005 centavos → 10.05 Bs.
        assert!((efectivo_disponible(&conn).unwrap() - 10.05).abs() < 0.001);
    }
}
