mod auth;
mod audit;
mod cashier;
mod categorias;
mod clients;
mod config;
mod constants;
mod db;
mod models;
mod products;
mod sales;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let conn = match db::init_db(&app.handle()) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Error al inicializar BD: {}", e);
                    std::process::exit(1);
                }
            };
            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
                current_user: std::sync::Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth::login,
            auth::logout,
            auth::get_current_user,
            auth::create_usuario,
            auth::list_usuarios,
            products::list_products,
            products::create_product,
            products::update_product,
            products::delete_product,
            products::export_products_xlsx,
            sales::create_sale,
            sales::list_sales,
            sales::get_sale_detail,
            sales::get_tasa,
            sales::set_tasa,
            clients::list_clientes,
            clients::create_cliente,
            clients::toggle_cliente_credito,
            clients::get_cliente_history,
            clients::pay_debt,
            cashier::get_daily_summary,
            cashier::close_cashier,
            cashier::get_close_report_data,
            cashier::list_cierres,
            cashier::get_cierre_detalle,
            audit::get_audit_logs,
            audit::get_cierres,
            products::import_products_from_file,
            products::import_products_from_db,
            cashier::abrir_caja,
            cashier::get_caja_abierta,
            config::get_config_value,
            config::set_config_value,
            config::list_theme_names,
            categorias::list_categorias,
            categorias::create_categoria,
            categorias::update_categoria,
            categorias::delete_categoria,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
