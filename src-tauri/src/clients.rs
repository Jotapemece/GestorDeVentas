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
     (SELECT MAX(v.fecha_hora) FROM ventas v WHERE v.cliente_id = c.id) as ultima_compra \
     FROM clientes c WHERE COALESCE(c.activo, 1) = 1 ORDER BY c.nombre ASC";
const SQL_CLIENTE_BY_ID: &str =
    "SELECT c.id, c.nombre, c.credito_activo, c.saldo_deuda_usd, c.sync_id, c.updated_at, \
     (SELECT MAX(v.fecha_hora) FROM ventas v WHERE v.cliente_id = c.id) as ultima_compra \
     FROM clientes c WHERE c.id = ?1 AND COALESCE(c.activo, 1) = 1";
const SQL_INSERT_CLIENTE: &str =
    "INSERT INTO clientes (nombre, sync_id, updated_at, created_at) VALUES (?1, ?2, ?3, ?3)";
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
    "UPDATE clientes SET saldo_deuda_usd = saldo_deuda_usd - ?1, updated_at = ?3 WHERE id = ?2 AND saldo_deuda_usd >= ?1";
const SQL_REACTIVAR_CREDITO: &str =
    "UPDATE clientes SET credito_activo = 1 WHERE id = ?1 AND credito_activo = 0";

fn row_to_cliente(row: &rusqlite::Row) -> rusqlite::Result<Cliente> {
    let activo: i64 = row.get(2)?;
    Ok(Cliente {
        id: row.get(0)?,
        nombre: row.get(1)?,
        credito_activo: activo == 1,
        saldo_deuda_usd: row.get(3)?,
        sync_id: row.get(4)?,
        updated_at: row.get(5)?,
        ultima_compra: row.get(6)?,
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
) -> Result<String, String> {
    if nombre.trim().is_empty() {
        return Err("El nombre del cliente no puede estar vacío".to_string());
    }
    let db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Creó cliente '{}'", nombre),
    )?;
    let sync_id = Uuid::new_v4().to_string();
    let now = crate::helpers::now_iso();
    match db.execute(SQL_INSERT_CLIENTE, params![nombre.trim(), sync_id, now]) {
        Ok(_) => Ok("Cliente creado exitosamente".to_string()),
        Err(e) => Err(format!("Error al crear cliente: {}", e)),
    }
}

/// Crea un cliente y devuelve su `id` local (para el alta inline en el modal de pago).
#[tauri::command]
pub fn quick_create_cliente(
    state: State<AppState>,
    nombre: String,
) -> Result<i64, String> {
    if nombre.trim().is_empty() {
        return Err("El nombre del cliente no puede estar vacío".to_string());
    }
    let db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Creó cliente '{}'", nombre),
    )?;
    let sync_id = Uuid::new_v4().to_string();
    let now = crate::helpers::now_iso();
    db.execute(SQL_INSERT_CLIENTE, params![nombre.trim(), sync_id, now])
        .map_err(|e| format!("Error al crear cliente: {}", e))?;
    Ok(db.last_insert_rowid())
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
    if !request.monto_usd.is_finite() {
        return Err("El monto no puede ser NaN o infinito".to_string());
    }
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

/// Concepto legible del movimiento de caja generado por un pago/abono de deuda.
/// El método se muestra como "Crédito (Biopago)" para cualquier método excepto
/// pago móvil, donde se usa "Pago Móvil: ref" (mantiene la referencia de 4 dígitos).
/// Para pagos mixtos se desglosa cada método con su monto y la referencia (si la hay).
fn abono_concepto(
    cliente_id: i64,
    metodo_pago: &str,
    referencia_movil: Option<&str>,
    pago_detalle: Option<&[PagoItem]>,
) -> String {
    let mut concepto = format!("Abono deuda - Cliente #{} - ", cliente_id);
    if metodo_pago == constants::METODO_MIXTO {
        if let Some(items) = pago_detalle {
            if !items.is_empty() {
                let partes: Vec<String> = items
                    .iter()
                    .map(|item| {
                        let mut parte = format!("{} ${:.2}", constants::metodo_label(&item.metodo), item.monto_usd);
                        if item.metodo == constants::METODO_PAGO_MOVIL {
                            if let Some(ref r) = item.referencia {
                                if !r.is_empty() {
                                    parte.push_str(&format!(" (ref {})", r));
                                }
                            }
                        }
                        parte
                    })
                    .collect();
                concepto.push_str(&format!("Mixto ({})", partes.join(", ")));
                return concepto;
            }
        }
        concepto.push_str("Mixto");
    } else if metodo_pago == constants::METODO_PAGO_MOVIL {
        concepto.push_str("Pago Móvil");
        if let Some(ref_movil) = referencia_movil {
            if !ref_movil.is_empty() {
                concepto.push_str(&format!(": {}", ref_movil));
            }
        }
    } else {
        concepto.push_str(&format!("Crédito ({})", constants::metodo_label(metodo_pago)));
    }
    concepto
}

#[tauri::command]
pub fn pay_debt(state: State<AppState>, request: PayDebtRequest) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "pay_debt",
    )?;
    crate::auth::check_employee_role(&state)?;
    validate_pay_debt_request(&request)?;

    let usuario = state.get_employee()?;
    let username = usuario.username.clone();
    let mut db = state.lock_db()?;

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let result = pay_debt_inner(&tx, &request, &username, usuario.id);
    match result {
        Ok(pay_result) => {
            if let Err(e) = tx.commit() {
                return Err(format!("Error al confirmar pago: {}", e));
            }
            if let Ok(mut attempts) = state.admin_action_attempts.lock() {
                crate::db::rate_limit_success(&mut attempts, "pay_debt");
            }
            let msg = format!(
                "Pago registrado. Monto: ${:.2}, Saldo restante: ${:.2}",
                request.monto_usd, pay_result.nuevo_saldo
            );
            Ok(msg)
        }
        Err(e) => {
            if let Ok(mut attempts) = state.admin_action_attempts.lock() {
                crate::db::rate_limit_fail(&mut attempts, "pay_debt");
            }
            Err(e)
        }
    }
}

struct PayDebtInnerResult {
    nuevo_saldo: f64,
}

/// Lógica transaccional del pago/abono de deuda, aislada del comando Tauri
/// para poder testearla directamente. Ejecuta el pago, registra el ingreso de
/// caja, la auditoría y la alerta de crédito (si el autor es vendedor).
fn pay_debt_inner(
    tx: &rusqlite::Transaction,
    request: &PayDebtRequest,
    username: &str,
    usuario_id: i64,
) -> Result<PayDebtInnerResult, String> {
    let affected = tx
        .execute(SQL_PAGO_DEUDA_ATOMICO, params![request.monto_usd, request.cliente_id, crate::helpers::now_iso()])
        .map_err(|e| format!("Error al procesar pago: {}", e))?;

    if affected == 0 {
        return Err("Cliente no encontrado o saldo insuficiente".to_string());
    }

    let nuevo_saldo: f64 = tx
        .query_row("SELECT saldo_deuda_usd FROM clientes WHERE id = ?1", params![request.cliente_id], |r| r.get(0))
        .map_err(|_| "Error al leer saldo actualizado".to_string())?;

    // El pago/abono de deuda es dinero que entra a la caja: se registra como
    // movimiento tipo 'ingreso' indicando el método de pago usado.
    let tasa = crate::db::get_tasa_from_db(tx).unwrap_or(0.0);
    let monto_bs = request.monto_usd * tasa;
    let concepto = abono_concepto(
        request.cliente_id,
        &request.metodo_pago,
        request.referencia_pago_movil.as_deref(),
        request.pago_detalle.as_deref(),
    );
    tx.execute(
        "INSERT INTO movimientos_caja (tipo, monto_bs, monto_usd, concepto, usuario_id, username, cliente_id) \
         VALUES ('ingreso', ?1, ?2, ?3, ?4, ?5, ?6)",
        params![monto_bs, request.monto_usd, concepto, usuario_id, username, request.cliente_id],
    )
    .map_err(|e| format!("Error al registrar ingreso de caja: {}", e))?;

    let accion = format!(
        "Pago de deuda - Cliente #{} - Monto: ${:.2} - Método: {} - Saldo restante: ${:.2}",
        request.cliente_id, request.monto_usd, request.metodo_pago, nuevo_saldo
    );
    if let Err(e) = crate::audit::log_action(tx, username, &accion) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }

    // Alerta de crédito para el admin (solo operaciones de vendedores).
    let cliente_nombre: String = tx
        .query_row(
            "SELECT COALESCE(nombre, '') FROM clientes WHERE id = ?1",
            params![request.cliente_id],
            |r| r.get(0),
        )
        .unwrap_or_default();
    let nota = format!(
        "Saldo restante: ${:.2} - Ref: {}",
        nuevo_saldo,
        request.referencia_pago_movil.as_deref().unwrap_or("-")
    );
    let _ = crate::alertas::insertar_alerta_si_vendedor(
        tx,
        username,
        crate::alertas::TIPO_ABONO,
        request.monto_usd,
        Some(request.cliente_id),
        &cliente_nombre,
        &request.metodo_pago,
        &nota,
    );

    if (nuevo_saldo - 0.0).abs() < constants::MONTO_TOLERANCIA {
        let _ = tx.execute(SQL_REACTIVAR_CREDITO, params![request.cliente_id]);
    }

    Ok(PayDebtInnerResult { nuevo_saldo })
}

#[tauri::command]
pub fn update_cliente(state: State<AppState>, cliente_id: i64, nombre: String, saldo_deuda_usd: Option<f64>) -> Result<String, String> {
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
    let saldo_actual: f64 = db
        .query_row(
            "SELECT COALESCE(saldo_deuda_usd, 0) FROM clientes WHERE id = ?1",
            params![cliente_id],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    let mut sql = String::from("UPDATE clientes SET nombre = ?, updated_at = ?");
    let mut vals: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(nombre.trim().to_string()),
        Box::new(now.clone()),
    ];
    if let Some(nuevo) = saldo_deuda_usd {
        if !nuevo.is_finite() || nuevo < 0.0 {
            return Err("La deuda no puede ser negativa ni inválida".to_string());
        }
        sql.push_str(", saldo_deuda_usd = ?");
        vals.push(Box::new(nuevo));
        let username = state.get_username().unwrap_or_default();
        if let Err(e) = crate::audit::log_action(
            &db,
            &username,
            &format!(
                "Editó deuda cliente #{}: ${:.2} → ${:.2}",
                cliente_id, saldo_actual, nuevo
            ),
        ) {
            eprintln!("[audit] Error al registrar edición de deuda: {}", e);
        }
    }
    sql.push_str(" WHERE id = ?");
    vals.push(Box::new(cliente_id));
    let params_refs: Vec<&dyn rusqlite::ToSql> = vals.iter().map(|b| b.as_ref()).collect();
    db.execute(&sql, &params_refs[..])
        .map_err(|e| e.to_string())?;
    Ok("Cliente actualizado exitosamente".to_string())
}




#[tauri::command]
pub fn delete_cliente(state: State<AppState>, cliente_id: i64) -> Result<String, String> {
    let mut db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Eliminó cliente #{}", cliente_id),
    )?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    // Soft-delete: se oculta en listas (activo=0) pero se conserva la fila y sus ventas,
    // y el borrado viaja como tombstone en la sincronización.
    let affected = tx.execute(
        "UPDATE clientes SET activo = 0, updated_at = ?2 WHERE id = ?1",
        params![cliente_id, crate::helpers::now_iso()],
    )
    .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Cliente no encontrado".to_string());
    }
    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
    Ok("Cliente eliminado exitosamente".to_string())
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

    #[test]
    fn test_abono_concepto_efectivo() {
        let c = abono_concepto(7, "efectivo_usd", None, None);
        assert_eq!(c, "Abono deuda - Cliente #7 - Crédito (Efectivo USD)");
    }

    #[test]
    fn test_abono_concepto_biopago() {
        let c = abono_concepto(7, "biopago", None, None);
        assert_eq!(c, "Abono deuda - Cliente #7 - Crédito (Biopago)");
    }

    #[test]
    fn test_abono_concepto_pago_movil_con_ref() {
        let c = abono_concepto(7, "pago_movil", Some("1234"), None);
        assert_eq!(c, "Abono deuda - Cliente #7 - Pago Móvil: 1234");
    }

    #[test]
    fn test_abono_concepto_pago_movil_sin_ref() {
        let c = abono_concepto(7, "pago_movil", None, None);
        assert_eq!(c, "Abono deuda - Cliente #7 - Pago Móvil");
        assert!(!c.contains("Ref:"));
    }

    #[test]
    fn test_abono_concepto_mixto_con_detalle() {
        let detalle = vec![
            PagoItem { metodo: constants::METODO_EFECTIVO_BS.to_string(), monto_usd: 5.0, referencia: None },
            PagoItem { metodo: constants::METODO_PAGO_MOVIL.to_string(), monto_usd: 20.0, referencia: Some("7890".to_string()) },
        ];
        let c = abono_concepto(7, constants::METODO_MIXTO, None, Some(&detalle));
        assert_eq!(c, "Abono deuda - Cliente #7 - Mixto (Efectivo Bs. $5.00, Pago Móvil $20.00 (ref 7890))");
    }

    #[test]
    fn test_abono_concepto_mixto_sin_detalle() {
        let c = abono_concepto(7, constants::METODO_MIXTO, None, None);
        assert_eq!(c, "Abono deuda - Cliente #7 - Mixto");
    }

    fn insertar_usuario_rol(conn: &rusqlite::Connection, id: i64, username: &str, rol: &str) {
        conn.execute(
            "INSERT INTO usuarios (id, username, password, rol) VALUES (?1, ?2, 'x', ?3)",
            params![id, username, rol],
        )
        .unwrap();
    }

    fn insertar_cliente_con_deuda(conn: &rusqlite::Connection, id: i64, nombre: &str, deuda: f64) {
        conn.execute(
            "INSERT INTO clientes (id, nombre, saldo_deuda_usd) VALUES (?1, ?2, ?3)",
            params![id, nombre, deuda],
        )
        .unwrap();
    }

    fn count_alertas(conn: &rusqlite::Connection, tipo: &str) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM alertas_credito WHERE tipo = ?1",
            params![tipo],
            |r| r.get(0),
        )
        .unwrap()
    }

    #[test]
    fn test_pay_debt_vendedor_genera_alerta_abono() {
        let mut conn = crate::db::test_support::test_conn();
        insertar_usuario_rol(&conn, 2, "vendedor1", constants::ROL_VENDEDOR);
        insertar_cliente_con_deuda(&conn, 1, "Juan Pérez", 100.0);
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 25.0, metodo_pago: "efectivo_usd".to_string(),
            referencia_pago_movil: None, pago_detalle: None,
        };
        let tx = conn.transaction().unwrap();
        pay_debt_inner(&tx, &req, "vendedor1", 2).unwrap();
        tx.commit().unwrap();
        assert_eq!(count_alertas(&conn, crate::alertas::TIPO_ABONO), 1);
        // La alerta registra el monto y el usuario vendedor.
        let (monto, usuario, cliente): (f64, String, String) = conn
            .query_row(
                "SELECT monto_usd, usuario, cliente_nombre FROM alertas_credito WHERE tipo = ?1",
                params![crate::alertas::TIPO_ABONO],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert!((monto - 25.0).abs() < 0.001);
        assert_eq!(usuario, "vendedor1");
        assert_eq!(cliente, "Juan Pérez");
    }

    #[test]
    fn test_pay_debt_admin_no_genera_alerta() {
        let mut conn = crate::db::test_support::test_conn();
        insertar_cliente_con_deuda(&conn, 1, "Cliente", 100.0);
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 25.0, metodo_pago: "efectivo_usd".to_string(),
            referencia_pago_movil: None, pago_detalle: None,
        };
        let tx = conn.transaction().unwrap();
        // El admin por defecto de test_conn se llama "Jota_admin".
        pay_debt_inner(&tx, &req, constants::DEFAULT_ADMIN_USERNAME, 1).unwrap();
        tx.commit().unwrap();
        assert_eq!(count_alertas(&conn, crate::alertas::TIPO_ABONO), 0);
    }

    #[test]
    fn test_pay_debt_registra_ingreso_caja_con_concepto_credito() {
        let mut conn = crate::db::test_support::test_conn();
        insertar_cliente_con_deuda(&conn, 1, "Juan Pérez", 100.0);
        crate::db::set_config_value(&conn, "tasa_dolar", "10.0").unwrap();
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 25.0, metodo_pago: "biopago".to_string(),
            referencia_pago_movil: None, pago_detalle: None,
        };
        let tx = conn.transaction().unwrap();
        pay_debt_inner(&tx, &req, constants::DEFAULT_ADMIN_USERNAME, 1).unwrap();
        tx.commit().unwrap();
        // El abono de deuda entra a la caja como ingreso (no cuenta como venta
        // a crédito) y su concepto indica el método usado: "Crédito (Biopago)".
        let (tipo, monto_usd, monto_bs, concepto): (String, f64, f64, String) = conn
            .query_row(
                "SELECT tipo, monto_usd, monto_bs, concepto FROM movimientos_caja WHERE id = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        assert_eq!(tipo, "ingreso");
        assert!((monto_usd - 25.0).abs() < 0.001);
        assert!((monto_bs - 250.0).abs() < 0.001);
        assert_eq!(concepto, "Abono deuda - Cliente #1 - Crédito (Biopago)");
    }

    #[test]
    fn test_pay_debt_registra_ingreso_caja_pago_movil_con_ref() {
        let mut conn = crate::db::test_support::test_conn();
        insertar_cliente_con_deuda(&conn, 1, "Cliente", 80.0);
        crate::db::set_config_value(&conn, "tasa_dolar", "10.0").unwrap();
        let req = PayDebtRequest {
            cliente_id: 1, monto_usd: 30.0, metodo_pago: "pago_movil".to_string(),
            referencia_pago_movil: Some("7890".to_string()), pago_detalle: None,
        };
        let tx = conn.transaction().unwrap();
        pay_debt_inner(&tx, &req, constants::DEFAULT_ADMIN_USERNAME, 1).unwrap();
        tx.commit().unwrap();
        // Pago móvil: el concepto muestra "Pago Móvil: ref" (los 4 dígitos).
        let (tipo, concepto): (String, String) = conn
            .query_row(
                "SELECT tipo, concepto FROM movimientos_caja WHERE id = 1",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(tipo, "ingreso");
        assert_eq!(concepto, "Abono deuda - Cliente #1 - Pago Móvil: 7890");
    }

    #[test]
    fn test_pay_debt_mixto_registra_ingreso_caja_con_desglose() {
        let mut conn = crate::db::test_support::test_conn();
        insertar_cliente_con_deuda(&conn, 1, "Cliente", 80.0);
        crate::db::set_config_value(&conn, "tasa_dolar", "10.0").unwrap();
        let req = PayDebtRequest {
            cliente_id: 1,
            monto_usd: 50.0,
            metodo_pago: constants::METODO_MIXTO.to_string(),
            referencia_pago_movil: None,
            pago_detalle: Some(vec![
                PagoItem {
                    metodo: constants::METODO_EFECTIVO_BS.to_string(),
                    monto_usd: 30.0,
                    referencia: None,
                },
                PagoItem {
                    metodo: constants::METODO_PAGO_MOVIL.to_string(),
                    monto_usd: 20.0,
                    referencia: Some("5566".to_string()),
                },
            ]),
        };
        let tx = conn.transaction().unwrap();
        pay_debt_inner(&tx, &req, constants::DEFAULT_ADMIN_USERNAME, 1).unwrap();
        tx.commit().unwrap();
        // El concepto del ingreso de caja desglosa cada método del pago mixto,
        // con su monto en USD y la referencia del pago móvil.
        let concepto: String = conn
            .query_row("SELECT concepto FROM movimientos_caja WHERE id = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            concepto,
            "Abono deuda - Cliente #1 - Mixto (Efectivo Bs. $30.00, Pago Móvil $20.00 (ref 5566))"
        );
    }


}
