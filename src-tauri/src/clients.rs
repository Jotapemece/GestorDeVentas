use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;

type VentaRow = (i64, String, f64, f64, Option<i64>, Option<String>, Option<String>, Option<i64>, Option<f64>);

#[tauri::command]
pub fn list_clientes(state: State<AppState>) -> Result<Vec<Cliente>, String> {
    let db = state.db.lock().unwrap();
    let mut stmt = db
        .prepare("SELECT id, nombre, credito_activo, saldo_deuda_usd FROM clientes ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;

    let clientes: Vec<Cliente> = stmt
        .query_map([], |row| {
            let activo: i64 = row.get(2)?;
            Ok(Cliente {
                id: row.get(0)?,
                nombre: row.get(1)?,
                credito_activo: activo == 1,
                saldo_deuda_usd: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(clientes)
}

#[tauri::command]
pub fn create_cliente(state: State<AppState>, nombre: String) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    crate::products::require_admin(&state, &db, &format!("Creó cliente '{}'", nombre))?;
    match db.execute(
        "INSERT INTO clientes (nombre) VALUES (?1)",
        params![nombre],
    ) {
        Ok(_) => Ok("Cliente creado exitosamente".to_string()),
        Err(e) => Err(format!("Error al crear cliente: {}", e)),
    }
}

#[tauri::command]
pub fn toggle_cliente_credito(state: State<AppState>, cliente_id: i64, activo: bool) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    crate::products::require_admin(&state, &db, &format!("{} crédito del cliente #{}", if activo { "Activó" } else { "Desactivó" }, cliente_id))?;
    let val: i64 = if activo { 1 } else { 0 };
    db.execute(
        "UPDATE clientes SET credito_activo = ?1 WHERE id = ?2",
        params![val, cliente_id],
    )
    .map_err(|e| e.to_string())?;

    Ok("Estado de crédito actualizado".to_string())
}

#[tauri::command]
pub fn get_cliente_history(state: State<AppState>, cliente_id: i64) -> Result<ClienteHistory, String> {
    let db = state.db.lock().unwrap();

    let cliente: Cliente = db
        .query_row(
            "SELECT id, nombre, credito_activo, saldo_deuda_usd FROM clientes WHERE id = ?1",
            params![cliente_id],
            |row| {
                let activo: i64 = row.get(2)?;
                Ok(Cliente {
                    id: row.get(0)?,
                    nombre: row.get(1)?,
                    credito_activo: activo == 1,
                    saldo_deuda_usd: row.get(3)?,
                })
            },
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    let mut stmt = db
        .prepare(
            "SELECT v.id, v.fecha_hora, v.total_usd, v.tasa_aplicada,
                    dv.id, dv.producto_codigo, p.nombre, dv.cantidad, dv.precio_usd_unitario
             FROM ventas v
             LEFT JOIN detalles_ventas dv ON v.id = dv.venta_id
             LEFT JOIN productos p ON dv.producto_codigo = p.codigo
             WHERE v.cliente_id = ?1 AND v.metodo_pago = 'credito'
             ORDER BY v.fecha_hora DESC, dv.id ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<VentaRow> = stmt
        .query_map(params![cliente_id], |row| {
            Ok((
                row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut ventas_map: HashMap<i64, VentaDetallada> = HashMap::new();
    let mut venta_order: Vec<i64> = Vec::new();

    for (vid, fecha, total, tasa, did, codigo, nombre, cantidad, precio) in rows {
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
        if let (Some(did), Some(codigo), Some(cantidad), Some(precio)) = (did, codigo, cantidad, precio) {
            if let Some(venta) = ventas_map.get_mut(&vid) {
                venta.productos.push(DetalleVenta {
                    id: did,
                    venta_id: vid,
                    producto_codigo: codigo,
                    producto_nombre: nombre.unwrap_or_default(),
                    cantidad,
                    precio_usd_unitario: precio,
                    subtotal_usd: cantidad as f64 * precio,
                });
            }
        }
    }

    let ventas: Vec<VentaDetallada> = venta_order.into_iter()
        .filter_map(|id| ventas_map.remove(&id))
        .collect();

    Ok(ClienteHistory {
        total_deuda: cliente.saldo_deuda_usd,
        cliente,
        ventas,
    })
}

#[tauri::command]
pub fn pay_debt(state: State<AppState>, request: PayDebtRequest) -> Result<String, String> {
    if request.monto_usd <= 0.0 {
        return Err("El monto debe ser mayor a cero".to_string());
    }

    if request.metodo_pago == "pago_movil"
        && request.referencia_pago_movil.as_deref().unwrap_or("").len() != 4
        && request.pago_detalle.as_ref().is_none_or(|d| d.is_empty())
    {
        return Err("Debe ingresar los últimos 4 dígitos de la referencia".to_string());
    }

    if request.metodo_pago == "mixto" {
        if let Some(ref detalle) = request.pago_detalle {
            let mut suma = 0.0;
            for item in detalle {
                if !matches!(item.metodo.as_str(), "efectivo_bs" | "efectivo_usd" | "biopago" | "punto" | "pago_movil") {
                    return Err(format!("Método de pago inválido: {}", item.metodo));
                }
                if item.monto_usd <= 0.0 {
                    return Err(format!("Monto inválido para {}", item.metodo));
                }
                if item.metodo == "pago_movil" && item.referencia.as_deref().unwrap_or("").len() != 4 {
                    return Err("Pago móvil requiere los últimos 4 dígitos de referencia".to_string());
                }
                suma += item.monto_usd;
            }
            if (suma - request.monto_usd).abs() > 0.01 {
                return Err(format!("Los montos del pago mixto (${:.2}) no coinciden con el total (${:.2})", suma, request.monto_usd));
            }
        } else {
            return Err("Pago mixto requiere detalle de métodos".to_string());
        }
    }

    let username = state.current_user.lock().unwrap().clone().map(|u| u.username).unwrap_or_default();

    let db = state.db.lock().unwrap();

    let saldo_actual: f64 = db
        .query_row(
            "SELECT saldo_deuda_usd FROM clientes WHERE id = ?1",
            params![request.cliente_id],
            |row| row.get(0),
        )
        .map_err(|_| "Cliente no encontrado".to_string())?;

    if request.monto_usd > saldo_actual {
        return Err(format!(
            "El monto (${:.2}) excede la deuda actual (${:.2})",
            request.monto_usd, saldo_actual
        ));
    }

    let nuevo_saldo = saldo_actual - request.monto_usd;
    db.execute(
        "UPDATE clientes SET saldo_deuda_usd = ?1 WHERE id = ?2",
        params![nuevo_saldo, request.cliente_id],
    )
    .map_err(|e| e.to_string())?;

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let accion = format!(
        "Pago de deuda - Cliente #{} - Monto: ${:.2} - Método: {} - Saldo restante: ${:.2}",
        request.cliente_id, request.monto_usd, request.metodo_pago, nuevo_saldo
    );
    db.execute(
        "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)",
        params![now, username, accion],
    )
    .ok();

    if nuevo_saldo == 0.0 {
        db.execute(
            "UPDATE clientes SET credito_activo = 1 WHERE id = ?1 AND credito_activo = 0",
            params![request.cliente_id],
        )
        .ok();
    }

    Ok(format!(
        "Pago registrado. Monto: ${:.2}, Saldo restante: ${:.2}",
        request.monto_usd, nuevo_saldo
    ))
}
