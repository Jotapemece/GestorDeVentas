use crate::constants;
use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use tauri::State;

const SQL_PRODUCTO_PRECIO_STOCK: &str = "SELECT precio_usd, stock FROM productos WHERE codigo = ?1";
const SQL_INSERT_VENTA: &str =
    "INSERT INTO ventas (fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, pago_detalle, \
     cliente_id, total_usd, tasa_aplicada) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)";
const SQL_INSERT_DETALLE: &str =
    "INSERT INTO detalles_ventas (venta_id, producto_codigo, cantidad, precio_usd_unitario) VALUES (?1, ?2, ?3, ?4)";
const SQL_UPDATE_STOCK: &str = "UPDATE productos SET stock = stock - ?1 WHERE codigo = ?2 AND stock >= ?1";
const SQL_PRODUCTO_PRECIO: &str = "SELECT precio_usd FROM productos WHERE codigo = ?1";
const SQL_UPDATE_CLIENTE_DEUDA: &str = "UPDATE clientes SET saldo_deuda_usd = saldo_deuda_usd + ?1 WHERE id = ?2";
const SQL_LIST_VENTAS: &str = "
    SELECT v.id, v.fecha_hora, v.usuario_id, u.username, v.metodo_pago, v.referencia_pago_movil,
           v.pago_detalle, v.cliente_id, c.nombre, v.total_usd, v.tasa_aplicada
    FROM ventas v
    LEFT JOIN usuarios u ON v.usuario_id = u.id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    ORDER BY v.id DESC LIMIT ?1";
const SQL_GET_DETALLE: &str = "
    SELECT dv.id, dv.venta_id, dv.producto_codigo, p.nombre, dv.cantidad, dv.precio_usd_unitario
    FROM detalles_ventas dv
    LEFT JOIN productos p ON dv.producto_codigo = p.codigo
    WHERE dv.venta_id = ?1
    ORDER BY dv.id ASC";
const SQL_UPDATE_TASA: &str = "UPDATE configuracion SET valor = ?1 WHERE clave = 'tasa_dolar'";
const SQL_UPSERT_TASA_UPDATED: &str =
    "INSERT INTO configuracion (clave, valor) VALUES ('tasa_updated_at', ?1) \
     ON CONFLICT(clave) DO UPDATE SET valor = ?1";

pub(crate) fn validar_pago_detalle(detalle: &[PagoItem], total_usd: f64) -> Result<String, String> {
    let mut suma = 0.0;
    for item in detalle {
        if !matches!(
            item.metodo.as_str(),
            "efectivo_bs" | "efectivo_usd" | "biopago" | "punto" | "pago_movil"
        ) {
            return Err(format!(
                "Método de pago inválido: {}",
                item.metodo
            ));
        }
        if item.monto_usd <= 0.0 {
            return Err(format!("Monto inválido para {}", item.metodo));
        }
        if item.metodo == "pago_movil"
            && item.referencia.as_deref().unwrap_or("").len() != constants::PAGO_MOVIL_REF_LEN
        {
            return Err(
                "Pago móvil requiere los últimos 4 dígitos de referencia"
                    .to_string(),
            );
        }
        suma += item.monto_usd;
    }
    if (suma - total_usd).abs() > constants::MONTO_TOLERANCIA {
        return Err(format!(
            "Los montos del pago mixto (${:.2}) no coinciden con el total (${:.2})",
            suma, total_usd
        ));
    }
    serde_json::to_string(detalle).map_err(|e| format!("Error al serializar pago: {}", e))
}

#[tauri::command]
pub fn create_sale(state: State<AppState>, request: CreateSaleRequest) -> Result<Venta, String> {
    let mut db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;

    if request.productos.is_empty() {
        return Err("Debe haber al menos un producto en la venta".to_string());
    }

    if request.tasa <= 0.0 {
        return Err("La tasa debe ser mayor a cero".to_string());
    }

    if request.metodo_pago == constants::METODO_PAGO_MOVIL
        && request
            .referencia_pago_movil
            .as_deref()
            .unwrap_or("")
            .len()
            != constants::PAGO_MOVIL_REF_LEN
    {
        return Err(
            "Debe ingresar los últimos 4 dígitos de la referencia".to_string(),
        );
    }

    if request.metodo_pago == constants::METODO_CREDITO && request.cliente_id.is_none() {
        return Err(
            "Debe seleccionar un cliente para la venta a crédito".to_string(),
        );
    }

    let now = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let current_username = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?
        .clone()
        .map(|u| u.username)
        .ok_or_else(|| "No hay usuario autenticado".to_string())?;
    let mut total_usd = 0.0;

    let tx = db
        .transaction()
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    for pv in &request.productos {
        let (precio, stock): (f64, i64) = tx
            .query_row(SQL_PRODUCTO_PRECIO_STOCK, params![pv.codigo], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .map_err(|_| format!("Producto '{}' no encontrado", pv.codigo))?;

        if stock < pv.cantidad {
            return Err(format!(
                "Stock insuficiente para '{}'. Disponible: {}, solicitado: {}",
                pv.codigo, stock, pv.cantidad
            ));
        }

        total_usd += precio * pv.cantidad as f64;
    }

    let pago_json = if request.metodo_pago == constants::METODO_MIXTO {
        if let Some(ref detalle) = request.pago_detalle {
            validar_pago_detalle(detalle, total_usd)?
        } else {
            return Err("Pago mixto requiere detalle de métodos".to_string());
        }
    } else {
        String::new()
    };

    tx.execute(
        SQL_INSERT_VENTA,
        params![
            now,
            request.usuario_id,
            request.metodo_pago,
            request.referencia_pago_movil,
            pago_json,
            request.cliente_id,
            total_usd,
            request.tasa,
        ],
    )
    .map_err(|e| format!("Error al crear venta: {}", e))?;

    let venta_id = tx.last_insert_rowid();

    for pv in &request.productos {
        let precio: f64 = tx
            .query_row(SQL_PRODUCTO_PRECIO, params![pv.codigo], |row| row.get(0))
            .map_err(|_| {
                format!(
                    "Producto '{}' no encontrado al insertar detalle",
                    pv.codigo
                )
            })?;

        tx.execute(
            SQL_INSERT_DETALLE,
            params![venta_id, pv.codigo, pv.cantidad, precio],
        )
        .map_err(|e| format!("Error al insertar detalle: {}", e))?;

        let affected = tx
            .execute(SQL_UPDATE_STOCK, params![pv.cantidad, pv.codigo])
            .map_err(|e| format!("Error al actualizar stock: {}", e))?;

        if affected == 0 {
            return Err(format!("Stock insuficiente para '{}'", pv.codigo));
        }
    }

    let accion = format!(
        "Venta #{} creada - Total: ${:.2} - Método: {} - Productos: {}",
        venta_id,
        total_usd,
        request.metodo_pago,
        request.productos.len()
    );
    crate::audit::log_action(&*tx, &current_username, &accion).ok();

    if request.metodo_pago == constants::METODO_CREDITO {
        if let Some(cliente_id) = request.cliente_id {
            tx.execute(SQL_UPDATE_CLIENTE_DEUDA, params![total_usd, cliente_id])
                .ok();
        }
    }

    tx.commit()
        .map_err(|e| format!("Error al confirmar transacción: {}", e))?;

    let username: String = db
        .query_row(crate::constants::SQL_USERNAME_BY_ID, params![request.usuario_id], |row| {
            row.get(0)
        })
        .unwrap_or_default();

    let pago_detalle_opt = if pago_json.is_empty() {
        None
    } else {
        Some(pago_json)
    };

    Ok(Venta {
        id: venta_id,
        fecha_hora: now,
        usuario_id: request.usuario_id,
        username,
        metodo_pago: request.metodo_pago,
        referencia_pago_movil: request.referencia_pago_movil,
        pago_detalle: pago_detalle_opt,
        cliente_id: request.cliente_id,
        cliente_nombre: None,
        total_usd,
        tasa_aplicada: request.tasa,
        total_bs: total_usd * request.tasa,
    })
}

#[tauri::command]
pub fn list_sales(state: State<AppState>, limit: Option<i64>) -> Result<Vec<Venta>, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let lim = limit.unwrap_or(constants::VENTAS_LIMIT_DEFAULT);

    let mut stmt = db.prepare(SQL_LIST_VENTAS).map_err(|e| e.to_string())?;

    let ventas: Vec<Venta> = stmt
        .query_map(params![lim], |row| {
            Ok(Venta {
                id: row.get(0)?,
                fecha_hora: row.get(1)?,
                usuario_id: row.get(2)?,
                username: row.get(3)?,
                metodo_pago: row.get(4)?,
                referencia_pago_movil: row.get(5)?,
                pago_detalle: row.get(6)?,
                cliente_id: row.get(7)?,
                cliente_nombre: row.get(8)?,
                total_usd: row.get(9)?,
                tasa_aplicada: row.get(10)?,
                total_bs: row.get::<_, f64>(9)? * row.get::<_, f64>(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ventas)
}

#[tauri::command]
pub fn get_sale_detail(
    state: State<AppState>,
    venta_id: i64,
) -> Result<Vec<DetalleVenta>, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;

    let mut stmt = db.prepare(SQL_GET_DETALLE).map_err(|e| e.to_string())?;

    let detalles: Vec<DetalleVenta> = stmt
        .query_map(params![venta_id], |row| {
            let cantidad: i64 = row.get(4)?;
            let precio: f64 = row.get(5)?;
            Ok(DetalleVenta {
                id: row.get(0)?,
                venta_id: row.get(1)?,
                producto_codigo: row.get(2)?,
                producto_nombre: row.get(3)?,
                cantidad,
                precio_usd_unitario: precio,
                subtotal_usd: cantidad as f64 * precio,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(detalles)
}

#[tauri::command]
pub fn get_tasa(state: State<AppState>) -> Result<f64, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let tasa: f64 = db
        .query_row(crate::constants::SQL_TASA, [], |row| row.get(0))
        .unwrap_or(0.0);
    Ok(tasa)
}

#[tauri::command]
pub fn set_tasa(state: State<AppState>, tasa: f64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let now = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let _ = db.execute(SQL_UPDATE_TASA, params![tasa.to_string()]);
    let _ = db.execute(SQL_UPSERT_TASA_UPDATED, params![now]);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::PagoItem;

    #[test]
    fn test_validar_pago_detalle_exacto() {
        let items = vec![PagoItem {
            metodo: "efectivo_usd".into(),
            monto_usd: 100.0,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validar_pago_detalle_desajuste() {
        let items = vec![PagoItem {
            metodo: "efectivo_usd".into(),
            monto_usd: 90.0,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validar_pago_detalle_metodo_invalido() {
        let items = vec![PagoItem {
            metodo: "tarjeta".into(),
            monto_usd: 100.0,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validar_pago_movil_ref_corta() {
        let items = vec![PagoItem {
            metodo: "pago_movil".into(),
            monto_usd: 100.0,
            referencia: Some("12".into()),
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validar_pago_movil_ref_ok() {
        let items = vec![PagoItem {
            metodo: "pago_movil".into(),
            monto_usd: 100.0,
            referencia: Some("1234".into()),
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validar_pago_monto_cero() {
        let items = vec![PagoItem {
            metodo: "efectivo_bs".into(),
            monto_usd: 0.0,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_err());
    }
}
