use super::alertas::{download_alertas_inner, upload_alertas_inner};
use super::clients::{download_clientes_inner, upload_clientes_inner};
use super::products::{download_products_inner, upload_products_inner};
use super::sales::{download_sales_inner, upload_sales_inner};
use super::solicitudes::{download_solicitudes_inner, upload_solicitudes_inner};
use super::users::{download_usuarios_inner, upload_usuarios_inner};
use super::{api_url, emit_progress, get_config, supabase_config, supabase_get, upsert_config, urlencoding};
use crate::constants;
use crate::db::AppState;
use rusqlite::Connection;
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
    // Leer config con lock CORTO y soltarlo antes del HTTP (F6): la búsqueda y
    // el registro en Supabase no deben bloquear el POS mientras hay red.
    let (supabase_url, supabase_key) = {
        let db = state.lock_db()?;
        if let Ok(id) = super::get_config(&db, constants::CFG_DISPOSITIVO_ID) {
            return Ok(format!("Ya registrado: {}", id));
        }
        supabase_config(&db)?
    };

    let huella = get_fingerprint()?;
    let encoded_huella = urlencoding(&huella);

    let search_url = api_url(
        &supabase_url,
        &format!("/dispositivos?huella=eq.{}&select=id", encoded_huella),
    );

    // F6: propagar el error de red (NO `unwrap_or_default`): si la búsqueda
    // falla transitoriamente y la traga, se crearía un dispositivo DUPLICADO
    // (la huella existente nunca se encuentra).
    let existing = supabase_get(&search_url, &supabase_key)
        .map_err(|e| format!("Error buscando dispositivo registrado: {}", e))?;

    if let Some(device) = existing.first() {
        if let Some(existing_id) = device["id"].as_str() {
            let db = state.lock_db()?;
            upsert_config(&db, constants::CFG_DISPOSITIVO_ID, existing_id);
            return Ok(format!("Dispositivo recuperado: {}", existing_id));
        }
    }

    let body = json!({"nombre": nombre, "huella": huella}).to_string();
    let resp = super::supabase_agent()
        .post(&api_url(&supabase_url, "/dispositivos"))
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

    let db = state.lock_db()?;
    upsert_config(&db, constants::CFG_DISPOSITIVO_ID, &new_id);

    Ok(format!("Dispositivo registrado: {}", new_id))
}

/// Check pre-login (público, como register_device): solo lee config con lock
/// corto. Usado por el arranque de la UI para decidir si mostrar la pantalla
/// de registro. No confiar en get_sync_stats aquí porque exige sesión.
// DEAD CODE: comando registrado pero no invocado desde el frontend (el arranque usa recover_device).
#[tauri::command]
pub fn is_device_registered(state: State<AppState>) -> Result<bool, String> {
    let db = state.lock_db()?;
    Ok(crate::db::get_config_value(&db, constants::CFG_DISPOSITIVO_ID)
        .unwrap_or_default()
        .unwrap_or_default()
        .len() > 0)
}

/// Auto-recuperación pre-login (público): si no hay dispositivo local, busca la
/// huella del hardware en Supabase y, si existe (instalación previa), la guarda
/// en config local para no volver a mostrar la pantalla de registro. Devuelve
/// `false` si la huella NO existe aún o si hay error de red (la UI entonces
/// muestra la pantalla de registro normal).
#[tauri::command]
pub fn recover_device(state: State<AppState>) -> Result<bool, String> {
    let (supabase_url, supabase_key) = {
        let db = state.lock_db()?;
        if let Ok(id) = super::get_config(&db, constants::CFG_DISPOSITIVO_ID) {
            return Ok(!id.is_empty());
        }
        supabase_config(&db)?
    };

    let huella = match get_fingerprint() {
        Ok(h) => h,
        Err(_) => return Ok(false),
    };

    let search_url = api_url(
        &supabase_url,
        &format!("/dispositivos?huella=eq.{}&select=id", urlencoding(&huella)),
    );

    // F6: propagar el error de red (NO `unwrap_or_default`): si la búsqueda
    // falla, devolver false para que la UI muestre la pantalla de registro
    // (que reintentará). No crear duplicados.
    let existing = match supabase_get(&search_url, &supabase_key) {
        Ok(resp) => resp,
        Err(_) => return Ok(false),
    };

    if let Some(device) = existing.first() {
        if let Some(existing_id) = device["id"].as_str() {
            let db = state.lock_db()?;
            upsert_config(&db, constants::CFG_DISPOSITIVO_ID, existing_id);
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
pub fn upload_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    crate::auth::check_employee_role(&state)?;
    let (supabase_url, supabase_key, dispositivo_id) = {
        let db = state.secondary_conn()?;
        let (u, k) = supabase_config(&db)?;
        (u, k, get_config(&db, constants::CFG_DISPOSITIVO_ID)?)
    };

    // Cada etapa usa SU PROPIA transacción (recolección + red + escrito + commit)
    // para no mantener un lock de escritura sobre la BD durante TODAS las llamadas
    // HTTP (evita "database is locked" en el POS con busy_timeout=5000).
    let steps: Vec<(&str, fn(&Connection, &str, &str, &str) -> Result<String, String>)> = vec![
        ("productos", upload_products_inner),
        ("clientes", upload_clientes_inner),
        ("usuarios", upload_usuarios_inner),
        ("ventas", upload_sales_inner),
        ("alertas", upload_alertas_inner),
        ("solicitudes", upload_solicitudes_inner),
    ];
    let mut parts = Vec::new();
    let total = steps.len() as u32;
    for (i, (label, f)) in steps.iter().enumerate() {
        emit_progress(&app_handle, &format!("Subiendo {}...", label), i as u32 + 1, total);
        let mut db = state.secondary_conn()?;
        let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
        let r = f(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
        tx.commit().map_err(|e| format!("Error al confirmar subida: {}", e))?;
        parts.push(r);
    }
    Ok(parts.join("\n"))
}

#[tauri::command]
pub fn download_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    crate::auth::check_employee_role(&state)?;
    let (supabase_url, supabase_key, dispositivo_id) = {
        let db = state.secondary_conn()?;
        { let (u,k)=supabase_config(&db)?; (u, k, get_config(&db, constants::CFG_DISPOSITIVO_ID)?) }
    };

    let steps: Vec<(&str, fn(&Connection, &str, &str, &str) -> Result<String, String>)> = vec![
        ("productos", download_products_inner),
        ("clientes", download_clientes_inner),
        ("usuarios", download_usuarios_inner),
        ("ventas", download_sales_inner),
        ("alertas", download_alertas_inner),
        ("solicitudes", download_solicitudes_inner),
    ];
    let mut parts = Vec::new();
    let total = steps.len() as u32;
    for (i, (label, f)) in steps.iter().enumerate() {
        emit_progress(&app_handle, &format!("Descargando {}...", label), i as u32 + 1, total);
        let mut db = state.secondary_conn()?;
        let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
        let r = f(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
        tx.commit().map_err(|e| format!("Error al confirmar descarga: {}", e))?;
        parts.push(r);
    }
    Ok(parts.join("\n"))
}

#[tauri::command]
pub fn sync_all(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    // Empleado (admin o vendedor): el auto-sync en segundo plano corre para ambos.
    crate::auth::check_employee_role(&state)?;
    let (supabase_url, supabase_key, dispositivo_id) = {
        let db = state.secondary_conn()?;
        { let (u,k)=supabase_config(&db)?; (u, k, get_config(&db, constants::CFG_DISPOSITIVO_ID)?) }
    };

    let steps: Vec<(&str, fn(&Connection, &str, &str, &str) -> Result<String, String>)> = vec![
        ("productos", upload_products_inner),
        ("clientes", upload_clientes_inner),
        ("usuarios", upload_usuarios_inner),
        ("ventas", upload_sales_inner),
        ("alertas", upload_alertas_inner),
        ("solicitudes", upload_solicitudes_inner),
        ("productos", download_products_inner),
        ("clientes", download_clientes_inner),
        ("usuarios", download_usuarios_inner),
        ("ventas", download_sales_inner),
        ("alertas", download_alertas_inner),
        ("solicitudes", download_solicitudes_inner),
    ];
    let mut parts = Vec::new();
    let total = steps.len() as u32;
    for (i, (label, f)) in steps.iter().enumerate() {
        let verb = if i < 6 { "Subiendo" } else { "Descargando" };
        emit_progress(&app_handle, &format!("{} {}...", verb, label), i as u32 + 1, total);
        let mut db = state.secondary_conn()?;
        let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
        let r = f(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
        tx.commit().map_err(|e| format!("Error al confirmar sincronización: {}", e))?;
        parts.push(r);
    }
    Ok(parts.join("\n"))
}

/// Sube y descarga SOLO las solicitudes de anulación (botón "Refrescar" del
/// modal de solicitudes). Admin-only. Tx cortas por etapa, sin bloquear la BD
/// durante la red.
#[tauri::command]
pub fn refresh_solicitudes(state: State<AppState>, app_handle: tauri::AppHandle) -> Result<String, String> {
    crate::auth::check_admin_role(&state)?;
    let (supabase_url, supabase_key, dispositivo_id) = {
        let db = state.secondary_conn()?;
        { let (u, k) = supabase_config(&db)?; (u, k, get_config(&db, constants::CFG_DISPOSITIVO_ID)?) }
    };

    let mut parts = Vec::new();
    let steps: Vec<(&str, fn(&Connection, &str, &str, &str) -> Result<String, String>)> = vec![
        ("solicitudes", upload_solicitudes_inner),
        ("solicitudes", download_solicitudes_inner),
    ];
    let total = steps.len() as u32;
    for (i, (label, f)) in steps.iter().enumerate() {
        let verb = if i == 0 { "Subiendo" } else { "Descargando" };
        emit_progress(&app_handle, &format!("{} {}...", verb, label), i as u32 + 1, total);
        let mut db = state.secondary_conn()?;
        let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
        let r = f(&tx, &supabase_url, &supabase_key, &dispositivo_id)?;
        tx.commit().map_err(|e| format!("Error al confirmar solicitudes: {}", e))?;
        parts.push(r);
    }
    Ok(parts.join("\n"))
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
    ultimo_upload_usuarios: String,
    ultimo_download_usuarios: String,
    dispositivo_id: String,
    pending_products: i64,
    pending_clientes: i64,
    pending_ventas: i64,
    pending_total: i64,
}

#[tauri::command]
pub fn get_sync_stats(state: State<AppState>) -> Result<SyncStats, String> {
    crate::auth::check_employee_role(&state)?;
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
        crate::db::get_config_value(&db, key)
            .unwrap_or_default()
            .unwrap_or_default()
    };

    // Pendientes de subir: filas locales modificadas después del último upload.
    let count_pending = |sql: &str, watermark_key: &str| -> i64 {
        let wm = crate::db::get_config_value(&db, watermark_key)
            .ok()
            .flatten()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string());
        db.prepare_cached(sql)
            .ok()
            .and_then(|mut s| {
                s.query_row(rusqlite::params![wm], |r| r.get(0))
                    .ok()
            })
            .unwrap_or(0)
    };

    let pending_products = count_pending(
        "SELECT COUNT(*) FROM productos WHERE updated_at IS NULL OR updated_at = '' OR updated_at > ?1",
        constants::CFG_ULTIMO_UPLOAD,
    );
    let pending_clientes = count_pending(
        "SELECT COUNT(*) FROM clientes WHERE (updated_at IS NULL OR updated_at = '' OR sync_id IS NULL OR sync_id = '' OR updated_at > ?1)",
        constants::CFG_ULTIMO_UPLOAD_CLIENTES,
    );
    let pending_ventas = {
        // Solo ventas HECHAS en este dispositivo (o sin origen, las de antes de
        // la columna): las descargadas de otros dispositivos traen su
        // `dispositivo_origen` y NO deben inflar el badge de "pendientes de
        // subir" (ya están en Supabase).
        let wm = crate::db::get_config_value(&db, constants::CFG_ULTIMO_UPLOAD_VENTAS)
            .ok()
            .flatten()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_string());
        let local_id = gc(constants::CFG_DISPOSITIVO_ID);
        db.prepare_cached(
            "SELECT COUNT(*) FROM ventas WHERE sync_id IS NOT NULL AND sync_id != '' AND updated_at > ?1 AND (dispositivo_origen = '' OR dispositivo_origen = ?2)",
        )
            .ok()
            .and_then(|mut s| s.query_row(rusqlite::params![wm, local_id], |r| r.get(0)).ok())
            .unwrap_or(0)
    };
    // El badge solo refleja ventas locales pendientes de subir; productos y
    // clientes se mantienen como campos informativos (contexto del chat).
    let pending_total = pending_ventas;

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
        ultimo_upload_usuarios: gc(constants::CFG_ULTIMO_UPLOAD_USUARIOS),
        ultimo_download_usuarios: gc(constants::CFG_ULTIMO_DOWNLOAD_USUARIOS),
        dispositivo_id: gc(constants::CFG_DISPOSITIVO_ID),
        pending_products,
        pending_clientes,
        pending_ventas,
        pending_total,
    })
}

#[tauri::command]
pub fn list_dispositivos(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    crate::auth::check_employee_role(&state)?;
    // Lock corto solo para leer config; soltar antes del HTTP.
    let (supabase_url, supabase_key) = {
        let db = state.lock_db()?;
        supabase_config(&db)?
    };
    let get_url = api_url(&supabase_url, "/dispositivos?select=*");
    supabase_get(&get_url, &supabase_key)
}

#[tauri::command]
pub fn test_supabase_connection(state: State<AppState>) -> Result<bool, String> {
    crate::auth::check_employee_role(&state)?;
    // Lock corto solo para leer config; soltar antes del HTTP.
    let (supabase_url, supabase_key) = {
        let db = state.lock_db()?;
        supabase_config(&db)?
    };

    let test_url = api_url(&supabase_url, "/productos?select=codigo&limit=1");

    match super::supabase_agent()
        .get(&test_url)
        .set("apikey", &supabase_key)
        .set("Authorization", &format!("Bearer {}", &supabase_key))
        .call()
    {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
