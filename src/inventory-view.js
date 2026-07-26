/* ========== INVENTORY ========== */
let inventoryPage = 1;
let showInari = false;
let inariSubcat = '';
const INARI_DIAS = [4, 5, 6, 0]; // jueves, viernes, sábado, domingo

async function loadInventory() {
  const query = qs(SEL.inventorySearch).value.trim();
  const tbody = qs(SEL.inventoryBody);
  showLoading(tbody);
  try {
    const result = await invoke('list_products', { search: query || null, page: inventoryPage, pageSize: INVENTORY_PAGE_SIZE, inari: showInari || null, subcategoria: inariSubcat || null });
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
  const precio = parsePrecio(qs(SEL.productPrecio).value);
  const costo = parsePrecio(qs(SEL.productCosto).value) || 0;
  const stock = parseInt(qs(SEL.productStock).value) || 0;
  const stockMinimo = parseInt(qs(SEL.productStockMinimo).value) || 0;
  if (!nombre || isNaN(precio) || precio < 0) { showToast('Complete todos los campos', 'error'); return; }
  if (btn) btn.disabled = true;
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
    await invoke('delete_product', { codigo: editingProduct });
    showToast('Producto eliminado');
    playSound('remove');
    closeProductModal(); loadInventory(); renderProductSearch();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
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



