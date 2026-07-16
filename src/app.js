const invoke = window.__TAURI__.core.invoke;

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
// const PRINT_BTN_TIMEOUT_MS removed
const FONT_SIZE_MIN = 75;
const FONT_SIZE_MAX = 150;
const FONT_SIZE_DEFAULT = 100;

// Constantes frontend → debe coincidir con src-tauri/src/constants.rs
//   AUDIT_LIMIT_DEFAULT ↔ AUDIT_LOG_DEFAULT_LIMIT
// Config keys (db::configuracion.clave) y métodos de pago
const CFG_TASA_DOLAR = 'tasa_dolar';
const CFG_TASA_UPDATED_AT = 'tasa_updated_at';
const CFG_CAJA_ABIERTA = 'caja_abierta';
const CFG_TEMA = 'tema';
const CFG_FONT_SIZE = 'font_size';
const CFG_SONIDO_HABILITADO = 'sonido_habilitado';
const CFG_SONIDO_VOLUMEN = 'sonido_volumen';
const CFG_HISTORIAL_LIMPIEZA_DIAS = 'historial_limpieza_dias';
const CFG_COMA_AUTOMATICA = 'coma_automatica';
const CFG_CALCULAR_VUELTO = 'calcular_vuelto';
const CFG_REDONDEO_BS = 'redondeo_bs';

// Payment method keys (deben coincidir con constants.rs)
const METODO_PAGO = {
  EFECTIVO_BS: 'efectivo_bs',
  EFECTIVO_USD: 'efectivo_usd',
  BIOPAGO: 'biopago',
  PUNTO: 'punto',
  PAGO_MOVIL: 'pago_movil',
  CREDITO: 'credito',
  MIXTO: 'mixto',
};

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
  productSearchTable: '#product-search-table',
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
  importModal: '#import-modal',
  importFilePath: '#import-file-path',

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
};

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
  return '<td>' + escapeHtml(p.nombre) + '</td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones">&ctdot;</button><div class="dropdown-menu"><button data-action="show-product-detail" data-codigo="' + escapeHtml(p.codigo) + '">Detalles</button>' + editBtn + '</div></div></td>';
}
function createClientRow(c) {
  const isAdmin = currentUser && currentUser.rol === 'admin';
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
  const voidBtn = v.anulada ? '<span class="text-muted">Anulada</span>' : '<button class="btn btn-sm btn-danger void-sale-btn" data-id="' + v.id + '"><i class="nf nf-fa-ban"></i></button>';
  return '<td>' + v.id + '</td><td>' + escapeHtml(v.fecha_hora.split(' ')[1]) + '</td><td>' + escapeHtml(v.username) + '</td><td>' + escapeHtml(metodoLabel) + '</td><td>' + formatUSD(v.total_usd) + '</td><td>' + formatBS(v.total_bs) + '</td><td>' + voidBtn + '</td>';
}
function createDebtSaleCard(v, prodHtml) {
  return '<div class="debt-sale-header"><span># Venta ' + v.id + '</span><span>' + v.fecha_hora + '</span></div><div class="debt-sale-total">Total: ' + formatUSD(v.total_usd) + '</div>' + prodHtml;
}

function createUserRow(u) {
  return '<td>' + escapeHtml(u.username) + '</td><td>' + escapeHtml(u.rol) + '</td><td><button class="btn btn-sm btn-danger delete-user-btn" data-id="' + u.id + '" ' + (u.username === 'admin' ? 'disabled title="No se puede eliminar"' : '') + '><i class="nf nf-fa-trash"></i></button></td>';
}

function createReportRow(v) {
  const metodoLabel = formatMetodoLabel(v.venta.metodo_pago);
  const prodCount = v.productos ? v.productos.length : 0;
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
    const modal = qs('#confirm-modal');
    qs('#confirm-title').textContent = title || 'Confirmar';
    qs('#confirm-message').textContent = msg;
    const okBtn = qs('#confirm-ok-btn');
    okBtn.textContent = okText || 'Confirmar';
    okBtn.onclick = () => { closeModal(modal); resolve(true); };
    qs('#confirm-cancel-btn').onclick = () => { closeModal(modal); resolve(false); };
    qs('#confirm-close').onclick = () => { closeModal(modal); resolve(false); };
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
  qs('#loading-text').textContent = text || 'Cargando...';
  qs('#loading-modal').classList.remove('hidden');
}
function hideLoadingModal() {
  qs('#loading-modal').classList.add('hidden');
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
    if (modal.style.display === 'flex') trapFocus(modal);
    else if (modal.style.display === 'none' && activeModal === modal) releaseFocus();
  });
  obs.observe(modal, { attributes: true, attributeFilter: ['style'] });
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
  const isAdmin = currentUser && currentUser.rol === 'admin';
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
  const el = qs('#historial-limpieza-status');
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

function showView(name) {
  lastViewName = name;
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
    config: loadThemeConfig,
  };
  if (loaders[name]) loaders[name]();
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
      applyRoleUI();
      await loadTasa();
      await loadProductCache();
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
    const today = new Date().toISOString().slice(0,10);
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
  const btn = document.getElementById('tasa-fetch-btn');
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
    productCache = await invoke('list_products', { search: null });
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
  const badge = qs('#cart-badge');
  if (!badge) return;
  if (cart.length === 0) { badge.classList.add('hidden'); return; }
  badge.classList.remove('hidden');
  badge.textContent = cart.length;
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
  selectPaymentMethod('efectivo_bs');
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
  qs(SEL.referenciaGroup).style.display = method === 'pago_movil' ? 'block' : 'none';
  qs(SEL.clienteGroup).style.display = method === 'credito' ? 'block' : 'none';
  qs(SEL.mixtoGroup).style.display = method === 'mixto' ? 'block' : 'none';
  const isCash = method === 'efectivo_bs' || method === 'efectivo_usd';
  const cambioGroup = document.getElementById('cambio-group');
  if (cambioGroup) {
    cambioGroup.style.display = isCash ? 'block' : 'none';
    if (!isCash) { document.getElementById('cambio-recibido').value = ''; document.getElementById('cambio-resultado').classList.add('hidden'); }
  }
  if (method === 'mixto') {
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

  function isBsMethod(m) { return m === 'efectivo_bs' || m === 'biopago' || m === 'punto' || m === 'pago_movil'; }

  function updateConversion() {
    const val = parseFloat(montoInput.value) || 0;
    if (sel.value === 'efectivo_usd') {
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
    refInput.style.display = method === 'pago_movil' ? 'block' : 'none';
    if (method !== 'pago_movil') refInput.value = '';
    if (method === 'efectivo_usd') {
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
  function isBs(m) { return m === 'efectivo_bs' || m === 'biopago' || m === 'punto' || m === 'pago_movil'; }
  for (const row of rows) {
    const sel = row.querySelector('select');
    const input = row.querySelector('.mixto-monto');
    const method = sel.value;
    if (isBs(method)) {
      input.value = (share * tasaActual).toFixed(2).replace(/\.?0+$/, '');
      input._usdValue = share;
    } else {
      input.value = share.toFixed(2).replace(/\.?0+$/, '');
      input._usdValue = share;
    }
    const convSpan = row.querySelector('.mixto-conversion');
    if (method === 'efectivo_usd') {
      convSpan.textContent = '= Bs. ' + formatBS(share * tasaActual);
      convSpan.style.display = 'inline';
    } else if (isBs(method)) {
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
  function isBs(m) { return m === 'efectivo_bs' || m === 'biopago' || m === 'punto' || m === 'pago_movil'; }
  const items = [];
  for (const row of rows) {
    const metodo = row.querySelector('select').value;
    const ref = row.querySelector('.mixto-ref').value.trim() || null;
    const input = row.querySelector('.mixto-monto');
    let monto_usd;
    if (isBs(metodo)) {
      const bs = parseFloat(input.value) || 0;
      monto_usd = tasaActual > 0 ? bs / tasaActual : 0;
    } else {
      monto_usd = parseFloat(input.value) || 0;
    }
    if (monto_usd > 0) {
      items.push({ metodo, monto_usd: monto_usd, referencia: metodo === 'pago_movil' ? ref : null });
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
    if (item.metodo === 'pago_movil' && (!item.referencia || item.referencia.length !== 4)) {
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
  processingPayment = true;
  qs(SEL.paymentConfirmBtn).disabled = true;
  const methodBtn = qs('.payment-method-btn.active');
  if (!methodBtn) { showToast('Seleccione un m\u00e9todo de pago', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
  const metodo = methodBtn.dataset.method;
  let referencia = null, cliente_id = null, pago_detalle = null;
  if (metodo === 'pago_movil') {
    referencia = qs(SEL.referenciaInput).value.trim();
    if (referencia.length !== 4) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
  }
  if (metodo === 'credito') {
    const sel = qs(SEL.clienteSelect);
    if (!sel.value) { showToast('Seleccione un cliente', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
    cliente_id = parseInt(sel.value);
  }
  const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
  if (metodo === 'mixto') {
    pago_detalle = getMixtoData('mixto-items');
    if (!validarMixto(pago_detalle, total, 'mixto-error')) {
      processingPayment = false;
      qs(SEL.paymentConfirmBtn).disabled = false;
      return;
    }
  }
  const productos = cart.map(i => ({ codigo: i.codigo, cantidad: i.cantidad }));
  let total_bs_ingresado = null;
  if (metodo === 'efectivo_bs') {
    const totalMoneda = totalBsRedondeado(total);
    const recibido = parseFloat(document.getElementById('cambio-recibido').value) || 0;
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
  } catch (e) { showToast('Error: ' + e, 'error'); playSound('error'); }
  finally {
    processingPayment = false;
    confirmBtn.disabled = false;
    confirmBtn.classList.remove('loading');
    confirmBtn.textContent = 'Confirmar Pago';
  }
}

/* ========== INVENTORY ========== */
async function loadInventory() {
  const query = qs(SEL.inventorySearch).value.trim();
  const tbody = qs(SEL.inventoryBody);
  showLoading(tbody);
  try {
    const products = await invoke('list_products', { search: query || null });
    tbody.innerHTML = '';
    if (products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyState('<i class="nf nf-fa-archive"></i>', query ? 'Sin resultados' : 'No hay productos', query ? 'Pruebe con otro t\u00e9rmino de b\u00fasqueda' : 'Agregue productos desde el bot\u00f3n superior') + '</td></tr>';
      return;
    }
    const frag = document.createDocumentFragment();
    products.forEach(p => {
      const tr = document.createElement('tr');
      const editBtn = (currentUser && currentUser.rol === 'admin') ? '<button data-action="edit-product" data-codigo="' + p.codigo + '">Editar</button>' : '';
      tr.innerHTML = createInventoryRow(p, editBtn);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function toggleDropdown(btn) {
  const menu = btn.nextElementSibling;
  const isOpen = menu.classList.contains('show');
  closeAllDropdowns();
  if (!isOpen) {
    menu.classList.add('show');
    const btnRect = btn.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = btnRect.right - menu.offsetWidth + 'px';
    menu.style.top = btnRect.bottom + 'px';
    menu.style.right = 'auto';
    menu.style.bottom = 'auto';
    const menuRect = menu.getBoundingClientRect();
    const overflowY = menuRect.bottom - window.innerHeight;
    if (overflowY > 0) {
      menu.style.top = btnRect.top - menuRect.height + 'px';
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
  qs('#client-save-btn').textContent = cliente ? 'Guardar Cambios' : 'Guardar';
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
  qsa('.abono-metodo-btn').forEach(b => b.classList.toggle('active', b.dataset.method === 'efectivo_bs'));
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
  qs(SEL.abonoReferenciaGroup).style.display = method === 'pago_movil' ? 'block' : 'none';
  qs(SEL.abonoMixtoGroup).style.display = method === 'mixto' ? 'block' : 'none';
  if (method === 'mixto') {
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
  if (metodo === 'pago_movil' && metodo !== 'mixto') {
    referencia = qs(SEL.abonoReferencia).value.trim();
    if (referencia.length !== 4) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); processingAbono = false; qs(SEL.abonoConfirmBtn).disabled = false; return; }
  }
  if (metodo === 'mixto') {
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
        if (v.metodo_pago === 'pago_movil' && v.referencia_pago_movil) {
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
    const currentTheme = await invoke('get_config_value', { key: CFG_TEMA });
    const theme = currentTheme || 'claro';
    applyTheme(theme);
    qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  } catch (e) { showToast('Error al cargar tema', 'error'); }
}

const themes = {
  oscuro: { '--bg': '#2A2533', '--card': '#3D364A', '--primary': '#6C5C7A', '--primary-dark': '#544666', '--primary-rgb': '108, 92, 122', '--accent': '#4A7C65', '--accent-dark': '#3A6651', '--accent-rgb': '74, 124, 101', '--danger-rgb': '107, 46, 42', '--overlay': 'rgba(0, 0, 0, 0.6)', '--toast-bg': '#1F1A2E', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.3)', '--hover': '#352F44', '--border': '#4A4460', '--text': '#E0D8E8', '--text-light': '#A098B8', '--sidebar-bg': '#1F1A2E', '--sidebar-text': '#C8C0D8', '--sidebar-text-rgb': '200, 192, 216' },
  claro: { '--bg': '#FAFAFA', '--card': '#FFFFFF', '--primary': '#6C8EBF', '--primary-dark': '#5070A0', '--primary-rgb': '108, 142, 191', '--accent': '#6BAF8D', '--accent-dark': '#4A8F6D', '--accent-rgb': '107, 175, 141', '--danger-rgb': '217, 115, 115', '--overlay': 'rgba(0, 0, 0, 0.15)', '--toast-bg': '#333333', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#F5F5F5', '--border': '#DDDDDD', '--text': '#333333', '--text-light': '#777777', '--sidebar-bg': '#F0F0F0', '--sidebar-text': '#333333', '--sidebar-text-rgb': '51, 51, 51' },
  azul: { '--bg': '#EDF2F7', '--card': '#FFFFFF', '--primary': '#7B9EBF', '--primary-dark': '#5A7D9E', '--primary-rgb': '123, 158, 191', '--accent': '#8FC1B5', '--accent-dark': '#6DA89A', '--accent-rgb': '143, 193, 181', '--danger-rgb': '232, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#2C5282', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#E2E8F0', '--border': '#CBD5E0', '--text': '#2D3748', '--text-light': '#718096', '--sidebar-bg': '#2C5282', '--sidebar-text': '#EBF4FF', '--sidebar-text-rgb': '235, 244, 255' },
  verde: { '--bg': '#F0F7F0', '--card': '#FFFFFF', '--primary': '#8FBC8F', '--primary-dark': '#6B9B6B', '--primary-rgb': '143, 188, 143', '--accent': '#A8D5BA', '--accent-dark': '#7FBF8F', '--accent-rgb': '168, 213, 186', '--danger-rgb': '232, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.15)', '--toast-bg': '#2F4F2F', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#E2EFE2', '--border': '#C8DCC8', '--text': '#2D3748', '--text-light': '#718096', '--sidebar-bg': '#2F4F2F', '--sidebar-text': '#F0FFF0', '--sidebar-text-rgb': '240, 255, 240' },
  morado: { '--bg': '#F5F0FA', '--card': '#FFFFFF', '--primary': '#B39DDB', '--primary-dark': '#9575CD', '--primary-rgb': '179, 157, 219', '--accent': '#CE93D8', '--accent-dark': '#AB47BC', '--accent-rgb': '206, 147, 216', '--danger-rgb': '232, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#4A148C', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#EDE7F6', '--border': '#D1C4E9', '--text': '#2D3748', '--text-light': '#718096', '--sidebar-bg': '#4A148C', '--sidebar-text': '#F3E5F5', '--sidebar-text-rgb': '243, 229, 245' },
  turquesa: { '--bg': '#E6F7F5', '--card': '#F5FFFE', '--primary': '#4DB8AC', '--primary-dark': '#3A9A8E', '--primary-rgb': '77, 184, 172', '--accent': '#80D0C4', '--accent-dark': '#60B8AA', '--accent-rgb': '128, 208, 196', '--danger-rgb': '212, 160, 160', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#1A4A44', '--shadow': '0 2px 12px rgba(26, 74, 68, 0.08)', '--hover': '#E8F5F2', '--border': '#C0E0DA', '--text': '#1A4A44', '--text-light': '#5A7A74', '--sidebar-bg': '#B0E0D6', '--sidebar-text': '#1A4A44', '--sidebar-text-rgb': '26, 74, 68' },
  naranja: { '--bg': '#FDF0E8', '--card': '#FFF8F0', '--primary': '#D47A4A', '--primary-dark': '#C06030', '--primary-rgb': '212, 122, 74', '--accent': '#E8A060', '--accent-dark': '#D48540', '--accent-rgb': '232, 160, 96', '--danger-rgb': '217, 112, 80', '--overlay': 'rgba(0, 0, 0, 0.2)', '--toast-bg': '#5C2A0A', '--shadow': '0 2px 12px rgba(74, 42, 16, 0.08)', '--hover': '#F8EDE0', '--border': '#E8D0B8', '--text': '#4A2A10', '--text-light': '#8A6A4A', '--sidebar-bg': '#F0C8A8', '--sidebar-text': '#5C2A0A', '--sidebar-text-rgb': '92, 42, 10' }
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
    try { localStorage.setItem('tema', theme); } catch (e) {}
  } else {
    prevThemeKeys = null;
  }
}

async function handleThemeClick(theme) {
  applyTheme(theme);
  qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  try {
    await invoke('set_config_value', { key: CFG_TEMA, value: theme });
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
    const saved = await invoke('get_config_value', { key: CFG_FONT_SIZE });
    const pct = parseInt(saved) || FONT_SIZE_DEFAULT;
    applyFontSize(pct);
  } catch (e) { applyFontSize(FONT_SIZE_DEFAULT); }
}

async function saveFontSize(pct) {
  try {
    await invoke('set_config_value', { key: CFG_FONT_SIZE, value: String(pct) });
  } catch (e) {}
}

/* ========== USER MANAGEMENT ========== */
async function loadUserList() {
  try {
    const users = await invoke('list_usuarios');
    const tbody = document.getElementById('user-list-body');
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
  const name = document.getElementById('new-user-name').value.trim();
  const password = document.getElementById('new-user-password').value;
  const rol = document.getElementById('new-user-rol').value;
  if (!name || !password) { showToast('Complete todos los campos', 'error'); return; }
  if (password.length < 4) { showToast('La contrase\u00f1a debe tener al menos 4 caracteres', 'error'); return; }
  try {
    await invoke('create_usuario', { username: name, password, rol });
    showToast('Usuario creado exitosamente');
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-password').value = '';
    loadUserList();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== CHANGE PASSWORD ========== */
async function handleChangePassword() {
  const old = document.getElementById('change-pwd-old').value;
  const newPwd = document.getElementById('change-pwd-new').value;
  const confirm = document.getElementById('change-pwd-confirm').value;
  if (!old || !newPwd || !confirm) { showToast('Complete todos los campos', 'error'); return; }
  if (newPwd !== confirm) { showToast('Las contrase\u00f1as nuevas no coinciden', 'error'); return; }
  if (newPwd.length < 4) { showToast('La contrase\u00f1a debe tener al menos 4 caracteres', 'error'); return; }
  try {
    await invoke('change_password', { request: { old_password: old, new_password: newPwd } });
    showToast('Contrase\u00f1a cambiada exitosamente');
    document.getElementById('change-pwd-old').value = '';
    document.getElementById('change-pwd-new').value = '';
    document.getElementById('change-pwd-confirm').value = '';
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== REPORTS ========== */
async function loadReports() {
  const startDate = document.getElementById('report-start-date').value;
  const endDate = document.getElementById('report-end-date').value;
  if (!startDate || !endDate) { showToast('Seleccione fecha de inicio y fin', 'error'); return; }
  const searchBtn = document.getElementById('report-search-btn');
  const btnHtml = searchBtn.innerHTML;
  try {
    showLoading(searchBtn);
    const filter = {
      start_date: startDate + ' 00:00:00',
      end_date: endDate + ' 23:59:59',
      producto_codigo: document.getElementById('report-product-filter').value.trim() || null,
      username: document.getElementById('report-vendor-filter').value.trim() || null,
    };
    const result = await invoke('get_sales_report', { filter });
    document.getElementById('report-total-count').textContent = result.total_ventas;
    document.getElementById('report-total-usd').textContent = formatUSD(result.total_usd);
    document.getElementById('report-total-bs').textContent = formatBS(result.total_bs);

    const tbody = document.getElementById('report-sales-body');
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

/* ========== VOID SALE ========== */
async function handleVoidSale(ventaId) {
  const ok = await confirmModal('\u00bfEst\u00e1 seguro de anular la venta #' + ventaId + '? Se devolver\u00e1 el stock al inventario.', 'Anular Venta', 'S\u00ed, anular');
  if (!ok) return;
  try {
    const msg = await invoke('void_sale', { ventaId });
    showToast(msg);
    playSound('remove');
    if (qs('#view-cashier')?.classList.contains('active')) loadDailySummary();
    if (qs('#view-reports')?.classList.contains('active')) loadReports();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== SET TODAY ON REPORT DATES ========== */
function setDefaultReportDates() {
  const today = new Date().toISOString().split('T')[0];
  const startInput = document.getElementById('report-start-date');
  const endInput = document.getElementById('report-end-date');
  if (startInput && !startInput.value) startInput.value = today;
  if (endInput && !endInput.value) endInput.value = today;
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async function() {
  // Auth
  qs(SEL.loginBtn).addEventListener('click', handleLogin);
  qs(SEL.loginUsername).addEventListener('keydown', e => {
    if (e.key === 'Enter') qs(SEL.loginPassword).focus();
  });
  qs(SEL.loginPassword).addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('toggle-password')?.addEventListener('click', function() {
    const input = qs(SEL.loginPassword);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    this.innerHTML = isPassword ? ICON.EYE_SLASH : ICON.EYE;
    this.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  qs(SEL.logoutBtn).addEventListener('click', handleLogout);
  document.getElementById('mobile-logout-btn')?.addEventListener('click', handleLogout);

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
  document.getElementById('tasa-fetch-btn')?.addEventListener('click', fetchTasaBcv);

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
  qs(SEL.cartBody).addEventListener('input', e => {
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
  qs('#payment-modal-close').addEventListener('click', closePaymentModal);
  qs('#payment-cancel-btn').addEventListener('click', closePaymentModal);
  qs(SEL.mixtoAddRow).addEventListener('click', function() { addMixtoRow('mixto-items'); });
  document.getElementById('cambio-recibido')?.addEventListener('input', function() {
    const recibido = parseFloat(this.value) || 0;
    const methodBtn = qs('.payment-method-btn.active');
    if (!methodBtn) return;
    const method = methodBtn.dataset.method;
    const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
    const totalMoneda = method === 'efectivo_bs' ? totalBsRedondeado(total) : total;
    const cambioEl = document.getElementById('cambio-resultado');
    const montoEl = document.getElementById('cambio-monto');
    if (recibido > 0 && recibido > totalMoneda && calcularVuelto) {
      const cambio = recibido - totalMoneda;
      const cambioTexto = method === 'efectivo_bs' ? 'Bs. ' + cambio.toFixed(2).replace('.', ',') : formatUSD(cambio);
      montoEl.textContent = cambioTexto;
      cambioEl.classList.remove('hidden');
    } else {
      cambioEl.classList.add('hidden');
    }
  });
  qs('#abono-mixto-add-row').addEventListener('click', function() { addMixtoRow('abono-mixto-items'); });
  qs(SEL.paymentConfirmBtn).addEventListener('click', confirmPayment);
  qsa('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
  });

  // Inventory
  let inventoryTimer = null;
  qs(SEL.inventorySearch).addEventListener('input', () => {
    clearTimeout(inventoryTimer);
    inventoryTimer = setTimeout(loadInventory, 250);
  });
  qs(SEL.inventoryAddBtn).addEventListener('click', openNewProductModal);
  qs(SEL.inventoryExportBtn).addEventListener('click', exportProducts);
  qs(SEL.inventoryImportBtn).addEventListener('click', openImportModal);
  // removed: importProductsFromDb button

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
  });

  // Product modal
  qs('#product-modal-close').addEventListener('click', closeProductModal);
  qs('#product-cancel-btn').addEventListener('click', closeProductModal);
  qs('#product-save-btn').addEventListener('click', saveProduct);
  qs(SEL.productDeleteBtn).addEventListener('click', deleteProduct);
  qs(SEL.productPrecio).addEventListener('input', function() { applyComaAutomatica(this); });

  // Product detail modal
  qs('#product-detail-close').addEventListener('click', closeProductDetail);
  qs('#product-detail-ok-btn').addEventListener('click', closeProductDetail);

  // Creditos
  qs(SEL.creditoAddBtn).addEventListener('click', openCreditoModal);
  qs('#client-modal-close').addEventListener('click', closeClientModal);
  qs('#client-cancel-btn').addEventListener('click', closeClientModal);
  qs('#client-save-btn').addEventListener('click', saveClient);

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
  qs('#close-cashier-close').addEventListener('click', closeCloseCashier);
  qs('#close-cashier-cancel-btn').addEventListener('click', closeCloseCashier);
  qs('#close-cashier-confirm-btn').addEventListener('click', confirmCloseCashier);
  qs('#close-report-close').addEventListener('click', closeReport);
  qs('#close-report-ok-btn').addEventListener('click', closeReport);

  // Event delegation: close report print button
  qs(SEL.closeReportBody).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="print-close-report"]');
    if (btn) printCloseReport();
  });

  /* ========== USER MANAGEMENT ========== */
  const createUserBtn = document.getElementById('create-user-btn');
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

  /* ========== CHANGE PASSWORD ========== */
  const changePwdBtn = document.getElementById('change-pwd-btn');
  if (changePwdBtn) changePwdBtn.addEventListener('click', handleChangePassword);

  /* ========== REPORTS ========== */
  const reportSearchBtn = document.getElementById('report-search-btn');
  if (reportSearchBtn) reportSearchBtn.addEventListener('click', loadReports);
  ['report-start-date', 'report-end-date'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', setDefaultReportDates);
  });

  /* ========== VOID SALE (delegation on daily sales table) ========== */
  document.getElementById('daily-sales-body').addEventListener('click', function(e) {
    const btn = e.target.closest('.void-sale-btn');
    if (btn) handleVoidSale(parseInt(btn.dataset.id));
  });

  /* ========== VIEW-SPECIFIC LOAD ========== */
  // Reports: set default dates on show
  const origShowView = showView;
  const reportsView = document.getElementById('view-reports');
  if (reportsView) {
    const observer = new MutationObserver(function() {
      if (reportsView.classList.contains('active')) {
        loadUserList();
        setDefaultReportDates();
      }
    });
    observer.observe(reportsView, { attributes: true, attributeFilter: ['class'] });
  }

  // Historial cierres
  qs(SEL.historialCierresBtn).addEventListener('click', openHistorialCierres);
  qs('#historial-cierres-close').addEventListener('click', closeHistorialCierres);
  qs('#historial-cierres-ok-btn').addEventListener('click', closeHistorialCierres);

  // Event delegation: historial cierres list
  qs(SEL.historialCierresList).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="show-cierre-detalle"]');
    if (btn) showCierreDetalle(parseInt(btn.dataset.id));
  });

  qs('#historial-cierre-detalle-close').addEventListener('click', closeHistorialDetalle);
  qs('#historial-cierre-detalle-ok-btn').addEventListener('click', closeHistorialDetalle);

  // Debt detail
  qs('#debt-detail-close').addEventListener('click', closeDebtDetail);
  qs('#debt-detail-ok-btn').addEventListener('click', closeDebtDetail);

  // Abono modal
  qs('#abono-close').addEventListener('click', closeAbonoModal);
  qs('#abono-cancel-btn').addEventListener('click', closeAbonoModal);
  qs(SEL.abonoConfirmBtn).addEventListener('click', confirmAbono);
  qs(SEL.abonoMonto).addEventListener('input', function() {
    updateAbonoSaldoRestante();
    if (qs('.abono-metodo-btn.active')?.dataset.method === 'mixto') distributeMixto('abono-mixto-items');
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
      invoke('set_config_value', { key: CFG_SONIDO_HABILITADO, value: this.checked ? SOUND_ENABLED : SOUND_DISABLED }).catch(e => showToast('Error al guardar configuración de sonido', 'error'));
    });
  }
  if (soundVolumeRange) {
    soundVolumeRange.addEventListener('input', function() {
      soundVolume = parseInt(this.value) / 100;
      invoke('set_config_value', { key: CFG_SONIDO_VOLUMEN, value: String(this.value) }).catch(e => showToast('Error al guardar configuración de sonido', 'error'));
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
  const comaToggle = document.getElementById('coma-automatica-toggle');
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
      try { await invoke('set_config_value', { key: CFG_COMA_AUTOMATICA, value: this.checked ? '1' : '0' }); } catch (e) {}
    });
  }
  const vueltoToggle = document.getElementById('calcular-vuelto-toggle');
  if (vueltoToggle) {
    vueltoToggle.addEventListener('change', async function() {
      calcularVuelto = this.checked;
      try { await invoke('set_config_value', { key: CFG_CALCULAR_VUELTO, value: this.checked ? '1' : '0' }); } catch (e) {}
    });
  }
  const redondeoToggle = document.getElementById('redondeo-bs-toggle');
  if (redondeoToggle) {
    redondeoToggle.addEventListener('change', async function() {
      redondeoBs = this.checked;
      try { await invoke('set_config_value', { key: CFG_REDONDEO_BS, value: this.checked ? '1' : '0' }); } catch (e) {}
    });
  }

  // Load saved sound config
  try {
    const savedSound = await invoke('get_config_value', { key: CFG_SONIDO_HABILITADO });
    if (savedSound !== null && savedSound !== undefined) {
      soundEnabled = savedSound === SOUND_ENABLED || savedSound === true;
      if (soundToggle) soundToggle.checked = soundEnabled;
    }
    const savedVol = await invoke('get_config_value', { key: CFG_SONIDO_VOLUMEN });
    if (savedVol !== null && savedVol !== undefined) {
      soundVolume = parseInt(savedVol) / 100 || 0.5;
      if (soundVolumeRange) soundVolumeRange.value = soundVolume * 100;
    }
  } catch (e) {}

  // Load coma automática config
  try {
    const savedComa = await invoke('get_config_value', { key: CFG_COMA_AUTOMATICA });
    comaAutomaticaEnabled = savedComa === '1' || savedComa === true;
    if (comaToggle) comaToggle.checked = comaAutomaticaEnabled;
    updatePrecioInputType();
  } catch (e) {}

  // Load calcular vuelto config
  try {
    const savedVuelto = await invoke('get_config_value', { key: CFG_CALCULAR_VUELTO });
    calcularVuelto = savedVuelto !== '0';
    if (vueltoToggle) vueltoToggle.checked = calcularVuelto;
  } catch (e) {}

  // Load redondeo Bs config
  try {
    const savedRedondeo = await invoke('get_config_value', { key: CFG_REDONDEO_BS });
    redondeoBs = savedRedondeo === '1' || savedRedondeo === true;
    if (redondeoToggle) redondeoToggle.checked = redondeoBs;
  } catch (e) {}

  // Load saved theme on startup
  try {
    const savedTheme = await invoke('get_config_value', { key: CFG_TEMA });
    if (savedTheme) applyTheme(savedTheme);
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
});
