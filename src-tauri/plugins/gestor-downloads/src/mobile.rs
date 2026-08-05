use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_gestor_downloads);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<GestorDownloads<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("com.gestorventas.downloads", "ExamplePlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_gestor_downloads)?;
  Ok(GestorDownloads(handle))
}

/// Access to the gestor-downloads APIs.
pub struct GestorDownloads<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> GestorDownloads<R> {
  pub fn ping(&self, payload: PingRequest) -> crate::Result<PingResponse> {
    self
      .0
      .run_mobile_plugin("ping", payload)
      .map_err(Into::into)
  }

  pub fn save_to_downloads(&self, payload: SaveRequest) -> crate::Result<SavePathResponse> {
    self
      .0
      .run_mobile_plugin("saveToDownloads", payload)
      .map_err(Into::into)
  }

  pub fn save_to_path(&self, payload: SavePathRequest) -> crate::Result<SavePathResponse> {
    self
      .0
      .run_mobile_plugin("saveToDownloads", payload)
      .map_err(Into::into)
  }
}