use crate::constants;
use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;

const SQL_COUNT_VENTAS_RANGE: &str =
    "SELECT COUNT(*) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2";
const SQL_SUM_VENTAS_RANGE: &str =
    "SELECT COALESCE(SUM(total_usd), 0) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2";
const SQL_VENTAS_RANGE: &str = "
    SELECT metodo_pago, pago_detalle, total_usd, referencia_pago_movil
    FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2";
const SQL_PRODUCTOS_VENDIDOS: &str = "
    SELECT p.nombre, SUM(dv.cantidad), SUM(dv.cantidad * dv.precio_usd_unitario)
    FROM detalles_ventas dv
    JOIN productos p ON dv.producto_codigo = p.codigo
    JOIN ventas v ON dv.venta_id = v.id
    WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2
    GROUP BY p.nombre
    ORDER BY SUM(dv.cantidad * dv.precio_usd_unitario) DESC";
const SQL_CLIENTES_CREDITO: &str = "
    SELECT c.nombre, COALESCE(SUM(v.total_usd), 0)
    FROM clientes c
    JOIN ventas v ON v.cliente_id = c.id
    WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.metodo_pago = ?3
    GROUP BY c.id
    ORDER BY c.nombre";
const SQL_CAJA_ABIERTA: &str =
    "SELECT valor FROM configuracion WHERE clave = 'caja_abierta'";
const SQL_SET_CAJA: &str = "UPDATE configuracion SET valor = ?1 WHERE clave = 'caja_abierta'";
const SQL_INSERT_CIERRE: &str = "
    INSERT INTO cierres_caja (fecha_hora, usuario_id, total_ventas, total_usd, tasa_cierre)
    VALUES (?1, ?2, ?3, ?4, ?5)";
const SQL_INSERT_CIERRE_DETALLE: &str =
    "INSERT INTO cierres_detalle (cierre_id, detalle_json) VALUES (?1, ?2)";
const SQL_LIST_CIERRES: &str = "
    SELECT c.id, c.fecha_hora, u.username, c.total_ventas, c.total_usd, c.tasa_cierre
    FROM cierres_caja c
    LEFT JOIN usuarios u ON c.usuario_id = u.id
    ORDER BY c.id DESC";
const SQL_CIERRE_BY_ID: &str = "
    SELECT fecha_hora, usuario_id, total_ventas, total_usd, tasa_cierre
    FROM cierres_caja WHERE id = ?1";
const SQL_DETALLE_JSON: &str =
    "SELECT detalle_json FROM cierres_detalle WHERE cierre_id = ?1";
const SQL_LIST_DIARIAS: &str = "
    SELECT v.id, v.fecha_hora, v.usuario_id, u.username, v.metodo_pago, v.referencia_pago_movil,
           v.pago_detalle, v.cliente_id, c.nombre, v.total_usd, v.tasa_aplicada
    FROM ventas v
    LEFT JOIN usuarios u ON v.usuario_id = u.id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2
    ORDER BY v.id DESC";

fn siguiente_dia(fecha: &str) -> String {
    let parsed = chrono::NaiveDate::parse_from_str(fecha, "%Y-%m-%d").ok();
    match parsed {
        Some(d) => {
            let next = d + chrono::Duration::days(1);
            next.format("%Y-%m-%d").to_string()
        }
        None => constants::FECHA_MAXIMA.to_string(),
    }
}

fn obtener_totales_del_dia(
    db: &rusqlite::Connection,
    today: &str,
    tomorrow: &str,
) -> Result<(i64, f64, f64), String> {
    let cnt: i64 = db
        .query_row(SQL_COUNT_VENTAS_RANGE, params![today, tomorrow], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Error al contar ventas del día: {}", e))?;

    let usd: f64 = db
        .query_row(SQL_SUM_VENTAS_RANGE, params![today, tomorrow], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Error al sumar ventas del día: {}", e))?;

    let tasa: f64 = db
        .query_row(crate::constants::SQL_TASA, [], |row| row.get(0))
        .map_err(|e| format!("Error al obtener tasa del día: {}", e))?;

    Ok((cnt, usd, tasa))
}

fn obtener_tasa(db: &rusqlite::Connection) -> f64 {
    crate::db::get_tasa_from_db(db).unwrap_or(0.0)
}

fn compute_report_data_range(
    db: &rusqlite::Connection,
    start: &str,
    end: &str,
    now: &str,
) -> Result<CloseReportData, String> {
    let (total_ventas, total_usd, tasa) = obtener_totales_del_dia(db, start, end)?;
    let total_bs = total_usd * tasa;

    let mut stmt = db.prepare(SQL_VENTAS_RANGE).map_err(|e| e.to_string())?;

    let rows: Vec<(String, Option<String>, f64, Option<String>)> = stmt
        .query_map(params![start, end], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut por_metodo: HashMap<String, (f64, Vec<String>)> = HashMap::new();
    for (metodo, detalle, monto, ref_movil) in &rows {
        if metodo == "mixto" {
            if let Some(json) = detalle {
                if let Ok(items) = serde_json::from_str::<Vec<PagoItem>>(json) {
                    for item in items {
                        let entry = por_metodo
                            .entry(item.metodo.clone())
                            .or_insert((0.0, Vec::new()));
                        entry.0 += item.monto_usd;
                        if let Some(ref r) = item.referencia {
                            if !entry.1.contains(r) {
                                entry.1.push(r.clone());
                            }
                        }
                    }
                }
            }
        } else {
            let entry = por_metodo
                .entry(metodo.clone())
                .or_insert((0.0, Vec::new()));
            entry.0 += monto;
            if metodo == constants::METODO_PAGO_MOVIL {
                if let Some(ref r) = ref_movil {
                    if !entry.1.contains(r) {
                        entry.1.push(r.clone());
                    }
                }
            }
        }
    }
    let mut por_metodo: Vec<MetodoTotal> = por_metodo
        .into_iter()
        .map(|(metodo, (total_usd, referencias))| MetodoTotal {
            metodo,
            total_usd,
            referencias,
        })
        .collect();
    por_metodo.sort_by(|a, b| b.total_usd.partial_cmp(&a.total_usd).unwrap_or(std::cmp::Ordering::Equal));

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
    })
}

#[tauri::command]
pub fn get_daily_summary(state: State<AppState>) -> Result<DailySummary, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;

    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let tomorrow = siguiente_dia(&today);
    let tasa = obtener_tasa(&db);

    let (total_ventas, total_usd, _) = obtener_totales_del_dia(&db, &today, &tomorrow)?;

    let mut stmt = db.prepare(SQL_LIST_DIARIAS).map_err(|e| e.to_string())?;

    let ventas: Vec<Venta> = stmt
        .query_map(params![today, tomorrow], |row| {
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

    Ok(DailySummary {
        total_ventas,
        total_usd,
        total_bs: total_usd * tasa,
        ventas,
        tasa_actual: tasa,
    })
}

#[tauri::command]
pub fn abrir_caja(state: State<AppState>) -> Result<String, String> {
    let username = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?
        .clone()
        .map(|u| u.username)
        .unwrap_or_default();
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    db.execute(SQL_SET_CAJA, params!["true"])
        .map_err(|e| e.to_string())?;

    crate::audit::log_action(&db, &username, "Caja abierta").ok();

    Ok("Caja abierta exitosamente".to_string())
}

#[tauri::command]
pub fn get_caja_abierta(state: State<AppState>) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let val: String = db
        .query_row(SQL_CAJA_ABIERTA, [], |row| row.get(0))
        .unwrap_or_else(|_| "false".to_string());
    Ok(val == "true")
}

#[tauri::command]
pub fn close_cashier(state: State<AppState>) -> Result<CloseReport, String> {
    let (username, user_id) = {
        let lock = state
            .current_user
            .lock()
            .map_err(|e| format!("Error interno: {}", e))?;
        match lock.as_ref() {
            Some(ref u) => (u.username.clone(), u.id),
            None => (String::new(), 0),
        }
    };

    let mut db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;

    let caja_abierta: String = db
        .query_row(SQL_CAJA_ABIERTA, [], |row| row.get(0))
        .unwrap_or_else(|_| "false".to_string());
    if caja_abierta != "true" {
        return Err("La caja no está abierta. Ábrela primero.".to_string());
    }

    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let tomorrow = siguiente_dia(&today);
    let now = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    let (total_ventas, total_usd, tasa) = obtener_totales_del_dia(&db, &today, &tomorrow)?;
    let total_bs = total_usd * tasa;

    let report_data = compute_report_data_range(&db, &today, &tomorrow, &now)?;
    let detalle_json =
        serde_json::to_string(&report_data).map_err(|e| format!("Error al serializar reporte: {}", e))?;

    let tx = db
        .transaction()
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    tx.execute(
        SQL_INSERT_CIERRE,
        params![now, user_id, total_ventas, total_usd, tasa],
    )
    .map_err(|e| e.to_string())?;

    let cierre_id = tx.last_insert_rowid();
    tx.execute(SQL_INSERT_CIERRE_DETALLE, params![cierre_id, detalle_json])
        .map_err(|e| format!("Error al guardar detalle del cierre: {}", e))?;

    tx.execute(SQL_SET_CAJA, params!["false"]).ok();

    let accion = format!(
        "Cierre de caja - Ventas: {}, Total USD: ${:.2}, Total Bs.: Bs. {:.2}",
        total_ventas, total_usd, total_bs
    );
    crate::audit::log_action(&*tx, &username, &accion).ok();

    tx.commit()
        .map_err(|e| format!("Error al confirmar cierre: {}", e))?;

    Ok(CloseReport {
        fecha_cierre: now,
        total_ventas,
        total_usd,
        total_bs,
        usuario: username,
        tasa_cierre: tasa,
    })
}

#[tauri::command]
pub fn get_close_report_data(state: State<AppState>) -> Result<CloseReportData, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let tomorrow = siguiente_dia(&today);
    let now = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    compute_report_data_range(&db, &today, &tomorrow, &now)
}

#[tauri::command]
pub fn list_cierres(state: State<AppState>) -> Result<Vec<CierreListItem>, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let mut stmt = db
        .prepare(SQL_LIST_CIERRES)
        .map_err(|e| e.to_string())?;

    let cierres: Vec<CierreListItem> = stmt
        .query_map([], |row| {
            let total_usd: f64 = row.get(4)?;
            let tasa_cierre: f64 = row.get(5)?;
            Ok(CierreListItem {
                id: row.get(0)?,
                fecha_hora: row.get(1)?,
                username: row.get(2)?,
                total_ventas: row.get(3)?,
                total_usd,
                total_bs: total_usd * tasa_cierre,
                tasa_cierre,
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
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;

    let (fecha_hora, usuario_id, total_ventas, total_usd, tasa_cierre): (
        String,
        i64,
        i64,
        f64,
        f64,
    ) = db
        .query_row(SQL_CIERRE_BY_ID, params![cierre_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })
        .map_err(|_| "Cierre no encontrado".to_string())?;

    let username: String = db
        .query_row(crate::constants::SQL_USERNAME_BY_ID, params![usuario_id], |row| row.get(0))
        .unwrap_or_default();

    let total_bs = total_usd * tasa_cierre;

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
        },
        detalle,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_siguiente_dia_normal() {
        assert_eq!(siguiente_dia("2024-01-15"), "2024-01-16");
    }

    #[test]
    fn test_siguiente_dia_fin_mes() {
        assert_eq!(siguiente_dia("2024-01-31"), "2024-02-01");
    }

    #[test]
    fn test_siguiente_dia_fin_anio() {
        assert_eq!(siguiente_dia("2024-12-31"), "2025-01-01");
    }

    #[test]
    fn test_siguiente_dia_invalido() {
        assert_eq!(siguiente_dia("invalid"), constants::FECHA_MAXIMA);
    }
}
