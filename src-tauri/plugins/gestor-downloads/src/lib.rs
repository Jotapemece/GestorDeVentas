use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::GestorDownloads;
#[cfg(mobile)]
use mobile::GestorDownloads;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the gestor-downloads APIs.
pub trait GestorDownloadsExt<R: Runtime> {
  fn gestor_downloads(&self) -> &GestorDownloads<R>;
}

impl<R: Runtime, T: Manager<R>> crate::GestorDownloadsExt<R> for T {
  fn gestor_downloads(&self) -> &GestorDownloads<R> {
    self.state::<GestorDownloads<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("gestor-downloads")
    .invoke_handler(tauri::generate_handler![
      commands::ping,
      commands::save_to_downloads,
      commands::save_to_path
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let gestor_downloads = mobile::init(app, api)?;
      #[cfg(desktop)]
      let gestor_downloads = desktop::init(app, api)?;
      app.manage(gestor_downloads);
      Ok(())
    })
    .build()
}
