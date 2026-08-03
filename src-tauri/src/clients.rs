use crate::constants;
use crate::db::AppState;
use crate::models::*;
use crate::sales;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

type VentaRow = (
    i64,
    String,
    f64,
    f64,
    Option<i64>,
    Option<String>,
    Option<String>,
    Option<f64>,
    Option<f64>,
    f64,
);

const SQL_LIST_CLIENTES: &str =
    "SELECT c.id, c.nombre, c.credito_activo, c.saldo_deuda_usd, c.sync_id, c.updated_at, \
     (SELECT MAX(v.fecha_hora) FROM ventas v WHERE v.cliente_id = c.id) as ultima_compra, \
     COALESCE(c.es_temporal, 0) \
     FROM clientes c ORDER BY c.nombre ASC";
const SQL_CLIENTE_BY_ID: &str =
    "SELECT c.id, c.nombre, c.credito_activo, c.saldo_deuda_usd, c.sync_id, c.updated_at, \
     (SELECT MAX(v.fecha_hora) FROM ventas v WHERE v.cliente_id = c.id) as ultima_compra, \
     COALESCE(c.es_temporal, 0) \
     FROM clientes c WHERE c.id = ?1";
const SQL_INSERT_CLIENTE: &str =
    "INSERT INTO clientes (nombre, sync_id, updated_at, es_temporal, created_at) VALUES (?1, ?2, ?3, ?4, ?3)";
const SQL_TOGGLE_CREDITO: &str = "UPDATE clientes SET credito_activo = ?1 WHERE id = ?2";
const SQL_HISTORY_VENTAS: &str = "
    SELECT v.id, v.fecha_hora, v.total_usd, v.tasa_aplicada,
           dv.id, dv.producto_codigo, p.nombre, dv.cantidad, dv.precio_usd_unitario,
           COALESCE(p.costo, 0)
    FROM ventas v
    LEFT JOIN detalles_ventas dv ON v.id = dv.venta_id
    LEFT JOIN productos p ON dv.producto_codigo = p.codigo
    WHERE v.cliente_id = ?1 AND v.metodo_pago = 'credito'
    ORDER BY v.fecha_hora DESC, dv.id ASC";
const SQL_PAGO_DEUDA_ATOMICO: &str =
    "UPDATE clientes SET saldo_deuda_usd = saldo_deuda_usd - ?1 WHERE id = ?2 AND saldo_deuda_usd >= ?1";
const SQL_REACTIVAR_CREDITO: &str =
    "UPDATE clientes SET credito_activo = 1 WHERE id = ?1 AND credito_activo = 0";
const SQL_UPDATE_CLIENTE: &str = "UPDATE clientes SET nombre = ?1, updated_at = ?2 WHERE id = ?3";
const SQL_DELETE_CLIENTE: &str = "DELETE FROM clientes WHERE id = ?1";

fn row_to_cliente(row: &rusqlite::Row) -> rusqlite::Result<Cliente> {
    let activo: i64 = row.get(2)?;
    let temporal: i64 = row.get(7)?;
    Ok(Cliente {
        id: row.get(0)?,
        nombre: row.get(1)?,
        credito_activo: activo == 1,
        saldo_deuda_usd: row.get(3)?,
        sync_id: row.get(4)?,
        updated_at: row.get(5)?,
        ultima_compra: row.get(6)?,
        es_temporal: temporal == 1,
    })
}

#[tauri::command]
pub fn list_clientes(
    state: State<AppState>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<Vec<Cliente>, String> {
    let db = state.lock_db()?;
    let query = if let (Some(p), Some(ps)) = (page, page_size) {
        let ps = ps.max(1);
        let offset = (p.max(1) - 1) * ps;
        format!("{} LIMIT {} OFFSET {}", SQL_LIST_CLIENTES, ps, offset)
    } else {
        SQL_LIST_CLIENTES.to_string()
    };

    let mut stmt = db.prepare(&query).map_err(|e| e.to_string())?;

    let clientes: Vec<Cliente> = stmt
        .query_map([], row_to_cliente)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(clientes)
}

#[tauri::command]
pub fn create_cliente(
    state: State<AppState>,
    nombre: String,
    es_temporal: Option<bool>,
) -> Result<String, String> {
    if nombre.trim().is_empty() {
        return Err("El nombre del cliente no puede estar vacío".to_string());
    }
    let db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Creó cliente '{}'{}", nombre, if es_temporal.unwrap_or(false) { " (temporal)" } else { "" }),
    )?;
    let sync_id = Uuid::new_v4().to_string();
    let now = crate::helpers::now_iso();
    let temporal: i64 = if es_temporal.unwrap_or(false) { 1 } else { 0 };
    match db.execute(SQL_INSERT_CLIENTE, params![nombre, sync_id, now, temporal]) {
        Ok(_) => Ok("Cliente creado exitosamente".to_string()),
        Err(e) => Err(format!("Error al crear cliente: {}", e)),
    }
}

#[tauri::command]
pub fn toggle_cliente_credito(
    state: State<AppState>,
    cliente_id: i64,
    activo: bool,
) -> Result<String, String> {
    let db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!(
            "{} crédito del cliente #{}",
            if activo { "Activó" } else { "Desactivó" },
            cliente_id
        ),
    )?;
    let val: i64 = if activo { 1 } else { 0 };
    db.execute(SQL_TOGGLE_CREDITO, params![val, cliente_id])
        .map_err(|e| e.to_string())?;

    Ok("Estado de crédito actualizado".to_string())
}

#[tauri::command]
pub fn get_cliente_history(
    state: State<AppState>,
    cliente_id: i64,
) -> Result<ClienteHistory, String> {
    let db = state.lock_db()?;

    let cliente: Cliente = db
        .query_row(SQL_CLIENTE_BY_ID, params![cliente_id], row_to_cliente)
        .map_err(|_| "Cliente no encontrado".to_string())?;

    let mut stmt = db
        .prepare(SQL_HISTORY_VENTAS)
        .map_err(|e| e.to_string())?;

    let rows: Vec<VentaRow> = stmt
        .query_map(params![cliente_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut ventas_map: HashMap<i64, VentaDetallada> = HashMap::new();
    let mut venta_order: Vec<i64> = Vec::new();

    for (vid, fecha, total, tasa, did, codigo, nombre, cantidad, precio, costo) in rows {
        if let std::collections::hash_map::Entry::Vacant(e) = ventas_map.entry(vid) {
            e.insert(VentaDetallada {
                id: vid,
                fecha_hora: fecha,
                total_usd: total,
                tasa_aplicada: tasa,
                productos: Vec::new(),
            });
            venta_order.push(vid);
        }
        if let (Some(did), Some(codigo), Some(cantidad), Some(precio)) =
            (did, codigo, cantidad, precio)
        {
            if let Some(venta) = ventas_map.get_mut(&vid) {
                venta.productos.push(DetalleVenta {
                    id: did,
                    venta_id: vid,
                    producto_codigo: codigo,
                    producto_nombre: nombre.unwrap_or_default(),
                    cantidad,
                    precio_usd_unitario: precio,
                    subtotal_usd: cantidad * precio,
                    costo,
                });
            }
        }
    }

    let ventas: Vec<VentaDetallada> = venta_order
        .into_iter()
        .filter_map(|id| ventas_map.remove(&id))
        .collect();

    Ok(ClienteHistory {
        total_deuda: cliente.saldo_deuda_usd,
        cliente,
        ventas,
    })
}

fn validate_pay_debt_request(request: &PayDebtRequest) -> Result<(), String> {
    if request.monto_usd <= 0.0 {
        return Err("El monto debe ser mayor a cero".to_string());
    }

    if request.metodo_pago == constants::METODO_PAGO_MOVIL
        && request
            .referencia_pago_movil
            .as_deref()
            .unwrap_or("")
            .len()
            != constants::PAGO_MOVIL_REF_LEN
        && request
            .pago_detalle
            .as_ref()
            .is_none_or(|d| d.is_empty())
    {
        return Err(
            "Debe ingresar los últimos 4 dígitos de la referencia".to_string(),
        );
    }

    if request.metodo_pago == constants::METODO_MIXTO {
        if let Some(ref detalle) = request.pago_detalle {
            sales::validar_pago_detalle(detalle, request.monto_usd)?;
        } else {
            return Err("Pago mixto requiere detalle de métodos".to_string());
        }
    }

    Ok(())
}

#[tauri::command]
pub fn pay_debt(state: State<AppState>, request: PayDebtRequest) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "pay_debt",
    )?;
    validate_pay_debt_request(&request)?;

    let username = state.get_username()?;
    let mut db = state.lock_db()?;

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let affected = tx
        .execute(SQL_PAGO_DEUDA_ATOMICO, params![request.monto_usd, request.cliente_id])
        .map_err(|e| format!("Error al procesar pago: {}", e))?;

    if affected == 0 {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "pay_debt");
        }
        return Err("Cliente no encontrado o saldo insuficiente".to_string());
    }

    let nuevo_saldo: f64 = tx
        .query_row("SELECT saldo_deuda_usd FROM clientes WHERE id = ?1", params![request.cliente_id], |r| r.get(0))
        .map_err(|_| "Error al leer saldo actualizado".to_string())?;

    let accion = format!(
        "Pago de deuda - Cliente #{} - Monto: ${:.2} - Método: {} - Saldo restante: ${:.2}",
        request.cliente_id, request.monto_usd, request.metodo_pago, nuevo_saldo
    );
    if let Err(e) = crate::audit::log_action(&tx, &username, &accion) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }

    let mut cliente_eliminado = false;
    if (nuevo_saldo - 0.0).abs() < constants::MONTO_TOLERANCIA {
        let es_temporal: i64 = tx
            .query_row(
                "SELECT COALESCE(es_temporal, 0) FROM clientes WHERE id = ?1",
                params![request.cliente_id],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if es_temporal == 1 {
            eliminar_cliente_temporal(&tx, request.cliente_id, &username, "deuda_pagada")?;
            cliente_eliminado = true;
        } else {
            let _ = tx.execute(SQL_REACTIVAR_CREDITO, params![request.cliente_id]);
        }
    }

    tx.commit().map_err(|e| format!("Error al confirmar pago: {}", e))?;

    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "pay_debt");
    }

    let msg = if cliente_eliminado {
        format!(
            "Pago registrado. El cliente temporal fue eliminado por saldar su deuda (${:.2}).",
            request.monto_usd
        )
    } else {
        format!(
            "Pago registrado. Monto: ${:.2}, Saldo restante: ${:.2}",
            request.monto_usd, nuevo_saldo
        )
    };

    Ok(msg)
}

/// Elimina un cliente temporal dejando constancia en `clientes_eliminados`.
/// Desvincula sus ventas y audita la acción. Se ejecuta dentro de una transacción.
fn eliminar_cliente_temporal(
    tx: &rusqlite::Transaction,
    cliente_id: i64,
    username: &str,
    motivo: &str,
) -> Result<(), String> {
    let (nombre, saldo_pagado, creado_en): (String, f64, String) = tx
        .query_row(
            "SELECT nombre, saldo_deuda_usd, COALESCE(created_at, datetime('now','localtime')) FROM clientes WHERE id = ?1",
            params![cliente_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    tx.execute(
        "INSERT INTO clientes_eliminados (cliente_id, nombre, saldo_pagado_usd, creado_en, eliminado_en, motivo) \
         VALUES (?1, ?2, ?3, ?4, datetime('now','localtime'), ?5)",
        params![cliente_id, nombre, saldo_pagado, creado_en, motivo],
    )
    .map_err(|e| format!("Error al registrar cliente temporal eliminado: {}", e))?;

    tx.execute("UPDATE ventas SET cliente_id = NULL WHERE cliente_id = ?1", params![cliente_id])
        .map_err(|e| format!("Error al desvincular ventas: {}", e))?;
    tx.execute(SQL_DELETE_CLIENTE, params![cliente_id])
        .map_err(|e| format!("Error al eliminar cliente temporal: {}", e))?;

    let accion = format!(
        "Eliminó cliente temporal #{} '{}' ({}) — saldo liquidado: ${:.2}",
        cliente_id, nombre, motivo, saldo_pagado
    );
    if let Err(e) = crate::audit::log_action(tx, username, &accion) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }
    Ok(())
}

#[tauri::command]
pub fn update_cliente(state: State<AppState>, cliente_id: i64, nombre: String) -> Result<String, String> {
    if nombre.trim().is_empty() {
        return Err("El nombre no puede estar vacío".to_string());
    }
    let db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Editó cliente #{}: '{}'", cliente_id, nombre),
    )?;
    let now = crate::helpers::now_iso();
    db.execute(SQL_UPDATE_CLIENTE, params![nombre.trim(), now, cliente_id])
        .map_err(|e| e.to_string())?;
    Ok("Cliente actualizado exitosamente".to_string())
}

#[tauri::command]
pub fn add_quick_debt(
    state: State<AppState>,
    cliente_id: i64,
    monto_usd: f64,
) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "add_quick_debt",
    )?;
    if monto_usd <= 0.0 {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "add_quick_debt");
        }
        return Err("El monto debe ser mayor a cero".to_string());
    }
    let username = state.get_username()?;
    let db = state.lock_db()?;
    let affected = db
        .execute(
            "UPDATE clientes SET saldo_deuda_usd = saldo_deuda_usd + ?1 WHERE id = ?2",
            params![monto_usd, cliente_id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "add_quick_debt");
        }
        return Err("Cliente no encontrado".to_string());
    }
    let accion = format!(
        "Deuda rápida - Cliente #{} - Monto: ${:.2}",
        cliente_id, monto_usd
    );
    if let Err(e) = crate::audit::log_action(&db, &username, &accion) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "add_quick_debt");
    }
    Ok(format!("Deuda de ${:.2} registrada correctamente", monto_usd))
}

#[tauri::command]
pub fn delete_cliente(state: State<AppState>, cliente_id: i64) -> Result<String, String> {
    let username = state.get_username()?;
    let mut db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Eliminó cliente #{}", cliente_id),
    )?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let es_temporal: i64 = tx
        .query_row(
            "SELECT COALESCE(es_temporal, 0) FROM clientes WHERE id = ?1",
            params![cliente_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if es_temporal == 1 {
        eliminar_cliente_temporal(&tx, cliente_id, &username, "eliminacion_manual")?;
        tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
        return Ok("Cliente temporal eliminado exitosamente".to_string());
    }

    tx.execute("UPDATE ventas SET cliente_id = NULL WHERE cliente_id = ?1", params![cliente_id])
        .map_err(|e| format!("Error al desvincular ventas: {}", e))?;
    let affected = tx.execute(SQL_DELETE_CLIENTE, params![cliente_id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Cliente no encontrado".to_string());
    }
    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
    Ok("Cliente eliminado exitosamente".to_string())
}

#[tauri::command]
pub fn list_clientes_eliminados(state: State<AppState>) -> Result<Vec<ClienteEliminado>, String> {
    let db = state.lock_db()?;
    let mut stmt = db
        .prepare(
            "SELECT id, cliente_id, nombre, saldo_pagado_usd, creado_en, eliminado_en, motivo \
             FROM clientes_eliminados ORDER BY eliminado_en DESC",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map([], |row| {
            Ok(ClienteEliminado {
                id: row.get(0)?,
                cliente_id: row.get(1)?,
                nombre: row.get(2)?,
                saldo_pagado_usd: row.get(3)?,
                creado_en: row.get(4)?,
                eliminado_en: row.get(5)?,
                motivo: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{PayDebtRequest, PagoItem};

    #[test]
    fn test_validate_pay_debt_monto_cero() {
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 0.0, metodo_pago: "efectivo_usd".to_string(),
            referencia_pago_movil: None, pago_detalle: None,
        };
        let result = validate_pay_debt_request(&req);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("mayor a cero"));
    }

    #[test]
    fn test_validate_pay_debt_monto_negativo() {
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: -10.0, metodo_pago: "efectivo_usd".to_string(),
            referencia_pago_movil: None, pago_detalle: None,
        };
        let result = validate_pay_debt_request(&req);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_pay_debt_pago_movil_sin_ref() {
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 50.0, metodo_pago: "pago_movil".to_string(),
            referencia_pago_movil: Some("123".to_string()), pago_detalle: None,
        };
        let result = validate_pay_debt_request(&req);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("4 dígitos"));
    }

    #[test]
    fn test_validate_pay_debt_pago_movil_ok() {
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 50.0, metodo_pago: "pago_movil".to_string(),
            referencia_pago_movil: Some("1234".to_string()), pago_detalle: None,
        };
        let result = validate_pay_debt_request(&req);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_pay_debt_pago_movil_con_detalle_ok() {
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 50.0, metodo_pago: "pago_movil".to_string(),
            referencia_pago_movil: None,
            pago_detalle: Some(vec![PagoItem {
                metodo: "pago_movil".to_string(), monto_usd: 50.0, referencia: Some("1234".to_string()),
            }]),
        };
        let result = validate_pay_debt_request(&req);
        assert!(result.is_ok());
    }

    fn insert_cliente_temporal(conn: &rusqlite::Connection, id: i64, nombre: &str, deuda: f64) {
        conn.execute(
            "INSERT INTO clientes (id, nombre, sync_id, updated_at, es_temporal, saldo_deuda_usd, created_at) VALUES (?1, ?2, ?3, ?3, 1, ?4, ?3)",
            params![id, nombre, "sync-".to_owned() + &id.to_string(), deuda],
        )
        .unwrap();
    }

    #[test]
    fn test_eliminar_cliente_temporal_registra_historial() {
        let mut conn = crate::db::test_support::test_conn();
        insert_cliente_temporal(&conn, 42, "Cliente Tmp", 0.0);
        let tx = conn.transaction().unwrap();
        eliminar_cliente_temporal(&tx, 42, "admin", "saldó deuda").unwrap();
        tx.commit().unwrap();

        let count: i64 = conn.query_row("SELECT COUNT(*) FROM clientes WHERE id = 42", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 0);
        let (nombre, motivo, saldo): (String, String, f64) = conn
            .query_row(
                "SELECT nombre, motivo, saldo_pagado_usd FROM clientes_eliminados WHERE cliente_id = 42",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(nombre, "Cliente Tmp");
        assert_eq!(motivo, "saldó deuda");
        assert!((saldo - 0.0).abs() < 0.001);
        let audit: i64 = conn.query_row(
            "SELECT COUNT(*) FROM historial_acciones WHERE accion LIKE ?1",
            params!["%Eliminó cliente temporal%"],
            |r| r.get(0),
        ).unwrap();
        assert_eq!(audit, 1);
    }

    #[test]
    fn test_eliminar_cliente_temporal_desvincula_ventas() {
        let mut conn = crate::db::test_support::test_conn();
        insert_cliente_temporal(&conn, 7, "Tmp Ventas", 12.0);
        conn.execute(
            "INSERT INTO ventas (cliente_id, fecha_hora, usuario_id, metodo_pago, total_usd, tasa_aplicada, total_bs, anulada) VALUES (7, datetime('now','localtime'), 1, 'efectivo_usd', 5.0, 1.0, 5.0, 0)",
            [],
        )
        .unwrap();
        let tx = conn.transaction().unwrap();
        eliminar_cliente_temporal(&tx, 7, "admin", "liquidado").unwrap();
        tx.commit().unwrap();
        let nulls: i64 = conn
            .query_row("SELECT COUNT(*) FROM ventas WHERE cliente_id IS NULL", [], |r| r.get(0))
            .unwrap();
        assert_eq!(nulls, 1);
    }

    #[test]
    fn test_eliminar_cliente_temporal_inexistente() {
        let mut conn = crate::db::test_support::test_conn();
        let tx = conn.transaction().unwrap();
        let res = eliminar_cliente_temporal(&tx, 999, "admin", "motivo");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("no encontrado"));
    }
}
