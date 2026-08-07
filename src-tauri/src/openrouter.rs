use crate::db::AppState;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::State;

fn call_openrouter(api_key: &str, body: &serde_json::Value) -> Result<String, String> {
    let json_body = serde_json::to_vec(body).map_err(|e| format!("Error serializando: {}", e))?;

    let response = ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(15))
        .timeout_read(std::time::Duration::from_secs(45))
        .build()
        .post("https://openrouter.ai/api/v1/chat/completions")
        .set("Authorization", &format!("Bearer {}", api_key))
        .set("Content-Type", "application/json")
        .send_bytes(&json_body)
        .map_err(|e| format!("Error de conexión con OpenRouter: {}", e))?;

    let resp_json: serde_json::Value = response
        .into_json()
        .map_err(|e| format!("Error al procesar respuesta: {}", e))?;

    let content = resp_json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    if content.is_empty() {
        let error_msg = resp_json["error"]["message"]
            .as_str()
            .unwrap_or("Respuesta vacía de OpenRouter");
        return Err(error_msg.to_string());
    }

    Ok(content)
}

fn build_request(model: &str, messages: Vec<serde_json::Value>) -> serde_json::Value {
    json!({
        "model": model,
        "messages": messages,
        "max_tokens": 1024,
        "frequency_penalty": 1.0,
        "reasoning": {"max_tokens": 0}
    })
}

fn default_model(model: &str) -> String {
    if model.is_empty() {
        "openrouter/free".to_string()
    } else {
        model.to_string()
    }
}

fn build_prompt(products: &[LowStockProduct]) -> String {
    let mut table = String::from("Genera una orden de compra en formato tabla para estos productos bajos de stock. Para cada fila calcula: cantidad a ordenar = minimo - stock actual, y estimado = cantidad a ordenar x costo unitario. Responde SOLO con la tabla, sin explicaciones.\n\n| Producto | Codigo | Stock actual | Stock minimo | A ordenar | Costo $ | Estimado $ |\n|----------|--------|-------------|--------------|-----------|---------|------------|\n");
    for p in products {
        let a_ordenar = (p.stock_minimo - p.stock).max(0.0);
        let estimado = a_ordenar * p.costo;
        table.push_str(&format!(
            "| {} | {} | {} | {} | {} | {} | {:.2} |\n",
            p.nombre, p.codigo, p.stock, p.stock_minimo, a_ordenar, p.costo, estimado
        ));
    }
    table
}

#[derive(serde::Serialize)]
pub struct LowStockProduct {
    pub codigo: String,
    pub nombre: String,
    pub stock: f64,
    pub stock_minimo: f64,
    pub costo: f64,
}

#[tauri::command]
pub fn generate_purchase_suggestion(
    state: State<AppState>,
    model: String,
) -> Result<String, String> {
    // Requiere sesión autenticada + rate-limit (abuso quema dinero de OpenRouter).
    state.get_employee()?;
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::check_action_rate_limit(&mut attempts, "generate_purchase_suggestion")?;
    }

    let api_key = {
        let db = state.lock_db()?;
        crate::db::get_config_value(&db, crate::constants::CFG_OPENROUTER_API_KEY)?
            .filter(|k| !k.is_empty())
            .ok_or_else(|| "No hay API key de OpenRouter configurada (Configuración → IA)".to_string())?
    };

    let low_stock: Vec<LowStockProduct> = {
        let db = state.lock_db()?;
        let mut stmt = db
            .prepare(
                "SELECT codigo, nombre, stock, COALESCE(stock_minimo,0), COALESCE(costo,0) FROM productos \
                 WHERE activo = 1 AND stock < COALESCE(stock_minimo,0)",
            )
            .map_err(|e| format!("Error al consultar productos: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(LowStockProduct {
                    codigo: row.get(0)?,
                    nombre: row.get(1)?,
                    stock: row.get(2)?,
                    stock_minimo: row.get(3)?,
                    costo: row.get(4)?,
                })
            })
            .map_err(|e| format!("Error al leer productos: {}", e))?;

        rows.filter_map(|r| r.ok()).collect()
    };

    if low_stock.is_empty() {
        return Ok("No hay productos bajos de stock.".to_string());
    }

    let prompt = build_prompt(&low_stock);
    let model = default_model(&model);

    let messages = vec![
        json!({"role": "user", "content": prompt}),
    ];
    let body = build_request(&model, messages);

    // La llamada HTTP corre FUERA del lock de la BD (release pris se hace en el bloque
    // anterior scoped). No bloquear el POS durante hasta 45s de red.
    let result = call_openrouter(&api_key, &body);
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        if result.is_ok() {
            crate::db::rate_limit_success(&mut attempts, "generate_purchase_suggestion");
        } else {
            crate::db::rate_limit_fail(&mut attempts, "generate_purchase_suggestion");
        }
    }
    result
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub fn chat_with_ai(
    state: State<AppState>,
    messages: Vec<ChatMessage>,
    model: String,
) -> Result<String, String> {
    state.get_employee()?;
    if let Ok(mut attempts) = state.admin_action_attempts.lock() {
        crate::db::check_action_rate_limit(&mut attempts, "chat_with_ai")?;
    }

    // La API key se lee desde la BD (no viaja por IPC desde la webview).
    let api_key = {
        let db = state.lock_db()?;
        crate::db::get_config_value(&db, crate::constants::CFG_OPENROUTER_API_KEY)?
            .filter(|k| !k.is_empty())
            .ok_or_else(|| "No hay API key de OpenRouter configurada (Configuración → IA)".to_string())?
    };

    let model = default_model(&model);

    let msg_values: Vec<serde_json::Value> = messages.into_iter()
        .map(|m| json!({"role": m.role, "content": m.content}))
        .collect();

    let body = build_request(&model, msg_values);
    call_openrouter(&api_key, &body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_prompt_empty() {
        let result = build_prompt(&[]);
        assert!(result.contains("Producto | Codigo | Stock actual | Stock minimo"));
        assert!(result.contains("|----------|--------|-------------|--------------"));
    }

    #[test]
    fn test_build_prompt_single_product() {
        let products = vec![
            LowStockProduct { codigo: "P001".into(), nombre: "Arroz".into(), stock: 2.0, stock_minimo: 10.0, costo: 1.5 },
        ];
        let result = build_prompt(&products);
        assert!(result.contains("| Arroz | P001 | 2 | 10 | 8 | 1.5 | 12.00 |"));
    }

    #[test]
    fn test_build_prompt_multiple_products() {
        let products = vec![
            LowStockProduct { codigo: "P001".into(), nombre: "Arroz".into(), stock: 2.0, stock_minimo: 10.0, costo: 1.5 },
            LowStockProduct { codigo: "P002".into(), nombre: "Harina".into(), stock: 1.0, stock_minimo: 15.0, costo: 2.0 },
            LowStockProduct { codigo: "P003".into(), nombre: "Aceite".into(), stock: 0.0, stock_minimo: 8.0, costo: 0.5 },
        ];
        let result = build_prompt(&products);
        assert!(result.contains("| Arroz | P001 | 2 | 10 | 8 | 1.5 | 12.00 |"));
        assert!(result.contains("| Harina | P002 | 1 | 15 | 14 | 2 | 28.00 |"));
        assert!(result.contains("| Aceite | P003 | 0 | 8 | 8 | 0.5 | 4.00 |"));
    }

    #[test]
    fn test_build_prompt_contains_instruction() {
        let products = vec![
            LowStockProduct { codigo: "P001".into(), nombre: "Leche".into(), stock: 3.0, stock_minimo: 12.0, costo: 1.0 },
        ];
        let result = build_prompt(&products);
        assert!(result.contains("cantidad a ordenar = minimo - stock actual"));
        assert!(result.contains("estimado = cantidad a ordenar x costo unitario"));
        assert!(result.contains("Responde SOLO con la tabla"));
    }

    #[test]
    fn test_build_prompt_stock_no_negativo() {
        let products = vec![
            LowStockProduct { codigo: "P001".into(), nombre: "Pan".into(), stock: 20.0, stock_minimo: 10.0, costo: 0.5 },
        ];
        // Stock por encima del mínimo: a ordenar nunca negativo.
        let result = build_prompt(&products);
        assert!(result.contains("| Pan | P001 | 20 | 10 | 0 | 0.5 | 0.00 |"));
    }

    #[test]
    fn test_low_stock_product_serialize() {
        let p = LowStockProduct { codigo: "P001".into(), nombre: "Test".into(), stock: 5.0, stock_minimo: 10.0, costo: 1.5 };
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"codigo\":\"P001\""));
        assert!(json.contains("\"nombre\":\"Test\""));
        assert!(json.contains("\"stock\":5.0"));
        assert!(json.contains("\"stock_minimo\":10.0"));
        assert!(json.contains("\"costo\":1.5"));
    }
}
