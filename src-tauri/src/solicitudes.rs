use crate::db::AppState;
use crate::models::SolicitudAnulacion;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

pub const ESTADO_PENDIENTE: &str = "pendiente";
pub const ESTADO_APROBADA: &str = "aprobada";
pub const ESTADO_RECHAZADA: &str = "rechazada";

/// Crea una solicitud de anulación de una venta. La usa un VENDEDOR que no tiene
/// permisos de anulación: el admin la revisa en la vista Ventas y la aprueba o
/// rechaza. La venta y su sync_id viajan para que la solicitud pueda resolverse
/// desde cualquier dispositivo.
#[tauri::command]
pub fn solicitar_anulacion(
    state: State<AppState>,
    venta_id: i64,
    motivo: String,
) -> Result<String, String> {
    let motivo = motivo.trim().to_string();
    if motivo.is_empty() {
        return Err("Debe escribir el motivo de la solicitud".to_string());
    }
    if motivo.len() > 500 {
        return Err("El motivo no puede superar los 500 caracteres".to_string());
    }
    let solicitante = crate::auth::employee_guard(
        &state,
        "solicitar_anulacion",
        &format!("Solicitó anulación de venta #{}: {}", venta_id, motivo),
    )?;
    let db = state.lock_db()?;
    let sync_id = Uuid::new_v4().to_string();
    let now = crate::helpers::now_iso();
    let fecha_hora = crate::helpers::fecha_hora_local();

    let (venta_sync_id, anulada): (Option<String>, i64) = db
        .query_row(
            "SELECT COALESCE(sync_id,''), COALESCE(anulada,0) FROM ventas WHERE id = ?1",
            params![venta_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Venta no encontrada".to_string())?;
    if anulada != 0 {
        return Err("La venta ya fue anulada".to_string());
    }
    // No duplicar: si ya existe una solicitud pendiente para esta venta.
    let pendientes: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM solicitudes_anulacion WHERE venta_id = ?1 AND estado = ?2",
            params![venta_id, ESTADO_PENDIENTE],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    if pendientes > 0 {
        return Err("Ya existe una solicitud de anulación pendiente para esta venta".to_string());
    }

    db.execute(
        "INSERT INTO solicitudes_anulacion \
         (venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, sync_id, updated_at, dispositivo_origen) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '')",
        params![venta_id, venta_sync_id.unwrap_or_default(), motivo, solicitante, fecha_hora, ESTADO_PENDIENTE, sync_id, now],
    )
    .map_err(|e| format!("Error al crear la solicitud: {}", e))?;

    Ok("Solicitud de anulación enviada. El administrador la revisará".to_string())
}

fn row_to_solicitud(row: &rusqlite::Row) -> rusqlite::Result<SolicitudAnulacion> {
    Ok(SolicitudAnulacion {
        id: row.get(0)?,
        venta_id: row.get(1)?,
        venta_sync_id: row.get(2)?,
        motivo: row.get(3)?,
        solicitante: row.get(4)?,
        fecha_hora: row.get(5)?,
        estado: row.get(6)?,
        resuelto_por: row.get(7)?,
        nota_resolucion: row.get(8)?,
    })
}

/// Lista las solicitudes de anulación (más recientes primero).
#[tauri::command]
pub fn get_solicitudes_anulacion(
    state: State<AppState>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<SolicitudAnulacion>, String> {
    crate::auth::check_admin_role(&state)?;
    let lim = limit.unwrap_or(50).max(1).min(200);
    let off = offset.unwrap_or(0).max(0);
    let db = state.lock_db()?;
    let mut stmt = db
        .prepare(
            "SELECT id, venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, \
             COALESCE(resuelto_por,''), COALESCE(nota_resolucion,'') \
             FROM solicitudes_anulacion ORDER BY fecha_hora DESC, id DESC LIMIT ?1 OFFSET ?2",
        )
        .map_err(|e| e.to_string())?;
    let solicitudes: Vec<SolicitudAnulacion> = stmt
        .query_map(params![lim, off], row_to_solicitud)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(solicitudes)
}

/// Cuenta las solicitudes de anulación pendientes (para el badge del admin).
#[tauri::command]
pub fn get_solicitudes_anulacion_pendientes(state: State<AppState>) -> Result<i64, String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;
    let n: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM solicitudes_anulacion WHERE estado = ?1",
            params![ESTADO_PENDIENTE],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(n)
}

/// Resuelve una solicitud de anulación. `aprobar=true` anula la venta localmente
/// (si existe) y marca la solicitud aprobada; la anulación se propaga por sync como
/// cualquier otra: el `updated_at` del detalle/venta viaja y el stock se restaura
/// en los otros dispositivos vía la descarga de productos (que trae el stock del
/// vendedor que anuló, ya restaurado localmente con `add_stock`).
/// Si la venta no está presente en ESTE dispositivo, la solicitud queda pendiente
/// (no se consumen créditos contra una venta que no se puede anular aquí).
#[tauri::command]
pub fn resolver_solicitud_anulacion(
    state: State<AppState>,
    solicitud_id: i64,
    aprobar: bool,
    nota: Option<String>,
) -> Result<String, String> {
    let nota = nota.unwrap_or_default();
    let nota = nota.trim().to_string();
    if !aprobar && nota.is_empty() {
        return Err("Debe indicar el motivo del rechazo".to_string());
    }
    if nota.len() > 500 {
        return Err("La nota no puede superar los 500 caracteres".to_string());
    }
    let admin = crate::auth::admin_guard(
        &state,
        "resolver_solicitud_anulacion",
        &format!(
            "Resolvió solicitud #{} de anulación (aprobar={})",
            solicitud_id, aprobar
        ),
    )?;
    let mut db = state.lock_db()?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let res = resolver_solicitud_inner(&tx, solicitud_id, aprobar, &nota, &admin)?;
    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
    Ok(res)
}

pub(crate) fn resolver_solicitud_inner(
    tx: &rusqlite::Transaction,
    solicitud_id: i64,
    aprobar: bool,
    nota: &str,
    admin: &str,
) -> Result<String, String> {
    if !aprobar && nota.trim().is_empty() {
        return Err("Debe indicar el motivo del rechazo".to_string());
    }
    let (estado, venta_id, motivo, solicitante): (String, i64, String, String) = tx
        .query_row(
            "SELECT estado, venta_id, motivo, solicitante FROM solicitudes_anulacion WHERE id = ?1",
            params![solicitud_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Solicitud no encontrada".to_string())?;
    if estado != ESTADO_PENDIENTE {
        return Err("La solicitud ya fue resuelta".to_string());
    }

    if aprobar {
        // Verificar que la venta existe localmente y no está anulada.
        let anulada: i64 = match tx.query_row(
            "SELECT COALESCE(anulada,0) FROM ventas WHERE id = ?1",
            params![venta_id],
            |r| r.get(0),
        ) {
            Ok(a) => a,
            Err(_) => {
                return Err(
                    "La venta no está en este dispositivo. Sincroniza las ventas e inténtalo de nuevo"
                        .to_string(),
                )
            }
        };
        if anulada != 0 {
            return Err("La venta ya fue anulada".to_string());
        }
        // Anular la venta con una nota que cite la solicitud.
        let nota_void = format!("Aprobado por solicitud #{} ({}): {}", solicitud_id, solicitante, motivo);
        let restored = crate::sales::void_sale_tx(&tx, venta_id, &nota_void, &admin)?;
        tx.execute(
            "UPDATE solicitudes_anulacion SET estado = ?1, resuelto_por = ?2, nota_resolucion = ?3, \
             updated_at = ?4 WHERE id = ?5",
            params![ESTADO_APROBADA, admin, nota, crate::helpers::now_iso(), solicitud_id],
        )
        .map_err(|e| format!("Error al marcar solicitud aprobada: {}", e))?;
        Ok(format!(
            "Venta #{} anulada ({} producto(s) restaurado(s)). Solicitud aprobada",
            venta_id, restored
        ))
    } else {
        tx.execute(
            "UPDATE solicitudes_anulacion SET estado = ?1, resuelto_por = ?2, nota_resolucion = ?3, \
             updated_at = ?4 WHERE id = ?5",
            params![ESTADO_RECHAZADA, admin, nota, crate::helpers::now_iso(), solicitud_id],
        )
        .map_err(|e| format!("Error al marcar solicitud rechazada: {}", e))?;
        Ok("Solicitud rechazada".to_string())
    }
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

    fn insertar_venta(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO usuarios (username, password, rol) VALUES ('vendedor', 'x', 'vendedor')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO productos (codigo, nombre, precio_usd, costo, stock, stock_minimo) \
             VALUES ('P1', 'Producto 1', 10.0, 5.0, 5, 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO ventas (fecha_hora, usuario_id, metodo_pago, total_usd, total_bs, tasa_aplicada, anulada, sync_id, updated_at) \
             VALUES ('2026-01-01 10:00:00', 1, 'efectivo_usd', 10.0, 0.0, 1.0, 0, 's-1', '2026-01-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let venta_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO detalles_ventas (venta_id, producto_codigo, cantidad, precio_usd_unitario, anulado, sync_id) \
             VALUES (?1, 'P1', 1, 10.0, 0, 'd-1')",
            params![venta_id],
        )
        .unwrap();
        venta_id
    }

    fn insertar_solicitud(conn: &Connection, venta_id: i64) -> i64 {
        conn.execute(
            "INSERT INTO solicitudes_anulacion \
             (venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, sync_id, updated_at, dispositivo_origen) \
             VALUES (?1, 's-1', 'Error al cobrar', 'vendedor', '2026-01-02', 'pendiente', 'sol-1', '2026-01-02', '')",
            params![venta_id],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn test_aprobar_anula_venta_y_marca_aprobada() {
        let conn = setup();
        let venta_id = insertar_venta(&conn);
        let sol_id = insertar_solicitud(&conn, venta_id);
        let tx = conn.unchecked_transaction().unwrap();
        let res = resolver_solicitud_inner(&tx, sol_id, true, "", "admin");
        assert!(res.is_ok());
        tx.commit().unwrap();
        let anulada: i64 = conn
            .query_row("SELECT anulada FROM ventas WHERE id = ?1", params![venta_id], |r| r.get(0))
            .unwrap();
        assert_eq!(anulada, 1);
        let stock: i64 = conn
            .query_row("SELECT stock FROM productos WHERE codigo = 'P1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(stock, 6);
        let estado: String = conn
            .query_row("SELECT estado FROM solicitudes_anulacion WHERE id = ?1", params![sol_id], |r| r.get(0))
            .unwrap();
        assert_eq!(estado, ESTADO_APROBADA);
    }

    #[test]
    fn test_rechazar_obliga_nota() {
        let conn = setup();
        let venta_id = insertar_venta(&conn);
        let sol_id = insertar_solicitud(&conn, venta_id);
        let tx = conn.unchecked_transaction().unwrap();
        let res = resolver_solicitud_inner(&tx, sol_id, false, "", "admin");
        assert!(res.is_err());
        drop(tx);
    }

    #[test]
    fn test_rechazo_avisa_sin_toque_la_venta() {
        let conn = setup();
        let venta_id = insertar_venta(&conn);
        let sol_id = insertar_solicitud(&conn, venta_id);
        let tx = conn.unchecked_transaction().unwrap();
        let res = resolver_solicitud_inner(&tx, sol_id, false, "No procede", "admin");
        assert!(res.is_ok());
        tx.commit().unwrap();
        let anulada: i64 = conn
            .query_row("SELECT anulada FROM ventas WHERE id = ?1", params![venta_id], |r| r.get(0))
            .unwrap();
        assert_eq!(anulada, 0);
        let estado: String = conn
            .query_row("SELECT estado FROM solicitudes_anulacion WHERE id = ?1", params![sol_id], |r| r.get(0))
            .unwrap();
        assert_eq!(estado, ESTADO_RECHAZADA);
    }

    #[test]
    fn test_solicitud_duplicada_y_venta_anulada_rechazadas() {
        let conn = setup();
        let venta_id = insertar_venta(&conn);
        // Venta ya anulada → error
        let anulada_tx = conn.unchecked_transaction().unwrap();
        let a1 = solicitar_anulacion_inner(&anulada_tx, venta_id, "motivo", "vendedor", "sync-x");
        assert!(a1.is_ok());
        // Segunda solicitud de la misma venta pendiente → error
        let a2 = solicitar_anulacion_inner(&anulada_tx, venta_id, "otro", "vendedor", "sync-y");
        assert!(a2.is_err());
        anulada_tx.commit().unwrap();
    }

    /// Ídem duplicado: venta ya anulada debe dar error.
    #[test]
    fn test_solicitar_venta_ya_anulada_error() {
        let conn = setup();
        let venta_id = insertar_venta(&conn);
        conn.execute(
            "UPDATE ventas SET anulada = 1 WHERE id = ?1",
            params![venta_id],
        )
        .unwrap();
        let tx = conn.unchecked_transaction().unwrap();
        let res = solicitar_anulacion_inner(&tx, venta_id, "motivo", "vendedor", "sync-z");
        assert!(res.is_err());
        drop(tx);
    }

    fn solicitar_anulacion_inner(
        tx: &rusqlite::Transaction,
        venta_id: i64,
        motivo: &str,
        solicitante: &str,
        sync_id: &str,
    ) -> Result<String, String> {
        let (venta_sync_id, anulada): (Option<String>, i64) = tx
            .query_row(
                "SELECT COALESCE(sync_id,''), COALESCE(anulada,0) FROM ventas WHERE id = ?1",
                params![venta_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| "Venta no encontrada".to_string())?;
        if anulada != 0 {
            return Err("La venta ya fue anulada".to_string());
        }
        let pendientes: i64 = tx
            .query_row(
                "SELECT COUNT(*) FROM solicitudes_anulacion WHERE venta_id = ?1 AND estado = ?2",
                params![venta_id, ESTADO_PENDIENTE],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if pendientes > 0 {
            return Err("Ya existe una solicitud de anulación pendiente para esta venta".to_string());
        }
        tx.execute(
            "INSERT INTO solicitudes_anulacion \
             (venta_id, venta_sync_id, motivo, solicitante, fecha_hora, estado, sync_id, updated_at, dispositivo_origen) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '')",
            params![venta_id, venta_sync_id.unwrap_or_default(), motivo, solicitante, "2026-01-02", ESTADO_PENDIENTE, sync_id, "2026-01-02"],
        )
        .map_err(|e| format!("Error al crear la solicitud: {}", e))?;
        Ok("ok".to_string())
    }
}