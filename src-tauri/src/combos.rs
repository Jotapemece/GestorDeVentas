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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComboDetalle {
    pub combo: Combo,
    pub productos: Vec<ComboProductoDetalle>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComboProductoDetalle {
    pub id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub cantidad: i64,
}

#[tauri::command]
pub fn create_combo(
    state: State<AppState>,
    nombre: String,
    precio_usd: f64,
    productos: Vec<ComboProductoInput>,
) -> Result<Combo, String> {
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
pub fn list_combos(state: State<AppState>) -> Result<Vec<ComboDetalle>, String> {
    let db = state.lock_db()?;

    let mut stmt = db.prepare(
        "SELECT id, nombre, precio_usd, subcategoria, created_at, updated_at FROM combos ORDER BY nombre ASC"
    ).map_err(|e| e.to_string())?;

    let combos: Vec<Combo> = stmt.query_map([], |row| {
        Ok(Combo {
            id: row.get(0)?,
            nombre: row.get(1)?,
            precio_usd: row.get(2)?,
            subcategoria: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    drop(stmt);

    let mut detalle_stmt = db.prepare(
        "SELECT cp.id, cp.producto_codigo, COALESCE(p.nombre, cp.producto_codigo), cp.cantidad
         FROM combo_productos cp
         LEFT JOIN productos p ON cp.producto_codigo = p.codigo
         WHERE cp.combo_id = ?1 ORDER BY cp.id ASC"
    ).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for combo in combos {
        let productos: Vec<ComboProductoDetalle> = detalle_stmt.query_map(
            rusqlite::params![combo.id],
            |row| Ok(ComboProductoDetalle {
                id: row.get(0)?,
                producto_codigo: row.get(1)?,
                producto_nombre: row.get(2)?,
                cantidad: row.get(3)?,
            })
        ).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        result.push(ComboDetalle { combo, productos });
    }

    Ok(result)
}

#[tauri::command]
pub fn get_combo_detail(state: State<AppState>, combo_id: i64) -> Result<ComboDetalle, String> {
    let db = state.lock_db()?;

    let combo = db.query_row(
        "SELECT id, nombre, precio_usd, subcategoria, created_at, updated_at FROM combos WHERE id = ?1",
        rusqlite::params![combo_id],
        |row| Ok(Combo {
            id: row.get(0)?,
            nombre: row.get(1)?,
            precio_usd: row.get(2)?,
            subcategoria: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    ).map_err(|_| "Combo no encontrado".to_string())?;

    let mut stmt = db.prepare(
        "SELECT cp.id, cp.producto_codigo, COALESCE(p.nombre, cp.producto_codigo), cp.cantidad
         FROM combo_productos cp
         LEFT JOIN productos p ON cp.producto_codigo = p.codigo
         WHERE cp.combo_id = ?1 ORDER BY cp.id ASC"
    ).map_err(|e| e.to_string())?;

    let productos: Vec<ComboProductoDetalle> = stmt.query_map(
        rusqlite::params![combo_id],
        |row| Ok(ComboProductoDetalle {
            id: row.get(0)?,
            producto_codigo: row.get(1)?,
            producto_nombre: row.get(2)?,
            cantidad: row.get(3)?,
        })
    ).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(ComboDetalle { combo, productos })
}

#[tauri::command]
pub fn delete_combo(state: State<AppState>, combo_id: i64) -> Result<String, String> {
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
    let db = state.lock_db()?;
    let mut stmt = db.prepare(
        "SELECT id, nombre, precio_usd, subcategoria, created_at, updated_at FROM combos ORDER BY nombre ASC"
    ).map_err(|e| e.to_string())?;

    let combos: Vec<Combo> = stmt.query_map([], |row| {
        Ok(Combo {
            id: row.get(0)?,
            nombre: row.get(1)?,
            precio_usd: row.get(2)?,
            subcategoria: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(combos)
}
