// Lazy access to Tauri IPC bridge to avoid crash when __TAURI__ isn't ready yet
const invoke = ((...args) => {
  const fn = window.__TAURI__?.core?.invoke;
  if (!fn) throw new Error('Backend no disponible');
  return fn(...args);
});

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
const CFG_REDONDEO_TOTAL = 'redondeo_total';
const CFG_SIDEBAR_AUTO_HIDE = 'sidebar_auto_hide';
const CFG_CONFIRMAR_VENTA = 'confirmar_venta';
const CFG_ANIMACIONES = 'animaciones_habilitadas';
const CFG_HOVER_CARD = 'hover_card';
const CFG_MODAL_DRAG = 'modal_drag';
const CFG_IA_HABILITADO = 'ia_habilitado';
const CFG_OPENROUTER_API_KEY = 'openrouter_api_key';
const CFG_OPENROUTER_MODEL = 'openrouter_model';
const CFG_TASA_DOLAR = 'tasa_dolar';
const CFG_DISPOSITIVO_ID = 'dispositivo_id';

// Payment method labels (source of truth — matches sales.rs)
const METODO_LABELS = {
  efectivo_bs: 'Efectivo Bs.', efectivo_usd: 'Efectivo USD', biopago: 'Biopago',
  punto: 'Punto', pago_movil: 'Pago M\u00f3vil', credito: 'Cr\u00e9dito', mixto: 'Mixto'
};
function formatMetodoLabel(m) { return METODO_LABELS[m] || m; }

// View names
const VIEW = {
  SALES: 'sales',
  INVENTORY: 'inventory',
  CREDITOS: 'creditos',
  CASHIER: 'cashier',
  AUDIT: 'audit',
  REPORTS: 'reports',
  CONFIG: 'config',
  SYNC: 'sync',
};

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
const CFG_MAX_BACKUPS = 'max_backups';
const DEFAULT_MAX_BACKUPS = 10;

// UI Timing & Layout Constants
const TOAST = {
  TYPES: {
    success: { icon: 'nf-fa-check_circle', duration: 3000, color: 'var(--accent)' },
    error: { icon: 'nf-fa-ban', duration: 5000, color: 'var(--danger)' },
    warning: { icon: 'nf-fa-warning', duration: 4000, color: 'var(--danger)' },
    info: { icon: 'nf-fa-info_circle', duration: 3000, color: 'var(--primary)' },
  },
  MAX_VISIBLE: 5,
  FADE_MS: 300,
};
const KEYBOARD = { THRESHOLD: 100, PAD_OFFSET: 40, SCROLL_DELAY_MS: 300 };
const SIDEBAR = { HIDE_DELAY: 250, HOVER_MARGIN: 14, HOVER_CHECK_MS: 350 };
const FONT = { SIZE_STEP: 5 };
const BREAKPOINT = { DESKTOP: 768, MOBILE: 500, PHONE: 600 };
const TIMING = {
  FOCUS_DELAY_MS: 100,
  SCROLL_DELAY_MS: 300,
  SWIPE_DELETE_MS: 300,
  FAB_DRAG_START_MS: 250,
  FAB_DRAG_THRESHOLD: 4,
  FAB_TOUCH_RESET_MS: 100,
  REG_REDIRECT_MS: 1500,
  SCROLL_BEFORE_MS: 200,
};

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
  AUTO_MIN: 10,
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
const REPORT_PAGE_SIZE = 50;
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
async function getUserConfig(key) {
  return invoke('get_user_config_value', { key });
}
async function setUserConfig(key, value) {
  return invoke('set_user_config_value', { key, value });
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
  toastContainer: '#toast-container',
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
  bottomTabs: '#bottom-tabs',
  sidebarUser: '#sidebar-user',
  logoutBtn: '#logout-btn',
  syncIndicator: '#sync-indicator',
  syncIndicatorText: '#sync-indicator-text',

  // --- Sales (POS) ---
  tasaInput: '#tasa-input',
  tasaWarning: '#tasa-warning',
  productSearch: '#product-search',
  productSearchBody: '#product-search-body',
  productSearchTable: '#product-search-table',
  productSearchGrid: '#product-search-grid',
  cartFab: '#cart-fab',
  cartFabBadge: '#cart-fab-badge',
  cartBackdrop: '#cart-backdrop',
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
  clienteSelect: '#client-select-dropdown',
  clienteSelectBtn: '#client-select-btn',
  clienteSelectMenu: '#client-select-menu',
  mixtoItems: '#mixto-items',
  mixtoError: '#mixto-error',
  mixtoWarning: '#mixto-warning',
  mixtoWarningText: '#mixto-warning-text',
  mixtoAddRow: '#mixto-add-row',
  referenciaGroup: '#referencia-group',
  clienteGroup: '#cliente-group',
  mixtoGroup: '#mixto-group',
  paymentNota: '#payment-nota',

  // --- Inventory ---
  inventorySearch: '#inventory-search',
  inventoryBody: '#inventory-body',
  inventoryTable: '#inventory-table',
  inventoryAddBtn: '#inventory-add-btn',
  inventoryExportBtn: '#inventory-export-btn',
  inventoryImportBtn: '#inventory-import-btn',
  inventoryTasaBtn: '#inventory-tasa-btn',
  tasaHistorialModal: '#tasa-historial-modal',
  tasaHistorialList: '#tasa-historial-list',
  tasaHistorialApply: '#tasa-historial-apply',
  tasaHistorialClear: '#tasa-historial-clear',
  tasaHistorialClose: '#tasa-historial-close',
  tasaHistorialOkBtn: '#tasa-historial-ok-btn',
  tasaCalendarWrap: '#tasa-calendar-wrap',
  tasaActualLabel: '#tasa-actual-label',
  inventoryInariBtn: '#inventory-inari-btn',
  inariConfigToggle: '#inari-config-toggle',
  inariSubcatBar: '#inari-subcat-bar',
  inariSubcatBtn: '.inari-subcat-btn',
  inariCreateComboBtn: '#inari-create-combo-btn',
  comboModal: '#combo-modal',
  comboNombre: '#combo-nombre',
  comboPrecio: '#combo-precio',
  comboSearch: '#combo-search',
  comboAvailableList: '#combo-available-list',
  comboSelectedList: '#combo-selected-list',
  comboCountBadge: '#combo-count-badge',
  comboError: '#combo-error',
  comboSaveBtn: '#combo-save-btn',
  comboCancelBtn: '#combo-cancel-btn',
  comboModalClose: '#combo-modal-close',
  productModal: '#product-modal',
  productModalTitle: '#product-modal-title',
  productSaveText: '#product-save-text',
  productDeleteBtn: '#product-delete-btn',
  productNombre: '#product-nombre',
  productPrecio: '#product-precio',
  productPrecioLabel: '#product-precio-label',
  productCostoLabel: '#product-costo-label',
  productStock: '#product-stock',
  productStockLabel: '#product-stock-label',
  productStockMinimo: '#product-stock-minimo',
  productStockMinimoLabel: '#product-stock-minimo-label',
  productCosto: '#product-costo',
  productDetailModal: '#product-detail-modal',
  detailNombre: '#detail-nombre',
  detailPrecio: '#detail-precio',
  detailPrecioLabel: '#detail-precio-label',
  detailCosto: '#detail-costo',
  detailCostoLabel: '#detail-costo-label',
  detailMargen: '#detail-margen',
  detailStock: '#detail-stock',
  detailStockLabel: '#detail-stock-label',
  detailStockMinimo: '#detail-stock-minimo',
  detailStockMinimoLabel: '#detail-stock-minimo-label',
  detailCreated: '#detail-created',

  // --- Creditos / Clientes ---
  creditosBody: '#creditos-body',
  creditoAddBtn: '#credito-add-btn',
  quickDebtModal: '#quick-debt-modal',
  quickDebtClienteNombre: '#quick-debt-cliente-nombre',
  quickDebtMonto: '#quick-debt-monto',
  quickDebtConfirm: '#quick-debt-confirm',
  quickDebtCancel: '#quick-debt-cancel-btn',
  quickDebtClose: '#quick-debt-close',
  quickDebtMontoBs: '#quick-debt-monto-bs',
  clientModal: '#client-modal',
  clientModalTitle: '#client-modal-title',
  clientNombre: '#client-nombre',
  clientNombreError: '#client-nombre-error',
  creditosTotalPersonas: '#creditos-total-personas',
  creditosConDeuda: '#creditos-con-deuda',
  creditosDeudaTotal: '#creditos-deuda-total',
  debtDetailModal: '#debt-detail-modal',
  debtDetailTitle: '#debt-detail-title',
  debtDetailDebt: '#debt-detail-debt',
  debtDetailList: '#debt-detail-list',
  abonoModal: '#abono-modal',
  abonoClienteNombre: '#abono-cliente-nombre',
  abonoDeudaUsd: '#abono-deuda-usd',
  abonoDeudaBs: '#abono-deuda-bs',
  abonoMonto: '#abono-monto',
  abonoMontoBs: '#abono-monto-bs',
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
  modalDragToggle: '#modal-drag-toggle',
  animationsToggle: '#animations-toggle',
  soundVolume: '#sound-volume',
  historialLimpiezaDias: '#historial-limpieza-dias',
  historialLimpiezaSave: '#historial-limpieza-save',

  // --- Sync / Conflictos ---
  syncUrl: '#sync-url',
  syncKey: '#sync-key',
  conflictCount: '#conflict-count',
  syncNavConflicts: '#sync-nav-conflicts',
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
  syncUploadUsuariosTime: '#sync-upload-usuarios-time',
  syncDownloadUsuariosTime: '#sync-download-usuarios-time',
  uploadUsuariosBtn: '#upload-usuarios-btn',
  downloadUsuariosBtn: '#download-usuarios-btn',

  // --- Tasa ---
  tasaFetchBtn: '#tasa-fetch-btn',
  tasaConnectionBadge: '#tasa-connection-badge',
  syncDownloadBtn: '#sync-download-btn',

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
  reportPdfBtn: '#report-pdf-btn',
  vendorSalesSection: '#vendor-sales-section',
  vendorSalesBody: '#vendor-sales-body',
  reportPagination: '#report-pagination',
  reportPrevBtn: '#report-prev-btn',
  reportNextBtn: '#report-next-btn',
  reportPageInfo: '#report-page-info',
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
  saleDetailShareBtn: '#sale-detail-share-btn',
  saleDetailNotaWrap: '#sale-detail-nota-wrap',
  saleDetailNota: '#sale-detail-nota',
  saleDetailObsWrap: '#sale-detail-obs-wrap',
  saleDetailObs: '#sale-detail-obs',
  viewReports: '#view-reports',
  gotoReportsBtn: '#goto-reports-btn',

  // --- User Management ---
  userListBody: '#user-list-body',
  newUserName: '#new-user-name',
  newUserPassword: '#new-user-password',
  newUserRol: '#new-user-rol',
  createUserBtn: '#create-user-btn',
  userListRefreshBtn: '#user-list-refresh-btn',
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
  precioHistoryModal: '#precio-history-modal',
  precioHistoryTitle: '#precio-history-title',
  precioHistoryBody: '#precio-history-body',
  precioHistoryClose: '#precio-history-close',
  precioHistoryOkBtn: '#precio-history-ok-btn',

  // --- Confirm / Loading Modals ---
  confirmModal: '#confirm-modal',
  confirmTitle: '#confirm-title',
  confirmMessage: '#confirm-message',
  confirmOkBtn: '#confirm-ok-btn',
  confirmCancelBtn: '#confirm-cancel-btn',
  confirmClose: '#confirm-close',
  promptModal: '#prompt-modal',
  promptTitle: '#prompt-title',
  promptMessage: '#prompt-message',
  promptInput: '#prompt-input',
  promptOkBtn: '#prompt-ok-btn',
  promptCancelBtn: '#prompt-cancel-btn',
  promptClose: '#prompt-close',
  loadingText: '#loading-text',
  loadingModal: '#loading-modal',

  // --- Sync buttons ---
  backupDbBtn: '#backup-db-btn',
  backupMaxInput: '#backup-max-input',
  backupMaxSave: '#backup-max-save',
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
  productEsPesable: '#product-es-pesable',
  productCancelBtn: '#product-cancel-btn',
  productSaveBtn: '#product-save-btn',
  productDetailClose: '#product-detail-close',
  productDetailOkBtn: '#product-detail-ok-btn',
  stockAdjustModal: '#stock-adjust-modal',
  stockAdjustClose: '#stock-adjust-close',
  stockAdjustNombre: '#stock-adjust-nombre',
  stockAdjustActual: '#stock-adjust-actual',
  stockAdjustCantidad: '#stock-adjust-cantidad',
  stockAdjustCantidadError: '#stock-adjust-cantidad-error',
  stockAdjustMotivo: '#stock-adjust-motivo',
  stockAdjustMotivoError: '#stock-adjust-motivo-error',
  stockAdjustConfirmBtn: '#stock-adjust-confirm-btn',
  stockAdjustCancelBtn: '#stock-adjust-cancel-btn',
  clientModalClose: '#client-modal-close',
  clientCancelBtn: '#client-cancel-btn',
  clientSaveBtn: '#client-save-btn',
  clientEsTemporal: '#client-es-temporal',
  tempHistoryBtn: '#temp-history-btn',
  tempHistoryModal: '#temp-history-modal',
  tempHistoryBody: '#temp-history-body',
  tempHistoryClose: '#temp-history-close',
  tempHistoryOkBtn: '#temp-history-ok-btn',
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
  redondeoTotalToggle: '#redondeo-total-toggle',
  sidebarAutoHideToggle: '#sidebar-auto-hide-toggle',

  // --- Calculator ---
  calcModal: '#calculator-modal',
  calcExpression: '#calc-expression',
  calcResult: '#calc-result',
  calcTasaBtn: '#calc-tasa-btn',
  calcBtn: '#calc-btn',
  calcClose: '#calculator-close',
  calcEquals: '#calc-equals',
  calcDockBtn: '#calculator-dock-btn',
  calcDockBar: '#calc-dock-bar',
  calcDockBarBtn: '#calc-dock-btn',
  calcButtons: '.calc-buttons',

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

  // --- Changelog ---
  changelogBtn: '#changelog-btn',
  changelogModal: '#changelog-modal',
  changelogClose: '#changelog-close',

  // --- Cart hold ---
  cartTabs: '#cart-tabs',
  holdCartBtn: '#hold-cart-btn',

  // --- Connection / Sync ---
  offlineIndicator: '#offline-indicator',

  // --- Audit ---
  auditSentinel: '#audit-sentinel',

  // --- Users ---
  resetUsersBtn: '#reset-users-btn',

  // --- Selectors ---
  guideTabActive: '.guide-tab.active',
  abonoMetodoBtnActive: '.abono-metodo-btn.active',

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

  // --- Hardcoded selectors centralized ---
  salesBody: '.sales-body',
  paymentMethodActive: '.payment-method-btn.active',
  invPage: '[data-inv-page]',
  dashboardChartToggle: '.dashboard-chart-toggle button',
  dashboardChartContainer: '.dashboard-chart-container',
  dataPiePeriod: '[data-pie-period]',
  configCardHeader: '.config-card-header',
  creditosBodyTr: '#creditos-body tr',
  customSelectOpen: '.custom-select.open',
  salesLeftCenter: '.sales-left, .sales-center',
  viewActive: '.view.active',
  salesDivider: '#sales-divider',
  cashierNavBadge: '#cashier-nav-badge',
  movimientosBtn: '#movimientos-btn',
  movimientosModal: '#movimientos-modal',
  movimientosClose: '#movimientos-modal-close',
  movimientosBody: '#movimientos-body',
  movimientosList: '#movimientos-list',
  movimientosForm: '#movimientos-form',
  movimientosTipo: '#movimientos-tipo',
  movimientosMontoBs: '#movimientos-monto-bs',
  movimientosMontoUsd: '#movimientos-monto-usd',
  movimientosConcepto: '#movimientos-concepto',
  movimientosSaldo: '#movimientos-saldo',
  movimientosTotalIngresos: '#movimientos-total-ingresos',
  movimientosTotalEgresos: '#movimientos-total-egresos',
  movimientosSaveBtn: '#movimientos-save-btn',
  movimientosTasaRefresh: '#movimientos-tasa-refresh',
  abonoTasaRefresh: '#abono-tasa-refresh',

  // --- v1.03 Features ---
  loginGreeting: '#login-greeting',
  loginGreetingTime: '#login-greeting-time',
  loginGreetingText: '#login-greeting-text',
  loginGreetingDate: '#login-greeting-date',
  colToggleBtn: '.col-toggle-btn',
  globalSearchOverlay: '#global-search-overlay',
  globalSearchInput: '#global-search-input',
  globalSearchClose: '#global-search-close',
  globalSearchResults: '#global-search-results',
  productHoverCard: '#product-hover-card',
  productHoverCardBody: '#product-hover-card-body',
  hoverCardToggle: '#hover-card-toggle',
  flyEl: '.fly-to-cart',
};

