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
        .timeout_connect(std::time::Duration::from_secs(10))
        .timeout_read(std::time::Duration::from_secs(10))
        .build()
        .get("https://dolar-vzla.rafnixg.dev/api/v1/bcv/realtime")
        .set("User-Agent", "GestorDeVentas/1.0")
        .call()
        .map_err(|e| format!("Error de conexión: {}", e))?;

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
pub fn check_tasa_update(state: State<AppState>) -> Result<Option<f64>, String> {
    let db = state.lock_db()?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let last_check: String = db
        .query_row(
            "SELECT valor FROM configuracion WHERE clave = 'bcv_ultima_fecha'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();

    if last_check == today {
        return Ok(None);
    }

    let current_tasa: f64 = db
        .query_row(crate::constants::SQL_TASA, [], |row| row.get(0))
        .unwrap_or(0.0);

    match fetch_tasa_bcv_inner() {
        Ok(new_rate) => {
            db.execute(
                "INSERT INTO configuracion (clave, valor) VALUES ('bcv_ultima_fecha', ?1) \
                 ON CONFLICT(clave) DO UPDATE SET valor = ?1",
                params![today],
            )
            .ok();

            db.execute(
                "INSERT OR REPLACE INTO historial_tasas (fecha, tasa) VALUES (?1, ?2)",
                params![today, new_rate],
            )
            .ok();

            if (new_rate - current_tasa).abs() > 0.001 {
                Ok(Some(new_rate))
            } else {
                Ok(None)
            }
        }
        Err(_) => Ok(None),
    }
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

#[tauri::command]
pub fn get_tasa_historica(state: State<AppState>, fecha: String) -> Result<Option<f64>, String> {
    let db = state.lock_db()?;
    let tasa: Option<f64> = db
        .query_row(
            "SELECT tasa FROM historial_tasas WHERE fecha = ?1",
            params![fecha],
            |row| row.get(0),
        )
        .ok();
    Ok(tasa)
}
