use crate::auth;
use crate::db::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Combo {
    pub id: i64,
    pub nombre: String,
    pub precio_usd: f64,
    pub subcategoria: String,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComboProductoInput {
    pub producto_codigo: String,
    pub cantidad: i64,
}

const SQL_COMBO_COLUMNS: &str = "id, nombre, precio_usd, subcategoria, created_at, updated_at";

fn row_to_combo(row: &rusqlite::Row) -> rusqlite::Result<Combo> {
    Ok(Combo {
        id: row.get(0)?,
        nombre: row.get(1)?,
        precio_usd: row.get(2)?,
        subcategoria: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn list_combos_inner(db: &rusqlite::Connection) -> Result<Vec<Combo>, String> {
    let mut stmt = db.prepare(&format!(
        "SELECT {} FROM combos ORDER BY nombre ASC",
        SQL_COMBO_COLUMNS
    )).map_err(|e| e.to_string())?;

    let combos: Vec<Combo> = stmt.query_map([], row_to_combo)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(combos)
}

#[tauri::command]
pub fn create_combo(
    state: State<AppState>,
    nombre: String,
    precio_usd: f64,
    productos: Vec<ComboProductoInput>,
) -> Result<Combo, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "create_combo",
    )?;
    if nombre.trim().is_empty() {
        return Err("El nombre del combo no puede estar vacío".to_string());
    }
    if precio_usd <= 0.0 {
        return Err("El precio debe ser mayor a cero".to_string());
    }
    if productos.is_empty() {
        return Err("El combo debe tener al menos un producto".to_string());
    }

    let mut db = state.lock_db()?;
    let ts = crate::helpers::now_iso();
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    crate::auth::require_admin(
        &state,
        &tx,
        &format!("Creó combo '{}'", nombre),
    )?;

    tx.execute(
        "INSERT INTO combos (nombre, precio_usd, subcategoria, created_at, updated_at) VALUES (?1, ?2, 'combos', ?3, ?3)",
        rusqlite::params![nombre.trim(), precio_usd, ts],
    ).map_err(|e| format!("Error al crear combo: {}", e))?;

    let combo_id = tx.last_insert_rowid();

    for p in &productos {
        tx.execute(
            "INSERT INTO combo_productos (combo_id, producto_codigo, cantidad) VALUES (?1, ?2, ?3)",
            rusqlite::params![combo_id, p.producto_codigo, p.cantidad],
        ).map_err(|e| format!("Error al agregar producto al combo: {}", e))?;
    }

    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;

    Ok(Combo {
        id: combo_id,
        nombre: nombre.trim().to_string(),
        precio_usd,
        subcategoria: "combos".to_string(),
        created_at: ts.clone(),
        updated_at: Some(ts),
    })
}

#[tauri::command]
pub fn delete_combo(state: State<AppState>, combo_id: i64) -> Result<String, String> {
    crate::db::check_action_rate_limit(
        &mut *state.admin_action_attempts.lock().map_err(|_| "Error interno".to_string())?,
        "delete_combo",
    )?;
    let mut db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Eliminó combo #{}", combo_id),
    )?;

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    tx.execute("DELETE FROM combo_productos WHERE combo_id = ?1", rusqlite::params![combo_id])
        .map_err(|e| format!("Error al eliminar productos del combo: {}", e))?;

    let affected = tx.execute("DELETE FROM combos WHERE id = ?1", rusqlite::params![combo_id])
        .map_err(|e| format!("Error al eliminar combo: {}", e))?;

    if affected == 0 {
        return Err("Combo no encontrado".to_string());
    }

    tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
    Ok("Combo eliminado".to_string())
}

#[tauri::command]
pub fn list_combos_simple(state: State<AppState>) -> Result<Vec<Combo>, String> {
    let _username = auth::check_employee_role(&state)?;
    let db = state.lock_db()?;
    list_combos_inner(&db)
}
