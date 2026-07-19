const invoke = window.__TAURI__.core.invoke;

const IS_ANDROID = navigator.userAgent.includes('Android');

/* ========== CONSTANTS ========== */
const TOAST_DURATION = 3000;
const AUDIO = {
  FREQ: {
    ADD: 880,
    REMOVE: 440,
    SUCCESS: [523, 659, 784, 1047],
    ERROR: 180,
    CANCEL: [660, 330],
  },
  DURATION_SEC: {
    ADD: 0.12,
    REMOVE: 0.08,
    SUCCESS: 0.5,
    ERROR: 0.25,
    CANCEL: 0.2,
  },
  VOLUME_BASE: 0.3,
};
const SEARCH_DEBOUNCE_MS = 200;
const AUDIT_LIMIT_DEFAULT = 50;
const FONT_SIZE_MIN = 75;
const FONT_SIZE_MAX = 150;
const FONT_SIZE_DEFAULT = 100;

// Constantes frontend → debe coincidir con src-tauri/src/constants.rs
//   AUDIT_LIMIT_DEFAULT ↔ AUDIT_LOG_DEFAULT_LIMIT
// Config keys (db::configuracion.clave) y métodos de pago
const CFG_TASA_UPDATED_AT = 'tasa_updated_at';
const CFG_TEMA = 'tema';
const CFG_FONT_SIZE = 'font_size';
const CFG_SONIDO_HABILITADO = 'sonido_habilitado';
const CFG_SONIDO_VOLUMEN = 'sonido_volumen';
const CFG_HISTORIAL_LIMPIEZA_DIAS = 'historial_limpieza_dias';
const CFG_COMA_AUTOMATICA = 'coma_automatica';
const CFG_CALCULAR_VUELTO = 'calcular_vuelto';
const CFG_REDONDEO_BS = 'redondeo_bs';
const CFG_SIDEBAR_AUTO_HIDE = 'sidebar_auto_hide';
const CFG_CONFIRMAR_VENTA = 'confirmar_venta';

// Payment method keys (deben coincidir con constants.rs)
const METODO_EFECTIVO_BS = 'efectivo_bs';
const METODO_EFECTIVO_USD = 'efectivo_usd';
const METODO_BIOPAGO = 'biopago';
const METODO_PUNTO = 'punto';
const METODO_PAGO_MOVIL = 'pago_movil';
const METODO_CREDITO = 'credito';
const METODO_MIXTO = 'mixto';
const ROL_ADMIN = 'admin';
const PAGO_MOVIL_REF_LEN = 4;

// Config keys (db::configuracion.clave) — back-end sync
const CFG_SUPABASE_URL = 'supabase_url';
const CFG_SUPABASE_KEY = 'supabase_key';
const CFG_SYNC_AUTO_INTERVAL = 'sync_auto_interval';

const SYNC_SALE_DEBOUNCE_MS = 10 * 60 * 1000;

async function getUserConfig(key) {
  return invoke('get_user_config_value', { key });
}
async function setUserConfig(key, value) {
  return invoke('set_user_config_value', { key, value });
}

const ICON = {
  UNLOCK: '<i class="nf nf-fa-unlock"></i>',
  LOCK: '<i class="nf nf-fa-lock"></i>',
  FILE_TEXT: '<i class="nf nf-fa-file_text"></i>',
  EYE: '<i class="nf nf-fa-eye"></i>',
  EYE_SLASH: '<i class="nf nf-fa-eye_slash"></i>',
};

const CHART_COLORS = ['#6C63AC', '#A8D5BA', '#F5B7B1', '#85C1E9', '#F9E79F', '#D7BDE2', '#A3E4D7', '#F5CBA7', '#AED6F1', '#ABEBC6'];
const CANVAS_WIDTH = 260;
const CANVAS_HEIGHT = 200;
const CHART_CENTER_X = 90;
const CHART_CENTER_Y = 100;
const CHART_RADIUS = 72;
const LEGEND_X = 175;
const LEGEND_Y_START = 10;
const LEGEND_LINE_HEIGHT = 18;
const PRINT_WIDTH = 700;
const PRINT_HEIGHT = 500;
const PRINT_FRAME_CSS = 'position:fixed;top:-9999px;left:-9999px;width:' + PRINT_WIDTH + 'px;height:' + PRINT_HEIGHT + 'px;border:none;';
const SOUND_ENABLED = '1';
const SOUND_DISABLED = '0';

/* ========== SELECTORS ========== */
const SEL = {
  // --- Toast & Print ---
  toast: '#toast',
  printFrame: '#print-frame',


  // --- Login ---
  loginScreen: '#login-screen',
  loginUsername: '#login-username',
  loginPassword: '#login-password',
  loginError: '#login-error',
  rememberMe: '#remember-me',
  loginBtn: '#login-btn',
  mainApp: '#main-app',
  sidebarUser: '#sidebar-user',
  logoutBtn: '#logout-btn',

  // --- Sales (POS) ---
  tasaInput: '#tasa-input',
  tasaWarning: '#tasa-warning',
  productSearch: '#product-search',
  productSearchBody: '#product-search-body',
  checkoutBtn: '#checkout-btn',
  cancelSaleBtn: '#cancel-sale-btn',
  cartBody: '#cart-body',
  cartEmpty: '#cart-empty',
  cartTotalUsd: '#cart-total-usd',
  cartTotalBs: '#cart-total-bs',

  // --- Payment Modal ---
  paymentModal: '#payment-modal',
  paymentTotalUsd: '#payment-total-usd',
  paymentTotalBs: '#payment-total-bs',
  paymentConfirmBtn: '#payment-confirm-btn',
  referenciaInput: '#referencia-input',
  clienteSelect: '#cliente-select',
  mixtoItems: '#mixto-items',
  mixtoError: '#mixto-error',
  mixtoWarning: '#mixto-warning',
  mixtoWarningText: '#mixto-warning-text',
  mixtoAddRow: '#mixto-add-row',
  referenciaGroup: '#referencia-group',
  clienteGroup: '#cliente-group',
  mixtoGroup: '#mixto-group',

  // --- Inventory ---
  inventorySearch: '#inventory-search',
  inventoryBody: '#inventory-body',
  inventoryTable: '#inventory-table',
  inventoryAddBtn: '#inventory-add-btn',
  inventoryExportBtn: '#inventory-export-btn',
  inventoryImportBtn: '#inventory-import-btn',
  productModal: '#product-modal',
  productModalTitle: '#product-modal-title',
  productSaveText: '#product-save-text',
  productDeleteBtn: '#product-delete-btn',
  productNombre: '#product-nombre',
  productPrecio: '#product-precio',
  productStock: '#product-stock',
  productDetailModal: '#product-detail-modal',
  detailNombre: '#detail-nombre',
  detailPrecio: '#detail-precio',
  detailStock: '#detail-stock',
  detailCreated: '#detail-created',

  // --- Creditos / Clientes ---
  creditosBody: '#creditos-body',
  creditoAddBtn: '#credito-add-btn',
  clientModal: '#client-modal',
  clientModalTitle: '#client-modal-title',
  clientNombre: '#client-nombre',
  debtDetailModal: '#debt-detail-modal',
  debtDetailTitle: '#debt-detail-title',
  debtDetailDebt: '#debt-detail-debt',
  debtDetailList: '#debt-detail-list',
  abonoModal: '#abono-modal',
  abonoClienteNombre: '#abono-cliente-nombre',
  abonoDeudaUsd: '#abono-deuda-usd',
  abonoDeudaBs: '#abono-deuda-bs',
  abonoMonto: '#abono-monto',
  abonoSaldoRestante: '#abono-saldo-restante',
  abonoReferencia: '#abono-referencia',
  abonoReferenciaGroup: '#abono-referencia-group',
  abonoMixtoGroup: '#abono-mixto-group',
  abonoMixtoItems: '#abono-mixto-items',
  abonoMixtoError: '#abono-mixto-error',
  abonoMixtoWarning: '#abono-mixto-warning',
  abonoMixtoWarningText: '#abono-mixto-warning-text',
  abonoConfirmBtn: '#abono-confirm-btn',

  // --- Cashier ---
  dailyCount: '#daily-count',
  dailyUsd: '#daily-usd',
  dailyBs: '#daily-bs',
  dailyTasa: '#daily-tasa',
  dailySalesBody: '#daily-sales-body',
  cajaStatusBar: '#caja-status-bar',
  cajaStatusText: '#caja-status-text',
  openCashierBtn: '#open-cashier-btn',
  closeCashierBtn: '#close-cashier-btn',
  closeCashierModal: '#close-cashier-modal',
  closeSummary: '#close-summary',
  closeReportModal: '#close-report-modal',
  closeReportBody: '#close-report-body',
  historialCierresBtn: '#historial-cierres-btn',
  historialCierresModal: '#historial-cierres-modal',
  historialCierresList: '#historial-cierres-list',
  historialCierreDetalleModal: '#historial-cierre-detalle-modal',
  historialCierreDetalleBody: '#historial-cierre-detalle-body',

  // --- Audit ---
  auditBody: '#audit-body',
  auditLoadMore: '#audit-load-more',

  // --- Settings ---
  fontIncBtn: '#font-inc-btn',
  fontDecBtn: '#font-dec-btn',
  fontSizeDisplay: '#font-size-display',
  fullscreenToggle: '#fullscreen-toggle',
  soundToggle: '#sound-toggle',
  soundVolume: '#sound-volume',
  historialLimpiezaDias: '#historial-limpieza-dias',
  historialLimpiezaSave: '#historial-limpieza-save',

  // --- Sync / Conflictos ---
  syncUrl: '#sync-url',
  syncKey: '#sync-key',
  conflictCount: '#conflict-count',
  conflictList: '#conflict-list',
  conflictModal: '#conflict-modal',
  statProducts: '#stat-products',
  statClients: '#stat-clients',
  statSales: '#stat-sales',
  syncUploadTime: '#sync-upload-time',
  syncDownloadTime: '#sync-download-time',
  syncUploadSalesTime: '#sync-upload-sales-time',
  syncDownloadSalesTime: '#sync-download-sales-time',
  syncUploadClientesTime: '#sync-upload-clientes-time',
  syncDownloadClientesTime: '#sync-download-clientes-time',

  // --- Tasa ---
  tasaFetchBtn: '#tasa-fetch-btn',

  // --- Cambio (vuelto) ---
  cambioGroup: '#cambio-group',
  cambioRecibido: '#cambio-recibido',
  cambioResultado: '#cambio-resultado',
  cambioMonto: '#cambio-monto',

  // --- Reports / Dashboard ---
  reportStartDate: '#report-start-date',
  reportEndDate: '#report-end-date',
  reportSearchBtn: '#report-search-btn',
  reportProductFilter: '#report-product-filter',
  reportVendorFilter: '#report-vendor-filter',
  reportTotalCount: '#report-total-count',
  reportTotalUsd: '#report-total-usd',
  reportTotalBs: '#report-total-bs',
  reportSalesBody: '#report-sales-body',
  reportExportBtn: '#report-export-btn',
  topProductsSection: '#top-products-section',
  topProductsGrid: '#top-products-grid',
  topProductsLimit: '#top-products-limit',
  dashboardBody: '#dashboard-body',
  chartTooltip: '#chart-tooltip',
  dashboardCanvas: '#dashboard-canvas',
  saleDetailModal: '#sale-detail-modal',
  saleDetailId: '#sale-detail-id',
  saleDetailTotal: '#sale-detail-total',
  saleDetailMetodo: '#sale-detail-metodo',
  saleDetailUsuario: '#sale-detail-usuario',
  saleDetailFecha: '#sale-detail-fecha',
  saleDetailList: '#sale-detail-list',
  saleDetailClose: '#sale-detail-close',
  saleDetailOkBtn: '#sale-detail-ok-btn',
  viewReports: '#view-reports',
  gotoReportsBtn: '#goto-reports-btn',

  // --- User Management ---
  userListBody: '#user-list-body',
  newUserName: '#new-user-name',
  newUserPassword: '#new-user-password',
  newUserRol: '#new-user-rol',
  createUserBtn: '#create-user-btn',
  changePwdOld: '#change-pwd-old',
  changePwdNew: '#change-pwd-new',
  changePwdConfirm: '#change-pwd-confirm',
  changePwdBtn: '#change-pwd-btn',
  adminPwdModal: '#admin-pwd-modal',
  adminPwdInput: '#admin-pwd-input',
  adminPwdUserInfo: '#admin-pwd-user-info',
  adminPwdModalClose: '#admin-pwd-modal-close',
  adminPwdCancelBtn: '#admin-pwd-cancel-btn',
  adminPwdSaveBtn: '#admin-pwd-save-btn',

  // --- Product History ---
  productHistoryModal: '#product-history-modal',
  productHistoryTitle: '#product-history-title',
  productHistoryBody: '#product-history-body',
  productHistoryModalClose: '#product-history-modal-close',
  productHistoryOkBtn: '#product-history-ok-btn',

  // --- Confirm / Loading Modals ---
  confirmModal: '#confirm-modal',
  confirmTitle: '#confirm-title',
  confirmMessage: '#confirm-message',
  confirmOkBtn: '#confirm-ok-btn',
  confirmCancelBtn: '#confirm-cancel-btn',
  confirmClose: '#confirm-close',
  loadingText: '#loading-text',
  loadingModal: '#loading-modal',

  // --- Sync buttons ---
  backupDbBtn: '#backup-db-btn',
  registerDeviceBtn: '#register-device-btn',
  viewConflictsBtn: '#view-conflicts-btn',
  syncProgressModal: '#sync-progress-modal',
  syncProgressText: '#sync-progress-text',
  syncProgressBar: '#sync-progress-bar',
  uploadAllBtn: '#upload-all-btn',
  downloadAllBtn: '#download-all-btn',
  syncAllBtn: '#sync-all-btn',
  testConnectionBtn: '#test-connection-btn',
  connectionStatus: '#connection-status',
  conflictModalClose: '#conflict-modal-close',
  conflictCloseBtn: '#conflict-close-btn',
  viewConfig: '#view-config',
  viewSync: '#view-sync',

  // --- Modal close / cancel / ok buttons ---
  paymentModalClose: '#payment-modal-close',
  paymentCancelBtn: '#payment-cancel-btn',
  abonoMixtoAddRow: '#abono-mixto-add-row',
  productModalClose: '#product-modal-close',
  productCancelBtn: '#product-cancel-btn',
  productSaveBtn: '#product-save-btn',
  productDetailClose: '#product-detail-close',
  productDetailOkBtn: '#product-detail-ok-btn',
  clientModalClose: '#client-modal-close',
  clientCancelBtn: '#client-cancel-btn',
  clientSaveBtn: '#client-save-btn',
  closeCashierClose: '#close-cashier-close',
  closeCashierCancelBtn: '#close-cashier-cancel-btn',
  closeCashierConfirmBtn: '#close-cashier-confirm-btn',
  closeReportClose: '#close-report-close',
  closeReportOkBtn: '#close-report-ok-btn',
  historialCierresClose: '#historial-cierres-close',
  historialCierresOkBtn: '#historial-cierres-ok-btn',
  historialCierreDetalleClose: '#historial-cierre-detalle-close',
  historialCierreDetalleOkBtn: '#historial-cierre-detalle-ok-btn',
  debtDetailClose: '#debt-detail-close',
  debtDetailOkBtn: '#debt-detail-ok-btn',
  abonoClose: '#abono-close',
  abonoCancelBtn: '#abono-cancel-btn',

  // --- Misc ---
  inventoryPagination: '#inventory-pagination',
  togglePassword: '#toggle-password',
  mobileLogoutBtn: '#mobile-logout-btn',
  creditosSearch: '#creditos-search',
  cartBadge: '#cart-badge',
  historialLimpiezaStatus: '#historial-limpieza-status',
  comaAutomaticaToggle: '#coma-automatica-toggle',
  calcularVueltoToggle: '#calcular-vuelto-toggle',
  redondeoBsToggle: '#redondeo-bs-toggle',
  sidebarAutoHideToggle: '#sidebar-auto-hide-toggle',
};

/* ========== CLOCK ========== */
function startClock() {
  const hourHand = document.querySelector('#clock-hour');
  const minuteHand = document.querySelector('#clock-minute');
  const secondHand = document.querySelector('#clock-second');
  if (!hourHand) return;
  function update() {
    const now = new Date();
    const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
    hourHand.setAttribute('transform', `rotate(${h * 30 + m * 0.5}, 50, 50)`);
    minuteHand.setAttribute('transform', `rotate(${m * 6 + s * 0.1}, 50, 50)`);
    secondHand.setAttribute('transform', `rotate(${s * 6}, 50, 50)`);
  }
  update();
  setInterval(update, 1000);
}

/* ========== SIDEBAR AUTO-HIDE ========== */
let sidebarAutoHideEnabled = false;
let sidebarHideTimeout = null;
const SIDEBAR_HIDE_DELAY = 250;

function initSidebarAutoHide() {
  if (IS_ANDROID) return;
  const sidebar = document.getElementById('sidebar');
  const mainApp = document.getElementById('main-app');
  if (!sidebar || !mainApp) return;

  let lastMouseX = -1, lastMouseY = -1;

  document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (!sidebarAutoHideEnabled) return;
    if (e.clientX <= 14) {
      clearTimeout(sidebarHideTimeout);
      sidebarHideTimeout = null;
      mainApp.classList.remove('sidebar-hidden');
      setTimeout(checkSidebarHover, 350);
      return;
    }
    checkSidebarHover();
  });

  function checkSidebarHover() {
    if (!sidebarAutoHideEnabled) return;
    if (mainApp.classList.contains('sidebar-hidden')) return;
    const rect = sidebar.getBoundingClientRect();
    const inside = lastMouseX >= rect.left && lastMouseX <= rect.right &&
                   lastMouseY >= rect.top && lastMouseY <= rect.bottom;
    if (inside) {
      clearTimeout(sidebarHideTimeout);
      sidebarHideTimeout = null;
    } else if (!sidebarHideTimeout) {
      sidebarHideTimeout = setTimeout(() => {
        mainApp.classList.add('sidebar-hidden');
        sidebarHideTimeout = null;
      }, SIDEBAR_HIDE_DELAY);
    }
  }
}

function setSidebarAutoHide(enabled) {
  if (IS_ANDROID) return;
  sidebarAutoHideEnabled = enabled;
  const mainApp = document.getElementById('main-app');
  if (!mainApp) return;
  if (enabled) {
    mainApp.classList.add('sidebar-hidden');
  } else {
    mainApp.classList.remove('sidebar-hidden');
  }
}

async function loadSidebarAutoHideConfig() {
  try {
    const val = await getUserConfig(CFG_SIDEBAR_AUTO_HIDE);
    const enabled = val === 'true';
    setSidebarAutoHide(enabled);
    const toggle = document.getElementById('sidebar-auto-hide-toggle');
    if (toggle) toggle.checked = enabled;
  } catch (e) {
    setSidebarAutoHide(false);
  }
}

/* ========== HELPERS ========== */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function createProductRow(p) {
  const name = escapeHtml(p.nombre);
  return '<td title="' + name + '">' + name + '</td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><button class="btn btn-primary btn-sm" data-action="add-to-cart" data-codigo="' + escapeHtml(p.codigo) + '">+</button></td>';
}
function createCartRow(item) {
  const displayName = item.nombre || item.codigo;
  const name = escapeHtml(displayName);
  return '<td title="' + name + '">' + name + '</td><td><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="1" max="' + item.stock + '" data-codigo="' + escapeHtml(item.codigo) + '"></td><td>' + formatUSD(item.cantidad * item.precio_usd) + '</td><td><button class="btn btn-sm btn-danger" data-action="remove-from-cart" data-codigo="' + escapeHtml(item.codigo) + '">\u00d7</button></td>';
}
function createInventoryRow(p, editBtn) {
  return '<td>' + escapeHtml(p.nombre) + '</td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones">&ctdot;</button><div class="dropdown-menu"><button data-action="show-product-detail" data-codigo="' + escapeHtml(p.codigo) + '"><i class="nf nf-fa-info_circle"></i> Detalles</button><button data-action="show-product-history" data-codigo="' + escapeHtml(p.codigo) + '" data-nombre="' + escapeHtml(p.nombre) + '"><i class="nf nf-fa-history"></i> Historial</button>' + editBtn + '</div></div></td>';
}
function createClientRow(c) {
  const isAdmin = currentUser && currentUser.rol === ROL_ADMIN;
  const adminBtns = isAdmin
    ? '<button class="btn btn-sm btn-outline" data-action="edit-cliente" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '"><i class="nf nf-fa-pencil"></i></button> '
    + (c.saldo_deuda_usd === 0 ? '<button class="btn btn-sm btn-danger" data-action="delete-cliente" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '"><i class="nf nf-fa-trash"></i></button>' : '')
    : '';
  return '<td>' + escapeHtml(c.nombre) + '</td><td>' + formatUSD(c.saldo_deuda_usd) + '</td><td><button class="btn btn-sm btn-outline" data-action="open-debt-detail" data-id="' + c.id + '">Ver Detalles</button> <button class="btn btn-sm btn-primary" data-action="open-abono" data-id="' + c.id + '">Abonar / Pagar</button> ' + adminBtns + '</td>';
}
function createAuditRow(log) {
  return '<td>' + log.id + '</td><td>' + escapeHtml(log.fecha_hora) + '</td><td>' + escapeHtml(log.usuario) + '</td><td>' + escapeHtml(log.accion) + '</td>';
}
function createDailySaleRow(v, metodoLabel) {
  const isAdmin = currentUser && currentUser.rol === ROL_ADMIN;
  const voidBtn = v.anulada ? '<span class="text-muted">Anulada</span>' : (isAdmin ? '<button class="btn btn-sm btn-danger void-sale-btn" data-id="' + v.id + '" title="Anular venta"><i class="nf nf-fa-ban"></i></button>' : '');
  const detailBtn = '<button class="btn btn-sm btn-outline sale-detail-btn" data-id="' + v.id + '" data-total="' + v.total_usd + '" data-metodo="' + escapeHtml(metodoLabel) + '" data-usuario="' + escapeHtml(v.username) + '" data-fecha="' + escapeHtml(v.fecha_hora) + '" title="Ver detalles"><i class="nf nf-fa-receipt"></i></button>';
  return '<td>' + v.id + '</td><td>' + escapeHtml(v.fecha_hora.split(' ')[1]) + '</td><td>' + escapeHtml(v.username) + '</td><td>' + escapeHtml(metodoLabel) + '</td><td>' + formatUSD(v.total_usd) + '</td><td>' + formatBS(v.total_bs) + '</td><td>' + detailBtn + ' ' + voidBtn + '</td>';
}
function createDebtSaleCard(v, prodHtml) {
  return '<div class="debt-sale-header"><span># Venta ' + v.id + '</span><span>' + v.fecha_hora + '</span></div><div class="debt-sale-total">Total: ' + formatUSD(v.total_usd) + '</div>' + prodHtml;
}

function createUserRow(u) {
  const isAdmin = u.username === 'admin';
  const pwdBtn = isAdmin ? '' : '<button class="btn btn-sm btn-outline admin-pwd-btn" data-id="' + u.id + '" data-username="' + escapeHtml(u.username) + '" title="Cambiar contrase\u00f1a" style="margin-right:4px"><i class="nf nf-fa-lock"></i></button>';
  return '<td>' + escapeHtml(u.username) + '</td><td>' + escapeHtml(u.rol) + '</td><td>' + pwdBtn + '<button class="btn btn-sm btn-danger delete-user-btn" data-id="' + u.id + '" ' + (isAdmin ? 'disabled title="No se puede eliminar"' : '') + '><i class="nf nf-fa-trash"></i></button></td>';
}

function createReportRow(v) {
  const metodoLabel = formatMetodoLabel(v.venta.metodo_pago);
  const prodCount = v.productos ? v.productos.reduce(function(s, p) { return s + p.cantidad; }, 0) : 0;
  const badge = v.venta.anulada ? ' <span class="text-muted">(Anulada)</span>' : '';
  return '<td>' + v.venta.id + '</td><td>' + escapeHtml(v.venta.fecha_hora) + '</td><td>' + escapeHtml(v.venta.username) + '</td><td>' + escapeHtml(metodoLabel) + '</td><td>' + prodCount + '</td><td>' + formatUSD(v.venta.total_usd) + '</td><td>' + formatBS(v.venta.total_bs) + badge + '</td>';
}

const TPL_CLOSE_REPORT_STYLE = 'body{font-family:monospace;font-size:12px;padding:24px}h2{text-align:center;margin-bottom:4px}h4{margin:12px 0 4px;border-bottom:1px solid #000}table{width:100%;border-collapse:collapse;margin:4px 0}th,td{padding:3px 6px;text-align:left;border-bottom:1px solid #ccc}th{border-bottom:2px solid #000}.total{font-weight:700;text-align:right;margin-top:4px}';

let currentUser = null;
let cart = [];
let tasaActual = 0;
let editingProduct = null;
let editingClienteId = null;
let abonoClienteId = null;
let productCache = [];

let lastCloseReportData = null;
let lastViewName = 'sales';
let comaAutomaticaEnabled = false;
let calcularVuelto = true;
let redondeoBs = false;
let soundEnabled = true;
let soundVolume = 0.5;
let auditOffset = 0;
let auditLimit = AUDIT_LIMIT_DEFAULT;

function hideToast(el) {
  if (el._closing) return;
  el._closing = true;
  el.classList.add('fade-out');
  setTimeout(() => { el.classList.add('hidden'); el.classList.remove('fade-out'); el._closing = false; }, 300);
}

function showToast(msg, type = 'success') {
  const t = qs(SEL.toast);
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.remove('hidden', 'fade-out');
  t._closing = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => hideToast(t), TOAST_DURATION);
  t.onclick = () => { clearTimeout(t._timer); hideToast(t); };
}

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

/* ========== CONFIRM MODAL ========== */
function confirmModal(msg, title, okText) {
  return new Promise(resolve => {
    const modal = qs(SEL.confirmModal);
    qs(SEL.confirmTitle).textContent = title || 'Confirmar';
    qs(SEL.confirmMessage).textContent = msg;
    const okBtn = qs(SEL.confirmOkBtn);
    okBtn.textContent = okText || 'Confirmar';
    okBtn.onclick = () => { closeModal(modal); resolve(true); };
    qs(SEL.confirmCancelBtn).onclick = () => { closeModal(modal); resolve(false); };
    qs(SEL.confirmClose).onclick = () => { closeModal(modal); resolve(false); };
    modal.addEventListener('click', function handler(e) {
      if (e.target === modal) { closeModal(modal); resolve(false); modal.removeEventListener('click', handler); }
    });
    showModal(modal);
  });
}

/* ========== LOADING / EMPTY STATES ========== */
function showLoading(el) {
  el.innerHTML = '<div class="loading-spinner"><i class="nf nf-fa-spinner spinner-icon"></i></div>';
}
function showLoadingModal(text) {
  qs(SEL.loadingText).textContent = text || 'Cargando...';
  qs(SEL.loadingModal).classList.remove('hidden');
}
function hideLoadingModal() {
  qs(SEL.loadingModal).classList.add('hidden');
}
function emptyState(icon, text, sub) {
  return '<div class="empty-state"><span class="empty-icon">' + icon + '</span><div class="empty-text">' + text + '</div>' + (sub ? '<div class="empty-sub">' + sub + '</div>' : '') + '</div>';
}

/* ========== MODAL HELPERS ========== */
function showModal(el) {
  qsa('.modal').forEach(m => { if (m !== el) m.classList.add('hidden'); });
  el.classList.remove('hidden');
}
function closeModal(el) {
  el.classList.add('hidden');
}

function isBsMethod(m) { return m === METODO_EFECTIVO_BS || m === METODO_BIOPAGO || m === METODO_PUNTO || m === METODO_PAGO_MOVIL; }

/* Focus trap for modals */
let activeModal = null;
function trapFocus(modalEl) {
  activeModal = modalEl;
  const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length) focusable[0].focus();
}
function releaseFocus() { activeModal = null; }
document.querySelectorAll('.modal').forEach(modal => {
  const obs = new MutationObserver(() => {
    if (!modal.classList.contains('hidden')) trapFocus(modal);
    else if (activeModal === modal) releaseFocus();
  });
  obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
});
document.addEventListener('keydown', (e) => {
  if (!activeModal) return;
  if (e.key === 'Escape') {
    const closeBtn = activeModal.querySelector('.modal-close, [data-action="close-modal"]');
    if (closeBtn) closeBtn.click();
    return;
  }
  if (e.key !== 'Tab') return;
  const focusable = activeModal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

function formatUSD(v) { return '$' + v.toFixed(2); }
function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }
function parsePrecio(s) { return parseFloat(String(s).replace(',', '.')) || 0; }
function totalBsRedondeado(totalUsd) {
  const bs = totalUsd * tasaActual;
  return redondeoBs ? Math.round(bs) : bs;
}

function applyComaAutomatica(input) {
  if (!comaAutomaticaEnabled) return;
  const digits = input.value.replace(/\D/g, '');
  if (digits.length === 0) { input.value = ''; return; }
  const padded = digits.padStart(3, '0');
  const intPart = padded.slice(0, -2);
  const decPart = padded.slice(-2);
  input.value = String(parseInt(intPart)) + ',' + decPart;
}
function applyRoleUI() {
  const isAdmin = currentUser && currentUser.rol === ROL_ADMIN;
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
    if (!isAdmin) el.title = 'Solo administradores';
  });
}

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playNote(ctx, freq, startTime, duration, type, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function updateHistoryCleanupStatus(days) {
  const el = qs(SEL.historialLimpiezaStatus);
  if (!el) return;
  if (days > 0) {
    el.innerHTML = '<i class="nf nf-fa-check_circle" style="color:var(--success)"></i> Limpieza cada ' + days + ' d&iacute;a(s)';
  } else {
    el.innerHTML = '<i class="nf nf-fa-info_circle" style="color:var(--text-muted)"></i> Limpieza autom&aacute;tica desactivada';
  }
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const vol = soundVolume * AUDIO.VOLUME_BASE;
    const now = ctx.currentTime;
    switch (type) {
      case 'add':
        playNote(ctx, AUDIO.FREQ.ADD, now, AUDIO.DURATION_SEC.ADD, 'sine', vol);
        break;
      case 'remove':
        playNote(ctx, AUDIO.FREQ.REMOVE, now, AUDIO.DURATION_SEC.REMOVE, 'sine', vol);
        break;
      case 'success':
        AUDIO.FREQ.SUCCESS.forEach((f, i) => {
          playNote(ctx, f, now + i * 0.08, 0.25, 'sine', vol * (1 - i * 0.15));
        });
        break;
      case 'error':
        playNote(ctx, AUDIO.FREQ.ERROR, now, AUDIO.DURATION_SEC.ERROR, 'sawtooth', vol * 0.7);
        playNote(ctx, AUDIO.FREQ.ERROR * 0.5, now + 0.05, AUDIO.DURATION_SEC.ERROR * 0.8, 'square', vol * 0.3);
        break;
      case 'cancel':
        playNote(ctx, AUDIO.FREQ.CANCEL[0], now, AUDIO.DURATION_SEC.CANCEL, 'sine', vol);
        playNote(ctx, AUDIO.FREQ.CANCEL[1], now + 0.06, AUDIO.DURATION_SEC.CANCEL * 0.8, 'sine', vol * 0.6);
        break;
    }
  } catch(e) { soundEnabled = false; }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}

function getViewEl(name) {
  return document.getElementById('view-' + name);
}

/* ========== CONFLICTOS ========== */
async function loadConflictCount() {
  const countEl = qs(SEL.conflictCount);
  if (!countEl) return;
  try {
    const conflictos = await invoke('get_conflictos');
    countEl.textContent = conflictos.length;
  } catch (_) { countEl.textContent = '?'; }
}

async function openConflictModal() {
  let conflictos;
  try {
    conflictos = await invoke('get_conflictos');
  } catch (e) { showToast('Error: ' + e, 'error'); return; }
  if (!conflictos.length) {
    showToast('No hay conflictos pendientes');
    return;
  }
  const container = qs(SEL.conflictList);
  container.innerHTML = '';
  conflictos.forEach(c => {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px';
    let localData, remoteData;
    try { localData = JSON.parse(c.local_json); } catch (_) { localData = {}; }
    try { remoteData = JSON.parse(c.remote_json); } catch (_) { remoteData = {}; }
    const fields = [];
    for (const key of Object.keys(remoteData)) {
      const lv = JSON.stringify(localData[key]);
      const rv = JSON.stringify(remoteData[key]);
      if (lv !== rv) {
        fields.push('<tr><td style="padding:2px 8px;font-weight:600">' + escapeHtml(key) + '</td><td style="padding:2px 8px;color:var(--text)">' + escapeHtml(lv) + '</td><td style="padding:2px 8px;color:var(--accent)">' + escapeHtml(rv) + '</td></tr>');
      }
    }
    const tablaLabel = c.tabla === 'productos' ? 'Producto' : 'Cliente';
    const itemId = escapeHtml(c.item_id);
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px"><strong>' + tablaLabel + ': ' + itemId + '</strong><span class="text-muted text-sm">' + escapeHtml(c.created_at) + '</span></div>' +
      '<table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:8px"><thead><tr style="border-bottom:1px solid var(--border)"><th style="padding:4px 8px;text-align:left">Campo</th><th style="padding:4px 8px;text-align:left">Local</th><th style="padding:4px 8px;text-align:left">Remoto</th></tr></thead><tbody>' + fields.join('') + '</tbody></table>' +
      '<div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm conflict-keep-local" data-id="' + c.id + '"><i class="nf nf-fa-check"></i> Mantener local</button><button class="btn btn-accent btn-sm conflict-use-remote" data-id="' + c.id + '"><i class="nf nf-fa-cloud_download"></i> Usar remoto</button></div>';
    container.appendChild(card);
  });
  showModal(qs(SEL.conflictModal));
}

/* ========== SUPABASE SYNC ========== */
async function loadSyncConfig() {
  const urlEl = qs(SEL.syncUrl);
  const keyEl = qs(SEL.syncKey);
  if (!urlEl) return;
  try {
    const url = await invoke('get_config_value', { key: CFG_SUPABASE_URL });
    if (url) urlEl.value = url;
    const key = await invoke('get_config_value', { key: CFG_SUPABASE_KEY });
    if (key) keyEl.value = key;
  } catch (_) {}
  loadSyncStats();
  loadSyncAutoConfig();
}

async function loadSyncStats() {
  try {
    const stats = await invoke('get_sync_stats');
    var fmt = function(v) { return v ? v : '-'; };
    qs(SEL.statProducts).textContent = stats.active_products;
    qs(SEL.statClients).textContent = stats.total_clientes;
    qs(SEL.statSales).textContent = stats.total_sales;
    qs(SEL.syncUploadTime).textContent = fmt(stats.ultimo_upload);
    qs(SEL.syncDownloadTime).textContent = fmt(stats.ultimo_download);
    qs(SEL.syncUploadSalesTime).textContent = fmt(stats.ultimo_upload_ventas);
    qs(SEL.syncDownloadSalesTime).textContent = fmt(stats.ultimo_download_ventas);
    qs(SEL.syncUploadClientesTime).textContent = fmt(stats.ultimo_upload_clientes);
    qs(SEL.syncDownloadClientesTime).textContent = fmt(stats.ultimo_download_clientes);
  } catch (_) {}
}

/* ========== SYNC AUTO TIMERS ========== */
let syncAutoIntervalId = null;
let saleUploadTimer = null;
let isSyncing = false;

function loadSyncAutoConfig() {
  const input = qs('#sync-auto-interval');
  if (!input) return;
  invoke('get_config_value', { key: CFG_SYNC_AUTO_INTERVAL }).then(val => {
    const minutes = parseInt(val) || 30;
    input.value = Math.max(30, Math.min(480, minutes));
    startSyncAutoInterval(minutes);
  }).catch(() => {});
  input.addEventListener('change', () => {
    let minutes = parseInt(input.value) || 30;
    minutes = Math.max(30, Math.min(480, minutes));
    input.value = minutes;
    invoke('set_config_value', { key: CFG_SYNC_AUTO_INTERVAL, value: String(minutes) }).catch(() => {});
    startSyncAutoInterval(minutes);
  });
}

function startSyncAutoInterval(minutes) {
  if (syncAutoIntervalId) clearInterval(syncAutoIntervalId);
  syncAutoIntervalId = null;
  if (minutes <= 0) return;
  syncAutoIntervalId = setInterval(() => {
    if (!isSyncing) {
      isSyncing = true;
      invoke('sync_all').then(() => { isSyncing = false; }).catch(() => { isSyncing = false; });
    }
  }, minutes * 60 * 1000);
}

function scheduleSaleUpload() {
  if (saleUploadTimer) clearTimeout(saleUploadTimer);
  saleUploadTimer = setTimeout(() => {
    if (!isSyncing) {
      isSyncing = true;
      invoke('sync_all').then(() => { isSyncing = false; }).catch(() => { isSyncing = false; });
    }
    saleUploadTimer = null;
  }, SYNC_SALE_DEBOUNCE_MS);
}

function showView(name) {
  lastViewName = name;
  try { localStorage.setItem('last_view', name); } catch (e) {}
  qsa('.view').forEach(v => v.classList.remove('active'));
  qsa('.nav-btn').forEach(b => b.classList.remove('active'));
  getViewEl(name).classList.add('active');
  qs(`.nav-btn[data-view="${name}"]`).classList.add('active');
  const loaders = {
    inventory: loadInventory,
    creditos: loadCreditos,
    cashier: loadDailySummary,
    audit: loadAudit,
    reports: () => { loadUserList(); setDefaultReportDates(); },
    config: () => { loadThemeConfig(); loadConflictCount(); },
    sync: () => { loadSyncConfig(); loadConflictCount(); },
  };
  if (loaders[name]) loaders[name]();
  if (name === 'sales') {
    qs(SEL.productSearch).focus();
    renderProductSearch();
    renderCart();
  }
  document.dispatchEvent(new CustomEvent('viewChanged', { detail: name }));
}

/* ========== AUTH ========== */
async function handleLogin() {
  const username = qs(SEL.loginUsername).value.trim();
  const password = qs(SEL.loginPassword).value;
  const errEl = qs(SEL.loginError);
  if (!username || !password) { errEl.textContent = 'Complete todos los campos'; return; }
  try {
    const res = await invoke('login', { username, password });
    if (res.success) {
      if (qs(SEL.rememberMe).checked) {
        localStorage.setItem('recordar_usuario', username);
      } else {
        localStorage.removeItem('recordar_usuario');
      }
      currentUser = res.usuario;
      qs(SEL.loginScreen).style.display = 'none';
      qs(SEL.mainApp).style.display = 'flex';
      qs(SEL.sidebarUser).textContent = currentUser.username + ' (' + currentUser.rol + ')';
      startClock();
      initSidebarAutoHide();
      loadSidebarAutoHideConfig();
      applyRoleUI();
      await loadTasa();
      await loadProductCache();
      try { lastViewName = localStorage.getItem('last_view') || 'sales'; } catch (e) {}
      showView(lastViewName);
      if (lastViewName === 'sales') {
        renderProductSearch();
        renderCart();
      }
    } else {
      errEl.textContent = res.message;
    }
  } catch (e) {
    errEl.textContent = 'Error: ' + e;
  }
}

async function handleLogout() {
  const ok = await confirmModal('\u00bfEst\u00e1 seguro de cerrar sesi\u00f3n?', 'Cerrar Sesi\u00f3n', 'Salir');
  if (!ok) return;
  try {
    await invoke('logout');
  } catch (e) {
    showToast('Error al cerrar sesi\u00f3n: ' + e, 'error');
  }
  currentUser = null; cart = []; lastCloseReportData = null;
  qs(SEL.mainApp).style.display = 'none';
  qs(SEL.loginScreen).style.display = 'flex';
  qs(SEL.loginPassword).value = '';
  qs(SEL.loginError).textContent = '';
}

/* ========== TASA ========== */
async function loadTasa() {
  try {
    tasaActual = await invoke('get_tasa');
    qs(SEL.tasaInput).value = tasaActual;
    const updatedAt = await invoke('get_config_value', { key: CFG_TASA_UPDATED_AT });
    const today = new Date().toLocaleDateString('en-CA');
    const warn = qs(SEL.tasaWarning);
    if (warn) warn.style.display = (!updatedAt || updatedAt !== today) ? 'inline' : 'none';
  } catch (e) { showToast('Error al cargar tasa', 'error'); }
}

async function handleTasaChange() {
  const val = parseFloat(qs(SEL.tasaInput).value);
  if (isNaN(val) || val <= 0) {
    qs(SEL.tasaInput).value = tasaActual;
    showToast('La tasa debe ser mayor a cero', 'error');
    return;
  }
  tasaActual = val;
  try {
    await invoke('set_tasa', { tasa: tasaActual });
  } catch (e) {
    showToast('Error al guardar la tasa', 'error');
  }
  const warn = qs(SEL.tasaWarning);
  if (warn) warn.style.display = 'none';
  updateCartTotals();
  renderProductSearch();
  refreshAllBsPrices();
}

async function fetchTasaBcv() {
  const btn = qs(SEL.tasaFetchBtn);
  btn.classList.add('loading');
  showLoadingModal('Buscando tasa del BCV...');
  try {
    const rate = await invoke('fetch_tasa_bcv');
    tasaActual = rate;
    await invoke('set_tasa', { tasa: tasaActual });
    qs(SEL.tasaInput).value = tasaActual;
    const warn = qs(SEL.tasaWarning);
    if (warn) warn.style.display = 'none';
    updateCartTotals();
    renderProductSearch();
    refreshAllBsPrices();
    showToast('Tasa BCV actualizada: Bs. ' + rate.toFixed(2).replace('.', ','), 'success');
  } catch (e) {
    showToast('Error al obtener tasa: ' + e, 'error');
  } finally {
    btn.classList.remove('loading');
    hideLoadingModal();
  }
}


function refreshAllBsPrices() {
  document.querySelectorAll('.bs-price-cell').forEach(el => {
    const usd = parseFloat(el.dataset.usdPrice);
    if (!isNaN(usd)) el.textContent = formatBS(usd * tasaActual);
  });
}

async function loadProductCache() {
  try {
    const result = await invoke('list_products', { search: null, page: 1, pageSize: 5000 });
    productCache = result.data || result;
  } catch (e) { showToast('Error al cargar productos', 'error'); }
}

/* ========== SALES ========== */
let productSearchTimer = null;

function handleProductSearch() {
  clearTimeout(productSearchTimer);
  productSearchTimer = setTimeout(renderProductSearch, SEARCH_DEBOUNCE_MS);
}

function filterProducts(query) {
  if (!query) return [];
  return productCache.filter(p => p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query));
}

function renderProductSearch() {
  const query = qs(SEL.productSearch).value.trim().toLowerCase();
  const tbody = qs(SEL.productSearchBody);
  tbody.innerHTML = '';
  const filtered = filterProducts(query);
  if (filtered.length === 0) {
    if (!query && productCache.length > 0) {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyState('<i class="nf nf-fa-search"></i>', 'No se muestran productos actualmente', 'Escriba en la barra de b\u00fasqueda para encontrar productos') + '</td></tr>';
    } else if (productCache.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyState('<i class="nf nf-fa-archive"></i>', 'No hay productos disponibles', 'Agregue productos desde Inventario') + '</td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyState('<i class="nf nf-fa-search"></i>', 'Sin resultados', 'Pruebe con otro t\u00e9rmino de b\u00fasqueda') + '</td></tr>';
    }
    return;
  }
  const fragment = document.createDocumentFragment();
  filtered.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = createProductRow(p);
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

function addToCart(codigo) {
  playSound('add');
  const existing = cart.find(item => item.codigo === codigo);
  if (existing) {
    if (existing.stock === 0) {
      showToast('El producto no tiene stock disponible', 'error');
      return;
    }
    if (existing.cantidad >= existing.stock) {
      showToast('Stock m\u00e1ximo alcanzado (' + existing.stock + ')', 'error');
      return;
    }
    existing.cantidad++;
    renderCart();
    updateCheckoutBtn();
  } else {
    cart.push({ codigo, cantidad: 1, nombre: '', precio_usd: 0, stock: 0 });
    loadProductName(codigo);
  }
  const cartBody = qs(SEL.cartBody);
  cartBody.classList.remove('cart-add-highlight');
  void cartBody.offsetWidth;
  cartBody.classList.add('cart-add-highlight');
}

async function loadProductName(codigo) {
  const p = productCache.find(x => x.codigo === codigo);
  if (p) {
    const item = cart.find(x => x.codigo === codigo);
    if (item) {
      item.nombre = p.nombre; item.precio_usd = p.precio_usd; item.stock = p.stock;
      if (p.stock === 0) {
        cart = cart.filter(x => x.codigo !== codigo);
        showToast('El producto no tiene stock disponible', 'error');
      }
      renderCart(); updateCheckoutBtn();
    }
  }
}

function handleCartQtyInput(codigo, value) {
  const item = cart.find(x => x.codigo === codigo);
  if (!item) return;
  let newQty = parseInt(value);
  if (isNaN(newQty) || newQty <= 0) {
    cart = cart.filter(x => x.codigo !== codigo);
  } else {
    newQty = Math.min(newQty, item.stock);
    item.cantidad = newQty;
  }
  renderCart();
  updateCheckoutBtn();
}

function removeFromCart(codigo) {
  cart = cart.filter(x => x.codigo !== codigo);
  playSound('remove');
  renderCart();
  updateCheckoutBtn();
}

function clearCart() {
  if (cart.length === 0) return;
  cart = [];
  playSound('cancel');
  renderCart();
  updateCheckoutBtn();
  showToast('Venta cancelada', 'info');
}

function updateCartBadge() {
  const badge = qs(SEL.cartBadge);
  if (!badge) return;
  if (cart.length === 0) { badge.classList.add('hidden'); return; }
  badge.classList.remove('hidden');
  badge.textContent = cart.reduce(function(sum, item) { return sum + item.cantidad; }, 0);
}

function renderCart() {
  const tbody = qs(SEL.cartBody);
  const empty = qs(SEL.cartEmpty);
  tbody.innerHTML = '';
  if (cart.length === 0) {
    empty.innerHTML = emptyState('<i class="nf nf-fa-shopping_cart"></i>', 'El carrito est\u00e1 vac\u00edo', 'Agregue productos desde la lista');
    empty.style.display = 'block';
    document.querySelector('.sales-body').classList.add('cart-hidden');
  } else {
    empty.innerHTML = '';
    empty.style.display = 'none';
    document.querySelector('.sales-body').classList.remove('cart-hidden');
    const fragment = document.createDocumentFragment();
    cart.forEach(item => {
      const tr = document.createElement('tr');
      const displayName = item.nombre || item.codigo;
      tr.innerHTML = createCartRow(item);
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }
  updateCartTotals();
  updateCartBadge();
}

function updateCartTotals() {
  const totalUSD = cart.reduce((sum, item) => sum + item.cantidad * item.precio_usd, 0);
  qs(SEL.cartTotalUsd).textContent = formatUSD(totalUSD);
  qs(SEL.cartTotalBs).textContent = formatBS(totalUSD * tasaActual);
}

function updateCheckoutBtn() {
  qs(SEL.checkoutBtn).disabled = cart.length === 0;
}

/* ========== PAYMENT ========== */
function openPaymentModal() {
  if (cart.length === 0) return;
  const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
  qs(SEL.paymentTotalUsd).textContent = formatUSD(total);
  qs(SEL.paymentTotalBs).textContent = formatBS(totalBsRedondeado(total));
  showModal(qs(SEL.paymentModal));
  qs(SEL.referenciaInput).value = '';
  qs(SEL.clienteSelect).innerHTML = '<option value="">Seleccione...</option>';
  qs(SEL.mixtoItems).innerHTML = '';
  qs(SEL.mixtoError).style.display = 'none';
  selectPaymentMethod(METODO_EFECTIVO_BS);
  loadClientesForSelect();
}

function closePaymentModal() {
  closeModal(qs(SEL.paymentModal));
}

const METODO_LABELS = {
  efectivo_bs: 'Efectivo Bs.', efectivo_usd: 'Efectivo USD', biopago: 'Biopago',
  punto: 'Punto', pago_movil: 'Pago M\u00f3vil', credito: 'Cr\u00e9dito', mixto: 'Mixto'
};

function formatMetodoLabel(m) { return METODO_LABELS[m] || m; }

function selectPaymentMethod(method) {
  qsa('.payment-method-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));
  qs(SEL.referenciaGroup).style.display = method === METODO_PAGO_MOVIL ? 'block' : 'none';
  qs(SEL.clienteGroup).style.display = method === METODO_CREDITO ? 'block' : 'none';
  qs(SEL.mixtoGroup).style.display = method === METODO_MIXTO ? 'block' : 'none';
  const isCash = method === METODO_EFECTIVO_BS || method === METODO_EFECTIVO_USD;
  const cambioGroup = qs(SEL.cambioGroup);
  if (cambioGroup) {
    cambioGroup.style.display = isCash ? 'block' : 'none';
    if (!isCash) { qs(SEL.cambioRecibido).value = ''; qs(SEL.cambioResultado).classList.add('hidden'); }
  }
  if (method === METODO_MIXTO) {
    if (!qs(SEL.mixtoItems).querySelector('.mixto-row')) addMixtoRow('mixto-items');
    distributeMixto('mixto-items');
  }
}

function addMixtoRow(containerId, autoDistribute) {
  autoDistribute = autoDistribute !== false;
  const container = document.getElementById(containerId);
  const row = document.createElement('div');
  row.className = 'mixto-row';
  row.innerHTML =
    '<select>' +
      '<option value="efectivo_usd">Efectivo USD</option>' +
      '<option value="efectivo_bs">Efectivo Bs.</option>' +
      '<option value="biopago">Biopago</option>' +
      '<option value="punto">Punto</option>' +
      '<option value="pago_movil">Pago M\u00f3vil</option>' +
    '</select>' +
    '<div class="mixto-input-group">' +
      '<span class="mixto-currency-label">$</span>' +
      '<input type="number" step="any" min="0" placeholder="0.00" class="mixto-monto">' +
    '</div>' +
    '<span class="mixto-conversion"></span>' +
    '<input type="text" maxlength="4" placeholder="Ref" class="mixto-ref" style="display:none;">' +
    '<button class="mixto-remove">&times;</button>';
  const sel = row.querySelector('select');
  const montoInput = row.querySelector('.mixto-monto');
  const convSpan = row.querySelector('.mixto-conversion');
  const refInput = row.querySelector('.mixto-ref');
  const curLabel = row.querySelector('.mixto-currency-label');

  function updateConversion() {
    const val = parseFloat(montoInput.value) || 0;
    if (sel.value === METODO_EFECTIVO_USD) {
      convSpan.textContent = '= Bs. ' + formatBS(val * tasaActual);
      convSpan.style.display = 'inline';
      montoInput._usdValue = val;
    } else if (isBsMethod(sel.value)) {
      const usd = tasaActual > 0 ? val / tasaActual : 0;
      convSpan.textContent = '= $ ' + formatUSD(usd);
      convSpan.style.display = 'inline';
      montoInput._usdValue = usd;
    } else {
      convSpan.style.display = 'none';
      montoInput._usdValue = val;
    }
    updateMixtoWarning(containerId);
  }

  function updateMethodUI() {
    const method = sel.value;
    refInput.style.display = method === METODO_PAGO_MOVIL ? 'block' : 'none';
    if (method !== METODO_PAGO_MOVIL) refInput.value = '';
    if (method === METODO_EFECTIVO_USD) {
      curLabel.textContent = '$';
    } else if (isBsMethod(method)) {
      curLabel.textContent = 'Bs.';
    } else {
      curLabel.textContent = '$';
    }
    updateConversion();
  }

  sel.addEventListener('change', function() {
    updateMethodUI();
    if (autoDistribute) distributeMixto(containerId);
  });
  montoInput.addEventListener('input', updateConversion);

  row.querySelector('.mixto-remove').addEventListener('click', function() {
    if (container.querySelectorAll('.mixto-row').length > 1) {
      row.remove();
      if (autoDistribute) distributeMixto(containerId);
    }
  });
  container.appendChild(row);
  updateMethodUI();
  if (autoDistribute) distributeMixto(containerId);
}

function distributeMixto(containerId) {
  containerId = containerId || 'mixto-items';
  const rows = document.querySelectorAll('#' + containerId + ' .mixto-row');
  if (!rows.length) return;
  const total = containerId === 'mixto-items'
    ? cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0)
    : parseFloat(qs(SEL.abonoMonto).value) || 0;
  if (total <= 0) return;
  const share = total / rows.length;
  for (const row of rows) {
    const sel = row.querySelector('select');
    const input = row.querySelector('.mixto-monto');
    const method = sel.value;
    if (isBsMethod(method)) {
      input.value = (share * tasaActual).toFixed(2).replace(/\.?0+$/, '');
      input._usdValue = share;
    } else {
      input.value = share.toFixed(2).replace(/\.?0+$/, '');
      input._usdValue = share;
    }
    const convSpan = row.querySelector('.mixto-conversion');
    if (method === METODO_EFECTIVO_USD) {
      convSpan.textContent = '= Bs. ' + formatBS(share * tasaActual);
      convSpan.style.display = 'inline';
    } else if (isBsMethod(method)) {
      convSpan.textContent = '= $ ' + formatUSD(share);
      convSpan.style.display = 'inline';
    } else {
      convSpan.style.display = 'none';
    }
  }
  updateMixtoWarning(containerId);
}

function getMixtoData(containerId) {
  containerId = containerId || 'mixto-items';
  const rows = document.querySelectorAll('#' + containerId + ' .mixto-row');
  const items = [];
  for (const row of rows) {
    const metodo = row.querySelector('select').value;
    const ref = row.querySelector('.mixto-ref').value.trim() || null;
    const input = row.querySelector('.mixto-monto');
    let monto_usd;
    if (isBsMethod(metodo)) {
      const bs = parseFloat(input.value) || 0;
      monto_usd = tasaActual > 0 ? bs / tasaActual : 0;
    } else {
      monto_usd = parseFloat(input.value) || 0;
    }
    if (monto_usd > 0) {
      items.push({ metodo, monto_usd: monto_usd, referencia: metodo === METODO_PAGO_MOVIL ? ref : null });
    }
  }
  return items;
}

function updateMixtoWarning(containerId) {
  containerId = containerId || 'mixto-items';
  const warningEl = qs(containerId === 'mixto-items' ? SEL.mixtoWarning : SEL.abonoMixtoWarning);
  const textEl = qs(containerId === 'mixto-items' ? SEL.mixtoWarningText : SEL.abonoMixtoWarningText);
  const items = getMixtoData(containerId);
  const total = containerId === 'mixto-items'
    ? cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0)
    : parseFloat(qs(SEL.abonoMonto).value) || 0;
  if (items.length === 0 || total <= 0) { warningEl.style.display = 'none'; return; }
  let suma = 0;
  for (const item of items) suma += item.monto_usd;
  const diff = total - suma;
  if (Math.abs(diff) > 0.01) {
    const falta = diff > 0;
    textEl.textContent = falta
      ? 'Faltan ' + formatUSD(diff) + ' por distribuir'
      : 'Sobran ' + formatUSD(Math.abs(diff)) + ' de la distribuci\u00f3n';
    warningEl.style.display = 'flex';
  } else {
    warningEl.style.display = 'none';
  }
}

function validarMixto(items, totalEsperado, errorId) {
  const errEl = document.getElementById(errorId);
  if (items.length === 0) {
    errEl.textContent = 'Agregue al menos un m\u00e9todo de pago';
    errEl.style.display = 'block';
    return false;
  }
  let suma = 0;
  for (const item of items) {
    if (item.monto_usd <= 0) {
      errEl.textContent = 'Todos los montos deben ser mayores a cero';
      errEl.style.display = 'block';
      return false;
    }
    if (item.metodo === METODO_PAGO_MOVIL && (!item.referencia || item.referencia.length !== PAGO_MOVIL_REF_LEN)) {
      errEl.textContent = 'Pago m\u00f3vil requiere referencia de 4 d\u00edgitos';
      errEl.style.display = 'block';
      return false;
    }
    suma += item.monto_usd;
  }
  if (Math.abs(suma - totalEsperado) > 0.01) {
    errEl.textContent = 'La suma ($' + suma.toFixed(2) + ') no coincide con el total ($' + totalEsperado.toFixed(2) + ')';
    errEl.style.display = 'block';
    return false;
  }
  errEl.style.display = 'none';
  return true;
}

async function loadClientesForSelect() {
  try {
    const clientes = await invoke('list_clientes');
    const sel = qs(SEL.clienteSelect);
    sel.innerHTML = '<option value="">Seleccione un cliente...</option>';
    clientes.filter(c => c.credito_activo).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre + ' (Deuda: ' + formatUSD(c.saldo_deuda_usd) + ')';
      sel.appendChild(opt);
    });
  } catch (e) { showToast('Error al cargar clientes', 'error'); }
}

let processingPayment = false;
async function confirmPayment() {
  if (processingPayment) return;
  const confirmarVenta = await getUserConfig(CFG_CONFIRMAR_VENTA);
  if (confirmarVenta === '1') {
    const ok = await confirmModal('¿Confirmar la venta por ' + formatUSD(cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0)) + '?', 'Confirmar Venta', 'Cobrar');
    if (!ok) return;
  }
  processingPayment = true;
  qs(SEL.paymentConfirmBtn).disabled = true;
  const methodBtn = qs('.payment-method-btn.active');
  if (!methodBtn) { showToast('Seleccione un m\u00e9todo de pago', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
  const metodo = methodBtn.dataset.method;
  let referencia = null, cliente_id = null, pago_detalle = null;
  if (metodo === METODO_PAGO_MOVIL) {
    referencia = qs(SEL.referenciaInput).value.trim();
    if (referencia.length !== PAGO_MOVIL_REF_LEN) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
  }
  if (metodo === METODO_CREDITO) {
    const sel = qs(SEL.clienteSelect);
    if (!sel.value) { showToast('Seleccione un cliente', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
    cliente_id = parseInt(sel.value);
  }
  const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
  if (metodo === METODO_MIXTO) {
    pago_detalle = getMixtoData('mixto-items');
    if (!validarMixto(pago_detalle, total, 'mixto-error')) {
      processingPayment = false;
      qs(SEL.paymentConfirmBtn).disabled = false;
      return;
    }
  }
  const productos = cart.map(i => ({ codigo: i.codigo, cantidad: i.cantidad }));
  let total_bs_ingresado = null;
  if (metodo === METODO_EFECTIVO_BS) {
    const totalMoneda = totalBsRedondeado(total);
    const recibido = parseFloat(qs(SEL.cambioRecibido).value) || 0;
    if (recibido > 0 && recibido !== totalMoneda) {
      if (!calcularVuelto) {
        total_bs_ingresado = recibido;
      } else if (recibido <= totalMoneda) {
        total_bs_ingresado = totalMoneda;
      }
    } else if (redondeoBs) {
      total_bs_ingresado = totalMoneda;
    }
  } else if (redondeoBs) {
    total_bs_ingresado = totalBsRedondeado(total);
  }
  const confirmBtn = qs(SEL.paymentConfirmBtn);
  confirmBtn.classList.add('loading');
  confirmBtn.textContent = 'Procesando...';
  try {
    const venta = await invoke('create_sale', {
      request: { usuario_id: currentUser.id, metodo_pago: metodo, referencia_pago_movil: referencia, pago_detalle, cliente_id, productos, tasa: tasaActual, total_bs_ingresado }
    });
    playSound('success');
    showToast('Venta #' + venta.id + ' registrada - ' + formatUSD(venta.total_usd));
    cart = [];
    await loadProductCache();
    renderCart(); updateCheckoutBtn(); closePaymentModal();
    scheduleSaleUpload();
  } catch (e) { showToast('Error: ' + e, 'error'); playSound('error'); }
  finally {
    processingPayment = false;
    confirmBtn.disabled = false;
    confirmBtn.classList.remove('loading');
    confirmBtn.textContent = 'Confirmar Pago';
  }
}

/* ========== INVENTORY ========== */
let inventoryPage = 1;
const INVENTORY_PAGE_SIZE = 50;

async function loadInventory() {
  const query = qs(SEL.inventorySearch).value.trim();
  const tbody = qs(SEL.inventoryBody);
  showLoading(tbody);
  try {
    const result = await invoke('list_products', { search: query || null, page: inventoryPage, pageSize: INVENTORY_PAGE_SIZE });
    const products = result.data || result;
    tbody.innerHTML = '';
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyState('<i class="nf nf-fa-archive"></i>', query ? 'Sin resultados' : 'No hay productos', query ? 'Pruebe con otro t\u00e9rmino de b\u00fasqueda' : 'Agregue productos desde el bot\u00f3n superior') + '</td></tr>';
      renderInventoryPagination(result.total || 0);
      return;
    }
    const frag = document.createDocumentFragment();
    products.forEach(p => {
      const tr = document.createElement('tr');
      const editBtn = (currentUser && currentUser.rol === ROL_ADMIN) ? '<button data-action="edit-product" data-codigo="' + p.codigo + '"><i class="nf nf-fa-pencil"></i> Editar</button>' : '';
      tr.innerHTML = createInventoryRow(p, editBtn);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    renderInventoryPagination(result.total || 0);
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function renderInventoryPagination(total) {
  let el = qs(SEL.inventoryPagination);
  if (!el) {
    el = document.createElement('div');
    el.id = 'inventory-pagination';
    el.className = 'pagination';
    qs(SEL.inventoryTable).after(el);
  }
  const totalPages = Math.ceil(total / INVENTORY_PAGE_SIZE);
  if (totalPages <= 1) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = '<button class="btn btn-sm btn-outline" data-inv-page="' + (inventoryPage - 1) + '" ' + (inventoryPage <= 1 ? 'disabled' : '') + '>Anterior</button>' +
    '<span class="pagination-info">P\u00e1gina ' + inventoryPage + ' de ' + totalPages + ' (' + total + ' productos)</span>' +
    '<button class="btn btn-sm btn-outline" data-inv-page="' + (inventoryPage + 1) + '" ' + (inventoryPage >= totalPages ? 'disabled' : '') + '>Siguiente</button>';
  el.querySelectorAll('[data-inv-page]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (this.disabled) return;
      inventoryPage = parseInt(this.dataset.invPage);
      loadInventory();
    });
  });
}

function toggleDropdown(btn) {
  const menu = btn.nextElementSibling;
  const isOpen = menu.classList.contains('show');
  closeAllDropdowns();
  if (!isOpen) {
    menu.classList.add('show');
    if (window.innerWidth > 768) {
      const btnRect = btn.getBoundingClientRect();
      const mw = menu.offsetWidth;
      menu.style.position = 'fixed';
      menu.style.top = btnRect.bottom + 'px';
      menu.style.right = 'auto';
      menu.style.bottom = 'auto';
      // Align left edge with button left, but if it overflows right, flip
      const spaceRight = window.innerWidth - btnRect.left;
      if (spaceRight >= mw) {
        menu.style.left = btnRect.left + 'px';
      } else {
        menu.style.left = Math.max(4, btnRect.right - mw) + 'px';
      }
      const menuRect = menu.getBoundingClientRect();
      const overflowY = menuRect.bottom - window.innerHeight;
      if (overflowY > 0) {
        menu.style.top = Math.max(4, btnRect.top - menuRect.height) + 'px';
      }
    }
  }
}

function closeAllDropdowns() {
  qsa('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
}

document.addEventListener('click', closeAllDropdowns);

function showProductDetail(codigo) {
  const p = productCache.find(x => x.codigo === codigo);
  if (!p) { showToast('Producto no encontrado', 'error'); return; }
  qs(SEL.detailNombre).textContent = p.nombre;
  qs(SEL.detailPrecio).textContent = formatUSD(p.precio_usd);
  qs(SEL.detailStock).textContent = p.stock;
  qs(SEL.detailCreated).textContent = p.created_at || 'No disponible';
  showModal(qs(SEL.productDetailModal));
}

function closeProductDetail() {
  closeModal(qs(SEL.productDetailModal));
}

function openNewProductModal() {
  editingProduct = null;
  qs(SEL.productModalTitle).textContent = 'Registrar Nuevo Producto';
  qs(SEL.productSaveText).textContent = 'Registrar';
  [SEL.productNombre, SEL.productPrecio, SEL.productStock].forEach(id => qs(id).value = '');
  qs(SEL.productDeleteBtn).style.display = 'none';
  showModal(qs(SEL.productModal));
}

function editProduct(codigo) {
  editingProduct = codigo;
  const p = productCache.find(x => x.codigo === codigo);
  if (!p) { showToast('Producto no encontrado', 'error'); return; }
  qs(SEL.productModalTitle).textContent = 'Editar Producto';
  qs(SEL.productSaveText).textContent = 'Guardar';
  qs(SEL.productNombre).value = p.nombre;
  qs(SEL.productPrecio).value = comaAutomaticaEnabled ? p.precio_usd.toFixed(2).replace('.', ',') : p.precio_usd;
  qs(SEL.productStock).value = p.stock;
  qs(SEL.productDeleteBtn).style.display = 'inline-flex';
  showModal(qs(SEL.productModal));
}

function closeProductModal() {
  closeModal(qs(SEL.productModal));
}

async function saveProduct() {
  const codigo = editingProduct || '';
  const nombre = qs(SEL.productNombre).value.trim();
  const precio = parsePrecio(qs(SEL.productPrecio).value);
  const stock = parseInt(qs(SEL.productStock).value) || 0;
  if (!nombre || isNaN(precio) || precio < 0) { showToast('Complete todos los campos', 'error'); return; }
  try {
    if (editingProduct) {
      await invoke('update_product', { codigo, nombre, precioUsd: precio, stock });
    } else {
      await invoke('create_product', { codigo, nombre, precioUsd: precio, stock });
    }
    showToast(editingProduct ? 'Producto actualizado con \u00e9xito' : 'Producto registrado con \u00e9xito');
    playSound('success');
    closeProductModal(); loadInventory(); renderProductSearch();
    loadProductCache();
  } catch (e) {
    showToast('Error: ' + e, 'error');
  }
}

async function deleteProduct() {
  if (!editingProduct) return;
  const ok = await confirmModal('\u00bfEliminar producto ' + editingProduct + '?', 'Eliminar Producto', 'Eliminar');
  if (!ok) return;
  try {
    await invoke('delete_product', { codigo: editingProduct });
    showToast('Producto eliminado');
    playSound('remove');
    closeProductModal(); loadInventory(); renderProductSearch();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function exportProducts() {
  try {
    const b64 = await invoke('export_products_xlsx', { tasa: tasaActual });
    const byteChars = atob(b64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'productos_export.xlsx';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exportado exitosamente');
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function openImportModal() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.tsv,.txt,.csv';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      const res = await invoke('import_products_from_file', { content: text });
      showToast(res);
      loadInventory();
      renderProductSearch();
      loadProductCache();
    } catch (err) { showToast('Error: ' + err, 'error'); }
  };
  input.click();
}



/* ========== CREDITOS ========== */
async function loadCreditos() {
  const tbody = qs(SEL.creditosBody);
  showLoading(tbody);
  try {
    const clientes = await invoke('list_clientes');
    tbody.innerHTML = '';
    if (clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">' + emptyState('<i class="nf nf-fa-credit_card"></i>', 'No hay clientes registrados', 'Registre personas para otorgar cr\u00e9dito') + '</td></tr>';
      return;
    }
    const frag = document.createDocumentFragment();
    clientes.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = createClientRow(c);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function openCreditoModal(cliente) {
  editingClienteId = cliente ? cliente.id : null;
  qs(SEL.clientNombre).value = cliente ? cliente.nombre : '';
  qs(SEL.clientModalTitle).textContent = cliente ? 'Editar Cliente' : 'Registrar Persona para Cr\u00e9dito';
  qs(SEL.clientSaveBtn).textContent = cliente ? 'Guardar Cambios' : 'Guardar';
  showModal(qs(SEL.clientModal));
}

function closeClientModal() { editingClienteId = null; closeModal(qs(SEL.clientModal)); }

async function saveClient() {
  const nombre = qs(SEL.clientNombre).value.trim();
  if (!nombre) { showToast('Ingrese el nombre', 'error'); return; }
  try {
    if (editingClienteId) {
      await invoke('update_cliente', { clienteId: editingClienteId, nombre });
      showToast('Cliente actualizado');
    } else {
      await invoke('create_cliente', { nombre });
      showToast('Cliente creado');
    }
    editingClienteId = null;
    closeClientModal(); loadCreditos();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== DEBT DETAIL ========== */
async function openDebtDetail(id) {
  try {
    const hist = await invoke('get_cliente_history', { clienteId: id });
    qs(SEL.debtDetailTitle).textContent = 'Deuda: ' + hist.cliente.nombre;
    qs(SEL.debtDetailDebt).textContent = formatUSD(hist.total_deuda);
    const container = qs(SEL.debtDetailList);
    container.innerHTML = '';
    if (hist.ventas.length === 0) {
      container.innerHTML = '<p class="empty-state">No hay ventas a cr\u00e9dito registradas.</p>';
    } else {
      hist.ventas.forEach(v => {
        const card = document.createElement('div');
        card.className = 'debt-sale-card';
        let prodHtml = '';
        v.productos.forEach(p => {
          prodHtml += '<div class="debt-prod"><span>' + p.producto_nombre + '</span><span>x' + p.cantidad + ' <strong>' + formatUSD(p.subtotal_usd) + '</strong></span></div>';
        });
        card.innerHTML = createDebtSaleCard(v, prodHtml);
        container.appendChild(card);
      });
    }
    showModal(qs(SEL.debtDetailModal));
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function closeDebtDetail() {
  closeModal(qs(SEL.debtDetailModal));
}

/* ========== ABONO MODAL ========== */
function openAbonoModal(id) {
  abonoClienteId = id;
  qs(SEL.abonoMonto).value = '';
  qs(SEL.abonoReferencia).value = '';
  qs(SEL.abonoReferenciaGroup).style.display = 'none';
  qs(SEL.abonoMixtoGroup).style.display = 'none';
  qs(SEL.abonoMixtoItems).innerHTML = '';
  qs(SEL.abonoMixtoError).style.display = 'none';
  qs(SEL.abonoSaldoRestante).textContent = 'Saldo Restante: $0.00';
  qsa('.abono-metodo-btn').forEach(b => b.classList.toggle('active', b.dataset.method === METODO_EFECTIVO_BS));
  loadAbonoClienteInfo(id);
  showModal(qs(SEL.abonoModal));
}

async function loadAbonoClienteInfo(id) {
  try {
    const clientes = await invoke('list_clientes');
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    qs(SEL.abonoClienteNombre).textContent = c.nombre;
    qs(SEL.abonoDeudaUsd).textContent = formatUSD(c.saldo_deuda_usd);
    qs(SEL.abonoDeudaBs).textContent = formatBS(c.saldo_deuda_usd * tasaActual);
  } catch (e) {}
}

function closeAbonoModal() {
  closeModal(qs(SEL.abonoModal));
  abonoClienteId = null;
}

function selectAbonoMethod(btn) {
  qsa('.abono-metodo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const method = btn.dataset.method;
  qs(SEL.abonoReferenciaGroup).style.display = method === METODO_PAGO_MOVIL ? 'block' : 'none';
  qs(SEL.abonoMixtoGroup).style.display = method === METODO_MIXTO ? 'block' : 'none';
  if (method === METODO_MIXTO) {
    if (!qs(SEL.abonoMixtoItems).querySelector('.mixto-row')) addMixtoRow('abono-mixto-items');
    distributeMixto('abono-mixto-items');
  }
}

function updateAbonoSaldoRestante() {
  const deudaTexto = qs(SEL.abonoDeudaUsd).textContent;
  const deuda = parseFloat(deudaTexto.replace(/[^0-9.-]/g, '')) || 0;
  const monto = parseFloat(qs(SEL.abonoMonto).value) || 0;
  const restante = Math.max(0, deuda - monto);
  qs(SEL.abonoSaldoRestante).textContent = 'Saldo Restante: ' + formatUSD(restante);
}

let processingAbono = false;
async function confirmAbono() {
  if (processingAbono) return;
  processingAbono = true;
  qs(SEL.abonoConfirmBtn).disabled = true;
  const monto = parseFloat(qs(SEL.abonoMonto).value);
  if (isNaN(monto) || monto <= 0) { showToast('Ingrese un monto v\u00e1lido', 'error'); processingAbono = false; qs(SEL.abonoConfirmBtn).disabled = false; return; }
  const metodoBtn = qs('.abono-metodo-btn.active');
  if (!metodoBtn) { showToast('Seleccione un m\u00e9todo de pago', 'error'); processingAbono = false; qs(SEL.abonoConfirmBtn).disabled = false; return; }
  const metodo = metodoBtn.dataset.method;
  let referencia = null, pago_detalle = null;
  if (metodo === METODO_PAGO_MOVIL && metodo !== METODO_MIXTO) {
    referencia = qs(SEL.abonoReferencia).value.trim();
    if (referencia.length !== PAGO_MOVIL_REF_LEN) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); processingAbono = false; qs(SEL.abonoConfirmBtn).disabled = false; return; }
  }
  if (metodo === METODO_MIXTO) {
    pago_detalle = getMixtoData('abono-mixto-items');
    if (!validarMixto(pago_detalle, monto, 'abono-mixto-error')) {
      processingAbono = false;
      qs(SEL.abonoConfirmBtn).disabled = false;
      return;
    }
  }
  try {
    const res = await invoke('pay_debt', {
      request: { cliente_id: abonoClienteId, monto_usd: monto, metodo_pago: metodo, referencia_pago_movil: referencia, pago_detalle, usuario_id: currentUser.id }
    });
    showToast('Abono procesado. Cuenta actualizada con \u00e9xito');
    closeAbonoModal();
    loadCreditos();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  processingAbono = false;
  qs(SEL.abonoConfirmBtn).disabled = false;
}

/* ========== CASHIER ========== */
async function loadDailySummary() {
  try {
    const [summary, cajaAbierta] = await Promise.all([
      invoke('get_daily_summary'),
      invoke('get_caja_abierta')
    ]);
    qs(SEL.dailyCount).textContent = summary.total_ventas;
    qs(SEL.dailyUsd).textContent = formatUSD(summary.total_usd);
    qs(SEL.dailyBs).textContent = formatBS(summary.total_bs);
    qs(SEL.dailyTasa).textContent = 'Bs. ' + summary.tasa_actual.toFixed(2).replace('.', ',');

    const tbody = qs(SEL.dailySalesBody);
    tbody.innerHTML = '';
    if (summary.ventas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">' + emptyState('<i class="nf nf-fa-receipt"></i>', 'Sin ventas hoy', 'Las ventas del d\u00eda aparecer\u00e1n aqu\u00ed') + '</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      summary.ventas.forEach(v => {
        const tr = document.createElement('tr');
        let metodoLabel = formatMetodoLabel(v.metodo_pago);
        if (v.metodo_pago === METODO_PAGO_MOVIL && v.referencia_pago_movil) {
          metodoLabel += ' (' + v.referencia_pago_movil + ')';
        }
        tr.innerHTML = createDailySaleRow(v, metodoLabel);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
    }

    const statusBar = qs(SEL.cajaStatusBar);
    const statusText = qs(SEL.cajaStatusText);
    const openBtn = qs(SEL.openCashierBtn);
    const closeBtn = qs(SEL.closeCashierBtn);
    if (cajaAbierta) {
      statusBar.className = 'caja-status abierta';
      statusText.innerHTML = ICON.UNLOCK + ' Caja abierta';
      openBtn.style.display = 'none';
      closeBtn.style.display = 'inline-flex';
    } else {
      statusBar.className = 'caja-status cerrada';
      statusText.innerHTML = ICON.LOCK + ' Caja cerrada';
      openBtn.style.display = 'inline-flex';
      closeBtn.style.display = 'none';
    }
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function handleOpenCashier() {
  try {
    const res = await invoke('abrir_caja');
    playSound('success');
    showToast(res);
    loadDailySummary();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function openCloseCashier() {
  const totalUSD = qs(SEL.dailyUsd).textContent;
  const totalBS = qs(SEL.dailyBs).textContent;
  const count = qs(SEL.dailyCount).textContent;
  qs(SEL.closeSummary).innerHTML = '<div>Ventas del d\u00eda: <strong>' + count + '</strong></div><div>Total USD: <strong>' + totalUSD + '</strong></div><div>Total Bs.: <strong>' + totalBS + '</strong></div>';
  showModal(qs(SEL.closeCashierModal));
}

function closeCloseCashier() { closeModal(qs(SEL.closeCashierModal)); }

async function confirmCloseCashier() {
  try {
    const [report, reportData] = await Promise.all([
      invoke('close_cashier'),
      invoke('get_close_report_data')
    ]);
    closeCloseCashier();
    let html = '<div class="close-report-content">';
    html += '<div class="close-report-icon">' + ICON.FILE_TEXT + '</div>';
    html += '<h3>Reporte de Cierre de Jornada</h3>';
    html += '<p><strong>Fecha:</strong> ' + report.fecha_cierre + '</p>';
    html += '<p><strong>Usuario:</strong> ' + report.usuario + '</p>';
    html += '<hr class="close-report-hr">';
    html += '<p><strong>Ventas realizadas:</strong> ' + reportData.total_ventas + '</p>';
    html += '<p><strong>Total USD:</strong> ' + formatUSD(reportData.total_usd) + '</p>';
    html += '<p><strong>Total Bs.:</strong> ' + formatBS(reportData.total_bs) + '</p>';
    if (reportData.por_metodo && reportData.por_metodo.length) {
      html += '<hr class="close-report-hr"><h4>Totales por M\u00e9todo de Pago</h4>';
      html += '<canvas id="close-pie-chart" class="chart-canvas" width="' + CANVAS_WIDTH + '" height="' + CANVAS_HEIGHT + '"></canvas>';
      reportData.por_metodo.forEach(m => {
        const label = formatMetodoLabel(m.metodo);
        let refStr = '';
        if (m.referencias && m.referencias.length) {
          refStr = ' (' + m.referencias.join(', ') + ')';
        }
        html += '<p>' + label + refStr + ': ' + formatUSD(m.total_usd) + ' / ' + formatBS(m.total_usd * tasaActual) + '</p>';
      });
    }
    if (reportData.productos_vendidos && reportData.productos_vendidos.length) {
      html += '<hr class="close-report-hr"><h4>Productos Vendidos</h4>';
      html += '<table class="compact-table"><tr><th>Producto</th><th>Cant</th><th>Total</th></tr>';
      reportData.productos_vendidos.forEach(p => {
        html += '<tr><td>' + p.nombre + '</td><td>' + p.cantidad + '</td><td>' + formatUSD(p.total_usd) + '</td></tr>';
      });
      html += '</table>';
    }
    if (reportData.clientes_credito && reportData.clientes_credito.length) {
      html += '<hr class="close-report-hr"><h4>Clientes a Cr\u00e9dito</h4>';
      reportData.clientes_credito.forEach(c => {
        html += '<p>' + c.nombre + ': ' + formatUSD(c.total_usd) + '</p>';
      });
    }
    html += '<div class="close-report-actions"><button class="btn btn-primary" data-action="print-close-report">Exportar PDF</button></div>';
    html += '</div>';
    qs(SEL.closeReportBody).innerHTML = html;
    showModal(qs(SEL.closeReportModal));
    lastCloseReportData = reportData;
    requestAnimationFrame(() => drawCloseChart(reportData));
    playSound('success');
    showToast('Jornada cerrada exitosamente');
    loadDailySummary();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function drawPieChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.por_metodo || !data.por_metodo.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = CHART_CENTER_X, cy = CHART_CENTER_Y, r = CHART_RADIUS;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#fff';
  ctx.fillRect(0, 0, w, h);
  const total = data.por_metodo.reduce((s, m) => s + m.total_usd, 0);
  if (total <= 0) return;
  let startAngle = -Math.PI / 2;
  data.por_metodo.forEach((m, i) => {
    const slice = (m.total_usd / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    const midAngle = startAngle + slice / 2;
    if (slice > 0.15) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(m.total_usd / total * 100) + '%', cx + Math.cos(midAngle) * (r * 0.6), cy + Math.sin(midAngle) * (r * 0.6));
    }
    startAngle += slice;
  });
  let ly = LEGEND_Y_START;
  data.por_metodo.forEach((m, i) => {
    const lx = LEGEND_X;
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(formatMetodoLabel(m.metodo) + ' ' + formatUSD(m.total_usd), lx + 14, ly);
    ly += LEGEND_LINE_HEIGHT;
  });
}

function drawCloseChart(data) { drawPieChart('close-pie-chart', data); }

function printCloseReport() {
  const d = lastCloseReportData;
  if (!d) return;
  let iframe = qs(SEL.printFrame);
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-frame';
    iframe.style.cssText = PRINT_FRAME_CSS;
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write('<html><head><meta charset="utf-8"><title>Reporte de Cierre</title><style>' + TPL_CLOSE_REPORT_STYLE + '</style></head><body>');
  doc.write('<h2>Gestor de Ventas</h2>');
  doc.write('<p style="text-align:center;">Reporte de Cierre de Jornada</p>');
  doc.write('<p style="text-align:center;">' + d.fecha_cierre + '</p>');
  doc.write('<hr>');
  doc.write('<p><strong>Ventas realizadas:</strong> ' + d.total_ventas + '</p>');
  doc.write('<p><strong>Total USD:</strong> ' + formatUSD(d.total_usd) + '</p>');
  doc.write('<p><strong>Total Bs.:</strong> ' + formatBS(d.total_bs) + '</p>');
  doc.write('<hr>');
  doc.write('<h4>Totales por M\u00e9todo de Pago</h4>');
  d.por_metodo.forEach(m => {
    let label = formatMetodoLabel(m.metodo);
    if (m.referencias && m.referencias.length) {
      label += ' (' + m.referencias.join(', ') + ')';
    }
    doc.write('<p>' + label + ': ' + formatUSD(m.total_usd) + '</p>');
  });
  doc.write('<hr>');
  doc.write('<h4>Productos Vendidos</h4>');
  doc.write('<table><tr><th>Producto</th><th>Cantidad</th><th>Total USD</th></tr>');
  d.productos_vendidos.forEach(p => {
    doc.write('<tr><td>' + p.nombre + '</td><td>' + p.cantidad + '</td><td>' + formatUSD(p.total_usd) + '</td></tr>');
  });
  doc.write('</table>');
  if (d.clientes_credito && d.clientes_credito.length) {
    doc.write('<hr>');
    doc.write('<h4>Clientes a Cr\u00e9dito</h4>');
    d.clientes_credito.forEach(c => {
      doc.write('<p>' + c.nombre + ': ' + formatUSD(c.total_usd) + '</p>');
    });
  }
  doc.write('<hr>');
  doc.write('<p class="total">--- Fin del Reporte ---</p>');
  doc.write('</body></html>');
  doc.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
}

function closeReport() { closeModal(qs(SEL.closeReportModal)); }

/* ========== HISTORIAL CIERRES ========== */
async function openHistorialCierres() {
  try {
    const cierres = await invoke('list_cierres');
    const container = qs(SEL.historialCierresList);
    if (!cierres.length) {
      container.innerHTML = '<p class="empty-state">No hay cierres registrados</p>';
    } else {
      let html = '<table class="table compact-table"><tr><th>#</th><th>Fecha</th><th>Usuario</th><th>Ventas</th><th>Total USD</th><th>Total Bs.</th><th></th></tr>';
      cierres.forEach(c => {
        html += '<tr><td>' + c.id + '</td><td>' + c.fecha_hora + '</td><td>' + c.username + '</td><td>' + c.total_ventas + '</td><td>' + formatUSD(c.total_usd) + '</td><td>' + formatBS(c.total_bs) + '</td><td><button class="btn btn-sm btn-outline" data-action="show-cierre-detalle" data-id="' + c.id + '">Ver</button></td></tr>';
      });
      html += '</table>';
      container.innerHTML = html;
    }
    showModal(qs(SEL.historialCierresModal));
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function closeHistorialCierres() {
  closeModal(qs(SEL.historialCierresModal));
}

async function showCierreDetalle(cierreId) {
  try {
    const detalle = await invoke('get_cierre_detalle', { cierreId });
    showModal(qs(SEL.historialCierreDetalleModal));
    closeModal(qs(SEL.historialCierresModal));
    const d = detalle.detalle;
    const c = detalle.cierre;
    let html = '<div style="text-align:center;padding:8px 20px;">';
    html += '<div style="font-size:28px;margin-bottom:4px;">' + ICON.FILE_TEXT + '</div>';
    html += '<h3>Reporte de Cierre #' + c.id + '</h3>';
    html += '<p><strong>Fecha:</strong> ' + c.fecha_hora + '</p>';
    html += '<p><strong>Usuario:</strong> ' + c.username + '</p>';
    html += '<hr style="margin:8px 0;">';
    html += '<p><strong>Ventas realizadas:</strong> ' + d.total_ventas + '</p>';
    html += '<p><strong>Total USD:</strong> ' + formatUSD(d.total_usd) + '</p>';
    html += '<p><strong>Total Bs.:</strong> ' + formatBS(d.total_bs) + '</p>';
    if (d.por_metodo && d.por_metodo.length) {
      html += '<hr style="margin:8px 0;"><h4>Totales por M\u00e9todo de Pago</h4>';
      html += '<canvas id="historial-pie-chart" width="' + CANVAS_WIDTH + '" height="' + CANVAS_HEIGHT + '" style="margin:4px auto;display:block;max-width:100%;"></canvas>';
      d.por_metodo.forEach(m => {
        let label = formatMetodoLabel(m.metodo);
        if (m.referencias && m.referencias.length) {
          label += ' (' + m.referencias.join(', ') + ')';
        }
        html += '<p>' + label + ': ' + formatUSD(m.total_usd) + '</p>';
      });
    }
    if (d.productos_vendidos && d.productos_vendidos.length) {
      html += '<hr style="margin:8px 0;"><h4>Productos Vendidos</h4>';
      html += '<table class="table compact-table"><tr><th>Producto</th><th>Cant</th><th>Total</th></tr>';
      d.productos_vendidos.forEach(p => {
        html += '<tr><td>' + p.nombre + '</td><td>' + p.cantidad + '</td><td>' + formatUSD(p.total_usd) + '</td></tr>';
      });
      html += '</table>';
    }
    if (d.clientes_credito && d.clientes_credito.length) {
      html += '<hr style="margin:8px 0;"><h4>Clientes a Cr\u00e9dito</h4>';
      d.clientes_credito.forEach(cl => {
        html += '<p>' + cl.nombre + ': ' + formatUSD(cl.total_usd) + '</p>';
      });
    }
    html += '</div>';
    qs(SEL.historialCierreDetalleBody).innerHTML = html;
    requestAnimationFrame(() => drawHistorialChart(d));
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function drawHistorialChart(data) { drawPieChart('historial-pie-chart', data); }

function closeHistorialDetalle() {
  closeModal(qs(SEL.historialCierreDetalleModal));
}

/* ========== AUDIT ========== */
async function loadAudit() {
  auditOffset = 0;
  const tbody = qs(SEL.auditBody);
  showLoading(tbody);
  await loadAuditMore();
}

async function loadAuditMore() {
  try {
    const logs = await invoke('get_audit_logs', { limit: auditLimit, offset: auditOffset });
    const tbody = qs(SEL.auditBody);
    if (auditOffset === 0) tbody.innerHTML = '';
    if (logs.length === 0 && auditOffset === 0) {
      tbody.innerHTML = '<tr><td colspan="4">' + emptyState('<i class="nf nf-fa-history"></i>', 'No hay registros de auditor\u00eda', 'Las acciones del sistema aparecer\u00e1n aqu\u00ed') + '</td></tr>';
      qs(SEL.auditLoadMore).style.display = 'none';
      return;
    }
    const frag = document.createDocumentFragment();
    logs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = createAuditRow(log);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    auditOffset += logs.length;
    qs(SEL.auditLoadMore).style.display = logs.length < auditLimit ? 'none' : 'inline-flex';
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== CONFIG ========== */
async function loadThemeConfig() {
  try {
    const currentTheme = await getUserConfig(CFG_TEMA);
    const theme = currentTheme || 'claro';
    applyTheme(theme);
    qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  } catch (e) { showToast('Error al cargar tema', 'error'); }
}

const themes = {
  oscuro: { '--bg': '#2A2533', '--card': '#3D364A', '--card-alt': '#4A4258', '--danger': '#6B2E2A', '--danger-dark': '#55201C', '--primary': '#6C5C7A', '--primary-dark': '#544666', '--primary-rgb': '108, 92, 122', '--accent': '#4A7C65', '--accent-dark': '#3A6651', '--accent-rgb': '74, 124, 101', '--danger-rgb': '107, 46, 42', '--overlay': 'rgba(0, 0, 0, 0.6)', '--toast-bg': '#1F1A2E', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.3)', '--hover': '#352F44', '--border': '#4A4460', '--text': '#E0D8E8', '--text-light': '#A098B8', '--text-secondary': '#A098B8', '--sidebar-bg': '#1F1A2E', '--sidebar-text': '#C8C0D8', '--sidebar-text-rgb': '200, 192, 216' },
  claro: { '--bg': '#FAFAFA', '--card': '#FFFFFF', '--card-alt': '#F2F2F2', '--danger': '#D97373', '--danger-dark': '#C05555', '--primary': '#6C8EBF', '--primary-dark': '#5070A0', '--primary-rgb': '108, 142, 191', '--accent': '#6BAF8D', '--accent-dark': '#4A8F6D', '--accent-rgb': '107, 175, 141', '--danger-rgb': '217, 115, 115', '--overlay': 'rgba(0, 0, 0, 0.15)', '--toast-bg': '#333333', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#F5F5F5', '--border': '#DDDDDD', '--text': '#333333', '--text-light': '#777777', '--text-secondary': '#777777', '--sidebar-bg': '#F0F0F0', '--sidebar-text': '#333333', '--sidebar-text-rgb': '51, 51, 51' },
  azul: { '--bg': '#EDF2F7', '--card': '#FFFFFF', '--card-alt': '#F2F6FA', '--danger': '#E8A0A0', '--danger-dark': '#D48888', '--primary': '#7B9EBF', '--primary-dark': '#5A7D9E', '--primary-rgb': '123, 158, 191', '--accent': '#8FC1B5', '--accent-dark': '#6DA89A', '--accent-rgb': '143, 193, 181', '--danger-rgb': '232, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#2C5282', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#E2E8F0', '--border': '#CBD5E0', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#2C5282', '--sidebar-text': '#EBF4FF', '--sidebar-text-rgb': '235, 244, 255' },
  verde: { '--bg': '#F0F7F0', '--card': '#FFFFFF', '--card-alt': '#EAF3EA', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#A8C9A8', '--primary-dark': '#8BB08B', '--primary-rgb': '168, 201, 168', '--accent': '#B8DCC8', '--accent-dark': '#9CC8AC', '--accent-rgb': '184, 220, 200', '--danger-rgb': '212, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.15)', '--toast-bg': '#3A6A3A', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#E6F0E6', '--border': '#D0E0D0', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#3A6A3A', '--sidebar-text': '#F0FFF0', '--sidebar-text-rgb': '240, 255, 240' },
  morado: { '--bg': '#F5F0FA', '--card': '#FFFFFF', '--card-alt': '#F0EAF5', '--danger': '#E0A8C0', '--danger-dark': '#CC90A8', '--primary': '#C4B0E0', '--primary-dark': '#B098D4', '--primary-rgb': '196, 176, 224', '--accent': '#D4A8DC', '--accent-dark': '#C090CA', '--accent-rgb': '212, 168, 220', '--danger-rgb': '224, 168, 192', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#6A4C93', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#F0EAF6', '--border': '#D8CCE8', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#6A4C93', '--sidebar-text': '#F3E5F5', '--sidebar-text-rgb': '243, 229, 245' },
  turquesa: { '--bg': '#E6F7F5', '--card': '#F5FFFE', '--card-alt': '#EAF8F5', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#4DB8AC', '--primary-dark': '#3A9A8E', '--primary-rgb': '77, 184, 172', '--accent': '#80D0C4', '--accent-dark': '#60B8AA', '--accent-rgb': '128, 208, 196', '--danger-rgb': '212, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#1A4A44', '--shadow': '0 2px 12px rgba(26, 74, 68, 0.08)', '--hover': '#E8F5F2', '--border': '#C0E0DA', '--text': '#1A4A44', '--text-light': '#5A7A74', '--text-secondary': '#5A7A74', '--sidebar-bg': '#B0E0D6', '--sidebar-text': '#1A4A44', '--sidebar-text-rgb': '26, 74, 68' },
  naranja: { '--bg': '#FDF0E8', '--card': '#FFF8F0', '--card-alt': '#F5EDE0', '--danger': '#D97050', '--danger-dark': '#C06040', '--primary': '#D47A4A', '--primary-dark': '#C06030', '--primary-rgb': '212, 122, 74', '--accent': '#E8A060', '--accent-dark': '#D48540', '--accent-rgb': '232, 160, 96', '--danger-rgb': '217, 112, 80', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#5C2A0A', '--shadow': '0 2px 12px rgba(74, 42, 16, 0.08)', '--hover': '#F8EDE0', '--border': '#E8D0B8', '--text': '#4A2A10', '--text-light': '#8A6A4A', '--text-secondary': '#8A6A4A', '--sidebar-bg': '#F0C8A8', '--sidebar-text': '#5C2A0A', '--sidebar-text-rgb': '92, 42, 10' },
  menta: { '--bg': '#EEF7EE', '--card': '#FFFFFF', '--card-alt': '#E8F5E8', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#6BAF8D', '--primary-dark': '#4A8F6D', '--primary-rgb': '107, 175, 141', '--accent': '#8FC1A8', '--accent-dark': '#6DA88A', '--accent-rgb': '143, 193, 168', '--danger-rgb': '212, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.15)', '--toast-bg': '#3A6A4A', '--shadow': '0 2px 12px rgba(58, 106, 74, 0.08)', '--hover': '#E6F5E6', '--border': '#D0E0D0', '--text': '#2A3A2A', '--text-light': '#5A7A6A', '--text-secondary': '#5A7A6A', '--sidebar-bg': '#B0D0B8', '--sidebar-text': '#2A4A3A', '--sidebar-text-rgb': '42, 74, 58' }
};

let prevThemeKeys = null;
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (prevThemeKeys) {
    prevThemeKeys.forEach(key => document.documentElement.style.removeProperty(key));
  }
  const t = themes[theme];
  if (t) {
    prevThemeKeys = Object.keys(t);
    Object.entries(t).forEach(([key, val]) => {
      document.documentElement.style.setProperty(key, val);
    });
    try { localStorage.setItem(CFG_TEMA, theme); } catch (e) {}
  } else {
    prevThemeKeys = null;
  }
}

async function handleThemeClick(theme) {
  applyTheme(theme);
  qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  try {
    await setUserConfig(CFG_TEMA, theme);
    showToast('Tema cambiado a ' + theme);
  } catch (e) { showToast('Error al guardar tema', 'error'); }
}

/* ========== FONT SIZE ========== */
let currentFontPct = FONT_SIZE_DEFAULT;

function applyFontSize(pct) {
  currentFontPct = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, pct));
  const px = (16 * currentFontPct / 100).toFixed(1);
  document.documentElement.style.fontSize = px + 'px';
  qs(SEL.fontSizeDisplay).textContent = currentFontPct + '%';
}

async function loadFontSize() {
  try {
    const saved = await getUserConfig(CFG_FONT_SIZE);
    const pct = parseInt(saved) || FONT_SIZE_DEFAULT;
    applyFontSize(pct);
  } catch (e) { applyFontSize(FONT_SIZE_DEFAULT); }
}

async function saveFontSize(pct) {
  try {
    await setUserConfig(CFG_FONT_SIZE, String(pct));
  } catch (e) {}
}

/* ========== USER MANAGEMENT ========== */
async function loadUserList() {
  try {
    const users = await invoke('list_usuarios');
    const tbody = qs(SEL.userListBody);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">' + emptyState('<i class="nf nf-fa-users"></i>', 'Sin usuarios', '') + '</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = createUserRow(u);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
    }
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function handleCreateUser() {
  const name = qs(SEL.newUserName).value.trim();
  const password = qs(SEL.newUserPassword).value;
  const rol = qs(SEL.newUserRol).value;
  if (!name || !password) { showToast('Complete todos los campos', 'error'); return; }
  if (password.length < 4) { showToast('La contrase\u00f1a debe tener al menos 4 caracteres', 'error'); return; }
  try {
    await invoke('create_usuario', { username: name, password, rol });
    showToast('Usuario creado exitosamente');
    qs(SEL.newUserName).value = '';
    qs(SEL.newUserPassword).value = '';
    loadUserList();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== CHANGE PASSWORD ========== */
async function handleChangePassword() {
  const old = qs(SEL.changePwdOld).value;
  const newPwd = qs(SEL.changePwdNew).value;
  const confirm = qs(SEL.changePwdConfirm).value;
  if (!old || !newPwd || !confirm) { showToast('Complete todos los campos', 'error'); return; }
  if (newPwd !== confirm) { showToast('Las contrase\u00f1as nuevas no coinciden', 'error'); return; }
  if (newPwd.length < 4) { showToast('La contrase\u00f1a debe tener al menos 4 caracteres', 'error'); return; }
  try {
    await invoke('change_password', { request: { old_password: old, new_password: newPwd } });
    showToast('Contrase\u00f1a cambiada exitosamente');
    qs(SEL.changePwdOld).value = '';
    qs(SEL.changePwdNew).value = '';
    qs(SEL.changePwdConfirm).value = '';
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== REPORTS ========== */
async function loadReports() {
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  if (!startDate || !endDate) { showToast('Seleccione fecha de inicio y fin', 'error'); return; }
  const searchBtn = qs(SEL.reportSearchBtn);
  const btnHtml = searchBtn.innerHTML;
  try {
    showLoading(searchBtn);
    const filter = {
      start_date: startDate + ' 00:00:00',
      end_date: endDate + ' 23:59:59',
      producto_codigo: qs(SEL.reportProductFilter).value.trim() || null,
      username: qs(SEL.reportVendorFilter).value.trim() || null,
    };
    const result = await invoke('get_sales_report', { filter });
    qs(SEL.reportTotalCount).textContent = result.total_ventas;
    qs(SEL.reportTotalUsd).textContent = formatUSD(result.total_usd);
    qs(SEL.reportTotalBs).textContent = formatBS(result.total_bs);

    const tbody = qs(SEL.reportSalesBody);
    tbody.innerHTML = '';
    if (!result.ventas || result.ventas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7">' + emptyState('<i class="nf nf-fa-bar_chart"></i>', 'Sin ventas en el per\u00edodo', '') + '</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      result.ventas.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = createReportRow(item);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
    }
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { searchBtn.innerHTML = btnHtml; }
}

async function loadReportsAndTopProducts() {
  await loadReports();
  await loadTopProducts();
}

async function loadTopProducts() {
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  const section = qs(SEL.topProductsSection);
  const grid = qs(SEL.topProductsGrid);
  if (!section || !grid) return;
  if (!startDate || !endDate) { section.style.display = 'none'; return; }
  const limit = parseInt(qs(SEL.topProductsLimit)?.value || '10');
  try {
    const products = await invoke('get_top_products', {
      startDate: startDate + ' 00:00:00',
      endDate: endDate,
      limit: limit
    });
    if (!products || products.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    grid.innerHTML = '';
    products.forEach(function(p) {
      const card = document.createElement('div');
      card.className = 'top-product-card';
      card.innerHTML = '<div class="top-product-rank"><i class="nf nf-fa-cube"></i></div><div class="top-product-info"><div class="top-product-name">' + escapeHtml(p.nombre) + '</div><div class="top-product-meta">' + p.cantidad_vendida + ' vendidos &middot; ' + formatUSD(p.total_usd) + '</div></div>';
      grid.appendChild(card);
    });
  } catch (e) { /* silently ignore */ section.style.display = 'none'; }
}

let dashboardChartType = 'bar';

async function loadDashboard() {
  const body = qs(SEL.dashboardBody);
  if (!body) return;
  try {
    const data = await invoke('get_dashboard_summary');
    var paymentMethods = null;
    if (dashboardChartType === 'pie') {
      try { paymentMethods = await invoke('get_dashboard_payment_methods', { period: piePeriod }); } catch (e) {}
    }
    const periods = [
      { label: 'Hoy', icon: 'calendar_day', key: 'today', color: '#4f46e5' },
      { label: '\u00daltimos 7 d\u00edas', icon: 'calendar_week', key: 'week', color: '#0891b2' },
      { label: 'Este mes', icon: 'calendar', key: 'month', color: '#059669' }
    ];
    body.innerHTML =
      '<div class="dashboard-chart-toggle">' +
        '<button class="btn btn-sm ' + (dashboardChartType === 'bar' ? 'btn-primary' : 'btn-outline') + '" data-chart="bar"><i class="nf nf-fa-bar_chart"></i> Barras</button>' +
        '<button class="btn btn-sm ' + (dashboardChartType === 'pie' ? 'btn-primary' : 'btn-outline') + '" data-chart="pie"><i class="nf nf-fa-chart_pie"></i> Pastel</button>' +
      '</div>' +
      '<div class="dashboard-chart-container"><canvas id="dashboard-canvas" width="600" height="280"></canvas></div>' +
      '<div class="dashboard-grid">' +
        periods.map(function(p) {
          var d = data[p.key];
          return '<div class="dashboard-period" style="border-left: 4px solid ' + p.color + '">' +
            '<div class="dashboard-period-title"><i class="nf nf-fa-' + p.icon + '"></i> ' + p.label + '</div>' +
            '<div class="dashboard-stat"><span>Ventas</span><strong>' + d.total_ventas + '</strong></div>' +
            '<div class="dashboard-stat"><span>Total USD</span><strong>' + formatUSD(d.total_usd) + '</strong></div>' +
            '<div class="dashboard-stat"><span>Total Bs.</span><strong>' + formatBS(d.total_bs) + '</strong></div>' +
          '</div>';
        }).join('') +
      '</div>';
    var toggleBtns = body.querySelectorAll('.dashboard-chart-toggle button');
    for (var i = 0; i < toggleBtns.length; i++) {
      toggleBtns[i].addEventListener('click', function() {
        dashboardChartType = this.dataset.chart;
        if (dashboardChartType === 'pie') piePeriod = 'day';
        loadDashboard();
      });
    }
    if (dashboardChartType === 'pie') {
      requestAnimationFrame(function() { drawDashboardPieChart(body, paymentMethods); });
    } else {
      requestAnimationFrame(function() { drawDashboardBarChart(body, data, periods); });
    }
  } catch (e) { body.innerHTML = '<p class="text-muted">Error al cargar dashboard</p>'; }
}

var piePeriod = 'day';

function showChartTooltip(clientX, clientY, text) {
  var el = qs(SEL.chartTooltip);
  if (!el) {
    el = document.createElement('div');
    el.id = 'chart-tooltip';
    el.style.cssText = 'position:fixed;pointer-events:none;background:rgba(0,0,0,0.85);color:#fff;padding:6px 10px;border-radius:4px;font-size:13px;z-index:9999;white-space:nowrap;display:none;';
    document.body.appendChild(el);
  }
  if (text) {
    el.textContent = text;
    el.style.display = 'block';
    el.style.left = Math.min(clientX + 12, window.innerWidth - el.offsetWidth - 8) + 'px';
    el.style.top = Math.max(clientY - el.offsetHeight - 8, 4) + 'px';
  } else {
    el.style.display = 'none';
  }
}

function hideChartTooltip() {
  var el = qs(SEL.chartTooltip);
  if (el) el.style.display = 'none';
}

/* ========== BAR CHART ========== */
function drawDashboardBarChart(body, data, periods) {
  var canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  var rect = canvas.parentElement.getBoundingClientRect();
  var isMobile = rect.width < 500;
  var w = Math.min(rect.width - 16, 600);
  var h = isMobile ? 240 : 280;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e0d8e8';
  var textLight = getComputedStyle(document.documentElement).getPropertyValue('--text-light').trim() || '#a098b8';
  var pad = isMobile ? { top: 12, right: 8, bottom: 28, left: 40 } : { top: 20, right: 20, bottom: 35, left: 55 };
  var chartW = w - pad.left - pad.right;
  var chartH = h - pad.top - pad.bottom;

  var metrics = [
    { label: 'Ventas', key: 'total_ventas', values: [data.today.total_ventas, data.week.total_ventas, data.month.total_ventas] },
    { label: 'USD', key: 'total_usd', values: [data.today.total_usd, data.week.total_usd, data.month.total_usd] }
  ];

  var barColors = ['#4f46e5', '#0891b2', '#059669'];
  var periodLabels = ['Hoy', '7 d\u00edas', 'Mes'];
  var groupW = chartW / metrics.length;
  var barW = Math.min(groupW * (isMobile ? 0.24 : 0.28), isMobile ? 28 : 36);
  var gap = (groupW - barW * 3) / 4;
  var yMaxes = metrics.map(function(m) { return Math.max.apply(null, m.values) * 1.15 || 1; });

  var bars = [];
  var startTime = null;
  var duration = 600;

  function drawBase(ease) {
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.lineTo(pad.left + chartW, pad.top + chartH);
    ctx.stroke();

    ctx.strokeStyle = '#e5e7eb';
    ctx.setLineDash([4, 4]);
    var gridLines = isMobile ? 3 : 4;
    for (var gi = 1; gi <= gridLines; gi++) {
      var gy = pad.top + chartH * (1 - gi / (gridLines + 1));
      ctx.beginPath();
      ctx.moveTo(pad.left, gy);
      ctx.lineTo(pad.left + chartW, gy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.fillStyle = textLight;
    ctx.font = isMobile ? '9px sans-serif' : '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var yi = 0; yi <= gridLines + 1; yi++) {
      ctx.fillText(Math.round(yi * 100 / (gridLines + 1)) + '%', pad.left - (isMobile ? 4 : 8), pad.top + chartH * (1 - yi / (gridLines + 1)));
    }

    bars = [];
    for (var mi = 0; mi < metrics.length; mi++) {
      var gx = pad.left + mi * groupW + gap;
      for (var bi = 0; bi < 3; bi++) {
        var barH = Math.max(1, (metrics[mi].values[bi] / yMaxes[mi]) * chartH * ease);
        var bx = gx + bi * (barW + gap);
        var by = pad.top + chartH - barH;
        bars.push({ x: bx, y: by, w: barW, h: barH, metric: metrics[mi].label, period: periodLabels[bi] });
        ctx.fillStyle = barColors[bi];
        ctx.fillRect(bx, by, barW, barH);
        if (barH > (isMobile ? 10 : 15)) {
          ctx.fillStyle = textColor;
          ctx.font = (isMobile ? '8px' : '10px') + ' sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(mi === 0 ? String(Number(metrics[mi].values[bi])) : '$' + Number(metrics[mi].values[bi]).toFixed(1), bx + barW / 2, by - 2);
        }
      }
      ctx.fillStyle = textColor;
      ctx.font = (isMobile ? '10px' : '12px') + ' sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(metrics[mi].label, gx + groupW / 2, pad.top + chartH + 8);
    }

    var legendX = w - (isMobile ? 130 : 160), legendY = isMobile ? 4 : 6;
    var lSize = isMobile ? 8 : 10;
    for (var li = 0; li < 3; li++) {
      ctx.fillStyle = barColors[li];
      ctx.fillRect(legendX + li * (isMobile ? 44 : 52), legendY, lSize, lSize);
      ctx.fillStyle = textColor;
      ctx.font = (isMobile ? '8px' : '10px') + ' sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(periodLabels[li], legendX + li * (isMobile ? 44 : 52) + lSize + 3, legendY);
    }
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    drawBase(1 - Math.pow(1 - progress, 3));
    if (progress < 1) { requestAnimationFrame(animate); }
    else { attachChartHover(canvas, bars, dpr); }
  }
  requestAnimationFrame(animate);
}

/* ========== PIE CHART ========== */
function drawDashboardPieChart(body, paymentMethods) {
  var periodLabels = { day: 'Hoy', week: 'Semana', month: 'Mes' };
  var periodBar = document.createElement('div');
  periodBar.className = 'dashboard-chart-toggle';
  periodBar.innerHTML = Object.keys(periodLabels).map(function(k) {
    return '<button class="btn btn-sm ' + (piePeriod === k ? 'btn-primary' : 'btn-outline') + '" data-pie-period="' + k + '">' + periodLabels[k] + '</button>';
  }).join('');
  var container = body.querySelector('.dashboard-chart-container');
  if (container) body.insertBefore(periodBar, container);
  var periodBtns = periodBar.querySelectorAll('[data-pie-period]');
  for (var pi = 0; pi < periodBtns.length; pi++) {
    periodBtns[pi].addEventListener('click', function() {
      piePeriod = this.dataset.piePeriod;
      loadDashboard();
    });
  }

  var canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  var rect = canvas.parentElement.getBoundingClientRect();
  var isMobile = rect.width < 500;
  var w = Math.min(rect.width - 16, 600);
  var dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = 280 * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = '280px';
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var h = 280;

  var textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#e0d8e8';
  var textLight = getComputedStyle(document.documentElement).getPropertyValue('--text-light').trim() || '#a098b8';
  var cardColor = getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#1f2937';

  var pieColors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#7c3aed', '#dc2626'];
  var methodLabels = {
    efectivo: 'Efectivo',
    punto: 'Punto',
    pago_movil: 'Pago M\u00f3vil',
    mixto: 'Mixto',
    credito: 'Cr\u00e9dito',
    efectivo_usd: 'Efectivo USD'
  };

  var slices = [];
  if (paymentMethods && paymentMethods.length) {
    paymentMethods.forEach(function(m, i) {
      if (m.total_usd > 0) {
        slices.push({ label: methodLabels[m.metodo] || m.metodo, value: m.total_usd, color: pieColors[i % pieColors.length] });
      }
    });
  }
  if (slices.length === 0) {
    slices.push({ label: 'Sin datos', value: 1, color: '#6b7280' });
  }

  var total = slices.reduce(function(s, sl) { return s + sl.value; }, 0);

  var legendW = isMobile ? 90 : 130;
  var chartW = w - legendW;
  var cx = chartW / 2;
  var cy = h / 2;
  var radius = Math.min(chartW, h) / 2 - (isMobile ? 20 : 40);

  var acc = 0;
  var angles = slices.map(function(sl) {
    var a = (sl.value / total) * Math.PI * 2;
    var seg = { start: acc, end: acc + a, slice: sl };
    acc += a;
    return seg;
  });

  var duration = 500;
  var startTime = null;

  function drawBase(ease) {
    ctx.clearRect(0, 0, w, h);

    for (var si = 0; si < angles.length; si++) {
      var seg = angles[si];
      var sweep = (seg.end - seg.start) * ease;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, seg.start, seg.start + sweep);
      ctx.closePath();
      ctx.fillStyle = seg.slice.color;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = cardColor;
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = 'bold ' + (isMobile ? '13px' : '16px') + ' sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$' + total.toFixed(1), cx, cy - 6);
    ctx.font = (isMobile ? '8px' : '10px') + ' sans-serif';
    ctx.fillStyle = textLight;
    ctx.fillText(periodLabels[piePeriod] || 'Total', cx, cy + 14);

    var legX = chartW + (isMobile ? 6 : 12);
    var legY = 24;
    var sq = isMobile ? 10 : 12;
    for (var li = 0; li < slices.length; li++) {
      ctx.fillStyle = slices[li].color;
      ctx.fillRect(legX, legY, sq, sq);
      ctx.fillStyle = textColor;
      ctx.font = (isMobile ? '10px' : '12px') + ' sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(slices[li].label, legX + sq + (isMobile ? 4 : 6), legY);
      var pct = ((slices[li].value / total) * 100).toFixed(1);
      ctx.fillStyle = textLight;
      ctx.font = (isMobile ? '8px' : '11px') + ' sans-serif';
      ctx.fillText('$' + slices[li].value.toFixed(1) + ' (' + pct + '%)', legX + sq + (isMobile ? 4 : 6), legY + sq + 2);
      legY += (isMobile ? 34 : 50);
    }
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    var progress = Math.min((timestamp - startTime) / duration, 1);
    drawBase(1 - Math.pow(1 - progress, 3));
    if (progress < 1) { requestAnimationFrame(animate); }
    else { attachPieHover(canvas, angles, cx, cy, radius, dpr); }
  }
  requestAnimationFrame(animate);
}

function attachChartHover(canvas, bars, dpr) {
  function onMove(e) {
    var cr = canvas.getBoundingClientRect();
    var mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr;
    var my = (e.clientY - cr.top) * (canvas.height / cr.height) / dpr;
    for (var i = 0; i < bars.length; i++) {
      if (mx >= bars[i].x && mx <= bars[i].x + bars[i].w && my >= bars[i].y && my <= bars[i].y + bars[i].h) {
        showChartTooltip(e.clientX, e.clientY, bars[i].period + ' - ' + bars[i].metric);
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    hideChartTooltip();
    canvas.style.cursor = 'default';
  }
  function onOut() { hideChartTooltip(); canvas.style.cursor = 'default'; }
  function onTouch(e) {
    var t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas.addEventListener('touchstart', onTouch);
}

function attachPieHover(canvas, angles, cx, cy, radius, dpr) {
  function onMove(e) {
    var cr = canvas.getBoundingClientRect();
    var mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr - cx;
    var my = (e.clientY - cr.top) * (canvas.height / cr.height) / dpr - cy;
    var dist = Math.sqrt(mx * mx + my * my);
    var innerR = radius * 0.45;
    if (dist < innerR || dist > radius) {
      hideChartTooltip();
      canvas.style.cursor = 'default';
      return;
    }
    var angle = Math.atan2(my, mx);
    if (angle < 0) angle += Math.PI * 2;
    for (var i = 0; i < angles.length; i++) {
      if (angle >= angles[i].start && angle < angles[i].end) {
        showChartTooltip(e.clientX, e.clientY, angles[i].slice.label + ' - $' + angles[i].slice.value.toFixed(1));
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    hideChartTooltip();
    canvas.style.cursor = 'default';
  }
  function onOut() { hideChartTooltip(); canvas.style.cursor = 'default'; }
  function onTouch(e) {
    var t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas.addEventListener('touchstart', onTouch);
}

function showChartTooltip(x, y, text) {

/* ========== PRODUCT HISTORY ========== */
async function showProductHistory(codigo, nombre) {
  const title = qs(SEL.productHistoryTitle);
  const tbody = qs(SEL.productHistoryBody);
  if (title) title.textContent = 'Producto: ' + escapeHtml(nombre) + ' (C\u00f3digo: ' + escapeHtml(codigo) + ')';
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';
    showModal(qs(SEL.productHistoryModal));
    try {
      const items = await invoke('get_product_history', { productoCodigo: codigo });
      tbody.innerHTML = '';
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted">Sin ventas registradas</td></tr>';
      } else {
        items.forEach(function(item) {
          var tr = document.createElement('tr');
          tr.innerHTML = '<td>' + item.venta_id + '</td><td>' + escapeHtml(item.fecha_hora) + '</td><td>' + item.cantidad + '</td><td>' + formatUSD(item.precio_usd_unitario) + '</td><td>' + formatUSD(item.subtotal_usd) + '</td><td>' + escapeHtml(item.metodo_pago) + '</td><td>' + escapeHtml(item.username) + '</td>';
          tbody.appendChild(tr);
        });
      }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7">Error: ' + escapeHtml(e) + '</td></tr>'; }
  } else {
    showModal(qs(SEL.productHistoryModal));
  }
}

/* ========== EXPORT REPORT ========== */
async function handleExportReport() {
  const startDate = qs(SEL.reportStartDate).value;
  const endDate = qs(SEL.reportEndDate).value;
  if (!startDate || !endDate) { showToast('Seleccione fecha de inicio y fin', 'error'); return; }
  try {
    const b64 = await invoke('export_report_xlsx', {
      filter: {
        start_date: startDate + ' 00:00:00',
        end_date: endDate + ' 23:59:59',
        producto_codigo: qs(SEL.reportProductFilter).value.trim() || null,
        username: qs(SEL.reportVendorFilter).value.trim() || null,
      }
    });
    var url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + b64;
    var a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_ventas_' + startDate + '_' + endDate + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Reporte exportado');
  } catch (e) { showToast('Error al exportar: ' + e, 'error'); }
}

/* ========== VOID SALE ========== */
async function handleVoidSale(ventaId) {
  const ok = await confirmModal('\u00bfEst\u00e1 seguro de anular la venta #' + ventaId + '? Se devolver\u00e1 el stock al inventario.', 'Anular Venta', 'S\u00ed, anular');
  if (!ok) return;
  try {
    const msg = await invoke('void_sale', { ventaId });
    showToast(msg);
    playSound('remove');
    if (qs('#view-cashier')?.classList.contains('active')) loadDailySummary();
    if (qs(SEL.viewReports)?.classList.contains('active')) loadReportsAndTopProducts();
    scheduleSaleUpload();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== SALE DETAIL MODAL + PARTIAL VOID ========== */
async function showSaleDetail(ventaId, btn) {
  try {
    const detalles = await invoke('get_sale_detail', { ventaId });
    qs(SEL.saleDetailId).textContent = ventaId;
    if (btn) {
      qs(SEL.saleDetailTotal).textContent = formatUSD(parseFloat(btn.dataset.total));
      qs(SEL.saleDetailMetodo).textContent = btn.dataset.metodo;
      qs(SEL.saleDetailUsuario).textContent = btn.dataset.usuario;
      qs(SEL.saleDetailFecha).textContent = btn.dataset.fecha;
    }
    const list = qs(SEL.saleDetailList);
    list.innerHTML = '';
    if (detalles.length === 0) {
      list.innerHTML = '<p class="text-muted">No hay detalles.</p>';
      showModal(qs(SEL.saleDetailModal));
      return;
    }
    const allVoided = detalles.every(function(d) { return d.anulado; });
    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = '<thead><tr><th>Producto</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Estado</th><th>Acci\u00f3n</th></tr></thead>';
    const tbody = document.createElement('tbody');
    detalles.forEach(function(d) {
      const tr = document.createElement('tr');
      if (d.anulado) tr.style.textDecoration = 'line-through';
      const voidBtn = d.anulado
        ? '<span class="text-muted">Anulado</span>'
        : '<button class="btn btn-sm btn-danger void-item-btn" data-detalle-id="' + d.id + '" data-venta-id="' + ventaId + '" ' + (allVoided ? 'disabled' : '') + '>Anular</button>';
      tr.innerHTML = '<td>' + escapeHtml(d.producto_nombre || d.producto_codigo) + '</td><td>' + d.cantidad + '</td><td>' + formatUSD(d.precio_usd_unitario) + '</td><td>' + formatUSD(d.subtotal_usd) + '</td><td>' + (d.anulado ? '<span class="text-danger">Anulado</span>' : 'Activo') + '</td><td>' + voidBtn + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    list.appendChild(table);
    showModal(qs(SEL.saleDetailModal));
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function handleVoidItem(ventaId, detalleId) {
  const ok = await confirmModal('\u00bfAnular este \u00edtem de la venta? Se devolver\u00e1 el stock al inventario.', 'Anular \u00cdtem', 'S\u00ed, anular');
  if (!ok) return;
  try {
    await invoke('void_sale_items', { request: { venta_id: ventaId, detalle_ids: [detalleId] } });
    showToast('Item anulado correctamente');
    playSound('remove');
    showSaleDetail(ventaId);
    if (qs('#view-cashier')?.classList.contains('active')) loadDailySummary();
    if (qs(SEL.viewReports)?.classList.contains('active')) loadReportsAndTopProducts();
    scheduleSaleUpload();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== SET TODAY ON REPORT DATES ========== */
function setDefaultReportDates() {
  const today = new Date().toISOString().split('T')[0];
  const startInput = qs(SEL.reportStartDate);
  const endInput = qs(SEL.reportEndDate);
  if (startInput && !startInput.value) startInput.value = today;
  if (endInput && !endInput.value) endInput.value = today;
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async function() {
  // Collapse all config cards by default
  document.querySelectorAll('.config-card-header').forEach(h => h.classList.add('collapsed'));

  // Auth
  qs(SEL.loginBtn).addEventListener('click', handleLogin);
  qs(SEL.loginUsername).addEventListener('keydown', e => {
    if (e.key === 'Enter') qs(SEL.loginPassword).focus();
  });
  qs(SEL.loginPassword).addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  qs(SEL.togglePassword)?.addEventListener('click', function() {
    const input = qs(SEL.loginPassword);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    this.innerHTML = isPassword ? ICON.EYE_SLASH : ICON.EYE;
    this.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  qs(SEL.logoutBtn).addEventListener('click', handleLogout);
  qs(SEL.mobileLogoutBtn)?.addEventListener('click', handleLogout);

  // Navigation
  qsa('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // Tasa
  qs(SEL.tasaInput).addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      handleTasaChange();
      showToast('Precios actualizados', 'info');
    }
  });
  qs(SEL.tasaInput).addEventListener('blur', handleTasaChange);
  qs(SEL.tasaFetchBtn)?.addEventListener('click', fetchTasaBcv);

  // Sales search
  qs(SEL.productSearch).addEventListener('input', handleProductSearch);
  qs(SEL.checkoutBtn).addEventListener('click', openPaymentModal);
  qs(SEL.cancelSaleBtn).addEventListener('click', async () => {
    if (cart.length === 0) return;
    const ok = await confirmModal('\u00bfEst\u00e1 seguro de cancelar la venta? El carrito se perder\u00e1.', 'Cancelar Venta', 'S\u00ed, cancelar');
    if (ok) clearCart();
  });

  // Event delegation: product search add-to-cart
  qs(SEL.productSearchBody).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="add-to-cart"]');
    if (btn) addToCart(btn.dataset.codigo);
  });

  // Event delegation: cart qty input and remove
  qs(SEL.cartBody).addEventListener('focusin', e => {
    const input = e.target.closest('.cart-qty-input');
    if (input) input.select();
  });
  qs(SEL.cartBody).addEventListener('change', e => {
    const input = e.target.closest('.cart-qty-input');
    if (input) handleCartQtyInput(input.dataset.codigo, input.value);
  });
  qs(SEL.cartBody).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove-from-cart"]');
    if (btn) {
      e.stopPropagation();
      removeFromCart(btn.dataset.codigo);
    }
  });

  // Payment modal
  qs(SEL.paymentModalClose).addEventListener('click', closePaymentModal);
  qs(SEL.paymentCancelBtn).addEventListener('click', closePaymentModal);
  qs(SEL.mixtoAddRow).addEventListener('click', function() { addMixtoRow('mixto-items'); });
  qs(SEL.cambioRecibido)?.addEventListener('input', function() {
    const recibido = parseFloat(this.value) || 0;
    const methodBtn = qs('.payment-method-btn.active');
    if (!methodBtn) return;
    const method = methodBtn.dataset.method;
    const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
    const totalMoneda = method === METODO_EFECTIVO_BS ? totalBsRedondeado(total) : total;
    const cambioEl = qs(SEL.cambioResultado);
    const montoEl = qs(SEL.cambioMonto);
    if (recibido > 0 && recibido > totalMoneda && calcularVuelto) {
      const cambio = recibido - totalMoneda;
      const cambioTexto = method === METODO_EFECTIVO_BS ? 'Bs. ' + cambio.toFixed(2).replace('.', ',') : formatUSD(cambio);
      montoEl.textContent = cambioTexto;
      cambioEl.classList.remove('hidden');
    } else {
      cambioEl.classList.add('hidden');
    }
  });
  qs(SEL.abonoMixtoAddRow).addEventListener('click', function() { addMixtoRow('abono-mixto-items'); });
  qs(SEL.paymentConfirmBtn).addEventListener('click', confirmPayment);
  qsa('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
  });

  // Inventory
  let inventoryTimer = null;
  qs(SEL.inventorySearch).addEventListener('input', () => {
    clearTimeout(inventoryTimer);
    inventoryPage = 1;
    inventoryTimer = setTimeout(loadInventory, 250);
  });
  qs(SEL.inventoryAddBtn).addEventListener('click', openNewProductModal);
  qs(SEL.inventoryExportBtn).addEventListener('click', exportProducts);
  qs(SEL.inventoryImportBtn).addEventListener('click', openImportModal);

  // Event delegation: inventory dropdown and actions
  qs(SEL.inventoryBody).addEventListener('click', e => {
    const dropdownBtn = e.target.closest('[data-action="toggle-dropdown"]');
    if (dropdownBtn) {
      e.stopPropagation();
      toggleDropdown(dropdownBtn);
      return;
    }
    const detailBtn = e.target.closest('[data-action="show-product-detail"]');
    if (detailBtn) {
      showProductDetail(detailBtn.dataset.codigo);
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-product"]');
    if (editBtn) {
      editProduct(editBtn.dataset.codigo);
      return;
    }
    const histBtn = e.target.closest('[data-action="show-product-history"]');
    if (histBtn) {
      showProductHistory(histBtn.dataset.codigo, histBtn.dataset.nombre);
      return;
    }
  });

  // Product modal
  qs(SEL.productModalClose).addEventListener('click', closeProductModal);
  qs(SEL.productCancelBtn).addEventListener('click', closeProductModal);
  qs(SEL.productSaveBtn).addEventListener('click', saveProduct);
  qs(SEL.productDeleteBtn).addEventListener('click', deleteProduct);
  qs(SEL.productPrecio).addEventListener('input', function() { applyComaAutomatica(this); });

  // Product detail modal
  qs(SEL.productDetailClose).addEventListener('click', closeProductDetail);
  qs(SEL.productDetailOkBtn).addEventListener('click', closeProductDetail);

  // Creditos
  qs(SEL.creditoAddBtn).addEventListener('click', () => openCreditoModal());
  qs(SEL.clientModalClose).addEventListener('click', closeClientModal);
  qs(SEL.clientCancelBtn).addEventListener('click', closeClientModal);
  qs(SEL.clientSaveBtn).addEventListener('click', saveClient);

  // Creditos search
  const creditosSearch = qs(SEL.creditosSearch);
  if (creditosSearch) {
    creditosSearch.addEventListener('input', function() {
      const term = this.value.toLowerCase().trim();
      document.querySelectorAll('#creditos-body tr').forEach(tr => {
        const name = tr.children[0]?.textContent?.toLowerCase() || '';
        tr.style.display = name.includes(term) ? '' : 'none';
      });
    });
  }

  // Event delegation: creditos table
  qs(SEL.creditosBody).addEventListener('click', e => {
    const detailBtn = e.target.closest('[data-action="open-debt-detail"]');
    if (detailBtn) {
      openDebtDetail(parseInt(detailBtn.dataset.id));
      return;
    }
    const abonoBtn = e.target.closest('[data-action="open-abono"]');
    if (abonoBtn) {
      openAbonoModal(parseInt(abonoBtn.dataset.id));
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-cliente"]');
    if (editBtn) {
      openCreditoModal({ id: parseInt(editBtn.dataset.id), nombre: editBtn.dataset.nombre });
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-cliente"]');
    if (delBtn) {
      const id = parseInt(delBtn.dataset.id);
      const nombre = delBtn.dataset.nombre;
      confirmModal('\u00bfEliminar a "' + nombre + '"? Esta acci\u00f3n no se puede deshacer.', 'Eliminar Cliente', 'Eliminar').then(async ok => {
        if (!ok) return;
        try {
          await invoke('delete_cliente', { clienteId: id });
          showToast('Cliente eliminado');
          loadCreditos();
        } catch (e) { showToast('Error: ' + e, 'error'); }
      });
      return;
    }
  });

  // Cashier
  qs(SEL.openCashierBtn).addEventListener('click', handleOpenCashier);
  qs(SEL.closeCashierBtn).addEventListener('click', openCloseCashier);
  qs(SEL.closeCashierClose).addEventListener('click', closeCloseCashier);
  qs(SEL.closeCashierCancelBtn).addEventListener('click', closeCloseCashier);
  qs(SEL.closeCashierConfirmBtn).addEventListener('click', confirmCloseCashier);
  qs(SEL.closeReportClose).addEventListener('click', closeReport);
  qs(SEL.closeReportOkBtn).addEventListener('click', closeReport);

  // Event delegation: close report print button
  qs(SEL.closeReportBody).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="print-close-report"]');
    if (btn) printCloseReport();
  });

  /* ========== USER MANAGEMENT ========== */
  const createUserBtn = qs(SEL.createUserBtn);
  if (createUserBtn) createUserBtn.addEventListener('click', handleCreateUser);
  document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('.delete-user-btn');
    if (delBtn) {
      const id = parseInt(delBtn.dataset.id);
      confirmModal('\u00bfEliminar este usuario?', 'Eliminar Usuario', 'Eliminar').then(ok => {
        if (!ok) return;
        invoke('delete_usuario', { usuarioId: id }).then(msg => { showToast(msg); loadUserList(); }).catch(e => showToast('Error: ' + e, 'error'));
      });
    }
  });

  /* ========== COLLAPSIBLE CARDS ========== */
  qs(SEL.viewConfig).addEventListener('click', function(e) {
    const header = e.target.closest('.config-card-header');
    if (header) header.classList.toggle('collapsed');
  });
  qs(SEL.viewReports)?.addEventListener('click', function(e) {
    const header = e.target.closest('.config-card-header');
    if (header) header.classList.toggle('collapsed');
  });
  qs(SEL.viewSync)?.addEventListener('click', function(e) {
    const header = e.target.closest('.config-card-header');
    if (header) header.classList.toggle('collapsed');
  });

  /* ========== CHANGE PASSWORD ========== */
  const changePwdBtn = qs(SEL.changePwdBtn);
  if (changePwdBtn) changePwdBtn.addEventListener('click', handleChangePassword);

  /* ========== ADMIN CHANGE PASSWORD MODAL ========== */
  let adminPwdUserId = null;
  const adminPwdModal = qs(SEL.adminPwdModal);
  const adminPwdInput = qs(SEL.adminPwdInput);
  function openAdminPwdModal(id, username) {
    adminPwdUserId = id;
    qs(SEL.adminPwdUserInfo).textContent = 'Cambiar contrase\u00f1a de: ' + escapeHtml(username);
    adminPwdInput.value = '';
    showModal(adminPwdModal);
    setTimeout(function() { adminPwdInput.focus(); }, 100);
  }
  function closeAdminPwdModal() { adminPwdUserId = null; closeModal(adminPwdModal); }
  qs(SEL.adminPwdModalClose).addEventListener('click', closeAdminPwdModal);
  qs(SEL.adminPwdCancelBtn).addEventListener('click', closeAdminPwdModal);
  qs(SEL.adminPwdSaveBtn).addEventListener('click', async function() {
    const pwd = adminPwdInput.value.trim();
    if (!pwd || pwd.length < 4) { showToast('La contrase\u00f1a debe tener al menos 4 caracteres', 'error'); return; }
    try {
      await invoke('admin_change_password', { usuarioId: adminPwdUserId, newPassword: pwd });
      showToast('Contrase\u00f1a cambiada exitosamente');
      closeAdminPwdModal();
    } catch (e) { showToast('Error: ' + e, 'error'); }
  });
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.admin-pwd-btn');
    if (btn) {
      openAdminPwdModal(parseInt(btn.dataset.id), btn.dataset.username);
    }
  });

  /* ========== BACKUP DATABASE ========== */
  const backupBtn = qs(SEL.backupDbBtn);
  if (backupBtn) {
    backupBtn.addEventListener('click', async function() {
      try {
        backupBtn.disabled = true;
        backupBtn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Guardando...';
        const msg = await invoke('backup_database', { destPath: '' });
        showToast(msg);
      } catch (e) {
        showToast('Error: ' + e, 'error');
      } finally {
        backupBtn.disabled = false;
        backupBtn.innerHTML = '<i class="nf nf-fa-save"></i> Descargar respaldo';
      }
    });
  }

  /* ========== SUPABASE SYNC ========== */
  /* Guardar URL y Key al cambiar */
  document.addEventListener('change', function(e) {
    if (e.target.id === 'sync-url') {
      invoke('set_config_value', { key: CFG_SUPABASE_URL, value: e.target.value }).catch(() => {});
    }
    if (e.target.id === 'sync-key') {
      invoke('set_config_value', { key: CFG_SUPABASE_KEY, value: e.target.value }).catch(() => {});
    }
  });

  /* Registrar dispositivo */
  const registerBtn = qs(SEL.registerDeviceBtn);
  if (registerBtn) {
    registerBtn.addEventListener('click', async function() {
      const name = 'PC Jotapemece';
      const urlEl = qs(SEL.syncUrl);
      const keyEl = qs(SEL.syncKey);
      if (urlEl && urlEl.value) await invoke('set_config_value', { key: CFG_SUPABASE_URL, value: urlEl.value }).catch(() => {});
      if (keyEl && keyEl.value) await invoke('set_config_value', { key: CFG_SUPABASE_KEY, value: keyEl.value }).catch(() => {});
      try {
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Registrando...';
        const result = await invoke('register_device', { nombre: name });
        showToast(result);
        loadSyncConfig();
      } catch (e) { showToast('Error: ' + e, 'error'); }
      finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="nf nf-fa-tag"></i> Registrar dispositivo';
      }
    });
  }

  /* Subir productos */
  /* Conflictos: botones de resolución delegados */
  qs(SEL.conflictModal)?.addEventListener('click', async function(e) {
    const btn = e.target.closest('.conflict-keep-local, .conflict-use-remote');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const useRemote = btn.classList.contains('conflict-use-remote');
    btn.disabled = true;
    btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i>';
    try {
      const msg = await invoke('resolve_conflicto', { conflictoId: id, useRemote });
      showToast(msg);
      openConflictModal();
      loadConflictCount();
    } catch (e) { showToast('Error: ' + e, 'error'); }
  });

  /* Ver conflictos */
  qs(SEL.viewConflictsBtn)?.addEventListener('click', openConflictModal);

  /* Sync all progress UI */
  const syncProgressModal = qs(SEL.syncProgressModal);
  const syncProgressText = qs(SEL.syncProgressText);
  const syncProgressBar = qs(SEL.syncProgressBar);
  function showSyncProgress() { syncProgressModal.classList.remove('hidden'); }
  function hideSyncProgress() { syncProgressModal.classList.add('hidden'); syncProgressBar.style.width = '0%'; }
  function updateSyncProgress(step, current, total) {
    const pct = Math.round((current / total) * 100);
    syncProgressText.textContent = step + ' (' + current + '/' + total + ')';
    syncProgressBar.style.width = pct + '%';
  }
  window.addEventListener('sync-progress', function(e) {
    var d = e.detail || e;
    updateSyncProgress(d.step, d.current, d.total);
  });

  function syncSaveConfig() {
    var urlEl = qs(SEL.syncUrl);
    var keyEl = qs(SEL.syncKey);
    if (urlEl && urlEl.value) invoke('set_config_value', { key: CFG_SUPABASE_URL, value: urlEl.value }).catch(function(){});
    if (keyEl && keyEl.value) invoke('set_config_value', { key: CFG_SUPABASE_KEY, value: keyEl.value }).catch(function(){});
  }

  /* Subir todo */
  qs(SEL.uploadAllBtn)?.addEventListener('click', function() {
    confirmModal('¿Subir productos, clientes y ventas a Supabase?', 'Subir todo', 'Subir').then(function(ok) {
      if (!ok) return;
      syncSaveConfig();
      showSyncProgress();
      invoke('upload_all').then(function(r) {
        hideSyncProgress();
        showToast('Subida completa');
        loadConflictCount();
      }).catch(function(e) {
        hideSyncProgress();
        showToast('Error: ' + e, 'error');
      });
    });
  });

  /* Descargar todo */
  qs(SEL.downloadAllBtn)?.addEventListener('click', function() {
    confirmModal('¿Descargar productos, clientes y ventas desde Supabase?', 'Descargar todo', 'Descargar').then(function(ok) {
      if (!ok) return;
      syncSaveConfig();
      showSyncProgress();
      invoke('download_all').then(function(r) {
        hideSyncProgress();
        showToast('Descarga completa');
        loadProductCache();
        loadConflictCount();
      }).catch(function(e) {
        hideSyncProgress();
        showToast('Error: ' + e, 'error');
      });
    });
  });

  /* Sincronizar todo */
  qs(SEL.syncAllBtn)?.addEventListener('click', function() {
    confirmModal('¿Sincronizar completamente (subir y descargar todo) con Supabase?', 'Sincronizar todo', 'Sincronizar').then(function(ok) {
      if (!ok) return;
      syncSaveConfig();
      showSyncProgress();
      invoke('sync_all').then(function(r) {
        hideSyncProgress();
        showToast('Sincronización completa');
        loadProductCache();
        loadConflictCount();
      }).catch(function(e) {
        hideSyncProgress();
        showToast('Error: ' + e, 'error');
      });
    });
  });

  /* Probar conexión */
  qs(SEL.testConnectionBtn)?.addEventListener('click', async function() {
    var statusEl = qs(SEL.connectionStatus);
    if (!statusEl) return;
    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Probando...';
    statusEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
    statusEl.title = 'Probando...';
    syncSaveConfig();
    try {
      var ok = await invoke('test_supabase_connection');
      if (ok) {
        statusEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--success').trim();
        statusEl.title = 'Conectado';
        showToast('Conexión exitosa');
      } else {
        statusEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
        statusEl.title = 'Error de conexión';
        showToast('No se pudo conectar a Supabase', 'error');
      }
    } catch (e) {
      statusEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim();
      statusEl.title = 'Error: ' + e;
      showToast('Error: ' + e, 'error');
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="nf nf-fa-plug"></i> Probar conexión';
    loadSyncStats();
  });

  /* Cerrar modal conflictos */
  qs(SEL.conflictModalClose)?.addEventListener('click', function() { closeModal(qs(SEL.conflictModal)); });
  qs(SEL.conflictCloseBtn)?.addEventListener('click', function() { closeModal(qs(SEL.conflictModal)); });

  /* ========== REPORTS ========== */
  const reportSearchBtn = qs(SEL.reportSearchBtn);
  if (reportSearchBtn) reportSearchBtn.addEventListener('click', loadReportsAndTopProducts);
  ['report-start-date', 'report-end-date'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', setDefaultReportDates);
  });
  const topLimitSelect = qs(SEL.topProductsLimit);
  if (topLimitSelect) topLimitSelect.addEventListener('change', loadTopProducts);

  /* ========== EXPORT REPORT ========== */
  const exportBtn = qs(SEL.reportExportBtn);
  if (exportBtn) exportBtn.addEventListener('click', handleExportReport);

  /* ========== PRODUCT HISTORY MODAL ========== */
  qs(SEL.productHistoryModalClose)?.addEventListener('click', function() { closeModal(qs(SEL.productHistoryModal)); });
  qs(SEL.productHistoryOkBtn)?.addEventListener('click', function() { closeModal(qs(SEL.productHistoryModal)); });

  /* ========== VOID SALE (delegation on daily sales table) ========== */
  qs(SEL.dailySalesBody).addEventListener('click', function(e) {
    const btn = e.target.closest('.void-sale-btn');
    if (btn) handleVoidSale(parseInt(btn.dataset.id));
    const detailBtn = e.target.closest('.sale-detail-btn');
    if (detailBtn) showSaleDetail(parseInt(detailBtn.dataset.id), detailBtn);
  });

  /* ========== SALE DETAIL MODAL ========== */
  qs(SEL.saleDetailClose)?.addEventListener('click', function() { closeModal(qs(SEL.saleDetailModal)); });
  qs(SEL.saleDetailOkBtn)?.addEventListener('click', function() { closeModal(qs(SEL.saleDetailModal)); });
  qs(SEL.saleDetailList)?.addEventListener('click', function(e) {
    const btn = e.target.closest('.void-item-btn');
    if (btn) handleVoidItem(parseInt(btn.dataset.ventaId), parseInt(btn.dataset.detalleId));
  });

  /* ========== VIEW-SPECIFIC LOAD ========== */
  // Reports: set default dates on show
  const reportsView = qs(SEL.viewReports);
  if (reportsView) {
    const observer = new MutationObserver(function() {
      if (reportsView.classList.contains('active')) {
        loadUserList();
        setDefaultReportDates();
        loadDashboard();
      }
    });
    observer.observe(reportsView, { attributes: true, attributeFilter: ['class'] });
  }

  // Goto reports from cashier
  const gotoReportsBtn = qs(SEL.gotoReportsBtn);
  if (gotoReportsBtn) gotoReportsBtn.addEventListener('click', function() { showView('reports'); });

  // Historial cierres
  qs(SEL.historialCierresBtn).addEventListener('click', openHistorialCierres);
  qs(SEL.historialCierresClose).addEventListener('click', closeHistorialCierres);
  qs(SEL.historialCierresOkBtn).addEventListener('click', closeHistorialCierres);

  // Event delegation: historial cierres list
  qs(SEL.historialCierresList).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="show-cierre-detalle"]');
    if (btn) showCierreDetalle(parseInt(btn.dataset.id));
  });

  qs(SEL.historialCierreDetalleClose).addEventListener('click', closeHistorialDetalle);
  qs(SEL.historialCierreDetalleOkBtn).addEventListener('click', closeHistorialDetalle);

  // Debt detail
  qs(SEL.debtDetailClose).addEventListener('click', closeDebtDetail);
  qs(SEL.debtDetailOkBtn).addEventListener('click', closeDebtDetail);

  // Abono modal
  qs(SEL.abonoClose).addEventListener('click', closeAbonoModal);
  qs(SEL.abonoCancelBtn).addEventListener('click', closeAbonoModal);
  qs(SEL.abonoConfirmBtn).addEventListener('click', confirmAbono);
  qs(SEL.abonoMonto).addEventListener('input', function() {
    updateAbonoSaldoRestante();
    if (qs('.abono-metodo-btn.active')?.dataset.method === METODO_MIXTO) distributeMixto('abono-mixto-items');
  });
  qsa('.abono-metodo-btn').forEach(btn => {
    btn.addEventListener('click', () => selectAbonoMethod(btn));
  });

  // Theme buttons
  qsa('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => handleThemeClick(btn.dataset.theme));
  });

  // Modal backdrop click
  qsa('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    const activeView = qs('.view.active');
    const viewId = activeView ? activeView.id : '';
    switch (e.key) {
      case 'F1': e.preventDefault(); showView('sales'); break;
      case 'F2': e.preventDefault(); showView('inventory'); break;
      case 'F3': e.preventDefault(); showView('creditos'); break;
      case 'F4': e.preventDefault(); showView('cashier'); break;
      case 'F5': e.preventDefault(); showView('audit'); break;
      case 'F6': e.preventDefault(); showView('reports'); break;
      case 'F7': e.preventDefault(); showView('config'); break;
      case 'F8':
        e.preventDefault();
        if (viewId === 'view-sales') qs(SEL.productSearch).focus();
        else if (viewId === 'view-inventory') qs(SEL.inventorySearch).focus();
        break;
      case 'F12':
        e.preventDefault();
        if (cart.length > 0) openPaymentModal();
        break;
      case 'Escape':
        e.preventDefault();
        qsa('.modal').forEach(m => closeModal(m));
        break;
    }
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      if (viewId === 'view-inventory') openNewProductModal();
    }
  });

  // Sound config
  const soundToggle = qs(SEL.soundToggle);
  const soundVolumeRange = qs(SEL.soundVolume);
  if (soundToggle) {
    soundToggle.addEventListener('change', function() {
      soundEnabled = this.checked;
      setUserConfig(CFG_SONIDO_HABILITADO, this.checked ? SOUND_ENABLED : SOUND_DISABLED).catch(e => showToast('Error al guardar configuración de sonido', 'error'));
    });
  }
  if (soundVolumeRange) {
    soundVolumeRange.addEventListener('input', function() {
      soundVolume = parseInt(this.value) / 100;
      setUserConfig(CFG_SONIDO_VOLUMEN, String(this.value)).catch(e => showToast('Error al guardar configuración de sonido', 'error'));
    });
  }
  const sidebarToggle = qs(SEL.sidebarAutoHideToggle);
  if (sidebarToggle) {
    if (IS_ANDROID) {
      sidebarToggle.closest('.config-row').style.display = 'none';
    } else {
      sidebarToggle.addEventListener('change', function() {
        setSidebarAutoHide(this.checked);
        setUserConfig(CFG_SIDEBAR_AUTO_HIDE, this.checked ? 'true' : 'false').catch(e => showToast('Error al guardar configuración', 'error'));
      });
    }
  }

  // Confirmar venta toggle
  const confirmarToggle = qs('#confirmar-venta-toggle');
  if (confirmarToggle) {
    confirmarToggle.addEventListener('change', function() {
      setUserConfig(CFG_CONFIRMAR_VENTA, this.checked ? '1' : '0').catch(e => showToast('Error al guardar configuración', 'error'));
    });
  }

  // Fullscreen toggle
  const fullscreenToggle = qs(SEL.fullscreenToggle);
  if (fullscreenToggle) {
    fullscreenToggle.addEventListener('change', function() {
      toggleFullscreen();
    });
    document.addEventListener('fullscreenchange', function() {
      fullscreenToggle.checked = !!document.fullscreenElement;
    });
  }

  // Font size controls
  const fontIncBtn = qs(SEL.fontIncBtn);
  const fontDecBtn = qs(SEL.fontDecBtn);
  if (fontIncBtn) {
    fontIncBtn.addEventListener('click', function() {
      applyFontSize(currentFontPct + 5);
      saveFontSize(currentFontPct);
    });
  }
  if (fontDecBtn) {
    fontDecBtn.addEventListener('click', function() {
      applyFontSize(currentFontPct - 5);
      saveFontSize(currentFontPct);
    });
  }
  loadFontSize();

  // Coma automática
  const comaToggle = qs(SEL.comaAutomaticaToggle);
  function updatePrecioInputType() {
    const input = qs(SEL.productPrecio);
    if (comaAutomaticaEnabled) {
      input.type = 'text';
      input.inputMode = 'decimal';
    } else {
      input.type = 'number';
      input.step = 'any';
    }
  }
  if (comaToggle) {
    comaToggle.addEventListener('change', async function() {
      comaAutomaticaEnabled = this.checked;
      updatePrecioInputType();
      try { await setUserConfig(CFG_COMA_AUTOMATICA, this.checked ? '1' : '0'); } catch (e) {}
    });
  }
  const vueltoToggle = qs(SEL.calcularVueltoToggle);
  if (vueltoToggle) {
    vueltoToggle.addEventListener('change', async function() {
      calcularVuelto = this.checked;
      try { await setUserConfig(CFG_CALCULAR_VUELTO, this.checked ? '1' : '0'); } catch (e) {}
    });
  }
  const redondeoToggle = qs(SEL.redondeoBsToggle);
  if (redondeoToggle) {
    redondeoToggle.addEventListener('change', async function() {
      redondeoBs = this.checked;
      try { await setUserConfig(CFG_REDONDEO_BS, this.checked ? '1' : '0'); } catch (e) {}
    });
  }

  // Load saved sound config
  try {
    const savedSound = await getUserConfig(CFG_SONIDO_HABILITADO);
    if (savedSound !== null && savedSound !== undefined) {
      soundEnabled = savedSound === SOUND_ENABLED || savedSound === true;
      if (soundToggle) soundToggle.checked = soundEnabled;
    }
    const savedVol = await getUserConfig(CFG_SONIDO_VOLUMEN);
    if (savedVol !== null && savedVol !== undefined) {
      soundVolume = parseInt(savedVol) / 100 || 0.5;
      if (soundVolumeRange) soundVolumeRange.value = soundVolume * 100;
    }
  } catch (e) {}

  // Load coma automática config
  try {
    const savedComa = await getUserConfig(CFG_COMA_AUTOMATICA);
    comaAutomaticaEnabled = savedComa === '1' || savedComa === true;
    if (comaToggle) comaToggle.checked = comaAutomaticaEnabled;
    updatePrecioInputType();
  } catch (e) {}

  // Load calcular vuelto config
  try {
    const savedVuelto = await getUserConfig(CFG_CALCULAR_VUELTO);
    calcularVuelto = savedVuelto !== '0';
    if (vueltoToggle) vueltoToggle.checked = calcularVuelto;
  } catch (e) {}

  // Load redondeo Bs config
  try {
    const savedRedondeo = await getUserConfig(CFG_REDONDEO_BS);
    redondeoBs = savedRedondeo === '1' || savedRedondeo === true;
    if (redondeoToggle) redondeoToggle.checked = redondeoBs;
  } catch (e) {}

  // Load saved theme on startup
  try {
    const savedTheme = await getUserConfig(CFG_TEMA);
    if (savedTheme) applyTheme(savedTheme);
  } catch (e) {}

  // Load confirmar venta config
  try {
    const val = await getUserConfig(CFG_CONFIRMAR_VENTA);
    const toggle = qs('#confirmar-venta-toggle');
    if (toggle) toggle.checked = val === '1';
  } catch (e) {}

  // Load history cleanup config
  try {
    const days = await invoke('get_config_value', { key: CFG_HISTORIAL_LIMPIEZA_DIAS });
    const input = qs(SEL.historialLimpiezaDias);
    if (input) {
      input.value = parseInt(days) || 0;
      updateHistoryCleanupStatus(parseInt(days) || 0);
    }
  } catch (e) {}
  const histSaveBtn = qs(SEL.historialLimpiezaSave);
  if (histSaveBtn) {
    histSaveBtn.addEventListener('click', async () => {
      const input = qs(SEL.historialLimpiezaDias);
      let val = parseInt(input.value);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 365) val = 365;
      input.value = val;
      try {
        await invoke('set_config_value', { key: CFG_HISTORIAL_LIMPIEZA_DIAS, value: String(val) });
        updateHistoryCleanupStatus(val);
        showToast('Configuraci\u00f3n guardada');
      } catch (e) { showToast('Error: ' + e, 'error'); }
    });
  }

  // Manual clear history buttons
  for (const btn of [qs('#audit-clear-btn'), qs('#audit-clear-config-btn')]) {
    if (btn) {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('\u00bfEliminar todo el historial de auditor\u00eda? Esta acci\u00f3n no se puede deshacer.', 'Limpiar Historial', 'Eliminar todo');
        if (!ok) return;
        try {
          await invoke('clear_audit');
          showToast('Historial eliminado');
          playSound('remove');
          qs(SEL.auditBody).innerHTML = emptyState('<i class="nf nf-fa-history"></i>', 'Historial vac\u00edo', 'No hay registros de auditor\u00eda');
          qs(SEL.auditLoadMore).classList.add('hidden');
        } catch (e) { showToast('Error: ' + e, 'error'); }
      });
    }
  }

  // Ensure sales panels are visible on desktop
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
      document.querySelectorAll('.sales-left, .sales-center').forEach(el => el.style.display = '');
    }
  });

  // Audit load more
  qs(SEL.auditLoadMore).addEventListener('click', loadAuditMore);

  // Restore remembered username
  const savedUser = localStorage.getItem('recordar_usuario');
  if (savedUser) {
    qs(SEL.loginUsername).value = savedUser;
    qs(SEL.rememberMe).checked = true;
    qs(SEL.loginPassword).focus();
  }

  // Mobile lifecycle
  window.addEventListener('tauri://focus', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });
  window.addEventListener('tauri://blur', () => {});

  // Mobile keyboard: push content up when keyboard opens
  if (window.visualViewport) {
    var _prevVpHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', function() {
      var diff = _prevVpHeight - window.visualViewport.height;
      var main = qs(SEL.mainApp);
      if (!main) return;
      if (diff > 100) {
        // Keyboard opened
        var view = document.querySelector('.view.active');
        if (view) view.classList.add('mobile-keyboard');
        var el = document.activeElement;
        if (el) {
          setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
        main.style.paddingBottom = (diff - 40) + 'px';
      } else if (diff < -100) {
        // Keyboard closed
        var view2 = document.querySelector('.view.active');
        if (view2) view2.classList.remove('mobile-keyboard');
        main.style.paddingBottom = '';
        window.scrollTo(0, 0);
      }
      _prevVpHeight = window.visualViewport.height;
    });
  }
});
