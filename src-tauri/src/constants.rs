// Shared constants

pub const PASSWORD_MIN_LENGTH: usize = 6;

pub const PAGO_MOVIL_REF_LEN: usize = 4;
pub const MONTO_TOLERANCIA: f64 = 0.01;
pub const FECHA_MAXIMA: &str = "9999-12-31";

pub const METODO_PAGO_MOVIL: &str = "pago_movil";
pub const METODO_EFECTIVO_BS: &str = "efectivo_bs";
pub const METODO_CREDITO: &str = "credito";
pub const METODO_MIXTO: &str = "mixto";
pub const METODO_MOVIMIENTOS_CAJA: &str = "movimientos_caja";

/// Pseudo-producto que representa el efectivo físico disponible en Bs. (el "stock"
/// es `efectivo_disponible_bs`). Venderlo = entregar billetes a cambio de otro método.
pub const CODIGO_EFECTIVO: &str = "EFECTIVO";

pub const AUDIT_LOG_DEFAULT_LIMIT: i64 = 50;

pub const VENTAS_LIMIT_DEFAULT: i64 = 100;

// SQL
pub const SQL_USERNAME_BY_ID: &str = "SELECT username FROM usuarios WHERE id = ?1";
pub const SQL_TASA: &str = "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'";
pub const SQL_DATETIME_NOW: &str = "datetime('now','localtime')";

pub fn sanitize_audit(s: &str) -> String {
    s.chars().filter(|&c| c != '\n' && c != '\r' && c != '\t').take(500).collect()
}

// Config keys
pub const CFG_TASA_DOLAR: &str = "tasa_dolar";
pub const CFG_TASA_UPDATED_AT: &str = "tasa_updated_at";
pub const CFG_CAJA_ABIERTA: &str = "caja_abierta";
pub const CFG_HISTORIAL_LIMPIEZA_DIAS: &str = "historial_limpieza_dias";
pub const CFG_ULTIMO_UPLOAD: &str = "ultimo_upload";
pub const CFG_ULTIMO_DOWNLOAD: &str = "ultimo_download";
pub const CFG_ULTIMO_UPLOAD_VENTAS: &str = "ultimo_upload_ventas";
pub const CFG_ULTIMO_DOWNLOAD_VENTAS: &str = "ultimo_download_ventas";
pub const CFG_ULTIMO_UPLOAD_CLIENTES: &str = "ultimo_upload_clientes";
pub const CFG_ULTIMO_DOWNLOAD_CLIENTES: &str = "ultimo_download_clientes";
pub const CFG_ULTIMO_UPLOAD_USUARIOS: &str = "ultimo_upload_usuarios";
pub const CFG_ULTIMO_DOWNLOAD_USUARIOS: &str = "ultimo_download_usuarios";
pub const CFG_ULTIMO_UPLOAD_ALERTAS: &str = "ultimo_upload_alertas";
pub const CFG_ULTIMO_DOWNLOAD_ALERTAS: &str = "ultimo_download_alertas";
pub const CFG_ULTIMO_UPLOAD_SOLICITUDES: &str = "ultimo_upload_solicitudes";
pub const CFG_ULTIMO_DOWNLOAD_SOLICITUDES: &str = "ultimo_download_solicitudes";
pub const CFG_DISPOSITIVO_ID: &str = "dispositivo_id";
/// Flag: el dispositivo ya completó su primera descarga completa. Antes de
/// eso, los downloaders fuerzan el dato remoto (LWW off) para sanar la BD
/// local en reinstalaciones/restauraciones con datos viejos.
pub const CFG_FIRST_SYNC_DONE: &str = "first_sync_done";
pub const CFG_SUPABASE_URL: &str = "supabase_url";
pub const CFG_SUPABASE_KEY: &str = "supabase_key";
pub const CFG_BACKUP_KEY: &str = "backup_encryption_key";
pub const CFG_OPENROUTER_API_KEY: &str = "openrouter_api_key";
pub const CFG_ULTIMO_BACKUP_DIARIO: &str = "ultimo_backup_diario";
pub const CFG_MAX_BACKUPS: &str = "max_backups";
pub const DEFAULT_MAX_BACKUPS: usize = 10;
pub const CFG_EFECTIVO_DISPONIBLE: &str = "efectivo_disponible_bs";

// Roles
pub const ROL_ADMIN: &str = "admin";
pub const ROL_VENDEDOR: &str = "vendedor";

// Default values
pub const DB_FILENAME: &str = "gestor_ventas.db";
pub const BACKUP_FILENAME_PREFIX: &str = "gestor_ventas_backup_";
#[cfg(not(target_os = "android"))]
pub const AUTO_IMPORT_FILENAME: &str = "productos";
pub const DEFAULT_ADMIN_USERNAME: &str = "Jota_admin";
pub const DEFAULT_ADMIN_PASSWORD: &str = "233323*";

// Supabase
pub const SUPABASE_URL: &str = "https://xryvxaslbtouihbulonw.supabase.co";
pub const SUPABASE_KEY: &str = "sb_publishable_3XXhx5ktfhrUvngJDYAQAA_xPCRMFzh";

// Pagination
pub const PAGE_SIZE_DEFAULT: i64 = 200;
pub const PAGE_SIZE_MAX: i64 = 5000;

// Rounding
pub const ROUNDING_FACTOR: f64 = 100.0;

// Payment method labels (must match METODO_LABELS in constants.js)
pub fn metodo_label(key: &str) -> &str {
    match key {
        "efectivo_bs" => "Efectivo Bs.",
        "efectivo_usd" => "Efectivo USD",
        "pago_movil" => "Pago Móvil",
        "punto" => "Punto",
        "biopago" => "Biopago",
        "credito" => "Crédito",
        "mixto" => "Mixto",
        _ => key,
    }
}
