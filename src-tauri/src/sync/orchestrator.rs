use super::clients::{download_clientes_inner, upload_clientes_inner};
use super::products::{download_products_inner, upload_products_inner};
use super::sales::{download_sales_inner, upload_sales_inner};
use super::{api_url, emit_progress, get_config, supabase_config, supabase_get, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use serde::Serialize;
use serde_json::json;
use tauri::State;

fn get_fingerprint() -> Result<String, String> {
    #[cfg(target_os = "linux")]
    {
        let id = std::fs::read_to_string("/etc/machine-id")
            .map_err(|e| format!("Error leyendo machine-id: {}", e))?;
        Ok(format!("linux-{}", id.trim()))
    }

    #[cfg(target_os = "android")]
    {
        use std::process::Command;
        let serial = Command::new("getprop")
            .arg("ro.serialno")
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            })
            .filter(|s| !s.is_empty());

        if let Some(s) = serial {
            return Ok(format!("android-{}", s));
        }

        let model = Command::new("getprop")
            .arg("ro.product.model")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default();
        let board = Command::new("getprop")
            .arg("ro.product.board")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default();
        let dev = Command::new("getprop")
            .arg("ro.product.device")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_default();

        let raw = format!("{}-{}-{}", model.trim(), board.trim(), dev.trim());
        if raw.len() > 3 {
            Ok(format!("android-{}", short_hash(&raw)))
        } else {
            Err("No se pudo obtener huella del dispositivo".to_string())
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let output = Command::new("wmic")
            .args(["csproduct", "get", "uuid"])
            .output()
            .map_err(|e| format!("Error obteniendo UUID: {}", e))?;
        let text = String::from_utf8_lossy(&output.stdout);
        let uuid = text.lines().nth(1).unwrap_or("").trim();
        if uuid.is_empty() {
            return Err("No se pudo obtener UUID del hardware".to_string());
        }
        Ok(format!("windows-{}", uuid))
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        let output = Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
            .map_err(|e| format!("Error obteniendo UUID: {}", e))?;
        let text = String::from_utf8_lossy(&output.stdout);
        for line in text.lines() {
            if line.contains("IOPlatformUUID") {
                if let Some(val) = line.split('=').nth(1) {
                    let uuid = val.trim().trim_matches('"');
                    if !uuid.is_empty() {
                        return Ok(format!("macos-{}", uuid));
                    }
                }
            }
        }
        Err("No se encontró IOPlatformUUID".to_string())
    }
}

#[cfg(target_os = "android")]
fn short_hash(input: &str) -> String {
    use sha2::Digest;
    let digest = sha2::Sha256::digest(input.as_bytes());
    digest[..8].iter().map(|b| format!("{:02x}", b)).collect()
}

#[tauri::command]
pub fn register_device(state: State<AppState>, nombre: String) -> Result<String, String> {
    let db = state.lock_db()?;

    let (supabase_url, supabase_key) = supabase_config(&db)?;

    if let Ok(id) = super::get_config(&db, constants::CFG_DISPOSITIVO_ID) {
        return Ok(format!("Ya registrado: {}", id));
    }

    let huella = get_fingerprint()?;
    let encoded_huella = urlencoding(&huella);

    let search_url = api_url(
        &supabase_url,
        &format!("/dispositivos?huella=eq.{}&select=id", encoded_huella),
    );

    let existing = supabase_get(&search_url, &supabase_key)
        .unwrap_or_default();

    if let Some(device) = existing.first() {
        if let Some(existing_id) = device["id"].as_str() {
            upsert_config(&db, constants::CFG_DISPOSITIVO_ID, existing_id);
            return Ok(format!("Dispositivo recuperado: {}", existing_id));
        }
    }

    let body = json!({"nombre": nombre, "huella": huella}).to_string();
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
    let db = state.lock_db()?;
    match super::get_config(&db, constants::CFG_ULTIMO_UPLOAD) {
        Ok(v) => Ok(v),
        Err(_) => Ok("Nunca".to_string()),
    }
}

#[tauri::command]
pub fn get_ultimo_download(state: State<AppState>) -> Result<String, String> {
    let db = state.lock_db()?;
    match super::get_config(&db, constants::CFG_ULTIMO_DOWNLOAD) {
        Ok(v) => Ok(v),
        Err(_) => Ok("Nunca".to_string()),
    }
}

#[tauri::command]
pub fn upload_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    let db = state.secondary_conn()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
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

    let (supabase_url, supabase_key) = supabase_config(&tx)?;
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

    let (supabase_url, supabase_key) = supabase_config(&tx)?;
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
    let db = state.lock_db()?;

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
pub fn list_dispositivos(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let db = state.lock_db()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
    let get_url = api_url(&supabase_url, "/dispositivos?select=*");
    supabase_get(&get_url, &supabase_key)
}

#[tauri::command]
pub fn test_supabase_connection(state: State<AppState>) -> Result<bool, String> {
    let db = state.lock_db()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;

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
