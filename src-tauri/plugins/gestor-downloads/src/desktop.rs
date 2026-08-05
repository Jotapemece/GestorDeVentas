use serde::de::DeserializeOwned;
use std::{
  fs::{self, File},
  io::Write,
  path::PathBuf,
};
use tauri::{plugin::PluginApi, AppHandle, Manager, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<GestorDownloads<R>> {
  Ok(GestorDownloads(app.clone()))
}

/// Access to the gestor-downloads APIs.
pub struct GestorDownloads<R: Runtime>(AppHandle<R>);

fn decode_base64(content: &str) -> crate::Result<Vec<u8>> {
  use base64::Engine;
  base64::engine::general_purpose::STANDARD
    .decode(content)
    .map_err(|e| crate::Error::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, e)))
}

fn sanitize_name(name: &str) -> String {
  let cleaned: String = name
    .chars()
    .map(|c| match c {
      '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
      _ => c,
    })
    .collect();
  if cleaned.trim().is_empty() {
    "archivo".into()
  } else {
    cleaned
  }
}

impl<R: Runtime> GestorDownloads<R> {
  pub fn ping(&self, payload: PingRequest) -> crate::Result<PingResponse> {
    Ok(PingResponse {
      value: payload.value,
    })
  }

  pub fn save_to_downloads(&self, payload: SaveRequest) -> crate::Result<SavePathResponse> {
    let bytes = decode_base64(&payload.content)?;
    let dir = self
      .0
      .path()
      .download_dir()
      .map_err(|e| crate::Error::Io(std::io::Error::other(e.to_string())))?;
    fs::create_dir_all(&dir)?;
    let path: PathBuf = dir.join(sanitize_name(&payload.file_name));
    let mut f = File::create(&path)?;
    f.write_all(&bytes)?;
    Ok(SavePathResponse {
      path: path.to_string_lossy().into_owned(),
    })
  }

  pub fn save_to_path(&self, payload: SavePathRequest) -> crate::Result<SavePathResponse> {
    let bytes = decode_base64(&payload.content)?;
    let path: PathBuf = PathBuf::from(&payload.path);
    if let Some(parent) = path.parent() {
      fs::create_dir_all(parent)?;
    }
    let mut f = File::create(&path)?;
    f.write_all(&bytes)?;
    Ok(SavePathResponse {
      path: path.to_string_lossy().into_owned(),
    })
  }
}