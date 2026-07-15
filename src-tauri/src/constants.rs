// Shared constants

pub const PAGO_MOVIL_REF_LEN: usize = 4;
pub const MONTO_TOLERANCIA: f64 = 0.01;
pub const FECHA_MAXIMA: &str = "9999-12-31";

// Payment method constants
pub const METODO_EFECTIVO_BS: &str = "efectivo_bs";
pub const METODO_EFECTIVO_USD: &str = "efectivo_usd";
pub const METODO_BIOPAGO: &str = "biopago";
pub const METODO_PUNTO: &str = "punto";
pub const METODO_PAGO_MOVIL: &str = "pago_movil";
pub const METODO_CREDITO: &str = "credito";
pub const METODO_MIXTO: &str = "mixto";

pub const METODOS_PAGO_MIXTO: &[&str] = &[
    METODO_EFECTIVO_BS,
    METODO_EFECTIVO_USD,
    METODO_BIOPAGO,
    METODO_PUNTO,
    METODO_PAGO_MOVIL,
];

// Config keys
pub const CFG_TASA_DOLAR: &str = "tasa_dolar";
pub const CFG_TASA_UPDATED_AT: &str = "tasa_updated_at";
pub const CFG_CAJA_ABIERTA: &str = "caja_abierta";
pub const CFG_TEMA: &str = "tema";
pub const CFG_FONT_SIZE: &str = "font_size";
pub const CFG_SONIDO_HABILITADO: &str = "sonido_habilitado";
pub const CFG_SONIDO_VOLUMEN: &str = "sonido_volumen";
pub const CFG_HISTORIAL_LIMPIEZA_DIAS: &str = "historial_limpieza_dias";

// Audit constants
pub const AUDIT_LOG_DEFAULT_LIMIT: i64 = 50;

// Defaults
pub const CLIENTE_CREDITO_ACTIVO_POR_DEFECTO: bool = true;

pub const VENTAS_LIMIT_DEFAULT: i64 = 100;

pub const TEMAS_DISPONIBLES: &[&str] = &[
    "oscuro", "claro", "azul", "verde", "morado", "turquesa", "naranja",
];

pub const SQL_USERNAME_BY_ID: &str = "SELECT username FROM usuarios WHERE id = ?1";
pub const SQL_TASA: &str = "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'";
