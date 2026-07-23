use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Producto {
    pub codigo: String,
    pub nombre: String,
    pub precio_usd: f64,
    pub costo: f64,
    pub stock: i64,
    pub stock_minimo: i64,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Conflicto {
    pub id: i64,
    pub tabla: String,
    pub item_id: String,
    pub local_json: String,
    pub remote_json: String,
    pub resuelto: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Usuario {
    pub id: i64,
    pub username: String,
    pub rol: String,
    #[serde(default)]
    pub password_change_required: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Cliente {
    pub id: i64,
    pub nombre: String,
    pub credito_activo: bool,
    pub saldo_deuda_usd: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ultima_compra: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dispositivo_origen: Option<String>,
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
    #[serde(default)]
    pub costo: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistorialTasa {
    pub fecha: String,
    pub tasa: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SaleDetailItem {
    pub id: i64,
    pub venta_id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub cantidad: i64,
    pub precio_usd_unitario: f64,
    pub subtotal_usd: f64,
    pub anulado: bool,
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
    #[serde(default)]
    pub password_change_required: bool,
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
    pub page: Option<i64>,
    pub page_size: Option<i64>,
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
    pub total_costo_usd: f64,
    pub total_ganancia_usd: f64,
    pub ventas: Vec<SalesReportItem>,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VentaDetallada {
    pub id: i64,
    pub fecha_hora: String,
    pub total_usd: f64,
    pub tasa_aplicada: f64,
    pub productos: Vec<DetalleVenta>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopProductItem {
    pub codigo: String,
    pub nombre: String,
    pub cantidad_vendida: i64,
    pub total_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardPeriod {
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub total_costo_usd: f64,
    pub total_ganancia_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardSummary {
    pub today: DashboardPeriod,
    pub week: DashboardPeriod,
    pub month: DashboardPeriod,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductHistoryItem {
    pub venta_id: i64,
    pub fecha_hora: String,
    pub cantidad: i64,
    pub precio_usd_unitario: f64,
    pub subtotal_usd: f64,
    pub metodo_pago: String,
    pub username: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoidItemRequest {
    pub venta_id: i64,
    pub detalle_ids: Vec<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedResult<T> {
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub data: Vec<T>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportReportFilter {
    pub start_date: String,
    pub end_date: String,
    pub producto_codigo: Option<String>,
    pub username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfitDataPoint {
    pub date: String,
    pub revenue_usd: f64,
    pub cost_usd: f64,
    pub profit_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfitSeriesFilter {
    pub start_date: String,
    pub end_date: String,
}

