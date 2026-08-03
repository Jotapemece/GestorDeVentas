/* ========== INVENTORY ========== */
let inventoryPage = 1;
let showInari = false;
let inariSubcat = '';
const INARI_DIAS = [4, 5, 6, 0]; // jueves, viernes, sábado, domingo

function updateInariBtn() {
  const el = qs(SEL.inventoryInariBtn);
  if (!el) return;
  el.classList.toggle('active', showInari);
  el.innerHTML = showInari
    ? '<i class="nf nf-fa-check"></i> <span>Inari</span>'
    : '<i class="nf nf-fa-fire"></i> <span>Inari</span>';
}

async function loadInventory() {
  const query = qs(SEL.inventorySearch).value.trim();
  const tbody = qs(SEL.inventoryBody);
  showSkeleton(tbody, 8);
  const result = await invokeOrError(invoke('list_products', { search: query || null, page: inventoryPage, pageSize: INVENTORY_PAGE_SIZE, inari: showInari || null, subcategoria: inariSubcat || null }));
  if (result === undefined) return;
  const products = result.data || result;
  tbody.innerHTML = '';
  if (products.length === 0) {
    tbody.innerHTML = emptyTableRow(8, '<i class="nf nf-fa-archive"></i>', query ? 'Sin resultados' : 'No hay productos', query ? 'Pruebe con otro t\u00e9rmino de b\u00fasqueda' : 'Agregue productos desde el bot\u00f3n superior');
    renderInventoryPagination(result.total || 0);
    return;
  }
  appendRows(tbody, products, function(p) {
    const editBtn = (currentUser && currentUser.rol === ROL_ADMIN) ? '<button data-action="edit-product" data-codigo="' + p.codigo + '"><i class="nf nf-fa-pencil"></i> Editar</button>' : '';
    return createInventoryRow(p, editBtn);
  }, function(tr) {
    tr.classList.add('card-collapsible', 'collapsed');
  });
  renderInventoryPagination(result.total || 0);
}

function refreshInventoryAfterSave() {
  closeProductModal();
  loadInventory();
  renderProductSearch();
}

function renderInventoryPagination(total) {
  let el = qs(SEL.inventoryPagination);
  if (!el) {
    el = document.createElement('div');
    el.id = 'inventory-pagination';
    el.className = 'pagination';
    qs(SEL.inventoryTable).after(el);
  }
  renderPagination(el, inventoryPage, total, INVENTORY_PAGE_SIZE, 'productos', function(page) {
    inventoryPage = page;
    loadInventory();
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
  const margen = calcularMargen(p.precio_usd, p.costo);
  qs(SEL.detailMargen).textContent = margen;
  if (p.es_pesable) {
    qs(SEL.detailPrecioLabel).textContent = 'Precio ($/kg)';
    qs(SEL.detailCostoLabel).textContent = 'Costo ($/kg)';
    qs(SEL.detailStockLabel).textContent = 'Kilos';
    qs(SEL.detailStockMinimoLabel).textContent = 'Kilos Mín';
    qs(SEL.detailStock).textContent = Number.isInteger(p.stock) ? p.stock : p.stock.toFixed(3);
    qs(SEL.detailStockMinimo).textContent = Number.isInteger(p.stock_minimo) ? p.stock_minimo : p.stock_minimo.toFixed(3);
  } else {
    qs(SEL.detailPrecioLabel).textContent = 'Precio ($)';
    qs(SEL.detailCostoLabel).textContent = 'Costo ($)';
    qs(SEL.detailStockLabel).textContent = 'Stock';
    qs(SEL.detailStockMinimoLabel).textContent = 'Stock Min';
    qs(SEL.detailStock).textContent = p.stock;
    qs(SEL.detailStockMinimo).textContent = p.stock_minimo;
  }
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
  qs(SEL.productEsPesable).checked = false;
  updateProductFormLabels(false);
  clearProductErrors();
  showModal(qs(SEL.productModal));
}

function updateProductFormLabels(pesable) {
  if (pesable) {
    qs(SEL.productPrecioLabel).textContent = 'Precio en USD ($/kg)';
    qs(SEL.productCostoLabel).textContent = 'Costo en USD ($/kg)';
    qs(SEL.productStockLabel).textContent = 'Stock (kg)';
    qs(SEL.productStockMinimoLabel).textContent = 'Stock Mínimo (kg)';
  } else {
    qs(SEL.productPrecioLabel).textContent = 'Precio en USD ($)';
    qs(SEL.productCostoLabel).textContent = 'Costo en USD ($)';
    qs(SEL.productStockLabel).textContent = 'Stock';
    qs(SEL.productStockMinimoLabel).textContent = 'Stock Mínimo';
  }
  updateStockStep(pesable);
}
function updateStockStep(pesable) {
  const step = pesable ? '0.001' : '1';
  qs(SEL.productStock).step = step;
  qs(SEL.productStockMinimo).step = step;
}

function editProduct(codigo) {
  editingProduct = codigo;
  const p = productCache.find(x => x.codigo === codigo);
  if (!p) { showToast('Producto no encontrado', 'error'); return; }
  qs(SEL.productModalTitle).textContent = 'Editar Producto';
  qs(SEL.productSaveText).textContent = 'Guardar';
  clearProductErrors();
  qs(SEL.productNombre).value = p.nombre;
  qs(SEL.productPrecio).value = comaAutomaticaEnabled ? p.precio_usd.toFixed(2).replace('.', ',') : p.precio_usd;
  qs(SEL.productCosto).value = p.costo || 0;
  qs(SEL.productStock).value = p.stock;
  qs(SEL.productStockMinimo).value = p.stock_minimo;
  qs(SEL.productEsPesable).checked = !!p.es_pesable;
  updateProductFormLabels(!!p.es_pesable);
  qs(SEL.productDeleteBtn).style.display = 'inline-flex';
  showModal(qs(SEL.productModal));
}

function closeProductModal() {
  closeModal(qs(SEL.productModal));
  clearProductErrors();
}

/* ========== STOCK ADJUST ========== */
let stockAdjustCodigo = null;

async function showPriceHistory(codigo, nombre) {
  const modal = qs(SEL.precioHistoryModal);
  const tbody = qs(SEL.precioHistoryBody);
  qs(SEL.precioHistoryTitle).textContent = nombre ? ('Historial de precios — ' + nombre) : 'Historial de precios';
  tbody.innerHTML = loadingTableRow(5);
  showModal(modal);
  try {
    const items = await invoke('get_precio_historial', { productoCodigo: codigo });
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
      tbody.innerHTML = emptyTableRow(5, '<i class="nf nf-fa-line_chart"></i>', 'Sin cambios de precio', 'No se registraron cambios de precio para este producto');
      return;
    }
    appendRows(tbody, items, function(item) {
      const diff = item.precio_nuevo - item.precio_anterior;
      const arrow = diff > 0 ? '<span style="color:var(--success)">▲</span>' : (diff < 0 ? '<span style="color:var(--danger)">▼</span>' : '');
      return '<td>' + escapeHtml(item.fecha_hora) + '</td><td>' + formatUSD(item.precio_anterior) + '</td><td>' + formatUSD(item.precio_nuevo) + '</td><td>' + arrow + ' ' + formatUSD(diff) + '</td><td>' + escapeHtml(item.usuario || '—') + '</td>';
    });
  } catch (e) {
    tbody.innerHTML = errorTableRow(5, e);
  }
}

function openStockAdjustModal(codigo) {
  stockAdjustCodigo = codigo;
  const p = productCache.find(x => x.codigo === codigo);
  if (!p) { showToast('Producto no encontrado', 'error'); return; }
  qs(SEL.stockAdjustNombre).textContent = p.nombre;
  qs(SEL.stockAdjustActual).textContent = Number.isInteger(p.stock) ? p.stock : p.stock.toFixed(3);
  qs(SEL.stockAdjustCantidad).value = '';
  qs(SEL.stockAdjustMotivo).value = '';
  clearStockAdjustErrors();
  showModal(qs(SEL.stockAdjustModal));
}

function closeStockAdjustModal() {
  closeModal(qs(SEL.stockAdjustModal));
  stockAdjustCodigo = null;
  clearStockAdjustErrors();
}

function clearStockAdjustErrors() {
  ['stock-adjust-cantidad', 'stock-adjust-motivo'].forEach(function(id) {
    var err = qs('#' + id + '-error');
    var input = qs('#' + id);
    if (err) { err.textContent = ''; err.classList.remove('visible'); }
    if (input) input.classList.remove('input-error');
  });
}

async function confirmStockAdjust() {
  if (!stockAdjustCodigo) return;
  const cantidad = parseFloat(qs(SEL.stockAdjustCantidad).value);
  const motivo = qs(SEL.stockAdjustMotivo).value.trim();
  clearStockAdjustErrors();
  let hasError = false;
  if (!cantidad || cantidad === 0) {
    qs(SEL.stockAdjustCantidadError).textContent = 'Indique una cantidad distinta de cero';
    qs(SEL.stockAdjustCantidadError).classList.add('visible');
    qs(SEL.stockAdjustCantidad).classList.add('input-error');
    hasError = true;
  }
  if (!motivo) {
    qs(SEL.stockAdjustMotivoError).textContent = 'El motivo es obligatorio';
    qs(SEL.stockAdjustMotivoError).classList.add('visible');
    qs(SEL.stockAdjustMotivo).classList.add('input-error');
    hasError = true;
  }
  if (hasError) return;
  const p = productCache.find(x => x.codigo === stockAdjustCodigo);
  const nuevo = (p ? p.stock : 0) + cantidad;
  if (nuevo < 0) { showToast('El ajuste dejar\u00eda el stock en negativo', 'error'); return; }
  const signo = cantidad > 0 ? '+' : '';
  const ok = await confirmModal(
    '\u00bfAjustar stock de "' + (p ? p.nombre : stockAdjustCodigo) + '" en ' + signo + cantidad + ' (queda ' + nuevo + ')?\nMotivo: ' + motivo,
    'Ajustar Stock', 'Aplicar'
  );
  if (!ok) return;
  const btn = qs(SEL.stockAdjustConfirmBtn);
  if (btn) btn.disabled = true;
  try {
    if (await invokeOrError(invoke('registrar_ajuste_stock', { codigo: stockAdjustCodigo, cantidad, motivo })) === undefined) return;
    showToast('Stock ajustado en ' + signo + cantidad);
    closeStockAdjustModal();
    loadInventory();
    renderProductSearch();
    loadProductCache();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
}

/* Inline validation errors */
function clearProductErrors() {
  ['product-nombre', 'product-precio', 'product-costo', 'product-stock', 'product-stock-minimo'].forEach(function(id) {
    var err = document.getElementById(id + '-error');
    var input = document.getElementById(id);
    if (err) { err.textContent = ''; err.classList.remove('visible'); }
    if (input) input.classList.remove('input-error');
  });
}
function showProductError(inputId, msg) {
  var err = document.getElementById(inputId + '-error');
  var input = document.getElementById(inputId);
  if (err) { err.textContent = msg; err.classList.add('visible'); }
  if (input) input.classList.add('input-error');
}

/* ========== COMBOS ========== */
let comboProductosSeleccionados = [];
let combosearchTimer = null;

function openComboModal() {
  comboProductosSeleccionados = [];
  qs(SEL.comboNombre).value = '';
  qs(SEL.comboPrecio).value = '';
  qs(SEL.comboError).style.display = 'none';
  qs(SEL.comboSearch).value = '';
  renderComboDisponibles();
  renderComboSeleccionados();
  showModal(qs(SEL.comboModal));
}

function closeComboModal() {
  closeModal(qs(SEL.comboModal));
}

function renderComboDisponibles() {
  const query = qs(SEL.comboSearch).value.trim().toLowerCase();
  let disponibles = productCache.filter(p => p.es_inari && p.subcategoria !== 'combos' && !comboProductosSeleccionados.some(s => s.codigo === p.codigo));
  if (query) disponibles = disponibles.filter(p => p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query));
  const container = qs(SEL.comboAvailableList);
  if (disponibles.length === 0) {
    const allAdded = !productCache.some(p => p.es_inari && p.subcategoria !== 'combos' && !comboProductosSeleccionados.some(s => s.codigo === p.codigo));
    container.innerHTML = '<div class="text-muted" style="padding:14px;text-align:center;font-size:13px">' + (allAdded ? 'Todos los productos ya est\u00e1n agregados' : 'Sin resultados') + '</div>';
    return;
  }
  container.innerHTML = disponibles.map(p =>
    '<div class="combo-prod-item" data-codigo="' + escapeHtml(p.codigo) + '">' +
      '<span class="prod-name">' + escapeHtml(p.nombre) + '</span>' +
      '<span class="prod-price">' + formatUSD(p.precio_usd) + '</span>' +
    '</div>'
  ).join('');
  container.querySelectorAll('.combo-prod-item').forEach(el => {
    el.addEventListener('click', function() {
      comboProductosSeleccionados.push({ codigo: this.dataset.codigo, cantidad: 1 });
      qs(SEL.comboSearch).value = '';
      renderComboDisponibles();
      renderComboSeleccionados();
    });
  });
}

function renderComboSeleccionados() {
  const container = qs(SEL.comboSelectedList);
  const badge = qs(SEL.comboCountBadge);
  badge.textContent = '(' + comboProductosSeleccionados.length + ')';
  if (comboProductosSeleccionados.length === 0) {
    container.innerHTML = '<div class="text-muted" style="padding:14px;text-align:center;font-size:12px">Agregue productos Inari desde la lista de arriba</div>';
    return;
  }
  container.innerHTML = comboProductosSeleccionados.map((item, idx) => {
    const p = productCache.find(x => x.codigo === item.codigo);
    const name = p ? p.nombre : item.codigo;
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid var(--border)">' +
      '<span style="flex:1;font-size:13px">' + escapeHtml(name) + '</span>' +
      '<button class="btn btn-sm btn-outline combo-qty-btn" data-idx="' + idx + '" data-dir="dec" style="padding:2px 8px;font-size:16px;line-height:1">&minus;</button>' +
      '<span class="combo-qty-display" data-idx="' + idx + '" style="min-width:24px;text-align:center;font-weight:600;font-size:14px">' + item.cantidad + '</span>' +
      '<button class="btn btn-sm btn-outline combo-qty-btn" data-idx="' + idx + '" data-dir="inc" style="padding:2px 8px;font-size:16px;line-height:1">+</button>' +
      '<button class="btn btn-sm btn-outline" data-action="remove-combo-sel" data-idx="' + idx + '" style="color:var(--danger);padding:2px 8px"><i class="nf nf-fa-trash"></i></button></div>';
  }).join('');
  container.querySelectorAll('.combo-qty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx);
      const dir = this.dataset.dir;
      if (!comboProductosSeleccionados[idx]) return;
      if (dir === 'inc') comboProductosSeleccionados[idx].cantidad++;
      else if (comboProductosSeleccionados[idx].cantidad > 1) comboProductosSeleccionados[idx].cantidad--;
      renderComboSeleccionados();
    });
  });
  container.querySelectorAll('[data-action="remove-combo-sel"]').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.idx);
      comboProductosSeleccionados.splice(idx, 1);
      renderComboDisponibles();
      renderComboSeleccionados();
    });
  });
}

async function saveCombo() {
  const nombre = qs(SEL.comboNombre).value.trim();
  const precio = parseFloat(qs(SEL.comboPrecio).value);
  const errorEl = qs(SEL.comboError);
  errorEl.style.display = 'none';
  if (!nombre) { errorEl.textContent = 'El nombre del combo es obligatorio'; errorEl.style.display = 'block'; return; }
  if (!precio || precio <= 0) { errorEl.textContent = 'El precio debe ser mayor a cero'; errorEl.style.display = 'block'; return; }
  if (comboProductosSeleccionados.length === 0) { errorEl.textContent = 'Agregue al menos un producto al combo'; errorEl.style.display = 'block'; return; }
  try {
    await invoke('create_combo', { nombre, precioUsd: precio, productos: comboProductosSeleccionados });
    showToast('Combo creado exitosamente');
    closeComboModal();
    if (inariSubcat === 'combos') loadInventory();
  } catch (e) { errorEl.textContent = e; errorEl.style.display = 'block'; }
}

async function saveProduct() {
  const btn = qs(SEL.productSaveBtn);
  const codigo = editingProduct || '';
  const nombre = stripEmojis(qs(SEL.productNombre).value.trim());
  const precio = parseInput(qs(SEL.productPrecio).value);
  const costo = parseInput(qs(SEL.productCosto).value) || 0;
  const stock = parseFloat(qs(SEL.productStock).value) || 0;
  const stockMinimo = parseFloat(qs(SEL.productStockMinimo).value) || 0;
  const esPesable = qs(SEL.productEsPesable).checked;
  clearProductErrors();
  var hasError = false;
  if (!nombre || nombre.length < 1) { showProductError('product-nombre', 'El nombre es obligatorio'); hasError = true; }
  if (isNaN(precio) || precio < 0) { showProductError('product-precio', 'Ingrese un precio v\u00e1lido'); hasError = true; }
  if (isNaN(stock) || stock < 0) { showProductError('product-stock', 'Ingrese un stock v\u00e1lido'); hasError = true; }
  if (hasError) return;
  if (btn) btn.disabled = true;
  try {
    if (editingProduct) {
      await invoke('update_product', { codigo, nombre, precioUsd: precio, costo, stock });
      await invoke('update_stock_minimo', { codigo, stockMinimo });
    } else {
      await invoke('create_product', { codigo, nombre, precioUsd: precio, costo, stock, esPesable });
      if (stockMinimo > 0) {
        await invoke('update_stock_minimo', { codigo, stockMinimo });
      }
    }
    showToast(editingProduct ? 'Producto actualizado con \u00e9xito' : 'Producto registrado con \u00e9xito');
    playSound('success');
    refreshInventoryAfterSave();
    loadProductCache();
  } catch (e) {
    showToast('Error: ' + e, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteProduct() {
  if (!editingProduct) return;
  const btn = qs(SEL.productDeleteBtn);
  const ok = await confirmModal('\u00bfEliminar producto ' + editingProduct + '?', 'Eliminar Producto', 'Eliminar');
  if (!ok) return;
  if (btn) btn.disabled = true;
  try {
    if (await invokeOrError(invoke('delete_product', { codigo: editingProduct })) === undefined) return;
    showToast('Producto eliminado');
    playSound('remove');
    refreshInventoryAfterSave();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
}

async function exportProducts() {
  const b64 = await invokeOrError(invoke('export_products_xlsx', { tasa: tasaActual }));
  if (b64 === undefined) return;
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



