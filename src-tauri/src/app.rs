/// Sale de la aplicación. Usado por el botón Atrás de Android (doble pulsación
/// en la vista raíz): el WebView no puede `window.close()` de forma fiable.
#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}