use super::{api_url, normalize_fecha, now_iso, run_download, run_upload, supabase_get, supabase_post, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::{params, Connection};
use serde_json::json;
use tauri::State;

pub(crate) fn upload_sales_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    _dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let last_upload = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_VENTAS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());

    let mut stmt = db
        .prepare(
            "SELECT v.id, v.sync_id, v.fecha_hora, v.usuario_id, v.metodo_pago, \
             v.referencia_pago_movil, v.pago_detalle, v.cliente_id, v.total_usd, \
             v.tasa_aplicada, v.total_bs, v.anulada, v.dispositivo_origen, COALESCE(v.updated_at,'') \
             FROM ventas v \
             WHERE v.sync_id IS NOT NULL AND v.sync_id != '' AND v.updated_at > ?1 \
             ORDER BY v.id ASC",
        )
        .map_err(|e| e.to_string())?;

    #[allow(clippy::type_complexity)]
    let rows: Vec<(i64, String, String, i64, String, Option<String>, String, Option<i64>,
                   f64, f64, f64, bool, String, String)> = stmt
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
                row.get::<_, String>(13)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(stmt);

    if rows.is_empty() {
        return Ok("No hay ventas nuevas para subir".to_string());
    }

    let mut all_ventas: Vec<serde_json::Value> = Vec::with_capacity(rows.len());
    let mut all_detalles: Vec<serde_json::Value> = Vec::new();
    let sale_ids: Vec<i64> = rows.iter().map(|(id, ..)| *id).collect();

    let user_map: std::collections::HashMap<i64, String> = {
        let mut m = std::collections::HashMap::new();
        if let Ok(mut s) = db.prepare("SELECT id, sync_id FROM usuarios WHERE sync_id IS NOT NULL AND sync_id != ''") {
            if let Ok(rows) = s.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))) {
                for r in rows.filter_map(|r| r.ok()) { m.insert(r.0, r.1); }
            }
        }
        m
    };

    let client_map: std::collections::HashMap<i64, String> = {
        let mut s = db.prepare("SELECT id, sync_id FROM clientes WHERE sync_id IS NOT NULL AND sync_id != ''")
            .map_err(|e| e.to_string())?;
        let rows = s.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut m = std::collections::HashMap::new();
        for (id, sid) in rows { m.insert(id, sid); }
        m
    };

    for (id, sync_id, fecha, uid, metodo, refe, pago_det, cliente_id, total_usd, tasa, total_bs, anulada, disp_origen, updated_at) in &rows {
        let fecha_iso = fecha.replace(' ', "T");
        let usr_sync_id = user_map.get(uid).cloned().unwrap_or_default();
        let cli_sync_id = cliente_id.and_then(|cid| client_map.get(&cid).cloned());
        let updated_at = if updated_at.is_empty() { now_iso() } else { updated_at.clone() };
        all_ventas.push(json!({
            "id": sync_id,
            "local_id": id,
            "dispositivo_origen": disp_origen,
            "fecha_hora": fecha_iso,
            "usuario_sync_id": usr_sync_id,
            "usuario_id": uid,
            "metodo_pago": metodo,
            "referencia_pago_movil": refe,
            "pago_detalle": pago_det,
            "cliente_sync_id": cli_sync_id,
            "total_usd": total_usd,
            "tasa_aplicada": tasa,
            "total_bs": total_bs,
            "anulada": if *anulada { 1i64 } else { 0i64 },
            "updated_at": updated_at,
        }));
    }

    let placeholders: Vec<String> = sale_ids.iter().map(|_| "?".to_string()).collect();
    let placeholder_str = placeholders.join(",");

    let mut d_stmt = db
        .prepare(
            &format!(
"SELECT dv.venta_id, dv.producto_codigo, dv.cantidad, \
                 dv.precio_usd_unitario, dv.sync_id, dv.id, COALESCE(dv.anulado,0) \
                 FROM detalles_ventas dv WHERE dv.venta_id IN ({})",
                placeholder_str,
            ),
        )
        .map_err(|e| e.to_string())?;

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = sale_ids
        .iter()
        .map(|id| id as &dyn rusqlite::types::ToSql)
        .collect();

    let dets: Vec<(i64, String, f64, f64, Option<String>, i64, i64)> = d_stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    drop(d_stmt);

    let sale_sync_map: std::collections::HashMap<i64, &str> = rows
        .iter()
        .map(|(id, sync_id, ..)| (*id, sync_id.as_str()))
        .collect();

    let mut updated_sync_ids: Vec<(i64, String)> = Vec::new();

    for (venta_id, codigo, cantidad, precio, det_sync_id, local_det_id, anulado) in &dets {
        if let Some(venta_sync_id) = sale_sync_map.get(venta_id) {
            let det_id = match det_sync_id {
                Some(sid) if !sid.is_empty() => sid.clone(),
                _ => {
                    let new_id = uuid::Uuid::new_v4().to_string();
                    updated_sync_ids.push((*local_det_id, new_id.clone()));
                    new_id
                }
            };
            all_detalles.push(json!({
                "id": det_id,
                "venta_id": venta_sync_id,
                "local_id": local_det_id,
                "producto_codigo": codigo,
                "cantidad": cantidad,
                "precio_usd_unitario": precio,
                "anulado": if *anulado != 0 { 1i64 } else { 0i64 },
                "updated_at": &ts,
            }));
        }
    }

    let ventas_body = serde_json::to_string(&all_ventas)
        .map_err(|e| format!("Error serializando ventas JSON: {}", e))?;
    supabase_post(
        &api_url(supabase_url, "/ventas?on_conflict=id"),
        supabase_key,
        &ventas_body,
    )?;

    if !all_detalles.is_empty() {
        let detalles_body = serde_json::to_string(&all_detalles)
            .map_err(|e| format!("Error serializando detalles JSON: {}", e))?;
        supabase_post(
            &api_url(supabase_url, "/detalles_ventas?on_conflict=id"),
            supabase_key,
            &detalles_body,
        )?;
    }

    // Persist newly generated sync_ids for old rows that didn't have one
    for (local_id, new_sync_id) in &updated_sync_ids {
        db.execute(
            "UPDATE detalles_ventas SET sync_id = ?1 WHERE id = ?2 AND (sync_id IS NULL OR sync_id = '')",
            params![new_sync_id, local_id],
        ).map_err(|e| format!("Error persistiendo sync_id de detalle: {}", e))?;
    }

    upsert_config(db, constants::CFG_ULTIMO_UPLOAD_VENTAS, &ts);

    Ok(format!("Subida completada: {} venta(s) subidas", all_ventas.len()))
}

#[tauri::command]
pub fn upload_sales(state: State<AppState>) -> Result<String, String> {
    crate::auth::check_admin_role(&state)?;
    run_upload(&state, |db, supabase_url, supabase_key, dispositivo_id| {
        upload_sales_inner(db, supabase_url, supabase_key, dispositivo_id)
    })
}

/// Calcula la transición de anulado de un detalle al descargar una venta remota.
/// Una venta anulada implica todos sus ítems anulados. Devuelve:
/// - el estado objetivo (`should_be_anulado`)
/// - delta de stock: +1 => restaurar stock (activo → anulado), -1 => consumir (anulado → activo), 0 => sin cambio
/// Mantener el delta en 0 cuando ya se alcanzó el estado objetivo hace el sync idempotente.
pub(crate) fn anulado_delta(local_anulado: bool, remote_anulado: bool, venta_anulada: bool) -> (bool, i8) {
    let should_be_anulado = venta_anulada || remote_anulado;
    let delta = match (local_anulado, should_be_anulado) {
        (false, true) => 1,
        (true, false) => -1,
        _ => 0,
    };
    (should_be_anulado, delta)
}

pub(crate) fn download_sales_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    let ts = now_iso();

    let user_rev: std::collections::HashMap<String, i64> = {
        let mut m = std::collections::HashMap::new();
        if let Ok(mut s) = db.prepare("SELECT sync_id, id FROM usuarios WHERE sync_id IS NOT NULL AND sync_id != ''") {
            if let Ok(rows) = s.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))) {
                for r in rows.filter_map(|r| r.ok()) { m.insert(r.0, r.1); }
            }
        }
        m
    };

    let client_rev: std::collections::HashMap<String, i64> = {
        let mut s = db.prepare("SELECT sync_id, id FROM clientes WHERE sync_id IS NOT NULL AND sync_id != ''")
            .map_err(|e| e.to_string())?;
        let rows = s.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut m = std::collections::HashMap::new();
        for (sid, id) in rows { m.insert(sid, id); }
        m
    };

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

    // Estado local para reconciliar por transición (idempotente): el stock se ajusta
    // SOLO cuando el estado local difiere del remoto, así repetir el sync no duplica.
    let mut local_ventas: std::collections::HashMap<String, (i64, bool)> = std::collections::HashMap::new();
    {
        let mut s = db
            .prepare("SELECT sync_id, id, COALESCE(anulada,0) FROM ventas WHERE sync_id IS NOT NULL AND sync_id != ''")
            .map_err(|e| e.to_string())?;
        let rows = s
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)))
            .map_err(|e| e.to_string())?;
        for r in rows.filter_map(|r| r.ok()) {
            local_ventas.insert(r.0, (r.1, r.2 != 0));
        }
    }

    let mut local_dets: std::collections::HashMap<String, (i64, bool)> = std::collections::HashMap::new();
    {
        let mut d = db
            .prepare("SELECT sync_id, venta_id, COALESCE(anulado,0) FROM detalles_ventas WHERE sync_id IS NOT NULL AND sync_id != ''")
            .map_err(|e| e.to_string())?;
        let rows = d
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?)))
            .map_err(|e| e.to_string())?;
        for r in rows.filter_map(|r| r.ok()) {
            local_dets.insert(r.0, (r.1, r.2 != 0));
        }
    }

    let mut inserted_ventas = 0;
    let mut updated_ventas = 0;
    let mut items_restored = 0.0f64;
    let mut items_consumed = 0.0f64;
    let mut venta_remote_anulada: std::collections::HashMap<String, bool> = std::collections::HashMap::new();
    let mut to_fetch: Vec<String> = Vec::new();

    for venta_json in &cloud_ventas {
        let sale_id = venta_json["id"].as_str().unwrap_or("");
        if sale_id.is_empty() {
            continue;
        }

        let usr_sync_id = venta_json["usuario_sync_id"].as_str().unwrap_or("");
        let cli_sync_id = venta_json["cliente_sync_id"].as_str();
        let local_uid = user_rev.get(usr_sync_id).copied().unwrap_or(0);
        let local_cid = cli_sync_id.and_then(|sid| client_rev.get(sid).copied());
        let remote_anulada = venta_json["anulada"].as_i64().unwrap_or(0) != 0;
        let remote_ts = venta_json["updated_at"].as_str().unwrap_or(&ts).to_string();
        venta_remote_anulada.insert(sale_id.to_string(), remote_anulada);

        if let Some((lvid, local_anulada)) = local_ventas.get(sale_id).copied() {
            // Venta ya existente: aplicar totales/anulación remota (la remota es más nueva).
            db.execute(
                "UPDATE ventas SET total_usd = ?1, total_bs = ?2, anulada = ?3, \
                 nota_anulacion = ?4, updated_at = ?5 WHERE id = ?6",
                params![
                    venta_json["total_usd"].as_f64().unwrap_or(0.0),
                    venta_json["total_bs"].as_f64().unwrap_or(0.0),
                    if remote_anulada { 1i64 } else { 0i64 },
                    venta_json["nota_anulacion"].as_str(),
                    &remote_ts,
                    lvid,
                ],
            ).map_err(|e| format!("Error actualizando venta remota: {}", e))?;
            if remote_anulada != local_anulada {
                local_ventas.insert(sale_id.to_string(), (lvid, remote_anulada));
            }
            updated_ventas += 1;
        } else {
            let result = db.execute(
                "INSERT INTO ventas \
                 (fecha_hora, usuario_id, metodo_pago, referencia_pago_movil, pago_detalle, \
                  cliente_id, total_usd, tasa_aplicada, total_bs, anulada, sync_id, dispositivo_origen, updated_at, \
                  usuario_sync_id, cliente_sync_id) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    &normalize_fecha(venta_json["fecha_hora"].as_str().unwrap_or("")),
                    local_uid,
                    venta_json["metodo_pago"].as_str().unwrap_or(""),
                    venta_json["referencia_pago_movil"].as_str(),
                    venta_json["pago_detalle"].as_str().unwrap_or(""),
                    local_cid,
                    venta_json["total_usd"].as_f64().unwrap_or(0.0),
                    venta_json["tasa_aplicada"].as_f64().unwrap_or(0.0),
                    venta_json["total_bs"].as_f64().unwrap_or(0.0),
                    if remote_anulada { 1i64 } else { 0i64 },
                    sale_id,
                    venta_json["dispositivo_origen"].as_str().unwrap_or(""),
                    &remote_ts,
                    usr_sync_id,
                    cli_sync_id.unwrap_or(""),
                ],
            ).map_err(|e| format!("Error insertando venta remota: {}", e))?;

            let local_id = if result > 0 {
                db.last_insert_rowid()
            } else {
                db.query_row("SELECT id FROM ventas WHERE sync_id = ?1", params![sale_id], |row| row.get(0))
                    .map_err(|_| "Error leyendo venta recién insertada".to_string())?
            };
            local_ventas.insert(sale_id.to_string(), (local_id, remote_anulada));
            inserted_ventas += 1;
        }

        to_fetch.push(sale_id.to_string());
    }

    if to_fetch.is_empty() {
        upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS, &ts);
        return Ok("No hay ventas nuevas para descargar".to_string());
    }

    // Fetch detalles de TODAS las ventas remotas (nuevas y ya existentes) en un request.
    let in_clause = to_fetch.iter().map(|id| urlencoding(id)).collect::<Vec<_>>().join(",");
    let det_url = api_url(
        supabase_url,
        &format!("/detalles_ventas?venta_id=in.({})&select=*", in_clause),
    );

    let cloud_detalles: Vec<serde_json::Value> =
        supabase_get(&det_url, supabase_key)
            .map_err(|e| format!("Error al descargar detalles: {}", e))?;

    let mut detalles_by_venta: std::collections::HashMap<String, Vec<&serde_json::Value>> =
        std::collections::HashMap::new();
    for det in &cloud_detalles {
        let v_id = det["venta_id"].as_str().unwrap_or("").to_string();
        if !v_id.is_empty() {
            detalles_by_venta.entry(v_id).or_default().push(det);
        }
    }

    for (v_sync, dets) in &detalles_by_venta {
        let Some(&(lvid, _)) = local_ventas.get(v_sync) else { continue };
        let venta_anulada = venta_remote_anulada.get(v_sync).copied().unwrap_or(false);

        for det in dets {
            let det_sync = det["id"].as_str().unwrap_or("");
            if det_sync.is_empty() {
                continue;
            }
            let prod_codigo = det["producto_codigo"].as_str().unwrap_or("").to_string();
            let cantidad = det["cantidad"].as_f64().unwrap_or(0.0);
            let precio = det["precio_usd_unitario"].as_f64().unwrap_or(0.0);
            let remote_anulado = det["anulado"].as_i64().unwrap_or(0) != 0;
            // Una venta anulada implica todos sus ítems anulados.
            let should_be_anulado = venta_anulada || remote_anulado;

            match local_dets.get(det_sync).copied() {
                Some((local_det_id, local_anulado)) => {
                    let (should_be_anulado, delta) = anulado_delta(local_anulado, remote_anulado, venta_anulada);
                    if delta == 1 {
                        // Transición activo -> anulado: restaurar stock una sola vez.
                        crate::db::add_stock(db, &prod_codigo, cantidad)
                            .map_err(|e| format!("Error restaurando stock: {}", e))?;
                        items_restored += cantidad;
                    } else if delta == -1 {
                        // Transición anulado -> activo (re-activación remota): consumir stock.
                        crate::db::sub_stock(db, &prod_codigo, cantidad)
                            .map_err(|e| format!("Error ajustando stock: {}", e))?;
                        items_consumed += cantidad;
                    }
                    if local_anulado != should_be_anulado {
                        db.execute(
                            "UPDATE detalles_ventas SET anulado = ?1 WHERE id = ?2",
                            params![if should_be_anulado { 1i64 } else { 0i64 }, local_det_id],
                        ).map_err(|e| format!("Error actualizando detalle remoto: {}", e))?;
                        local_dets.insert(det_sync.to_string(), (local_det_id, should_be_anulado));
                    }
                }
                None => {
                    db.execute(
                        "INSERT OR IGNORE INTO detalles_ventas \
                         (venta_id, producto_codigo, cantidad, precio_usd_unitario, anulado, sync_id) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                        params![
                            lvid, prod_codigo, cantidad, precio,
                            if should_be_anulado { 1i64 } else { 0i64 },
                            det_sync,
                        ],
                    ).map_err(|e| format!("Error insertando detalle remoto: {}", e))?;
                    if !should_be_anulado {
                        crate::db::sub_stock(db, &prod_codigo, cantidad)
                            .map_err(|e| format!("Error ajustando stock: {}", e))?;
                        items_consumed += cantidad;
                    }
                    local_dets.insert(det_sync.to_string(), (lvid, should_be_anulado));
                }
            }
        }
    }

    upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS, &ts);

    let mut parts: Vec<String> = Vec::new();
    if inserted_ventas > 0 {
        parts.push(format!("{} venta(s) nuevas", inserted_ventas));
    }
    if updated_ventas > 0 {
        parts.push(format!("{} actualizada(s)", updated_ventas));
    }
    if items_consumed > 0.0 {
        parts.push(format!("{:.2} unidad(es) restadas de stock", items_consumed));
    }
    if items_restored > 0.0 {
        parts.push(format!("{:.2} unidad(es) restauradas a stock", items_restored));
    }

    Ok(format!(
        "Descarga completada: {}.",
        if parts.is_empty() { "sin cambios".to_string() } else { parts.join(", ") }
    ))
}

#[tauri::command]
pub fn download_sales(state: State<AppState>) -> Result<String, String> {
    crate::auth::check_admin_role(&state)?;
    run_download(&state, |tx, supabase_url, supabase_key, dispositivo_id| {
        download_sales_inner(tx, supabase_url, supabase_key, dispositivo_id)
    })
}

#[cfg(test)]
mod tests {
    use super::anulado_delta;

    #[test]
    fn test_anulado_delta_activo_a_anulado_restaura() {
        let (state, delta) = anulado_delta(false, true, false);
        assert_eq!(state, true);
        assert_eq!(delta, 1);
    }

    #[test]
    fn test_anulado_delta_venta_anulada_implica_items() {
        // Venta anulada remota fuerza el ítem a anulado aunque el detalle diga 0.
        let (state, delta) = anulado_delta(false, false, true);
        assert_eq!(state, true);
        assert_eq!(delta, 1);
    }

    #[test]
    fn test_anulado_delta_idempotente_ya_anulado() {
        // Ya anulado: no vuelve a restaurar.
        let (state, delta) = anulado_delta(true, true, false);
        assert_eq!(state, true);
        assert_eq!(delta, 0);
    }

    #[test]
    fn test_anulado_delta_idempotente_activo() {
        let (state, delta) = anulado_delta(false, false, false);
        assert_eq!(state, false);
        assert_eq!(delta, 0);
    }

    #[test]
    fn test_anulado_delta_reactivacion_consume() {
        // Anulado -> activo: consume stock de nuevo.
        let (state, delta) = anulado_delta(true, false, false);
        assert_eq!(state, false);
        assert_eq!(delta, -1);
    }
}
