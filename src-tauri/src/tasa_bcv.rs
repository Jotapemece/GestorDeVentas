use crate::db::AppState;
use crate::models::HistorialTasa;
use rusqlite::params;
use serde::Deserialize;
use tauri::State;

#[derive(Deserialize)]
struct BcvRate {
    currency: String,
    rate: f64,
}

fn fetch_tasa_bcv_inner() -> Result<f64, String> {
    let response = ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(15))
        .timeout_read(std::time::Duration::from_secs(15))
        .build()
        .get("https://dolar-vzla.rafnixg.dev/api/v1/bcv/realtime")
        .set("User-Agent", "GestorDeVentas/1.0")
        .call()
        .map_err(|e| {
            let msg = e.to_string();
            let clean = msg.split(": ").last().unwrap_or(&msg);
            format!("Error al conectar con el servidor BCV: {}", clean)
        })?;

    let rates: Vec<BcvRate> = response
        .into_json()
        .map_err(|e| format!("Error al procesar respuesta: {}", e))?;

    let usd_rate = rates
        .iter()
        .find(|r| r.currency.to_lowercase() == "dolar")
        .map(|r| r.rate)
        .ok_or_else(|| "No se encontró tasa USD en la respuesta".to_string())?;

    Ok(usd_rate)
}

#[tauri::command]
pub(crate) fn fetch_tasa_bcv() -> Result<f64, String> {
    fetch_tasa_bcv_inner()
}

#[tauri::command]
pub fn get_historial_tasas(state: State<AppState>, dias: i64) -> Result<Vec<HistorialTasa>, String> {
    let db = state.lock_db()?;
    let dias = dias.clamp(1, 365);
    let mut stmt = db
        .prepare(
            "SELECT fecha, tasa FROM historial_tasas \
             ORDER BY fecha DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![dias], |row| {
            Ok(HistorialTasa {
                fecha: row.get(0)?,
                tasa: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let result: Vec<HistorialTasa> = rows.filter_map(|r| r.ok()).collect();
    Ok(result)
}
