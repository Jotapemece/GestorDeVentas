use crate::constants;
use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;

const SQL_SUM_VENTAS_RANGE: &str =
    "SELECT COUNT(*), COALESCE(SUM(total_usd), 0), COALESCE(SUM(total_bs), 0) \
     FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0 \
     AND metodo_pago != ?3";
const SQL_VENTAS_RANGE: &str = "
    SELECT metodo_pago, pago_detalle, total_usd, referencia_pago_movil
    FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0
    AND metodo_pago != ?3";
const SQL_PRODUCTOS_VENDIDOS: &str = "
    SELECT p.nombre, SUM(dv.cantidad), SUM(dv.cantidad * dv.precio_usd_unitario)
    FROM detalles_ventas dv
    JOIN productos p ON dv.producto_codigo = p.codigo
    JOIN ventas v ON dv.venta_id = v.id
    WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.anulada = 0
    GROUP BY p.nombre
    ORDER BY SUM(dv.cantidad * dv.precio_usd_unitario) DESC";
const SQL_CLIENTES_CREDITO: &str = "
    SELECT c.nombre, COALESCE(SUM(v.total_usd), 0)
    FROM clientes c
    JOIN ventas v ON v.cliente_id = c.id
    WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.metodo_pago = ?3 AND v.anulada = 0
    GROUP BY c.id
    ORDER BY c.nombre";
const SQL_INSERT_CIERRE: &str = "
    INSERT INTO cierres_caja (fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre, desde, hasta)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)";
const SQL_INSERT_CIERRE_DETALLE: &str =
    "INSERT INTO cierres_detalle (cierre_id, detalle_json) VALUES (?1, ?2)";
const SQL_LIST_CIERRES: &str = "
    SELECT c.id, c.fecha_hora, u.username, c.total_ventas, c.total_usd, c.total_bs, c.tasa_cierre, c.desde, c.hasta
    FROM cierres_caja c
    LEFT JOIN usuarios u ON c.usuario_id = u.id
    ORDER BY c.id DESC";
const SQL_CIERRE_BY_ID: &str = "
    SELECT fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre, desde, hasta
    FROM cierres_caja WHERE id = ?1";
const SQL_DETALLE_JSON: &str =
    "SELECT detalle_json FROM cierres_detalle WHERE cierre_id = ?1";
const SQL_LIST_DIARIAS: &str = "WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.anulada = 0 ORDER BY v.id DESC LIMIT 500";

fn sumar_ventas_rango(
    db: &rusqlite::Connection,
    start: &str,
    end: &str,
    metodo_excluido: &str,
) -> Result<(i64, f64, f64), String> {
    db.query_row(SQL_SUM_VENTAS_RANGE, params![start, end, metodo_excluido], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    })
    .map_err(|e| format!("Error al obtener totales del período: {}", e))
}

/// Neto de movimientos de caja (ingresos - egresos) en el rango [start, end).
/// Devuelve (neto_usd, neto_bs).
/// El valor USD canónico de cada movimiento es `monto_usd`; si es 0 (el movimiento
/// solo se registró en Bs.) se convierte con la tasa. Así NO se cuenta doble cuando
/// el frontend guarda ambas representaciones (monto_usd y monto_bs) del mismo
/// movimiento. `neto_bs` es la suma de `monto_bs` (para mostrar).
fn sumar_movimientos_rango(
    db: &rusqlite::Connection,
    start: &str,
    end: &str,
) -> Result<(f64, f64), String> {
    let tasa = crate::db::get_tasa_from_db(db).unwrap_or(0.0);
    let (neto_usd, neto_bs): (f64, f64) = db
        .query_row(
            "SELECT \
               COALESCE(SUM(CASE WHEN tipo='ingreso' THEN CASE WHEN monto_usd > 0 THEN monto_usd ELSE monto_bs / ?3 END ELSE -CASE WHEN monto_usd > 0 THEN monto_usd ELSE monto_bs / ?3 END END), 0), \
               COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto_bs ELSE -monto_bs END), 0) \
             FROM movimientos_caja WHERE date(created_at) >= ?1 AND date(created_at) < ?2",
            params![start, end, tasa],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Error al obtener movimientos del período: {}", e))?;
    Ok((neto_usd, neto_bs))
}

fn obtener_costo_periodo(
    db: &rusqlite::Connection,
    start: &str,
    end: &str,
) -> Result<f64, String> {
    let sql = "SELECT COALESCE(SUM(COALESCE(p.costo,0) * dv.cantidad), 0)
               FROM detalles_ventas dv
               JOIN productos p ON dv.producto_codigo = p.codigo
               JOIN ventas v ON dv.venta_id = v.id
               WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.anulada = 0";
    db.query_row(sql, params![start, end], |row| row.get(0))
        .map_err(|e| format!("Error al obtener costo del período: {}", e))
}

fn obtener_totales_del_dia(
    db: &rusqlite::Connection,
    today: &str,
    tomorrow: &str,
) -> Result<(i64, f64, f64, f64), String> {
    let (cnt, usd, bs) = sumar_ventas_rango(db, today, tomorrow, constants::METODO_CREDITO)?;

    let tasa: f64 = db
        .query_row(crate::constants::SQL_TASA, [], |row| row.get(0))
        .map_err(|e| format!("Error al obtener tasa del día: {}", e))?;

    Ok((cnt, usd, bs, tasa))
}

fn group_payments_by_method(rows: &[(String, Option<String>, f64, Option<String>)]) -> Vec<MetodoTotal> {
    let mut por_metodo: HashMap<String, (f64, Vec<String>)> = HashMap::new();
    for (metodo, detalle, monto, ref_movil) in rows {
        if metodo == "mixto" {
            if let Some(json) = detalle {
                if let Ok(items) = serde_json::from_str::<Vec<PagoItem>>(json) {
                    for item in items {
                        let entry = por_metodo.entry(item.metodo.clone()).or_insert((0.0, Vec::new()));
                        entry.0 += item.monto_usd;
                        if let Some(ref r) = item.referencia {
                            if !entry.1.contains(r) { entry.1.push(r.clone()); }
                        }
                    }
                }
            }
        } else {
            let entry = por_metodo.entry(metodo.clone()).or_insert((0.0, Vec::new()));
            entry.0 += monto;
            if metodo == constants::METODO_PAGO_MOVIL {
                if let Some(ref r) = ref_movil {
                    if !entry.1.contains(r) { entry.1.push(r.clone()); }
                }
            }
        }
    }
    let mut result: Vec<MetodoTotal> = por_metodo
        .into_iter()
        .map(|(metodo, (total_usd, referencias))| MetodoTotal { metodo, total_usd, referencias })
        .collect();
    result.sort_by(|a, b| b.total_usd.partial_cmp(&a.total_usd).unwrap_or(std::cmp::Ordering::Equal));
    result
}

fn compute_report_data_range(
    db: &rusqlite::Connection,
    start: &str,
    end: &str,
    now: &str,
) -> Result<CloseReportData, String> {
    let (total_ventas, total_usd, total_bs, tasa) = obtener_totales_del_dia(db, start, end)?;

    let mut stmt = db.prepare(SQL_VENTAS_RANGE).map_err(|e| e.to_string())?;

    let rows: Vec<(String, Option<String>, f64, Option<String>)> = stmt
        .query_map(params![start, end, constants::METODO_CREDITO], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let por_metodo = group_payments_by_method(&rows);

    let mut prod_stmt = db
        .prepare(SQL_PRODUCTOS_VENDIDOS)
        .map_err(|e| e.to_string())?;

    let productos_vendidos: Vec<ProductoReporte> = prod_stmt
        .query_map(params![start, end], |row| {
            Ok(ProductoReporte {
                nombre: row.get(0)?,
                cantidad: row.get(1)?,
                total_usd: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut cli_stmt = db
        .prepare(SQL_CLIENTES_CREDITO)
        .map_err(|e| e.to_string())?;

    let clientes_credito: Vec<ClienteCreditoReporte> = cli_stmt
        .query_map(params![start, end, constants::METODO_CREDITO], |row| {
            Ok(ClienteCreditoReporte {
                nombre: row.get(0)?,
                total_usd: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(CloseReportData {
        fecha_cierre: now.to_string(),
        total_ventas,
        total_usd,
        total_bs,
        tasa_cierre: tasa,
        por_metodo,
        productos_vendidos,
        clientes_credito,
        dias: Vec::new(),
    })
}

#[tauri::command]
pub fn get_daily_summary(state: State<AppState>) -> Result<DailySummary, String> {
    let db = state.lock_db()?;

    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let tomorrow = crate::helpers::siguiente_dia(&today);
    let tasa = crate::db::get_tasa_from_db(&db).unwrap_or(0.0);

    let (total_ventas, total_usd, total_bs, _) = obtener_totales_del_dia(&db, &today, &tomorrow)?;

    let mut stmt = db
        .prepare(&format!("{} {}", crate::sales::SQL_SELECT_VENTAS, SQL_LIST_DIARIAS))
        .map_err(|e| e.to_string())?;

    let ventas: Vec<Venta> = stmt
        .query_map(params![today, tomorrow], crate::sales::row_to_venta)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Abonos de hoy (ingresos de caja por pago de deuda) para la sección "Abonos de hoy".
    let mut ab_stmt = db
        .prepare(
            "SELECT m.id, m.usuario_id, COALESCE(m.cliente_id, 0), COALESCE(c.nombre, ''), \
                    m.monto_usd, m.monto_bs, m.concepto, m.created_at \
             FROM movimientos_caja m LEFT JOIN clientes c ON m.cliente_id = c.id \
             WHERE m.tipo = 'ingreso' AND m.concepto LIKE 'Abono%' \
               AND date(m.created_at) = date('now','localtime') \
             ORDER BY m.id DESC",
        )
        .map_err(|e| e.to_string())?;
    let abonos: Vec<AbonoRow> = ab_stmt
        .query_map([], |row| {
            Ok(AbonoRow {
                id: row.get(0)?,
                cliente_id: row.get(2)?,
                cliente_nombre: row.get(3)?,
                monto_usd: row.get(4)?,
                monto_bs: row.get(5)?,
                metodo_pago: String::new(),
                concepto: row.get(6)?,
                fecha_hora: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    let abonos_usd: f64 = abonos.iter().map(|a| a.monto_usd).sum();
    let abonos_bs: f64 = abonos.iter().map(|a| a.monto_bs).sum();

    Ok(DailySummary {
        total_ventas,
        total_usd,
        total_bs,
        ventas,
        tasa_actual: tasa,
        abonos,
        abonos_usd,
        abonos_bs,
    })
}

#[tauri::command]
pub fn abrir_caja(state: State<AppState>) -> Result<String, String> {
    let username = state.get_username()?;
    let db = state.lock_db()?;
    crate::db::set_config_value(&db, constants::CFG_CAJA_ABIERTA, "true")
        .map_err(|e| e.to_string())?;

    if let Err(e) = crate::audit::log_action(&db, &username, "Caja abierta") {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }

    Ok("Caja abierta exitosamente".to_string())
}

#[tauri::command]
pub fn get_caja_abierta(state: State<AppState>) -> Result<bool, String> {
    let db = state.lock_db()?;
    let val = crate::db::get_config_value(&db, constants::CFG_CAJA_ABIERTA)
        .unwrap_or_default()
        .unwrap_or_else(|| "false".to_string());
    Ok(val == "true")
}

/// Detecta un cierre de caja pendiente por corte de energía: la caja quedó
/// abierta con ventas de días anteriores que nunca se cerraron. Devuelve el
/// día más reciente sin cierre (y sus totales) si existe, o None.
#[tauri::command]
pub fn get_pendiente_cierre(state: State<AppState>) -> Result<Option<PendienteCierre>, String> {
    crate::auth::check_employee_role(&state)?;
    let db = state.lock_db()?;
    detectar_pendiente_cierre(&db)
}

fn detectar_pendiente_cierre(db: &rusqlite::Connection) -> Result<Option<PendienteCierre>, String> {
    let caja_abierta = crate::db::get_config_value(db, constants::CFG_CAJA_ABIERTA)
        .unwrap_or_default()
        .unwrap_or_else(|| "false".to_string());
    if caja_abierta != "true" {
        return Ok(None);
    }
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    // Todas las fechas con ventas (no anuladas) anteriores a hoy SIN un cierre
    // que cubra ese día (un cierre multi-día cubre desde..hasta).
    let mut stmt = db
        .prepare(
            "SELECT DISTINCT substr(v.fecha_hora, 1, 10) AS dia \
             FROM ventas v \
             WHERE v.anulada = 0 AND dia < ?1 \
               AND NOT EXISTS (\
                   SELECT 1 FROM cierres_caja c \
                   WHERE COALESCE(c.desde, substr(c.fecha_hora, 1, 10)) <= dia \
                     AND COALESCE(c.hasta, substr(c.fecha_hora, 1, 10)) >= dia\
               ) \
             ORDER BY dia ASC",
        )
        .map_err(|e| format!("Error al preparar detección de cierre pendiente: {}", e))?;
    let dias: Vec<String> = stmt
        .query_map(params![today], |row| row.get(0))
        .map_err(|e| format!("Error al detectar cierre pendiente: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    if dias.is_empty() {
        return Ok(None);
    }
    let mut per_dia = Vec::new();
    let mut total_ventas = 0;
    let mut total_usd = 0.0;
    let mut total_bs = 0.0;
    for dia in &dias {
        let next = crate::helpers::siguiente_dia(dia);
        let (cnt, usd, bs) = sumar_ventas_rango(db, dia, &next, constants::METODO_CREDITO)?;
        total_ventas += cnt;
        total_usd += usd;
        total_bs += bs;
        per_dia.push(PendienteDia {
            fecha: dia.clone(),
            total_ventas: cnt,
            total_usd: usd,
            total_bs: bs,
        });
    }
    Ok(Some(PendienteCierre {
        desde: dias[0].clone(),
        hasta: dias[dias.len() - 1].clone(),
        total_ventas,
        total_usd,
        total_bs,
        dias: per_dia,
    }))
}

#[tauri::command]
pub fn close_cashier(
    state: State<AppState>,
    fecha: Option<String>,
) -> Result<CloseReport, String> {
    let username = state.get_username()?;
    let user_id = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?
        .as_ref()
        .map(|u| u.id)
        .ok_or("No autenticado")?;

    let mut db = state.lock_db()?;

    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let day = match fecha {
        Some(f) if !f.trim().is_empty() => {
            let f = f.trim().to_string();
            if f.len() >= 10 { f[..10].to_string() } else { today.clone() }
        }
        _ => today.clone(),
    };
    let tomorrow = crate::helpers::siguiente_dia(&day);
    let mut now = crate::helpers::fecha_hora_local();
    if day != today {
        // Cierre de un día anterior (corte de energía): el registro del cierre
        // debe quedar fechado el día que se está cerrando, no "hoy".
        now = format!("{} {}", day, &now[11..]);
    }

    let tx = db
        .transaction()
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let caja_abierta = crate::db::get_config_value(&tx, constants::CFG_CAJA_ABIERTA)
        .unwrap_or_default()
        .unwrap_or_else(|| "false".to_string());
    if caja_abierta != "true" {
        return Err("La caja no está abierta. Ábrela primero.".to_string());
    }

    let (total_ventas, total_usd, total_bs, tasa) = obtener_totales_del_dia(&tx, &day, &tomorrow)?;

    let report_data = compute_report_data_range(&tx, &day, &tomorrow, &now)?;
    let detalle_json =
        serde_json::to_string(&report_data).map_err(|e| format!("Error al serializar reporte: {}", e))?;

    tx.execute(
        SQL_INSERT_CIERRE,
        params![now, user_id, total_ventas, total_usd, total_bs, tasa, day, day],
    )
    .map_err(|e| e.to_string())?;

    let cierre_id = tx.last_insert_rowid();
    tx.execute(SQL_INSERT_CIERRE_DETALLE, params![cierre_id, detalle_json])
        .map_err(|e| format!("Error al guardar detalle del cierre: {}", e))?;

    crate::db::set_config_value(&tx, constants::CFG_CAJA_ABIERTA, "false")
        .map_err(|e| format!("Error al cerrar caja: {}", e))?;

    let accion = format!(
        "Cierre de caja - Ventas: {}, Total USD: ${:.2}, Total Bs.: Bs. {:.2}",
        total_ventas, total_usd, total_bs
    );
    if let Err(e) = crate::audit::log_action(&tx, &username, &accion) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }

    tx.commit()
        .map_err(|e| format!("Error al confirmar cierre: {}", e))?;

    drop(db);

    let backup_msg = match crate::db::ensure_daily_backup(&state) {
        Ok(Some(msg)) => Some(msg),
        Ok(None) => None,
        Err(e) => Some(format!("Aviso: backup automático no realizado — {}", e)),
    };

    Ok(CloseReport {
        fecha_cierre: now,
        total_ventas,
        total_usd,
        total_bs,
        usuario: username,
        tasa_cierre: tasa,
        backup_msg,
    })
}

#[tauri::command]
pub fn get_close_report_data(
    state: State<AppState>,
    fecha: Option<String>,
) -> Result<CloseReportData, String> {
    let db = state.lock_db()?;
    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let day = match fecha {
        Some(f) if !f.trim().is_empty() => {
            let f = f.trim().to_string();
            if f.len() >= 10 { f[..10].to_string() } else { today.clone() }
        }
        _ => today.clone(),
    };
    let tomorrow = crate::helpers::siguiente_dia(&day);
    let mut now = crate::helpers::fecha_hora_local();
    if day != today {
        now = format!("{} {}", day, &now[11..]);
    }
    compute_report_data_range(&db, &day, &tomorrow, &now)
}

/// Cierre pendiente multi-día (corte de energía): crea UN solo `cierres_caja`
/// que cubre el rango [desde, hasta] de días sin cerrar, con desglose por día
/// en el reporte. A diferencia de `close_cashier`, la caja NO se cierra (puede
/// haber ventas del día actual que siguen abiertas).
#[tauri::command]
pub fn close_pendiente_cashier(state: State<AppState>) -> Result<ClosePendingResult, String> {
    let username = state.get_username()?;
    let user_id = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?
        .as_ref()
        .map(|u| u.id)
        .ok_or("No autenticado")?;

    let mut db = state.lock_db()?;

    let Some(pend) = detectar_pendiente_cierre(&db)? else {
        return Err("No hay días pendientes de cierre por compensar.".to_string());
    };

    let now = crate::helpers::fecha_hora_local();
    let fin = crate::helpers::siguiente_dia(&pend.hasta);

    let tx = db
        .transaction()
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    // Datos agregados del rango completo [desde, siguiente(hasta)).
    let report_data = compute_report_data_range(&tx, &pend.desde, &fin, &now)?;

    // Desglose por día.
    let mut dias: Vec<DiaCierre> = Vec::new();
    for dia in &pend.dias {
        let next = crate::helpers::siguiente_dia(&dia.fecha);
        let d = compute_report_data_range(&tx, &dia.fecha, &next, &dia.fecha)?;
        dias.push(DiaCierre {
            fecha: dia.fecha.clone(),
            total_ventas: d.total_ventas,
            total_usd: d.total_usd,
            total_bs: d.total_bs,
            por_metodo: d.por_metodo,
            productos_vendidos: d.productos_vendidos,
            clientes_credito: d.clientes_credito,
        });
    }

    let mut data = report_data;
    data.dias = dias;
    let detalle_json =
        serde_json::to_string(&data).map_err(|e| format!("Error al serializar reporte: {}", e))?;

    tx.execute(
        SQL_INSERT_CIERRE,
        params![
            now,
            user_id,
            data.total_ventas,
            data.total_usd,
            data.total_bs,
            data.tasa_cierre,
            pend.desde,
            pend.hasta
        ],
    )
    .map_err(|e| e.to_string())?;

    let cierre_id = tx.last_insert_rowid();
    tx.execute(SQL_INSERT_CIERRE_DETALLE, params![cierre_id, detalle_json])
        .map_err(|e| format!("Error al guardar detalle del cierre: {}", e))?;

    // La caja NO se cierra: hay ventas del día actual que siguen abiertas.
    let accion = format!(
        "Cierre pendiente {} -> {} - Días: {}, Ventas: {}, Total USD: ${:.2}, Total Bs.: Bs. {:.2}",
        pend.desde, pend.hasta, pend.dias.len(), data.total_ventas, data.total_usd, data.total_bs
    );
    if let Err(e) = crate::audit::log_action(&tx, &username, &accion) {
        eprintln!("[audit] Error al registrar acción: {}", e);
    }

    tx.commit()
        .map_err(|e| format!("Error al confirmar cierre: {}", e))?;

    drop(db);

    let backup_msg = match crate::db::ensure_daily_backup(&state) {
        Ok(Some(msg)) => Some(msg),
        Ok(None) => None,
        Err(e) => Some(format!("Aviso: backup automático no realizado — {}", e)),
    };

    Ok(ClosePendingResult {
        report: CloseReport {
            fecha_cierre: now,
            total_ventas: data.total_ventas,
            total_usd: data.total_usd,
            total_bs: data.total_bs,
            usuario: username,
            tasa_cierre: data.tasa_cierre,
            backup_msg,
        },
        data,
    })
}

#[tauri::command]
pub fn list_cierres(
    state: State<AppState>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<Vec<CierreListItem>, String> {
    crate::auth::admin_guard(&state, "list_cierres", "Consultó el historial de cierres")?;
    let db = state.lock_db()?;
    let query = if let (Some(p), Some(ps)) = (page, page_size) {
        let offset = (p.max(1) - 1) * ps;
        format!("{} LIMIT {} OFFSET {}", SQL_LIST_CIERRES, ps, offset)
    } else {
        SQL_LIST_CIERRES.to_string()
    };

    let mut stmt = db.prepare(&query).map_err(|e| e.to_string())?;

    let cierres: Vec<CierreListItem> = stmt
        .query_map([], |row| {
            let bs: f64 = row.get(5)?;
            let tasa_cierre: f64 = row.get(6)?;
            Ok(CierreListItem {
                id: row.get(0)?,
                fecha_hora: row.get(1)?,
                username: row.get(2)?,
                total_ventas: row.get(3)?,
                total_usd: row.get(4)?,
                total_bs: crate::helpers::fallback_total_bs(bs, row.get(4)?, tasa_cierre),
                tasa_cierre,
                desde: row.get(7).unwrap_or_default(),
                hasta: row.get(8).unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(cierres)
}

#[tauri::command]
pub fn get_cierre_detalle(
    state: State<AppState>,
    cierre_id: i64,
) -> Result<CierreDetalle, String> {
    let db = state.lock_db()?;

    let (fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre, desde, hasta): (
        String,
        i64,
        i64,
        f64,
        f64,
        f64,
        Option<String>,
        Option<String>,
    ) = db
        .query_row(SQL_CIERRE_BY_ID, params![cierre_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
            ))
        })
        .map_err(|_| "Cierre no encontrado".to_string())?;

    let username: String = db
        .query_row(crate::constants::SQL_USERNAME_BY_ID, params![usuario_id], |row| row.get(0))
        .unwrap_or_default();

    let total_bs = crate::helpers::fallback_total_bs(total_bs, total_usd, tasa_cierre);

    let detalle_json: String = db
        .query_row(SQL_DETALLE_JSON, params![cierre_id], |row| row.get(0))
        .map_err(|_| "Detalle no encontrado para este cierre".to_string())?;

    let detalle: CloseReportData = serde_json::from_str(&detalle_json)
        .map_err(|e| format!("Error al leer detalle del cierre: {}", e))?;

    Ok(CierreDetalle {
        cierre: CierreListItem {
            id: cierre_id,
            fecha_hora,
            username,
            total_ventas,
            total_usd,
            total_bs,
            tasa_cierre,
            desde,
            hasta,
        },
        detalle,
    })
}

#[tauri::command]
pub fn get_dashboard_payment_methods(state: State<AppState>, period: String) -> Result<Vec<MetodoTotal>, String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;
    let now = chrono::Local::now();
    let today = now.format("%Y-%m-%d").to_string();
    let tomorrow = crate::helpers::siguiente_dia(&today);

    let (start, end) = match period.as_str() {
        "day" => (today.clone(), tomorrow),
        "week" => {
            let week_ago = (now - chrono::Duration::days(6)).format("%Y-%m-%d").to_string();
            (week_ago, tomorrow)
        }
        "month" => {
            let month_start = now.format("%Y-%m-01").to_string();
            let after_month = crate::helpers::siguiente_dia(&now.format("%Y-%m-%d").to_string());
            (month_start, after_month)
        }
        _ => return Err("Periodo invalido. Use day, week o month".to_string()),
    };

    let data = compute_report_data_range(&db, &start, &end, &today)?;
    let mut metodos = data.por_metodo;
    let (neto_usd, _) = sumar_movimientos_rango(&db, &start, &end)?;
    if neto_usd > 0.0 {
        metodos.push(MetodoTotal {
            metodo: constants::METODO_MOVIMIENTOS_CAJA.to_string(),
            total_usd: neto_usd,
            referencias: Vec::new(),
        });
    }
    Ok(metodos)
}

#[tauri::command]
pub fn get_dashboard_summary(state: State<AppState>) -> Result<DashboardSummary, String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tomorrow = crate::helpers::siguiente_dia(&today);

    let week_ago = (chrono::Local::now() - chrono::Duration::days(6))
        .format("%Y-%m-%d")
        .to_string();
    let after_week = crate::helpers::siguiente_dia(&today);

    let month_start = chrono::Local::now()
        .format("%Y-%m-01")
        .to_string();
    let after_month = crate::helpers::siguiente_dia(&chrono::Local::now().format("%Y-%m-%d").to_string());

    fn period(db: &rusqlite::Connection, start: &str, end: &str) -> Result<DashboardPeriod, String> {
        let (cnt, usd, bs) = sumar_ventas_rango(db, start, end, constants::METODO_CREDITO)?;
        let costo = obtener_costo_periodo(db, start, end)?;
        let (neto_usd, neto_bs) = sumar_movimientos_rango(db, start, end)?;
        Ok(DashboardPeriod {
            total_ventas: cnt,
            total_usd: usd,
            total_bs: bs,
            total_costo_usd: costo,
            total_ganancia_usd: usd - costo,
            neto_movimientos_usd: neto_usd,
            neto_movimientos_bs: neto_bs,
        })
    }

    Ok(DashboardSummary {
        today: period(&db, &today, &tomorrow)?,
        week: period(&db, &week_ago, &after_week)?,
        month: period(&db, &month_start, &after_month)?,
    })
}

#[tauri::command]
pub fn get_profit_series(
    state: State<AppState>,
    filter: crate::models::ProfitSeriesFilter,
) -> Result<Vec<crate::models::ProfitDataPoint>, String> {
    crate::auth::check_admin_role(&state)?;
    let db = state.lock_db()?;

    let start = filter.start_date;
    let end = if filter.end_date.contains(' ') {
        filter.end_date
    } else {
        crate::helpers::siguiente_dia(&filter.end_date)
    };

    let mut ventas_stmt = db.prepare(
        "SELECT date(v.fecha_hora) as dia,
                COALESCE(SUM(v.total_usd), 0),
                COALESCE((SELECT SUM(COALESCE(p.costo, 0) * dv.cantidad)
                          FROM detalles_ventas dv
                          JOIN productos p ON p.codigo = dv.producto_codigo
                          WHERE dv.venta_id = v.id), 0)
         FROM ventas v
         WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.anulada = 0
         AND v.metodo_pago != ?3
         GROUP BY dia",
    ).map_err(|e| e.to_string())?;

    let ventas_rows: Vec<(String, f64, f64)> = ventas_stmt
        .query_map(params![start, end, constants::METODO_CREDITO], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut mov_stmt = db.prepare(
        "SELECT date(created_at) as dia,
                COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto_usd ELSE -monto_usd END), 0)
         FROM movimientos_caja
         WHERE date(created_at) >= ?1 AND date(created_at) < ?2
         GROUP BY dia",
    ).map_err(|e| e.to_string())?;

    let movimientos_rows: Vec<(String, f64)> = mov_stmt
        .query_map(params![start, end], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut por_dia: HashMap<String, crate::models::ProfitDataPoint> = HashMap::new();
    for (dia, revenue, cost) in ventas_rows {
        por_dia.insert(dia.clone(), crate::models::ProfitDataPoint {
            date: dia,
            revenue_usd: revenue,
            cost_usd: cost,
            profit_usd: revenue - cost,
            neto_movimientos_usd: 0.0,
        });
    }
    for (dia, neto) in movimientos_rows {
        let entry = por_dia.entry(dia.clone()).or_insert_with(|| crate::models::ProfitDataPoint {
            date: dia,
            revenue_usd: 0.0,
            cost_usd: 0.0,
            profit_usd: 0.0,
            neto_movimientos_usd: 0.0,
        });
        entry.neto_movimientos_usd = neto;
        entry.profit_usd = entry.revenue_usd - entry.cost_usd + neto;
    }

    let mut points: Vec<crate::models::ProfitDataPoint> = por_dia.into_values().collect();
    points.sort_by(|a, b| a.date.cmp(&b.date));

    Ok(points)
}

/* ========== MOVIMIENTOS CAJA ========== */
const SQL_INSERT_MOVIMIENTO: &str =
    "INSERT INTO movimientos_caja (tipo, monto_bs, monto_usd, concepto, usuario_id, username) VALUES (?1, ?2, ?3, ?4, ?5, ?6)";
const SQL_LIST_MOVIMIENTOS: &str =
    "SELECT id, tipo, monto_bs, monto_usd, concepto, usuario_id, username, created_at \
     FROM movimientos_caja WHERE date(created_at) = date('now','localtime') ORDER BY id DESC";

#[tauri::command]
pub fn register_movimiento(state: State<AppState>, tipo: String, monto_bs: f64, monto_usd: f64, concepto: String) -> Result<MovimientoCaja, String> {
    // Autoría desde la sesión (no acepta usuario_id/username del frontend).
    let usuario = state.get_employee()?;
    if tipo != "ingreso" && tipo != "egreso" {
        return Err("Tipo de movimiento inválido".to_string());
    }
    if !monto_bs.is_finite() || !monto_usd.is_finite() {
        return Err("Los montos no pueden ser NaN o infinitos".to_string());
    }
    if monto_bs <= 0.0 && monto_usd <= 0.0 {
        return Err("El monto debe ser mayor a cero".to_string());
    }
    if monto_bs < 0.0 || monto_usd < 0.0 {
        return Err("Los montos no pueden ser negativos".to_string());
    }
    if concepto.trim().is_empty() {
        return Err("Debe escribir un concepto".to_string());
    }
    let db = state.lock_db()?;
    db.execute(
        SQL_INSERT_MOVIMIENTO,
        params![tipo, monto_bs, monto_usd, concepto.trim(), usuario.id, usuario.username],
    )
    .map_err(|e| format!("Error al registrar movimiento: {}", e))?;
    let id = db.last_insert_rowid();
    Ok(MovimientoCaja { id, tipo, monto_bs, monto_usd, concepto, usuario_id: usuario.id, username: usuario.username, created_at: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string() })
}

#[tauri::command]
pub fn list_movimientos(state: State<AppState>) -> Result<Vec<MovimientoCaja>, String> {
    let db = state.lock_db()?;
    let mut stmt = db.prepare(SQL_LIST_MOVIMIENTOS).map_err(|e| format!("Error al listar movimientos: {}", e))?;
    let rows = stmt.query_map([], |row| {
        Ok(MovimientoCaja {
            id: row.get(0)?,
            tipo: row.get(1)?,
            monto_bs: row.get(2)?,
            monto_usd: row.get(3)?,
            concepto: row.get(4)?,
            usuario_id: row.get(5)?,
            username: row.get(6)?,
            created_at: row.get(7)?,
        })
    }).map_err(|e| format!("Error al leer movimientos: {}", e))?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| format!("Error en fila: {}", e))?);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_saldo_caja(state: State<AppState>) -> Result<SaldoCaja, String> {
    let db = state.lock_db()?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tomorrow = crate::helpers::siguiente_dia(&today);
    let (ventas_usd, ventas_bs): (f64, f64) = db
        .query_row("SELECT COALESCE(SUM(total_usd),0), \
                           COALESCE(SUM(CASE WHEN total_bs > 0 THEN total_bs ELSE total_usd * tasa_aplicada END),0) \
                    FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0 \
                    AND metodo_pago != ?3",
            params![today, tomorrow, constants::METODO_CREDITO], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("Error al obtener ventas: {}", e))?;
    let tasa = crate::db::get_tasa_from_db(&db).unwrap_or(0.0);
    // Valor USD canónico del movimiento = monto_usd (o monto_bs/tasa si es 0).
    // No se suma monto_bs/tasa además de monto_usd: el frontend guarda ambas
    // representaciones del mismo movimiento y sumarlas contaría doble.
    let neto_usd: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN CASE WHEN monto_usd > 0 THEN monto_usd ELSE monto_bs / ?1 END ELSE -CASE WHEN monto_usd > 0 THEN monto_usd ELSE monto_bs / ?1 END END), 0) \
             FROM movimientos_caja WHERE date(created_at) = date('now','localtime')",
            params![tasa],
            |row| Ok(row.get(0)?),
        )
        .map_err(|e| format!("Error al obtener movimientos: {}", e))?;
    let neto_bs: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto_bs ELSE -monto_bs END), 0) \
             FROM movimientos_caja WHERE date(created_at) = date('now','localtime')",
            [],
            |row| Ok(row.get(0)?),
        )
        .map_err(|e| format!("Error al obtener movimientos: {}", e))?;
    let (saldo_usd, saldo_bs) = if tasa > 0.0 {
        let usd = ventas_usd + neto_usd;
        (usd, usd * tasa)
    } else {
        (ventas_usd + neto_usd, ventas_bs + neto_bs)
    };
    let (ingresos_usd, egresos_usd): (f64, f64) = db
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto_usd ELSE 0 END), 0), \
                     COALESCE(SUM(CASE WHEN tipo='egreso' THEN monto_usd ELSE 0 END), 0) \
              FROM movimientos_caja WHERE date(created_at) = date('now','localtime')",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Error al obtener movimientos: {}", e))?;
    Ok(SaldoCaja { saldo_usd, saldo_bs, total_ventas_usd: ventas_usd, total_ventas_bs: ventas_bs, total_ingresos_usd: ingresos_usd, total_egresos_usd: egresos_usd })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_group_payments_empty() {
        let rows: Vec<(String, Option<String>, f64, Option<String>)> = vec![];
        let result = group_payments_by_method(&rows);
        assert!(result.is_empty());
    }

    #[test]
    fn test_sumar_movimientos_rango_neto_usd_y_bs() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, "tasa_dolar", "10.0").unwrap();
        conn.execute_batch(
            "INSERT INTO movimientos_caja (tipo, monto_bs, monto_usd, concepto, usuario_id, username, created_at) VALUES \
             ('ingreso', 100.0, 10.0, 'abono', 1, 'admin', '2026-08-06 10:00:00'), \
             ('egreso', 50.0, 5.0, 'gasto', 1, 'admin', '2026-08-06 12:00:00'), \
             ('ingreso', 200.0, 0.0, 'solo bs', 1, 'admin', '2026-08-06 14:00:00'), \
             ('egreso', 30.0, 0.0, 'solo bs', 1, 'admin', '2026-08-07 10:00:00');",
        )
        .unwrap();
        let (neto_usd, neto_bs) = sumar_movimientos_rango(&conn, "2026-08-06", "2026-08-07").unwrap();
        // El egreso de 2026-08-07 queda fuera del rango. Movimientos incluidos:
        // ingreso(100,10), egreso(50,5), ingreso(200,0).
        // Valor USD canónico = monto_usd; el "solo bs" se convierte con la tasa (200/10=20).
        // neto_usd = 10 - 5 + 20 = 25 ; neto_bs = 100 + 200 - 50 = 250
        assert!((neto_usd - 25.0).abs() < 1e-6);
        assert!((neto_bs - 250.0).abs() < 1e-6);
    }

    #[test]
    fn test_sumar_movimientos_rango_vacio() {
        let conn = crate::db::test_support::test_conn();
        let (neto_usd, neto_bs) = sumar_movimientos_rango(&conn, "2026-08-06", "2026-08-07").unwrap();
        assert!((neto_usd - 0.0).abs() < 1e-9);
        assert!((neto_bs - 0.0).abs() < 1e-9);
    }

    #[test]
    fn test_sumar_movimientos_no_cuenta_doble_mismo_movimiento() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, "tasa_dolar", "10.0").unwrap();
        // El frontend guarda un mismo egreso con ambas representaciones (Bs y USD).
        conn.execute_batch(
            "INSERT INTO movimientos_caja (tipo, monto_bs, monto_usd, concepto, usuario_id, username, created_at) VALUES \
             ('egreso', 5000.0, 500.0, 'cambio', 1, 'admin', date('now','localtime'));",
        ).unwrap();
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        let tomorrow = crate::helpers::siguiente_dia(&today);
        let (neto_usd, neto_bs) = sumar_movimientos_rango(&conn, &today, &tomorrow).unwrap();
        // No debe restar 1000 USD (500 + 5000/10), sino solo 500 USD.
        assert!((neto_usd + 500.0).abs() < 1e-6);
        assert!((neto_bs + 5000.0).abs() < 1e-6);
    }

    #[test]
    fn test_saldo_caja_excluye_credito() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, "tasa_dolar", "10.0").unwrap();
        conn.execute_batch(
            "INSERT INTO ventas (fecha_hora, usuario_id, total_usd, total_bs, metodo_pago, tasa_aplicada, anulada, sync_id, dispositivo_origen, updated_at) VALUES \
             ('2026-08-06 09:00:00', 1, 100.0, 1000.0, 'efectivo_usd', 10.0, 0, 'a', 'local', '2026-08-06T09:00:00Z'), \
             ('2026-08-06 10:00:00', 1, 50.0, 500.0, 'credito', 10.0, 0, 'b', 'local', '2026-08-06T10:00:00Z'), \
             ('2026-08-06 11:00:00', 1, 30.0, 300.0, 'punto', 10.0, 0, 'c', 'local', '2026-08-06T11:00:00Z');",
        )
        .unwrap();
        let today = "2026-08-06".to_string();
        let tomorrow = crate::helpers::siguiente_dia(&today);
        let (ventas_usd, _): (f64, f64) = conn
            .query_row(
                "SELECT COALESCE(SUM(total_usd),0), COALESCE(SUM(total_bs),0) \
                 FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0 \
                 AND metodo_pago != ?3",
                params![today, tomorrow, constants::METODO_CREDITO],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert!((ventas_usd - 130.0).abs() < 1e-6);
    }

    #[test]
    fn test_sumar_ventas_rango_excluye_credito() {
        let conn = crate::db::test_support::test_conn();
        conn.execute_batch(
            "INSERT INTO ventas (fecha_hora, usuario_id, total_usd, total_bs, metodo_pago, tasa_aplicada, anulada, sync_id, dispositivo_origen, updated_at) VALUES \
             ('2026-08-06 09:00:00', 1, 100.0, 1000.0, 'efectivo_usd', 10.0, 0, 'a', 'local', '2026-08-06T09:00:00Z'), \
             ('2026-08-06 10:00:00', 1, 50.0, 500.0, 'credito', 10.0, 0, 'b', 'local', '2026-08-06T10:00:00Z'), \
             ('2026-08-06 11:00:00', 1, 30.0, 300.0, 'punto', 10.0, 0, 'c', 'local', '2026-08-06T11:00:00Z');",
        ).unwrap();
        let today = "2026-08-06".to_string();
        let tomorrow = crate::helpers::siguiente_dia(&today);
        let (cnt, usd, bs) = sumar_ventas_rango(&conn, &today, &tomorrow, constants::METODO_CREDITO).unwrap();
        // El crédito ($50) se excluye: 100 + 30 = 130, 2 ventas.
        assert_eq!(cnt, 2);
        assert!((usd - 130.0).abs() < 1e-6);
        assert!((bs - 1300.0).abs() < 1e-6);
    }

    #[test]
    fn test_daily_summary_abonos() {
        let conn = crate::db::test_support::test_conn();
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        conn.execute_batch(
            &format!(
                "INSERT INTO clientes (nombre, saldo_deuda_usd) VALUES ('Cli A', 20.0); \
                 INSERT INTO movimientos_caja (tipo, monto_bs, monto_usd, concepto, usuario_id, username, cliente_id, created_at) VALUES \
                 ('ingreso', 250.0, 25.0, 'Abono deuda - Cliente #1 - Crédito (efectivo_bs)', 1, 'admin', 1, '{0} 10:00:00'), \
                 ('egreso', 10.0, 1.0, 'gasto', 1, 'admin', NULL, '{0} 11:00:00');",
                today
            ),
        ).unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT m.id, m.usuario_id, COALESCE(m.cliente_id, 0), COALESCE(c.nombre, ''), \
                        m.monto_usd, m.monto_bs, m.concepto, m.created_at \
                 FROM movimientos_caja m LEFT JOIN clientes c ON m.cliente_id = c.id \
                 WHERE m.tipo = 'ingreso' AND m.concepto LIKE 'Abono%' \
                   AND date(m.created_at) = date('now','localtime') \
                 ORDER BY m.id DESC",
            )
            .unwrap();
        let abonos: Vec<AbonoRow> = stmt
            .query_map([], |row| {
                Ok(AbonoRow {
                    id: row.get(0)?,
                    cliente_id: row.get(2)?,
                    cliente_nombre: row.get(3)?,
                    monto_usd: row.get(4)?,
                    monto_bs: row.get(5)?,
                    metodo_pago: String::new(),
                    concepto: row.get(6)?,
                    fecha_hora: row.get(7)?,
                })
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(abonos.len(), 1);
        assert!((abonos[0].monto_usd - 25.0).abs() < 1e-6);
        assert_eq!(abonos[0].cliente_nombre, "Cli A");
    }

    #[test]
    fn test_group_payments_single_usd() {
        let rows = vec![("efectivo_usd".into(), None, 50.0, None)];
        let result = group_payments_by_method(&rows);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].metodo, "efectivo_usd");
        assert!((result[0].total_usd - 50.0).abs() < f64::EPSILON);
        assert!(result[0].referencias.is_empty());
    }

    #[test]
    fn test_group_payments_mixto() {
        let detalle = r#"[{"metodo":"efectivo_usd","monto_usd":30.0,"referencia":null},{"metodo":"punto","monto_usd":20.0,"referencia":"ref123"}]"#;
        let rows = vec![("mixto".into(), Some(detalle.into()), 50.0, None)];
        let result = group_payments_by_method(&rows);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].metodo, "efectivo_usd");
        assert!((result[0].total_usd - 30.0).abs() < f64::EPSILON);
        assert_eq!(result[1].metodo, "punto");
        assert!((result[1].total_usd - 20.0).abs() < f64::EPSILON);
        assert_eq!(result[1].referencias, vec!["ref123"]);
    }

    #[test]
    fn test_group_payments_pago_movil_dedup() {
        let rows = vec![
            ("pago_movil".into(), None, 100.0, Some("ABC1".into())),
            ("pago_movil".into(), None, 50.0, Some("ABC1".into())),
            ("pago_movil".into(), None, 30.0, Some("XYZ2".into())),
        ];
        let result = group_payments_by_method(&rows);
        assert_eq!(result.len(), 1);
        assert!((result[0].total_usd - 180.0).abs() < f64::EPSILON);
        assert_eq!(result[0].referencias.len(), 2);
        assert!(result[0].referencias.contains(&"ABC1".to_string()));
        assert!(result[0].referencias.contains(&"XYZ2".to_string()));
    }

    #[test]
    fn test_group_payments_sort_descending() {
        let rows = vec![
            ("efectivo_usd".into(), None, 10.0, None),
            ("punto".into(), None, 50.0, None),
            ("biopago".into(), None, 30.0, None),
        ];
        let result = group_payments_by_method(&rows);
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].metodo, "punto");
        assert_eq!(result[1].metodo, "biopago");
        assert_eq!(result[2].metodo, "efectivo_usd");
    }

    #[test]
    fn test_group_payments_mixto_malformed_json() {
        let detalle = "esto no es json";
        let rows = vec![("mixto".into(), Some(detalle.into()), 50.0, None)];
        let result = group_payments_by_method(&rows);
        assert!(result.is_empty());
    }

    #[test]
    fn test_group_payments_mixed_direct_and_mixto() {
        let detalle = r#"[{"metodo":"punto","monto_usd":20.0,"referencia":null}]"#;
        let rows = vec![
            ("efectivo_usd".into(), None, 30.0, None),
            ("mixto".into(), Some(detalle.into()), 20.0, None),
        ];
        let result = group_payments_by_method(&rows);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].metodo, "efectivo_usd");
        assert!((result[0].total_usd - 30.0).abs() < f64::EPSILON);
        assert_eq!(result[1].metodo, "punto");
        assert!((result[1].total_usd - 20.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_pendiente_cierre_detecta_dia_sin_cierre() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, constants::CFG_CAJA_ABIERTA, "true").unwrap();
        conn.execute_batch(
            "INSERT INTO ventas (fecha_hora, usuario_id, total_usd, total_bs, metodo_pago, tasa_aplicada, anulada, sync_id, dispositivo_origen, updated_at) VALUES \
             ('2026-01-01 10:00:00', 1, 100.0, 1000.0, 'efectivo_usd', 10.0, 0, 'a', 'local', '2026-01-01T10:00:00Z'), \
             ('2026-01-02 09:30:00', 1, 50.0, 500.0, 'efectivo_usd', 10.0, 0, 'b', 'local', '2026-01-02T09:30:00Z');",
        )
        .unwrap();
        let p = detectar_pendiente_cierre(&conn).unwrap();
        let p = p.expect("debe detectar un cierre pendiente");
        // Sin cierres registrados, los dos días con ventas quedan pendientes.
        assert_eq!(p.desde, "2026-01-01");
        assert_eq!(p.hasta, "2026-01-02");
        assert_eq!(p.dias.len(), 2);
        assert_eq!(p.total_ventas, 2);
        assert!((p.total_usd - 150.0).abs() < 1e-6);
    }

    #[test]
    fn test_pendiente_cierre_caja_cerrada_no_detecta() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, constants::CFG_CAJA_ABIERTA, "false").unwrap();
        conn.execute_batch(
            "INSERT INTO ventas (fecha_hora, usuario_id, total_usd, total_bs, metodo_pago, tasa_aplicada, anulada, sync_id, dispositivo_origen, updated_at) VALUES \
             ('2026-01-01 10:00:00', 1, 100.0, 1000.0, 'efectivo_usd', 10.0, 0, 'a', 'local', '2026-01-01T10:00:00Z');",
        )
        .unwrap();
        let p = detectar_pendiente_cierre(&conn).unwrap();
        assert!(p.is_none());
    }

    #[test]
    fn test_pendiente_cierre_ignora_dia_ya_cerrado() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, constants::CFG_CAJA_ABIERTA, "true").unwrap();
        conn.execute_batch(
            "INSERT INTO ventas (fecha_hora, usuario_id, total_usd, total_bs, metodo_pago, tasa_aplicada, anulada, sync_id, dispositivo_origen, updated_at) VALUES \
             ('2026-01-01 10:00:00', 1, 100.0, 1000.0, 'efectivo_usd', 10.0, 0, 'a', 'local', '2026-01-01T10:00:00Z'); \
             INSERT INTO cierres_caja (fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre) \
             VALUES ('2026-01-01 18:00:00', 1, 1, 100.0, 1000.0, 10.0);",
        )
        .unwrap();
        let p = detectar_pendiente_cierre(&conn).unwrap();
        assert!(p.is_none());
    }

    #[test]
    fn test_pendiente_cierre_cierre_rango_cubre_varios_dias() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, constants::CFG_CAJA_ABIERTA, "true").unwrap();
        conn.execute_batch(
            "INSERT INTO ventas (fecha_hora, usuario_id, total_usd, total_bs, metodo_pago, tasa_aplicada, anulada, sync_id, dispositivo_origen, updated_at) VALUES \
             ('2026-01-01 10:00:00', 1, 100.0, 1000.0, 'efectivo_usd', 10.0, 0, 'a', 'local', '2026-01-01T10:00:00Z'), \
             ('2026-01-02 09:30:00', 1, 50.0, 500.0, 'efectivo_usd', 10.0, 0, 'b', 'local', '2026-01-02T09:30:00Z'), \
             ('2026-01-03 11:00:00', 1, 20.0, 200.0, 'efectivo_usd', 10.0, 0, 'c', 'local', '2026-01-03T11:00:00Z'); \
             INSERT INTO cierres_caja (fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre, desde, hasta) \
             VALUES ('2026-01-03 18:00:00', 1, 3, 170.0, 1700.0, 10.0, '2026-01-01', '2026-01-02');",
        )
        .unwrap();
        let p = detectar_pendiente_cierre(&conn).unwrap();
        let p = p.expect("el día 03 sigue pendiente (el cierre multi-día cubrió 01 y 02)");
        assert_eq!(p.desde, "2026-01-03");
        assert_eq!(p.hasta, "2026-01-03");
        assert_eq!(p.dias.len(), 1);
        assert_eq!(p.total_ventas, 1);
    }

    #[test]
    fn test_pendiente_cierre_ignora_ventas_anuladas() {
        let conn = crate::db::test_support::test_conn();
        crate::db::set_config_value(&conn, constants::CFG_CAJA_ABIERTA, "true").unwrap();
        conn.execute_batch(
            "INSERT INTO ventas (fecha_hora, usuario_id, total_usd, total_bs, metodo_pago, tasa_aplicada, anulada, sync_id, dispositivo_origen, updated_at) VALUES \
             ('2026-01-01 10:00:00', 1, 100.0, 1000.0, 'efectivo_usd', 10.0, 1, 'a', 'local', '2026-01-01T10:00:00Z');",
        )
        .unwrap();
        let p = detectar_pendiente_cierre(&conn).unwrap();
        assert!(p.is_none());
    }
}

