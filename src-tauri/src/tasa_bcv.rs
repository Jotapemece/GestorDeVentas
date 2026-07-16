use serde::Deserialize;

#[derive(Deserialize)]
struct BcvRate {
    currency: String,
    price: f64,
}

#[tauri::command]
pub(crate) fn fetch_tasa_bcv() -> Result<f64, String> {
    let response = ureq::get("https://dolar-vzla.rafnixg.dev/api/v1/bcv/realtime")
        .call()
        .map_err(|e| format!("Error de conexión: {}", e))?;

    let rates: Vec<BcvRate> = response
        .into_json()
        .map_err(|e| format!("Error al procesar respuesta: {}", e))?;

    let usd_rate = rates
        .iter()
        .find(|r| r.currency == "USD")
        .map(|r| r.price)
        .ok_or_else(|| "No se encontró tasa USD en la respuesta".to_string())?;

    Ok(usd_rate)
}
