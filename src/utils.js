/* ========== HELPERS ========== */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function createProductRow(p) {
  const name = escapeHtml(p.nombre);
  const inariBadge = p.es_inari ? ' <span class="badge badge-inari">Inari</span>' : '';
  return '<td title="' + name + '">' + name + inariBadge + '</td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><button class="btn btn-primary btn-sm" data-action="add-to-cart" data-codigo="' + escapeHtml(p.codigo) + '">+</button></td>';
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
  const editBtn = (currentUser && currentUser.rol === ROL_ADMIN) ? '<button class="cart-edit-price-btn" data-action="edit-price" data-codigo="' + code + '" title="Editar precio unitario"><i class="nf nf-fa-pencil"></i></button>' : '';
  return '<td><div class="cart-product-info"><span class="cart-product-name" title="' + name + '">' + name + '</span><span class="cart-product-code">' + code + '</span></div></td><td><div class="cart-qty-wrap"><button class="cart-qty-btn" data-action="qty-dec" data-codigo="' + code + '">&minus;</button><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="1" max="' + item.stock + '" data-codigo="' + code + '"><button class="cart-qty-btn" data-action="qty-inc" data-codigo="' + code + '">+</button></div></td><td class="' + cls + '"><span class="cart-total-text">' + totalText + '</span>' + editBtn + '</td><td><button class="cart-remove-btn" data-action="remove-from-cart" data-codigo="' + code + '" title="Eliminar"><i class="nf nf-fa-trash"></i></button></td>';
}
function createInventoryRow(p, editBtn) {
  var stockClass = (p.stock < p.stock_minimo) ? ' class="low-stock"' : '';
  var stockBadge = (p.stock < p.stock_minimo) ? '<span class="badge badge-danger" title="Debajo del stock mínimo">!</span>' : '';
  var costo = p.costo || 0;
  var margen = (costo > 0 && p.precio_usd > 0) ? ((p.precio_usd - costo) / p.precio_usd * 100).toFixed(1) + '%' : '—';
  var tasa = tasaInventario > 0 ? tasaInventario : tasaActual;
  var inariBadge = p.es_inari ? ' <span class="badge badge-inari">Inari</span>' : '';
  var inariToggleBtn = (currentUser && currentUser.rol === ROL_ADMIN)
    ? (p.es_inari
        ? '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="false"><i class="nf nf-fa-fire"></i> Quitar Inari</button>'
        : '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="true"><i class="nf nf-fa-fire"></i> Marcar Inari</button>')
    : '';
  return '<td>' + escapeHtml(p.nombre) + inariBadge + '</td><td>' + formatUSD(p.precio_usd) + '</td><td>' + formatUSD(costo) + '</td><td>' + margen + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasa) + '</span></td><td' + stockClass + '>' + p.stock + ' ' + stockBadge + '</td><td>' + p.stock_minimo + '</td><td><div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones">&ctdot;</button><div class="dropdown-menu"><button data-action="show-product-detail" data-codigo="' + escapeHtml(p.codigo) + '"><i class="nf nf-fa-info_circle"></i> Detalles</button><button data-action="show-product-history" data-codigo="' + escapeHtml(p.codigo) + '" data-nombre="' + escapeHtml(p.nombre) + '"><i class="nf nf-fa-history"></i> Historial</button>' + editBtn + inariToggleBtn + '</div></div></td>';
}
function createClientRow(c) {
  const isAdmin = currentUser && currentUser.rol === ROL_ADMIN;
  var activoBadge = c.credito_activo
    ? '<span class="badge badge-success" style="font-size:10px">Activo</span>'
    : '<span class="badge badge-danger" style="font-size:10px">Inactivo</span>';
  var ultimaCompra = c.ultima_compra
    ? escapeHtml(c.ultima_compra.split(' ')[0])
    : '<span class="text-muted">—</span>';
  var dropdownItems = '';
  dropdownItems += '<button data-action="open-debt-detail" data-id="' + c.id + '"><i class="nf nf-fa-info_circle"></i> Detalles</button>';
  dropdownItems += '<button data-action="open-abono" data-id="' + c.id + '"><i class="nf nf-fa-money"></i> Abonar / Pagar</button>';
  if (isAdmin) {
    var toggleIcon = c.credito_activo ? 'nf-fa-toggle-on' : 'nf-fa-toggle-off';
    var toggleLabel = c.credito_activo ? 'Desactivar cr&eacute;dito' : 'Activar cr&eacute;dito';
    var deleteBtn = '<button data-action="delete-cliente" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '" data-deuda="' + c.saldo_deuda_usd + '"><i class="nf nf-fa-trash"></i> Eliminar</button>';
    dropdownItems += '<div class="dropdown-divider"></div>' +
      '<button data-action="toggle-cliente-credito" data-id="' + c.id + '" data-activo="' + c.credito_activo + '"><i class="nf ' + toggleIcon + '"></i> ' + toggleLabel + '</button>' +
      '<button data-action="edit-cliente" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '"><i class="nf nf-fa-pencil"></i> Editar</button>' +
      '<button data-action="open-quick-debt" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '"><i class="nf nf-fa-bolt"></i> Deuda r&aacute;pida</button>' +
      deleteBtn;
  }
  var dropdown = '<div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones">&ctdot;</button><div class="dropdown-menu">' + dropdownItems + '</div></div>';
  return '<td>' + escapeHtml(c.nombre) + '</td><td>' + activoBadge + '</td><td>' + formatUSD(c.saldo_deuda_usd) + '</td><td>' + ultimaCompra + '</td><td>' + dropdown + '</td>';
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
let carts = [{ id: 1, items: [], folded: false }];
let cart = carts[0].items;
let cartIdCounter = 1;
let recentProducts = [];
const RECENT_MAX = 10;
let tasaActual = 0;
let tasaInventario = 0;
let tasaInventarioFecha = '';
let cartShowBs = false;
let comboCache = [];
let editingProduct = null;
let editingClienteId = null;
let abonoClienteId = null;
let selectedClienteId = null;
let productCache = [];
let creditoRows = [];

let lastCloseReportData = null;
let lastViewName = VIEW.SALES;
let comaAutomaticaEnabled = false;
let calcularVuelto = true;
let redondeoBs = false;
let redondeoTotal = false;
let soundEnabled = true;
let soundVolume = 0.5;
let auditOffset = 0;
let auditLimit = AUDIT_LIMIT_DEFAULT;

/* ========== TOAST QUEUE ========== */
let toastQueue = [];
let toastVisible = 0;

function hideToast(el) {
  if (el._closing) return;
  el._closing = true;
  if (el._frame) cancelAnimationFrame(el._frame);
  if (el._timer) clearTimeout(el._timer);
  if (el._resumeTimer) clearTimeout(el._resumeTimer);
  el._pausedAt = null;
  el.classList.add('exit');
  setTimeout(() => {
    el.remove();
    toastVisible--;
    if (toastQueue.length > 0) {
      const next = toastQueue.shift();
      showToast(next.msg, next.type, next.action);
    }
  }, TOAST.FADE_MS);
}

function toastTick(el, cfg) {
  if (el._pausedAt !== null) return;
  const now = performance.now();
  const dt = now - el._lastTick;
  el._lastTick = now;
  el._remaining -= dt;

  const p = 1 - Math.max(0, el._remaining) / cfg.duration;
  const deg = 360 * (1 - p);
  const m = `conic-gradient(#fff 0deg, #fff ${deg}deg, transparent ${deg}deg)`;
  el._border.style.mask = m;
  el._border.style.webkitMask = m;

  if (el._remaining <= 0) {
    hideToast(el);
    return;
  }
  el._frame = requestAnimationFrame(() => toastTick(el, cfg));
}

function toastPause(el) {
  if (el._pausedAt !== null) return;
  el._pausedAt = performance.now();
  if (el._frame) { cancelAnimationFrame(el._frame); el._frame = null; }
  if (el._timer) { clearTimeout(el._timer); el._timer = null; }
  if (el._resumeTimer) { clearTimeout(el._resumeTimer); el._resumeTimer = null; }
}

function toastStartResume(el, cfg) {
  if (el._resumeTimer) clearTimeout(el._resumeTimer);
  el._resumeTimer = setTimeout(() => {
    if (el._pausedAt !== null) {
      el._pausedAt = null;
      el._lastTick = performance.now();
      el._remaining = Math.max(0, el._remaining);
      if (el._remaining <= 0) { hideToast(el); return; }
      el._timer = setTimeout(() => hideToast(el), el._remaining);
      el._frame = requestAnimationFrame(() => toastTick(el, cfg));
    }
  }, 1000);
}

function showToast(msg, type = 'success', action) {
  const cfg = TOAST.TYPES[type] || TOAST.TYPES.info;
  const container = qs(SEL.toastContainer);
  if (!container) return;

  if (toastVisible >= TOAST.MAX_VISIBLE) {
    toastQueue.push({ msg, type, action });
    return;
  }

  const el = document.createElement('div');
  el.className = 'toast';

  const border = document.createElement('div');
  border.className = 'toast-border';
  border.style.borderColor = cfg.color;
  el.appendChild(border);
  el._border = border;

  const icon = document.createElement('i');
  icon.className = 'nf ' + cfg.icon + ' toast-icon';
  icon.style.color = cfg.color;
  el.appendChild(icon);

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-msg';
  msgSpan.textContent = msg;
  el.appendChild(msgSpan);

  if (action && action.label && action.callback) {
    const actBtn = document.createElement('button');
    actBtn.className = 'toast-action';
    actBtn.textContent = action.label;
    actBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      action.callback();
      hideToast(el);
    });
    el.appendChild(actBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Cerrar');
  closeBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    hideToast(el);
  });
  el.appendChild(closeBtn);

  // Timer state
  el._remaining = cfg.duration;
  el._lastTick = performance.now();
  el._pausedAt = null;
  el._frame = null;
  el._timer = null;
  el._resumeTimer = null;

  // Start border animation + auto-dismiss
  el._timer = setTimeout(() => hideToast(el), cfg.duration);
  el._frame = requestAnimationFrame(() => toastTick(el, cfg));

  // Pause on hover / touch
  el.addEventListener('mouseenter', () => toastPause(el));
  el.addEventListener('mouseleave', () => toastStartResume(el, cfg));
  el.addEventListener('touchstart', () => toastPause(el), { passive: true });
  el.addEventListener('touchend', function(e) {
    // Only pause on actual touch, not on swipe-dismiss
    const touch = e.changedTouches[0];
    const rect = el.getBoundingClientRect();
    if (touch.clientX - rect.left < rect.width * 0.7) {
      toastStartResume(el, cfg);
    }
  }, { passive: true });

  // Resume on click outside (mobile)
  function outsideClick(e) {
    if (el._pausedAt !== null && !el.contains(e.target)) {
      toastStartResume(el, cfg);
    }
  }
  document.addEventListener('touchstart', outsideClick, { passive: true });
  document.addEventListener('mousedown', outsideClick);

  el.addEventListener('click', function(e) {
    if (e.target === el || e.target === msgSpan) hideToast(el);
  });

  // Swipe to dismiss on mobile
  if (IS_ANDROID || window.innerWidth <= 768) {
    let startX = 0;
    el.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    el.addEventListener('touchend', function(e) {
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > 60) hideToast(el);
    }, { passive: true });
  }

  container.appendChild(el);
  toastVisible++;
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
function showSkeleton(el, cols) {
  var rows = '';
  for (var r = 0; r < 5; r++) {
    rows += '<tr class="skeleton-row">';
    for (var c = 0; c < cols; c++) {
      rows += '<td><div class="skeleton-cell"></div></td>';
    }
    rows += '</tr>';
  }
  el.innerHTML = rows;
}
async function withButtonLock(btn, fn) {
  if (!btn || btn.disabled) return;
  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner" style="display:inline-flex;align-items:center;gap:6px"><span class="spinner" style="width:14px;height:14px;border-width:2px"></span></span>';
  try { await fn(); } finally { btn.disabled = false; btn.innerHTML = orig; }
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
let lastFocused = null;
function showModal(el) {
  lastFocused = document.activeElement;
  qsa('.modal').forEach(m => { if (m !== el) m.classList.add('hidden'); });
  el.classList.remove('hidden');
}
function closeModal(el) {
  el.classList.add('hidden');
  if (lastFocused && lastFocused.focus) {
    try { lastFocused.focus(); } catch (_) {}
    lastFocused = null;
  }
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
function parseInput(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
function totalBsRedondeado(totalUsd) {
  const bs = totalUsd * tasaActual;
  if (redondeoTotal) return Math.round(bs);
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

/* ========== TABLE SORTING ========== */
function initTableSorting(tableId) {
  const table = document.getElementById(tableId);
  if (!table || table.dataset.sortInit) return;
  table.dataset.sortInit = '1';
  const headers = table.querySelectorAll('th[data-sortable]');
  let currentSort = { col: null, asc: true };
  headers.forEach(th => {
    th.addEventListener('click', function() {
      const key = this.getAttribute('data-sortable');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const isAsc = currentSort.col === key ? !currentSort.asc : true;
      currentSort = { col: key, asc: isAsc };
      headers.forEach(h => { h.classList.remove('sort-asc', 'sort-desc'); });
      this.classList.add(isAsc ? 'sort-asc' : 'sort-desc');
      rows.sort((a, b) => {
        const aVal = a.getAttribute('data-sort-' + key) || a.children[Array.from(th.parentNode.children).indexOf(th)]?.textContent?.trim() || '';
        const bVal = b.getAttribute('data-sort-' + key) || b.children[Array.from(th.parentNode.children).indexOf(th)]?.textContent?.trim() || '';
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return isAsc ? aNum - bNum : bNum - aNum;
        return isAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
      rows.forEach(r => tbody.appendChild(r));
    });
  });
}

/* ========== CONNECTION MONITOR ========== */
function initConnectionMonitor() {
  const indicator = qs(SEL.offlineIndicator);
  if (!indicator) return;
  function update() {
    indicator.classList.toggle('visible', !navigator.onLine);
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

/* ========== TABLE SORTING INIT ========== */
document.addEventListener('viewChanged', function(e) {
  const map = {
    inventory: 'inventory-table',
    cashier: 'daily-sales-table',
    audit: 'audit-table',
    reportes: 'report-sales-table',
    creditos: 'creditos-table',
  };
  const id = map[e.detail];
  if (id) initTableSorting(id);
});
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
  const navBadge = qs(SEL.syncNavConflicts);
  if (!countEl) return;
  try {
    const conflictos = await invoke('get_conflictos');
    const n = conflictos.length;
    countEl.textContent = n;
    if (navBadge) {
      navBadge.textContent = n;
      navBadge.classList.toggle('hidden', n === 0);
    }
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

