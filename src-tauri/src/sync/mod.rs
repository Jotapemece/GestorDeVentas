pub(crate) mod products;
pub(crate) mod sales;
pub(crate) mod clients;
pub(crate) mod users;
pub(crate) mod conflicts;
pub(crate) mod orchestrator;
pub(crate) mod preview;
pub(crate) mod alertas;
pub(crate) mod solicitudes;

pub use products::*;
pub use clients::*;
pub use users::*;
pub use conflicts::*;
pub use orchestrator::*;
pub use preview::*;

use crate::constants;
use serde_json::json;
use tauri::Emitter;

pub(crate) use crate::helpers::now_iso;

/// Convierte timestamp ISO 8601 ("2026-07-18T10:00:00.000Z") al formato local SQLite
/// ("2026-07-18 10:00:00"). Si no tiene 'T', lo devuelve tal cual.
pub(crate) fn normalize_fecha(iso: &str) -> String {
    let s = iso.replace('T', " ");
    let s = s.trim_end_matches('Z');
    if let Some(dot) = s.find('.') {
        s[..dot].to_string()
    } else {
        s.to_string()
    }
}

pub(crate) fn api_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    format!("{}/rest/v1{}", base, path)
}

pub(crate) fn supabase_agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(10))
        .timeout_read(std::time::Duration::from_secs(30))
        .build()
}

pub(crate) fn supabase_post(url: &str, key: &str, body: &str) -> Result<(), String> {
    let agent = supabase_agent();
    match agent.post(url)
        .set("apikey", key)
        .set("Authorization", &format!("Bearer {}", key))
        .set("Content-Type", "application/json")
        .set("Prefer", "resolution=merge-duplicates")
        .send_string(body)
    {
        Ok(_) => Ok(()),
        Err(ureq::Error::Status(code, resp)) => {
            let text = resp.into_string().unwrap_or_default();
            Err(format!("HTTP {}: {}", code, text))
        }
        Err(e) => Err(format!("Error de conexión: {}", e)),
    }
}

pub(crate) fn supabase_get(url: &str, key: &str) -> Result<Vec<serde_json::Value>, String> {
    let agent = supabase_agent();
    match agent.get(url)
        .set("apikey", key)
        .set("Authorization", &format!("Bearer {}", key))
        .call()
    {
        Ok(resp) => resp.into_json().map_err(|e| format!("Error leyendo respuesta: {}", e)),
        Err(ureq::Error::Status(code, resp)) => {
            let text = resp.into_string().unwrap_or_default();
            Err(format!("HTTP {}: {}", code, text))
        }
        Err(e) => Err(format!("Error de conexión: {}", e)),
    }
}

/// Tamaño de página para descargas paginadas. PostgREST corta cada request a
/// `db-max-rows` (default 1000) SIN avisar; descargar sin paginar pierde las
/// filas que quedan fuera del corte pero el watermark avanza igual.
pub(crate) const SYNC_PAGE_SIZE: usize = 1000;

/// Descarga paginada completa: itera `order=updated_at.asc,{tie_breaker}.asc`
/// con `limit={SYNC_PAGE_SIZE}` y `offset` creciente hasta obtener un batch menor
/// al máximo. Si falla cualquier página, propaga el error (el caller hace rollback
/// y NO avanza el watermark).
///
/// El tie-breaker es necesario porque muchas filas comparten el mismo
/// `updated_at` (p.ej. los detalles descargados en bloque, o ventas creadas en
/// la misma operación). Sin él, `order=updated_at.asc` produce un orden no
/// determinista en los empates y el `offset` salta/duplica filas entre páginas.
/// La columna usada debe ser la PK de la tabla remota (`codigo` en productos,
/// `id` en ventas/detalles/clientes/alertas/solicitudes, `sync_id` en usuarios).
pub(crate) fn supabase_get_paginated(
    base_url: &str,
    key: &str,
    tie_breaker: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let mut all: Vec<serde_json::Value> = Vec::new();
    let mut offset = 0usize;
    loop {
        let page_url = format!(
            "{}&order=updated_at.asc,{}.asc&limit={}&offset={}",
            base_url, tie_breaker, SYNC_PAGE_SIZE, offset
        );
        let page = supabase_get(&page_url, key)?;
        let n = page.len();
        all.extend(page);
        if n < SYNC_PAGE_SIZE {
            break;
        }
        offset += n;
    }
    Ok(all)
}

pub(crate) fn supabase_config(db: &rusqlite::Connection) -> Result<(String, String), String> {
    Ok((
        get_config(db, constants::CFG_SUPABASE_URL)
            .unwrap_or_else(|_| constants::SUPABASE_URL.to_string()),
        get_config(db, constants::CFG_SUPABASE_KEY)
            .unwrap_or_else(|_| constants::SUPABASE_KEY.to_string()),
    ))
}

pub(crate) fn get_config(db: &rusqlite::Connection, key: &str) -> Result<String, String> {
    crate::db::get_config_value(db, key)?
        .ok_or_else(|| format!("Configura '{}' primero en Ajustes", key))
}

pub(crate) fn upsert_config(db: &rusqlite::Connection, key: &str, value: &str) -> Result<(), String> {
    crate::db::set_config_value(db, key, value)?;
    Ok(())
}

pub(crate) fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(byte as char),
            _ => out.push_str(&format!("%{:02X}", byte)),
        }
    }
    out
}

/// Helper: ejecuta el boilerplate común de un comando Tauri de upload.
/// USA `secondary_conn` (NO el lock primario) para no congelar el POS mientras
/// dura la red: el lock primario bloquea TODAS las operaciones de caja/ventas.
/// El inner hace lectura local -> red -> escritura de watermark sobre la misma
/// conexión secundaria (autocommit), sin mantener un lock/tx durante el HTTP.
pub(crate) fn run_upload<F>(state: &tauri::State<'_, crate::db::AppState>, inner: F) -> Result<String, String>
where
    F: FnOnce(&rusqlite::Connection, &str, &str, &str) -> Result<String, String>,
{
    let db = state.secondary_conn()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
    let dispositivo_id = get_config(&db, constants::CFG_DISPOSITIVO_ID)?;
    inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

/// Helper: ejecuta el boilerplate común de un comando Tauri de download.
/// USA `secondary_conn` SIN abrir una transacción de escritura: mantener un tx
/// durante el HTTP bloquea las escrituras del POS (writer-writer en WAL con
/// busy_timeout). El inner hace la red y los inserts en autocommit sobre la
/// conexión secundaria; el watermark se escribe al final y, si falla, no avanza
/// (los inserts usan INSERT OR IGNORE, así que un reintento no duplica filas).
pub(crate) fn run_download<F>(state: &tauri::State<'_, crate::db::AppState>, inner: F) -> Result<String, String>
where
    F: FnOnce(&rusqlite::Connection, &str, &str, &str) -> Result<String, String>,
{
    let db = state.secondary_conn()?;
    let (supabase_url, supabase_key) = supabase_config(&db)?;
    let dispositivo_id = get_config(&db, constants::CFG_DISPOSITIVO_ID)?;
    inner(&db, &supabase_url, &supabase_key, &dispositivo_id)
}

pub(crate) fn emit_progress(app: &tauri::AppHandle, step: &str, current: u32, total: u32) {
    let payload = json!({
        "step": step,
        "current": current,
        "total": total,
    });
    app.emit("sync-progress", payload).ok();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_url_no_trailing_slash() {
        assert_eq!(
            api_url("https://x.supabase.co", "/productos?select=*"),
            "https://x.supabase.co/rest/v1/productos?select=*"
        );
    }
    #[test]
    fn test_api_url_with_trailing_slash() {
        assert_eq!(
            api_url("https://x.supabase.co/", "/productos"),
            "https://x.supabase.co/rest/v1/productos"
        );
    }
    #[test]
    fn test_urlencoding_passes_safe_chars() {
        assert_eq!(urlencoding("2026-07-17T18:13:20.659Z"), "2026-07-17T18%3A13%3A20.659Z");
    }
    #[test]
    fn test_urlencoding_encodes_space() {
        assert_eq!(urlencoding("a b"), "a%20b");
    }
    #[test]
    fn test_urlencoding_encodes_percent() {
        assert_eq!(urlencoding("100%"), "100%25");
    }

    #[test]
    fn test_normalize_fecha_full_iso() {
        assert_eq!(normalize_fecha("2026-07-18T10:00:00.000Z"), "2026-07-18 10:00:00");
    }

    #[test]
    fn test_normalize_fecha_no_t() {
        assert_eq!(normalize_fecha("2026-07-18 10:00:00"), "2026-07-18 10:00:00");
    }

    #[test]
    fn test_normalize_fecha_no_millis() {
        assert_eq!(normalize_fecha("2026-07-18T10:00:00Z"), "2026-07-18 10:00:00");
    }

    #[test]
    fn test_normalize_fecha_no_z() {
        assert_eq!(normalize_fecha("2026-07-18T10:00:00.000"), "2026-07-18 10:00:00");
    }

    #[test]
    fn test_normalize_fecha_empty() {
        assert_eq!(normalize_fecha(""), "");
    }
}
