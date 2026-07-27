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
  const val = parseInput(qs(SEL.tasaInput).value);
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

function updateConnectionState() {
  var online = navigator.onLine;
  var input = qs(SEL.tasaInput);
  var badge = qs(SEL.tasaConnectionBadge);
  if (!input || !badge) return;
  input.disabled = false;
  input.title = 'Ingrese la tasa manualmente o use el bot\u00f3n Tasa BCV';
  if (online) {
    badge.className = 'tasa-connection-badge online';
    badge.innerHTML = '<i class="nf nf-fa-wifi"></i>';
    badge.title = 'Conectado';
  } else {
    badge.className = 'tasa-connection-badge offline';
    badge.innerHTML = '<i class="nf nf-fa-wifi"></i>';
    badge.title = 'Sin conexi\u00f3n';
  }
}

window.addEventListener('online', updateConnectionState);
window.addEventListener('offline', updateConnectionState);

function refreshAllBsPrices() {
  var tasa = tasaInventario > 0 ? tasaInventario : tasaActual;
  document.querySelectorAll('.bs-price-cell').forEach(el => {
    const usd = parseFloat(el.dataset.usdPrice);
    if (!isNaN(usd)) el.textContent = formatBS(usd * tasa);
  });
}

async function loadProductCache() {
  try {
    const result = await invoke('list_products', { search: null, page: 1, pageSize: PRODUCT_CACHE_PAGE_SIZE });
    productCache = result.data || result;
  } catch (e) { showToast('Error al cargar productos', 'error'); }
  try {
    comboCache = await invoke('list_combos_simple');
  } catch (e) { comboCache = []; }
}

/* ========== SALES ========== */
let productSearchTimer = null;

/* Recent products in session (quick-add) */
function addRecentProduct(codigo) {
  recentProducts = recentProducts.filter(function(c) { return c !== codigo; });
  recentProducts.unshift(codigo);
  if (recentProducts.length > RECENT_MAX) recentProducts.pop();
  renderRecentProducts();
}

function renderRecentProducts() {
  var container = qs(SEL.recentProducts);
  if (!container) return;
  if (recentProducts.length === 0) { container.style.display = 'none'; return; }
  container.style.display = '';
  var html = '<span class="recent-label">\u00daltimos:</span>';
  recentProducts.forEach(function(codigo) {
    var p = productCache.find(function(x) { return x.codigo === codigo; });
    if (!p) return;
    var name = p.nombre || codigo;
    html += '<button class="recent-chip" data-codigo="' + codigo + '" title="' + name + '">' + escapeHtml(name) + '</button>';
  });
  container.innerHTML = html;
}

/* Cart snapshot (localStorage) */
function saveCartSnapshot() {
  try {
    var hasItems = carts.some(function(c) { return c.items.length > 0; });
    if (hasItems) {
      localStorage.setItem('cart_snapshot', JSON.stringify(carts));
    } else {
      localStorage.removeItem('cart_snapshot');
    }
  } catch (e) {}
}

function restoreCartSnapshot() {
  try {
    var saved = localStorage.getItem('cart_snapshot');
    if (!saved) return;
    var parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.length === 0) { localStorage.removeItem('cart_snapshot'); return; }
    if (parsed[0] && parsed[0].items && Array.isArray(parsed[0].items)) {
      carts = parsed;
    } else {
      carts = [{ id: 1, items: parsed, folded: false }];
    }
    var active = carts.find(function(c) { return !c.folded; }) || carts[0];
    if (active) { active.folded = false; cart = active.items; }
    cartIdCounter = carts.reduce(function(m, c) { return Math.max(m, c.id + 1); }, 1);
    renderCart();
    renderCartTabs();
    updateCheckoutBtn();
    showToast('Carrito restaurado de la sesi\u00f3n anterior', 'info');
    localStorage.removeItem('cart_snapshot');
  } catch (e) { localStorage.removeItem('cart_snapshot'); }
}

function handleProductSearch() {
  clearTimeout(productSearchTimer);
  productSearchTimer = setTimeout(renderProductSearch, SEARCH_DEBOUNCE_MS);
}

function filterProducts(query) {
  if (!query) return [];
  let results = productCache.filter(p => p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query));
  // Include combos in search results
  comboCache.forEach(c => {
    if (c.nombre.toLowerCase().includes(query)) {
      results.push({ codigo: 'COMBO-' + c.id, nombre: c.nombre + ' (Combo)', precio_usd: c.precio_usd, costo: 0, stock: 999, es_inari: true, subcategoria: 'combos' });
    }
  });
  return results;
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
  var active = ensureActiveCart();
  if (!active) { showToast('M\u00e1ximo 3 carritos alcanzado', 'error'); return; }
  playSound('add');
  addRecentProduct(codigo);
  const p = productCache.find(x => x.codigo === codigo);
  const esInari = p && p.es_inari;
  const existing = cart.find(item => item.codigo === codigo);
  if (existing) {
    if (!esInari && existing.stock === 0) {
      showToast('El producto no tiene stock disponible', 'error');
      return;
    }
    if (!esInari && existing.cantidad >= existing.stock) {
      showToast('Stock m\u00e1ximo alcanzado (' + existing.stock + ')', 'error');
      return;
    }
    existing.cantidad++;
    renderCart();
    updateCheckoutBtn();
  } else {
    cart.push({ codigo, cantidad: 1, nombre: '', precio_usd: 0, stock: 0, es_inari: esInari });
    loadProductName(codigo);
  }
  saveCartSnapshot();
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
      item.nombre = p.nombre; item.precio_usd = p.precio_usd; item.stock = p.stock; item.es_inari = p.es_inari;
      if (!p.es_inari && p.stock === 0) {
        var idx = cart.findIndex(function(x) { return x.codigo === codigo; });
        if (idx !== -1) cart.splice(idx, 1);
        showToast('El producto no tiene stock disponible', 'error');
      }
      renderCart(); updateCheckoutBtn();
      saveCartSnapshot();
    }
  }
}

function handleCartQtyInput(codigo, value) {
  const item = cart.find(x => x.codigo === codigo);
  if (!item) return;
  let newQty = parseInt(value);
  if (isNaN(newQty) || newQty <= 0) {
    var idx = cart.findIndex(function(x) { return x.codigo === codigo; });
    if (idx !== -1) cart.splice(idx, 1);
  } else {
    newQty = Math.min(newQty, item.stock);
    item.cantidad = newQty;
  }
  renderCart();
  updateCheckoutBtn();
  saveCartSnapshot();
}

function removeFromCart(codigo) {
  var idx = cart.findIndex(function(x) { return x.codigo === codigo; });
  if (idx !== -1) cart.splice(idx, 1);
  playSound('remove');
  renderCart();
  updateCheckoutBtn();
  saveCartSnapshot();
}

function clearCart() {
  if (cart.length === 0) return;
  cart.splice(0, cart.length);
  playSound('cancel');
  /* Switch to next held cart if available */
  var held = carts.find(function(c) { return c.folded && c.items.length > 0; });
  if (held) {
    held.folded = false;
    cart = held.items;
  }
  renderCart();
  renderCartTabs();
  updateCheckoutBtn();
  showToast('Venta cancelada', 'info');
  saveCartSnapshot();
}

function updateCartBadge() {
  const badge = qs(SEL.cartBadge);
  if (!badge) return;
  var total = carts.reduce(function(sum, c) { return sum + c.items.reduce(function(s, i) { return s + i.cantidad; }, 0); }, 0);
  if (total === 0) { badge.classList.add('hidden'); return; }
  badge.classList.remove('hidden');
  badge.textContent = total;
}

/* Multi-cart hold/unhold */
function ensureActiveCart() {
  var active = carts.find(function(c) { return !c.folded; });
  if (active) return active;
  if (carts.length < 3) {
    cartIdCounter++;
    var newCart = { id: cartIdCounter, items: [], folded: false };
    carts.push(newCart);
    cart = newCart.items;
    return newCart;
  }
  return null;
}

function holdCart() {
  var active = carts.find(function(c) { return !c.folded; });
  if (!active || active.items.length === 0) {
    showToast('No hay carrito activo para plegar', 'info');
    return;
  }
  active.folded = true;
  if (carts.length < 3) {
    cartIdCounter++;
    var newCart = { id: cartIdCounter, items: [], folded: false };
    carts.push(newCart);
    cart = newCart.items;
  } else {
    var first = carts[0];
    if (first) { first.folded = false; cart = first.items; }
  }
  renderCart();
  renderCartTabs();
  updateCheckoutBtn();
  saveCartSnapshot();
  showToast('Carrito en espera', 'info');
}

function unholdCart(cartId) {
  var target = carts.find(function(c) { return c.id === cartId; });
  if (!target) return;
  carts.forEach(function(c) { if (c.id !== cartId) c.folded = true; });
  target.folded = false;
  cart = target.items;
  renderCart();
  renderCartTabs();
  updateCheckoutBtn();
}

function renderCartTabs() {
  var container = qs(SEL.cartTabs);
  if (!container) return;
  var held = carts.filter(function(c) { return c.folded && c.items.length > 0; });
  if (held.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  var html = '';
  held.forEach(function(c) {
    var idx = carts.indexOf(c) + 1;
    var names = c.items.map(function(i) { return escapeHtml(i.nombre || i.codigo); });
    var preview = names.slice(0, 3).join(', ');
    if (names.length > 3) preview += '...';
    var count = c.items.reduce(function(s, i) { return s + i.cantidad; }, 0);
    html += '<div class="cart-tab" data-cart-id="' + c.id + '" title="' + names.join(', ') + '">' +
      '<span class="cart-tab-label">C' + idx + ':</span> ' +
      '<span class="cart-tab-preview">' + preview + '</span>' +
      '<span class="cart-tab-count">' + count + '</span>' +
    '</div>';
  });
  container.innerHTML = html;
}

function renderCart() {
  const tbody = qs(SEL.cartBody);
  const empty = qs(SEL.cartEmpty);
  tbody.innerHTML = '';
  if (cart.length === 0) {
    empty.innerHTML = emptyState('<i class="nf nf-fa-shopping_cart"></i>', 'El carrito est\u00e1 vac\u00edo', 'Agregue productos desde la lista');
    empty.style.display = 'block';
    qs(SEL.salesBody).classList.add('cart-hidden');
  } else {
    empty.innerHTML = '';
    empty.style.display = 'none';
    qs(SEL.salesBody).classList.remove('cart-hidden');
    const fragment = document.createDocumentFragment();
    cart.forEach(item => {
      const tr = document.createElement('tr');
      tr.dataset.codigo = item.codigo;
      const displayName = item.nombre || item.codigo;
      tr.innerHTML = createCartRow(item);
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);
  }
  updateCartTotals();
  updateCartBadge();
  renderCartTabs();
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
  selectedClienteId = null;
  qs(SEL.clienteSelectBtn).textContent = 'Seleccione un cliente...';
  qs(SEL.mixtoItems).innerHTML = '';
  qs(SEL.mixtoError).style.display = 'none';
  qsa('.payment-method-btn').forEach(b => b.classList.remove('active'));
  qs(SEL.referenciaGroup).style.display = 'none';
  qs(SEL.clienteGroup).style.display = 'none';
  qs(SEL.mixtoGroup).style.display = 'none';
  const cambioGroup = qs(SEL.cambioGroup);
  if (cambioGroup) { cambioGroup.style.display = 'none'; qs(SEL.cambioRecibido).value = ''; qs(SEL.cambioResultado).classList.add('hidden'); }
  loadClientesForSelect();
}

function closePaymentModal() {
  closeModal(qs(SEL.paymentModal));
}

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
    const val = parseInput(montoInput.value);
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
    : parseInput(qs(SEL.abonoMonto).value);
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
      const bs = parseInput(input.value);
      monto_usd = tasaActual > 0 ? bs / tasaActual : 0;
    } else {
      monto_usd = parseInput(input.value);
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
    : parseInput(qs(SEL.abonoMonto).value);
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

function toggleClientDropdown(show) {
  const dd = qs(SEL.clienteSelect);
  if (show === undefined) show = !dd.classList.contains('open');
  dd.classList.toggle('open', !!show);
}

function selectCliente(id, nombre) {
  selectedClienteId = id;
  qs(SEL.clienteSelectBtn).textContent = nombre;
  toggleClientDropdown(false);
}

async function loadClientesForSelect() {
  try {
    const clientes = await invoke('list_clientes');
    const menu = qs(SEL.clienteSelectMenu);
    menu.innerHTML = '<div class="custom-select-item disabled" data-id="">Seleccione un cliente...</div>';
    clientes.forEach(c => {
      const div = document.createElement('div');
      div.className = 'custom-select-item' + (c.credito_activo ? '' : ' disabled muted');
      div.dataset.id = c.id;
      div.dataset.nombre = c.nombre;
      div.textContent = c.nombre + ' (Deuda: ' + formatUSD(c.saldo_deuda_usd) + ')' + (c.credito_activo ? '' : ' — Sin crédito');
      if (c.credito_activo) {
        div.addEventListener('click', function() { selectCliente(c.id, c.nombre); });
      }
      menu.appendChild(div);
    });
  } catch (e) { showToast('Error al cargar clientes', 'error'); }
}

document.addEventListener('click', function(e) {
  const dd = qs(SEL.clienteSelect);
  const menu = qs(SEL.clienteSelectMenu);
  if (menu && dd && dd.classList.contains('open') && !dd.contains(e.target)) {
    dd.classList.remove('open');
  }
});

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
  const methodBtn = qs(SEL.paymentMethodActive);
  if (!methodBtn) { showToast('Seleccione un m\u00e9todo de pago', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
  const metodo = methodBtn.dataset.method;
  let referencia = null, cliente_id = null, pago_detalle = null;
  if (metodo === METODO_PAGO_MOVIL) {
    referencia = qs(SEL.referenciaInput).value.trim();
    if (referencia.length !== PAGO_MOVIL_REF_LEN) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
  }
  if (metodo === METODO_CREDITO) {
    if (!selectedClienteId) { showToast('Seleccione un cliente', 'error'); processingPayment = false; qs(SEL.paymentConfirmBtn).disabled = false; return; }
    cliente_id = selectedClienteId;
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
  const productos = cart.map(i => ({ codigo: i.codigo, cantidad: i.cantidad, es_inari: !!i.es_inari }));
  let total_bs_ingresado = null;
  if (metodo === METODO_EFECTIVO_BS) {
    const totalMoneda = totalBsRedondeado(total);
    const recibido = parseInput(qs(SEL.cambioRecibido).value);
    if (recibido > 0) {
      if (recibido < totalMoneda) {
        showToast('El monto recibido (Bs. ' + recibido.toFixed(2).replace('.', ',') + ') es menor al total (Bs. ' + totalMoneda.toFixed(2).replace('.', ',') + ')', 'error');
        processingPayment = false;
        qs(SEL.paymentConfirmBtn).disabled = false;
        qs(SEL.paymentConfirmBtn).classList.remove('loading');
        qs(SEL.paymentConfirmBtn).textContent = 'Confirmar Pago';
        return;
      }
      total_bs_ingresado = recibido;
    } else if (redondeoBs || redondeoTotal) {
      total_bs_ingresado = totalMoneda;
    }
  } else if (metodo === METODO_EFECTIVO_USD) {
    const recibidoUsd = parseInput(qs(SEL.cambioRecibido).value);
    if (recibidoUsd > 0) {
      if (recibidoUsd < total) {
        showToast('El monto recibido ($' + recibidoUsd.toFixed(2) + ') es menor al total ($' + total.toFixed(2) + ')', 'error');
        processingPayment = false;
        qs(SEL.paymentConfirmBtn).disabled = false;
        qs(SEL.paymentConfirmBtn).classList.remove('loading');
        qs(SEL.paymentConfirmBtn).textContent = 'Confirmar Pago';
        return;
      }
      total_bs_ingresado = totalBsRedondeado(recibidoUsd);
    } else if (redondeoBs || redondeoTotal) {
      total_bs_ingresado = totalBsRedondeado(total);
    }
  } else if (redondeoBs || redondeoTotal) {
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
    cart.splice(0, cart.length);
    saveCartSnapshot();
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

/* ========== CASHIER ========== */
async function loadDailySummary() {
  const tbody = qs(SEL.dailySalesBody);
  showSkeleton(tbody, 7);
  try {
    const [summary, cajaAbierta] = await Promise.all([
      invoke('get_daily_summary'),
      invoke('get_caja_abierta')
    ]);
    qs(SEL.dailyCount).textContent = summary.total_ventas;
    qs(SEL.dailyUsd).textContent = formatUSD(summary.total_usd);
    qs(SEL.dailyBs).textContent = formatBS(summary.total_bs);
    qs(SEL.dailyTasa).textContent = 'Bs. ' + summary.tasa_actual.toFixed(2).replace('.', ',');

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
  const btn = qs(SEL.openCashierBtn);
  if (btn) btn.disabled = true;
  try {
    const res = await invoke('abrir_caja');
    playSound('success');
    showToast(res);
    loadDailySummary();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
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
  const btn = qs(SEL.closeCashierConfirmBtn);
  if (btn) btn.disabled = true;
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
  finally { if (btn) btn.disabled = false; }
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

