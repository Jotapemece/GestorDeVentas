use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Producto {
    pub codigo: String,
    pub nombre: String,
    pub precio_usd: f64,
    pub costo: f64,
    pub stock: f64,
    pub stock_minimo: f64,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub es_inari: bool,
    #[serde(default)]
    pub es_pesable: bool,
    #[serde(default)]
    pub subcategoria: Option<String>,
    #[serde(default)]
    pub favorito: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub categoria_id: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub categoria: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub categoria_color: Option<String>,
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
pub struct ClienteResumen {
    pub total: i64,
    pub con_deuda: i64,
    pub deuda_total: f64,
    pub personas_con_deuda: i64,
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
    pub nota_anulacion: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sync_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dispositivo_origen: Option<String>,
    #[serde(default)]
    pub nota: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetalleVenta {
    pub id: i64,
    pub venta_id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub cantidad: f64,
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
    pub cantidad: f64,
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
pub struct AlertaCredito {
    pub id: i64,
    pub tipo: String,
    pub monto_usd: f64,
    pub cliente_id: Option<i64>,
    pub cliente_nombre: String,
    pub metodo_pago: String,
    pub nota: String,
    pub usuario: String,
    pub fecha_hora: String,
    pub visto: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SolicitudAnulacion {
    pub id: i64,
    pub venta_id: i64,
    pub venta_sync_id: String,
    pub motivo: String,
    pub solicitante: String,
    pub fecha_hora: String,
    pub estado: String,
    pub resuelto_por: String,
    pub nota_resolucion: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailySummary {
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub ventas: Vec<Venta>,
    pub tasa_actual: f64,
    pub abonos: Vec<AbonoRow>,
    pub abonos_usd: f64,
    pub abonos_bs: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AbonoRow {
    pub id: i64,
    pub cliente_id: i64,
    pub cliente_nombre: String,
    pub monto_usd: f64,
    pub monto_bs: f64,
    pub metodo_pago: String,
    pub concepto: String,
    pub fecha_hora: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloseReport {
    pub fecha_cierre: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub usuario: String,
    pub tasa_cierre: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_msg: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ProductoVenta {
    pub codigo: String,
    pub cantidad: f64,
    /// Solo para el pseudo-producto `EFECTIVO`: monto a cobrar en Bs. (distinto
    /// del entregado permite cobrar comisión). El precio de la línea se deriva
    /// de `monto_cobrar_bs / tasa / cantidad` en el backend.
    #[serde(default)]
    pub monto_cobrar_bs: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PagoItem {
    pub metodo: String,
    pub monto_usd: f64,
    pub referencia: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateSaleRequest {
    pub metodo_pago: String,
    pub referencia_pago_movil: Option<String>,
    pub cliente_id: Option<i64>,
    pub productos: Vec<ProductoVenta>,
    pub tasa: f64,
    pub pago_detalle: Option<Vec<PagoItem>>,
    pub total_bs_ingresado: Option<f64>,
    #[serde(default)]
    pub nota: String,
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
    /// Desglose por día cuando el cierre abarca varios días (corte de energía).
    #[serde(default)]
    pub dias: Vec<DiaCierre>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendienteCierre {
    pub desde: String,
    pub hasta: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub dias: Vec<PendienteDia>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendienteDia {
    pub fecha: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiaCierre {
    pub fecha: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub por_metodo: Vec<MetodoTotal>,
    pub productos_vendidos: Vec<ProductoReporte>,
    pub clientes_credito: Vec<ClienteCreditoReporte>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClosePendingResult {
    pub report: CloseReport,
    pub data: CloseReportData,
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
    /// Rango de días que cubre el cierre (corte de energía). None = un solo día.
    #[serde(default)]
    pub desde: Option<String>,
    #[serde(default)]
    pub hasta: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CierreDetalle {
    pub cierre: CierreListItem,
    pub detalle: CloseReportData,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductoReporte {
    pub nombre: String,
    pub cantidad: f64,
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
pub struct DebtEvent {
    pub fecha_hora: String,
    pub tipo: String,
    pub monto_usd: f64,
    pub nota: String,
    pub saldo_despues: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TopProductItem {
    pub codigo: String,
    pub nombre: String,
    pub cantidad_vendida: f64,
    pub total_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardPeriod {
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub total_costo_usd: f64,
    pub total_ganancia_usd: f64,
    pub neto_movimientos_usd: f64,
    pub neto_movimientos_bs: f64,
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
    pub cantidad: f64,
    pub precio_usd_unitario: f64,
    pub subtotal_usd: f64,
    pub metodo_pago: String,
    pub username: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MovimientoCaja {
    pub id: i64,
    pub tipo: String,
    pub monto_bs: f64,
    pub monto_usd: f64,
    pub concepto: String,
    pub usuario_id: i64,
    pub username: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaldoCaja {
    pub saldo_usd: f64,
    pub saldo_bs: f64,
    pub total_ventas_usd: f64,
    pub total_ventas_bs: f64,
    pub total_ingresos_usd: f64,
    pub total_egresos_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VoidItemRequest {
    pub venta_id: i64,
    pub detalle_ids: Vec<i64>,
    pub nota: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginatedResult<T> {
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
    pub data: Vec<T>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfitDataPoint {
    pub date: String,
    pub revenue_usd: f64,
    pub cost_usd: f64,
    pub profit_usd: f64,
    pub neto_movimientos_usd: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfitSeriesFilter {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Categoria {
    pub id: i64,
    pub nombre: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrecioHistorialItem {
    pub id: i64,
    pub producto_codigo: String,
    pub precio_anterior: f64,
    pub precio_nuevo: f64,
    pub usuario: String,
    pub fecha_hora: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VendorSales {
    pub username: String,
    pub total_ventas: i64,
    pub total_usd: f64,
    pub total_bs: f64,
    pub total_costo_usd: f64,
    pub total_ganancia_usd: f64,
    pub ventas_anuladas: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StockEvent {
    pub fecha_hora: String,
    pub tipo: String,
    pub cantidad: f64,
    pub motivo: String,
    pub usuario: String,
    pub saldo_despues: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlertaStock {
    pub id: i64,
    pub producto_codigo: String,
    pub producto_nombre: String,
    pub cantidad: f64,
    pub motivo: String,
    pub usuario: String,
    pub fecha_hora: String,
    pub visto: bool,
}

