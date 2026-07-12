use crate::db::AppState;
use crate::models::Producto;
use base64::Engine;
use rusqlite::params;
use rust_xlsxwriter::*;
use tauri::State;

const SQL_BASE_PRODUCTOS: &str =
    "SELECT p.codigo, p.nombre, p.precio_usd, p.stock, COALESCE(p.stock_minimo,0), \
     COALESCE(p.created_at,''), p.categoria_id, c.nombre, c.color \
     FROM productos p LEFT JOIN categorias c ON c.id = p.categoria_id WHERE p.activo = 1";

const SQL_NEXT_CODIGO: &str =
    "SELECT COALESCE(MAX(CAST(SUBSTR(codigo, 2) AS INTEGER)), 0) + 1 \
     FROM productos WHERE activo = 1 AND codigo GLOB 'P[0-9]*'";

const SQL_UPDATE_REACTIVATE: &str =
    "UPDATE productos SET activo = 1, nombre = ?1, precio_usd = ?2, stock = ?3, \
     categoria_id = ?4 WHERE codigo = ?5";

const SQL_INSERT_PRODUCTO: &str =
    "INSERT INTO productos (codigo, nombre, precio_usd, stock, categoria_id, created_at) \
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now','localtime')) ON CONFLICT(codigo) DO NOTHING";

const SQL_UPDATE_PRODUCTO: &str =
    "UPDATE productos SET nombre = ?1, precio_usd = ?2, stock = ?3, categoria_id = ?4 WHERE codigo = ?5";

const SQL_HAS_SALES: &str = "SELECT COUNT(*) > 0 FROM detalles_ventas WHERE producto_codigo = ?1";

const SQL_SOFT_DELETE: &str = "UPDATE productos SET activo = 0, stock = 0 WHERE codigo = ?1";

const SQL_DELETE_PRODUCTO: &str = "DELETE FROM productos WHERE codigo = ?1";

const SQL_IMPORT_PRODUCTO: &str =
    "INSERT INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, created_at) \
     VALUES (?1, ?2, ?3, ?4, 0, datetime('now','localtime'))";

#[tauri::command]
pub fn list_products(
    state: State<AppState>,
    search: Option<String>,
    categoria_id: Option<i64>,
) -> Result<Vec<Producto>, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;

    let has_query = search.as_ref().is_some_and(|s| !s.is_empty());

    let (sql, _param_count): (String, usize) = match (has_query, categoria_id) {
        (true, Some(_cat)) => (
            format!(
                "{} AND (p.codigo LIKE ?1 OR p.nombre LIKE ?1) AND p.categoria_id = ?2 ORDER BY p.nombre ASC",
                SQL_BASE_PRODUCTOS
            ),
            2,
        ),
        (true, None) => (
            format!(
                "{} AND (p.codigo LIKE ?1 OR p.nombre LIKE ?1) ORDER BY p.nombre ASC",
                SQL_BASE_PRODUCTOS
            ),
            1,
        ),
        (false, Some(_cat)) => (
            format!(
                "{} AND p.categoria_id = ?1 ORDER BY p.nombre ASC",
                SQL_BASE_PRODUCTOS
            ),
            1,
        ),
        (false, None) => (
            format!("{} ORDER BY p.nombre ASC", SQL_BASE_PRODUCTOS),
            0,
        ),
    };

    let q = search.unwrap_or_default();
    let pattern = format!("%{}%", q);

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Producto> {
        Ok(Producto {
            codigo: row.get(0)?,
            nombre: row.get(1)?,
            precio_usd: row.get(2)?,
            stock: row.get(3)?,
            stock_minimo: row.get(4)?,
            created_at: row.get(5)?,
            categoria_id: row.get(6)?,
            categoria_nombre: row.get(7)?,
            categoria_color: row.get(8)?,
        })
    };

    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

    let products: Vec<Producto> = match (has_query, categoria_id) {
        (true, Some(cat)) => stmt.query_map(rusqlite::params![pattern, cat], map_row),
        (true, None) => stmt.query_map(rusqlite::params![pattern], map_row),
        (false, Some(cat)) => stmt.query_map(rusqlite::params![cat], map_row),
        (false, None) => stmt.query_map([], map_row),
    }
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(products)
}

#[tauri::command]
pub fn create_product(
    state: State<AppState>,
    codigo: String,
    nombre: String,
    precio_usd: f64,
    stock: i64,
    categoria_id: Option<i64>,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let codigo = if codigo.is_empty() {
        let next_id: i64 = db
            .query_row(SQL_NEXT_CODIGO, [], |row| row.get(0))
            .map_err(|e| format!("Error al generar código de producto: {}", e))?;
        format!("P{:04}", next_id)
    } else {
        codigo
    };
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Creó producto '{}' (Código: {})", nombre, codigo),
    )?;
    db.execute(
        SQL_UPDATE_REACTIVATE,
        params![nombre, precio_usd, stock, categoria_id, codigo],
    )
    .ok();

    match db.execute(
        SQL_INSERT_PRODUCTO,
        params![codigo, nombre, precio_usd, stock, categoria_id],
    ) {
        Ok(_) => Ok("Producto creado exitosamente".to_string()),
        Err(e) => Err(format!("Error al crear producto: {}", e)),
    }
}

#[tauri::command]
pub fn update_product(
    state: State<AppState>,
    codigo: String,
    nombre: String,
    precio_usd: f64,
    stock: i64,
    categoria_id: Option<i64>,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Actualizó producto '{}'", codigo),
    )?;

    match db.execute(
        SQL_UPDATE_PRODUCTO,
        params![nombre, precio_usd, stock, categoria_id, codigo],
    ) {
        Ok(_) => Ok("Producto actualizado exitosamente".to_string()),
        Err(e) => Err(format!("Error al actualizar producto: {}", e)),
    }
}

#[tauri::command]
pub fn delete_product(state: State<AppState>, codigo: String) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Eliminó producto código '{}'", codigo),
    )?;

    let has_sales: bool = db
        .query_row(SQL_HAS_SALES, params![codigo], |row| row.get(0))
        .unwrap_or(false);

    if has_sales {
        db.execute(SQL_SOFT_DELETE, params![codigo])
            .map_err(|e| e.to_string())?;
        return Ok("Producto desactivado (tiene historial de ventas). Stock puesto a 0.".to_string());
    }
    match db.execute(SQL_DELETE_PRODUCTO, params![codigo]) {
        Ok(_) => Ok("Producto eliminado exitosamente".to_string()),
        Err(e) => Err(format!("Error al eliminar producto: {}", e)),
    }
}

#[tauri::command]
pub fn import_products_from_db(
    state: State<AppState>,
    content: String,
) -> Result<String, String> {
    use std::io::Write;

    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    crate::auth::require_admin(&state, &db, "Importó productos desde archivo DB")?;

    let current_username = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?
        .clone()
        .map(|u| u.username)
        .unwrap_or_default();

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&content)
        .map_err(|e| format!("Error decodificando archivo: {}", e))?;

    let mut temp = std::env::temp_dir();
    temp.push("import_gestor.db");
    let mut f = std::fs::File::create(&temp).map_err(|e| format!("Error creando temporal: {}", e))?;
    f.write_all(&bytes).map_err(|e| format!("Error escribiendo temporal: {}", e))?;
    drop(f);

    let import_conn = rusqlite::Connection::open(&temp)
        .map_err(|e| format!("Error abriendo base de datos importada: {}", e))?;

    let mut stmt = import_conn
        .prepare("SELECT codigo, nombre, precio_usd, stock, COALESCE(stock_minimo, 0), COALESCE(categoria_id, 0) FROM productos WHERE activo = 1 OR activo IS NULL")
        .map_err(|e| format!("Error leyendo productos: {}", e))?;

    let products: Vec<(String, String, f64, i64, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
            ))
        })
        .map_err(|e| format!("Error iterando productos: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    drop(stmt);
    drop(import_conn);
    let _ = std::fs::remove_file(&temp);

    if products.is_empty() {
        return Err("No se encontraron productos en el archivo".to_string());
    }

    let mut imported = 0;
    for (codigo, nombre, precio_usd, stock, stock_minimo, categoria_id) in &products {
        let cat: Option<i64> = if *categoria_id > 0 { Some(*categoria_id) } else { None };
        match db.execute(
            "INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, categoria_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now','localtime'))",
            params![codigo, nombre, precio_usd, stock, stock_minimo, cat],
        ) {
            Ok(n) => {
                if n > 0 {
                    imported += 1;
                }
            }
            Err(_) => {}
        }
    }

    crate::audit::log_action(
        &db,
        &current_username,
        &format!("Importó {} productos desde archivo DB ({})", imported, products.len()),
    )
    .ok();

    let skipped = products.len() - imported;
    Ok(format!(
        "Importados {} productos ({} ya existían).",
        imported, skipped
    ))
}

#[tauri::command]
pub fn export_products_xlsx(state: State<AppState>, tasa: f64) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    let current = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?
        .clone();
    let admin_name = current
        .as_ref()
        .map(|u| u.username.clone())
        .unwrap_or_default();

    let full_sql = format!("{} ORDER BY p.nombre ASC", SQL_BASE_PRODUCTOS);
    let mut stmt = db.prepare(&full_sql).map_err(|e| e.to_string())?;

    let products: Vec<Producto> = stmt
        .query_map([], |row| {
            Ok(Producto {
                codigo: row.get(0)?,
                nombre: row.get(1)?,
                precio_usd: row.get(2)?,
                stock: row.get(3)?,
                stock_minimo: row.get(4)?,
                created_at: row.get(5)?,
                categoria_id: row.get(6)?,
                categoria_nombre: row.get(7)?,
                categoria_color: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut workbook = Workbook::new();

    let sheet = workbook.add_worksheet();
    sheet.set_name("Productos").ok();

    let header_format = Format::new()
        .set_bold()
        .set_background_color(Color::RGB(0xE8D5F5))
        .set_border(FormatBorder::Thin);

    let headers = [
        "Código",
        "Nombre",
        "Precio USD ($)",
        "Precio Bs.",
        "Stock",
    ];
    for (col, header) in headers.iter().enumerate() {
        sheet.write_string_with_format(0, col as u16, *header, &header_format).ok();
    }

    let number_format = Format::new().set_num_format("#,##0.00");
    let bs_format = Format::new().set_num_format("'#,##0.00");

    for (row, product) in products.iter().enumerate() {
        let r = (row + 1) as u32;
        sheet.write_string(r, 0, &product.codigo).ok();
        sheet.write_string(r, 1, &product.nombre).ok();
        sheet
            .write_number_with_format(r, 2, product.precio_usd, &number_format)
            .ok();
        sheet
            .write_number_with_format(r, 3, product.precio_usd * tasa, &bs_format)
            .ok();
        sheet.write_number(r, 4, product.stock as f64).ok();
    }

    sheet.set_column_width(0, 15).ok();
    sheet.set_column_width(1, 40).ok();
    sheet.set_column_width(2, 15).ok();
    sheet.set_column_width(3, 15).ok();
    sheet.set_column_width(4, 10).ok();

    let buffer = workbook.save_to_buffer()
        .map_err(|e| format!("Error al exportar: {}", e))?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buffer);

    crate::audit::log_action(
        &db,
        &admin_name,
        "Exportó catálogo a Excel",
    )
    .ok();

    Ok(b64)
}

#[tauri::command]
pub fn import_products_from_file(
    state: State<AppState>,
    content: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| format!("Error interno: {}", e))?;
    crate::auth::require_admin(
        &state,
        &db,
        "Importó productos vía upload",
    )?;
    let current_username = state
        .current_user
        .lock()
        .map_err(|e| format!("Error interno: {}", e))?
        .clone()
        .map(|u| u.username)
        .unwrap_or_default();

    let mut count = 0;
    let mut errors: Vec<String> = Vec::new();

    for (line_no, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 3 {
            errors.push(format!(
                "Línea {}: columnas insuficientes ({})",
                line_no + 1,
                cols.len()
            ));
            continue;
        }

        let (codigo, nombre, stock_str, precio_str) = match cols.len() {
            7 => {
                let code = cols[0].trim();
                let name = cols[1].trim().trim_end_matches(',');
                let stock = cols[2].trim().trim_end_matches(',');
                let price = cols[5].trim().replace(',', ".");
                (Some(code.to_string()), name, stock, price)
            }
            6 => {
                let name = cols[0].trim().trim_end_matches(',');
                let stock = cols[1].trim().trim_end_matches(',');
                let price = cols[4].trim().replace(',', ".");
                (None, name, stock, price)
            }
            _ => {
                let nombre = cols[0].trim().trim_end_matches(',');
                let stock_str = cols[1].trim().trim_end_matches(',');
                let precio_str = cols[2].trim().replace(',', ".");
                (None, nombre, stock_str, precio_str)
            }
        };

        let stock: i64 = match stock_str.parse() {
            Ok(s) => s,
            Err(_) => {
                errors.push(format!(
                    "Línea {}: stock inválido '{}'",
                    line_no + 1,
                    stock_str
                ));
                continue;
            }
        };
        let precio_usd: f64 = match precio_str.parse() {
            Ok(p) => p,
            Err(_) => {
                errors.push(format!(
                    "Línea {}: precio inválido '{}'",
                    line_no + 1,
                    precio_str
                ));
                continue;
            }
        };

        let codigo = codigo.unwrap_or_else(|| format!("P{:04}", count + 1));

        if let Err(e) = db.execute(
            SQL_IMPORT_PRODUCTO,
            params![codigo, nombre, precio_usd, stock],
        ) {
            errors.push(format!("Línea {}: '{}' - {}", line_no + 1, nombre, e));
            continue;
        }
        count += 1;
    }

    let error_summary = if errors.is_empty() {
        String::new()
    } else {
        let detail = errors
            .iter()
            .take(5)
            .cloned()
            .collect::<Vec<_>>()
            .join("; ");
        let suffix = if errors.len() > 5 {
            format!("... y {} más", errors.len() - 5)
        } else {
            String::new()
        };
        format!(" Errores: {}{}", detail, suffix)
    };
    crate::audit::log_action(
        &db,
        &current_username,
        &format!(
            "Importó {} productos desde archivo.{}",
            count, error_summary
        ),
    )
    .ok();

    if errors.is_empty() {
        Ok(format!(
            "Importados {} productos sin errores.",
            count
        ))
    } else {
        let detail = errors
            .iter()
            .take(10)
            .cloned()
            .collect::<Vec<_>>()
            .join("\n");
        let suffix = if errors.len() > 10 {
            format!("\n... y {} más", errors.len() - 10)
        } else {
            String::new()
        };
        Ok(format!(
            "Importados {} productos.\nErrores ({}):\n{}{}",
            count,
            errors.len(),
            detail,
            suffix
        ))
    }
}
