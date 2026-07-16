use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Producto {
    pub codigo: String,
    pub nombre: String,
    pub precio_usd: f64,
    pub stock: i64,
    pub stock_minimo: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Usuario {
    pub id: i64,
    pub username: String,
    pub rol: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cliente {
    pub id: i64,
    pub nombre: String,
    pub credito_activo: bool,
    pub saldo_deuda_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Venta {
    pub id: i64,
    pub fecha_hora: String,
    pub usuario_id: i64,
    pub username: String,
    pub metodo_pago: String,
    pub referencia_pago_movil: Option<String>,
    pub pago_detalle: Option<String>,
    pub cliente_id: Option<i64>,
    pub cliente_nombre: Option<String>,
    pub total_usd: f64,
    pub tasa_aplicada: f64,
    pub total_bs: f64,
    pub anulada: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetalleVenta {
    pub id: i64,
    pub venta_id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub cantidad: i64,
    pub precio_usd_unitario: f64,
    pub subtotal_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistorialAccion {
    pub id: i64,
    pub fecha_hora: String,
    pub usuario: String,
    pub accion: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailySummary {
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub ventas: Vec<Venta>,
    pub tasa_actual: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloseReport {
    pub fecha_cierre: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub usuario: String,
    pub tasa_cierre: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductoVenta {
    pub codigo: String,
    pub cantidad: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PagoItem {
    pub metodo: String,
    pub monto_usd: f64,
    pub referencia: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateSaleRequest {
    pub usuario_id: i64,
    pub metodo_pago: String,
    pub referencia_pago_movil: Option<String>,
    pub cliente_id: Option<i64>,
    pub productos: Vec<ProductoVenta>,
    pub tasa: f64,
    pub pago_detalle: Option<Vec<PagoItem>>,
    pub total_bs_ingresado: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
    pub usuario: Option<Usuario>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PayDebtRequest {
    pub cliente_id: i64,
    pub monto_usd: f64,
    pub metodo_pago: String,
    pub referencia_pago_movil: Option<String>,
    pub usuario_id: i64,
    pub pago_detalle: Option<Vec<PagoItem>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MetodoTotal {
    pub metodo: String,
    pub total_usd: f64,
    pub referencias: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloseReportData {
    pub fecha_cierre: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub tasa_cierre: f64,
    pub por_metodo: Vec<MetodoTotal>,
    pub productos_vendidos: Vec<ProductoReporte>,
    pub clientes_credito: Vec<ClienteCreditoReporte>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CierreListItem {
    pub id: i64,
    pub fecha_hora: String,
    pub username: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub tasa_cierre: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CierreDetalle {
    pub cierre: CierreListItem,
    pub detalle: CloseReportData,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductoReporte {
    pub nombre: String,
    pub cantidad: i64,
    pub total_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClienteCreditoReporte {
    pub nombre: String,
    pub total_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClienteHistory {
    pub cliente: Cliente,
    pub ventas: Vec<VentaDetallada>,
    pub total_deuda: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SalesReportFilter {
    pub start_date: String,
    pub end_date: String,
    pub producto_codigo: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SalesReportItem {
    pub venta: Venta,
    pub productos: Vec<DetalleVenta>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SalesReportResult {
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub ventas: Vec<SalesReportItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VentaDetallada {
    pub id: i64,
    pub fecha_hora: String,
    pub total_usd: f64,
    pub tasa_aplicada: f64,
    pub productos: Vec<DetalleVenta>,
}
