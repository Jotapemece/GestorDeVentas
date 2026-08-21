use super::{api_url, normalize_fecha, now_iso, supabase_post, supabase_get_paginated, upsert_config, urlencoding};
use crate::constants;
use rusqlite::{params, Connection};
use serde_json::json;

/// LWW: ¿debe aplicarse la versión remota sobre la local? Devuelve `false` si la
/// remota es más vieja que la local (o si no trae timestamp y la local sí).
pub(crate) fn remota_mas_nueva(remote_ts: &str, local_ts: &str) -> bool {
    if remote_ts.is_empty() {
        return false;
    }
    if local_ts.is_empty() {
        return true;
    }
    remote_ts > local_ts
}

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
             v.tasa_aplicada, v.total_bs, v.anulada, v.dispositivo_origen, COALESCE(v.updated_at,''), \
             COALESCE(v.usuario_sync_id,''), v.cliente_sync_id \
             FROM ventas v \
             WHERE v.sync_id IS NOT NULL AND v.sync_id != '' AND v.updated_at > ?1 \
             ORDER BY v.id ASC",
        )
        .map_err(|e| e.to_string())?;

    #[allow(clippy::type_complexity)]
    let rows: Vec<(i64, String, String, i64, String, Option<String>, String, Option<i64>,
                   f64, f64, f64, bool, String, String, String, Option<String>)> = stmt
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
                row.get::<_, String>(14)?,
                row.get::<_, Option<String>>(15)?,
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

    for (id, sync_id, fecha, uid, metodo, refe, pago_det, cliente_id, total_usd, tasa, total_bs, anulada, disp_origen, updated_at, usr_sync_stored, cli_sync_stored) in &rows {
        let fecha_iso = fecha.replace(' ', "T");
        // F4: conservar los `*_sync_id` ya subidos (lectura desde BD) — no
        // sobrescribir con ""/null si el usuario/cliente aún no está en el mapa
        // (ej. no subido aún o soft-deleted). Solo resolver desde el mapa cuando
        // la columna local está vacía (primera subida o cambio de dueño).
        let usr_sync_id = if usr_sync_stored.is_empty() {
            user_map.get(uid).cloned().unwrap_or_default()
        } else {
            usr_sync_stored.clone()
        };
        let cli_sync_id = match (cli_sync_stored, cliente_id) {
            (Some(stored), _) if !stored.is_empty() => Some(stored.clone()),
            (_, Some(cid)) => client_map.get(&cid).cloned(),
            _ => None,
        };
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

    // La columna `cantidad` remota puede ser INTEGER; serializar sin ".0" los
    // enteros para que PostgREST los acepte (las fraccionarias se envían como float).
    fn cantidad_json(c: f64) -> serde_json::Value {
        if c.fract() == 0.0 {
            json!(c as i64)
        } else {
            json!(c)
        }
    }

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
                "cantidad": cantidad_json(*cantidad),
                "precio_usd_unitario": cantidad_json(*precio),
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

/// Determina el estado `anulado` objetivo de un detalle al aplicar una venta
/// remota: una venta anulada implica todos sus ítems anulados.
/// El stock ya NO se ajusta aquí — viaja en `productos.stock` (upload/download
/// de productos). Ajustarlo por venta duplicaba el descuento (el producto ya se
/// descarga con su stock que refleja esas ventas) y bumpeaba `updated_at`,
/// dejando el producto local "más nuevo" que el remoto y rompiendo el LWW.
pub(crate) fn anulado_delta(remote_anulado: bool, venta_anulada: bool) -> bool {
    venta_anulada || remote_anulado
}

pub(crate) fn download_sales_inner(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
) -> Result<String, String> {
    apply_remote_sales(db, supabase_url, supabase_key, dispositivo_id, None, true)
}

/// Aplica ventas remotas de otros dispositivos con reconciliación idempotente.
/// Si `wanted` es `Some`, solo se procesan esas ventas (modal de descarga selectiva) y
/// NO se avanza el watermark. Si es `None`, se descargan todas las que tengan
/// `updated_at > ultimo_download_ventas` y se avanza el watermark al final.
pub(crate) fn apply_remote_sales(
    db: &Connection,
    supabase_url: &str,
    supabase_key: &str,
    dispositivo_id: &str,
    wanted: Option<&std::collections::HashSet<String>>,
    use_watermark: bool,
) -> Result<String, String> {
    let ts = now_iso();

    // Primera descarga del dispositivo: forzar el remoto (LWW off) para sanar la BD local.
    let first_sync = super::get_config(db, constants::CFG_FIRST_SYNC_DONE)
        .unwrap_or_default()
        .is_empty();

    let user_rev: std::collections::HashMap<String, i64> = {
        let mut m = std::collections::HashMap::new();
        if let Ok(mut s) = db.prepare("SELECT sync_id, id FROM usuarios WHERE sync_id IS NOT NULL AND sync_id != ''") {
            if let Ok(rows) = s.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))) {
                for r in rows.filter_map(|r| r.ok()) { m.insert(r.0, r.1); }
            }
        }
        m
    };

    // Si un `usuario_sync_id` remoto no existe localmente (p.ej. el modal de
    // descarga selectiva NO trae usuarios, o el usuario fue borrado), insertar
    // con usuario_id=0 violaría la FK `ventas.usuario_id NOT NULL REFERENCES
    // usuarios(id)`. Fallback: asignar el usuario local de menor id (normalmente
    // el admin raíz) para no romper la descarga. El autor real queda preservado
    // en la columna `usuario_sync_id`.
    let fallback_uid: i64 = db
        .query_row(
            "SELECT id FROM usuarios ORDER BY id LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap_or(1);

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

    let last_sync = if use_watermark {
        super::get_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS)
            .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string())
    } else {
        "1970-01-01T00:00:00.000Z".to_string()
    };

    let since = urlencoding(&last_sync);
    // F3: las ventas propias NO se excluyen a ciegas — si otra dispositivo las
    // modificó (p.ej. anuló) después de nuestro último upload, la actualización
    // remota debe volver a nosotros. Se traen propias solo con
    // `updated_at > ultimo_upload_ventas` local; las de otros dispositivos con
    // `updated_at > ultimo_download_ventas`. (El LWW posterior decide si aplicar.)
    let upload_since = super::get_config(db, constants::CFG_ULTIMO_UPLOAD_VENTAS)
        .unwrap_or_else(|_| "1970-01-01T00:00:00.000Z".to_string());
    let dev_enc = urlencoding(dispositivo_id);
    let up_enc = urlencoding(&upload_since);
    let get_url = if use_watermark {
        api_url(
            supabase_url,
            &format!(
                "/ventas?or=(and(dispositivo_origen.is.null,updated_at.gt.{s}),\
                 and(dispositivo_origen.neq.{d},updated_at.gt.{s}),\
                 and(dispositivo_origen.eq.{d},updated_at.gt.{u}))&select=*",
                s = since,
                d = dev_enc,
                u = up_enc,
            ),
        )
    } else {
        // Descarga completa (modal selectivo): todo lo de otros dispositivos +
        // lo propio modificado remotamente tras nuestro último upload.
        api_url(
            supabase_url,
            &format!(
                "/ventas?or=(dispositivo_origen.is.null,\
                 and(dispositivo_origen.neq.{d},updated_at.gt.1970-01-01T00:00:00.000Z),\
                 and(dispositivo_origen.eq.{d},updated_at.gt.{u}))&select=*",
                d = dev_enc,
                u = up_enc,
            ),
        )
    };

    let cloud_ventas: Vec<serde_json::Value> =
        supabase_get_paginated(&get_url, supabase_key, "id")
            .map_err(|e| format!("Error al descargar ventas: {}", e))?;

    if cloud_ventas.is_empty() {
        if use_watermark {
            upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS, &ts);
        }
        return Ok("No hay ventas nuevas para descargar".to_string());
    }

    // Estado local para reconciliar por transición (idempotente): el stock se ajusta
    // SOLO cuando el estado local difiere del remoto, así repetir el sync no duplica.
    // Se guarda también `updated_at` local para LWW (no pisa una versión local más
    // reciente con una remota más vieja).
    let mut local_ventas: std::collections::HashMap<String, (i64, bool, String)> = std::collections::HashMap::new();
    {
        let mut s = db
            .prepare("SELECT sync_id, id, COALESCE(anulada,0), COALESCE(updated_at,'') FROM ventas WHERE sync_id IS NOT NULL AND sync_id != ''")
            .map_err(|e| e.to_string())?;
        let rows = s
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?, row.get::<_, String>(3)?)))
            .map_err(|e| e.to_string())?;
        for r in rows.filter_map(|r| r.ok()) {
            local_ventas.insert(r.0, (r.1, r.2 != 0, r.3));
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
    let mut venta_remote_anulada: std::collections::HashMap<String, bool> = std::collections::HashMap::new();
    let mut to_fetch: Vec<String> = Vec::new();

    for venta_json in &cloud_ventas {
        let sale_id = venta_json["id"].as_str().unwrap_or("");
        if sale_id.is_empty() {
            continue;
        }
        if let Some(wanted) = wanted {
            if !wanted.contains(sale_id) {
                continue;
            }
        }

        let usr_sync_id = venta_json["usuario_sync_id"].as_str().unwrap_or("");
        let cli_sync_id = venta_json["cliente_sync_id"].as_str();
        let local_uid = user_rev.get(usr_sync_id).copied().unwrap_or(fallback_uid);
        let local_cid = cli_sync_id.and_then(|sid| client_rev.get(sid).copied());
        let remote_anulada = venta_json["anulada"].as_i64().unwrap_or(0) != 0;
        let remote_ts = venta_json["updated_at"].as_str().unwrap_or(&ts).to_string();
        venta_remote_anulada.insert(sale_id.to_string(), remote_anulada);

        if let Some((lvid, local_anulada, local_ts)) = local_ventas.get(sale_id).cloned() {
            // LWW: solo aplica la versión remota si es más reciente que la local
            // (mismo criterio que productos/clientes). Evita que una remota más
            // vieja des-haga una anulación o un total local más nuevo.
            // En el primer sync el remoto SIEMPRE gana (LWW off).
            if !first_sync && !remota_mas_nueva(&remote_ts, &local_ts) {
                continue;
            }
            // Venta ya existente y remota más nueva: aplicar totales/anulación remota.
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
                local_ventas.insert(sale_id.to_string(), (lvid, remote_anulada, remote_ts.clone()));
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
            local_ventas.insert(sale_id.to_string(), (local_id, remote_anulada, remote_ts.clone()));
            inserted_ventas += 1;
        }

        to_fetch.push(sale_id.to_string());
    }

    if to_fetch.is_empty() {
        if use_watermark {
            upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS, &ts);
        }
        return Ok("No hay ventas nuevas para descargar".to_string());
    }

    // Fetch detalles de TODAS las ventas remotas (nuevas y ya existentes),
    // en lotes de `venta_id` para no exceder el largo de URL ni el corte de
    // filas por request (PostgREST). Cada lote se descarga paginado.
    let mut cloud_detalles: Vec<serde_json::Value> = Vec::new();
    for chunk in to_fetch.chunks(500) {
        let in_clause = chunk.iter().map(|id| urlencoding(id)).collect::<Vec<_>>().join(",");
        let det_url = api_url(
            supabase_url,
            &format!("/detalles_ventas?venta_id=in.({})&select=*", in_clause),
        );
        let mut dets = supabase_get_paginated(&det_url, supabase_key, "id")
            .map_err(|e| format!("Error al descargar detalles: {}", e))?;
        cloud_detalles.append(&mut dets);
    }

    let mut detalles_by_venta: std::collections::HashMap<String, Vec<&serde_json::Value>> =
        std::collections::HashMap::new();
    for det in &cloud_detalles {
        let v_id = det["venta_id"].as_str().unwrap_or("").to_string();
        if !v_id.is_empty() {
            detalles_by_venta.entry(v_id).or_default().push(det);
        }
    }

    for (v_sync, dets) in &detalles_by_venta {
        let Some((lvid, _, _)) = local_ventas.get(v_sync) else { continue };
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
                    let should_be_anulado = anulado_delta(remote_anulado, venta_anulada);
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
                    local_dets.insert(det_sync.to_string(), (*lvid, should_be_anulado));
                }
            }
        }
    }

    if use_watermark {
        upsert_config(db, constants::CFG_ULTIMO_DOWNLOAD_VENTAS, &ts);
        if first_sync {
            upsert_config(db, constants::CFG_FIRST_SYNC_DONE, "1");
        }
    }

    let mut parts: Vec<String> = Vec::new();
    if inserted_ventas > 0 {
        parts.push(format!("{} venta(s) nuevas", inserted_ventas));
    }
    if updated_ventas > 0 {
        parts.push(format!("{} actualizada(s)", updated_ventas));
    }

    Ok(format!(
        "Descarga completada: {}.",
        if parts.is_empty() { "sin cambios".to_string() } else { parts.join(", ") }
    ))
}

#[cfg(test)]
mod tests {
    use super::{anulado_delta, remota_mas_nueva};

    #[test]
    fn test_anulado_delta_venta_anulada_implica_items() {
        // Venta anulada remota fuerza el ítem a anulado aunque el detalle diga 0.
        assert!(anulado_delta(false, true));
        assert!(anulado_delta(true, true));
    }

    #[test]
    fn test_anulado_delta_remoto_anula() {
        assert!(anulado_delta(true, false));
    }

    #[test]
    fn test_anulado_delta_idempotente_activo() {
        assert!(!anulado_delta(false, false));
    }

    #[test]
    fn test_remota_mas_nueva_lww() {
        assert!(remota_mas_nueva("2026-08-13T12:00:00Z", "2026-08-13T11:00:00Z"));
        assert!(!remota_mas_nueva("2026-08-13T11:00:00Z", "2026-08-13T12:00:00Z"));
        assert!(!remota_mas_nueva("2026-08-13T11:00:00Z", "2026-08-13T11:00:00Z"));
    }

    #[test]
    fn test_remota_mas_nueva_timestamps_vacios() {
        assert!(!remota_mas_nueva("", "2026-08-13T12:00:00Z"));
        assert!(remota_mas_nueva("2026-08-13T12:00:00Z", ""));
        assert!(!remota_mas_nueva("", ""));
    }
}
