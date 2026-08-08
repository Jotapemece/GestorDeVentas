mod auth;
mod audit;
mod cashier;
mod clients;
mod combos;
mod config;
mod constants;
mod db;
mod efectivo;
mod helpers;
mod migrations;
mod models;
mod openrouter;
mod pdf;
mod products;
mod sales;
mod sync;
mod tasa_bcv;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_gestor_downloads::init())
        .setup(|app| {
            let (conn, db_path) = match db::init_db(app.handle()) {
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
                admin_action_attempts: std::sync::Mutex::new(std::collections::HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            auth::login,
            auth::logout,
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
            // Sales
            sales::create_sale,
            sales::get_sale_detail,
            sales::get_tasa,
            sales::set_tasa,
            sales::void_sale,
            sales::get_sales_report,
            sales::get_product_history,
            sales::export_report_xlsx,
            sales::export_report_pdf,
            sales::void_sale_items,
            sales::get_sales_by_vendor,
            // Clients
            clients::list_clientes,
            clients::create_cliente,
            clients::quick_create_cliente,
            clients::toggle_cliente_credito,
            clients::get_cliente_history,
            clients::pay_debt,
            clients::update_cliente,
            clients::delete_cliente,
            clients::add_quick_debt,
            clients::list_clientes_eliminados,
            // Cashier
            cashier::get_daily_summary,
            cashier::close_cashier,
            cashier::get_close_report_data,
            cashier::list_cierres,
            cashier::get_cierre_detalle,
            cashier::abrir_caja,
            cashier::get_caja_abierta,
            cashier::get_dashboard_summary,
            cashier::get_dashboard_payment_methods,
            cashier::get_profit_series,
            cashier::register_movimiento,
            cashier::list_movimientos,
            cashier::get_saldo_caja,
            // Audit
            audit::get_audit_logs,
            audit::clear_audit,
            // Config
            config::get_config_value,
            config::set_config_value,
            config::get_user_config_value,
            config::set_user_config_value,
            // Efectivo (pseudo-producto)
            efectivo::get_efectivo_saldo,
            efectivo::ajustar_efectivo_bs,
            // Tasa BCV
            tasa_bcv::fetch_tasa_bcv,
            tasa_bcv::get_historial_tasas,
            // DB
            db::backup_database,
            db::backup_database_b64,
            db::restore_backup,
            db::get_backup_key,
            db::save_exported_file,
            // Auth
            auth::admin_change_password,
            auth::reset_usuarios,
            // Products
            products::get_top_products,
            products::update_stock_minimo,
            products::set_product_inari,
            products::update_product_categoria,
            products::list_categorias,
            products::registrar_ajuste_stock,
            products::toggle_producto_favorito,
            products::get_precio_historial,
            // Sync
            sync::download_products,
            sync::download_clientes,
            sync::upload_usuarios,
            sync::download_usuarios,
            sync::register_device,
            sync::list_dispositivos,
            sync::get_conflictos,
            sync::resolve_conflicto,
            sync::upload_all,
            sync::download_all,
            sync::sync_all,
            sync::get_sync_stats,
            sync::test_supabase_connection,
            sync::preview_download,
            sync::apply_download,
            // Combos
            combos::create_combo,
            combos::delete_combo,
            combos::list_combos_simple,
            // OpenRouter
            openrouter::generate_purchase_suggestion,
            openrouter::chat_with_ai,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
