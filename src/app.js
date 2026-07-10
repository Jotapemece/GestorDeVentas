const invoke = window.__TAURI__.core.invoke;

let currentUser = null;
let cart = [];
let tasaActual = 0;
let editingProduct = null;
let abonoClienteId = null;
let categorias = [];
let productCache = [];
let lastReceipt = null;
let lastCloseReportData = null;
let soundEnabled = true;
let soundVolume = 0.5;
let auditOffset = 0;
let auditLimit = 50;

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

function formatUSD(v) { return '$' + v.toFixed(2); }
function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }
function applyRoleUI() {
  const isAdmin = currentUser && currentUser.rol === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
}

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = soundVolume * 0.3;
    const now = ctx.currentTime;
    switch (type) {
      case 'add': osc.frequency.setValueAtTime(880, now); osc.type = 'sine'; gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15); osc.start(now); osc.stop(now + 0.15); break;
      case 'remove': osc.frequency.setValueAtTime(440, now); osc.type = 'sine'; gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1); osc.start(now); osc.stop(now + 0.1); break;
      case 'success': osc.frequency.setValueAtTime(523, now); osc.frequency.setValueAtTime(659, now + 0.1); osc.frequency.setValueAtTime(784, now + 0.2); osc.type = 'sine'; gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4); osc.start(now); osc.stop(now + 0.4); break;
      case 'error': osc.frequency.setValueAtTime(200, now); osc.type = 'sawtooth'; gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); osc.start(now); osc.stop(now + 0.3); break;
      case 'cancel': osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(200, now + 0.2); osc.type = 'sine'; gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25); osc.start(now); osc.stop(now + 0.25); break;
    }
  } catch(e) {}
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
}

function showView(name) {
  qsa('.view').forEach(v => v.classList.remove('active'));
  qsa('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  qs(`.nav-btn[data-view="${name}"]`).classList.add('active');
  const loaders = {
    inventory: loadInventory,
    creditos: loadCreditos,
    cashier: loadDailySummary,
    audit: loadAudit,
    config: loadThemeConfig,
  };
  if (loaders[name]) loaders[name]();
}

/* ========== AUTH ========== */
async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  if (!username || !password) { errEl.textContent = 'Complete todos los campos'; return; }
  try {
    const res = await invoke('login', { username, password });
    if (res.success) {
      if (document.getElementById('remember-me').checked) {
        localStorage.setItem('recordar_usuario', username);
      } else {
        localStorage.removeItem('recordar_usuario');
      }
      currentUser = res.usuario;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('main-app').style.display = 'flex';
      document.getElementById('sidebar-user').textContent = currentUser.username + ' (' + currentUser.rol + ')';
      applyRoleUI();
      await loadTasa();
      await loadProductCache();
      await loadCategorias();
      showView('sales');
      renderProductSearch();
      renderCart();
    } else {
      errEl.textContent = res.message;
    }
  } catch (e) {
    errEl.textContent = 'Error: ' + e;
  }
}

async function handleLogout() {
  if (!confirm('\u00bfEst\u00e1 seguro de cerrar sesi\u00f3n?')) return;
  await invoke('logout');
  currentUser = null; cart = [];
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
}

/* ========== TASA ========== */
async function loadTasa() {
  try {
    tasaActual = await invoke('get_tasa');
    document.getElementById('tasa-input').value = tasaActual;
    const updatedAt = await invoke('get_config_value', { key: 'tasa_updated_at' });
    const today = new Date().toISOString().slice(0,10);
    const warn = document.getElementById('tasa-warning');
    if (warn) warn.style.display = (!updatedAt || updatedAt !== today) ? 'inline' : 'none';
  } catch (e) { console.error(e); }
}

async function handleTasaChange() {
  const val = parseFloat(document.getElementById('tasa-input').value);
  if (!isNaN(val) && val > 0) {
    tasaActual = val;
    await invoke('set_tasa', { tasa: tasaActual });
    const warn = document.getElementById('tasa-warning');
    if (warn) warn.style.display = 'none';
    updateCartTotals();
    renderProductSearch();
    refreshAllBsPrices();
  }
}

function refreshAllBsPrices() {
  // Update inventory view Bs prices without re-fetching from backend
  document.querySelectorAll('.bs-price-cell').forEach(el => {
    const usd = parseFloat(el.dataset.usdPrice);
    if (!isNaN(usd)) el.textContent = formatBS(usd * tasaActual);
  });
}

/* ========== CATEGORIAS ========== */
async function loadCategorias() {
  try {
    categorias = await invoke('list_categorias');
  } catch (e) { categorias = []; }
  renderCategoriaConfig();
  renderCategoriaSelect();
  renderCategoriaFilter();
}

function renderCategoriaConfig() {
  const container = document.getElementById('categoria-list');
  if (!container) return;
  if (categorias.length === 0) {
    container.innerHTML = '<p class="text-muted">No hay categor\u00edas definidas.</p>';
    return;
  }
  container.innerHTML = categorias.map(c =>
    '<div class="categoria-item">' +
      '<span class="categoria-color-swatch" style="background:' + c.color + '"></span>' +
      '<span class="categoria-name">' + c.nombre + '</span>' +
      '<input type="color" value="' + c.color + '" onchange="updateCategoriaColor(' + c.id + ', this.value)" style="width:30px;height:26px;padding:1px;border:1px solid var(--border);border-radius:3px;cursor:pointer;">' +
      '<button class="btn btn-outline btn-sm" onclick="deleteCategoria(' + c.id + ')"><i class="nf nf-fa-trash"></i></button>' +
    '</div>'
  ).join('');
}

function renderCategoriaSelect() {
  const sel = document.getElementById('product-categoria');
  if (!sel) return;
  const val = sel.value;
  sel.innerHTML = '<option value="">Sin categor\u00eda</option>' +
    categorias.map(c => '<option value="' + c.id + '">' + c.nombre + '</option>').join('');
  sel.value = val;
}

function renderCategoriaFilter() {
  const filters = ['inventory-category-filter', 'sales-category-filter'];
  filters.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const val = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' +
      categorias.map(c => '<option value="' + c.id + '">' + c.nombre + '</option>').join('');
    sel.value = val;
  });
}

async function addCategoria() {
  const nombre = document.getElementById('categoria-nombre-input').value.trim();
  const color = document.getElementById('categoria-color-input').value;
  if (!nombre) { showToast('Ingrese un nombre para la categor\u00eda', 'error'); return; }
  try {
    await invoke('create_categoria', { nombre, color });
    showToast('Categor\u00eda creada');
    document.getElementById('categoria-nombre-input').value = '';
    await loadCategorias();
    loadInventory();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function updateCategoriaColor(id, color) {
  const cat = categorias.find(c => c.id === id);
  if (!cat) return;
  try {
    await invoke('update_categoria', { id, nombre: cat.nombre, color });
    await loadCategorias();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function deleteCategoria(id) {
  if (!confirm('\u00bfEliminar esta categor\u00eda?')) return;
  try {
    await invoke('delete_categoria', { id });
    showToast('Categor\u00eda eliminada');
    await loadCategorias();
    loadInventory();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function loadProductCache() {
  try {
    productCache = await invoke('list_products', { search: null, categoriaId: null });
  } catch (e) { showToast('Error al cargar productos', 'error'); }
}

/* ========== SALES ========== */
let productSearchTimer = null;

function handleProductSearch() {
  clearTimeout(productSearchTimer);
  productSearchTimer = setTimeout(renderProductSearch, 200);
}

function renderProductSearch() {
  const query = document.getElementById('product-search').value.trim().toLowerCase();
  const categoriaId = document.getElementById('sales-category-filter').value;
  const tbody = document.getElementById('product-search-body');
  tbody.innerHTML = '';
  if (!query && !categoriaId) return;
  let filtered = productCache.filter(p => p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query));
  if (categoriaId) {
    filtered = filtered.filter(p => p.categoria_id === parseInt(categoriaId));
  }
  const fragment = document.createDocumentFragment();
  filtered.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td title="' + p.nombre.replace(/"/g, '&quot;') + '">' + p.nombre + '</td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><button class="btn btn-primary btn-sm" onclick="addToCart(\'' + p.codigo + '\')">+</button></td>';
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
  const cartBody = document.getElementById('cart-body');
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

function renderCart() {
  const tbody = document.getElementById('cart-body');
  const empty = document.getElementById('cart-empty');
  tbody.innerHTML = '';
  if (cart.length === 0) {
    empty.style.display = 'block';
    document.querySelector('.sales-body').classList.add('cart-hidden');
  } else {
    empty.style.display = 'none';
    document.querySelector('.sales-body').classList.remove('cart-hidden');
    const fragment = document.createDocumentFragment();
    cart.forEach(item => {
      const tr = document.createElement('tr');
      const displayName = item.nombre || item.codigo;
      tr.innerHTML = '<td title="' + displayName.replace(/"/g, '&quot;') + '">' + displayName + '</td><td><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="1" max="' + item.stock + '" onfocus="this.select()" oninput="event.stopPropagation(); handleCartQtyInput(\'' + item.codigo + '\', this.value)"></td><td>' + formatUSD(item.cantidad * item.precio_usd) + '</td><td><button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); removeFromCart(\'' + item.codigo + '\')">\u00d7</button></td>';
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }
  updateCartTotals();
}

function updateCartTotals() {
  const totalUSD = cart.reduce((sum, item) => sum + item.cantidad * item.precio_usd, 0);
  document.getElementById('cart-total-usd').textContent = formatUSD(totalUSD);
  document.getElementById('cart-total-bs').textContent = formatBS(totalUSD * tasaActual);
}

function updateCheckoutBtn() {
  document.getElementById('checkout-btn').disabled = cart.length === 0;
}

/* ========== PAYMENT ========== */
function openPaymentModal() {
  if (cart.length === 0) return;
  const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
  document.getElementById('payment-total-usd').textContent = formatUSD(total);
  document.getElementById('payment-total-bs').textContent = formatBS(total * tasaActual);
  document.getElementById('payment-modal').style.display = 'flex';
  document.getElementById('referencia-input').value = '';
  document.getElementById('cliente-select').innerHTML = '<option value="">Seleccione...</option>';
  document.getElementById('mixto-items').innerHTML = '';
  document.getElementById('mixto-error').style.display = 'none';
  selectPaymentMethod('efectivo_bs');
  loadClientesForSelect();
}

function closePaymentModal() {
  document.getElementById('payment-modal').style.display = 'none';
}

function showPrintButton(receiptData) {
  lastReceipt = receiptData;
  document.getElementById('print-receipt').style.display = 'block';
  setTimeout(() => { document.getElementById('print-receipt').style.display = 'none'; }, 8000);
}

const METODO_LABELS = {
  efectivo_bs: 'Efectivo Bs.', efectivo_usd: 'Efectivo USD', biopago: 'Biopago',
  punto: 'Punto', pago_movil: 'Pago Móvil', credito: 'Crédito', mixto: 'Mixto'
};

function formatMetodoLabel(m) { return METODO_LABELS[m] || m; }

function printReceipt() {
  if (!lastReceipt) return;
  let iframe = document.getElementById('print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:280px;height:400px;border:none;';
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write('<html><head><meta charset="utf-8"><title>Recibo</title><style>body{font-family:monospace;font-size:12px;padding:16px;text-align:center}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{padding:4px 0;text-align:left}th{border-bottom:1px solid #000}.total{font-weight:700;font-size:14px;margin-top:8px}</style></head><body>');
  doc.write('<h2>Gestor de Ventas</h2>');
  doc.write('<p>' + new Date().toLocaleString() + '</p>');
  doc.write('<hr>');
  doc.write('<table><tr><th>Producto</th><th>Cant</th><th>Precio</th></tr>');
  lastReceipt.productos.forEach(p => {
    doc.write('<tr><td>' + p.nombre + '</td><td>' + p.cantidad + '</td><td>' + formatUSD(p.subtotal) + '</td></tr>');
  });
  doc.write('</table><hr>');
  doc.write('<div class="total">Total: ' + formatUSD(lastReceipt.total) + '</div>');
  if (lastReceipt.pagoDetalle && lastReceipt.pagoDetalle.length) {
    doc.write('<div>Desglose:</div>');
    lastReceipt.pagoDetalle.forEach(p => {
      doc.write('<div>' + formatMetodoLabel(p.metodo) + ': ' + formatUSD(p.monto_usd) + '</div>');
    });
  } else {
    doc.write('<div>M\u00e9todo: ' + formatMetodoLabel(lastReceipt.metodo) + '</div>');
  }
  doc.write('</body></html>');
  doc.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  document.getElementById('print-receipt').style.display = 'none';
}

function selectPaymentMethod(method) {
  qsa('.payment-method-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));
  document.getElementById('referencia-group').style.display = method === 'pago_movil' ? 'block' : 'none';
  document.getElementById('cliente-group').style.display = method === 'credito' ? 'block' : 'none';
  document.getElementById('mixto-group').style.display = method === 'mixto' ? 'block' : 'none';
  if (method === 'mixto') {
    if (!document.querySelector('#mixto-items .mixto-row')) addMixtoRow('mixto-items');
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
      '<option value="pago_movil">Pago Móvil</option>' +
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
    : parseFloat(document.getElementById('abono-monto').value) || 0;
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
  const warningEl = document.getElementById(containerId === 'mixto-items' ? 'mixto-warning' : 'abono-mixto-warning');
  const textEl = document.getElementById(containerId === 'mixto-items' ? 'mixto-warning-text' : 'abono-mixto-warning-text');
  const items = getMixtoData(containerId);
  const total = containerId === 'mixto-items'
    ? cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0)
    : parseFloat(document.getElementById('abono-monto').value) || 0;
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
    errEl.textContent = 'Agregue al menos un método de pago';
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
      errEl.textContent = 'Pago móvil requiere referencia de 4 dígitos';
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
    const sel = document.getElementById('cliente-select');
    sel.innerHTML = '<option value="">Seleccione un cliente...</option>';
    clientes.filter(c => c.credito_activo).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nombre + ' (Deuda: ' + formatUSD(c.saldo_deuda_usd) + ')';
      sel.appendChild(opt);
    });
  } catch (e) { console.error(e); }
}

let processingPayment = false;
async function confirmPayment() {
  if (processingPayment) return;
  processingPayment = true;
  document.getElementById('payment-confirm-btn').disabled = true;
  const methodBtn = qs('.payment-method-btn.active');
  if (!methodBtn) { showToast('Seleccione un m\u00e9todo de pago', 'error'); processingPayment = false; document.getElementById('payment-confirm-btn').disabled = false; return; }
  const metodo = methodBtn.dataset.method;
  let referencia = null, cliente_id = null, pago_detalle = null;
  if (metodo === 'pago_movil') {
    referencia = document.getElementById('referencia-input').value.trim();
    if (referencia.length !== 4) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); processingPayment = false; document.getElementById('payment-confirm-btn').disabled = false; return; }
  }
  if (metodo === 'credito') {
    const sel = document.getElementById('cliente-select');
    if (!sel.value) { showToast('Seleccione un cliente', 'error'); processingPayment = false; document.getElementById('payment-confirm-btn').disabled = false; return; }
    cliente_id = parseInt(sel.value);
  }
  const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
  if (metodo === 'mixto') {
    pago_detalle = getMixtoData('mixto-items');
    if (!validarMixto(pago_detalle, total, 'mixto-error')) {
      processingPayment = false;
      document.getElementById('payment-confirm-btn').disabled = false;
      return;
    }
  }
  const productos = cart.map(i => ({ codigo: i.codigo, cantidad: i.cantidad }));
  try {
    const venta = await invoke('create_sale', {
      request: { usuario_id: currentUser.id, metodo_pago: metodo, referencia_pago_movil: referencia, pago_detalle, cliente_id, productos, tasa: tasaActual }
    });
    playSound('success');
    showToast('Venta #' + venta.id + ' registrada - ' + formatUSD(venta.total_usd));
    lastReceipt = { total: venta.total_usd, metodo: metodo, pagoDetalle: pago_detalle, productos: cart.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, subtotal: i.cantidad * i.precio_usd })) };
    showPrintButton(lastReceipt);
    cart = [];
    await loadProductCache();
    renderCart(); updateCheckoutBtn(); closePaymentModal();
  } catch (e) { showToast('Error: ' + e, 'error'); playSound('error'); }
  processingPayment = false;
  document.getElementById('payment-confirm-btn').disabled = false;
}

/* ========== INVENTORY ========== */
async function loadInventory() {
  const query = document.getElementById('inventory-search').value.trim();
  const categoriaId = document.getElementById('inventory-category-filter').value;
  try {
    const products = await invoke('list_products', { search: query || null, categoriaId: categoriaId ? parseInt(categoriaId) : null });
    const tbody = document.getElementById('inventory-body');
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    products.forEach(p => {
      const tr = document.createElement('tr');
      const catBadge = p.categoria_nombre ? '<span class="categoria-badge" style="background:' + (p.categoria_color || '#ccc') + '20;color:' + (p.categoria_color || '#666') + ';border:1px solid ' + (p.categoria_color || '#ccc') + ';border-radius:4px;padding:1px 6px;font-size:11px;">' + p.categoria_nombre + '</span>' : '';
      const editBtn = (currentUser && currentUser.rol === 'admin') ? '<button onclick="editProduct(\'' + p.codigo + '\')">Editar</button>' : '';
      tr.innerHTML = '<td>' + p.nombre + '</td><td>' + catBadge + '</td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><div class="dropdown"><button class="dropdown-btn" onclick="event.stopPropagation(); toggleDropdown(this)" title="Acciones">&ctdot;</button><div class="dropdown-menu"><button onclick="showProductDetail(\'' + p.codigo + '\')">Detalles</button>' + editBtn + '</div></div></td>';
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

// Close dropdowns on outside click
document.addEventListener('click', closeAllDropdowns);

function showProductDetail(codigo) {
  const p = productCache.find(x => x.codigo === codigo);
  if (!p) { showToast('Producto no encontrado', 'error'); return; }
  document.getElementById('detail-nombre').textContent = p.nombre;
  document.getElementById('detail-precio').textContent = formatUSD(p.precio_usd);
  document.getElementById('detail-stock').textContent = p.stock;
  document.getElementById('detail-categoria').textContent = p.categoria_nombre || 'Sin categor\u00eda';
  document.getElementById('detail-created').textContent = p.created_at || 'No disponible';
  document.getElementById('product-detail-modal').style.display = 'flex';
}

function closeProductDetail() {
  document.getElementById('product-detail-modal').style.display = 'none';
}

function openNewProductModal() {
  editingProduct = null;
  document.getElementById('product-modal-title').textContent = 'Registrar Nuevo Producto';
  document.getElementById('product-save-text').textContent = 'Registrar';
  ['product-nombre','product-precio','product-stock'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('product-categoria').value = '';
  document.getElementById('product-delete-btn').style.display = 'none';
  document.getElementById('product-modal').style.display = 'flex';
}

function editProduct(codigo) {
  editingProduct = codigo;
  const p = productCache.find(x => x.codigo === codigo);
  if (!p) { showToast('Producto no encontrado', 'error'); return; }
  document.getElementById('product-modal-title').textContent = 'Editar Producto';
  document.getElementById('product-save-text').textContent = 'Guardar';
  document.getElementById('product-nombre').value = p.nombre;
  document.getElementById('product-precio').value = p.precio_usd;
  document.getElementById('product-stock').value = p.stock;
  document.getElementById('product-categoria').value = p.categoria_id || '';
  document.getElementById('product-delete-btn').style.display = 'inline-flex';
  document.getElementById('product-modal').style.display = 'flex';
}

function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

async function saveProduct() {
  const codigo = editingProduct || '';
  const nombre = document.getElementById('product-nombre').value.trim();
  const precio = parseFloat(document.getElementById('product-precio').value);
  const stock = parseInt(document.getElementById('product-stock').value) || 0;
  const catVal = document.getElementById('product-categoria').value;
  const categoria_id = catVal ? parseInt(catVal) : null;
  if (!nombre || isNaN(precio) || precio < 0) { showToast('Complete todos los campos', 'error'); return; }
  try {
    if (editingProduct) {
      await invoke('update_product', { codigo, nombre, precioUsd: precio, stock, categoriaId: categoria_id });
    } else {
      await invoke('create_product', { codigo, nombre, precioUsd: precio, stock, categoriaId: categoria_id });
    }
    showToast(editingProduct ? 'Producto actualizado con éxito' : 'Producto registrado con éxito');
    closeProductModal(); loadInventory(); renderProductSearch();
    loadProductCache();
  } catch (e) {
    showToast('Error: ' + e, 'error');
  }
}

async function deleteProduct() {
  if (!editingProduct) return;
  if (!confirm('\u00bfEliminar producto ' + editingProduct + '?')) return;
  try {
    await invoke('delete_product', { codigo: editingProduct });
    showToast('Producto eliminado');
    closeProductModal(); loadInventory(); renderProductSearch();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function exportProducts() {
  try {
    const path = await invoke('export_products_xlsx', { tasa: tasaActual });
    showToast('Exportado a: ' + path);
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function openImportModal() {
  document.getElementById('import-file-path').value = 'productos';
  document.getElementById('import-modal').style.display = 'flex';
}

function closeImportModal() { document.getElementById('import-modal').style.display = 'none'; }

async function confirmImport() {
  const filePath = document.getElementById('import-file-path').value.trim() || 'productos';
  try {
    const res = await invoke('import_products_from_file', { filePath });
    showToast(res);
    closeImportModal(); loadInventory(); renderProductSearch();
    loadProductCache();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== CREDITOS ========== */
async function loadCreditos() {
  try {
    const clientes = await invoke('list_clientes');
    const tbody = document.getElementById('creditos-body');
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    clientes.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + c.nombre + '</td><td>' + formatUSD(c.saldo_deuda_usd) + '</td><td><button class="btn btn-sm btn-outline" onclick="openDebtDetail(' + c.id + ')">Ver Detalles</button> <button class="btn btn-sm btn-primary" onclick="openAbonoModal(' + c.id + ')">Abonar / Pagar</button></td>';
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function openCreditoModal() {
  document.getElementById('client-nombre').value = '';
  document.getElementById('client-modal-title').textContent = 'Registrar Persona para Cr\u00e9dito';
  document.getElementById('client-modal').style.display = 'flex';
}

function closeClientModal() { document.getElementById('client-modal').style.display = 'none'; }

async function saveClient() {
  const nombre = document.getElementById('client-nombre').value.trim();
  if (!nombre) { showToast('Ingrese el nombre', 'error'); return; }
  try {
    await invoke('create_cliente', { nombre });
    showToast('Cliente creado');
    closeClientModal(); loadCreditos();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== DEBT DETAIL ========== */
async function openDebtDetail(id) {
  try {
    const hist = await invoke('get_cliente_history', { clienteId: id });
    document.getElementById('debt-detail-title').textContent = 'Deuda: ' + hist.cliente.nombre;
    document.getElementById('debt-detail-debt').textContent = formatUSD(hist.total_deuda);
    const container = document.getElementById('debt-detail-list');
    container.innerHTML = '';
    if (hist.ventas.length === 0) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-light);">No hay ventas a cr\u00e9dito registradas.</p>';
    } else {
      hist.ventas.forEach(v => {
        const card = document.createElement('div');
        card.className = 'debt-sale-card';
        let prodHtml = '';
        v.productos.forEach(p => {
          prodHtml += '<div class="debt-prod"><span>' + p.producto_nombre + '</span><span>x' + p.cantidad + ' <strong>' + formatUSD(p.subtotal_usd) + '</strong></span></div>';
        });
        card.innerHTML = '<div class="debt-sale-header"><span># Venta ' + v.id + '</span><span>' + v.fecha_hora + '</span></div><div class="debt-sale-total">Total: ' + formatUSD(v.total_usd) + '</div>' + prodHtml;
        container.appendChild(card);
      });
    }
    document.getElementById('debt-detail-modal').style.display = 'flex';
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function closeDebtDetail() {
  document.getElementById('debt-detail-modal').style.display = 'none';
}

/* ========== ABONO MODAL ========== */

function openAbonoModal(id) {
  abonoClienteId = id;
  document.getElementById('abono-monto').value = '';
  document.getElementById('abono-referencia').value = '';
  document.getElementById('abono-referencia-group').style.display = 'none';
  document.getElementById('abono-mixto-group').style.display = 'none';
  document.getElementById('abono-mixto-items').innerHTML = '';
  document.getElementById('abono-mixto-error').style.display = 'none';
  document.getElementById('abono-saldo-restante').textContent = 'Saldo Restante: $0.00';
  qsa('.abono-metodo-btn').forEach(b => b.classList.toggle('active', b.dataset.method === 'efectivo_bs'));
  loadAbonoClienteInfo(id);
  document.getElementById('abono-modal').style.display = 'flex';
}

async function loadAbonoClienteInfo(id) {
  try {
    const clientes = await invoke('list_clientes');
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('abono-cliente-nombre').textContent = c.nombre;
    document.getElementById('abono-deuda-usd').textContent = formatUSD(c.saldo_deuda_usd);
    document.getElementById('abono-deuda-bs').textContent = formatBS(c.saldo_deuda_usd * tasaActual);
  } catch (e) {}
}

function closeAbonoModal() {
  document.getElementById('abono-modal').style.display = 'none';
  abonoClienteId = null;
}

function selectAbonoMethod(btn) {
  qsa('.abono-metodo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const method = btn.dataset.method;
  document.getElementById('abono-referencia-group').style.display = method === 'pago_movil' ? 'block' : 'none';
  document.getElementById('abono-mixto-group').style.display = method === 'mixto' ? 'block' : 'none';
  if (method === 'mixto') {
    if (!document.querySelector('#abono-mixto-items .mixto-row')) addMixtoRow('abono-mixto-items');
    distributeMixto('abono-mixto-items');
  }
}

function updateAbonoSaldoRestante() {
  const deudaTexto = document.getElementById('abono-deuda-usd').textContent;
  const deuda = parseFloat(deudaTexto.replace(/[^0-9.-]/g, '')) || 0;
  const monto = parseFloat(document.getElementById('abono-monto').value) || 0;
  const restante = Math.max(0, deuda - monto);
  document.getElementById('abono-saldo-restante').textContent = 'Saldo Restante: ' + formatUSD(restante);
}

let processingAbono = false;
async function confirmAbono() {
  if (processingAbono) return;
  processingAbono = true;
  document.getElementById('abono-confirm-btn').disabled = true;
  const monto = parseFloat(document.getElementById('abono-monto').value);
  if (isNaN(monto) || monto <= 0) { showToast('Ingrese un monto v\u00e1lido', 'error'); processingAbono = false; document.getElementById('abono-confirm-btn').disabled = false; return; }
  const metodoBtn = qs('.abono-metodo-btn.active');
  if (!metodoBtn) { showToast('Seleccione un m\u00e9todo de pago', 'error'); processingAbono = false; document.getElementById('abono-confirm-btn').disabled = false; return; }
  const metodo = metodoBtn.dataset.method;
  let referencia = null, pago_detalle = null;
  if (metodo === 'pago_movil' && metodo !== 'mixto') {
    referencia = document.getElementById('abono-referencia').value.trim();
    if (referencia.length !== 4) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); processingAbono = false; document.getElementById('abono-confirm-btn').disabled = false; return; }
  }
  if (metodo === 'mixto') {
    pago_detalle = getMixtoData('abono-mixto-items');
    if (!validarMixto(pago_detalle, monto, 'abono-mixto-error')) {
      processingAbono = false;
      document.getElementById('abono-confirm-btn').disabled = false;
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
  document.getElementById('abono-confirm-btn').disabled = false;
}

/* ========== CASHIER ========== */
async function loadDailySummary() {
  try {
    const [summary, cajaAbierta] = await Promise.all([
      invoke('get_daily_summary'),
      invoke('get_caja_abierta')
    ]);
    document.getElementById('daily-count').textContent = summary.total_ventas;
    document.getElementById('daily-usd').textContent = formatUSD(summary.total_usd);
    document.getElementById('daily-bs').textContent = formatBS(summary.total_bs);
    document.getElementById('daily-tasa').textContent = 'Bs. ' + summary.tasa_actual.toFixed(2).replace('.', ',');

    const tbody = document.getElementById('daily-sales-body');
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    summary.ventas.forEach(v => {
      const tr = document.createElement('tr');
      let metodoLabel = formatMetodoLabel(v.metodo_pago);
      if (v.metodo_pago === 'pago_movil' && v.referencia_pago_movil) {
        metodoLabel += ' (' + v.referencia_pago_movil + ')';
      }
      tr.innerHTML = '<td>' + v.id + '</td><td>' + v.fecha_hora.split(' ')[1] + '</td><td>' + v.username + '</td><td>' + metodoLabel + '</td><td>' + formatUSD(v.total_usd) + '</td><td>' + formatBS(v.total_bs) + '</td>';
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);

    const statusBar = document.getElementById('caja-status-bar');
    const statusText = document.getElementById('caja-status-text');
    const openBtn = document.getElementById('open-cashier-btn');
    const closeBtn = document.getElementById('close-cashier-btn');
    if (cajaAbierta) {
      statusBar.className = 'caja-status abierta';
      statusText.innerHTML = '<i class="nf nf-fa-unlock"></i> Caja abierta';
      openBtn.style.display = 'none';
      closeBtn.style.display = 'inline-flex';
    } else {
      statusBar.className = 'caja-status cerrada';
      statusText.innerHTML = '<i class="nf nf-fa-lock"></i> Caja cerrada';
      openBtn.style.display = 'inline-flex';
      closeBtn.style.display = 'none';
    }
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function handleOpenCashier() {
  try {
    const res = await invoke('abrir_caja');
    showToast(res);
    loadDailySummary();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function openCloseCashier() {
  const totalUSD = document.getElementById('daily-usd').textContent;
  const totalBS = document.getElementById('daily-bs').textContent;
  const count = document.getElementById('daily-count').textContent;
  document.getElementById('close-summary').innerHTML = '<div>Ventas del d\u00eda: <strong>' + count + '</strong></div><div>Total USD: <strong>' + totalUSD + '</strong></div><div>Total Bs.: <strong>' + totalBS + '</strong></div>';
  document.getElementById('close-cashier-modal').style.display = 'flex';
}

function closeCloseCashier() { document.getElementById('close-cashier-modal').style.display = 'none'; }

async function confirmCloseCashier() {
  try {
    const [report, reportData] = await Promise.all([
      invoke('close_cashier'),
      invoke('get_close_report_data')
    ]);
    closeCloseCashier();
    let html = '<div style="text-align:center;padding:8px 20px;">';
    html += '<div style="font-size:32px;margin-bottom:6px;"><i class="nf nf-fa-file_text"></i></div>';
    html += '<h3>Reporte de Cierre de Jornada</h3>';
    html += '<p><strong>Fecha:</strong> ' + report.fecha_cierre + '</p>';
    html += '<p><strong>Usuario:</strong> ' + report.usuario + '</p>';
    html += '<hr style="margin:8px 0;">';
    html += '<p><strong>Ventas realizadas:</strong> ' + reportData.total_ventas + '</p>';
    html += '<p><strong>Total USD:</strong> ' + formatUSD(reportData.total_usd) + '</p>';
    html += '<p><strong>Total Bs.:</strong> ' + formatBS(reportData.total_bs) + '</p>';
    if (reportData.por_metodo && reportData.por_metodo.length) {
      html += '<hr style="margin:8px 0;"><h4>Totales por M\u00e9todo de Pago</h4>';
      html += '<canvas id="close-pie-chart" width="260" height="200" style="margin:4px auto;display:block;max-width:100%;"></canvas>';
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
      html += '<hr style="margin:8px 0;"><h4>Productos Vendidos</h4>';
      html += '<table class="compact-table"><tr><th>Producto</th><th>Cant</th><th>Total</th></tr>';
      reportData.productos_vendidos.forEach(p => {
        html += '<tr><td>' + p.nombre + '</td><td>' + p.cantidad + '</td><td>' + formatUSD(p.total_usd) + '</td></tr>';
      });
      html += '</table>';
    }
    if (reportData.clientes_credito && reportData.clientes_credito.length) {
      html += '<hr style="margin:8px 0;"><h4>Clientes a Cr\u00e9dito</h4>';
      reportData.clientes_credito.forEach(c => {
        html += '<p>' + c.nombre + ': ' + formatUSD(c.total_usd) + '</p>';
      });
    }
    html += '<div style="margin-top:10px;"><button class="btn btn-primary" onclick="printCloseReport()">Exportar PDF</button></div>';
    html += '</div>';
    document.getElementById('close-report-body').innerHTML = html;
    document.getElementById('close-report-modal').style.display = 'flex';
    lastCloseReportData = reportData;
    setTimeout(() => drawCloseChart(reportData), 100);
    showToast('Jornada cerrada exitosamente');
    loadDailySummary();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

const CHART_COLORS = ['#6C63AC', '#A8D5BA', '#F5B7B1', '#85C1E9', '#F9E79F', '#D7BDE2', '#A3E4D7', '#F5CBA7', '#AED6F1', '#ABEBC6'];

function drawPieChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data.por_metodo || !data.por_metodo.length) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = 90, cy = 100, r = 72;
  ctx.clearRect(0, 0, w, h);
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
  let ly = 10;
  data.por_metodo.forEach((m, i) => {
    const lx = 175;
    ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(formatMetodoLabel(m.metodo) + ' ' + formatUSD(m.total_usd), lx + 14, ly);
    ly += 18;
  });
}

function drawCloseChart(data) { drawPieChart('close-pie-chart', data); }

function printCloseReport() {
  const d = lastCloseReportData;
  if (!d) return;
  let iframe = document.getElementById('print-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'print-frame';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:700px;height:500px;border:none;';
    document.body.appendChild(iframe);
  }
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write('<html><head><meta charset="utf-8"><title>Reporte de Cierre</title><style>');
  doc.write('body{font-family:monospace;font-size:12px;padding:24px}');
  doc.write('h2{text-align:center;margin-bottom:4px}');
  doc.write('h4{margin:12px 0 4px;border-bottom:1px solid #000}');
  doc.write('table{width:100%;border-collapse:collapse;margin:4px 0}');
  doc.write('th,td{padding:3px 6px;text-align:left;border-bottom:1px solid #ccc}');
  doc.write('th{border-bottom:2px solid #000}');
  doc.write('.total{font-weight:700;text-align:right;margin-top:4px}');
  doc.write('</style></head><body>');
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

function closeReport() { document.getElementById('close-report-modal').style.display = 'none'; }

/* ========== HISTORIAL CIERRES ========== */
async function openHistorialCierres() {
  try {
    const cierres = await invoke('list_cierres');
    const container = document.getElementById('historial-cierres-list');
    if (!cierres.length) {
      container.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-light);">No hay cierres registrados</p>';
    } else {
      let html = '<table class="table compact-table"><tr><th>#</th><th>Fecha</th><th>Usuario</th><th>Ventas</th><th>Total USD</th><th>Total Bs.</th><th></th></tr>';
      cierres.forEach(c => {
        html += '<tr><td>' + c.id + '</td><td>' + c.fecha_hora + '</td><td>' + c.username + '</td><td>' + c.total_ventas + '</td><td>' + formatUSD(c.total_usd) + '</td><td>' + formatBS(c.total_bs) + '</td><td><button class="btn btn-sm btn-outline" onclick="showCierreDetalle(' + c.id + ')">Ver</button></td></tr>';
      });
      html += '</table>';
      container.innerHTML = html;
    }
    document.getElementById('historial-cierres-modal').style.display = 'flex';
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function closeHistorialCierres() {
  document.getElementById('historial-cierres-modal').style.display = 'none';
}

async function showCierreDetalle(cierreId) {
  try {
    const detalle = await invoke('get_cierre_detalle', { cierreId });
    document.getElementById('historial-cierre-detalle-modal').style.display = 'flex';
    document.getElementById('historial-cierres-modal').style.display = 'none';
    const d = detalle.detalle;
    const c = detalle.cierre;
    let html = '<div style="text-align:center;padding:8px 20px;">';
    html += '<div style="font-size:28px;margin-bottom:4px;"><i class="nf nf-fa-file_text"></i></div>';
    html += '<h3>Reporte de Cierre #' + c.id + '</h3>';
    html += '<p><strong>Fecha:</strong> ' + c.fecha_hora + '</p>';
    html += '<p><strong>Usuario:</strong> ' + c.username + '</p>';
    html += '<hr style="margin:8px 0;">';
    html += '<p><strong>Ventas realizadas:</strong> ' + d.total_ventas + '</p>';
    html += '<p><strong>Total USD:</strong> ' + formatUSD(d.total_usd) + '</p>';
    html += '<p><strong>Total Bs.:</strong> ' + formatBS(d.total_bs) + '</p>';
    if (d.por_metodo && d.por_metodo.length) {
      html += '<hr style="margin:8px 0;"><h4>Totales por M\u00e9todo de Pago</h4>';
      html += '<canvas id="historial-pie-chart" width="260" height="200" style="margin:4px auto;display:block;max-width:100%;"></canvas>';
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
    document.getElementById('historial-cierre-detalle-body').innerHTML = html;
    setTimeout(() => drawHistorialChart(d), 100);
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function drawHistorialChart(data) { drawPieChart('historial-pie-chart', data); }

function closeHistorialDetalle() {
  document.getElementById('historial-cierre-detalle-modal').style.display = 'none';
}

/* ========== AUDIT ========== */
async function loadAudit() {
  auditOffset = 0;
  await loadAuditMore();
}

async function loadAuditMore() {
  try {
    const logs = await invoke('get_audit_logs', { limit: auditLimit, offset: auditOffset });
    const tbody = document.getElementById('audit-body');
    if (auditOffset === 0) tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    logs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + log.id + '</td><td>' + log.fecha_hora + '</td><td>' + log.usuario + '</td><td>' + log.accion + '</td>';
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    auditOffset += logs.length;
    document.getElementById('audit-load-more').style.display = logs.length < auditLimit ? 'none' : 'inline-flex';
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== CONFIG ========== */
async function loadThemeConfig() {
  try {
    const currentTheme = await invoke('get_config_value', { key: 'tema' });
    const theme = currentTheme || 'pastel';
    applyTheme(theme);
    qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  } catch (e) { console.error(e); }
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
  } else {
    prevThemeKeys = null;
  }
}

async function handleThemeClick(theme) {
  applyTheme(theme);
  qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  try {
    await invoke('set_config_value', { key: 'tema', value: theme });
    showToast('Tema cambiado a ' + theme);
  } catch (e) { showToast('Error al guardar tema', 'error'); }
}

/* ========== FONT SIZE ========== */
let currentFontPct = 100;

function applyFontSize(pct) {
  currentFontPct = Math.max(75, Math.min(150, pct));
  const px = (16 * currentFontPct / 100).toFixed(1);
  document.documentElement.style.fontSize = px + 'px';
  document.getElementById('font-size-display').textContent = currentFontPct + '%';
}

async function loadFontSize() {
  try {
    const saved = await invoke('get_config_value', { key: 'font_size' });
    const pct = parseInt(saved) || 100;
    applyFontSize(pct);
  } catch (e) { applyFontSize(100); }
}

async function saveFontSize(pct) {
  try {
    await invoke('set_config_value', { key: 'font_size', value: String(pct) });
  } catch (e) {}
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async function() {
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  qsa('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  document.getElementById('tasa-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      handleTasaChange();
      showToast('Precios actualizados', 'info');
    }
  });
  document.getElementById('tasa-input').addEventListener('blur', handleTasaChange);

  document.getElementById('product-search').addEventListener('input', handleProductSearch);
  document.getElementById('checkout-btn').addEventListener('click', openPaymentModal);

  document.getElementById('payment-modal-close').addEventListener('click', closePaymentModal);
  document.getElementById('payment-cancel-btn').addEventListener('click', closePaymentModal);
  document.getElementById('mixto-add-row').addEventListener('click', function() { addMixtoRow('mixto-items'); });
  document.getElementById('abono-mixto-add-row').addEventListener('click', function() { addMixtoRow('abono-mixto-items'); });
  document.getElementById('payment-confirm-btn').addEventListener('click', confirmPayment);
  qsa('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
  });

  let inventoryTimer = null;
  document.getElementById('inventory-search').addEventListener('input', () => {
    clearTimeout(inventoryTimer);
    inventoryTimer = setTimeout(loadInventory, 250);
  });
  document.getElementById('inventory-category-filter').addEventListener('change', loadInventory);
  document.getElementById('sales-category-filter').addEventListener('change', renderProductSearch);
  document.getElementById('inventory-add-btn').addEventListener('click', openNewProductModal);
  document.getElementById('inventory-export-btn').addEventListener('click', exportProducts);
  document.getElementById('inventory-import-btn').addEventListener('click', openImportModal);

  document.getElementById('import-modal-close').addEventListener('click', closeImportModal);
  document.getElementById('import-cancel-btn').addEventListener('click', closeImportModal);
  document.getElementById('import-confirm-btn').addEventListener('click', confirmImport);

  document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
  document.getElementById('product-cancel-btn').addEventListener('click', closeProductModal);
  document.getElementById('product-save-btn').addEventListener('click', saveProduct);
  document.getElementById('product-delete-btn').addEventListener('click', deleteProduct);

  document.getElementById('product-detail-close').addEventListener('click', closeProductDetail);
  document.getElementById('product-detail-ok-btn').addEventListener('click', closeProductDetail);

  document.getElementById('credito-add-btn').addEventListener('click', openCreditoModal);
  document.getElementById('client-modal-close').addEventListener('click', closeClientModal);
  document.getElementById('client-cancel-btn').addEventListener('click', closeClientModal);
  document.getElementById('client-save-btn').addEventListener('click', saveClient);

  document.getElementById('open-cashier-btn').addEventListener('click', handleOpenCashier);
  document.getElementById('close-cashier-btn').addEventListener('click', openCloseCashier);
  document.getElementById('close-cashier-close').addEventListener('click', closeCloseCashier);
  document.getElementById('close-cashier-cancel-btn').addEventListener('click', closeCloseCashier);
  document.getElementById('close-cashier-confirm-btn').addEventListener('click', confirmCloseCashier);
  document.getElementById('close-report-close').addEventListener('click', closeReport);
  document.getElementById('close-report-ok-btn').addEventListener('click', closeReport);

  document.getElementById('historial-cierres-btn').addEventListener('click', openHistorialCierres);
  document.getElementById('historial-cierres-close').addEventListener('click', closeHistorialCierres);
  document.getElementById('historial-cierres-ok-btn').addEventListener('click', closeHistorialCierres);
  document.getElementById('historial-cierre-detalle-close').addEventListener('click', closeHistorialDetalle);
  document.getElementById('historial-cierre-detalle-ok-btn').addEventListener('click', closeHistorialDetalle);

  document.getElementById('debt-detail-close').addEventListener('click', closeDebtDetail);
  document.getElementById('debt-detail-ok-btn').addEventListener('click', closeDebtDetail);

  document.getElementById('abono-close').addEventListener('click', closeAbonoModal);
  document.getElementById('abono-cancel-btn').addEventListener('click', closeAbonoModal);
  document.getElementById('abono-confirm-btn').addEventListener('click', confirmAbono);
  document.getElementById('abono-monto').addEventListener('input', function() {
    updateAbonoSaldoRestante();
    if (qs('.abono-metodo-btn.active')?.dataset.method === 'mixto') distributeMixto('abono-mixto-items');
  });
  qsa('.abono-metodo-btn').forEach(btn => {
    btn.addEventListener('click', () => selectAbonoMethod(btn));
  });

  qsa('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => handleThemeClick(btn.dataset.theme));
  });

  qsa('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
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
      case 'F6': e.preventDefault(); showView('config'); break;
      case 'F8':
        e.preventDefault();
        if (viewId === 'view-sales') document.getElementById('product-search').focus();
        else if (viewId === 'view-inventory') document.getElementById('inventory-search').focus();
        break;
      case 'F12':
        e.preventDefault();
        if (cart.length > 0) openPaymentModal();
        break;
      case 'Escape':
        e.preventDefault();
        qsa('.modal').forEach(m => {
          if (m.style.display !== 'none' && m.style.display !== '') m.style.display = 'none';
        });
        break;
    }
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      if (viewId === 'view-inventory') openNewProductModal();
    }
  });

  // Sound config
  const soundToggle = document.getElementById('sound-toggle');
  const soundVolumeRange = document.getElementById('sound-volume');
  if (soundToggle) {
    soundToggle.addEventListener('change', function() {
      soundEnabled = this.checked;
      invoke('set_config_value', { key: 'sonido_habilitado', value: this.checked ? '1' : '0' }).catch(() => {});
    });
  }
  if (soundVolumeRange) {
    soundVolumeRange.addEventListener('input', function() {
      soundVolume = parseInt(this.value) / 100;
      invoke('set_config_value', { key: 'sonido_volumen', value: String(this.value) }).catch(() => {});
    });
  }

  // Fullscreen toggle
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  if (fullscreenToggle) {
    fullscreenToggle.addEventListener('change', function() {
      toggleFullscreen();
    });
    document.addEventListener('fullscreenchange', function() {
      fullscreenToggle.checked = !!document.fullscreenElement;
    });
  }

  // Category management
  const categoriaAddBtn = document.getElementById('categoria-add-btn');
  if (categoriaAddBtn) {
    categoriaAddBtn.addEventListener('click', addCategoria);
    document.getElementById('categoria-nombre-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') addCategoria();
    });
  }

  // Font size controls
  const fontIncBtn = document.getElementById('font-inc-btn');
  const fontDecBtn = document.getElementById('font-dec-btn');
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

  // Load saved sound config
  try {
    const savedSound = await invoke('get_config_value', { key: 'sonido_habilitado' });
    if (savedSound !== null && savedSound !== undefined) {
      soundEnabled = savedSound === '1' || savedSound === true;
      if (soundToggle) soundToggle.checked = soundEnabled;
    }
    const savedVol = await invoke('get_config_value', { key: 'sonido_volumen' });
    if (savedVol !== null && savedVol !== undefined) {
      soundVolume = parseInt(savedVol) / 100 || 0.5;
      if (soundVolumeRange) soundVolumeRange.value = soundVolume * 100;
    }
  } catch (e) {}

  // Load saved theme on startup
  try {
    const savedTheme = await invoke('get_config_value', { key: 'tema' });
    if (savedTheme) applyTheme(savedTheme);
  } catch (e) {}

  // Load history cleanup config
  try {
    const days = await invoke('get_config_value', { key: 'historial_limpieza_dias' });
    const input = document.getElementById('historial-limpieza-dias');
    if (input) input.value = parseInt(days) || 0;
  } catch (e) {}
  const histSaveBtn = document.getElementById('historial-limpieza-save');
  if (histSaveBtn) {
    histSaveBtn.addEventListener('click', async () => {
      const input = document.getElementById('historial-limpieza-dias');
      let val = parseInt(input.value);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 365) val = 365;
      input.value = val;
      try {
        await invoke('set_config_value', { key: 'historial_limpieza_dias', value: String(val) });
        showToast('Configuraci\u00f3n guardada');
      } catch (e) { showToast('Error: ' + e, 'error'); }
    });
  }

  // Restore remembered username
  const savedUser = localStorage.getItem('recordar_usuario');
  if (savedUser) {
    document.getElementById('login-username').value = savedUser;
    document.getElementById('remember-me').checked = true;
    document.getElementById('login-password').focus();
  }


});


