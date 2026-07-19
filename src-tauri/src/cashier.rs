use crate::constants;
use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;

const SQL_COUNT_VENTAS_RANGE: &str =
    "SELECT COUNT(*) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0";
const SQL_SUM_VENTAS_RANGE: &str =
    "SELECT COALESCE(SUM(total_usd), 0) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0";
const SQL_SUM_BS_RANGE: &str =
    "SELECT COALESCE(SUM(total_bs), 0) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0";
const SQL_VENTAS_RANGE: &str = "
    SELECT metodo_pago, pago_detalle, total_usd, referencia_pago_movil
    FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2 AND anulada = 0";
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
const SQL_CAJA_ABIERTA: &str =
    "SELECT valor FROM configuracion WHERE clave = 'caja_abierta'";
const SQL_SET_CAJA: &str = "UPDATE configuracion SET valor = ?1 WHERE clave = 'caja_abierta'";
const SQL_INSERT_CIERRE: &str = "
    INSERT INTO cierres_caja (fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)";
const SQL_INSERT_CIERRE_DETALLE: &str =
    "INSERT INTO cierres_detalle (cierre_id, detalle_json) VALUES (?1, ?2)";
const SQL_LIST_CIERRES: &str = "
    SELECT c.id, c.fecha_hora, u.username, c.total_ventas, c.total_usd, c.total_bs, c.tasa_cierre
    FROM cierres_caja c
    LEFT JOIN usuarios u ON c.usuario_id = u.id
    ORDER BY c.id DESC";
const SQL_CIERRE_BY_ID: &str = "
    SELECT fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre
    FROM cierres_caja WHERE id = ?1";
const SQL_DETALLE_JSON: &str =
    "SELECT detalle_json FROM cierres_detalle WHERE cierre_id = ?1";
const SQL_LIST_DIARIAS: &str = "
    SELECT v.id, v.fecha_hora, v.usuario_id, u.username, v.metodo_pago, v.referencia_pago_movil,
           v.pago_detalle, v.cliente_id, c.nombre, v.total_usd, v.tasa_aplicada, v.total_bs, v.anulada,
           v.sync_id, v.dispositivo_origen
    FROM ventas v
    LEFT JOIN usuarios u ON v.usuario_id = u.id
    LEFT JOIN clientes c ON v.cliente_id = c.id
    WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2
    ORDER BY v.id DESC";

fn obtener_totales_del_dia(
    db: &rusqlite::Connection,
    today: &str,
    tomorrow: &str,
) -> Result<(i64, f64, f64, f64), String> {
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

    let bs: f64 = db
        .query_row(SQL_SUM_BS_RANGE, params![today, tomorrow], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Error al sumar Bs. del día: {}", e))?;

    let tasa: f64 = db
        .query_row(crate::constants::SQL_TASA, [], |row| row.get(0))
        .map_err(|e| format!("Error al obtener tasa del día: {}", e))?;

    Ok((cnt, usd, bs, tasa))
}

fn obtener_tasa(db: &rusqlite::Connection) -> f64 {
    crate::db::get_tasa_from_db(db).unwrap_or(0.0)
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
        .query_map(params![start, end], |row| {
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
    })
}

#[tauri::command]
pub fn get_daily_summary(state: State<AppState>) -> Result<DailySummary, String> {
    let db = state.lock_db()?;

    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let tomorrow = crate::helpers::siguiente_dia(&today);
    let tasa = obtener_tasa(&db);

    let (total_ventas, total_usd, total_bs, _) = obtener_totales_del_dia(&db, &today, &tomorrow)?;

    let mut stmt = db.prepare(SQL_LIST_DIARIAS).map_err(|e| e.to_string())?;

    let ventas: Vec<Venta> = stmt
        .query_map(params![today, tomorrow], crate::sales::row_to_venta)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(DailySummary {
        total_ventas,
        total_usd,
        total_bs,
        ventas,
        tasa_actual: tasa,
    })
}

#[tauri::command]
pub fn abrir_caja(state: State<AppState>) -> Result<String, String> {
    let username = state.get_username().unwrap_or_default();
    let db = state.lock_db()?;
    db.execute(SQL_SET_CAJA, params!["true"])
        .map_err(|e| e.to_string())?;

    crate::audit::log_action(&db, &username, "Caja abierta").ok();

    Ok("Caja abierta exitosamente".to_string())
}

#[tauri::command]
pub fn get_caja_abierta(state: State<AppState>) -> Result<bool, String> {
    let db = state.lock_db()?;
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
            Some(u) => (u.username.clone(), u.id),
            None => (String::new(), 0),
        }
    };

    let mut db = state.lock_db()?;

    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let tomorrow = crate::helpers::siguiente_dia(&today);
    let now = crate::helpers::fecha_hora_local();

    let tx = db
        .transaction()
        .map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let caja_abierta: String = tx
        .query_row(SQL_CAJA_ABIERTA, [], |row| row.get(0))
        .unwrap_or_else(|_| "false".to_string());
    if caja_abierta != "true" {
        return Err("La caja no está abierta. Ábrela primero.".to_string());
    }

    let (total_ventas, total_usd, total_bs, tasa) = obtener_totales_del_dia(&tx, &today, &tomorrow)?;

    let report_data = compute_report_data_range(&tx, &today, &tomorrow, &now)?;
    let detalle_json =
        serde_json::to_string(&report_data).map_err(|e| format!("Error al serializar reporte: {}", e))?;

    tx.execute(
        SQL_INSERT_CIERRE,
        params![now, user_id, total_ventas, total_usd, total_bs, tasa],
    )
    .map_err(|e| e.to_string())?;

    let cierre_id = tx.last_insert_rowid();
    tx.execute(SQL_INSERT_CIERRE_DETALLE, params![cierre_id, detalle_json])
        .map_err(|e| format!("Error al guardar detalle del cierre: {}", e))?;

    tx.execute(SQL_SET_CAJA, params!["false"])
        .map_err(|e| format!("Error al cerrar caja: {}", e))?;

    let accion = format!(
        "Cierre de caja - Ventas: {}, Total USD: ${:.2}, Total Bs.: Bs. {:.2}",
        total_ventas, total_usd, total_bs
    );
    crate::audit::log_action(&tx, &username, &accion).ok();

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
    let db = state.lock_db()?;
    let today = chrono::Local::now()
        .format("%Y-%m-%d")
        .to_string();
    let tomorrow = crate::helpers::siguiente_dia(&today);
    let now = crate::helpers::fecha_hora_local();
    compute_report_data_range(&db, &today, &tomorrow, &now)
}

#[tauri::command]
pub fn list_cierres(state: State<AppState>) -> Result<Vec<CierreListItem>, String> {
    let db = state.lock_db()?;
    let mut stmt = db
        .prepare(SQL_LIST_CIERRES)
        .map_err(|e| e.to_string())?;

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
                total_bs: if bs > 0.0 { bs } else { row.get::<_, f64>(4)? * tasa_cierre },
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
    let db = state.lock_db()?;

    let (fecha_hora, usuario_id, total_ventas, total_usd, total_bs, tasa_cierre): (
        String,
        i64,
        i64,
        f64,
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
                row.get(5)?,
            ))
        })
        .map_err(|_| "Cierre no encontrado".to_string())?;

    let username: String = db
        .query_row(crate::constants::SQL_USERNAME_BY_ID, params![usuario_id], |row| row.get(0))
        .unwrap_or_default();

    let total_bs = if total_bs > 0.0 { total_bs } else { total_usd * tasa_cierre };

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

#[tauri::command]
pub fn get_dashboard_payment_methods(state: State<AppState>, period: String) -> Result<Vec<MetodoTotal>, String> {
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
    Ok(data.por_metodo)
}

#[tauri::command]
pub fn get_dashboard_summary(state: State<AppState>) -> Result<DashboardSummary, String> {
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
        let cnt: i64 = db
            .query_row(SQL_COUNT_VENTAS_RANGE, params![start, end], |row| row.get(0))
            .map_err(|e| format!("Error al contar: {}", e))?;
        let usd: f64 = db
            .query_row(SQL_SUM_VENTAS_RANGE, params![start, end], |row| row.get(0))
            .map_err(|e| format!("Error al sumar USD: {}", e))?;
        let bs: f64 = db
            .query_row(SQL_SUM_BS_RANGE, params![start, end], |row| row.get(0))
            .map_err(|e| format!("Error al sumar Bs: {}", e))?;
        Ok(DashboardPeriod { total_ventas: cnt, total_usd: usd, total_bs: bs })
    }

    Ok(DashboardSummary {
        today: period(&db, &today, &tomorrow)?,
        week: period(&db, &week_ago, &after_week)?,
        month: period(&db, &month_start, &after_month)?,
    })
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
}

