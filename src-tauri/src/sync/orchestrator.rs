use super::clients::{download_clientes_inner, upload_clientes_inner};
use super::products::{download_products_inner, upload_products_inner};
use super::sales::{download_sales_inner, upload_sales_inner};
use super::{api_url, emit_progress, get_config, upsert_config};
use crate::constants;
use crate::db::AppState;
use serde::Serialize;
use serde_json::json;
use tauri::State;

#[tauri::command]
pub fn register_device(state: State<AppState>, nombre: String) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let supabase_url = get_config(&db, constants::CFG_SUPABASE_URL)?;
    let supabase_key = get_config(&db, constants::CFG_SUPABASE_KEY)?;

    if let Ok(id) = super::get_config(&db, constants::CFG_DISPOSITIVO_ID) {
        return Ok(format!("Ya registrado: {}", id));
    }

    let body = json!({"nombre": nombre}).to_string();
    let resp = ureq::post(&api_url(&supabase_url, "/dispositivos"))
        .set("apikey", &supabase_key)
        .set("Authorization", &format!("Bearer {}", &supabase_key))
        .set("Content-Type", "application/json")
        .set("Prefer", "return=representation")
        .send_string(&body)
        .map_err(|e| format!("Error registrando dispositivo: {}", e))?;

    if resp.status() < 200 || resp.status() >= 300 {
        let text = resp.into_string().unwrap_or_default();
        return Err(format!("Error HTTP (registro): {}", text));
    }

    let json: serde_json::Value = resp
        .into_json()
        .map_err(|e| format!("Error leyendo respuesta: {}", e))?;
    let new_id = json[0]["id"].as_str().unwrap_or("").to_string();

    if new_id.is_empty() {
        return Err("No se recibió ID del dispositivo".to_string());
    }

    upsert_config(&db, constants::CFG_DISPOSITIVO_ID, &new_id);

    Ok(format!("Dispositivo registrado: {}", new_id))
}

#[tauri::command]
pub fn get_ultimo_upload(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    match super::get_config(&db, constants::CFG_ULTIMO_UPLOAD) {
        Ok(v) => Ok(v),
        Err(_) => Ok("Nunca".to_string()),
    }
}

#[tauri::command]
pub fn get_ultimo_download(state: State<AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    match super::get_config(&db, constants::CFG_ULTIMO_DOWNLOAD) {
        Ok(v) => Ok(v),
        Err(_) => Ok("Nunca".to_string()),
    }
}

#[tauri::command]
pub fn upload_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let db = state.secondary_conn()?;
    let supabase_url = get_config(&db, constants::CFG_SUPABASE_URL)?;
    let supabase_key = get_config(&db, constants::CFG_SUPABASE_KEY)?;
    let dispositivo_id = get_config(&db, constants::CFG_DISPOSITIVO_ID)?;

    let total = 3u32;
    emit_progress(&app_handle, "Subiendo productos...", 1, total);
    let r1 = upload_products_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;
    emit_progress(&app_handle, "Subiendo clientes...", 2, total);
    let r2 = upload_clientes_inner(&db, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Subiendo ventas...", 3, total);
    let r3 = upload_sales_inner(&db, &supabase_url, &supabase_key, &dispositivo_id)?;

    Ok(format!("{}\n{}\n{}", r1, r2, r3))
}

#[tauri::command]
pub fn download_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let mut db = state.secondary_conn()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let supabase_url = get_config(&tx, constants::CFG_SUPABASE_URL)?;
    let supabase_key = get_config(&tx, constants::CFG_SUPABASE_KEY)?;
    let dispositivo_id = get_config(&tx, constants::CFG_DISPOSITIVO_ID).unwrap_or_default();

    let total = 3u32;
    emit_progress(&app_handle, "Descargando productos...", 1, total);
    let r1 = download_products_inner(&tx, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando clientes...", 2, total);
    let r2 = download_clientes_inner(&tx, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando ventas...", 3, total);
    let r3 = download_sales_inner(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;

    tx.commit().map_err(|e| format!("Error al confirmar descarga: {}", e))?;
    Ok(format!("{}\n{}\n{}", r1, r2, r3))
}

#[tauri::command]
pub fn sync_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let mut db = state.secondary_conn()?;
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    let supabase_url = get_config(&tx, constants::CFG_SUPABASE_URL)?;
    let supabase_key = get_config(&tx, constants::CFG_SUPABASE_KEY)?;
    let dispositivo_id = get_config(&tx, constants::CFG_DISPOSITIVO_ID)?;

    let total = 6u32;
    emit_progress(&app_handle, "Subiendo productos...", 1, total);
    let r1 = upload_products_inner(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
    emit_progress(&app_handle, "Subiendo clientes...", 2, total);
    let r2 = upload_clientes_inner(&tx, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Subiendo ventas...", 3, total);
    let r3 = upload_sales_inner(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
    emit_progress(&app_handle, "Descargando productos...", 4, total);
    let r4 = download_products_inner(&tx, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando clientes...", 5, total);
    let r5 = download_clientes_inner(&tx, &supabase_url, &supabase_key)?;
    emit_progress(&app_handle, "Descargando ventas...", 6, total);
    let r6 = download_sales_inner(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;

    tx.commit().map_err(|e| format!("Error al confirmar sincronización: {}", e))?;
    Ok(format!("{}\n{}\n{}\n{}\n{}\n{}", r1, r2, r3, r4, r5, r6))
}

#[derive(Serialize)]
pub struct SyncStats {
    active_products: i64,
    total_clientes: i64,
    total_sales: i64,
    ultimo_upload: String,
    ultimo_download: String,
    ultimo_upload_ventas: String,
    ultimo_download_ventas: String,
    ultimo_upload_clientes: String,
    ultimo_download_clientes: String,
    dispositivo_id: String,
}

#[tauri::command]
pub fn get_sync_stats(state: State<AppState>) -> Result<SyncStats, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;

    let active_products: i64 = db
        .query_row("SELECT COUNT(*) FROM productos WHERE activo = 1", [], |r| r.get(0))
        .unwrap_or(0);
    let total_clientes: i64 = db
        .query_row("SELECT COUNT(*) FROM clientes", [], |r| r.get(0))
        .unwrap_or(0);
    let total_sales: i64 = db
        .query_row("SELECT COUNT(*) FROM ventas", [], |r| r.get(0))
        .unwrap_or(0);

    let gc = |key: &str| -> String {
        db.query_row(
            "SELECT valor FROM configuracion WHERE clave = ?1",
            rusqlite::params![key],
            |r| r.get::<_, String>(0),
        )
        .unwrap_or_default()
    };

    Ok(SyncStats {
        active_products,
        total_clientes,
        total_sales,
        ultimo_upload: gc(constants::CFG_ULTIMO_UPLOAD),
        ultimo_download: gc(constants::CFG_ULTIMO_DOWNLOAD),
        ultimo_upload_ventas: gc(constants::CFG_ULTIMO_UPLOAD_VENTAS),
        ultimo_download_ventas: gc(constants::CFG_ULTIMO_DOWNLOAD_VENTAS),
        ultimo_upload_clientes: gc(constants::CFG_ULTIMO_UPLOAD_CLIENTES),
        ultimo_download_clientes: gc(constants::CFG_ULTIMO_DOWNLOAD_CLIENTES),
        dispositivo_id: gc(constants::CFG_DISPOSITIVO_ID),
    })
}

#[tauri::command]
pub fn test_supabase_connection(state: State<AppState>) -> Result<bool, String> {
    let db = state.db.lock().map_err(|e| format!("Error de acceso: {}", e))?;
    let supabase_url = get_config(&db, constants::CFG_SUPABASE_URL)?;
    let supabase_key = get_config(&db, constants::CFG_SUPABASE_KEY)?;

    let test_url = api_url(&supabase_url, "/productos?select=codigo&limit=1");

    match ureq::get(&test_url)
        .set("apikey", &supabase_key)
        .set("Authorization", &format!("Bearer {}", &supabase_key))
        .call()
    {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
