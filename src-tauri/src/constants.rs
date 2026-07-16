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

pub const SQL_USERNAME_BY_ID: &str = "SELECT username FROM usuarios WHERE id = ?1";
pub const SQL_TASA: &str = "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'";
