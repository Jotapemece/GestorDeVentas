use tauri::{AppHandle, command, Runtime};

use crate::models::*;
use crate::Result;
use crate::GestorDownloadsExt;

#[command]
pub(crate) async fn ping<R: Runtime>(
    app: AppHandle<R>,
    payload: PingRequest,
) -> Result<PingResponse> {
    app.gestor_downloads().ping(payload)
}

#[command]
pub(crate) async fn save_to_downloads<R: Runtime>(
    app: AppHandle<R>,
    payload: SaveRequest,
) -> Result<SavePathResponse> {
    app.gestor_downloads().save_to_downloads(payload)
}

#[command]
pub(crate) async fn save_to_path<R: Runtime>(
    app: AppHandle<R>,
    payload: SavePathRequest,
) -> Result<SavePathResponse> {
    app.gestor_downloads().save_to_path(payload)
}