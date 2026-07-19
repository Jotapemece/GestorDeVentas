pub(crate) mod products;
pub(crate) mod sales;
pub(crate) mod clients;
pub(crate) mod conflicts;
pub(crate) mod orchestrator;

pub use products::*;
pub use sales::*;
pub use clients::*;
pub use conflicts::*;
pub use orchestrator::*;

use rusqlite::params;
use serde_json::json;
use tauri::Emitter;

pub(crate) use crate::helpers::now_iso;

/// Convierte timestamp ISO 8601 ("2026-07-18T10:00:00.000Z") al formato local SQLite
/// ("2026-07-18 10:00:00"). Si no tiene 'T', lo devuelve tal cual.
pub fn normalize_fecha(iso: &str) -> String {
    let s = iso.replace('T', " ");
    let s = s.trim_end_matches('Z');
    if let Some(dot) = s.find('.') {
        s[..dot].to_string()
    } else {
        s.to_string()
    }
}

pub fn api_url(base: &str, path: &str) -> String {
    let base = base.trim_end_matches('/');
    format!("{}/rest/v1{}", base, path)
}

pub fn supabase_post(url: &str, key: &str, body: &str) -> Result<(), String> {
    match ureq::post(url)
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

pub fn supabase_get(url: &str, key: &str) -> Result<Vec<serde_json::Value>, String> {
    match ureq::get(url)
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

pub fn get_config(db: &rusqlite::Connection, key: &str) -> Result<String, String> {
    db.query_row(
        "SELECT valor FROM configuracion WHERE clave = ?1",
        params![key],
        |r| r.get::<_, String>(0),
    )
    .map_err(|_| format!("Configura '{}' primero en Ajustes", key))
}

pub fn upsert_config(db: &rusqlite::Connection, key: &str, value: &str) {
    db.execute(
        "INSERT INTO configuracion (clave, valor) VALUES (?1, ?2) \
         ON CONFLICT(clave) DO UPDATE SET valor = ?2",
        params![key, value],
    )
    .ok();
}

pub fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            ' ' => out.push_str("%20"),
            '%' => out.push_str("%25"),
            '<' => out.push_str("%3C"),
            '>' => out.push_str("%3E"),
            '#' => out.push_str("%23"),
            '"' => out.push_str("%22"),
            '(' => out.push_str("%28"),
            ')' => out.push_str("%29"),
            '{' | '}' => out.push_str(if c == '{' { "%7B" } else { "%7D" }),
            '|' => out.push_str("%7C"),
            '\\' => out.push_str("%5C"),
            '^' => out.push_str("%5E"),
            '~' => out.push_str("%7E"),
            '[' | ']' => out.push_str(if c == '[' { "%5B" } else { "%5D" }),
            '`' => out.push_str("%60"),
            c => out.push(c),
        }
    }
    out
}

pub fn emit_progress(app: &tauri::AppHandle, step: &str, current: u32, total: u32) {
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
        assert_eq!(urlencoding("2026-07-17T18:13:20.659Z"), "2026-07-17T18:13:20.659Z");
    }
    #[test]
    fn test_urlencoding_encodes_space() {
        assert_eq!(urlencoding("a b"), "a%20b");
    }
    #[test]
    fn test_urlencoding_encodes_percent() {
        assert_eq!(urlencoding("100%"), "100%25");
    }
}
