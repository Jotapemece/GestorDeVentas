use crate::constants;
use crate::db::AppState;
use crate::models::{PaginatedResult, Producto, TopProductItem};
use base64::Engine;
use rusqlite::params;
use rust_xlsxwriter::*;
use tauri::State;

fn row_to_producto(row: &rusqlite::Row) -> rusqlite::Result<Producto> {
    Ok(Producto {
        codigo: row.get(0)?, nombre: row.get(1)?, precio_usd: row.get(2)?,
        stock: row.get(3)?, stock_minimo: row.get(4)?, created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

const SQL_BASE_PRODUCTOS: &str =
    "SELECT p.codigo, p.nombre, p.precio_usd, p.stock, COALESCE(p.stock_minimo,0), \
     COALESCE(p.created_at,''), p.updated_at \
     FROM productos p WHERE p.activo = 1";

const SQL_NEXT_CODIGO: &str =
    "SELECT COALESCE(MAX(CAST(SUBSTR(codigo, 2) AS INTEGER)), 0) + 1 \
     FROM productos WHERE activo = 1 AND codigo GLOB 'P[0-9]*'";

const SQL_UPDATE_REACTIVATE: &str =
    "UPDATE productos SET activo = 1, nombre = ?1, precio_usd = ?2, stock = ?3, updated_at = ?4 \
     WHERE codigo = ?5";

const SQL_INSERT_PRODUCTO: &str =
    "INSERT INTO productos (codigo, nombre, precio_usd, stock, created_at, updated_at) \
     VALUES (?1, ?2, ?3, ?4, datetime('now','localtime'), ?5) ON CONFLICT(codigo) DO NOTHING";

const SQL_UPDATE_PRODUCTO: &str =
    "UPDATE productos SET nombre = ?1, precio_usd = ?2, stock = ?3, updated_at = ?4 WHERE codigo = ?5";

const SQL_HAS_SALES: &str = "SELECT COUNT(*) > 0 FROM detalles_ventas WHERE producto_codigo = ?1";

const SQL_SOFT_DELETE: &str = "UPDATE productos SET activo = 0, stock = 0 WHERE codigo = ?1";

const SQL_DELETE_PRODUCTO: &str = "DELETE FROM productos WHERE codigo = ?1";

const SQL_IMPORT_PRODUCTO: &str =
    "INSERT OR IGNORE INTO productos (codigo, nombre, precio_usd, stock, stock_minimo, created_at, updated_at) \
     VALUES (?1, ?2, ?3, ?4, ?5, datetime('now','localtime'), ?6)";

#[tauri::command]
pub fn list_products(
    state: State<AppState>,
    search: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedResult<Producto>, String> {
    let db = state.lock_db()?;

    let has_query = search.as_ref().is_some_and(|s| !s.is_empty());
    let q = search.unwrap_or_default();
    let pattern = format!("%{}%", q);
    let p = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(constants::PAGE_SIZE_DEFAULT).max(1).min(constants::PAGE_SIZE_MAX);
    let offset = (p - 1) * ps;

    // Count
    let count_sql = if has_query {
        format!("SELECT COUNT(*) FROM productos p WHERE p.activo = 1 AND (p.codigo LIKE ?1 OR p.nombre LIKE ?1)")
    } else {
        "SELECT COUNT(*) FROM productos p WHERE p.activo = 1".to_string()
    };
    let total: i64 = if has_query {
        db.query_row(&count_sql, params![pattern], |row| row.get(0)).unwrap_or(0)
    } else {
        db.query_row(&count_sql, [], |row| row.get(0)).unwrap_or(0)
    };

    // Data
    let sql = if has_query {
        format!("{} AND (p.codigo LIKE ?1 OR p.nombre LIKE ?1) ORDER BY p.nombre ASC LIMIT ?2 OFFSET ?3", SQL_BASE_PRODUCTOS)
    } else {
        format!("{} ORDER BY p.nombre ASC LIMIT ?1 OFFSET ?2", SQL_BASE_PRODUCTOS)
    };

    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

    let products: Vec<Producto> = if has_query {
        stmt.query_map(rusqlite::params![pattern, ps, offset], row_to_producto)
    } else {
        stmt.query_map(rusqlite::params![ps, offset], row_to_producto)
    }
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(PaginatedResult { total, page: p, page_size: ps, data: products })
}

#[tauri::command]
pub fn create_product(
    state: State<AppState>,
    codigo: String,
    nombre: String,
    precio_usd: f64,
    stock: i64,
) -> Result<String, String> {
    let mut db = state.lock_db()?;
    let codigo = if codigo.is_empty() {
        let next_id: i64 = db
            .query_row(SQL_NEXT_CODIGO, [], |row| row.get(0))
            .map_err(|e| format!("Error al generar código de producto: {}", e))?;
        format!("P{:04}", next_id)
    } else {
        codigo
    };
    let ts = crate::helpers::now_iso();
    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;
    crate::auth::require_admin(
        &state,
        &tx,
        &format!("Creó producto '{}' (Código: {})", nombre, codigo),
    )?;
    tx.execute(
        SQL_UPDATE_REACTIVATE,
        params![nombre, precio_usd, stock, ts, codigo],
    )
    .ok();

    match tx.execute(
        SQL_INSERT_PRODUCTO,
        params![codigo, nombre, precio_usd, stock, ts],
    ) {
        Ok(_) => {
            tx.commit().map_err(|e| format!("Error al confirmar: {}", e))?;
            Ok("Producto creado exitosamente".to_string())
        }
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
) -> Result<String, String> {
    let db = state.lock_db()?;
    let ts = crate::helpers::now_iso();
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Actualizó producto '{}'", codigo),
    )?;

    match db.execute(
        SQL_UPDATE_PRODUCTO,
        params![nombre, precio_usd, stock, ts, codigo],
    ) {
        Ok(_) => Ok("Producto actualizado exitosamente".to_string()),
        Err(e) => Err(format!("Error al actualizar producto: {}", e)),
    }
}

#[tauri::command]
pub fn delete_product(state: State<AppState>, codigo: String) -> Result<String, String> {
    let db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        &format!("Eliminó producto código '{}'", codigo),
    )?;

    let has_sales: bool = db
        .query_row(SQL_HAS_SALES, params![codigo], |row| row.get(0))
        .map_err(|e| format!("Error al verificar ventas del producto: {}", e))?;

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

    let db = state.lock_db()?;
    crate::auth::require_admin(&state, &db, "Importó productos desde archivo DB")?;

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
        .prepare("SELECT codigo, nombre, precio_usd, stock, COALESCE(stock_minimo, 0) FROM productos WHERE activo = 1 OR activo IS NULL")
        .map_err(|e| format!("Error leyendo productos: {}", e))?;

    let products: Vec<(String, String, f64, i64, i64)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, i64>(4)?,
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

    let ts = crate::helpers::now_iso();
    let mut imported = 0;
    for (codigo, nombre, precio_usd, stock, stock_minimo) in &products {
        match db.execute(
            SQL_IMPORT_PRODUCTO,
            params![codigo, nombre, precio_usd, stock, stock_minimo, ts],
        ) {
            Ok(n) => {
                if n > 0 {
                    imported += 1;
                }
            }
            Err(_) => {}
        }
    }

    let skipped = products.len() - imported;
    Ok(format!(
        "Importados {} productos ({} ya existían).",
        imported, skipped
    ))
}

#[tauri::command]
pub fn export_products_xlsx(state: State<AppState>, tasa: f64) -> Result<String, String> {
    let db = state.lock_db()?;

    let full_sql = format!("{} ORDER BY p.nombre ASC", SQL_BASE_PRODUCTOS);
    let mut stmt = db.prepare(&full_sql).map_err(|e| e.to_string())?;

    let products: Vec<Producto> = stmt
        .query_map([], row_to_producto)
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

    Ok(b64)
}

#[tauri::command]
pub fn replace_all_products(
    state: State<AppState>,
    content: String,
) -> Result<String, String> {
    let mut db = state.lock_db()?;
    crate::auth::require_admin(&state, &db, "Reemplazó todos los productos")?;

    let tx = db.transaction().map_err(|e| format!("Error al iniciar transacción: {}", e))?;

    tx.execute("UPDATE productos SET activo = 0 WHERE activo = 1", [])
        .map_err(|e| format!("Error al limpiar productos: {}", e))?;

    let mut count = 0;
    let mut errors: Vec<String> = Vec::new();

    for (line_no, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() { continue; }

        let cols: Vec<&str> = line.split('\t').collect();
        if cols.len() < 3 {
            errors.push(format!("Línea {}: columnas insuficientes ({})", line_no + 1, cols.len()));
            continue;
        }

        let nombre = cols[0].trim();
        let stock_str = cols[1].trim();
        let precio_str = cols[2].trim().replace(',', ".");

        let stock: i64 = match stock_str.parse() {
            Ok(s) => s,
            Err(_) => { errors.push(format!("Línea {}: stock inválido '{}'", line_no + 1, stock_str)); continue; }
        };
        let precio_usd: f64 = match precio_str.parse() {
            Ok(p) => p,
            Err(_) => { errors.push(format!("Línea {}: precio inválido '{}'", line_no + 1, precio_str)); continue; }
        };

        let codigo = format!("P{:04}", count + 1);

        let ts = crate::helpers::now_iso();
        tx.execute(SQL_IMPORT_PRODUCTO, params![codigo, nombre, precio_usd, stock, 0, ts])
            .map_err(|e| errors.push(format!("Línea {}: '{}' - {}", line_no + 1, nombre, e)))
            .ok();
        count += 1;
    }

    if errors.is_empty() {
        tx.commit().map_err(|e| format!("Error al confirmar transacción: {}", e))?;
    } else {
        // Rollback on any errors to preserve original state
        drop(tx);
    }

    let msg = format!("{} productos reemplazados.", count);
    if errors.is_empty() {
        Ok(msg)
    } else {
        let detail = errors.iter().take(5).cloned().collect::<Vec<_>>().join("\n");
        let suffix = if errors.len() > 5 { format!("\n... y {} más", errors.len() - 5) } else { String::new() };
        Ok(format!("{}.\nErrores ({}):\n{}{}", msg, errors.len(), detail, suffix))
    }
}

pub(crate) fn parse_product_tsv_line(line: &str, line_no: usize, count: i64) -> Result<(String, String, i64, f64), String> {
    let cols: Vec<&str> = line.split('\t').collect();
    if cols.len() < 3 {
        return Err(format!("Línea {}: columnas insuficientes ({})", line_no + 1, cols.len()));
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

    let stock: i64 = stock_str.parse().map_err(|_| format!("Línea {}: stock inválido '{}'", line_no + 1, stock_str))?;
    let precio_usd: f64 = precio_str.parse().map_err(|_| format!("Línea {}: precio inválido '{}'", line_no + 1, precio_str))?;
    let codigo = codigo.unwrap_or_else(|| format!("P{:04}", count + 1));
    let nombre = nombre.trim_end_matches("*UND*-").trim_end_matches(',').to_string();

    Ok((codigo, nombre, stock, precio_usd))
}

pub(crate) fn format_import_result(count: i64, errors: &[String]) -> String {
    if errors.is_empty() {
        return format!("Importados {} productos sin errores.", count);
    }
    let detail = errors.iter().take(10).cloned().collect::<Vec<_>>().join("\n");
    let suffix = if errors.len() > 10 { format!("\n... y {} más", errors.len() - 10) } else { String::new() };
    format!("Importados {} productos.\nErrores ({}):\n{}{}", count, errors.len(), detail, suffix)
}

#[tauri::command]
pub fn import_products_from_file(
    state: State<AppState>,
    content: String,
) -> Result<String, String> {
    let db = state.lock_db()?;
    crate::auth::require_admin(
        &state,
        &db,
        "Importó productos vía upload",
    )?;

    let mut count = 0;
    let mut errors: Vec<String> = Vec::new();
    let ts = crate::helpers::now_iso();

    for (line_no, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() { continue; }

        match parse_product_tsv_line(line, line_no, count) {
            Ok((codigo, nombre, stock, precio_usd)) => {
                if let Err(e) = db.execute(
                    SQL_IMPORT_PRODUCTO,
                    params![codigo, nombre, precio_usd, stock, 0, ts],
                ) {
                    errors.push(format!("Línea {}: '{}' - {}", line_no + 1, nombre, e));
                    continue;
                }
                count += 1;
            }
            Err(e) => errors.push(e),
        }
    }

    Ok(format_import_result(count, &errors))
}

#[tauri::command]
pub fn get_top_products(
    state: State<AppState>,
    start_date: Option<String>,
    end_date: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<TopProductItem>, String> {
    let db = state.lock_db()?;

    let mut sql = String::from(
        "SELECT d.producto_codigo, d.producto_nombre, SUM(d.cantidad), SUM(d.subtotal_usd)
         FROM detalles_ventas d
         JOIN ventas v ON v.id = d.venta_id
         WHERE v.anulada = 0"
    );

    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let (Some(s), Some(e)) = (&start_date, &end_date) {
        if !s.is_empty() && !e.is_empty() {
            let eod = format!("{} 23:59:59", e);
            sql.push_str(" AND v.fecha_hora >= ?1 AND v.fecha_hora <= ?2");
            params_vec.push(Box::new(s.clone()));
            params_vec.push(Box::new(eod));
        }
    }

    sql.push_str(" GROUP BY d.producto_codigo ORDER BY SUM(d.subtotal_usd) DESC");

    if let Some(l) = limit {
        if l > 0 {
            sql.push_str(&format!(" LIMIT {}", l));
        }
    }

    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let products = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(TopProductItem {
                codigo: row.get(0)?,
                nombre: row.get(1)?,
                cantidad_vendida: row.get(2)?,
                total_usd: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(products)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_tsv_7_columns() {
        let line = "P001\tNombre, Producto\t100\t...\t...\t10.50\t...";
        let result = parse_product_tsv_line(line, 0, 0);
        assert!(result.is_ok());
        let (codigo, nombre, stock, precio) = result.unwrap();
        assert_eq!(codigo, "P001");
        assert_eq!(nombre, "Nombre, Producto");
        assert_eq!(stock, 100);
        assert!((precio - 10.50).abs() < 0.01);
    }

    #[test]
    fn test_parse_tsv_6_columns_autocode() {
        let line = "Nombre\t50\t...\t...\t25.00\t...";
        let result = parse_product_tsv_line(line, 0, 5);
        assert!(result.is_ok());
        let (codigo, nombre, stock, precio) = result.unwrap();
        assert_eq!(codigo, "P0006");
        assert_eq!(nombre, "Nombre");
        assert_eq!(stock, 50);
        assert!((precio - 25.00).abs() < 0.01);
    }

    #[test]
    fn test_parse_tsv_3_columns() {
        let line = "Nombre\t30\t15.50";
        let result = parse_product_tsv_line(line, 1, 10);
        assert!(result.is_ok());
        let (codigo, nombre, stock, precio) = result.unwrap();
        assert_eq!(codigo, "P0011");
        assert_eq!(nombre, "Nombre");
        assert_eq!(stock, 30);
        assert!((precio - 15.50).abs() < 0.01);
    }

    #[test]
    fn test_parse_tsv_insufficient_columns() {
        let line = "P001\tSolo";
        let result = parse_product_tsv_line(line, 0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("columnas insuficientes"));
    }

    #[test]
    fn test_parse_tsv_invalid_stock() {
        let line = "P001\tNombre\tabc\t...\t...\t10.50\t...";
        let result = parse_product_tsv_line(line, 2, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("stock inválido"));
    }

    #[test]
    fn test_parse_tsv_invalid_precio() {
        let line = "P001\tNombre\t10\t...\t...\txyz\t...";
        let result = parse_product_tsv_line(line, 0, 0);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("precio inválido"));
    }

    #[test]
    fn test_format_import_result_no_errors() {
        let result = format_import_result(10, &[]);
        assert_eq!(result, "Importados 10 productos sin errores.");
    }

    #[test]
    fn test_format_import_result_with_errors() {
        let errors = vec!["Error 1".to_string(), "Error 2".to_string()];
        let result = format_import_result(5, &errors);
        assert!(result.contains("Importados 5 productos"));
        assert!(result.contains("Error 1"));
        assert!(result.contains("Error 2"));
    }

    #[test]
    fn test_format_import_result_many_errors() {
        let errors: Vec<String> = (0..15).map(|i| format!("Error {}", i)).collect();
        let result = format_import_result(0, &errors);
        assert!(result.contains("... y 5 más"));
    }
}
