// Shared constants

pub const PAGO_MOVIL_REF_LEN: usize = 4;
pub const MONTO_TOLERANCIA: f64 = 0.01;
pub const FECHA_MAXIMA: &str = "9999-12-31";

// Payment method constants
// Some are only used by JS frontend via string values
pub const METODO_PAGO_MOVIL: &str = "pago_movil";
pub const METODO_CREDITO: &str = "credito";
pub const METODO_MIXTO: &str = "mixto";

#[allow(dead_code)]
pub const METODO_EFECTIVO_BS: &str = "efectivo_bs";
#[allow(dead_code)]
pub const METODO_EFECTIVO_USD: &str = "efectivo_usd";
#[allow(dead_code)]
pub const METODO_BIOPAGO: &str = "biopago";
#[allow(dead_code)]
pub const METODO_PUNTO: &str = "punto";
#[allow(dead_code)]
pub const METODOS_PAGO_MIXTO: &[&str] = &[
    METODO_EFECTIVO_BS,
    METODO_EFECTIVO_USD,
    METODO_BIOPAGO,
    METODO_PUNTO,
    METODO_PAGO_MOVIL,
];
#[allow(dead_code)]
pub const CFG_TASA_DOLAR: &str = "tasa_dolar";
#[allow(dead_code)]
pub const CFG_TASA_UPDATED_AT: &str = "tasa_updated_at";
#[allow(dead_code)]
pub const CFG_CAJA_ABIERTA: &str = "caja_abierta";
#[allow(dead_code)]
pub const CFG_TEMA: &str = "tema";
#[allow(dead_code)]
pub const CFG_FONT_SIZE: &str = "font_size";
#[allow(dead_code)]
pub const CFG_SONIDO_HABILITADO: &str = "sonido_habilitado";
#[allow(dead_code)]
pub const CFG_SONIDO_VOLUMEN: &str = "sonido_volumen";
#[allow(dead_code)]
pub const CFG_HISTORIAL_LIMPIEZA_DIAS: &str = "historial_limpieza_dias";
#[allow(dead_code)]
pub const CLIENTE_CREDITO_ACTIVO_POR_DEFECTO: bool = true;

// Audit constants
pub const AUDIT_LOG_DEFAULT_LIMIT: i64 = 50;

// Defaults
pub const VENTAS_LIMIT_DEFAULT: i64 = 100;

pub const TEMAS_DISPONIBLES: &[&str] = &[
    "oscuro", "claro", "azul", "verde", "morado", "turquesa", "naranja",
];

pub const SQL_USERNAME_BY_ID: &str = "SELECT username FROM usuarios WHERE id = ?1";
pub const SQL_TASA: &str = "SELECT CAST(valor AS REAL) FROM configuracion WHERE clave = 'tasa_dolar'";
