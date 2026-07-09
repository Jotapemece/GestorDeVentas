use crate::db::AppState;
use crate::models::*;
use rusqlite::params;
use std::collections::HashMap;
use tauri::State;

fn compute_report_data_range(db: &rusqlite::Connection, start: &str, end: &str, now: &str) -> Result<CloseReportData, String> {
    let total_ventas: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2",
            params![start, end],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_usd: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(total_usd), 0) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2",
            params![start, end],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let tasa: f64 = db
        .query_row(
            "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_bs = total_usd * tasa;

    let mut stmt = db
        .prepare(
            "SELECT metodo_pago, pago_detalle, total_usd FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, Option<String>, f64)> = stmt
        .query_map(params![start, end], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut por_metodo: HashMap<String, f64> = HashMap::new();
    for (metodo, detalle, monto) in &rows {
        if metodo == "mixto" {
            if let Some(json) = detalle {
                if let Ok(items) = serde_json::from_str::<Vec<PagoItem>>(json) {
                    for item in items {
                        *por_metodo.entry(item.metodo).or_insert(0.0) += item.monto_usd;
                    }
                }
            }
        } else {
            *por_metodo.entry(metodo.clone()).or_insert(0.0) += monto;
        }
    }
    let mut por_metodo: Vec<MetodoTotal> = por_metodo
        .into_iter()
        .map(|(metodo, total_usd)| MetodoTotal { metodo, total_usd })
        .collect();
    por_metodo.sort_by(|a, b| b.total_usd.partial_cmp(&a.total_usd).unwrap());

    let mut prod_stmt = db
        .prepare(
            "SELECT p.nombre, SUM(dv.cantidad), SUM(dv.cantidad * dv.precio_usd_unitario)
             FROM detalles_ventas dv
             JOIN productos p ON dv.producto_codigo = p.codigo
             JOIN ventas v ON dv.venta_id = v.id
             WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2
             GROUP BY p.nombre
             ORDER BY SUM(dv.cantidad * dv.precio_usd_unitario) DESC",
        )
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
        .prepare(
            "SELECT c.nombre, COALESCE(SUM(v.total_usd), 0)
             FROM clientes c
             JOIN ventas v ON v.cliente_id = c.id
             WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2 AND v.metodo_pago = 'credito'
             GROUP BY c.id
             ORDER BY c.nombre",
        )
        .map_err(|e| e.to_string())?;

    let clientes_credito: Vec<ClienteCreditoReporte> = cli_stmt
        .query_map(params![start, end], |row| {
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
        por_metodo,
        productos_vendidos,
        clientes_credito,
    })
}

#[tauri::command]
pub fn get_daily_summary(state: State<AppState>) -> Result<DailySummary, String> {
    let db = state.db.lock().unwrap();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tomorrow = match chrono::Local::now().checked_add_signed(chrono::Duration::days(1)) {
        Some(d) => d.format("%Y-%m-%d").to_string(),
        None => "9999-12-31".to_string(),
    };

    let total_ventas: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2",
            params![today, tomorrow],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_usd: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(total_usd), 0) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2",
            params![today, tomorrow],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let tasa: f64 = db
        .query_row(
            "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let mut stmt = db
        .prepare(
            "SELECT v.id, v.fecha_hora, v.usuario_id, u.username, v.metodo_pago, v.referencia_pago_movil, v.pago_detalle, v.cliente_id, c.nombre, v.total_usd, v.tasa_aplicada
             FROM ventas v
             LEFT JOIN usuarios u ON v.usuario_id = u.id
             LEFT JOIN clientes c ON v.cliente_id = c.id
             WHERE v.fecha_hora >= ?1 AND v.fecha_hora < ?2
             ORDER BY v.id DESC",
        )
        .map_err(|e| e.to_string())?;

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
    let username = state.current_user.lock().unwrap().clone().map(|u| u.username).unwrap_or_default();
    let db = state.db.lock().unwrap();
    db.execute(
        "UPDATE configuracion SET valor = 'true' WHERE clave = 'caja_abierta'",
        [],
    )
    .map_err(|e| e.to_string())?;

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    db.execute(
        "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)",
        params![now, username, "Caja abierta"],
    )
    .ok();

    Ok("Caja abierta exitosamente".to_string())
}

#[tauri::command]
pub fn get_caja_abierta(state: State<AppState>) -> Result<bool, String> {
    let db = state.db.lock().unwrap();
    let val: String = db
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = 'caja_abierta'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "false".to_string());
    Ok(val == "true")
}

#[tauri::command]
pub fn close_cashier(state: State<AppState>) -> Result<CloseReport, String> {
    let (username, user_id) = {
        let lock = state.current_user.lock().unwrap().clone();
        match lock {
            Some(ref u) => (u.username.clone(), u.id),
            None => (String::new(), 0),
        }
    };

    let mut db = state.db.lock().unwrap();

    let caja_abierta: String = db
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = 'caja_abierta'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "false".to_string());
    if caja_abierta != "true" {
        return Err("La caja no está abierta. Ábrela primero.".to_string());
    }

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tomorrow = match chrono::Local::now().checked_add_signed(chrono::Duration::days(1)) {
        Some(d) => d.format("%Y-%m-%d").to_string(),
        None => "9999-12-31".to_string(),
    };
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let total_ventas: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2",
            params![today, tomorrow],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let total_usd: f64 = db
        .query_row(
            "SELECT COALESCE(SUM(total_usd), 0) FROM ventas WHERE fecha_hora >= ?1 AND fecha_hora < ?2",
            params![today, tomorrow],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let tasa: f64 = db
        .query_row(
            "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0.0);

    let total_bs = total_usd * tasa;

    let report_data = compute_report_data_range(&db, &today, &tomorrow, &now)?;
    let detalle_json = serde_json::to_string(&report_data).map_err(|e| format!("Error al serializar reporte: {}", e))?;

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    tx.execute(
        "INSERT INTO cierres_caja (fecha_hora, usuario_id, total_ventas, total_usd) VALUES (?1, ?2, ?3, ?4)",
        params![now, user_id, total_ventas, total_usd],
    )
    .map_err(|e| e.to_string())?;

    let cierre_id = tx.last_insert_rowid();
    tx.execute(
        "INSERT INTO cierres_detalle (cierre_id, detalle_json) VALUES (?1, ?2)",
        params![cierre_id, detalle_json],
    )
    .map_err(|e| format!("Error al guardar detalle del cierre: {}", e))?;

    tx.execute(
        "UPDATE configuracion SET valor = 'false' WHERE clave = 'caja_abierta'",
        [],
    )
    .ok();

    let accion = format!(
        "Cierre de caja - Ventas: {}, Total USD: ${:.2}, Total Bs.: Bs. {:.2}",
        total_ventas, total_usd, total_bs
    );
    tx.execute(
        "INSERT INTO historial_acciones (fecha_hora, usuario, accion) VALUES (?1, ?2, ?3)",
        params![now, username, accion],
    )
    .ok();

    tx.commit().map_err(|e| format!("Error al confirmar cierre: {}", e))?;

    Ok(CloseReport {
        fecha_cierre: now,
        total_ventas,
        total_usd,
        total_bs,
        usuario: username,
    })
}

#[tauri::command]
pub fn get_close_report_data(state: State<AppState>) -> Result<CloseReportData, String> {
    let db = state.db.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tomorrow = match chrono::Local::now().checked_add_signed(chrono::Duration::days(1)) {
        Some(d) => d.format("%Y-%m-%d").to_string(),
        None => "9999-12-31".to_string(),
    };
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    compute_report_data_range(&db, &today, &tomorrow, &now)
}

#[tauri::command]
pub fn list_cierres(state: State<AppState>) -> Result<Vec<CierreListItem>, String> {
    let db = state.db.lock().unwrap();
    let mut stmt = db
        .prepare(
            "SELECT c.id, c.fecha_hora, u.username, c.total_ventas, c.total_usd
             FROM cierres_caja c
             LEFT JOIN usuarios u ON c.usuario_id = u.id
             ORDER BY c.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let tasa = get_tasa_raw(&db);
    let cierres: Vec<CierreListItem> = stmt
        .query_map([], |row| {
            let total_usd: f64 = row.get(4)?;
            Ok(CierreListItem {
                id: row.get(0)?,
                fecha_hora: row.get(1)?,
                username: row.get(2)?,
                total_ventas: row.get(3)?,
                total_usd,
                total_bs: total_usd * tasa,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(cierres)
}

fn get_tasa_raw(db: &rusqlite::Connection) -> f64 {
    db.query_row(
        "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0.0)
}

#[tauri::command]
pub fn get_cierre_detalle(state: State<AppState>, cierre_id: i64) -> Result<CierreDetalle, String> {
    let db = state.db.lock().unwrap();

    let (fecha_hora, usuario_id, total_ventas, total_usd): (String, i64, i64, f64) = db
        .query_row(
            "SELECT fecha_hora, usuario_id, total_ventas, total_usd FROM cierres_caja WHERE id = ?1",
            params![cierre_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Cierre no encontrado".to_string())?;

    let username: String = db
        .query_row("SELECT username FROM usuarios WHERE id = ?1", params![usuario_id], |row| row.get(0))
        .unwrap_or_default();

    let tasa = get_tasa_raw(&db);
    let total_bs = total_usd * tasa;

    let detalle_json: String = db
        .query_row(
            "SELECT detalle_json FROM cierres_detalle WHERE cierre_id = ?1",
            params![cierre_id],
            |row| row.get(0),
        )
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
        },
        detalle,
    })
}
