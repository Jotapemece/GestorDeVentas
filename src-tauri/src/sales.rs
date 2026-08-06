use base64::Engine;
use std::collections::HashMap;
use crate::constants;
use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

const SQL_INSERT_VENTA: &str =
    "INSERT INTO ventas (fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, pago_detalle, \
     cliente_id, total_usd, tasa_aplicada, total_bs, sync_id, dispositivo_origen, updated_at, nota) \
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)";
const SQL_INSERT_DETALLE: &str =
    "INSERT INTO detalles_ventas (venta_id, producto_codigo, cantidad, precio_usd_unitario, sync_id) \
     VALUES (?1, ?2, ?3, ?4, ?5)";
const SQL_UPDATE_CLIENTE_DEUDA: &str = "UPDATE clientes SET saldo_deuda_usd = saldo_deuda_usd + ?1 WHERE id = ?2";
pub(crate) const SQL_SELECT_VENTAS: &str = "
    SELECT v.id, v.fecha_hora, v.usuario_id, u.username, v.metodo_pago, v.referencia_pago_movil,
           v.pago_detalle, v.cliente_id, c.nombre, v.total_usd, v.tasa_aplicada, v.total_bs, v.anulada,
           v.sync_id, v.dispositivo_origen, v.nota_anulacion, v.nota
    FROM ventas v
    LEFT JOIN usuarios u ON v.usuario_id = u.id
    LEFT JOIN clientes c ON v.cliente_id = c.id";

pub(crate) fn row_to_venta(row: &rusqlite::Row) -> rusqlite::Result<Venta> {
    Ok(Venta {
        id: row.get(0)?, fecha_hora: row.get(1)?, usuario_id: row.get(2)?,
        username: row.get(3)?, metodo_pago: row.get(4)?, referencia_pago_movil: row.get(5)?,
        pago_detalle: row.get(6)?, cliente_id: row.get(7)?, cliente_nombre: row.get(8)?,
        total_usd: row.get(9)?, tasa_aplicada: row.get(10)?,
        total_bs: crate::helpers::fallback_total_bs(
            row.get(11)?,
            row.get(9)?,
            row.get(10)?,
        ),
        anulada: { let a: i64 = row.get(12)?; a != 0 },
        nota_anulacion: row.get(15)?,
        sync_id: row.get(13)?,
        dispositivo_origen: row.get(14)?,
        nota: row.get(16)?,
    })
}

const SQL_LIST_VENTAS: &str = "ORDER BY v.id DESC";

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
        if item.metodo == constants::METODO_PAGO_MOVIL {
            crate::helpers::validate_pago_movil_ref(item.referencia.as_deref())?;
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

fn validate_sale_request(request: &CreateSaleRequest) -> Result<(), String> {
    if request.productos.is_empty() {
        return Err("Debe haber al menos un producto en la venta".to_string());
    }
    if request.tasa <= 0.0 {
        return Err("La tasa debe ser mayor a cero".to_string());
    }
    if request.metodo_pago == constants::METODO_PAGO_MOVIL {
        crate::helpers::validate_pago_movil_ref(request.referencia_pago_movil.as_deref())?;
    }
    if request.metodo_pago == constants::METODO_CREDITO && request.cliente_id.is_none() {
        return Err("Debe seleccionar un cliente para la venta a crédito".to_string());
    }
    Ok(())
}

/// Una línea de venta ya resuelta: puede ser un producto normal o un combo (`COMBO-N`).
/// Para combos, `componentes` lista (codigo, cantidad por unidad del combo, es_inari)
/// de los productos que lo componen, y el stock se descuenta de esos componentes.
/// `es_inari` proviene SIEMPRE de la BD (nunca del request) para que un cliente no
/// pueda saltarse el control de stock marcando un producto como inari.
#[derive(Debug)]
struct LineaVenta {
    codigo: String,
    precio: f64,
    es_inari: bool,
    componentes: Vec<(String, f64, bool)>,
}

fn resolver_linea_venta(
    tx: &rusqlite::Transaction,
    pv: &ProductoVenta,
) -> Result<LineaVenta, String> {
    if let Some(combo_id_str) = pv.codigo.strip_prefix("COMBO-") {
        let combo_id: i64 = combo_id_str
            .parse()
            .map_err(|_| format!("Código de combo inválido: {}", pv.codigo))?;
        let precio: f64 = tx
            .query_row(
                "SELECT precio_usd FROM combos WHERE id = ?1",
                params![combo_id],
                |row| row.get(0),
            )
            .map_err(|_| format!("Combo '{}' no encontrado", pv.codigo))?;
        let mut stmt = tx
            .prepare(
                "SELECT cp.producto_codigo, cp.cantidad, COALESCE(p.es_inari, 0) \
                 FROM combo_productos cp \
                 LEFT JOIN productos p ON cp.producto_codigo = p.codigo \
                 WHERE cp.combo_id = ?1",
            )
            .map_err(|e| format!("Error al resolver combo '{}': {}", pv.codigo, e))?;
        let componentes: Vec<(String, f64, bool)> = stmt
            .query_map(params![combo_id], |row| {
                let cantidad: i64 = row.get(1)?;
                let es_inari: i64 = row.get(2)?;
                Ok((row.get(0)?, cantidad as f64, es_inari != 0))
            })
            .map_err(|e| format!("Error al resolver combo '{}': {}", pv.codigo, e))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(LineaVenta {
            codigo: pv.codigo.clone(),
            precio,
            es_inari: true,
            componentes,
        })
    } else {
        let (precio, stock, es_inari_db): (f64, f64, i64) = tx
            .query_row(
                "SELECT precio_usd, stock, COALESCE(es_inari, 0) FROM productos WHERE codigo = ?1",
                params![pv.codigo],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .map_err(|_| format!("Producto '{}' no encontrado", pv.codigo))?;
        let es_inari = es_inari_db != 0;
        if !es_inari && stock < pv.cantidad {
            return Err(format!(
                "Stock insuficiente para '{}'. Disponible: {}, solicitado: {}",
                pv.codigo, stock, pv.cantidad
            ));
        }
        Ok(LineaVenta {
            codigo: pv.codigo.clone(),
            precio,
            es_inari,
            componentes: Vec::new(),
        })
    }
}

fn execute_sale_transaction(
    tx: rusqlite::Transaction,
    request: &CreateSaleRequest,
    current_username: &str,
    vendedor_id: i64,
    venta_sync_id: &str,
    dispositivo_origen: &str,
    now: &str,
    now_iso: &str,
) -> Result<(i64, String, f64, f64), String> {
    let mut total_usd = 0.0;
    let mut lineas: Vec<LineaVenta> = Vec::new();

    for pv in &request.productos {
        let linea = resolver_linea_venta(&tx, pv)?;
        if !linea.componentes.is_empty() {
            // Combo: validar stock de sus componentes no-inari.
            for (codigo, cant_uni, es_inari) in &linea.componentes {
                if *es_inari {
                    continue;
                }
                let stock: f64 = tx
                    .query_row(
                        "SELECT stock FROM productos WHERE codigo = ?1",
                        params![codigo],
                        |row| row.get(0),
                    )
                    .map_err(|_| format!("Producto '{}' del combo no encontrado", codigo))?;
                let requerido = cant_uni * pv.cantidad;
                if stock < requerido {
                    return Err(format!(
                        "Stock insuficiente en '{}' (componente del combo). Disponible: {}, solicitado: {}",
                        codigo, stock, requerido
                    ));
                }
            }
        }
        total_usd += linea.precio * pv.cantidad;
        lineas.push(linea);
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

    if let Some(bs) = request.total_bs_ingresado {
        if !bs.is_finite() || bs < 0.0 {
            return Err("El total en Bs. ingresado no es válido".to_string());
        }
        // Evita subreportar el total en Bs. (p.ej. fijar Bs. 0.01 en una venta de $100).
        // Se permite pagar de más (el cliente recibe vuelto), pero nunca de menos del valor.
        let esperado = total_usd * request.tasa;
        let tolerancia = (esperado * 0.01).max(1.0);
        if bs < esperado - tolerancia {
            return Err(format!(
                "El total en Bs. ingresado (Bs. {:.2}) es menor al total de la venta (Bs. {:.2})",
                bs, esperado
            ));
        }
    }
    let total_bs = request
        .total_bs_ingresado
        .unwrap_or_else(|| (total_usd * request.tasa * constants::ROUNDING_FACTOR).round() / constants::ROUNDING_FACTOR);

    tx.execute(
        SQL_INSERT_VENTA,
        params![
            now, vendedor_id, request.metodo_pago,
            request.referencia_pago_movil, pago_json, request.cliente_id,
            total_usd, request.tasa, total_bs, venta_sync_id, dispositivo_origen, now_iso,
            request.nota.clone(),
        ],
    )
    .map_err(|e| format!("Error al crear venta: {}", e))?;

    let venta_id = tx.last_insert_rowid();

    for (linea, pv) in lineas.iter().zip(&request.productos) {
        let detalle_sync_id = Uuid::new_v4().to_string();
        tx.execute(
            SQL_INSERT_DETALLE,
            params![venta_id, linea.codigo, pv.cantidad, linea.precio, detalle_sync_id],
        )
        .map_err(|e| format!("Error al insertar detalle: {}", e))?;
        if linea.componentes.is_empty() {
            // Producto normal: descontar stock (salvo inari). es_inari viene de la BD.
            if !linea.es_inari {
                let affected = crate::db::sub_stock(&tx, &linea.codigo, pv.cantidad)
                    .map_err(|e| format!("Error al actualizar stock: {}", e))?;
                if affected == 0 {
                    return Err(format!("Stock insuficiente para '{}'", linea.codigo));
                }
            }
        } else {
            // Combo: descontar stock de sus componentes no-inari.
            for (codigo, cant_uni, es_inari) in &linea.componentes {
                if *es_inari {
                    continue;
                }
                let affected = crate::db::sub_stock(&tx, codigo, cant_uni * pv.cantidad)
                    .map_err(|e| format!("Error al actualizar stock: {}", e))?;
                if affected == 0 {
                    return Err(format!("Stock insuficiente en '{}' (componente del combo)", codigo));
                }
            }
        }
    }

    let accion = format!(
        "Venta #{} creada - Total: ${:.2} - Método: {} - Productos: {}",
        venta_id, total_usd, request.metodo_pago, request.productos.len()
    );
    if let Err(e) = crate::audit::log_action(&tx, current_username, &accion) {
    eprintln!("[audit] Error al registrar acción: {}", e);
}

    if request.metodo_pago == constants::METODO_CREDITO {
        if let Some(cliente_id) = request.cliente_id {
            tx.execute(SQL_UPDATE_CLIENTE_DEUDA, params![total_usd, cliente_id])
                .map_err(|e| format!("Error al actualizar deuda del cliente: {}", e))?;
        }
    }

    tx.commit().map_err(|e| format!("Error al confirmar transacción: {}", e))?;

    Ok((venta_id, pago_json, total_bs, total_usd))
}

#[tauri::command]
pub fn create_sale(state: State<AppState>, request: CreateSaleRequest) -> Result<Venta, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "create_sale",
    )?;
    let mut db = state.lock_db()?;
    validate_sale_request(&request).map_err(|e| {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "create_sale");
        }
        e
    })?;

    let now = crate::helpers::fecha_hora_local();
    let vendedor = state.get_employee()?;
    let current_username = vendedor.username.clone();
    let venta_sync_id = Uuid::new_v4().to_string();
    let now_iso = crate::helpers::now_iso();

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let dispositivo_origen: String = match crate::db::get_config_value(&tx, constants::CFG_DISPOSITIVO_ID) {
        Ok(Some(id)) => id,
        _ => {
            let new_id = Uuid::new_v4().to_string();
            crate::db::set_config_value(&tx, constants::CFG_DISPOSITIVO_ID, &new_id)
                .map_err(|e| format!("Error al registrar dispositivo: {}", e))?;
            new_id
        }
    };
    let (venta_id, pago_json, total_bs, total_usd) = execute_sale_transaction(
        tx, &request, &current_username, vendedor.id, &venta_sync_id, &dispositivo_origen, &now, &now_iso,
    )?;

    let username: String = db
        .query_row(crate::constants::SQL_USERNAME_BY_ID, params![vendedor.id], |row| row.get(0))
        .unwrap_or_default();

    let pago_detalle_opt = if pago_json.is_empty() { None } else { Some(pago_json) };

    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "create_sale");
    }

    Ok(Venta {
        id: venta_id, fecha_hora: now, usuario_id: vendedor.id,
        username, metodo_pago: request.metodo_pago,
        referencia_pago_movil: request.referencia_pago_movil,
        pago_detalle: pago_detalle_opt, cliente_id: request.cliente_id,
        cliente_nombre: None, total_usd, tasa_aplicada: request.tasa,
        total_bs, anulada: false, nota_anulacion: None, sync_id: Some(venta_sync_id),
        dispositivo_origen: Some(dispositivo_origen), nota: request.nota.clone(),
    })
}

#[tauri::command]
pub fn list_sales(
    state: State<AppState>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedResult<Venta>, String> {
    let db = state.lock_db()?;
    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(constants::VENTAS_LIMIT_DEFAULT).max(1);
    let offset = (p - 1) * ps;

    let total: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM ventas v LEFT JOIN usuarios u ON v.usuario_id = u.id LEFT JOIN clientes c ON v.cliente_id = c.id",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = db
        .prepare(&format!("{} {} LIMIT ?1 OFFSET ?2", SQL_SELECT_VENTAS, SQL_LIST_VENTAS))
        .map_err(|e| e.to_string())?;

    let ventas: Vec<Venta> = stmt
        .query_map(params![ps, offset], row_to_venta)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(PaginatedResult {
        total,
        page: p,
        page_size: ps,
        data: ventas,
    })
}

#[tauri::command]
pub fn get_sale_detail(
    state: State<AppState>,
    venta_id: i64,
) -> Result<Vec<SaleDetailItem>, String> {
    let db = state.lock_db()?;

    let mut stmt = db
        .prepare(
            "SELECT dv.id, dv.venta_id, dv.producto_codigo, p.nombre, dv.cantidad, dv.precio_usd_unitario, COALESCE(dv.anulado,0)
             FROM detalles_ventas dv
             LEFT JOIN productos p ON dv.producto_codigo = p.codigo
             WHERE dv.venta_id = ?1
             ORDER BY dv.id ASC",
        )
        .map_err(|e| e.to_string())?;

    let detalles: Vec<SaleDetailItem> = stmt
        .query_map(params![venta_id], |row| {
            let cantidad: f64 = row.get(4)?;
            let precio: f64 = row.get(5)?;
            let anulado: i64 = row.get(6)?;
            Ok(SaleDetailItem {
                id: row.get(0)?,
                venta_id: row.get(1)?,
                producto_codigo: row.get(2)?,
                producto_nombre: row.get(3)?,
                cantidad,
                precio_usd_unitario: precio,
                subtotal_usd: cantidad * precio,
                anulado: anulado != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(detalles)
}

#[tauri::command]
pub fn get_tasa(state: State<AppState>) -> Result<f64, String> {
    let db = state.lock_db()?;
    crate::db::get_tasa_from_db(&db)
}

#[tauri::command]
pub fn set_tasa(state: State<AppState>, tasa: f64) -> Result<(), String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "set_tasa",
    )?;
    // Requiere empleado autenticado (admin o vendedor).
    crate::auth::check_employee_role(&state)?;
    if tasa <= 0.0 {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "set_tasa");
        }
        return Err("La tasa debe ser mayor a cero".to_string());
    }
    let mut db = state.lock_db()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    let now = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    tx.execute(
        &format!("UPDATE configuracion SET valor = ?1 WHERE clave = '{}'", constants::CFG_TASA_DOLAR),
        params![tasa.to_string()],
    ).map_err(|e| format!("Error al guardar tasa: {}", e))?;
    crate::db::set_config_value(&tx, constants::CFG_TASA_UPDATED_AT, &now)
        .map_err(|e| format!("Error al guardar fecha de tasa: {}", e))?;
    tx.execute(
        "INSERT OR REPLACE INTO historial_tasas (fecha, tasa) VALUES (?1, ?2)",
        params![now, tasa],
    ).ok();
    tx.commit().map_err(|e| format!("Error al confirmar tasa: {}", e))?;
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "set_tasa");
    }
    Ok(())
}

#[tauri::command]
pub fn void_sale(state: State<AppState>, venta_id: i64, nota: String) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "void_sale",
    )?;
    let nota = nota.trim().to_string();
    if nota.is_empty() {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "void_sale");
        }
        return Err("Debe escribir una nota explicando el motivo de la anulación".to_string());
    }
    if nota.len() > 500 {
        return Err("La nota de anulación no puede superar los 500 caracteres".to_string());
    }
    let current_username = crate::auth::employee_guard(
        &state,
        "void_sale",
        &format!("Anuló venta #{}: {}", venta_id, nota),
    )?;
    let mut db = state.lock_db()?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    let (metodo, cliente_id): (String, Option<i64>) = tx
        .query_row(
            "SELECT metodo_pago, cliente_id FROM ventas WHERE id = ?1 AND anulada = 0",
            params![venta_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Venta no encontrada o ya anulada".to_string())?;

    // Restore stock only for active, non-inari items (avoid double restore / inari which
    // never decremented stock).
    let mut stmt = tx
        .prepare(
            "SELECT dv.producto_codigo, dv.cantidad \
             FROM detalles_ventas dv \
             LEFT JOIN productos p ON dv.producto_codigo = p.codigo \
             WHERE dv.venta_id = ?1 AND (dv.anulado IS NULL OR dv.anulado = 0) \
               AND COALESCE(p.es_inari, 0) = 0",
        )
        .map_err(|e| e.to_string())?;
    let mapped = stmt
        .query_map(params![venta_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, f64)> = mapped.filter_map(|r| r.ok()).collect();
    drop(stmt);
    for (codigo, cantidad) in &rows {
        if let Some(combo_id_str) = codigo.strip_prefix("COMBO-") {
            // Combo: restaurar stock de sus componentes (los que se descontaron al vender).
            if let Ok(combo_id) = combo_id_str.parse::<i64>() {
                let mut cstmt = tx
                    .prepare(
                        "SELECT cp.producto_codigo, cp.cantidad, COALESCE(p.es_inari, 0) \
                         FROM combo_productos cp \
                         LEFT JOIN productos p ON cp.producto_codigo = p.codigo \
                         WHERE cp.combo_id = ?1",
                    )
                    .map_err(|e| e.to_string())?;
                let comps = cstmt
                    .query_map(params![combo_id], |row| {
                        let cant: i64 = row.get(1)?;
                        let inari: i64 = row.get(2)?;
                        Ok((row.get::<_, String>(0)?, cant as f64, inari != 0))
                    })
                    .map_err(|e| e.to_string())?
                    .filter_map(|r| r.ok())
                    .collect::<Vec<(String, f64, bool)>>();
                drop(cstmt);
                for (cc, cant_uni, es_inari) in &comps {
                    if !es_inari {
                        crate::db::add_stock(&tx, cc, cant_uni * cantidad)?;
                    }
                }
            }
        } else {
            crate::db::add_stock(&tx, codigo, *cantidad)?;
        }
    }

    // Revert credit debt if applicable
    if metodo == constants::METODO_CREDITO {
        if let Some(cliente_id) = cliente_id {
            let total: f64 = tx
                .query_row("SELECT total_usd FROM ventas WHERE id = ?1", params![venta_id], |row| row.get(0))
                .map_err(|e| format!("Error al obtener total de venta: {}", e))?;
            tx.execute(
                "UPDATE clientes SET saldo_deuda_usd = MAX(0, saldo_deuda_usd - ?1) WHERE id = ?2",
                params![total, cliente_id],
            )
            .map_err(|e| format!("Error al revertir deuda: {}", e))?;
        }
    }

    let void_ts = crate::helpers::now_iso();
    // Mark as voided
    tx.execute(
        "UPDATE ventas SET anulada = 1, nota_anulacion = ?1, updated_at = ?2 WHERE id = ?3",
        params![nota, void_ts, venta_id],
    )
    .map_err(|e| e.to_string())?;

    if let Err(e) = crate::audit::log_action(&tx, &current_username, &format!("Anuló venta #{} con nota: {}", venta_id, nota)) {
    eprintln!("[audit] Error al registrar acción: {}", e);
}

    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;

    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "void_sale");
    }

    Ok(format!("Venta #{} anulada exitosamente. {} producto(s) restaurado(s).", venta_id, rows.len()))
}

#[tauri::command]
pub fn get_sales_report(
    state: State<AppState>,
    filter: SalesReportFilter,
) -> Result<SalesReportResult, String> {
    let db = state.lock_db()?;
    get_sales_report_inner(&db, filter)
}

#[tauri::command]
pub fn get_product_history(
    state: State<AppState>,
    producto_codigo: String,
) -> Result<Vec<ProductHistoryItem>, String> {
    let db = state.lock_db()?;
    let mut stmt = db
        .prepare(
            "SELECT dv.venta_id, v.fecha_hora, dv.cantidad, dv.precio_usd_unitario, \
             (dv.cantidad * dv.precio_usd_unitario), v.metodo_pago, u.username \
             FROM detalles_ventas dv \
             JOIN ventas v ON v.id = dv.venta_id \
             JOIN usuarios u ON u.id = v.usuario_id \
             WHERE dv.producto_codigo = ?1 AND v.anulada = 0 \
             ORDER BY v.id DESC \
             LIMIT 100",
        )
        .map_err(|e| e.to_string())?;
    let items = stmt
        .query_map(params![producto_codigo], |row| {
            Ok(ProductHistoryItem {
                venta_id: row.get(0)?,
                fecha_hora: row.get(1)?,
                cantidad: row.get(2)?,
                precio_usd_unitario: row.get(3)?,
                subtotal_usd: row.get(4)?,
                metodo_pago: row.get(5)?,
                username: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

#[tauri::command]
pub fn export_report_xlsx(
    state: State<AppState>,
    filter: SalesReportFilter,
) -> Result<String, String> {
    use rust_xlsxwriter::*;

    let db = state.lock_db()?;

    let report = get_sales_report_inner(&db, filter)?;

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();
    sheet.set_name("Reporte").ok();

    let hf = Format::new().set_bold().set_border(FormatBorder::Thin).set_background_color(Color::RGB(0xE8D5F5));
    let nf = Format::new().set_num_format("#,##0.00");

    sheet.set_column_width(0, 8).ok();
    sheet.set_column_width(1, 20).ok();
    sheet.set_column_width(2, 15).ok();
    sheet.set_column_width(3, 18).ok();
    sheet.set_column_width(4, 18).ok();
    sheet.set_column_width(5, 15).ok();

    let costo_by_code: std::collections::HashMap<String, f64> = {
        let mut stmt = db.prepare("SELECT codigo, COALESCE(costo,0) FROM productos WHERE activo = 1")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    for (col, h) in ["#", "Fecha", "Usuario", "Método", "Total ($)", "Costo ($)", "Ganancia ($)", "Total (Bs.)"].iter().enumerate() {
        sheet.write_string_with_format(0, col as u16, *h, &hf).ok();
    }

    for (i, item) in report.ventas.iter().enumerate() {
        let r = (i + 1) as u32;
        let costo_total: f64 = item.productos.iter()
            .map(|d| costo_by_code.get(&d.producto_codigo).unwrap_or(&0.0) * d.cantidad)
            .sum();
        let ganancia = item.venta.total_usd - costo_total;
        sheet.write_string(r, 1, &item.venta.fecha_hora).ok();
        sheet.write_string(r, 2, &item.venta.username).ok();
        let ml = format_metodo_label(&item.venta.metodo_pago);
        sheet.write_string(r, 3, &ml).ok();
        sheet.write_number_with_format(r, 4, item.venta.total_usd, &nf).ok();
        sheet.write_number_with_format(r, 5, costo_total, &nf).ok();
        sheet.write_number_with_format(r, 6, ganancia, &nf).ok();
        sheet.write_number_with_format(r, 7, item.venta.total_bs, &nf).ok();
    }

    sheet.set_column_width(5, 15).ok();
    sheet.set_column_width(6, 15).ok();

    let buffer = workbook.save_to_buffer().map_err(|e| format!("Error al exportar: {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
}

#[tauri::command]
pub fn export_report_pdf(
    state: State<AppState>,
    filter: SalesReportFilter,
    chart_image: Option<crate::pdf::PdfImagePayload>,
) -> Result<String, String> {
    let db = state.lock_db()?;
    let report = get_sales_report_inner(&db, filter.clone())?;

    let costo_by_code: HashMap<String, f64> = {
        let mut stmt = db.prepare("SELECT codigo, COALESCE(costo,0) FROM productos WHERE activo = 1")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let headers = ["#", "Fecha", "Usuario", "Metodo", "Total ($)", "Costo ($)", "Ganancia ($)", "Total (Bs.)"];
    let mut rows: Vec<Vec<String>> = Vec::with_capacity(report.ventas.len());
    for (i, item) in report.ventas.iter().enumerate() {
        let costo_total: f64 = item.productos.iter()
            .map(|d| costo_by_code.get(&d.producto_codigo).unwrap_or(&0.0) * d.cantidad)
            .sum();
        let ganancia = item.venta.total_usd - costo_total;
        rows.push(vec![
            (i + 1).to_string(),
            item.venta.fecha_hora.clone(),
            item.venta.username.clone(),
            format_metodo_label(&item.venta.metodo_pago).to_string(),
            format!("{:.2}", item.venta.total_usd),
            format!("{:.2}", costo_total),
            format!("{:.2}", ganancia),
            format!("{:.2}", item.venta.total_bs),
        ]);
    }

    let title = format!("Reporte de ventas: {} ventas - Total ${:.2}", report.total_ventas, report.total_usd);
    let subtitle = format!(
        "Período: {} a {} - Ganancia ${:.2}",
        filter.start_date, filter.end_date, report.total_ganancia_usd
    );
    let pdf = {
        let image = chart_image.and_then(|ci| {
            let bytes = base64::engine::general_purpose::STANDARD.decode(ci.data_b64).ok()?;
            if bytes.len() == ci.width * ci.height * 3 {
                Some(crate::pdf::PdfImage { width: ci.width, height: ci.height, rgb: bytes })
            } else { None }
        });
        crate::pdf::build_report_pdf(&title, &subtitle, &headers, &rows, image.as_ref())
    };
    Ok(base64::engine::general_purpose::STANDARD.encode(&pdf))
}

fn format_metodo_label(m: &str) -> String {
    constants::metodo_label(m).to_string()
}

fn get_sales_report_inner(
    db: &rusqlite::Connection,
    filter: SalesReportFilter,
) -> Result<SalesReportResult, String> {
    let mut where_clauses = vec![
        "v.fecha_hora >= ?1".to_string(),
        "v.fecha_hora < ?2".to_string(),
        "v.anulada = 0".to_string(),
    ];
    let has_producto = filter.producto_codigo.as_ref().is_some_and(|c| !c.is_empty());
    let has_username = filter.username.as_ref().is_some_and(|u| !u.is_empty());
    if has_producto {
        where_clauses.push("v.id IN (SELECT venta_id FROM detalles_ventas WHERE producto_codigo = ?3)".to_string());
    }
    if has_username {
        where_clauses.push(format!("v.usuario_id IN (SELECT id FROM usuarios WHERE username = ?{})", if has_producto { 4 } else { 3 }));
    }

    let end = crate::helpers::siguiente_dia(&filter.end_date);
    let where_sql = where_clauses.join(" AND ");

    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(filter.start_date.clone()),
        Box::new(end.clone()),
    ];
    if let Some(ref codigo) = filter.producto_codigo {
        if !codigo.is_empty() { params_vec.push(Box::new(codigo.clone())); }
    }
    if let Some(ref username) = filter.username {
        if !username.is_empty() { params_vec.push(Box::new(username.clone())); }
    }

    let param_count = params_vec.len();

    // Compute totals with a single aggregation query
    let count_sql = format!(
        "SELECT COUNT(*), COALESCE(SUM(v.total_usd),0), COALESCE(SUM(v.total_bs),0) \
         FROM ventas v WHERE {}",
        where_sql
    );
    let mut count_stmt = db.prepare(&count_sql).map_err(|e| e.to_string())?;
    let count_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    let (total_ventas, total_usd, total_bs): (i64, f64, f64) = count_stmt
        .query_row(count_refs.as_slice(), |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?;

    // Pagination
    let page = filter.page.unwrap_or(1).max(1);
    let page_size = filter.page_size.unwrap_or(constants::VENTAS_LIMIT_DEFAULT).clamp(1, constants::PAGE_SIZE_MAX);
    let offset = (page - 1) * page_size;

    // Fetch ventas with LIMIT/OFFSET
    let main_sql = format!(
        "{} WHERE {} ORDER BY v.id DESC LIMIT ?{} OFFSET ?{}",
        SQL_SELECT_VENTAS,
        where_sql,
        param_count + 1,
        param_count + 2,
    );

    let mut main_stmt = db.prepare(&main_sql).map_err(|e| e.to_string())?;
    let mut all_params: Vec<Box<dyn rusqlite::types::ToSql>> = params_vec;
    all_params.push(Box::new(page_size));
    all_params.push(Box::new(offset));
    let main_refs: Vec<&dyn rusqlite::types::ToSql> = all_params.iter().map(|p| p.as_ref()).collect();

    let ventas: Vec<Venta> = main_stmt
        .query_map(main_refs.as_slice(), row_to_venta)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Batch-fetch all detalles in one query
    let ids: Vec<i64> = ventas.iter().map(|v| v.id).collect();
    let detail_items: Vec<DetalleVenta> = if ids.is_empty() {
        Vec::new()
    } else {
        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        let detail_sql = format!(
            "SELECT dv.id, dv.venta_id, dv.producto_codigo, p.nombre, dv.cantidad, dv.precio_usd_unitario, COALESCE(p.costo,0) \
             FROM detalles_ventas dv \
             LEFT JOIN productos p ON dv.producto_codigo = p.codigo \
             WHERE dv.venta_id IN ({}) \
             ORDER BY dv.id ASC",
            placeholders.join(",")
        );
        let mut detail_stmt = db.prepare(&detail_sql).map_err(|e| e.to_string())?;
        let det_params: Vec<&dyn rusqlite::types::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
        let rows = match detail_stmt.query_map(det_params.as_slice(), |row| {
            let cantidad: f64 = row.get(4)?;
            let precio: f64 = row.get(5)?;
            let costo: f64 = row.get(6)?;
            Ok(DetalleVenta {
                id: row.get(0)?, venta_id: row.get(1)?, producto_codigo: row.get(2)?,
                producto_nombre: row.get(3)?, cantidad, precio_usd_unitario: precio,
                subtotal_usd: cantidad * precio, costo,
            })
        }) {
            Ok(r) => r,
            Err(e) => return Err(e.to_string()),
        };
        let details: Vec<DetalleVenta> = rows.filter_map(|r| r.ok()).collect();
        details
    };

    // Group detalles by venta_id
    let mut detail_map: HashMap<i64, Vec<DetalleVenta>> = HashMap::new();
    for det in detail_items {
        detail_map.entry(det.venta_id).or_default().push(det);
    }

    let items: Vec<SalesReportItem> = ventas.into_iter().map(|v| {
        let productos = detail_map.remove(&v.id).unwrap_or_default();
        SalesReportItem { venta: v, productos }
    }).collect();

    let total_costo_usd: f64 = items.iter()
        .flat_map(|item| &item.productos)
        .map(|d| d.costo * d.cantidad)
        .sum();
    let total_ganancia_usd = total_usd - total_costo_usd;

    Ok(SalesReportResult { total_ventas, total_usd, total_bs, total_costo_usd, total_ganancia_usd, ventas: items, page, page_size })
}

#[tauri::command]
pub fn get_sales_by_vendor(
    state: State<AppState>,
    start_date: String,
    end_date: String,
) -> Result<Vec<VendorSales>, String> {
    let db = state.lock_db()?;
    let end = crate::helpers::siguiente_dia(&end_date);

    let mut stmt = db
        .prepare(
            "SELECT COALESCE(u.username, 'Desconocido'), \
                    COUNT(CASE WHEN v.anulada = 0 THEN 1 END), \
                    COALESCE(SUM(CASE WHEN v.anulada = 0 THEN v.total_usd ELSE 0 END), 0), \
                    COALESCE(SUM(CASE WHEN v.anulada = 0 THEN v.total_bs ELSE 0 END), 0), \
                    SUM(CASE WHEN v.anulada = 1 THEN 1 ELSE 0 END) \
             FROM ventas v \
             LEFT JOIN usuarios u ON v.usuario_id = u.id \
             WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 \
             GROUP BY v.usuario_id \
             ORDER BY 3 DESC",
        )
        .map_err(|e| e.to_string())?;

    let mut result: Vec<VendorSales> = stmt
        .query_map(params![start_date, end], |row| {
            Ok(VendorSales {
                username: row.get(0)?,
                total_ventas: row.get(1)?,
                total_usd: row.get(2)?,
                total_bs: row.get(3)?,
                ventas_anuladas: row.get(4)?,
                total_costo_usd: 0.0,
                total_ganancia_usd: 0.0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut cost_stmt = db
        .prepare(
            "SELECT COALESCE(u.username, 'Desconocido'), COALESCE(SUM(COALESCE(p.costo, 0) * dv.cantidad), 0) \
             FROM ventas v \
             LEFT JOIN usuarios u ON v.usuario_id = u.id \
             JOIN detalles_ventas dv ON dv.venta_id = v.id \
             LEFT JOIN productos p ON p.codigo = dv.producto_codigo \
             WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.anulada = 0 \
             GROUP BY v.usuario_id",
        )
        .map_err(|e| e.to_string())?;
    let costs: HashMap<String, f64> = cost_stmt
        .query_map(params![start_date, end], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, f64>(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for v in result.iter_mut() {
        let costo = costs.get(&v.username).copied().unwrap_or(0.0);
        v.total_costo_usd = costo;
        v.total_ganancia_usd = v.total_usd - costo;
    }
    Ok(result)
}

#[tauri::command]
pub fn void_sale_items(
    state: State<AppState>,
    request: VoidItemRequest,
) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "void_sale_items",
    )?;
    let nota = request.nota.clone().unwrap_or_default();
    let nota = nota.trim().to_string();
    if nota.is_empty() {
        if let Ok(mut attempts) = state.admin_action_attempts.lock() {
            crate::db::rate_limit_fail(&mut attempts, "void_sale_items");
        }
        return Err("Debe escribir una nota explicando el motivo de la anulación".to_string());
    }
    if nota.len() > 500 {
        return Err("La nota de anulación no puede superar los 500 caracteres".to_string());
    }
    let current_username = crate::auth::employee_guard(
        &state,
        "void_sale_items",
        &format!("Anuló {} item(s) de venta #{}: {}", request.detalle_ids.len(), request.venta_id, nota),
    )?;
    let mut db = state.lock_db()?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    for det_id in &request.detalle_ids {
        let (codigo, cantidad): (String, f64) = tx
            .query_row(
                "SELECT dv.producto_codigo, dv.cantidad \
                 FROM detalles_ventas dv \
                 LEFT JOIN productos p ON dv.producto_codigo = p.codigo \
                 WHERE dv.id = ?1 AND (dv.anulado IS NULL OR dv.anulado = 0) \
                   AND COALESCE(p.es_inari, 0) = 0",
                params![det_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| format!("Detalle #{} no encontrado, ya anulado o inari", det_id))?;

        if let Some(combo_id_str) = codigo.strip_prefix("COMBO-") {
            // Combo: restaurar stock de sus componentes no-inari.
            if let Ok(combo_id) = combo_id_str.parse::<i64>() {
                let mut cstmt = tx
                    .prepare(
                        "SELECT cp.producto_codigo, cp.cantidad, COALESCE(p.es_inari, 0) \
                         FROM combo_productos cp \
                         LEFT JOIN productos p ON cp.producto_codigo = p.codigo \
                         WHERE cp.combo_id = ?1",
                    )
                    .map_err(|e| e.to_string())?;
                let comps = cstmt
                    .query_map(params![combo_id], |row| {
                        let cant: i64 = row.get(1)?;
                        let inari: i64 = row.get(2)?;
                        Ok((row.get::<_, String>(0)?, cant as f64, inari != 0))
                    })
                    .map_err(|e| e.to_string())?
                    .filter_map(|r| r.ok())
                    .collect::<Vec<(String, f64, bool)>>();
                drop(cstmt);
                for (cc, cant_uni, es_inari) in &comps {
                    if !es_inari {
                        crate::db::add_stock(&tx, cc, cant_uni * cantidad)?;
                    }
                }
            }
        } else {
            crate::db::add_stock(&tx, &codigo, cantidad)?;
        }

        tx.execute("UPDATE detalles_ventas SET anulado = 1 WHERE id = ?1", params![det_id])
            .map_err(|e| format!("Error al anular detalle: {}", e))?;
    }

    recalculate_sale_after_void(&tx, request.venta_id, &nota)?;

    if let Err(e) = crate::audit::log_action(&tx, &current_username,
        &format!("Anuló {} item(s) de venta #{}", request.detalle_ids.len(), request.venta_id))
    {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }

    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;

    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::rate_limit_success(&mut attempts, "void_sale_items");
    }

    Ok(format!("{} item(es) anulado(s) de venta #{}. Stock restaurado.", request.detalle_ids.len(), request.venta_id))
}

fn recalculate_sale_after_void(tx: &rusqlite::Transaction, venta_id: i64, nota: &str) -> Result<(), String> {
    let old_total_usd: f64 = tx
        .query_row("SELECT total_usd FROM ventas WHERE id = ?1", params![venta_id], |row| row.get(0))
        .map_err(|e| format!("Error al obtener total de venta: {}", e))?;
    let new_total_usd: f64 = tx
        .query_row(
            "SELECT COALESCE(SUM(CAST(anulado IS NULL OR anulado = 0 AS INTEGER) * cantidad * precio_usd_unitario), 0) \
             FROM detalles_ventas WHERE venta_id = ?1",
            params![venta_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al recalcular total: {}", e))?;
    let tasa: f64 = tx
        .query_row("SELECT tasa_aplicada FROM ventas WHERE id = ?1", params![venta_id], |row| row.get(0))
        .map_err(|e| format!("Error al obtener tasa: {}", e))?;
    let new_total_bs = (new_total_usd * tasa * 100.0).round() / 100.0;

    tx.execute("UPDATE ventas SET total_usd = ?1, total_bs = ?2 WHERE id = ?3",
        params![new_total_usd, new_total_bs, venta_id])
        .map_err(|e| format!("Error al actualizar totales: {}", e))?;

    let void_ts = crate::helpers::now_iso();
    let remaining: i64 = tx
        .query_row(
            "SELECT COUNT(*) FROM detalles_ventas WHERE venta_id = ?1 AND (anulado IS NULL OR anulado = 0)",
            params![venta_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Error al contar items restantes: {}", e))?;
    if remaining == 0 {
        tx.execute("UPDATE ventas SET anulada = 1, nota_anulacion = ?1, updated_at = ?2 WHERE id = ?3",
            params![nota, void_ts, venta_id])
            .map_err(|e| format!("Error al anular venta: {}", e))?;
        // Si toda la venta quedó anulada y era a crédito, revertir la deuda del cliente.
        let (metodo, cliente_id): (String, Option<i64>) = tx
            .query_row(
                "SELECT metodo_pago, cliente_id FROM ventas WHERE id = ?1",
                params![venta_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| format!("Error al obtener venta: {}", e))?;
        if metodo == constants::METODO_CREDITO {
            if let Some(cliente_id) = cliente_id {
                tx.execute(
                    "UPDATE clientes SET saldo_deuda_usd = MAX(0, saldo_deuda_usd - ?1) WHERE id = ?2",
                    params![old_total_usd, cliente_id],
                )
                .map_err(|e| format!("Error al revertir deuda: {}", e))?;
            }
        }
    } else {
        tx.execute("UPDATE ventas SET nota_anulacion = ?1, updated_at = ?2 WHERE id = ?3",
            params![nota, void_ts, venta_id])
            .map_err(|e| format!("Error al actualizar timestamp: {}", e))?;
    }
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

    #[test]
    fn test_validar_pago_movil_ref_none() {
        let items = vec![PagoItem {
            metodo: "pago_movil".into(),
            monto_usd: 100.0,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validar_pago_multiples_items_exactos() {
        let items = vec![
            PagoItem { metodo: "efectivo_usd".into(), monto_usd: 50.0, referencia: None },
            PagoItem { metodo: "efectivo_bs".into(), monto_usd: 30.0, referencia: None },
            PagoItem { metodo: "biopago".into(), monto_usd: 20.0, referencia: None },
        ];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validar_pago_tolerancia_limite_inferior() {
        let items = vec![PagoItem {
            metodo: "efectivo_usd".into(),
            monto_usd: 99.99,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validar_pago_tolerancia_limite_superior() {
        let items = vec![PagoItem {
            metodo: "efectivo_usd".into(),
            monto_usd: 100.02,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 100.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validar_pago_detalle_metodos_efectivo_bs_usd() {
        let items = vec![PagoItem {
            metodo: "efectivo_bs".into(),
            monto_usd: 50.0,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 50.0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validar_pago_detalle_metodo_punto() {
        let items = vec![PagoItem {
            metodo: "punto".into(),
            monto_usd: 75.5,
            referencia: None,
        }];
        let result = validar_pago_detalle(&items, 75.5);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_sale_request_empty_productos() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "efectivo_usd".into(),
            referencia_pago_movil: None,
            cliente_id: None,
            productos: vec![],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("menos un producto"));
    }

    #[test]
    fn test_validate_sale_request_tasa_cero() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "efectivo_usd".into(),
            referencia_pago_movil: None,
            cliente_id: None,
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1.0, es_inari: false }],
            tasa: 0.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("tasa"));
    }

    #[test]
    fn test_validate_sale_request_tasa_negativa() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "efectivo_usd".into(),
            referencia_pago_movil: None,
            cliente_id: None,
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1.0, es_inari: false }],
            tasa: -1.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("tasa"));
    }

    #[test]
    fn test_validate_sale_request_pago_movil_sin_ref() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "pago_movil".into(),
            referencia_pago_movil: None,
            cliente_id: None,
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1.0, es_inari: false }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_sale_request_pago_movil_ref_corta() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "pago_movil".into(),
            referencia_pago_movil: Some("AB".into()),
            cliente_id: None,
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1.0, es_inari: false }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_sale_request_credito_sin_cliente() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "credito".into(),
            referencia_pago_movil: None,
            cliente_id: None,
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1.0, es_inari: false }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("cliente"));
    }

    #[test]
    fn test_validate_sale_request_ok() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "efectivo_usd".into(),
            referencia_pago_movil: None,
            cliente_id: None,
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 2.0, es_inari: false }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_sale_request_credito_ok() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "credito".into(),
            referencia_pago_movil: None,
            cliente_id: Some(5),
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1.0, es_inari: false }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_sale_request_pago_movil_ok() {
        let req = CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "pago_movil".into(),
            referencia_pago_movil: Some("ABCD".into()),
            cliente_id: None,
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1.0, es_inari: false }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        };
        let result = validate_sale_request(&req);
        assert!(result.is_ok());
    }

    fn setup_bd() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(crate::migrations::SQL_CREATE_TABLES).unwrap();
        crate::migrations::run_migrations(&conn);
        conn.execute(
            "INSERT INTO usuarios (id, username, password, rol) VALUES (1,'tester','x','admin')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO productos (codigo, nombre, precio_usd, stock, es_inari) \
             VALUES ('P1','Producto 1',10,5,0), ('P2','Inari',3,0,1), ('P3','Comp',4,2,0)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO combos (id, nombre, precio_usd, subcategoria, created_at) \
             VALUES (1,'Combo 1',15,'combos','2026-07-18')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO combo_productos (combo_id, producto_codigo, cantidad) \
             VALUES (1,'P1',2), (1,'P2',1)",
            [],
        ).unwrap();
        conn
    }

    fn req_basico(productos: Vec<ProductoVenta>) -> CreateSaleRequest {
        CreateSaleRequest {
            usuario_id: 1,
            metodo_pago: "efectivo_usd".into(),
            referencia_pago_movil: None,
            cliente_id: None,
            productos,
            tasa: 10.0,
            pago_detalle: None,
            total_bs_ingresado: None,
            nota: String::new(),
        }
    }

    #[test]
    fn test_resolver_linea_venta_producto() {
        let mut conn = setup_bd();
        let tx = conn.transaction().unwrap();
        let linea = resolver_linea_venta(&tx, &ProductoVenta { codigo: "P1".into(), cantidad: 2.0, es_inari: false }).unwrap();
        assert_eq!(linea.codigo, "P1");
        assert_eq!(linea.precio, 10.0);
        assert!(linea.componentes.is_empty());
    }

    #[test]
    fn test_resolver_linea_venta_ignora_es_inari_del_request() {
        // El producto P1 NO es inari en la BD. Aunque el request mande es_inari=true,
        // el stock debe validarse (es_inari se lee de la BD, no del cliente).
        let mut conn = setup_bd();
        let tx = conn.transaction().unwrap();
        // P1 tiene stock 5; pedir 7 con es_inari=true en el request → debe fallar.
        let err = resolver_linea_venta(&tx, &ProductoVenta { codigo: "P1".into(), cantidad: 7.0, es_inari: true }).unwrap_err();
        assert!(err.contains("Stock insuficiente"));
        // Un producto sí inari en la BD ignora el control de stock.
        let ok = resolver_linea_venta(&tx, &ProductoVenta { codigo: "P2".into(), cantidad: 7.0, es_inari: false }).unwrap();
        assert!(ok.es_inari);
    }

    #[test]
    fn test_resolver_linea_venta_combo() {
        let mut conn = setup_bd();
        let tx = conn.transaction().unwrap();
        let linea = resolver_linea_venta(&tx, &ProductoVenta { codigo: "COMBO-1".into(), cantidad: 1.0, es_inari: true }).unwrap();
        assert_eq!(linea.precio, 15.0);
        assert_eq!(linea.componentes.len(), 2);
        assert_eq!(linea.componentes[0], ("P1".to_string(), 2.0, false));
        assert_eq!(linea.componentes[1], ("P2".to_string(), 1.0, true));
    }

    #[test]
    fn test_resolver_linea_venta_combo_inexistente() {
        let mut conn = setup_bd();
        let tx = conn.transaction().unwrap();
        let err = resolver_linea_venta(&tx, &ProductoVenta { codigo: "COMBO-99".into(), cantidad: 1.0, es_inari: true }).unwrap_err();
        assert!(err.contains("no encontrado"));
    }

    #[test]
    fn test_execute_sale_transaction_vende_combo_y_resta_componentes() {
        let mut conn = setup_bd();
        let tx = conn.transaction().unwrap();
        let request = req_basico(vec![
            ProductoVenta { codigo: "P1".into(), cantidad: 1.0, es_inari: false },
            ProductoVenta { codigo: "COMBO-1".into(), cantidad: 1.0, es_inari: true },
        ]);
        let (venta_id, _, total_bs, total_usd) = execute_sale_transaction(
            tx, &request, "tester", 1, "sync-1", "dev1", "2026-07-18 10:00:00", "2026-07-18T10:00:00.000Z",
        ).unwrap();
        assert!((total_usd - 25.0).abs() < 0.001); // 10 (P1) + 15 (combo)
        assert!((total_bs - 250.0).abs() < 0.001);
        // Stock: P1 5 -> 1 (línea) - 2 (componente combo) = 2 ; P2 inari intacto; P3 intacto
        let stock: f64 = conn.query_row("SELECT stock FROM productos WHERE codigo='P1'", [], |r| r.get(0)).unwrap();
        assert_eq!(stock, 2.0);
        let stock_p2: f64 = conn.query_row("SELECT stock FROM productos WHERE codigo='P2'", [], |r| r.get(0)).unwrap();
        assert_eq!(stock_p2, 0.0);
        // Dos detalles insertados
        let (n, total): (i64, f64) = conn.query_row(
            "SELECT COUNT(*), COALESCE(SUM(cantidad*precio_usd_unitario),0) FROM detalles_ventas WHERE venta_id=?1",
            params![venta_id], |r| Ok((r.get(0)?, r.get(1)?)),
        ).unwrap();
        assert_eq!(n, 2);
        assert!((total - 25.0).abs() < 0.001);
    }

    #[test]
    fn test_execute_sale_transaction_combo_stock_insuficiente() {
        let mut conn = setup_bd();
        // Combo 1 requiere P1 x2; solo quedan 1 tras la línea P1 x4 -> error
        let tx = conn.transaction().unwrap();
        let request = req_basico(vec![
            ProductoVenta { codigo: "P1".into(), cantidad: 4.0, es_inari: false },
            ProductoVenta { codigo: "COMBO-1".into(), cantidad: 1.0, es_inari: true },
        ]);
        let err = execute_sale_transaction(
            tx, &request, "tester", 1, "sync-1", "dev1", "2026-07-18 10:00:00", "2026-07-18T10:00:00.000Z",
        ).unwrap_err();
        assert!(err.contains("Stock insuficiente en 'P1'"));
    }

    #[test]
    fn test_total_bs_ingresado_menor_rechazado() {
        let mut conn = setup_bd();
        let tx = conn.transaction().unwrap();
        let mut request = req_basico(vec![ProductoVenta { codigo: "P1".into(), cantidad: 1.0, es_inari: false }]);
        request.total_bs_ingresado = Some(0.01); // $10 * tasa 10 = Bs 100, reporta Bs 0.01
        let err = execute_sale_transaction(
            tx, &request, "tester", 1, "sync-1", "dev1", "2026-07-18 10:00:00", "2026-07-18T10:00:00.000Z",
        ).unwrap_err();
        assert!(err.contains("menor al total"));
    }

    #[test]
    fn test_total_bs_ingresado_pago_de_mas_aceptado() {
        let mut conn = setup_bd();
        let tx = conn.transaction().unwrap();
        let mut request = req_basico(vec![ProductoVenta { codigo: "P1".into(), cantidad: 1.0, es_inari: false }]);
        request.total_bs_ingresado = Some(150.0); // paga de más, recibe vuelto
        let (_, _, total_bs, _) = execute_sale_transaction(
            tx, &request, "tester", 1, "sync-1", "dev1", "2026-07-18 10:00:00", "2026-07-18T10:00:00.000Z",
        ).unwrap();
        assert!((total_bs - 150.0).abs() < 0.001);
    }

    #[test]
    fn test_void_items_todos_revierte_deuda_credito() {
        let mut conn = setup_bd();
        conn.execute(
            "INSERT INTO clientes (id, nombre, saldo_deuda_usd) VALUES (1, 'Cliente', 30)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO ventas (id, fecha_hora, usuario_id, metodo_pago, cliente_id, total_usd, tasa_aplicada, total_bs) \
             VALUES (1, '2026-07-18 10:00:00', 1, 'credito', 1, 30, 10, 300)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO detalles_ventas (id, venta_id, producto_codigo, cantidad, precio_usd_unitario) \
             VALUES (1, 1, 'P1', 3, 10)",
            [],
        ).unwrap();
        conn.execute("UPDATE detalles_ventas SET anulado = 1 WHERE id = 1", []).unwrap();
        let tx = conn.transaction().unwrap();
        recalculate_sale_after_void(&tx, 1, "anulación total").unwrap();
        let saldo: f64 = tx.query_row("SELECT saldo_deuda_usd FROM clientes WHERE id = 1", [], |r| r.get(0)).unwrap();
        assert_eq!(saldo, 0.0);
        let anulada: i64 = tx.query_row("SELECT anulada FROM ventas WHERE id = 1", [], |r| r.get(0)).unwrap();
        assert_eq!(anulada, 1);
    }

    #[test]
    fn test_void_items_parcial_no_revierte_deuda() {
        let mut conn = setup_bd();
        conn.execute(
            "INSERT INTO clientes (id, nombre, saldo_deuda_usd) VALUES (1, 'Cliente', 30)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO ventas (id, fecha_hora, usuario_id, metodo_pago, cliente_id, total_usd, tasa_aplicada, total_bs) \
             VALUES (1, '2026-07-18 10:00:00', 1, 'credito', 1, 30, 10, 300)",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO detalles_ventas (id, venta_id, producto_codigo, cantidad, precio_usd_unitario) \
             VALUES (1, 1, 'P1', 1, 10), (2, 1, 'P3', 5, 4)",
            [],
        ).unwrap();
        conn.execute("UPDATE detalles_ventas SET anulado = 1 WHERE id = 1", []).unwrap();
        let tx = conn.transaction().unwrap();
        recalculate_sale_after_void(&tx, 1, "anulación parcial").unwrap();
        let saldo: f64 = tx.query_row("SELECT saldo_deuda_usd FROM clientes WHERE id = 1", [], |r| r.get(0)).unwrap();
        assert!((saldo - 30.0).abs() < 0.001);
        let anulada: i64 = tx.query_row("SELECT anulada FROM ventas WHERE id = 1", [], |r| r.get(0)).unwrap();
        assert_eq!(anulada, 0);
        let total: f64 = tx.query_row("SELECT total_usd FROM ventas WHERE id = 1", [], |r| r.get(0)).unwrap();
        assert!((total - 20.0).abs() < 0.001); // quedó el detalle de P3 (5*4)
    }
}
