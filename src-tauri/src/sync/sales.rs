use super::{api_url, get_config, normalize_fecha, now_iso, supabase_config, supabase_get, supabase_post, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::{params, Connection};
use serde_json::json;
use tauri::State;

pub(crate) fn upload_sales_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_upload = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_VENTAS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT v.id, v.sync_id, v.fecha_hora, v.usuario_id, v.metodo_pago, \
             v.referencia_pago_movil, v.pago_detalle, v.cliente_id, v.total_usd, \
             v.tasa_aplicada, v.total_bs, v.anulada, v.dispositivo_origen \
             FROM ventas v \
             WHERE v.sync_id IS NOT NULL AND v.sync_id != '' AND v.updated_at > ?1 \
             ORDER BY v.id ASC",
        )
        .map_err(|e| e.to_string())?;

    #[allow(clippy::type_complexity)]
    let rows: Vec<(i64, String, String, i64, String, Option<String>, String, Option<i64>,
                   f64, f64, f64, bool, String)> = stmt
        .query_map(params![last_upload], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, f64>(8)?,
                row.get::<_, f64>(9)?,
                row.get::<_, f64>(10)?,
                { let a: i64 = row.get::<_, i64>(11)?; a != 0 },
                row.get::<_, String>(12)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay ventas nuevas para subir".to_string());
    }

    let mut uploaded = 0;
    for (id, sync_id, fecha, uid, metodo, refe, pago_det, cliente_id, total_usd, tasa, total_bs, anulada, disp_origen) in &rows {
        let fecha_iso = fecha.replace(' ', "T");
        let venta_body = json!({
            "id": sync_id,
            "sync_id": sync_id,
            "local_id": id,
            "dispositivo_id": &dispositivo_id,
            "fecha_hora": fecha_iso,
            "usuario_id": uid,
            "metodo_pago": metodo,
            "referencia_pago_movil": refe,
            "pago_detalle": pago_det,
            "cliente_id": cliente_id,
            "total_usd": total_usd,
            "tasa_aplicada": tasa,
            "total_bs": total_bs,
            "anulada": if *anulada { 1i64 } else { 0i64 },
            "dispositivo_origen": disp_origen,
            "updated_at": &ts,
        });

        let venta_array = vec![venta_body];
        let ventas_json = serde_json::to_string(&venta_array)
            .map_err(|e| format!("Error serializando ventas JSON: {}", e))?;
        supabase_post(
            &api_url(supabase_url, "/ventas?on_conflict=sync_id"),
            supabase_key,
            &ventas_json,
        )?;

        let mut d_stmt = db
            .prepare(
                "SELECT dv.producto_codigo, dv.cantidad, dv.precio_usd_unitario, dv.sync_id, dv.id \
                 FROM detalles_ventas dv WHERE dv.venta_id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let dets: Vec<(String, i64, f64, Option<String>, i64)> = d_stmt
            .query_map(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        drop(d_stmt);

        if !dets.is_empty() {
            let detalle_bodies: Vec<serde_json::Value> = dets
                .iter()
                .map(|(codigo, cantidad, precio, det_sync_id, local_det_id)| {
                    json!({
                        "venta_id": sync_id,
                        "local_id": local_det_id,
                        "producto_codigo": codigo,
                        "cantidad": cantidad,
                        "precio_usd_unitario": precio,
                        "sync_id": det_sync_id,
                        "anulado": 0,
                        "updated_at": &ts,
                    })
                })
                .collect();

            let detalles_json = serde_json::to_string(&detalle_bodies)
                .map_err(|e| format!("Error serializando detalles JSON: {}", e))?;
            supabase_post(
                &api_url(supabase_url, "/detalles_ventas?on_conflict=sync_id"),
                supabase_key,
                &detalles_json,
            )?;
        }

        uploaded += 1;
    }

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_VENTAS, &ts);

    Ok(format!("Subida completada: {} venta(s) subidas", uploaded))
}

#[tauri::command]
pub fn upload_sales(state: State<AppState>) -> Result<String, String> {
    let db = state.lock_db()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
    let dispositivo_id = get_config(&db, constants::CFG_DISPOSITIVO_ID)?;
    upload_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

pub(crate) fn download_sales_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_sync = super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let since = urlencoding(&last_sync);
    let get_url = api_url(
        supabase_url,
        &format!(
            "/ventas?updated_at=gt.{}&dispositivo_origen=neq.{}&select=*",
            since,
            urlencoding(dispositivo_id),
        ),
    );

    let cloud_ventas: Vec<serde_json::Value> =
        supabase_get(&get_url, supabase_key)
            .map_err(|e| format!("Error al descargar ventas: {}", e))?;

    if cloud_ventas.is_empty() {
        return Ok("No hay ventas nuevas para descargar".to_string());
    }

    let mut inserted_ventas = 0;
    let mut adjusted_stock_items = 0i64;

    for venta_json in &cloud_ventas {
        let sync_id = venta_json["sync_id"].as_str().unwrap_or("");
        if sync_id.is_empty() {
            continue;
        }

        let venta_id = {
            let result = db.execute(
                "INSERT OR IGNORE INTO ventas \
                 (fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, pago_detalle, \
                  cliente_id, total_usd, tasa_aplicada, total_bs, sync_id, dispositivo_origen, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    &normalize_fecha(venta_json["fecha_hora"].as_str().unwrap_or("")),
                    venta_json["usuario_id"].as_i64().unwrap_or(0),
                    venta_json["metodo_pago"].as_str().unwrap_or(""),
                    venta_json["referencia_pago_movil"].as_str(),
                    venta_json["pago_detalle"].as_str().unwrap_or(""),
                    venta_json["cliente_id"].as_i64(),
                    venta_json["total_usd"].as_f64().unwrap_or(0.0),
                    venta_json["tasa_aplicada"].as_f64().unwrap_or(0.0),
                    venta_json["total_bs"].as_f64().unwrap_or(0.0),
                    sync_id,
                    venta_json["dispositivo_origen"].as_str().unwrap_or(""),
                    venta_json["updated_at"].as_str().unwrap_or(""),
                ],
            ).map_err(|e| format!("Error insertando venta remota: {}", e))?;

            if result == 0 {
                continue;
            }
            inserted_ventas += 1;
            db.last_insert_rowid()
        };

        let det_url = api_url(
            supabase_url,
            &format!("/detalles_ventas?venta_id=eq.{}&select=*", urlencoding(sync_id)),
        );

        let cloud_detalles: Vec<serde_json::Value> =
            supabase_get(&det_url, supabase_key)
                .map_err(|e| format!("Error al descargar detalles de venta {}: {}", sync_id, e))?;

        for det in &cloud_detalles {
            let det_sync_id = det["sync_id"].as_str().unwrap_or("");
            if det_sync_id.is_empty() {
                continue;
            }

            let prod_codigo = det["producto_codigo"].as_str().unwrap_or("").to_string();
            let cantidad = det["cantidad"].as_i64().unwrap_or(0);
            let precio = det["precio_usd_unitario"].as_f64().unwrap_or(0.0);

            let det_result = db.execute(
                "INSERT OR IGNORE INTO detalles_ventas \
                 (venta_id, producto_codigo, cantidad, precio_usd_unitario, sync_id) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![venta_id, prod_codigo, cantidad, precio, det_sync_id],
            ).map_err(|e| format!("Error insertando detalle remoto: {}", e))?;

            if det_result > 0 && venta_json["anulada"].as_i64().unwrap_or(0) == 0 {
                db.execute(
                    "UPDATE productos SET stock = stock - ?1 WHERE codigo = ?2 AND stock >= ?1",
                    params![cantidad, prod_codigo],
                ).map_err(|e| format!("Error ajustando stock: {}", e))?;
                adjusted_stock_items += cantidad;
            }
        }

        if venta_json["anulada"].as_i64().unwrap_or(0) != 0 {
            db.execute("UPDATE ventas SET anulada = 1 WHERE id = ?1", params![venta_id])
                .map_err(|e| format!("Error marcando venta como anulada: {}", e))?;
        }
    }

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS, &ts);

    Ok(format!(
        "Descarga completada: {} venta(s) nuevas, {} unidad(es) ajustadas en stock",
        inserted_ventas, adjusted_stock_items
    ))
}

#[tauri::command]
pub fn download_sales(state: State<AppState>) -> Result<String, String> {
    let mut db = state.secondary_conn()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    let (supabase_url, supabase_key) = supabase_config(&tx)?;
    let dispositivo_id = get_config(&tx, constants::CFG_DISPOSITIVO_ID).unwrap_or_default();
    let result = download_sales_inner(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
    tx.commit().map_err(|e| format!("Error al confirmar descarga: {}", e))?;
    Ok(result)
}
