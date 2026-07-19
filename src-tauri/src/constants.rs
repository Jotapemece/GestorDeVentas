// Shared constants

pub const PAGO_MOVIL_REF_LEN: usize = 4;
pub const MONTO_TOLERANCIA: f64 = 0.01;
pub const FECHA_MAXIMA: &str = "9999-12-31";

pub const METODO_PAGO_MOVIL: &str = "pago_movil";
pub const METODO_CREDITO: &str = "credito";
pub const METODO_MIXTO: &str = "mixto";

pub const AUDIT_LOG_DEFAULT_LIMIT: i64 = 50;

pub const VENTAS_LIMIT_DEFAULT: i64 = 100;

pub const TEMAS_DISPONIBLES: &[&str] = &[
    "oscuro", "claro", "azul", "verde", "morado", "turquesa", "naranja",
];

// SQL
pub const SQL_USERNAME_BY_ID: &str = "SELECT username FROM usuarios WHERE id = ?1";
pub const SQL_TASA: &str = "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'";
pub const SQL_DATETIME_NOW: &str = "datetime('now','localtime')";

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
pub const CFG_DISPOSITIVO_ID: &str = "dispositivo_id";
pub const CFG_SUPABASE_URL: &str = "supabase_url";
pub const CFG_SUPABASE_KEY: &str = "supabase_key";

// Roles
pub const ROL_ADMIN: &str = "admin";
pub const ROL_VENDEDOR: &str = "vendedor";

// Default values
pub const DB_FILENAME: &str = "gestor_ventas.db";
pub const BACKUP_FILENAME_PREFIX: &str = "gestor_ventas_backup_";
pub const AUTO_IMPORT_FILENAME: &str = "productos";
pub const DEFAULT_ADMIN_USERNAME: &str = "admin";
pub const DEFAULT_ADMIN_PASSWORD: &str = "admin";
pub const DEFAULT_JOTA_USERNAME: &str = "jota";
pub const DEFAULT_JOTA_PASSWORD: &str = "1234";
pub const DEFAULT_VENDEDOR_USERNAME: &str = "vendedor";
pub const DEFAULT_VENDEDOR_PASSWORD: &str = "1234";

// Pagination
pub const PAGE_SIZE_DEFAULT: i64 = 200;
pub const PAGE_SIZE_MAX: i64 = 500;

// Rounding
pub const ROUNDING_FACTOR: f64 = 100.0;
