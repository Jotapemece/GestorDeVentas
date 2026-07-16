use serde::Deserialize;

#[derive(Deserialize)]
struct BcvRate {
    currency: String,
    rate: f64,
}

#[tauri::command]
pub(crate) fn fetch_tasa_bcv() -> Result<f64, String> {
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
