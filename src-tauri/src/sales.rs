use base64::Engine;
use std::collections::HashMap;
use crate::constants;
use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use tauri::State;
use uuid::Uuid;

const SQL_PRODUCTO_PRECIO_STOCK: &str = "SELECT precio_usd, stock FROM productos WHERE codigo = ?1";
const SQL_INSERT_VENTA: &str =
    "INSERT INTO ventas (fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, pago_detalle, \
     cliente_id, total_usd, tasa_aplicada, total_bs, sync_id, dispositivo_origen, updated_at) \
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)";
const SQL_INSERT_DETALLE: &str =
    "INSERT INTO detalles_ventas (venta_id, producto_codigo, cantidad, precio_usd_unitario, sync_id) \
     VALUES (?1, ?2, ?3, ?4, ?5)";
const SQL_UPDATE_STOCK: &str = "UPDATE productos SET stock = stock - ?1 WHERE codigo = ?2 AND stock >= ?1";
const SQL_UPDATE_CLIENTE_DEUDA: &str = "UPDATE clientes SET saldo_deuda_usd = saldo_deuda_usd + ?1 WHERE id = ?2";
pub(crate) fn row_to_venta(row: &rusqlite::Row) -> rusqlite::Result<Venta> {
    Ok(Venta {
        id: row.get(0)?, fecha_hora: row.get(1)?, usuario_id: row.get(2)?,
        username: row.get(3)?, metodo_pago: row.get(4)?, referencia_pago_movil: row.get(5)?,
        pago_detalle: row.get(6)?, cliente_id: row.get(7)?, cliente_nombre: row.get(8)?,
        total_usd: row.get(9)?, tasa_aplicada: row.get(10)?,
        total_bs: { let bs: f64 = row.get(11)?; if bs > 0.0 { bs } else { row.get::<_, f64>(9)? * row.get::<_, f64>(10)? } },
        anulada: { let a: i64 = row.get(12)?; a != 0 },
        sync_id: row.get(13)?,
        dispositivo_origen: row.get(14)?,
    })
}

const SQL_LIST_VENTAS: &str = "
    SELECT v.id, v.fecha_hora, v.usuario_id, u.username, v.metodo_pago, v.referencia_pago_movil,
           v.pago_detalle, v.cliente_id, c.nombre, v.total_usd, v.tasa_aplicada, v.total_bs, v.anulada,
           v.sync_id, v.dispositivo_origen
    FROM ventas v
    LEFT JOIN usuarios u ON v.usuario_id = u.id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    ORDER BY v.id DESC LIMIT ?1";

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

fn execute_sale_transaction(
    tx: rusqlite::Transaction,
    request: &CreateSaleRequest,
    current_username: &str,
    venta_sync_id: &str,
    dispositivo_origen: &str,
    now: &str,
    now_iso: &str,
) -> Result<(i64, String, f64, f64), String> {
    let mut total_usd = 0.0;
    let mut producto_cache: HashMap<String, (f64, i64)> = HashMap::new();

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
        producto_cache.insert(pv.codigo.clone(), (precio, stock));
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

    let total_bs = request
        .total_bs_ingresado
        .unwrap_or_else(|| (total_usd * request.tasa * constants::ROUNDING_FACTOR).round() / constants::ROUNDING_FACTOR);

    tx.execute(
        SQL_INSERT_VENTA,
        params![
            now, request.usuario_id, request.metodo_pago,
            request.referencia_pago_movil, pago_json, request.cliente_id,
            total_usd, request.tasa, total_bs, venta_sync_id, dispositivo_origen, now_iso,
        ],
    )
    .map_err(|e| format!("Error al crear venta: {}", e))?;

    let venta_id = tx.last_insert_rowid();

    for pv in &request.productos {
        let (precio, _) = producto_cache.get(&pv.codigo)
            .ok_or_else(|| format!("Producto '{}' no encontrado en caché", pv.codigo))?;
        let detalle_sync_id = Uuid::new_v4().to_string();
        tx.execute(SQL_INSERT_DETALLE, params![venta_id, pv.codigo, pv.cantidad, precio, detalle_sync_id])
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
        venta_id, total_usd, request.metodo_pago, request.productos.len()
    );
    crate::audit::log_action(&tx, current_username, &accion).ok();

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
    let mut db = state.lock_db()?;
    validate_sale_request(&request)?;

    let now = crate::helpers::fecha_hora_local();
    let current_username = state.get_username()?;
    let venta_sync_id = Uuid::new_v4().to_string();
    let dispositivo_origen = db.query_row(
        "SELECT valor FROM configuracion WHERE clave = 'dispositivo_id'",
        [], |r| r.get::<_, String>(0),
    ).unwrap_or_default();
    let now_iso = crate::helpers::now_iso();

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    let (venta_id, pago_json, total_bs, total_usd) = execute_sale_transaction(
        tx, &request, &current_username, &venta_sync_id, &dispositivo_origen, &now, &now_iso,
    )?;

    let username: String = db
        .query_row(crate::constants::SQL_USERNAME_BY_ID, params![request.usuario_id], |row| row.get(0))
        .unwrap_or_default();

    let pago_detalle_opt = if pago_json.is_empty() { None } else { Some(pago_json) };

    Ok(Venta {
        id: venta_id, fecha_hora: now, usuario_id: request.usuario_id,
        username, metodo_pago: request.metodo_pago,
        referencia_pago_movil: request.referencia_pago_movil,
        pago_detalle: pago_detalle_opt, cliente_id: request.cliente_id,
        cliente_nombre: None, total_usd, tasa_aplicada: request.tasa,
        total_bs, anulada: false, sync_id: Some(venta_sync_id),
        dispositivo_origen: Some(dispositivo_origen),
    })
}

#[tauri::command]
pub fn list_sales(state: State<AppState>, limit: Option<i64>) -> Result<Vec<Venta>, String> {
    let db = state.lock_db()?;
    let lim = limit.unwrap_or(constants::VENTAS_LIMIT_DEFAULT);

    let mut stmt = db.prepare(SQL_LIST_VENTAS).map_err(|e| e.to_string())?;

    let ventas: Vec<Venta> = stmt
        .query_map(params![lim], row_to_venta)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ventas)
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
            let cantidad: i64 = row.get(4)?;
            let precio: f64 = row.get(5)?;
            let anulado: i64 = row.get(6)?;
            Ok(SaleDetailItem {
                id: row.get(0)?,
                venta_id: row.get(1)?,
                producto_codigo: row.get(2)?,
                producto_nombre: row.get(3)?,
                cantidad,
                precio_usd_unitario: precio,
                subtotal_usd: cantidad as f64 * precio,
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
    if tasa <= 0.0 {
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
    tx.execute(
        &format!("INSERT INTO configuracion (clave, valor) VALUES ('{}', ?1) ON CONFLICT(clave) DO UPDATE SET valor = ?1", constants::CFG_TASA_UPDATED_AT),
        params![now],
    ).map_err(|e| format!("Error al guardar fecha de tasa: {}", e))?;
    tx.commit().map_err(|e| format!("Error al confirmar tasa: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn void_sale(state: State<AppState>, venta_id: i64) -> Result<String, String> {
    let mut db = state.lock_db()?;
    let current_username = state.get_username()?;

    let (metodo, cliente_id): (String, Option<i64>) = db
        .query_row(
            "SELECT metodo_pago, cliente_id FROM ventas WHERE id = ?1 AND anulada = 0",
            params![venta_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Venta no encontrada o ya anulada".to_string())?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    // Restore stock
    let mut stmt = tx
        .prepare("SELECT producto_codigo, cantidad FROM detalles_ventas WHERE venta_id = ?1")
        .map_err(|e| e.to_string())?;
    let mapped = stmt
        .query_map(params![venta_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, i64)> = mapped.filter_map(|r| r.ok()).collect();
    drop(stmt);
    for (codigo, cantidad) in &rows {
        tx.execute(
            "UPDATE productos SET stock = stock + ?1 WHERE codigo = ?2",
            params![cantidad, codigo],
        )
        .map_err(|e| format!("Error al restaurar stock: {}", e))?;
    }

    // Revert credit debt if applicable
    if metodo == constants::METODO_CREDITO {
        if let Some(cliente_id) = cliente_id {
            let total: f64 = tx
                .query_row("SELECT total_usd FROM ventas WHERE id = ?1", params![venta_id], |row| row.get(0))
                .unwrap_or(0.0);
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
        "UPDATE ventas SET anulada = 1, updated_at = ?1 WHERE id = ?2",
        params![void_ts, venta_id],
    )
    .map_err(|e| e.to_string())?;

    crate::audit::log_action(&tx, &current_username, &format!("Anuló venta #{}", venta_id)).ok();

    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;

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
    filter: ExportReportFilter,
) -> Result<String, String> {
    use rust_xlsxwriter::*;

    let db = state.lock_db()?;

    let s = SalesReportFilter {
        start_date: filter.start_date.clone(),
        end_date: filter.end_date.clone(),
        producto_codigo: filter.producto_codigo.clone(),
        username: filter.username.clone(),
        page: None,
        page_size: None,
    };
    let report = get_sales_report_inner(&db, s)?;

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

    for (col, h) in ["#", "Fecha", "Usuario", "Método", "Total ($)", "Total (Bs.)"].iter().enumerate() {
        sheet.write_string_with_format(0, col as u16, *h, &hf).ok();
    }

    for (i, item) in report.ventas.iter().enumerate() {
        let r = (i + 1) as u32;
        sheet.write_number(r, 0, item.venta.id as f64).ok();
        sheet.write_string(r, 1, &item.venta.fecha_hora).ok();
        sheet.write_string(r, 2, &item.venta.username).ok();
        let ml = format_metodo_label(&item.venta.metodo_pago);
        sheet.write_string(r, 3, &ml).ok();
        sheet.write_number_with_format(r, 4, item.venta.total_usd, &nf).ok();
        sheet.write_number_with_format(r, 5, item.venta.total_bs, &nf).ok();
    }

    let buffer = workbook.save_to_buffer().map_err(|e| format!("Error al exportar: {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&buffer))
}

fn format_metodo_label(m: &str) -> String {
    match m {
        "efectivo_bs" => "Efectivo Bs.".to_string(),
        "efectivo_usd" => "Efectivo USD".to_string(),
        "pago_movil" => "Pago Móvil".to_string(),
        "punto" => "Punto".to_string(),
        "biopago" => "Biopago".to_string(),
        "credito" => "Crédito".to_string(),
        "mixto" => "Mixto".to_string(),
        _ => m.to_string(),
    }
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
        "SELECT v.id, v.fecha_hora, v.usuario_id, u.username, v.metodo_pago, v.referencia_pago_movil,
                v.pago_detalle, v.cliente_id, c.nombre, v.total_usd, v.tasa_aplicada, v.total_bs, v.anulada,
                v.sync_id, v.dispositivo_origen
         FROM ventas v
         LEFT JOIN usuarios u ON v.usuario_id = u.id
         LEFT JOIN clientes c ON v.cliente_id = c.id
         WHERE {}
         ORDER BY v.id DESC LIMIT ?{} OFFSET ?{}",
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
            "SELECT dv.id, dv.venta_id, dv.producto_codigo, p.nombre, dv.cantidad, dv.precio_usd_unitario \
             FROM detalles_ventas dv \
             LEFT JOIN productos p ON dv.producto_codigo = p.codigo \
             WHERE dv.venta_id IN ({}) \
             ORDER BY dv.id ASC",
            placeholders.join(",")
        );
        let mut detail_stmt = db.prepare(&detail_sql).map_err(|e| e.to_string())?;
        let det_params: Vec<&dyn rusqlite::types::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
        let rows = match detail_stmt.query_map(det_params.as_slice(), |row| {
            let cantidad: i64 = row.get(4)?;
            let precio: f64 = row.get(5)?;
            Ok(DetalleVenta {
                id: row.get(0)?, venta_id: row.get(1)?, producto_codigo: row.get(2)?,
                producto_nombre: row.get(3)?, cantidad, precio_usd_unitario: precio,
                subtotal_usd: cantidad as f64 * precio,
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

    Ok(SalesReportResult { total_ventas, total_usd, total_bs, ventas: items, page, page_size })
}

#[tauri::command]
pub fn void_sale_items(
    state: State<AppState>,
    request: VoidItemRequest,
) -> Result<String, String> {
    let mut db = state.lock_db()?;
    let current_username = state.get_username()?;

    let tx = db.transaction().map_err(|e| e.to_string())?;

    for det_id in &request.detalle_ids {
        let (codigo, cantidad): (String, i64) = tx
            .query_row(
                "SELECT producto_codigo, cantidad FROM detalles_ventas WHERE id = ?1 AND (anulado IS NULL OR anulado = 0)",
                params![det_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| format!("Detalle #{} no encontrado o ya anulado", det_id))?;

        tx.execute("UPDATE productos SET stock = stock + ?1 WHERE codigo = ?2", params![cantidad, codigo])
            .map_err(|e| format!("Error al restaurar stock: {}", e))?;

        tx.execute("UPDATE detalles_ventas SET anulado = 1 WHERE id = ?1", params![det_id])
            .map_err(|e| format!("Error al anular detalle: {}", e))?;
    }

    recalculate_sale_after_void(&tx, request.venta_id)?;

    crate::audit::log_action(&tx, &current_username,
        &format!("Anuló {} item(s) de venta #{}", request.detalle_ids.len(), request.venta_id)).ok();

    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;

    Ok(format!("{} item(es) anulado(s) de venta #{}. Stock restaurado.", request.detalle_ids.len(), request.venta_id))
}

fn recalculate_sale_after_void(tx: &rusqlite::Transaction, venta_id: i64) -> Result<(), String> {
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
        tx.execute("UPDATE ventas SET anulada = 1, updated_at = ?1 WHERE id = ?2", params![void_ts, venta_id])
            .map_err(|e| format!("Error al anular venta: {}", e))?;
    } else {
        tx.execute("UPDATE ventas SET updated_at = ?1 WHERE id = ?2", params![void_ts, venta_id])
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1 }],
            tasa: 0.0,
            pago_detalle: None,
            total_bs_ingresado: None,
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1 }],
            tasa: -1.0,
            pago_detalle: None,
            total_bs_ingresado: None,
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1 }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1 }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1 }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 2 }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1 }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
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
            productos: vec![ProductoVenta { codigo: "P001".into(), cantidad: 1 }],
            tasa: 90.0,
            pago_detalle: None,
            total_bs_ingresado: None,
        };
        let result = validate_sale_request(&req);
        assert!(result.is_ok());
    }
}
