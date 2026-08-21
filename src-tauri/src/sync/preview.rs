use super::products::resolver_categoria_por_nombre;
use super::sales::apply_remote_sales;
use super::{api_url, supabase_get_paginated, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use tauri::State;

#[derive(Serialize, Clone)]
pub struct FieldDiff {
    pub campo: String,
    pub local: String,
    pub remoto: String,
}

#[derive(Serialize, Clone)]
pub struct PreviewItem {
    pub tipo: String,       // "producto" | "cliente" | "venta"
    pub sync_id: String,
    pub nombre: String,
    pub local_ts: String,
    pub remote_ts: String,
    pub campos: Vec<FieldDiff>,
}

#[derive(Serialize)]
pub struct PreviewResult {
    pub productos: Vec<PreviewItem>,
    pub clientes: Vec<PreviewItem>,
    pub ventas: Vec<PreviewItem>,
    pub total: usize,
}

#[derive(Deserialize)]
pub struct ApplyChange {
    pub tipo: String,
    pub sync_id: String,
}

fn fmt_num(v: &serde_json::Value) -> String {
    if let Some(n) = v.as_f64() {
        if (n - n.round()).abs() < 1e-9 {
            format!("{}", n.round() as i64)
        } else {
            format!("{:.2}", n)
        }
    } else {
        String::new()
    }
}

fn fmt_bool(v: &serde_json::Value) -> String {
    if v.as_i64().unwrap_or(1) != 0 {
        "Sí".to_string()
    } else {
        "No".to_string()
    }
}

/// Descarga TODOS los productos/clientes de Supabase (ignora watermark, mantiene
/// `dispositivo_origen != local`) y devuelve el diff campo a campo contra lo local.
/// No escribe nada en la BD: es solo vista previa para el modal de descarga selectiva.
/// `ventas_desde`/`ventas_hasta` (opcional, `YYYY-MM-DD`) filtran por `fecha_hora`.
#[tauri::command]
pub fn preview_download(
    state: State<AppState>,
    ventas_desde: Option<String>,
    ventas_hasta: Option<String>,
) -> Result<PreviewResult, String> {
    crate::auth::check_employee_role(&state)?;
    // T1: NO mantener lock_db durante el HTTP (congelaba el POS ~90s). Se lee
    // config con lock corto, se hace toda la red sin lock, y los reads locales
    // vuelven a tomar lock solo en bloques scoped.
    let (supabase_url, supabase_key, dispositivo_id) = {
        let db = state.lock_db()?;
        let (u, k) = super::supabase_config(&db)?;
        (u, k, super::get_config(&db, constants::CFG_DISPOSITIVO_ID)?)
    };

    let mut productos = Vec::new();
    let mut clientes = Vec::new();

    // ---------- Productos ----------
    let prod_url = api_url(
        &supabase_url,
        &format!(
            "/productos?or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=codigo,nombre,precio_usd,costo,stock,stock_minimo,activo,categoria_id,categoria_nombre,es_inari,subcategoria,updated_at,dispositivo_origen",
            urlencoding(&dispositivo_id),
        ),
    );
let cloud_products: Vec<serde_json::Value> = supabase_get_paginated(&prod_url, &supabase_key, "codigo")?;

    let local_prod: HashMap<String, (String, String, f64, f64, i64, i64, i64, Option<i64>, i64, String)> = {
        let db = state.lock_db()?;
        let mut stmt = db
            .prepare(
                "SELECT codigo, updated_at, nombre, precio_usd, COALESCE(costo,0), stock, stock_minimo, activo, \
                 categoria_id, COALESCE(es_inari,0), COALESCE(subcategoria,'') FROM productos",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    row.get::<_, String>(2)?,
                    row.get::<_, f64>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, i64>(6)?,
                    row.get::<_, i64>(7)?,
                    row.get::<_, Option<i64>>(8)?,
                    row.get::<_, i64>(9)?,
                    row.get::<_, String>(10)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut map = HashMap::new();
        for (codigo, updated_at, nombre, precio, costo, stock, stock_min, activo, cat_id, es_inari, subcategoria) in rows {
            map.insert(codigo, (updated_at, nombre, precio, costo, stock, stock_min, activo, cat_id, es_inari, subcategoria));
        }
        map
    };

    for prod in &cloud_products {
        let codigo = prod["codigo"].as_str().unwrap_or_default().to_string();
        if codigo.is_empty() {
            continue;
        }
        let nombre = prod["nombre"].as_str().unwrap_or_default().to_string();
        let remote_ts = prod["updated_at"].as_str().unwrap_or("").to_string();
        let precio_usd = prod["precio_usd"].as_f64().unwrap_or(0.0);
        let costo = prod["costo"].as_f64().unwrap_or(0.0);
        let stock = prod["stock"].as_i64().unwrap_or(0);
        let stock_min = prod["stock_minimo"].as_i64().unwrap_or(0);
        let activo = prod["activo"].as_i64().unwrap_or(1);
        let es_inari = prod["es_inari"].as_i64().unwrap_or(0);
        let subcategoria = prod["subcategoria"].as_str().unwrap_or("").to_string();

        let mut campos = Vec::new();
        match local_prod.get(&codigo) {
            Some((local_ts, l_nombre, l_precio, l_costo, l_stock, l_stock_min, l_activo, _l_cat, l_es_inari, l_subcategoria)) => {
                if l_nombre != &nombre {
                    campos.push(FieldDiff { campo: "nombre".into(), local: l_nombre.clone(), remoto: nombre.clone() });
                }
                if (*l_precio - precio_usd).abs() > 1e-9 {
                    campos.push(FieldDiff { campo: "precio".into(), local: fmt_num(&json!(*l_precio)), remoto: fmt_num(&json!(precio_usd)) });
                }
                if (*l_costo - costo).abs() > 1e-9 {
                    campos.push(FieldDiff { campo: "costo".into(), local: fmt_num(&json!(*l_costo)), remoto: fmt_num(&json!(costo)) });
                }
                if *l_stock != stock {
                    campos.push(FieldDiff { campo: "stock".into(), local: fmt_num(&json!(*l_stock)), remoto: fmt_num(&json!(stock)) });
                }
                if *l_stock_min != stock_min {
                    campos.push(FieldDiff { campo: "stock_minimo".into(), local: fmt_num(&json!(*l_stock_min)), remoto: fmt_num(&json!(stock_min)) });
                }
                if *l_activo != activo {
                    campos.push(FieldDiff { campo: "activo".into(), local: fmt_bool(&json!(*l_activo)), remoto: fmt_bool(&json!(activo)) });
                }
                if *l_es_inari != es_inari {
                    campos.push(FieldDiff { campo: "es_inari".into(), local: fmt_bool(&json!(*l_es_inari)), remoto: fmt_bool(&json!(es_inari)) });
                }
                if l_subcategoria != &subcategoria {
                    campos.push(FieldDiff { campo: "subcategoria".into(), local: l_subcategoria.clone(), remoto: subcategoria.clone() });
                }
                if !campos.is_empty() {
                    productos.push(PreviewItem {
                        tipo: "producto".into(),
                        sync_id: codigo,
                        nombre,
                        local_ts: local_ts.clone(),
                        remote_ts,
                        campos,
                    });
                }
            }
            None => {
                // Producto nuevo: todos los campos se tratan como insert.
                let all = vec![
                    FieldDiff { campo: "nombre".into(), local: "—".into(), remoto: nombre.clone() },
                    FieldDiff { campo: "precio".into(), local: "—".into(), remoto: fmt_num(&json!(precio_usd)) },
                    FieldDiff { campo: "stock".into(), local: "—".into(), remoto: fmt_num(&json!(stock)) },
                ];
                productos.push(PreviewItem {
                    tipo: "producto".into(),
                    sync_id: codigo,
                    nombre,
                    local_ts: String::new(),
                    remote_ts,
                    campos: all,
                });
            }
        }
    }
    drop(local_prod);

    // ---------- Clientes ----------
    let cli_url = api_url(
        &supabase_url,
        &format!(
            "/clientes?or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=*",
            urlencoding(&dispositivo_id),
        ),
    );
let cloud_clientes: Vec<serde_json::Value> = supabase_get_paginated(&cli_url, &supabase_key, "id")?;

    let local_cli: HashMap<String, (String, String, i64, f64, i64)> = {
        let db = state.lock_db()?;
        let mut stmt = db
            .prepare(
                "SELECT sync_id, updated_at, nombre, credito_activo, saldo_deuda_usd, COALESCE(activo,1) \
                 FROM clientes WHERE sync_id IS NOT NULL AND sync_id != ''",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, i64>(5)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut map = HashMap::new();
        for (sid, updated_at, nombre, credito, saldo, activo) in rows {
            map.insert(sid, (updated_at, nombre, credito, saldo, activo));
        }
        map
    };

    for cli in &cloud_clientes {
        let sync_id = cli["sync_id"].as_str().unwrap_or("").to_string();
        if sync_id.is_empty() {
            continue;
        }
        let nombre = cli["nombre"].as_str().unwrap_or_default().to_string();
        let remote_ts = cli["updated_at"].as_str().unwrap_or("").to_string();
        let credito = cli["credito_activo"].as_i64().unwrap_or(1);
        let saldo = cli["saldo_deuda_usd"].as_f64().unwrap_or(0.0);
        // Supabase usa `deleted` (0=activo, 1=borrado) en vez de `activo`.
        let deleted = cli["deleted"].as_i64().unwrap_or(0);
        let activo: i64 = if deleted == 1 { 0 } else { 1 };

        let mut campos = Vec::new();
        match local_cli.get(&sync_id) {
            Some((local_ts, l_nombre, l_credito, l_saldo, l_activo)) => {
                if l_nombre != &nombre {
                    campos.push(FieldDiff { campo: "nombre".into(), local: l_nombre.clone(), remoto: nombre.clone() });
                }
                if *l_credito != credito {
                    campos.push(FieldDiff { campo: "credito_activo".into(), local: fmt_bool(&json!(*l_credito)), remoto: fmt_bool(&json!(credito)) });
                }
                if (*l_saldo - saldo).abs() > 1e-9 {
                    campos.push(FieldDiff { campo: "saldo_deuda_usd".into(), local: fmt_num(&json!(*l_saldo)), remoto: fmt_num(&json!(saldo)) });
                }
                if *l_activo != activo {
                    campos.push(FieldDiff { campo: "activo".into(), local: fmt_bool(&json!(*l_activo)), remoto: fmt_bool(&json!(activo)) });
                }
                if !campos.is_empty() {
                    clientes.push(PreviewItem {
                        tipo: "cliente".into(),
                        sync_id,
                        nombre,
                        local_ts: local_ts.clone(),
                        remote_ts,
                        campos,
                    });
                }
            }
            None => {
                let all = vec![
                    FieldDiff { campo: "nombre".into(), local: "—".into(), remoto: nombre.clone() },
                    FieldDiff { campo: "saldo_deuda_usd".into(), local: "—".into(), remoto: fmt_num(&json!(saldo)) },
                ];
                clientes.push(PreviewItem {
                    tipo: "cliente".into(),
                    sync_id,
                    nombre,
                    local_ts: String::new(),
                    remote_ts,
                    campos: all,
                });
            }
        }
    }
    drop(local_cli);

    // ---------- Ventas ----------
    let mut ventas = Vec::new();
    let mut vent_filters = String::new();
    if let Some(d) = &ventas_desde {
        if !d.is_empty() {
            vent_filters.push_str(&format!("&fecha_hora=gte.{}", urlencoding(d.trim())));
        }
    }
    if let Some(h) = &ventas_hasta {
        if !h.is_empty() {
            vent_filters.push_str(&format!("&fecha_hora=lte.{}", urlencoding(h.trim())));
        }
    }
    let vent_url = api_url(
        &supabase_url,
        &format!(
            "/ventas?or=(dispositivo_origen.is.null,dispositivo_origen.neq.{}){}&select=id,fecha_hora,metodo_pago,total_usd,total_bs,anulada,updated_at",
            urlencoding(&dispositivo_id),
            vent_filters,
        ),
    );
    let cloud_ventas: Vec<serde_json::Value> = supabase_get_paginated(&vent_url, &supabase_key, "id")?;

    let local_vent: HashMap<String, (String, String, String, f64, f64, i64)> = {
        let db = state.lock_db()?;
        let mut stmt = db
            .prepare(
                "SELECT sync_id, COALESCE(updated_at,''), fecha_hora, metodo_pago, total_usd, total_bs, \
                 COALESCE(anulada,0) FROM ventas WHERE sync_id IS NOT NULL AND sync_id != ''",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?,
                    row.get::<_, f64>(5)?,
                    row.get::<_, i64>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok());
        let mut map = HashMap::new();
        for (sid, updated_at, fecha, metodo, total_usd, total_bs, anulada) in rows {
            map.insert(sid, (updated_at, fecha, metodo, total_usd, total_bs, anulada));
        }
        map
    };

    for vent in &cloud_ventas {
        let sync_id = vent["id"].as_str().unwrap_or("").to_string();
        if sync_id.is_empty() {
            continue;
        }
        let fecha = vent["fecha_hora"].as_str().unwrap_or("").to_string();
        let nombre = format!("Venta del {}", if fecha.is_empty() { "—".to_string() } else { fecha.clone() });
        let remote_ts = vent["updated_at"].as_str().unwrap_or("").to_string();
        let metodo = vent["metodo_pago"].as_str().unwrap_or("").to_string();
        let total_usd = vent["total_usd"].as_f64().unwrap_or(0.0);
        let total_bs = vent["total_bs"].as_f64().unwrap_or(0.0);
        let anulada = vent["anulada"].as_i64().unwrap_or(0);

        let mut campos = Vec::new();
        match local_vent.get(&sync_id) {
            Some((_lts, _l_fecha, l_metodo, l_usd, l_bs, l_anulada)) => {
                if l_anulada != &anulada {
                    campos.push(FieldDiff { campo: "anulada".into(), local: fmt_bool(&json!(*l_anulada)), remoto: fmt_bool(&json!(anulada)) });
                }
                if (*l_usd - total_usd).abs() > 1e-9 {
                    campos.push(FieldDiff { campo: "total_usd".into(), local: fmt_num(&json!(*l_usd)), remoto: fmt_num(&json!(total_usd)) });
                }
                if (*l_bs - total_bs).abs() > 1e-9 {
                    campos.push(FieldDiff { campo: "total_bs".into(), local: fmt_num(&json!(*l_bs)), remoto: fmt_num(&json!(total_bs)) });
                }
                if l_metodo != &metodo {
                    campos.push(FieldDiff { campo: "metodo_pago".into(), local: l_metodo.clone(), remoto: metodo });
                }
                if !campos.is_empty() {
                    let local_ts = local_vent[&sync_id].0.clone();
                    ventas.push(PreviewItem {
                        tipo: "venta".into(),
                        sync_id,
                        nombre,
                        local_ts,
                        remote_ts,
                        campos,
                    });
                }
            }
            None => {
                let all = vec![
                    FieldDiff { campo: "fecha_hora".into(), local: "—".into(), remoto: fecha },
                    FieldDiff { campo: "total_usd".into(), local: "—".into(), remoto: fmt_num(&json!(total_usd)) },
                    FieldDiff { campo: "total_bs".into(), local: "—".into(), remoto: fmt_num(&json!(total_bs)) },
                ];
                ventas.push(PreviewItem {
                    tipo: "venta".into(),
                    sync_id,
                    nombre,
                    local_ts: String::new(),
                    remote_ts,
                    campos: all,
                });
            }
        }
    }
    drop(local_vent);

    let total = productos.len() + clientes.len() + ventas.len();
    Ok(PreviewResult { productos, clientes, ventas, total })
}

/// Aplica solo los cambios seleccionados por el usuario (LWW: remoto solo gana si
/// `remote_ts > local_ts`, o si es insert). Si `force` es true se ignora la fecha
/// y el remoto siempre gana (usado para corregir datos locales obsoletos).
/// `changes` es la lista de {tipo, sync_id} marcados en el modal de descarga selectiva.
#[tauri::command]
pub fn apply_download(state: State<AppState>, changes: Vec<ApplyChange>, force: bool) -> Result<String, String> {
    crate::auth::check_employee_role(&state)?;
    let mut db = state.secondary_conn()?;
    let (supabase_url, supabase_key) = super::supabase_config(&db)?;
    let dispositivo_id = super::get_config(&db, constants::CFG_DISPOSITIVO_ID)?;

    // Primer sync del dispositivo: el remoto SIEMPRE gana (LWW off), igual que en
    // apply_remote_sales/download_products/download_clientes, para sanar la BD local.
    let first_sync = super::get_config(&db, constants::CFG_FIRST_SYNC_DONE)
        .unwrap_or_default()
        .is_empty();

    let mut wanted_prod: Vec<&str> = Vec::new();
    let mut wanted_cli: Vec<&str> = Vec::new();
    let mut wanted_ventas: Vec<&str> = Vec::new();
    for c in &changes {
        match c.tipo.as_str() {
            "producto" => wanted_prod.push(&c.sync_id),
            "cliente" => wanted_cli.push(&c.sync_id),
            "venta" => wanted_ventas.push(&c.sync_id),
            _ => {}
        }
    }

    let mut applied_prod = 0usize;
    let mut applied_cli = 0usize;
    let mut skipped = 0usize;
    let mut ventas_msg = String::new();

    // ---------- Productos ----------
    // T2: el HTTP se hace FUERA de la tx; los writes aplican dentro de una
    // tx corta por etapa (patrón del orchestrator). NO mantener una tx abierta
    // durante las llamadas de red (SQLITE_BUSY en el POS).
    if !wanted_prod.is_empty() {
        let prod_url = api_url(
            &supabase_url,
            &format!(
"/productos?or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=codigo,nombre,precio_usd,costo,stock,stock_minimo,activo,categoria_id,categoria_nombre,es_inari,subcategoria,updated_at,dispositivo_origen",
                urlencoding(&dispositivo_id),
            ),
        );
let cloud_products: Vec<serde_json::Value> = supabase_get_paginated(&prod_url, &supabase_key, "codigo")?;

        // Local map: sync_id (codigo) -> updated_at (lectura sin tx)
        let mut local_ts: HashMap<String, String> = HashMap::new();
        {
            let mut stmt = db
                .prepare("SELECT codigo, COALESCE(updated_at,'') FROM productos")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                .map_err(|e| e.to_string())?;
            for r in rows.filter_map(|r| r.ok()) {
                local_ts.insert(r.0, r.1);
            }
        }

        let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
        for prod in &cloud_products {
            let codigo = prod["codigo"].as_str().unwrap_or_default();
            if !wanted_prod.contains(&codigo) {
                continue;
            }
            let remote_ts = prod["updated_at"].as_str().unwrap_or("");
            let exists = local_ts.contains_key(codigo);
            // LWW off en el primer sync (igual que download_products_inner).
            if exists && !force && !first_sync {
                let lts = local_ts.get(codigo).cloned().unwrap_or_default();
                if !lts.is_empty() && remote_ts <= lts.as_str() {
                    skipped += 1;
                    continue;
                }
            }
            let rows = if exists {
                let cat_nombre = prod["categoria_nombre"].as_str().unwrap_or("");
                let cat_id_uso: Option<i64> = if cat_nombre.trim().is_empty() {
                    prod["categoria_id"].as_i64()
                } else {
                    resolver_categoria_por_nombre(&tx, cat_nombre)?
                };
                tx.execute(
                    "UPDATE productos SET nombre = ?1, precio_usd = ?2, costo = ?3, stock = ?4, \
                     stock_minimo = ?5, activo = ?6, categoria_id = ?7, es_inari = ?8, subcategoria = ?9, updated_at = ?10 \
                     WHERE codigo = ?11",
                    params![
                        prod["nombre"].as_str().unwrap_or(""),
                        prod["precio_usd"].as_f64().unwrap_or(0.0),
                        prod["costo"].as_f64().unwrap_or(0.0),
                        prod["stock"].as_i64().unwrap_or(0),
                        prod["stock_minimo"].as_i64().unwrap_or(0),
                        prod["activo"].as_i64().unwrap_or(1),
                        cat_id_uso,
                        prod["es_inari"].as_i64().unwrap_or(0),
                        prod["subcategoria"].as_str().unwrap_or(""),
                        remote_ts,
                        codigo,
                    ],
                )
.map_err(|e| format!("Error actualizando producto: {}", e))?
            } else {
                let cat_nombre = prod["categoria_nombre"].as_str().unwrap_or("");
                let cat_id_uso: Option<i64> = if cat_nombre.trim().is_empty() {
                    prod["categoria_id"].as_i64()
                } else {
                    resolver_categoria_por_nombre(&tx, cat_nombre)?
                };
                tx.execute(
                    "INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, costo, stock, stock_minimo, \
                     activo, categoria_id, es_inari, subcategoria, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    params![
                        codigo,
                        prod["nombre"].as_str().unwrap_or(""),
                        prod["precio_usd"].as_f64().unwrap_or(0.0),
                        prod["costo"].as_f64().unwrap_or(0.0),
                        prod["stock"].as_i64().unwrap_or(0),
                        prod["stock_minimo"].as_i64().unwrap_or(0),
                        prod["activo"].as_i64().unwrap_or(1),
                        cat_id_uso,
                        prod["es_inari"].as_i64().unwrap_or(0),
                        prod["subcategoria"].as_str().unwrap_or(""),
                        &remote_ts,
                        &remote_ts,
                    ],
                )
                .map_err(|e| format!("Error insertando producto: {}", e))?
            };
            if rows > 0 {
                applied_prod += 1;
            }
        }
        tx.commit().map_err(|e| format!("Error al confirmar productos: {}", e))?;
    }

    // ---------- Clientes ----------
    if !wanted_cli.is_empty() {
        let cli_url = api_url(
            &supabase_url,
            &format!(
                "/clientes?or=(dispositivo_origen.is.null,dispositivo_origen.neq.{})&select=*",
                urlencoding(&dispositivo_id),
            ),
        );
let cloud_clientes: Vec<serde_json::Value> = supabase_get_paginated(&cli_url, &supabase_key, "id")?;

        let mut local_ts: HashMap<String, String> = HashMap::new();
        {
            let mut stmt = db
                .prepare("SELECT sync_id, COALESCE(updated_at,'') FROM clientes WHERE sync_id IS NOT NULL AND sync_id != ''")
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
                .map_err(|e| e.to_string())?;
            for r in rows.filter_map(|r| r.ok()) {
                local_ts.insert(r.0, r.1);
            }
        }

        let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
        for cli in &cloud_clientes {
            let sync_id = cli["sync_id"].as_str().unwrap_or("");
            if !wanted_cli.contains(&sync_id) {
                continue;
            }
            let remote_ts = cli["updated_at"].as_str().unwrap_or("");
            let exists = local_ts.contains_key(sync_id);
            // LWW off en el primer sync (igual que download_clientes_inner).
            if exists && !force && !first_sync {
                let lts = local_ts.get(sync_id).cloned().unwrap_or_default();
                if !lts.is_empty() && remote_ts <= lts.as_str() {
                    skipped += 1;
                    continue;
                }
            }
            let rows = if exists {
                tx.execute(
                    "UPDATE clientes SET nombre = ?1, credito_activo = ?2, saldo_deuda_usd = ?3, \
                     activo = ?4, updated_at = ?5 WHERE sync_id = ?6",
                    params![
                        cli["nombre"].as_str().unwrap_or(""),
                        cli["credito_activo"].as_i64().unwrap_or(1),
                        cli["saldo_deuda_usd"].as_f64().unwrap_or(0.0),
                        if cli["deleted"].as_i64().unwrap_or(0) == 1 { 0 } else { 1 },
                        remote_ts,
                        sync_id,
                    ],
                )
                .map_err(|e| format!("Error actualizando cliente: {}", e))?
            } else {
                tx.execute(
                    "INSERT OR IGNORE INTO clientes (nombre, credito_activo, saldo_deuda_usd, sync_id, \
                     activo, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
                    params![
                        cli["nombre"].as_str().unwrap_or(""),
                        cli["credito_activo"].as_i64().unwrap_or(1),
                        cli["saldo_deuda_usd"].as_f64().unwrap_or(0.0),
                        sync_id,
                        if cli["deleted"].as_i64().unwrap_or(0) == 1 { 0 } else { 1 },
                        remote_ts,
                    ],
                )
                .map_err(|e| format!("Error insertando cliente: {}", e))?
            };
            if rows > 0 {
                applied_cli += 1;
            }
        }
        tx.commit().map_err(|e| format!("Error al confirmar clientes: {}", e))?;
    }

    // ---------- Ventas ----------
    if !wanted_ventas.is_empty() {
        let wanted_set: std::collections::HashSet<String> =
            wanted_ventas.iter().map(|s| s.to_string()).collect();
        // apply_remote_sales hace su propio HTTP (ventas + detalles chunked);
        // se le pasa una tx corta para que sus writes sean atómicos y se
        // libere el lock antes de las siguientes etapas.
        let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
        ventas_msg = apply_remote_sales(
            &tx,
            &supabase_url,
            &supabase_key,
            &dispositivo_id,
            Some(&wanted_set),
            false,
        )?;
        tx.commit().map_err(|e| format!("Error al confirmar ventas: {}", e))?;
    }

    let mut parts: Vec<String> = Vec::new();
    if applied_prod > 0 {
        parts.push(format!("{} producto(s)", applied_prod));
    }
    if applied_cli > 0 {
        parts.push(format!("{} cliente(s)", applied_cli));
    }
    if !ventas_msg.is_empty() && ventas_msg != "No hay ventas nuevas para descargar" {
        parts.push(ventas_msg);
    }
    if skipped > 0 {
        parts.push(format!("{} omitido(s) (local más reciente)", skipped));
    }
    if parts.is_empty() {
        return Ok("Sin cambios aplicados".to_string());
    }
    Ok(format!("Cambios aplicados: {}.", parts.join(", ")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_fmt_num_entero() {
        assert_eq!(fmt_num(&json!(5)), "5");
    }

    #[test]
    fn test_fmt_num_decimal() {
        assert_eq!(fmt_num(&json!(3.5)), "3.50");
    }

#[test]
    fn test_fmt_num_entero_con_punto_flotante() {
        // un valor que es entero pero llega como float (ej. 5.0) se muestra "5"
        assert_eq!(fmt_num(&json!(5.0)), "5");
    }

    #[test]
    fn test_fmt_bool_si_no() {
        assert_eq!(fmt_bool(&json!(1)), "Sí");
        assert_eq!(fmt_bool(&json!(0)), "No");
    }
}
