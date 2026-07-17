mod auth;
mod audit;
mod cashier;
mod clients;
mod config;
mod constants;
mod db;
mod migrations;
mod models;
mod products;
mod sales;
mod tasa_bcv;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let (conn, db_path) = match db::init_db(&app.handle()) {
                Ok(t) => t,
                Err(e) => {
                    eprintln!("Error al inicializar BD: {}", e);
                    std::process::exit(1);
                }
            };
            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
                db_path: std::sync::Mutex::new(db_path),
                current_user: std::sync::Mutex::new(None),
                login_attempts: std::sync::Mutex::new(std::collections::HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth::login,
            auth::logout,
            auth::get_current_user,
            auth::create_usuario,
            auth::list_usuarios,
            auth::delete_usuario,
            auth::change_password,
            // Products
            products::list_products,
            products::create_product,
            products::update_product,
            products::delete_product,
            products::export_products_xlsx,
            products::import_products_from_file,
            products::import_products_from_db,
            products::replace_all_products,
            // Sales
            sales::create_sale,
            sales::list_sales,
            sales::get_sale_detail,
            sales::get_tasa,
            sales::set_tasa,
            sales::void_sale,
            sales::get_sales_report,
            // Clients
            clients::list_clientes,
            clients::create_cliente,
            clients::toggle_cliente_credito,
            clients::get_cliente_history,
            clients::pay_debt,
            clients::update_cliente,
            clients::delete_cliente,
            // Cashier
            cashier::get_daily_summary,
            cashier::close_cashier,
            cashier::get_close_report_data,
            cashier::list_cierres,
            cashier::get_cierre_detalle,
            cashier::abrir_caja,
            cashier::get_caja_abierta,
            // Audit
            audit::get_audit_logs,
            audit::get_cierres,
            audit::clear_audit,
            // Config
            config::get_config_value,
            config::set_config_value,
            config::list_theme_names,
            // Tasa BCV
            tasa_bcv::fetch_tasa_bcv,
            tasa_bcv::check_tasa_update,
            // DB
            db::backup_database,
            // Auth
            auth::admin_change_password,
            // Products
            products::get_top_products,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
