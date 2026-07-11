use crate::db::AppState;
use crate::models::Categoria;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn list_categorias(state: State<AppState>) -> Result<Vec<Categoria>, String> {
    let db = state.db.lock().unwrap();
    let mut stmt = db
        .prepare("SELECT id, nombre, color FROM categorias ORDER BY nombre ASC")
        .map_err(|e| e.to_string())?;
    let cats = stmt
        .query_map([], |row| {
            Ok(Categoria {
                id: row.get(0)?,
                nombre: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(cats)
}

#[tauri::command]
pub fn create_categoria(state: State<AppState>, nombre: String, color: String) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    let _user = crate::products::require_admin(&state, &db, &format!("Creó categoría '{}'", nombre))?;
    match db.execute(
        "INSERT INTO categorias (nombre, color) VALUES (?1, ?2)",
        params![nombre, color],
    ) {
        Ok(_) => Ok("Categoría creada exitosamente".to_string()),
        Err(e) => {
            if e.to_string().contains("UNIQUE") {
                Err("Ya existe una categoría con ese nombre".to_string())
            } else {
                Err(format!("Error al crear categoría: {}", e))
            }
        }
    }
}

#[tauri::command]
pub fn update_categoria(state: State<AppState>, id: i64, nombre: String, color: String) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    let _user = crate::products::require_admin(&state, &db, &format!("Actualizó categoría id={}", id))?;
    match db.execute(
        "UPDATE categorias SET nombre = ?1, color = ?2 WHERE id = ?3",
        params![nombre, color, id],
    ) {
        Ok(_) => Ok("Categoría actualizada exitosamente".to_string()),
        Err(e) => {
            if e.to_string().contains("UNIQUE") {
                Err("Ya existe una categoría con ese nombre".to_string())
            } else {
                Err(format!("Error al actualizar categoría: {}", e))
            }
        }
    }
}

#[tauri::command]
pub fn delete_categoria(state: State<AppState>, id: i64) -> Result<String, String> {
    let db = state.db.lock().unwrap();
    let _user = crate::products::require_admin(&state, &db, &format!("Eliminó categoría id={}", id))?;
    db.execute("UPDATE productos SET categoria_id = NULL WHERE categoria_id = ?1", params![id])
        .map_err(|e| format!("Error al desvincular productos: {}", e))?;
    db.execute("DELETE FROM categorias WHERE id = ?1", params![id])
        .map_err(|e| format!("Error al eliminar categoría: {}", e))?;
    Ok("Categoría eliminada exitosamente".to_string())
}
