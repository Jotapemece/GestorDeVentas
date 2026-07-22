const invoke = window.__TAURI__.core.invoke;

const IS_ANDROID = navigator.userAgent.includes('Android');

/* ========== CONSTANTS ========== */
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
const CFG_ANIMACIONES = 'animaciones_habilitadas';
const CFG_IA_HABILITADO = 'ia_habilitado';
const CFG_OPENROUTER_API_KEY = 'openrouter_api_key';
const CFG_OPENROUTER_MODEL = 'openrouter_model';
const CFG_TASA_DOLAR = 'tasa_dolar';
const CFG_DISPOSITIVO_ID = 'dispositivo_id';

// Payment method keys (deben coincidir con constants.rs)
const METODO_EFECTIVO_BS = 'efectivo_bs';
const METODO_EFECTIVO_USD = 'efectivo_usd';
const METODO_BIOPAGO = 'biopago';
const METODO_PUNTO = 'punto';
const METODO_PAGO_MOVIL = 'pago_movil';
const METODO_CREDITO = 'credito';
const METODO_MIXTO = 'mixto';
const ROL_ADMIN = 'admin';

// Config keys (db::configuracion.clave) — back-end sync
const CFG_SUPABASE_URL = 'supabase_url';
const CFG_SUPABASE_KEY = 'supabase_key';
const CFG_SYNC_AUTO_INTERVAL = 'sync_auto_interval';

// UI Timing & Layout Constants
const TOAST = { DURATION: 3000, FADE_MS: 300 };
const KEYBOARD = { THRESHOLD: 100, PAD_OFFSET: 40, SCROLL_DELAY_MS: 300 };
const SIDEBAR = { HIDE_DELAY: 250, HOVER_MARGIN: 14, HOVER_CHECK_MS: 350 };
const DROPDOWN = { MIN_PADDING: 4 };
const FONT = { SIZE_STEP: 5, SIZE_MIN: 75, SIZE_MAX: 150, SIZE_DEFAULT: 100 };
const BREAKPOINT = { DESKTOP: 768, MOBILE: 500 };

// Chart Constants
const CHART = {
  COLORS: ['#6C63AC', '#A8D5BA', '#F5B7B1', '#85C1E9', '#F9E79F', '#D7BDE2', '#A3E4D7', '#F5CBA7', '#AED6F1', '#ABEBC6'],
  BAR_HEIGHT: 280,
  BAR_HEIGHT_MOBILE: 240,
  CANVAS_MAX_WIDTH: 600,
  BAR_ANIM_MS: 600,
  PIE_ANIM_MS: 500,
  CANVAS_WIDTH: 260,
  CANVAS_HEIGHT: 200,
  CENTER_X: 90,
  CENTER_Y: 100,
  RADIUS: 72,
  LEGEND_X: 175,
  LEGEND_Y_START: 10,
  LEGEND_LINE_HEIGHT: 18,
};

// Print Constants
const PRINT = {
  WIDTH: 700,
  HEIGHT: 500,
  FRAME_CSS: 'position:fixed;top:-9999px;left:-9999px;width:700px;height:500px;border:none;',
};

// Sync Constants
const SYNC = {
  AUTO_MIN: 30,
  AUTO_MAX: 480,
  SALE_DEBOUNCE_MS: 10 * 60 * 1000,
};

// General Constants
const PRODUCT_CACHE_PAGE_SIZE = 5000;
const MIN_PASSWORD_LEN = 6;
const HISTORIAL_MAX_DAYS = 365;
const START_OF_DAY_SUFFIX = ' 00:00:00';
const END_OF_DAY_SUFFIX = ' 23:59:59';
const SEARCH_DEBOUNCE_MS = 200;
const AUDIT_LIMIT_DEFAULT = 50;
const INVENTORY_PAGE_SIZE = 50;
const PAGO_MOVIL_REF_LEN = 4;
const SOUND_ENABLED = '1';
const SOUND_DISABLED = '0';

const ICON = {
  UNLOCK: '<i class="nf nf-fa-unlock"></i>',
  LOCK: '<i class="nf nf-fa-lock"></i>',
  FILE_TEXT: '<i class="nf nf-fa-file_text"></i>',
  EYE: '<i class="nf nf-fa-eye"></i>',
  EYE_SLASH: '<i class="nf nf-fa-eye_slash"></i>',
};

/* ========== HELPERS ========== */
function cssVar(name, fallback = '') {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (val || '').trim() || fallback;
}
async function tryCatch(fn, errorMsg = 'Error') {
  try { return await fn(); } catch (e) { showToast(errorMsg + ': ' + e, 'error'); }
}
function renderTableRows(tbody, data, rowFn) {
  const frag = document.createDocumentFragment();
  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = rowFn(item);
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

async function getUserConfig(key) {
  return invoke('get_user_config_value', { key });
}
async function setUserConfig(key, value) {
  return invoke('set_user_config_value', { key, value });
}

async function loadToggleConfig(key, defaultValue = false) {
  try {
    const val = await getUserConfig(key);
    return val === '1';
  } catch (e) { return defaultValue; }
}

function setCustomSelectValue(wrap, value) {
  if (!wrap) return;
  var btn = wrap.querySelector('.custom-select-btn');
  var valSpan = wrap.querySelector('.custom-select-value');
  var menu = wrap.querySelector('.custom-select-menu');
  if (!menu) return;
  var options = menu.querySelectorAll('button');
  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    if (opt.dataset.value === value) {
      opt.classList.add('selected');
      if (valSpan) valSpan.textContent = opt.textContent;
    } else {
      opt.classList.remove('selected');
    }
  }
  wrap.dataset.value = value;
  if (btn) btn.dataset.value = value;
}

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

  // --- Device Registration ---
  deviceRegScreen: '#device-reg-screen',
  regDeviceBtn: '#reg-device-btn',
  regPending: '#reg-pending',
  regSuccess: '#reg-success',
  regError: '#reg-error',

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
  productStockMinimo: '#product-stock-minimo',
  productCosto: '#product-costo',
  productDetailModal: '#product-detail-modal',
  detailNombre: '#detail-nombre',
  detailPrecio: '#detail-precio',
  detailCosto: '#detail-costo',
  detailMargen: '#detail-margen',
  detailStock: '#detail-stock',
  detailStockMinimo: '#detail-stock-minimo',
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
  animationsToggle: '#animations-toggle',
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
  reportTotalCosto: '#report-total-costo',
  reportTotalGanancia: '#report-total-ganancia',
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
  viewDeviceIdBtn: '#view-device-id-btn',
  deviceIdDisplay: '#device-id-display',
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

  // --- Calculator ---
  calcModal: '#calculator-modal',
  calcExpression: '#calc-expression',
  calcResult: '#calc-result',
  calcLastResult: '#calc-last-result',
  calcHistoryPrev: '#calc-history-prev',
  calcHistoryNext: '#calc-history-next',
  calcTasaBtn: '#calc-tasa-btn',
  calcBtn: '#calc-btn',
  calcClose: '#calculator-close',
  calcEquals: '#calc-equals',

  // --- Guide ---
  guideModal: '#guide-modal',
  guideBtn: '#guide-btn',
  guideClose: '#guide-close',
  guideTabs: '.guide-tab',
  guidePages: '.guide-page',

  // --- Linked Devices ---
  linkedDevicesContainer: '#linked-devices-container',

  // --- OpenRouter / Sugerencias ---
  openrouterApiKey: '#openrouter-api-key',
  openrouterSaveKeyBtn: '#openrouter-save-key-btn',
  openrouterModelWrap: '#openrouter-model-wrap',
  openrouterModelBtn: '#openrouter-model-btn',
  openrouterModelValue: '#openrouter-model-value',
  openrouterModelMenu: '#openrouter-model-menu',
  generateOrderBtn: '#generate-order-btn',
  suggestionModal: '#suggestion-modal',
  suggestionContent: '#suggestion-content',
  suggestionCopyBtn: '#suggestion-copy-btn',
  suggestionModalClose: '#suggestion-modal-close',
  suggestionCloseBtn: '#suggestion-close-btn',

  // --- Chat IA ---
  chatFab: '#chat-fab',
  chatPanel: '#chat-panel',
  chatCloseBtn: '#chat-close-btn',
  chatMessages: '#chat-messages',
  chatInput: '#chat-input',
  chatSendBtn: '#chat-send-btn',
  chatThinking: '#chat-thinking',
  chatExpandBtn: '#chat-expand-btn',

  // --- Mobile ---
  moreBtn: '#more-btn',
  moreMenu: '#more-menu',
  moreWrap: '#more-wrap',

  // --- Misc missing ---
  sidebar: '#sidebar',
  syncAutoInterval: '#sync-auto-interval',
  viewCashier: '#view-cashier',
  cartCurrencyToggle: '#cart-currency-toggle',
  restoreBackupBtn: '#restore-backup-btn',
  showBackupKeyBtn: '#show-backup-key-btn',
  refreshDevicesBtn: '#refresh-devices-btn',
  confirmarVentaToggle: '#confirmar-venta-toggle',
  iaToggle: '#ia-toggle',
  auditClearBtn: '#audit-clear-btn',
  auditClearConfigBtn: '#audit-clear-config-btn',
  clockHour: '#clock-hour',
  clockMinute: '#clock-minute',
  clockSecond: '#clock-second',
};

/* ========== CALCULATOR ========== */
const MAX_CALC_HISTORY = 25;
const calcState = { expr: '', result: '0', memory: null, op: null, reset: false, history: [], historyIdx: -1, historyDate: '' };

function initCalculator() {
  if (IS_ANDROID) return;
  qs(SEL.calcBtn).style.display = '';
  qs(SEL.calcBtn).addEventListener('click', openCalculator);
  qs(SEL.calcClose).addEventListener('click', closeCalculator);
  document.querySelectorAll('[data-calc]').forEach(btn => btn.addEventListener('click', () => calcInput(btn.dataset.calc)));
  qs(SEL.calcEquals).addEventListener('click', calcEquals);
  qs(SEL.calcHistoryPrev).addEventListener('click', calcHistoryGo.bind(null, -1));
  qs(SEL.calcHistoryNext).addEventListener('click', calcHistoryGo.bind(null, 1));
  qs(SEL.calcTasaBtn).addEventListener('click', calcInsertTasa);
  document.addEventListener('keydown', calcKeydown);
}

function openCalculator() {
  showModal(qs(SEL.calcModal));
  const today = new Date().toDateString();
  if (calcState.historyDate !== today) { calcState.history = []; calcState.historyIdx = -1; calcState.historyDate = today; }
  calcRender();
  calcRenderLastResult();
  setTimeout(() => qs(SEL.calcModal).querySelector('.calc-buttons').focus(), 100);
}

function closeCalculator() { closeModal(qs(SEL.calcModal)); }

function calcInput(val) {
  if (val === 'clear') { calcState.expr = ''; calcState.result = '0'; calcState.memory = null; calcState.op = null; calcState.reset = false; calcRender(); return; }
  if (val === 'backspace') { calcState.expr = calcState.expr.slice(0, -1); calcRender(); return; }
  if (val === 'negate') {
    if (calcState.expr && !isNaN(parseFloat(calcState.expr))) {
      if (calcState.expr.startsWith('-')) calcState.expr = calcState.expr.slice(1); else calcState.expr = '-' + calcState.expr;
      calcRender();
    }
    return;
  }
  if (val === 'percent') {
    const n = parseFloat(calcState.expr);
    if (!isNaN(n)) { calcState.expr = String(n / 100); calcRender(); }
    return;
  }
  if (['add', 'subtract', 'multiply', 'divide'].includes(val)) {
    const opMap = { add: '+', subtract: '-', multiply: '*', divide: '/' };
    if (calcState.expr && calcState.memory !== null && calcState.op) {
      calcState.expr = String(eval(`${calcState.memory} ${calcState.op} ${parseFloat(calcState.expr) || 0}`));
    }
    calcState.memory = parseFloat(calcState.expr) || 0;
    calcState.op = opMap[val];
    calcState.expr += [' + ', ' − ', ' × ', ' ÷ '][['add', 'subtract', 'multiply', 'divide'].indexOf(val)];
    calcState.reset = true;
    calcRender();
    return;
  }
  if (val === 'dot') { if (!calcState.expr.includes('.')) calcState.expr += '.'; calcRender(); return; }
  if (calcState.reset && val !== 'dot') { calcState.expr = ''; calcState.reset = false; }
  calcState.expr += val;
  calcRender();
}

function calcEquals() {
  const ops = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b };
  if (!calcState.op || calcState.memory === null) return;
  const right = parseFloat(calcState.expr.split(' ').pop()) || 0;
  if (calcState.op === '/' && right === 0) { calcState.result = 'Error'; calcRender(); return; }
  const result = ops[calcState.op](calcState.memory, right);
  const prevExpr = calcState.expr;
  calcState.result = String(Math.round(result * 1e10) / 1e10);
  calcState.expr = calcState.result;
  calcState.memory = null;
  calcState.op = null;
  calcState.reset = true;
  const today = new Date().toDateString();
  if (calcState.historyDate !== today) { calcState.history = []; calcState.historyIdx = -1; calcState.historyDate = today; }
  calcState.history.push({ expr: prevExpr, result: calcState.result });
  if (calcState.history.length > MAX_CALC_HISTORY) calcState.history.shift();
  calcState.historyIdx = calcState.history.length;
  calcRenderLastResult();
  calcRender();
}

function calcHistoryGo(dir) { if (calcState.history.length === 0) return; calcState.historyIdx = Math.max(0, Math.min(calcState.history.length - 1, (calcState.historyIdx === -1 ? (dir > 0 ? 0 : calcState.history.length - 1) : calcState.historyIdx + dir))); const h = calcState.history[calcState.historyIdx]; if (h) { calcState.expr = h.expr; calcState.result = h.result; calcRender(); } }

function calcInsertTasa() {
  if (tasaActual && tasaActual > 0) {
    if (calcState.expr === '0' || calcState.expr === '' || calcState.reset) { calcState.expr = ''; calcState.reset = false; }
    calcState.expr += tasaActual.toString();
    calcRender();
  } else showToast('No hay tasa disponible', 'error');
}

function calcRender() { qs(SEL.calcExpression).textContent = calcState.expr || ''; qs(SEL.calcResult).textContent = calcState.result; }

function calcRenderLastResult() {
  const el = qs(SEL.calcLastResult);
  if (calcState.history.length === 0) { el.textContent = ''; return; }
  const last = calcState.history[calcState.history.length - 1];
  el.textContent = last.expr + ' = ' + last.result;
}

function calcKeydown(e) {
  const modal = qs(SEL.calcModal);
  if (modal.classList.contains('hidden')) return;
  if (e.key >= '0' && e.key <= '9') { calcInput(e.key); e.preventDefault(); }
  else if (e.key === '.') { calcInput('dot'); e.preventDefault(); }
  else if (e.key === '+') { calcInput('add'); e.preventDefault(); }
  else if (e.key === '-') { calcInput('subtract'); e.preventDefault(); }
  else if (e.key === '*') { calcInput('multiply'); e.preventDefault(); }
  else if (e.key === '/') { calcInput('divide'); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === '=') { calcEquals(); e.preventDefault(); }
  else if (e.key === 'Backspace') { calcInput('backspace'); e.preventDefault(); }
  else if (e.key === 'Escape') { closeCalculator(); e.preventDefault(); }
  else if (e.key === 'c' || e.key === 'C') { calcInput('clear'); e.preventDefault(); }
}

/* ========== GUIDE ========== */
function initGuide() {
  qs(SEL.guideBtn).addEventListener('click', openGuide);
  qs(SEL.guideClose).addEventListener('click', closeGuide);
  qsa(SEL.guideTabs).forEach(tab => tab.addEventListener('click', () => switchGuideTab(tab.dataset.section)));
}

function openGuide() {
  showModal(qs(SEL.guideModal));
  const active = qs('.guide-tab.active');
  if (!active) switchGuideTab('ventas');
}

function closeGuide() { closeModal(qs(SEL.guideModal)); }

function switchGuideTab(section) {
  qsa(SEL.guideTabs).forEach(t => t.classList.remove('active'));
  qsa(SEL.guidePages).forEach(p => p.classList.remove('active'));
  qs(`.guide-tab[data-section="${section}"]`).classList.add('active');
  qs(`#guide-${section}`).classList.add('active');
}

/* ========== CLOCK ========== */
function startClock() {
  const hourHand = qs(SEL.clockHour);
  const minuteHand = qs(SEL.clockMinute);
  const secondHand = qs(SEL.clockSecond);
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

function initSidebarAutoHide() {
  if (IS_ANDROID) return;
  const sidebar = qs(SEL.sidebar);
  const mainApp = qs(SEL.mainApp);
  if (!sidebar || !mainApp) return;

  let lastMouseX = -1, lastMouseY = -1;

  document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (!sidebarAutoHideEnabled) return;
    if (e.clientX <= SIDEBAR.HOVER_MARGIN) {
      clearTimeout(sidebarHideTimeout);
      sidebarHideTimeout = null;
      mainApp.classList.remove('sidebar-hidden');
      setTimeout(checkSidebarHover, SIDEBAR.HOVER_CHECK_MS);
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
      }, SIDEBAR.HIDE_DELAY);
    }
  }
}

function setSidebarAutoHide(enabled) {
  if (IS_ANDROID) return;
  sidebarAutoHideEnabled = enabled;
  const mainApp = qs(SEL.mainApp);
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
    const toggle = qs(SEL.sidebarAutoHideToggle);
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
  const code = escapeHtml(item.codigo);
  const totalUsd = item.cantidad * item.precio_usd;
  const totalBs = totalUsd * tasaActual;
  const showBs = cartShowBs;
  const totalText = showBs ? formatBS(totalBs) : formatUSD(totalUsd);
  const cls = 'cart-item-total' + (showBs ? ' bs-mode' : '');
  return '<td><div class="cart-product-info"><span class="cart-product-name" title="' + name + '">' + name + '</span><span class="cart-product-code">' + code + '</span></div></td><td><div class="cart-qty-wrap"><button class="cart-qty-btn" data-action="qty-dec" data-codigo="' + code + '">&minus;</button><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="1" max="' + item.stock + '" data-codigo="' + code + '"><button class="cart-qty-btn" data-action="qty-inc" data-codigo="' + code + '">+</button></div></td><td class="' + cls + '">' + totalText + '</td><td><button class="cart-remove-btn" data-action="remove-from-cart" data-codigo="' + code + '" title="Eliminar"><i class="nf nf-fa-trash"></i></button></td>';
}
function createInventoryRow(p, editBtn) {
  var stockClass = (p.stock < p.stock_minimo) ? ' class="low-stock"' : '';
  var stockBadge = (p.stock < p.stock_minimo) ? '<span class="badge badge-danger" title="Debajo del stock mínimo">!</span>' : '';
  var costo = p.costo || 0;
  var margen = (costo > 0 && p.precio_usd > 0) ? ((p.precio_usd - costo) / p.precio_usd * 100).toFixed(1) + '%' : '—';
  return '<td>' + escapeHtml(p.nombre) + '</td><td>' + formatUSD(p.precio_usd) + '</td><td>' + formatUSD(costo) + '</td><td>' + margen + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td' + stockClass + '>' + p.stock + ' ' + stockBadge + '</td><td>' + p.stock_minimo + '</td><td><div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones">&ctdot;</button><div class="dropdown-menu"><button data-action="show-product-detail" data-codigo="' + escapeHtml(p.codigo) + '"><i class="nf nf-fa-info_circle"></i> Detalles</button><button data-action="show-product-history" data-codigo="' + escapeHtml(p.codigo) + '" data-nombre="' + escapeHtml(p.nombre) + '"><i class="nf nf-fa-history"></i> Historial</button>' + editBtn + '</div></div></td>';
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
  var costoTotal = 0;
  if (v.productos) {
    v.productos.forEach(function(d) { costoTotal += (d.costo || 0) * d.cantidad; });
  }
  var ganancia = v.venta.total_usd - costoTotal;
  return '<td>' + v.venta.id + '</td><td>' + escapeHtml(v.venta.fecha_hora) + '</td><td>' + escapeHtml(v.venta.username) + '</td><td>' + escapeHtml(metodoLabel) + '</td><td>' + prodCount + '</td><td>' + formatUSD(v.venta.total_usd) + '</td><td>' + formatUSD(costoTotal) + '</td><td>' + formatUSD(Math.max(0, ganancia)) + '</td><td>' + formatBS(v.venta.total_bs) + badge + '</td>';
}

const TPL_CLOSE_REPORT_STYLE = 'body{font-family:monospace;font-size:12px;padding:24px}h2{text-align:center;margin-bottom:4px}h4{margin:12px 0 4px;border-bottom:1px solid #000}table{width:100%;border-collapse:collapse;margin:4px 0}th,td{padding:3px 6px;text-align:left;border-bottom:1px solid #ccc}th{border-bottom:2px solid #000}.total{font-weight:700;text-align:right;margin-top:4px}';

let currentUser = null;
let cart = [];
let tasaActual = 0;
let cartShowBs = false;
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
  setTimeout(() => { el.classList.add('hidden'); el.classList.remove('fade-out'); el._closing = false; }, TOAST.FADE_MS);
}

function showToast(msg, type = 'success') {
  const t = qs(SEL.toast);
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.classList.remove('hidden', 'fade-out');
  t._closing = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => hideToast(t), TOAST.DURATION);
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
function forcePaint() {
  void document.body.offsetHeight;
  return new Promise(r => setTimeout(r, 0));
}
function showLoading(el) {
  el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
}
function showLoadingModal(text) {
  var el = qs(SEL.loadingModal);
  qs(SEL.loadingText).textContent = text || 'Cargando...';
  el.classList.remove('hidden');
  void el.offsetHeight;
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
  obs.observe(modal, { attributes: true, attributeFilter: ['class']   });
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
async function loadLinkedDevices() {
  const container = qs(SEL.linkedDevicesContainer);
  if (!container) return;
  container.innerHTML = '<p class="text-muted text-sm">Cargando...</p>';
  try {
    const devices = await invoke('list_dispositivos');
    if (!devices || devices.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm">No hay dispositivos vinculados.</p>';
      return;
    }
    let html = '<div style="display:flex;flex-direction:column;gap:8px">';
    for (const d of devices) {
      const nombre = d.nombre || 'Sin nombre';
      const id = d.id || '';
      const created = d.created_at || '';
      const shortId = id.length > 8 ? id.substring(0, 8) + '...' : id;
      const isPhone = nombre === 'Tel\u00e9fono' || nombre.includes('Tel\u00e9fono') || nombre.includes('Android');
      const icon = isPhone ? 'nf-fa-mobile' : 'nf-fa-display';
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card-alt);border-radius:8px;border:1px solid var(--border)">' +
        '<i class="nf ' + icon + '" style="font-size:20px;color:var(--primary)"></i>' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;font-size:14px;color:var(--text)">' + escapeHtml(nombre) + '</div>' +
        '<div style="font-size:11px;color:var(--text-light);word-break:break-all">ID: ' + escapeHtml(shortId) + '</div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-secondary);text-align:right">' +
        '<div>Registrado</div>' +
        '<div>' + escapeHtml(created) + '</div>' +
        '</div>' +
        '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = '<p class="text-muted text-sm" style="color:var(--danger)">Error: ' + escapeHtml(e) + '</p>';
  }
}
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
  const input = qs(SEL.syncAutoInterval);
  if (!input) return;
  invoke('get_config_value', { key: CFG_SYNC_AUTO_INTERVAL }).then(val => {
    const minutes = parseInt(val) || 30;
    input.value = Math.max(SYNC.AUTO_MIN, Math.min(SYNC.AUTO_MAX, minutes));
    startSyncAutoInterval(minutes);
  }).catch(() => {});
  input.addEventListener('change', () => {
    let minutes = parseInt(input.value) || 30;
    minutes = Math.max(SYNC.AUTO_MIN, Math.min(SYNC.AUTO_MAX, minutes));
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
  }, SYNC.SALE_DEBOUNCE_MS);
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
    reports: () => { setDefaultReportDates(); },
    config: () => { loadThemeConfig(); loadConflictCount(); },
    sync: () => { loadSyncConfig(); loadConflictCount(); },
  };
  if (loaders[name]) loaders[name]();
  if (name === 'sales') {
    if (!IS_ANDROID) qs(SEL.productSearch).focus();
    renderProductSearch();
    renderCart();
  }
  document.dispatchEvent(new CustomEvent('viewChanged', { detail: name }));
  if (IS_ANDROID) {
    const panel = qs(SEL.chatPanel);
    if (panel && !panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
    }
  }
}

/* ========== AUTH ========== */
async function handleDeviceRegister() {
  const btn = qs(SEL.regDeviceBtn);
  const errEl = qs(SEL.regError);
  btn.disabled = true;
  btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Registrando...';
  errEl.textContent = '';
  try {
    const nombre = IS_ANDROID ? 'Tel\u00e9fono' : 'PC';
    const res = await invoke('register_device', { nombre });
    qs(SEL.regPending).classList.add('hidden');
    qs(SEL.regSuccess).classList.remove('hidden');
    setTimeout(() => {
      qs(SEL.deviceRegScreen).style.display = 'none';
      qs(SEL.loginScreen).style.display = 'flex';
      qs(SEL.loginUsername).focus();
    }, 1500);
  } catch (e) {
    errEl.textContent = 'Error: ' + e;
    btn.disabled = false;
    btn.innerHTML = 'Registrar dispositivo';
  }
}

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
      initCalculator();
      initGuide();
      loadSidebarAutoHideConfig();
      applyRoleUI();
      loadSyncAutoConfig();
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
  qs(SEL.confirmModal).classList.add('transparent-bg');
  const ok = await confirmModal('\u00bfEst\u00e1 seguro de cerrar sesi\u00f3n?', 'Cerrar Sesi\u00f3n', 'Salir');
  qs(SEL.confirmModal).classList.remove('transparent-bg');
  if (!ok) return;
  await tryCatch(() => invoke('logout'), 'Error al cerrar sesi\u00f3n');
  currentUser = null; cart = []; lastCloseReportData = null;
  qs(SEL.loginPassword).value = '';
  qs(SEL.loginError).textContent = '';
  qs(SEL.loginScreen).style.display = 'flex';
}

/* ========== TASA ========== */
async function loadTasa() {
  try {
    tasaActual = await invoke('get_tasa');
    qs(SEL.tasaInput).value = tasaActual.toFixed(2);
    const updatedAt = await invoke('get_config_value', { key: CFG_TASA_UPDATED_AT });
    const today = new Date().toLocaleDateString('en-CA');
    const warn = qs(SEL.tasaWarning);
    if (warn) warn.style.display = (!updatedAt || updatedAt !== today) ? 'inline' : 'none';
  } catch (e) { showToast('Error al cargar tasa', 'error'); }
}

async function handleTasaChange() {
  const val = parseFloat(qs(SEL.tasaInput).value);
  if (isNaN(val) || val <= 0) {
    qs(SEL.tasaInput).value = tasaActual.toFixed(2);
    showToast('La tasa debe ser mayor a cero', 'error');
    return;
  }
  tasaActual = val;
  qs(SEL.tasaInput).value = tasaActual.toFixed(2);
  await tryCatch(() => invoke('set_tasa', { tasa: tasaActual }), 'Error al guardar la tasa');
  const warn = qs(SEL.tasaWarning);
  if (warn) warn.style.display = 'none';
  updateCartTotals();
  renderProductSearch();
  refreshAllBsPrices();
}

async function fetchTasaBcv() {
  const btn = qs(SEL.tasaFetchBtn);
  const origText = btn.textContent;
  btn.textContent = '...';
  btn.classList.add('loading');
  showLoadingModal('Buscando tasa del BCV...');
  await forcePaint();
  try {
    const rate = await invoke('fetch_tasa_bcv');
    tasaActual = rate;
    await invoke('set_tasa', { tasa: tasaActual });
    qs(SEL.tasaInput).value = tasaActual.toFixed(2);
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
    btn.textContent = origText;
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
    const result = await invoke('list_products', { search: null, page: 1, pageSize: PRODUCT_CACHE_PAGE_SIZE });
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
    /* Share receipt on mobile */
    shareReceipt(venta);
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

async function loadInventory() {
  const query = qs(SEL.inventorySearch).value.trim();
  const tbody = qs(SEL.inventoryBody);
  showLoading(tbody);
  try {
    const result = await invoke('list_products', { search: query || null, page: inventoryPage, pageSize: INVENTORY_PAGE_SIZE });
    const products = result.data || result;
    tbody.innerHTML = '';
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">' + emptyState('<i class="nf nf-fa-archive"></i>', query ? 'Sin resultados' : 'No hay productos', query ? 'Pruebe con otro t\u00e9rmino de b\u00fasqueda' : 'Agregue productos desde el bot\u00f3n superior') + '</td></tr>';
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
    if (window.innerWidth > BREAKPOINT.DESKTOP) {
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
  qs(SEL.detailCosto).textContent = formatUSD(p.costo || 0);
  const margen = (p.costo > 0 && p.precio_usd > 0) ? ((p.precio_usd - p.costo) / p.precio_usd * 100).toFixed(1) + '%' : '—';
  qs(SEL.detailMargen).textContent = margen;
  qs(SEL.detailStock).textContent = p.stock;
  qs(SEL.detailStockMinimo).textContent = p.stock_minimo;
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
  [SEL.productNombre, SEL.productPrecio, SEL.productCosto, SEL.productStock, SEL.productStockMinimo].forEach(id => qs(id).value = '');
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
  qs(SEL.productCosto).value = p.costo || 0;
  qs(SEL.productStock).value = p.stock;
  qs(SEL.productStockMinimo).value = p.stock_minimo;
  qs(SEL.productDeleteBtn).style.display = 'inline-flex';
  showModal(qs(SEL.productModal));
}

function closeProductModal() {
  closeModal(qs(SEL.productModal));
}

async function saveProduct() {
  const codigo = editingProduct || '';
  const nombre = stripEmojis(qs(SEL.productNombre).value.trim());
  const precio = parsePrecio(qs(SEL.productPrecio).value);
  const costo = parsePrecio(qs(SEL.productCosto).value) || 0;
  const stock = parseInt(qs(SEL.productStock).value) || 0;
  const stockMinimo = parseInt(qs(SEL.productStockMinimo).value) || 0;
  if (!nombre || isNaN(precio) || precio < 0) { showToast('Complete todos los campos', 'error'); return; }
  try {
    if (editingProduct) {
      await invoke('update_product', { codigo, nombre, precioUsd: precio, costo, stock });
      await invoke('update_stock_minimo', { codigo, stockMinimo });
    } else {
      await invoke('create_product', { codigo, nombre, precioUsd: precio, costo, stock });
      if (stockMinimo > 0) {
        await invoke('update_stock_minimo', { codigo, stockMinimo });
      }
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
  await tryCatch(async () => {
    const clientes = await invoke('list_clientes');
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    qs(SEL.abonoClienteNombre).textContent = c.nombre;
    qs(SEL.abonoDeudaUsd).textContent = formatUSD(c.saldo_deuda_usd);
    qs(SEL.abonoDeudaBs).textContent = formatBS(c.saldo_deuda_usd * tasaActual);
  });
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
      html += '<canvas id="close-pie-chart" class="chart-canvas" width="' + CHART.CANVAS_WIDTH + '" height="' + CHART.CANVAS_HEIGHT + '"></canvas>';
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
  const cx = CHART.CENTER_X, cy = CHART.CENTER_Y, r = CHART.RADIUS;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cssVar('--card', '#fff');
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
    ctx.fillStyle = CHART.COLORS[i % CHART.COLORS.length];
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
  let ly = CHART.LEGEND_Y_START;
  data.por_metodo.forEach((m, i) => {
    const lx = CHART.LEGEND_X;
    ctx.fillStyle = CHART.COLORS[i % CHART.COLORS.length];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = cssVar('--text', '#333');
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(formatMetodoLabel(m.metodo) + ' ' + formatUSD(m.total_usd), lx + 14, ly);
    ly += CHART.LEGEND_LINE_HEIGHT;
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
    iframe.style.cssText = PRINT.FRAME_CSS;
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
      html += '<canvas id="historial-pie-chart" width="' + CHART.CANVAS_WIDTH + '" height="' + CHART.CANVAS_HEIGHT + '" style="margin:4px auto;display:block;max-width:100%;"></canvas>';
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
    let currentTheme = await getUserConfig(CFG_TEMA);
    if (!currentTheme) {
      try { currentTheme = localStorage.getItem(CFG_TEMA); } catch (_) {}
    }
    const theme = currentTheme || 'claro';
    applyTheme(theme);
    qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  } catch (e) { showToast('Error al cargar tema', 'error'); }
}

const themes = {
  oscuro: { '--bg': '#2A2533', '--card': '#3D364A', '--card-alt': '#4A4258', '--danger': '#6B2E2A', '--danger-dark': '#55201C', '--primary': '#7E6B90', '--primary-dark': '#665478', '--primary-rgb': '126, 107, 144', '--accent': '#4A7C65', '--accent-dark': '#3A6651', '--accent-rgb': '74, 124, 101', '--danger-rgb': '107, 46, 42', '--overlay': 'rgba(0, 0, 0, 0.6)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.3)', '--hover': '#352F44', '--border': '#5A5270', '--text': '#E0D8E8', '--text-light': '#A098B8', '--text-secondary': '#A098B8', '--sidebar-bg': '#1F1A2E', '--sidebar-text': '#C8C0D8', '--sidebar-text-rgb': '200, 192, 216' },
  claro: { '--bg': '#FAFAFA', '--card': '#FFFFFF', '--card-alt': '#F2F2F2', '--danger': '#D97373', '--danger-dark': '#C05555', '--primary': '#6C8EBF', '--primary-dark': '#5070A0', '--primary-rgb': '108, 142, 191', '--accent': '#6BAF8D', '--accent-dark': '#4A8F6D', '--accent-rgb': '107, 175, 141', '--danger-rgb': '217, 115, 115', '--overlay': 'rgba(0, 0, 0, 0.15)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#F5F5F5', '--border': '#DDDDDD', '--text': '#333333', '--text-light': '#777777', '--text-secondary': '#777777', '--sidebar-bg': '#F0F0F0', '--sidebar-text': '#333333', '--sidebar-text-rgb': '51, 51, 51' },
  azul: { '--bg': '#EDF2F7', '--card': '#FFFFFF', '--card-alt': '#F2F6FA', '--danger': '#E8A0A0', '--danger-dark': '#D48888', '--primary': '#7B9EBF', '--primary-dark': '#5A7D9E', '--primary-rgb': '123, 158, 191', '--accent': '#8FC1B5', '--accent-dark': '#6DA89A', '--accent-rgb': '143, 193, 181', '--danger-rgb': '232, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#E2E8F0', '--border': '#CBD5E0', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#2C5282', '--sidebar-text': '#EBF4FF', '--sidebar-text-rgb': '235, 244, 255' },
  verde: { '--bg': '#F0F7F0', '--card': '#FFFFFF', '--card-alt': '#EAF3EA', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#A8C9A8', '--primary-dark': '#8BB08B', '--primary-rgb': '168, 201, 168', '--accent': '#B8DCC8', '--accent-dark': '#9CC8AC', '--accent-rgb': '184, 220, 200', '--danger-rgb': '212, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.15)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#E6F0E6', '--border': '#D0E0D0', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#3A6A3A', '--sidebar-text': '#F0FFF0', '--sidebar-text-rgb': '240, 255, 240' },
  morado: { '--bg': '#F5F0FA', '--card': '#FFFFFF', '--card-alt': '#F0EAF5', '--danger': '#E0A8C0', '--danger-dark': '#CC90A8', '--primary': '#C4B0E0', '--primary-dark': '#B098D4', '--primary-rgb': '196, 176, 224', '--accent': '#D4A8DC', '--accent-dark': '#C090CA', '--accent-rgb': '212, 168, 220', '--danger-rgb': '224, 168, 192', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#F0EAF6', '--border': '#D8CCE8', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#6A4C93', '--sidebar-text': '#F3E5F5', '--sidebar-text-rgb': '243, 229, 245' },
  turquesa: { '--bg': '#E6F7F5', '--card': '#F5FFFE', '--card-alt': '#EAF8F5', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#4DB8AC', '--primary-dark': '#3A9A8E', '--primary-rgb': '77, 184, 172', '--accent': '#80D0C4', '--accent-dark': '#60B8AA', '--accent-rgb': '128, 208, 196', '--danger-rgb': '212, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(26, 74, 68, 0.08)', '--hover': '#E8F5F2', '--border': '#C0E0DA', '--text': '#1A4A44', '--text-light': '#5A7A74', '--text-secondary': '#5A7A74', '--sidebar-bg': '#B0E0D6', '--sidebar-text': '#1A4A44', '--sidebar-text-rgb': '26, 74, 68' },
  naranja: { '--bg': '#FDF0E8', '--card': '#FFF8F0', '--card-alt': '#F5EDE0', '--danger': '#D97050', '--danger-dark': '#C06040', '--primary': '#D47A4A', '--primary-dark': '#C06030', '--primary-rgb': '212, 122, 74', '--accent': '#E8A060', '--accent-dark': '#D48540', '--accent-rgb': '232, 160, 96', '--danger-rgb': '217, 112, 80', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(74, 42, 16, 0.08)', '--hover': '#F8EDE0', '--border': '#E8D0B8', '--text': '#4A2A10', '--text-light': '#8A6A4A', '--text-secondary': '#8A6A4A', '--sidebar-bg': '#F0C8A8', '--sidebar-text': '#5C2A0A', '--sidebar-text-rgb': '92, 42, 10' },
  menta: { '--bg': '#EEF7EE', '--card': '#FFFFFF', '--card-alt': '#E8F5E8', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#6BAF8D', '--primary-dark': '#4A8F6D', '--primary-rgb': '107, 175, 141', '--accent': '#8FC1A8', '--accent-dark': '#6DA88A', '--accent-rgb': '143, 193, 168', '--danger-rgb': '212, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.15)', '--shadow': '0 2px 12px rgba(58, 106, 74, 0.08)', '--hover': '#E6F5E6', '--border': '#D0E0D0', '--text': '#2A3A2A', '--text-light': '#5A7A6A', '--text-secondary': '#5A7A6A', '--sidebar-bg': '#B0D0B8', '--sidebar-text': '#2A4A3A', '--sidebar-text-rgb': '42, 74, 58' }
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

/* Share receipt via Web Share API */
function shareReceipt(venta) {
  if (!IS_ANDROID || !navigator.share) return;
  var items = venta.detalles || [];
  var lines = items.map(function(d) { return d.cantidad + 'x ' + d.nombre + ' = ' + formatUSD(d.subtotal); });
  var text = 'Venta #' + venta.id + '\n' +
    'Total: ' + formatUSD(venta.total_usd) + ' / ' + formatBS(venta.total_bs) + '\n' +
    'Método: ' + formatMetodoLabel(venta.metodo_pago) + '\n' +
    '---\n' + lines.join('\n') + '\n---\n' +
    'Gracias por su compra!';
  navigator.share({ title: 'Venta #' + venta.id, text: text }).catch(function() {});
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
  if (password.length < MIN_PASSWORD_LEN) { showToast(`La contrase\u00f1a debe tener al menos ${MIN_PASSWORD_LEN} caracteres`, 'error'); return; }
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
  if (newPwd.length < MIN_PASSWORD_LEN) { showToast(`La contrase\u00f1a debe tener al menos ${MIN_PASSWORD_LEN} caracteres`, 'error'); return; }
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
      start_date: startDate + START_OF_DAY_SUFFIX,
      end_date: endDate + END_OF_DAY_SUFFIX,
      producto_codigo: qs(SEL.reportProductFilter).value.trim() || null,
      username: qs(SEL.reportVendorFilter).value.trim() || null,
    };
    const result = await invoke('get_sales_report', { filter });
    qs(SEL.reportTotalCount).textContent = result.total_ventas;
    qs(SEL.reportTotalUsd).textContent = formatUSD(result.total_usd);
    qs(SEL.reportTotalCosto).textContent = formatUSD(result.total_costo_usd || 0);
    qs(SEL.reportTotalGanancia).textContent = formatUSD(result.total_ganancia_usd || 0);
    qs(SEL.reportTotalBs).textContent = formatBS(result.total_bs);

    const tbody = qs(SEL.reportSalesBody);
    tbody.innerHTML = '';
    if (!result.ventas || result.ventas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">' + emptyState('<i class="nf nf-fa-bar_chart"></i>', 'Sin ventas en el per\u00edodo', '') + '</td></tr>';
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
      startDate: startDate + START_OF_DAY_SUFFIX,
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
      paymentMethods = await tryCatch(() => invoke('get_dashboard_payment_methods', { period: piePeriod }));
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
          '<button class="btn btn-sm ' + (dashboardChartType === 'line' ? 'btn-primary' : 'btn-outline') + '" data-chart="line"><i class="nf nf-fa-line_chart"></i> Ganancias</button>' +
        '</div>' +
        '<div class="dashboard-chart-container"><canvas id="dashboard-canvas" width="' + CHART.CANVAS_MAX_WIDTH + '" height="' + CHART.BAR_HEIGHT + '"></canvas></div>' +
        '<div class="dashboard-grid">' +
          periods.map(function(p) {
            var d = data[p.key];
            return '<div class="dashboard-period" style="border-left: 4px solid ' + p.color + '">' +
              '<div class="dashboard-period-title"><i class="nf nf-fa-' + p.icon + '"></i> ' + p.label + '</div>' +
              '<div class="dashboard-stat"><span>Ventas</span><strong>' + d.total_ventas + '</strong></div>' +
              '<div class="dashboard-stat"><span>Total USD</span><strong>' + formatUSD(d.total_usd) + '</strong></div>' +
              '<div class="dashboard-stat"><span>Costo</span><strong>' + formatUSD(d.total_costo_usd || 0) + '</strong></div>' +
              '<div class="dashboard-stat"><span>Ganancia</span><strong>' + formatUSD(d.total_ganancia_usd || 0) + '</strong></div>' +
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
    } else if (dashboardChartType === 'line') {
      requestAnimationFrame(function() { drawProfitLineChart(body); });
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
  const canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const isMobile = rect.width < BREAKPOINT.MOBILE;
  const w = Math.min(rect.width - 16, CHART.CANVAS_MAX_WIDTH);
  const h = isMobile ? CHART.BAR_HEIGHT_MOBILE : CHART.BAR_HEIGHT;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const textColor = cssVar('--text', '#e0d8e8');
  const textLight = cssVar('--text-light', '#a098b8');
  const pad = isMobile ? { top: 12, right: 8, bottom: 28, left: 40 } : { top: 20, right: 20, bottom: 35, left: 55 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const metrics = [
    { label: 'Ventas', key: 'total_ventas', values: [data.today.total_ventas, data.week.total_ventas, data.month.total_ventas] },
    { label: 'USD', key: 'total_usd', values: [data.today.total_usd, data.week.total_usd, data.month.total_usd] }
  ];

  const barColors = ['#4f46e5', '#0891b2', '#059669'];
  const periodLabels = ['Hoy', '7 d\u00edas', 'Mes'];
  const groupW = chartW / metrics.length;
  const barW = Math.min(groupW * (isMobile ? 0.24 : 0.28), isMobile ? 28 : 36);
  const gap = (groupW - barW * 3) / 4;
  const yMaxes = metrics.map(function(m) { return Math.max.apply(null, m.values) * 1.15 || 1; });

  let bars = [];
  let startTime = null;
  const duration = CHART.BAR_ANIM_MS;

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
    const gridLines = isMobile ? 3 : 4;
    for (let gi = 1; gi <= gridLines; gi++) {
      const gy = pad.top + chartH * (1 - gi / (gridLines + 1));
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
    for (let yi = 0; yi <= gridLines + 1; yi++) {
      ctx.fillText(Math.round(yi * 100 / (gridLines + 1)) + '%', pad.left - (isMobile ? 4 : 8), pad.top + chartH * (1 - yi / (gridLines + 1)));
    }

    bars = [];
    for (let mi = 0; mi < metrics.length; mi++) {
      const gx = pad.left + mi * groupW + gap;
      for (let bi = 0; bi < 3; bi++) {
        const barH = Math.max(1, (metrics[mi].values[bi] / yMaxes[mi]) * chartH * ease);
        const bx = gx + bi * (barW + gap);
        const by = pad.top + chartH - barH;
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

    const legendX = w - (isMobile ? 130 : 160), legendY = isMobile ? 4 : 6;
    const lSize = isMobile ? 8 : 10;
    for (let li = 0; li < 3; li++) {
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
    const progress = Math.min((timestamp - startTime) / duration, 1);
    drawBase(1 - Math.pow(1 - progress, 3));
    if (progress < 1) { requestAnimationFrame(animate); }
    else { attachChartHover(canvas, bars, dpr); }
  }
  requestAnimationFrame(animate);
}

/* ========== PIE CHART ========== */
function drawDashboardPieChart(body, paymentMethods) {
  const periodLabels = { day: 'Hoy', week: 'Semana', month: 'Mes' };
  const periodBar = document.createElement('div');
  periodBar.className = 'dashboard-chart-toggle';
  periodBar.innerHTML = Object.keys(periodLabels).map(function(k) {
    return '<button class="btn btn-sm ' + (piePeriod === k ? 'btn-primary' : 'btn-outline') + '" data-pie-period="' + k + '">' + periodLabels[k] + '</button>';
  }).join('');
  const container = body.querySelector('.dashboard-chart-container');
  if (container) body.insertBefore(periodBar, container);
  const periodBtns = periodBar.querySelectorAll('[data-pie-period]');
  for (let pi = 0; pi < periodBtns.length; pi++) {
    periodBtns[pi].addEventListener('click', function() {
      piePeriod = this.dataset.piePeriod;
      loadDashboard();
    });
  }

  const canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const isMobile = rect.width < BREAKPOINT.MOBILE;
  const w = Math.min(rect.width - 16, CHART.CANVAS_MAX_WIDTH);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = CHART.BAR_HEIGHT * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = CHART.BAR_HEIGHT + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const h = CHART.BAR_HEIGHT;

  const textColor = cssVar('--text', '#e0d8e8');
  const textLight = cssVar('--text-light', '#a098b8');
  const cardColor = cssVar('--card', '#1f2937');

  const pieColors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#7c3aed', '#dc2626'];
  const methodLabels = {
    efectivo: 'Efectivo',
    punto: 'Punto',
    pago_movil: 'Pago M\u00f3vil',
    mixto: 'Mixto',
    credito: 'Cr\u00e9dito',
    efectivo_usd: 'Efectivo USD'
  };

  const slices = [];
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

  const total = slices.reduce(function(s, sl) { return s + sl.value; }, 0);

  const legendW = isMobile ? 90 : 130;
  const chartW = w - legendW;
  const cx = chartW / 2;
  const cy = h / 2;
  const radius = Math.min(chartW, h) / 2 - (isMobile ? 20 : 40);

  let acc = 0;
  const angles = slices.map(function(sl) {
    const a = (sl.value / total) * Math.PI * 2;
    const seg = { start: acc, end: acc + a, slice: sl };
    acc += a;
    return seg;
  });

  const duration = CHART.PIE_ANIM_MS;
  let startTime = null;

  function drawBase(ease) {
    ctx.clearRect(0, 0, w, h);

    for (let si = 0; si < angles.length; si++) {
      const seg = angles[si];
      const sweep = (seg.end - seg.start) * ease;
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

    const legX = chartW + (isMobile ? 6 : 12);
    let legY = 24;
    const sq = isMobile ? 10 : 12;
    for (let li = 0; li < slices.length; li++) {
      ctx.fillStyle = slices[li].color;
      ctx.fillRect(legX, legY, sq, sq);
      ctx.fillStyle = textColor;
      ctx.font = (isMobile ? '10px' : '12px') + ' sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(slices[li].label, legX + sq + (isMobile ? 4 : 6), legY);
      const pct = ((slices[li].value / total) * 100).toFixed(1);
      ctx.fillStyle = textLight;
      ctx.font = (isMobile ? '8px' : '11px') + ' sans-serif';
      ctx.fillText('$' + slices[li].value.toFixed(1) + ' (' + pct + '%)', legX + sq + (isMobile ? 4 : 6), legY + sq + 2);
      legY += (isMobile ? 34 : 50);
    }
  }

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    drawBase(1 - Math.pow(1 - progress, 3));
    if (progress < 1) { requestAnimationFrame(animate); }
    else { attachPieHover(canvas, angles, cx, cy, radius, dpr); }
  }
  requestAnimationFrame(animate);
}

function attachChartHover(canvas, bars, dpr) {
  function onMove(e) {
    const cr = canvas.getBoundingClientRect();
    const mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr;
    const my = (e.clientY - cr.top) * (canvas.height / cr.height) / dpr;
    for (let i = 0; i < bars.length; i++) {
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
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas.addEventListener('touchstart', onTouch);
}

function attachPieHover(canvas, angles, cx, cy, radius, dpr) {
  function onMove(e) {
    const cr = canvas.getBoundingClientRect();
    const mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr - cx;
    const my = (e.clientY - cr.top) * (canvas.height / cr.height) / dpr - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    const innerR = radius * 0.45;
    if (dist < innerR || dist > radius) {
      hideChartTooltip();
      canvas.style.cursor = 'default';
      return;
    }
    let angle = Math.atan2(my, mx);
    if (angle < 0) angle += Math.PI * 2;
    for (let i = 0; i < angles.length; i++) {
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
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY });
  }
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseout', onOut);
  canvas.addEventListener('touchstart', onTouch);
}

/* ========== PROFIT LINE CHART ========== */
async function drawProfitLineChart(body) {
  var canvas = qs(SEL.dashboardCanvas);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var container = canvas.parentElement;
  var rect = container.getBoundingClientRect();
  var w = rect.width || CHART.CANVAS_MAX_WIDTH;
  var maxW = CHART.CANVAS_MAX_WIDTH;
  if (w > maxW) w = maxW;
  var h = CHART.BAR_HEIGHT;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  var now = new Date();
  var endDate = now.toISOString().slice(0, 10);
  var startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    var points = await invoke('get_profit_series', {
      filter: { start_date: startDate, end_date: endDate }
    });
    if (!points || points.length < 2) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#999';
      ctx.textAlign = 'center';
      ctx.fillText('Datos insuficientes para el gr\u00e1fico de ganancias', w / 2, h / 2);
      return;
    }

    var css = getComputedStyle(document.documentElement);
    var textColor = css.getPropertyValue('--text').trim() || '#e0e0e0';
    var mutedColor = css.getPropertyValue('--text-muted').trim() || '#888';
    var lineColor = css.getPropertyValue('--primary').trim() || '#7E6B90';
    var fillColor = lineColor + '33';
    var gridColor = css.getPropertyValue('--border').trim() || '#3A3450';

    var padding = { top: 20, right: 20, bottom: 40, left: 60 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    var maxVal = 0;
    var minVal = Infinity;
    points.forEach(function(p) {
      if (p.profit_usd > maxVal) maxVal = p.profit_usd;
      if (p.profit_usd < minVal) minVal = p.profit_usd;
    });
    var range = maxVal - minVal || 1;
    var yPad = range * 0.1;
    maxVal += yPad;
    minVal = Math.max(0, minVal - yPad);
    range = maxVal - minVal || 1;

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    var gridLines = 5;
    for (var i = 0; i <= gridLines; i++) {
      var y = padding.top + (chartH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      var val = maxVal - (range / gridLines) * i;
      ctx.fillStyle = mutedColor;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('$' + val.toFixed(1), padding.left - 5, y + 4);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.font = '10px sans-serif';
    var step = Math.max(1, Math.floor(points.length / 10));
    points.forEach(function(p, idx) {
      if (idx % step !== 0 && idx !== points.length - 1) return;
      var x = padding.left + (idx / (points.length - 1)) * chartW;
      ctx.fillStyle = mutedColor;
      ctx.fillText(p.date.slice(5), x, h - padding.bottom + 15);
    });

    // Area fill
    ctx.beginPath();
    var firstX = padding.left;
    var firstY = padding.top + chartH - ((points[0].profit_usd - minVal) / range) * chartH;
    ctx.moveTo(firstX, padding.top + chartH);
    ctx.lineTo(firstX, firstY);
    for (var j = 1; j < points.length; j++) {
      var x = padding.left + (j / (points.length - 1)) * chartW;
      var y = padding.top + chartH - ((points[j].profit_usd - minVal) / range) * chartH;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(padding.left + chartW, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (var k = 0; k < points.length; k++) {
      var x = padding.left + (k / (points.length - 1)) * chartW;
      var y = padding.top + chartH - ((points[k].profit_usd - minVal) / range) * chartH;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Dots
    points.forEach(function(p, idx) {
      var x = padding.left + (idx / (points.length - 1)) * chartW;
      var y = padding.top + chartH - ((p.profit_usd - minVal) / range) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = mutedColor;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u00daltimos ' + points.length + ' d\u00edas', w / 2, 14);

    // Hover tooltips
    var profitPoints = points;
    var hoverData = {
      padding: padding, chartW: chartW, chartH: chartH,
      minVal: minVal, range: range, points: points
    };
    attachLineHover(canvas, dpr, hoverData);

  } catch (e) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('Error: ' + e.message || e, w / 2, h / 2);
  }
}

function attachLineHover(canvas, dpr, data) {
  function onMove(e) {
    var cr = canvas.getBoundingClientRect();
    var mx = (e.clientX - cr.left) * (canvas.width / cr.width) / dpr;
    for (var i = 0; i < data.points.length; i++) {
      var x = data.padding.left + (i / (data.points.length - 1)) * data.chartW;
      if (Math.abs(mx - x) < 10) {
        var p = data.points[i];
        showChartTooltip(e.clientX, e.clientY,
          p.date + ' | Ingreso: $' + p.revenue_usd.toFixed(2) +
          ' | Costo: $' + p.cost_usd.toFixed(2) +
          ' | Ganancia: $' + p.profit_usd.toFixed(2));
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
        start_date: startDate + START_OF_DAY_SUFFIX,
        end_date: endDate + END_OF_DAY_SUFFIX,
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
    if (qs(SEL.viewCashier)?.classList.contains('active')) loadDailySummary();
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
    if (qs(SEL.viewCashier)?.classList.contains('active')) loadDailySummary();
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

/* ========== OPENROUTER / SUGERENCIAS ========== */
async function saveOpenRouterKey() {
  const key = qs(SEL.openrouterApiKey).value.trim();
  if (!key) { showToast('Ingresa una API key', 'error'); return; }
  try {
    await invoke('set_config_value', { key: CFG_OPENROUTER_API_KEY, value: key });
    showToast('API key guardada');
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function loadOpenRouterKey() {
  try {
    const key = await invoke('get_config_value', { key: CFG_OPENROUTER_API_KEY });
    if (key) qs(SEL.openrouterApiKey).value = key;
    const model = await invoke('get_config_value', { key: CFG_OPENROUTER_MODEL });
    if (model) setCustomSelectValue(qs(SEL.openrouterModelWrap), model);
  } catch (_) {}
}

async function generateOrder() {
  const apiKey = qs(SEL.openrouterApiKey).value.trim();
  if (!apiKey) { showToast('Configura la API key de OpenRouter primero', 'error'); return; }
  const model = qs(SEL.openrouterModelWrap).dataset.value || '';
  showLoadingModal('Generando orden de compra...');
  await forcePaint();
  try {
    const content = await invoke('generate_purchase_suggestion', { apiKey, model });
    hideLoadingModal();
    qs(SEL.suggestionContent).textContent = content;
    showModal(qs(SEL.suggestionModal));
  } catch (e) {
    hideLoadingModal();
    showToast('Error: ' + e, 'error');
  }
}

async function copySuggestion() {
  const text = qs(SEL.suggestionContent).textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado al portapapeles');
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copiado al portapapeles');
  }
}

/* ========== CHAT IA ========== */
const CHAT_SYSTEM_PROMPT = 'Eres Enar, un zorro experto asistente de un sistema POS (Punto de Venta) llamado "Gestor de Ventas". Tu nombre es Enar, si te preguntan preséntate como Enar. Solo respondes preguntas relacionadas con el sistema: ventas, inventario de productos, clientes, créditos, reportes, configuración, caja, sincronización. Si te preguntan algo fuera de este tema (historia, matemáticas, cultura general, etc.), responde cordialmente que solo puedes ayudar con el uso del POS. Responde en español, sé conciso y útil. Puedes usar **negrita**, *cursiva* y emojis en tus respuestas.';

function renderMarkdown(text) {
  var html = escapeHtml(text);
  // code blocks (```...```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

function stripEmojis(str) {
  return str.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '').trim();
}

let chatHistory = [];

function addChatMessage(role, content) {
  var r = role === 'ai' ? 'assistant' : role;
  chatHistory.push({ role: r, content });
}

function appendChatBubble(role, content) {
  const container = qs(SEL.chatMessages);
  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg-' + role;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'chat-msg-content';
  contentDiv.innerHTML = renderMarkdown(content);
  div.appendChild(contentDiv);

  if (role === 'ai') {
    const footer = document.createElement('div');
    footer.className = 'chat-msg-footer';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'chat-copy-btn';
    copyBtn.innerHTML = '<i class="nf nf-fa-copy"></i> Copiar';
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(content).catch(() => {});
      showToast('Copiado');
    });
    footer.appendChild(copyBtn);
    div.appendChild(footer);
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showChatThinking() {
  const el = qs(SEL.chatThinking);
  if (!el) return;
  el.style.display = '';
  el.offsetHeight; // force reflow to ensure paint before continuing
  const container = qs(SEL.chatMessages);
  container.scrollTop = container.scrollHeight;
}

function hideChatThinking() {
  const el = qs(SEL.chatThinking);
  if (el) el.style.display = 'none';
}

var chatPending = false;

async function handleChatSend(forcedText) {
  if (chatPending) return;
  const input = qs(SEL.chatInput);
  const text = forcedText || input.value.trim();
  if (!text) return;

  chatPending = true;
  const btn = qs(SEL.chatSendBtn);
  btn.disabled = true;

  input.value = '';
  input.style.height = 'auto';

  addChatMessage('user', text);
  appendChatBubble('user', text);
  showChatThinking();

  // Get live context (parallel)
  var contextLines = [];
  var results = await Promise.allSettled([
    invoke('list_products', { search: null, page: 1, pageSize: 20 }).then(function(r) {
      if (r && r.data) {
        contextLines.push('- Productos activos: ' + (r.total || 0));
        var names = r.data.map(function(p) { return p.nombre + ' ($' + p.precio_usd.toFixed(2) + ')'; }).join(', ');
        contextLines.push('- Productos: ' + names + ((r.total || 0) > 20 ? '...' : ''));
      }
    }),
    invoke('get_config_value', { key: CFG_TASA_DOLAR }).then(function(cfg) {
      if (cfg) contextLines.push('- Tasa del dólar: Bs. ' + parseFloat(cfg).toFixed(2));
    }),
    invoke('get_daily_summary').then(function(todayRes) {
      if (todayRes) contextLines.push('- Ventas hoy: ' + (todayRes.total_ventas || 0) + ' por $' + (todayRes.total_usd || 0).toFixed(2));
    }),
    invoke('get_dashboard_summary').then(function(dash) {
      if (dash && dash.today) {
        if (dash.today.total_ganancia_usd !== undefined) {
          contextLines.push('- Ganancia hoy: $' + dash.today.total_ganancia_usd.toFixed(2) + ' (costo: $' + (dash.today.total_costo_usd || 0).toFixed(2) + ')');
        }
        if (dash.month && dash.month.total_ganancia_usd !== undefined) {
          contextLines.push('- Ganancia del mes: $' + dash.month.total_ganancia_usd.toFixed(2) + ' (de $' + dash.month.total_usd.toFixed(2) + ' en ventas)');
        }
      }
    }),
    invoke('get_top_products', { limit: 3 }).then(function(top) {
      if (top && top.length > 0) {
        var topStr = top.map(function(p) { return p.nombre + ' (' + p.cantidad_vendida + ' uds, $' + p.total_usd.toFixed(2) + ')'; }).join(', ');
        contextLines.push('- Más vendidos: ' + topStr);
      }
    }),
    invoke('list_products', { search: null, page: 1, pageSize: 200 }).then(function(lowStock) {
      if (lowStock && lowStock.data) {
        var low = lowStock.data.filter(function(p) { return p.stock < p.stock_minimo; });
        if (low.length > 0) {
          var lowStr = low.slice(0, 5).map(function(p) { return p.nombre + ' (stock: ' + p.stock + ', mínimo: ' + p.stock_minimo + ')'; }).join(', ');
          contextLines.push('- Stock bajo (' + low.length + '): ' + lowStr);
        }
      }
    }),
    invoke('list_clientes').then(function(clients) {
      if (clients && clients.length > 0) {
        var debtClients = clients.filter(function(c) { return c.saldo_deuda_usd > 0; });
        contextLines.push('- Clientes: ' + clients.length);
        if (debtClients.length > 0) {
          var debtStr = debtClients.slice(0, 5).map(function(c) { return c.nombre + ' ($' + c.saldo_deuda_usd.toFixed(2) + ')'; }).join(', ');
          contextLines.push('- Deudas (' + debtClients.length + '): ' + debtStr + (debtClients.length > 5 ? '...' : ''));
        }
      }
    }),
  ]);

  var systemPrompt = CHAT_SYSTEM_PROMPT;
  if (contextLines.length > 0) {
    systemPrompt += '\n\nDatos actuales del sistema:\n' + contextLines.join('\n');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
  ];

  try {
    const apiKey = qs(SEL.openrouterApiKey).value.trim();
    if (!apiKey) {
      hideChatThinking();
      appendChatBubble('ai', 'Primero configura la API key de OpenRouter en Configuración → IA.');
      return;
    }
  const model = qs(SEL.openrouterModelWrap).dataset.value || '';
    const reply = await invoke('chat_with_ai', { messages, apiKey, model });
    hideChatThinking();
    addChatMessage('ai', reply);
    appendChatBubble('ai', reply);
  } catch (e) {
    hideChatThinking();
    appendChatBubble('ai', 'Error: ' + e);
  } finally {
    btn.disabled = false;
    chatPending = false;
    input.focus();
  }
}

function toggleChat() {
  const panel = qs(SEL.chatPanel);
  const isOpening = panel.classList.contains('hidden');
  if (isOpening) positionChatPanel();
  panel.classList.toggle('hidden');
  if (!isOpening) return;
  if (chatHistory.length === 0) {
    addChatMessage('ai', '\u00a1Hola! Soy Enar, tu asistente del POS. Preg\u00fantame sobre productos, ventas, clientes o lo que necesites del sistema.');
    appendChatBubble('ai', '\u00a1Hola! Soy Enar, tu asistente del POS. Preg\u00fantame sobre productos, ventas, clientes o lo que necesites del sistema.');
  }
  if (!IS_ANDROID) qs(SEL.chatInput).focus();
  qs(SEL.chatMessages).scrollTop = qs(SEL.chatMessages).scrollHeight;
}

function positionChatPanel() {
  var fab = qs(SEL.chatFab);
  var panel = qs(SEL.chatPanel);
  var fabRect = fab.getBoundingClientRect();
  var panelW = window.innerWidth < 480 ? window.innerWidth - 16 : Math.min(360, window.innerWidth - 40);
  var panelLeft = fabRect.right - panelW;
  if (panelLeft < 8) panelLeft = 8;
  if (panelLeft + panelW > window.innerWidth - 8) panelLeft = window.innerWidth - panelW - 8;
  panel.style.left = panelLeft + 'px';
  panel.style.bottom = (window.innerHeight - fabRect.top + 8) + 'px';
  panel.style.maxHeight = Math.min(460, Math.max(200, fabRect.top - 16)) + 'px';
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

  // Navigation
  qsa('.nav-btn').forEach(btn => {
    if (!btn.id) btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  /* More menu (mobile overflow) */
  qs(SEL.moreBtn).addEventListener('click', function(e) {
    e.stopPropagation();
    qs(SEL.moreMenu).classList.toggle('hidden');
  });
  qsa('.more-menu-item[data-view]').forEach(function(item) {
    item.addEventListener('click', function() {
      qs(SEL.moreMenu).classList.add('hidden');
      showView(this.dataset.view);
    });
  });
  qs(SEL.moreWrap).addEventListener('click', function(e) { e.stopPropagation(); });
  document.addEventListener('click', function() { qs(SEL.moreMenu).classList.add('hidden'); });
  // Close More menu on view change
  document.addEventListener('viewChanged', function() { qs(SEL.moreMenu).classList.add('hidden'); });

  /* Swipe-to-delete on cart items (mobile) */
  if (IS_ANDROID) {
    var cartSwipeState = { el: null, startX: 0 };
    qs(SEL.cartBody).addEventListener('touchstart', function(e) {
      var row = e.target.closest('tr');
      if (!row) return;
      cartSwipeState.el = row;
      cartSwipeState.startX = e.touches[0].clientX;
      row.classList.add('cart-item-swipe');
    }, { passive: true });
    qs(SEL.cartBody).addEventListener('touchmove', function(e) {
      if (!cartSwipeState.el) return;
      var dx = cartSwipeState.startX - e.touches[0].clientX;
      var pct = Math.min(dx / 120, 1);
      cartSwipeState.el.style.transform = 'translateX(-' + (pct * 80) + 'px)';
      cartSwipeState.el.classList.toggle('swiping', dx > 40);
    }, { passive: true });
    qs(SEL.cartBody).addEventListener('touchend', function() {
      if (cartSwipeState.el && cartSwipeState.el.classList.contains('swiping')) {
        var row = cartSwipeState.el;
        row.style.transform = '';
        row.classList.add('deleting');
        setTimeout(function() {
          var btn = row.querySelector('[data-action="remove-from-cart"]');
          if (btn) btn.click();
          row.classList.remove('deleting', 'swiping', 'cart-item-swipe');
        }, 300);
      } else {
        if (cartSwipeState.el) {
          cartSwipeState.el.style.transform = '';
          cartSwipeState.el.classList.remove('swiping', 'cart-item-swipe');
        }
      }
      cartSwipeState.el = null;
    }, { passive: true });
  }

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

  // Currency toggle for cart totals column
  const currencyToggle =   qs(SEL.cartCurrencyToggle);
  if (currencyToggle) {
    currencyToggle.addEventListener('click', function() {
      cartShowBs = !cartShowBs;
      this.textContent = cartShowBs ? 'Bs.' : '$';
      this.classList.toggle('active', cartShowBs);
      this.title = cartShowBs ? 'Cambiar a USD' : 'Cambiar a Bs';
      renderCart();
      updateCartTotals();
    });
  }

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
      return;
    }
    const inc = e.target.closest('[data-action="qty-inc"]');
    if (inc) {
      const input = inc.parentElement.querySelector('.cart-qty-input');
      if (input) {
        input.value = Math.min(parseInt(input.value) + 1, parseInt(input.max));
        handleCartQtyInput(input.dataset.codigo, input.value);
      }
      return;
    }
    const dec = e.target.closest('[data-action="qty-dec"]');
    if (dec) {
      const input = dec.parentElement.querySelector('.cart-qty-input');
      if (input) {
        input.value = Math.max(parseInt(input.value) - 1, parseInt(input.min));
        handleCartQtyInput(input.dataset.codigo, input.value);
      }
      return;
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
    if (!pwd || pwd.length < MIN_PASSWORD_LEN) { showToast(`La contrase\u00f1a debe tener al menos ${MIN_PASSWORD_LEN} caracteres`, 'error'); return; }
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

  /* Restore backup */
  qs(SEL.restoreBackupBtn).addEventListener('click', async function() {
    try {
      var result = await invoke('plugin:dialog|open', {
        filters: [{ name: 'Backup cifrado', extensions: ['enc'] }],
        multiple: false,
      });
      if (!result) return;
      this.disabled = true;
      this.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Restaurando...';
      const msg = await invoke('restore_backup', { backupPath: result });
      showToast(msg, 'warning');
    } catch (e) {
      showToast('Error: ' + e, 'error');
    } finally {
      this.disabled = false;
      this.innerHTML = '<i class="nf nf-fa-upload"></i> Restaurar';
    }
  });

  /* Show backup key */
  qs(SEL.showBackupKeyBtn).addEventListener('click', async function() {
    try {
      const key = await invoke('get_backup_key');
      await navigator.clipboard.writeText(key);
      showToast('Clave de cifrado copiada al portapapeles', 'info');
    } catch (e) {
      showToast('Error: ' + e, 'error');
    }
  });

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

  /* Ver ID del dispositivo */
  const viewIdBtn = qs(SEL.viewDeviceIdBtn);
  if (viewIdBtn) {
    viewIdBtn.addEventListener('click', async function() {
      const display = qs(SEL.deviceIdDisplay);
      if (display && display.style.display !== 'none') {
        display.style.display = 'none';
        return;
      }
      try {
        const stats = await invoke('get_sync_stats');
        if (stats.dispositivo_id) {
          if (display) {
            display.textContent = 'ID: ' + stats.dispositivo_id;
            display.style.display = 'block';
          }
        } else {
          showToast('No hay dispositivo registrado', 'error');
        }
      } catch (e) { showToast('Error: ' + e, 'error'); }
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

  /* Refrescar dispositivos vinculados */
  qs(SEL.refreshDevicesBtn)?.addEventListener('click', loadLinkedDevices);

  /* Sync all progress UI */
  const syncProgressModal = qs(SEL.syncProgressModal);
  const syncProgressText = qs(SEL.syncProgressText);
  const syncProgressBar = qs(SEL.syncProgressBar);
  function showSyncProgress() {
    syncProgressModal.classList.remove('hidden');
    void syncProgressModal.offsetHeight;
  }
  function hideSyncProgress() { syncProgressModal.classList.add('hidden'); syncProgressBar.style.width = '0%'; }
  function updateSyncProgress(step, current, total) {
    const pct = Math.round((current / total) * 100);
    syncProgressText.textContent = step + ' (' + current + '/' + total + ')';
    syncProgressBar.style.width = pct + '%';
  }
  window.__TAURI__.event.listen('sync-progress', function(e) {
    var d = e.payload;
    updateSyncProgress(d.step, d.current, d.total);
  });

  /* Subir todo */
  qs(SEL.uploadAllBtn)?.addEventListener('click', function() {
    confirmModal('¿Subir productos, clientes y ventas a Supabase?', 'Subir todo', 'Subir').then(async function(ok) {
      if (!ok) return;
      showSyncProgress();
      await forcePaint();
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
    confirmModal('¿Descargar productos, clientes y ventas desde Supabase?', 'Descargar todo', 'Descargar').then(async function(ok) {
      if (!ok) return;
      showSyncProgress();
      await forcePaint();
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
    confirmModal('¿Sincronizar completamente (subir y descargar todo) con Supabase?', 'Sincronizar todo', 'Sincronizar').then(async function(ok) {
      if (!ok) return;
      showSyncProgress();
      await forcePaint();
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
    statusEl.style.color = cssVar('--text-secondary');
    statusEl.title = 'Probando...';
    showLoadingModal('Probando conexión con Supabase...');
    await forcePaint();
    try {
      var ok = await invoke('test_supabase_connection');
      if (ok) {
        statusEl.style.color = cssVar('--success');
        statusEl.title = 'Conectado';
        showToast('Conexión exitosa');
      } else {
        statusEl.style.color = cssVar('--danger');
        statusEl.title = 'Error de conexi\u00f3n';
        showToast('No se pudo conectar a Supabase', 'error');
      }
    } catch (e) {
      statusEl.style.color = cssVar('--danger');
      statusEl.title = 'Error: ' + e;
      showToast('Error: ' + e, 'error');
    } finally {
      hideLoadingModal();
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
        if (!IS_ANDROID && viewId === 'view-sales') qs(SEL.productSearch).focus();
        else if (!IS_ANDROID && viewId === 'view-inventory') qs(SEL.inventorySearch).focus();
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
  const confirmarToggle =   qs(SEL.confirmarVentaToggle);
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
      applyFontSize(currentFontPct + FONT.SIZE_STEP);
      saveFontSize(currentFontPct);
    });
  }
  if (fontDecBtn) {
    fontDecBtn.addEventListener('click', function() {
      applyFontSize(currentFontPct - FONT.SIZE_STEP);
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
    let savedTheme = await getUserConfig(CFG_TEMA);
    if (!savedTheme) {
      try { savedTheme = localStorage.getItem(CFG_TEMA); } catch (_) {}
    }
    if (savedTheme) applyTheme(savedTheme);
  } catch (e) {}

  // Animations toggle
  const animToggle = qs(SEL.animationsToggle);
  function setAnimations(enabled) {
    document.body.classList.toggle('no-animations', !enabled);
  }
  if (animToggle) {
    animToggle.addEventListener('change', function() {
      setAnimations(this.checked);
      setUserConfig(CFG_ANIMACIONES, this.checked ? '1' : '0').catch(e => showToast('Error al guardar configuraci\u00f3n', 'error'));
    });
  }

  // Load animations config
  try {
    const val = await getUserConfig(CFG_ANIMACIONES);
    const enabled = val !== '0';
    if (animToggle) animToggle.checked = enabled;
    setAnimations(enabled);
  } catch (e) {}

  // Load confirmar venta config
  try {
    const val = await getUserConfig(CFG_CONFIRMAR_VENTA);
    const toggle =   qs(SEL.confirmarVentaToggle);
    if (toggle) toggle.checked = val === '1';
  } catch (e) {}

  // Load IA config
  const iaToggle =   qs(SEL.iaToggle);
  function setIaEnabled(enabled) {
    qs(SEL.chatFab).style.display = enabled ? '' : 'none';
    if (!enabled) {
      const panel = qs(SEL.chatPanel);
      if (panel && !panel.classList.contains('hidden')) panel.classList.add('hidden');
    }
  }
  if (iaToggle) {
    iaToggle.addEventListener('change', function() {
      setIaEnabled(this.checked);
      setUserConfig(CFG_IA_HABILITADO, this.checked ? '1' : '0').catch(() => {});
    });
  }
  try {
    const val = await getUserConfig(CFG_IA_HABILITADO);
    const enabled = val !== '0';
    if (iaToggle) iaToggle.checked = enabled;
    setIaEnabled(enabled);
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
      if (val > HISTORIAL_MAX_DAYS) val = HISTORIAL_MAX_DAYS;
      input.value = val;
      try {
        await invoke('set_config_value', { key: CFG_HISTORIAL_LIMPIEZA_DIAS, value: String(val) });
        updateHistoryCleanupStatus(val);
        showToast('Configuraci\u00f3n guardada');
      } catch (e) { showToast('Error: ' + e, 'error'); }
    });
  }

  // Manual clear history buttons
  for (const btn of [qs(SEL.auditClearBtn), qs(SEL.auditClearConfigBtn)]) {
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
    if (window.innerWidth > BREAKPOINT.DESKTOP) {
      document.querySelectorAll('.sales-left, .sales-center').forEach(el => el.style.display = '');
    }
  });

  // Audit load more
  qs(SEL.auditLoadMore).addEventListener('click', loadAuditMore);

  // Device registration
  qs(SEL.regDeviceBtn).addEventListener('click', handleDeviceRegister);

  // Check if device is already registered
  try {
    const devId = await invoke('get_config_value', { key: CFG_DISPOSITIVO_ID });
    if (devId) {
      qs(SEL.deviceRegScreen).style.display = 'none';
      qs(SEL.loginScreen).style.display = 'flex';
    } else {
      qs(SEL.deviceRegScreen).style.display = 'flex';
    }
  } catch (e) {
    qs(SEL.deviceRegScreen).style.display = 'flex';
  }

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
      if (diff > KEYBOARD.THRESHOLD) {
        // Keyboard opened
        document.body.classList.add('keyboard-open');
        var view = document.querySelector('.view.active');
        if (view) view.classList.add('mobile-keyboard');
        var el = document.activeElement;
        if (el) {
          setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, KEYBOARD.SCROLL_DELAY_MS);
        }
        main.style.paddingBottom = (diff - KEYBOARD.PAD_OFFSET) + 'px';
      } else if (diff < -KEYBOARD.THRESHOLD) {
        // Keyboard closed
        document.body.classList.remove('keyboard-open');
        var view2 = document.querySelector('.view.active');
        if (view2) view2.classList.remove('mobile-keyboard');
        main.style.paddingBottom = '';
        window.scrollTo(0, 0);
      }
      _prevVpHeight = window.visualViewport.height;
    });
  }

  /* ========== OPENROUTER / SUGERENCIAS ========== */
  qs(SEL.openrouterSaveKeyBtn).addEventListener('click', saveOpenRouterKey);
  // Custom select for model
  qs(SEL.openrouterModelBtn).addEventListener('click', function(e) {
    e.stopPropagation();
    var wrap = qs(SEL.openrouterModelWrap);
    wrap.classList.toggle('open');
  });
  qs(SEL.openrouterModelMenu).addEventListener('click', function(e) {
    var opt = e.target.closest('button');
    if (!opt || !opt.dataset.value) return;
    var wrap = qs(SEL.openrouterModelWrap);
    setCustomSelectValue(wrap, opt.dataset.value);
    wrap.classList.remove('open');
    try { invoke('set_config_value', { key: CFG_OPENROUTER_MODEL, value: opt.dataset.value }); } catch (_) {}
  });
  document.addEventListener('click', function(e) {
    var wrap = qs(SEL.openrouterModelWrap);
    if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
  });
  qs(SEL.generateOrderBtn).addEventListener('click', generateOrder);
  qs(SEL.suggestionCopyBtn).addEventListener('click', copySuggestion);
  qs(SEL.suggestionModalClose).addEventListener('click', function() { closeModal(qs(SEL.suggestionModal)); });
  qs(SEL.suggestionCloseBtn).addEventListener('click', function() { closeModal(qs(SEL.suggestionModal)); });
  loadOpenRouterKey();

  /* ========== CHAT IA ========== */
  /* FAB — click to open, drag to move (long-press or move >4px) */
  (function initFabPos() {
    var fab = qs(SEL.chatFab);
    var saved = localStorage.getItem('chat_fab_pos');
    if (saved) {
      try {
        var pos = JSON.parse(saved);
        fab.style.left = pos.left + 'px';
        fab.style.top = pos.top + 'px';
        return;
      } catch (_) {}
    }
    fab.style.left = (window.innerWidth - 72) + 'px';
    fab.style.top = (window.innerHeight - 152) + 'px';
  })();

  var fabDragActive = false, fabTouchDrag = false;
  var fabStartX, fabStartY, fabOrigLeft, fabOrigTop, fabDragTimer;

  function fabStart(e, isTouch) {
    var t = isTouch ? e.touches[0] : e;
    fabDragActive = false;
    fabTouchDrag = false;
    fabStartX = t.clientX;
    fabStartY = t.clientY;
    fabOrigLeft = parseInt(qs(SEL.chatFab).style.left) || 0;
    fabOrigTop = parseInt(qs(SEL.chatFab).style.top) || 0;
    clearTimeout(fabDragTimer);
    fabDragTimer = setTimeout(function() {
      fabDragActive = true;
      qs(SEL.chatFab).classList.add('dragging');
    }, 250);
  }

  function fabMove(e, isTouch) {
    if (fabStartX === undefined) return;
    var t = isTouch ? e.touches[0] : e;
    var dx = t.clientX - fabStartX;
    var dy = t.clientY - fabStartY;
    if (!fabDragActive && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    if (!fabDragActive) {
      fabDragActive = true;
      qs(SEL.chatFab).classList.add('dragging');
      clearTimeout(fabDragTimer);
    }
    e.preventDefault();
    qs(SEL.chatFab).style.left = Math.max(0, Math.min(window.innerWidth - 52, fabOrigLeft + dx)) + 'px';
    qs(SEL.chatFab).style.top = Math.max(0, Math.min(window.innerHeight - 52, fabOrigTop + dy)) + 'px';
  }

  function fabEnd(isTouch) {
    clearTimeout(fabDragTimer);
    fabDragTimer = null;
    if (fabDragActive) {
      qs(SEL.chatFab).classList.remove('dragging');
      localStorage.setItem('chat_fab_pos', JSON.stringify({
        left: parseInt(qs(SEL.chatFab).style.left) || 0,
        top: parseInt(qs(SEL.chatFab).style.top) || 0,
      }));
      if (isTouch) {
        fabTouchDrag = true;
        setTimeout(function() { fabTouchDrag = false; }, 100);
      }
    }
    fabStartX = fabStartY = undefined;
  }

  qs(SEL.chatFab).addEventListener('mousedown', function(e) {
    if (fabTouchDrag) return; // ignore synthetic mousedown after touch drag
    fabStart(e, false);
  });
  document.addEventListener('mousemove', function(e) { fabMove(e, false); });
  document.addEventListener('mouseup', function() { fabEnd(false); });
  qs(SEL.chatFab).addEventListener('touchstart', function(e) { fabStart(e, true); }, { passive: true });
  document.addEventListener('touchmove', function(e) { fabMove(e, true); }, { passive: false });
  document.addEventListener('touchend', function() { fabEnd(true); });

  qs(SEL.chatFab).addEventListener('click', function() {
    if (fabDragActive || fabTouchDrag) { fabDragActive = false; fabTouchDrag = false; return; }
    toggleChat();
  });

  qs(SEL.chatCloseBtn).addEventListener('click', toggleChat);
  qs(SEL.chatSendBtn).addEventListener('click', handleChatSend);
  qs(SEL.chatInput).addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  });
  qs(SEL.chatInput).addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  /* Expand chat */
  qs(SEL.chatExpandBtn).addEventListener('click', function() {
    qs(SEL.chatPanel).classList.toggle('expanded');
    this.querySelector('i').className = qs(SEL.chatPanel).classList.contains('expanded') ? 'nf nf-fa-compress' : 'nf nf-fa-expand';
  });

  /* Quick prompts */
  qsa('.chat-prompt-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      handleChatSend(this.dataset.prompt);
    });
  });
});
