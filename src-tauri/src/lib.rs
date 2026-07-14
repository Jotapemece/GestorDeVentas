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

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Panic hook que escribe a stderr (visible en logcat en Android)
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("*** PANIC: {}\n", info);
        let _ = std::io::Write::write(&mut std::io::stderr(), msg.as_bytes());
    }));

    #[cfg(target_os = "android")]
    {
        let _ = std::io::Write::write(
            &mut std::io::stderr(),
            b"*** GestorVentas: run() ENTRY ***\n",
        );
        android_logger::init_once(
            android_logger::Config::default()
                .with_max_level(log::LevelFilter::Info)
                .with_tag("GestorVentas"),
        );
        log::info!("run: android_logger initialized");
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = std::io::Write::write(
            &mut std::io::stderr(),
            b"*** GestorVentas: run() ENTRY (desktop) ***\n",
        );
    }

    // Write errors to stderr even after logger init, in case logger doesn't flush
    std::io::Write::write(
        &mut std::io::stderr(),
        b"*** GestorVentas: before tauri builder ***\n",
    )
    .ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            eprintln!("setup: iniciando...");
            #[cfg(target_os = "android")]
            {
                use tauri::Manager;
                let data_dir = match app.path().app_data_dir() {
                    Ok(d) => {
                        eprintln!("setup: app_data_dir = {:?}", d);
                        d
                    }
                    Err(e) => {
                        eprintln!("setup: app_data_dir() fallo: {:?}, usando fallback", e);
                        std::path::PathBuf::from("/data/data/com.gestor_ventas.app")
                    }
                };
                std::fs::create_dir_all(&data_dir).ok();
            }
            let conn = match db::init_db(&app.handle()) {
                Ok(c) => {
                    eprintln!("setup: BD inicializada correctamente");
                    c
                }
                Err(e) => {
                    eprintln!("Error al inicializar BD: {}", e);
                    return Err(e.into());
                }
            };
            app.manage(AppState {
                db: std::sync::Mutex::new(conn),
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
            // Products
            products::list_products,
            products::create_product,
            products::update_product,
            products::delete_product,
            products::export_products_xlsx,
            products::import_products_from_file,
            products::import_products_from_db,
            // Sales
            sales::create_sale,
            sales::list_sales,
            sales::get_sale_detail,
            sales::get_tasa,
            sales::set_tasa,
            // Clients
            clients::list_clientes,
            clients::create_cliente,
            clients::toggle_cliente_credito,
            clients::get_cliente_history,
            clients::pay_debt,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
