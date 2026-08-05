/* ========== HELPERS ========== */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function haptic(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

function calcularMargen(precio, costo) {
  if (!(costo > 0) || !(precio > 0)) return '—';
  return ((precio - costo) / precio * 100).toFixed(1) + '%';
}

function formatStock(n) {
  return Number.isInteger(n) ? n : n.toFixed(3);
}

function createVendorSalesRow(v) {
  return '<td data-label="Vendedor">' + escapeHtml(v.username) + '</td><td data-label="Ventas">' + v.total_ventas + '</td><td data-label="Anuladas">' + v.ventas_anuladas + '</td><td data-label="Total ($)">' + formatUSD(v.total_usd) + '</td><td data-label="Costo ($)">' + formatUSD(v.total_costo_usd) + '</td><td data-label="Ganancia ($)">' + formatUSD(v.total_ganancia_usd) + '</td><td data-label="Total (Bs.)"><span class="bs-price-cell">' + formatBS(v.total_bs) + '</span></td>';
}

function createProductRow(p) {
  const name = escapeHtml(p.nombre);
  const inariBadge = p.es_inari ? ' <span class="badge badge-inari">Inari</span>' : '';
  const favBtn = '<button class="fav-star-btn' + (p.favorito ? ' active' : '') + '" data-action="toggle-favorito" data-codigo="' + escapeHtml(p.codigo) + '" title="' + (p.favorito ? 'Quitar de favoritos' : 'Agregar a favoritos') + '" aria-label="Favorito"><i class="nf nf-fa-star"></i></button>';
  return '<td title="' + name + '"><div class="prod-name-cell"><span class="prod-name">' + name + inariBadge + '</span>' + favBtn + '</div></td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><button class="btn btn-primary btn-sm" data-action="add-to-cart" data-codigo="' + escapeHtml(p.codigo) + '">+</button></td>';
}
function createProductCard(p) {
  const name = escapeHtml(p.nombre);
  const inariBadge = p.es_inari ? ' <span class="badge badge-inari">Inari</span>' : '';
  const lowStock = (p.stock < p.stock_minimo) ? ' low-stock' : '';
  return '<div class="product-card" data-codigo="' + escapeHtml(p.codigo) + '">' +
    '<div class="product-card-top">' +
      '<span class="product-card-name" title="' + name + '">' + name + inariBadge + '</span>' +
      '<button class="fav-star-btn' + (p.favorito ? ' active' : '') + '" data-action="toggle-favorito" data-codigo="' + escapeHtml(p.codigo) + '" title="' + (p.favorito ? 'Quitar de favoritos' : 'Agregar a favoritos') + '" aria-label="Favorito"><i class="nf nf-fa-star"></i></button>' +
    '</div>' +
    '<div class="product-card-prices">' +
      '<span class="product-card-price-usd">' + formatUSD(p.precio_usd) + '</span>' +
      '<span class="product-card-price-bs bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span>' +
    '</div>' +
    '<div class="product-card-foot">' +
      '<span class="product-card-stock' + lowStock + '"><i class="nf nf-fa-cube"></i> ' + (Number.isInteger(p.stock) ? p.stock : p.stock.toFixed(3)) + '</span>' +
      '<button class="btn btn-primary product-card-add" data-action="add-to-cart" data-codigo="' + escapeHtml(p.codigo) + '">+</button>' +
    '</div>' +
  '</div>';
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
  var qtyCell;
  if (item.es_pesable) {
    qtyCell = '<div class="cart-qty-wrap"><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="0" step="0.001" data-codigo="' + code + '" placeholder="0.000"> <span class="text-muted text-sm">kg</span></div>';
  } else if (item.es_inari) {
    qtyCell = '<div class="cart-qty-wrap"><button class="cart-qty-btn" data-action="qty-dec" data-codigo="' + code + '">&minus;</button><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="1" max="9999" data-codigo="' + code + '"><button class="cart-qty-btn" data-action="qty-inc" data-codigo="' + code + '">+</button></div>';
  } else {
    qtyCell = '<div class="cart-qty-wrap"><button class="cart-qty-btn" data-action="qty-dec" data-codigo="' + code + '">&minus;</button><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="1" max="' + item.stock + '" data-codigo="' + code + '"><button class="cart-qty-btn" data-action="qty-inc" data-codigo="' + code + '">+</button></div>';
  }
  return '<td><div class="cart-product-info"><span class="cart-product-name" title="' + name + '">' + name + '</span><span class="cart-product-code">' + code + '</span></div></td><td>' + qtyCell + '</td><td class="' + cls + '"><span class="cart-total-text">' + totalText + '</span>' + editBtn + '</td><td><button class="cart-remove-btn" data-action="remove-from-cart" data-codigo="' + code + '" title="Eliminar"><i class="nf nf-fa-trash"></i></button></td>';
}
function createInventoryRow(p, editBtn) {
  var stockClass = (p.stock < p.stock_minimo) ? ' low-stock' : '';
  var stockBadge = (p.stock < p.stock_minimo) ? '<span class="badge badge-danger" title="Debajo del stock mínimo">!</span>' : '';
  var costo = p.costo || 0;
  var margen = calcularMargen(p.precio_usd, costo);
  var tasa = tasaInventario > 0 ? tasaInventario : tasaActual;
  var inariBadge = p.es_inari ? ' <span class="badge badge-inari">Inari</span>' : '';
  var pesableBadge = p.es_pesable ? ' <span class="badge badge-info" title="Pesable por kilo">kg</span>' : '';
  var inariToggleBtn = (currentUser && currentUser.rol === ROL_ADMIN)
    ? (p.es_inari
        ? '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="false"><i class="nf nf-fa-fire"></i> Quitar Inari</button>'
        : '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="true"><i class="nf nf-fa-fire"></i> Marcar Inari</button>')
    : '';
  var adjustBtn = (currentUser && currentUser.rol === ROL_ADMIN)
    ? '<button data-action="open-stock-adjust" data-codigo="' + escapeHtml(p.codigo) + '"><i class="nf nf-fa-scale"></i> Ajustar stock</button>'
    : '';
  var stockDisplay = formatStock(p.stock);
  var stockMinDisplay = formatStock(p.stock_minimo);
  var toggleCell = '<td class="cell-toggle" data-label=""><button class="card-collapse-btn" data-action="toggle-card-collapse" type="button" aria-label="Expandir o plegar tarjeta"><i class="nf nf-fa-chevron_down"></i></button></td>';
  return '<td class="cell-key cell-name" data-label="Producto">' + escapeHtml(p.nombre) + inariBadge + pesableBadge + '</td><td class="cell-key cell-price" data-label="Precio ($)">' + formatUSD(p.precio_usd) + '</td><td data-label="Costo">' + formatUSD(costo) + '</td><td data-label="Margen">' + margen + '</td><td data-label="Precio (Bs.)"><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasa) + '</span></td><td class="cell-key cell-stock' + stockClass + '" data-label="Stock">' + stockDisplay + ' ' + stockBadge + '</td><td data-label="Mínimo">' + stockMinDisplay + '</td><td data-label="Acciones"><div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones"><i class="nf nf-fa-ellipsis_v"></i></button><div class="dropdown-menu"><button data-action="show-product-detail" data-codigo="' + escapeHtml(p.codigo) + '"><i class="nf nf-fa-info_circle"></i> Detalles</button><button data-action="show-product-history" data-codigo="' + escapeHtml(p.codigo) + '" data-nombre="' + escapeHtml(p.nombre) + '"><i class="nf nf-fa-history"></i> Historial</button><button data-action="show-price-history" data-codigo="' + escapeHtml(p.codigo) + '" data-nombre="' + escapeHtml(p.nombre) + '"><i class="nf nf-fa-line_chart"></i> Historial precios</button>' + editBtn + adjustBtn + inariToggleBtn + '</div></div></td>' + toggleCell;
}
function createClientRow(c) {
  const isAdmin = currentUser && currentUser.rol === ROL_ADMIN;
  var activoBadge = c.es_temporal
    ? '<span class="badge badge-temporal" style="font-size:10px" title="Cliente temporal: se elimina al saldar su deuda">Temporal</span>'
    : (c.credito_activo
        ? '<span class="badge badge-success" style="font-size:10px">Activo</span>'
        : '<span class="badge badge-danger" style="font-size:10px">Inactivo</span>');
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
  var dropdown = '<div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones"><i class="nf nf-fa-ellipsis_v"></i></button><div class="dropdown-menu">' + dropdownItems + '</div></div>';
  var deudaCls = (c.saldo_deuda_usd > 0) ? ' debt-amount' : ' debt-paid';
  var toggleCell = '<td class="cell-toggle" data-label=""><button class="card-collapse-btn" data-action="toggle-card-collapse" type="button" aria-label="Expandir o plegar tarjeta"><i class="nf nf-fa-chevron_down"></i></button></td>';
  return '<td class="cell-key cell-name" data-label="Cliente">' + escapeHtml(c.nombre) + '</td><td class="cell-key cell-status" data-label="Cr\u00e9dito">' + activoBadge + '</td><td class="cell-key cell-debt' + deudaCls + '" data-label="Deuda">' + formatUSD(c.saldo_deuda_usd) + '</td><td data-label="Última compra">' + ultimaCompra + '</td><td data-label="Acciones">' + dropdown + '</td>' + toggleCell;
}
function createAuditRow(log) {
  return '<td data-label="ID">' + log.id + '</td><td data-label="Fecha">' + escapeHtml(log.fecha_hora) + '</td><td data-label="Usuario">' + escapeHtml(log.usuario) + '</td><td data-label="Acción">' + escapeHtml(log.accion) + '</td>';
}
function createDailySaleRow(v, metodoLabel) {
  const nota = v.nota_anulacion ? escapeHtml(v.nota_anulacion) : '';
  const anuladaLabel = v.anulada
    ? (nota
        ? '<span class="badge badge-danger" title="' + nota + '"><i class="nf nf-fa-ban"></i> Anulada</span>'
        : '<span class="badge badge-danger"><i class="nf nf-fa-ban"></i> Anulada</span>')
    : '<button class="btn btn-sm btn-danger void-sale-btn" data-id="' + v.id + '" title="Anular venta"><i class="nf nf-fa-ban"></i></button>';
  const detailBtn = '<button class="btn btn-sm btn-outline sale-detail-btn" data-id="' + v.id + '" data-total="' + v.total_usd + '" data-metodo="' + escapeHtml(metodoLabel) + '" data-usuario="' + escapeHtml(v.username) + '" data-fecha="' + escapeHtml(v.fecha_hora) + '" data-nota="' + nota + '" data-obs="' + (v.nota ? escapeHtml(v.nota) : '') + '" title="Ver detalles"><i class="nf nf-fa-receipt"></i></button>';
  return '<td data-label="#">' + v.id + '</td><td data-label="Hora">' + escapeHtml(v.fecha_hora.split(' ')[1]) + '</td><td data-label="Usuario">' + escapeHtml(v.username) + '</td><td data-label="Método">' + escapeHtml(metodoLabel) + '</td><td data-label="Total ($)">' + formatUSD(v.total_usd) + '</td><td data-label="Total (Bs.)">' + formatBS(v.total_bs) + '</td><td data-label="Acción">' + detailBtn + ' ' + anuladaLabel + '</td>';
}
function createDebtSaleCard(v, prodHtml) {
  return '<div class="debt-sale-header"><span># Venta ' + v.id + '</span><span>' + v.fecha_hora + '</span></div><div class="debt-sale-total">Total: ' + formatUSD(v.total_usd) + '</div>' + prodHtml;
}

function createUserRow(u) {
  const isAdmin = u.username === 'admin';
  const pwdBtn = isAdmin ? '' : '<button class="btn btn-sm btn-outline admin-pwd-btn" data-id="' + u.id + '" data-username="' + escapeHtml(u.username) + '" title="Cambiar contrase\u00f1a" style="margin-right:4px"><i class="nf nf-fa-lock"></i></button>';
  return '<td data-label="Usuario">' + escapeHtml(u.username) + '</td><td data-label="Rol">' + escapeHtml(u.rol) + '</td><td data-label="Acción">' + pwdBtn + '<button class="btn btn-sm btn-danger delete-user-btn" data-id="' + u.id + '" ' + (isAdmin ? 'disabled title="No se puede eliminar"' : '') + '><i class="nf nf-fa-trash"></i></button></td>';
}

function createReportRow(v) {
  const metodoLabel = formatMetodoLabel(v.venta.metodo_pago);
  const prodCount = v.productos ? v.productos.reduce(function(s, p) { return s + p.cantidad; }, 0) : 0;
  const notaEsc = v.venta.nota_anulacion ? escapeHtml(v.venta.nota_anulacion) : '';
  const badge = v.venta.anulada
    ? (notaEsc
        ? ' <span class="badge badge-danger" title="' + notaEsc + '">Anulada</span>'
        : ' <span class="badge badge-danger">Anulada</span>')
    : '';
  var costoTotal = 0;
  if (v.productos) {
    v.productos.forEach(function(d) { costoTotal += (d.costo || 0) * d.cantidad; });
  }
  var ganancia = v.venta.total_usd - costoTotal;
  const vv = v.venta;
  const obs = vv.nota ? escapeHtml(vv.nota) : '';
  const detailBtn = '<button class="btn btn-sm btn-outline sale-detail-btn" data-id="' + vv.id + '" data-total="' + vv.total_usd + '" data-metodo="' + escapeHtml(metodoLabel) + '" data-usuario="' + escapeHtml(vv.username) + '" data-fecha="' + escapeHtml(vv.fecha_hora) + '" data-nota="' + notaEsc + '" data-obs="' + obs + '" title="Ver detalles"><i class="nf nf-fa-receipt"></i></button>';
  return '<td data-label="#">' + vv.id + '</td><td data-label="Fecha">' + escapeHtml(vv.fecha_hora) + '</td><td data-label="Usuario">' + escapeHtml(vv.username) + '</td><td data-label="Método">' + escapeHtml(metodoLabel) + '</td><td data-label="Prod.">' + prodCount + '</td><td data-label="Total ($)">' + formatUSD(vv.total_usd) + '</td><td data-label="Costo ($)">' + formatUSD(costoTotal) + '</td><td data-label="Ganancia ($)">' + formatUSD(Math.max(0, ganancia)) + '</td><td data-label="Total (Bs.)">' + formatBS(vv.total_bs) + badge + '</td><td data-label="Acción">' + detailBtn + '</td>';
}

const TPL_CLOSE_REPORT_STYLE = 'body{font-family:monospace;font-size:12px;padding:24px}h2{text-align:center;margin-bottom:4px}h4{margin:12px 0 4px;border-bottom:1px solid #000}table{width:100%;border-collapse:collapse;margin:4px 0}th,td{padding:3px 6px;text-align:left;border-bottom:1px solid #ccc}th{border-bottom:2px solid #000}.total{font-weight:700;text-align:right;margin-top:4px}';

const RECENT_MAX = 10;

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

function buildToastEl(msg, cfg, action) {
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

  return el;
}

function toastBindLifecycle(el, cfg) {
  el._remaining = cfg.duration;
  el._lastTick = performance.now();
  el._pausedAt = null;
  el._frame = null;
  el._timer = null;
  el._resumeTimer = null;

  el._timer = setTimeout(() => hideToast(el), cfg.duration);
  el._frame = requestAnimationFrame(() => toastTick(el, cfg));

  el.addEventListener('mouseenter', () => toastPause(el));
  el.addEventListener('mouseleave', () => toastStartResume(el, cfg));
  el.addEventListener('touchstart', () => toastPause(el), { passive: true });
  el.addEventListener('touchend', function(e) {
    const touch = e.changedTouches[0];
    const rect = el.getBoundingClientRect();
    if (touch.clientX - rect.left < rect.width * 0.7) {
      toastStartResume(el, cfg);
    }
  }, { passive: true });

  function outsideClick(e) {
    if (el._pausedAt !== null && !el.contains(e.target)) {
      toastStartResume(el, cfg);
    }
  }
  document.addEventListener('touchstart', outsideClick, { passive: true });
  document.addEventListener('mousedown', outsideClick);

  el.addEventListener('click', function(e) {
    if (e.target === el || e.target.classList.contains('toast-msg')) hideToast(el);
  });

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
}

function passwordTooShortMsg() {
  return 'La contrase\u00f1a debe tener al menos ' + MIN_PASSWORD_LEN + ' caracteres';
}

function showToast(msg, type = 'success', action) {
  const cfg = TOAST.TYPES[type] || TOAST.TYPES.info;
  const container = qs(SEL.toastContainer);
  if (!container) return;

  if (toastVisible >= TOAST.MAX_VISIBLE) {
    toastQueue.push({ msg, type, action });
    return;
  }

  const el = buildToastEl(msg, cfg, action);
  toastBindLifecycle(el, cfg);
  container.appendChild(el);
  toastVisible++;
}

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }

/* ========== GUARDAR ARCHIVOS ==========
   Android: envía base64 al plugin → carpeta Descargas (MediaStore).
   Escritorio: abre diálogo "Guardar como" con nombre editable y escribe el archivo. */
async function saveExportedFile(fileName, data) {
  let b64;
  if (typeof data === 'string') {
    b64 = data;
  } else if (data instanceof Blob) {
    b64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(data);
    });
  } else {
    throw new Error('Datos no v\u00e1lidos para exportar');
  }
  if (IS_ANDROID) {
    await invoke('plugin:gestor-downloads|save_to_downloads', {
      payload: { file_name: fileName, content: b64 },
    });
    return { saved: true, path: 'Descargas' };
  }
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const path = await invoke('plugin:dialog|save', {
    options: {
      defaultPath: fileName,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    },
  });
  if (!path) return { saved: false, canceled: true };
  await invoke('plugin:gestor-downloads|save_to_path', {
    payload: { path, content: b64 },
  });
  return { saved: true, path };
}

/* ========== CONFIRM MODAL ========== */
function confirmModal(msg, title, okText) {
  return new Promise(resolve => {
    const modal = qs(SEL.confirmModal);
    qs(SEL.confirmTitle).textContent = title || 'Confirmar';
    qs(SEL.confirmMessage).textContent = msg;
    const okBtn = qs(SEL.confirmOkBtn);
    okBtn.innerHTML = '<i class="nf nf-fa-check"></i> ' + (okText || 'Confirmar');
    okBtn.onclick = () => { closeModal(modal); resolve(true); };
    qs(SEL.confirmCancelBtn).onclick = () => { closeModal(modal); resolve(false); };
    qs(SEL.confirmClose).onclick = () => { closeModal(modal); resolve(false); };
    modal.addEventListener('click', function handler(e) {
      if (e.target === modal) { closeModal(modal); resolve(false); modal.removeEventListener('click', handler); }
    });
    showModal(modal);
  });
}

function promptModal(msg, title, okText) {
  return new Promise(resolve => {
    const modal = qs(SEL.promptModal);
    qs(SEL.promptTitle).textContent = title || 'Ingresar nota';
    qs(SEL.promptMessage).textContent = msg || '';
    const input = qs(SEL.promptInput);
    input.value = '';
    input.classList.remove('input-error');
    const okBtn = qs(SEL.promptOkBtn);
    okBtn.innerHTML = '<i class="nf nf-fa-check"></i> ' + (okText || 'Aceptar');
    const finish = (val) => { closeModal(modal); resolve(val); };
    okBtn.onclick = () => {
      const val = input.value.trim();
      if (!val) { input.classList.add('input-error'); input.focus(); return; }
      finish(val);
    };
    qs(SEL.promptCancelBtn).onclick = () => finish(null);
    qs(SEL.promptClose).onclick = () => finish(null);
    modal.addEventListener('click', function handler(e) {
      if (e.target === modal) { finish(null); modal.removeEventListener('click', handler); }
    });
    input.onkeydown = (e) => { if (e.key === 'Enter') okBtn.onclick(); };
    showModal(modal);
    setTimeout(() => input.focus(), 50);
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
async function withLoadingModal(text, fn) {
  showLoadingModal(text);
  await forcePaint();
  try {
    return await fn();
  } finally {
    hideLoadingModal();
  }
}
function emptyState(icon, text, sub) {
  return '<div class="empty-state"><span class="empty-icon">' + icon + '</span><div class="empty-text">' + text + '</div>' + (sub ? '<div class="empty-sub">' + sub + '</div>' : '') + '</div>';
}
function tableRowWrap(colspan, contentHtml) {
  return '<tr><td colspan="' + colspan + '">' + contentHtml + '</td></tr>';
}
function emptyTableRow(colspan, icon, text, sub) {
  return tableRowWrap(colspan, emptyState(icon, text, sub));
}
function loadingTableRow(colspan, text) {
  return tableRowWrap(colspan, '<div class="empty-state"><span class="empty-icon"><i class="nf nf-fa-spinner nf-fa-spin"></i></span><div class="empty-text">' + (text || 'Cargando...') + '</div></div>');
}
function errorTableRow(colspan, msg) {
  return tableRowWrap(colspan, '<div class="empty-state"><span class="empty-text" style="color:var(--danger)">' + escapeHtml(msg) + '</span></div>');
}
function appendRows(tbody, items, rowFn, setupTr) {
  const frag = document.createDocumentFragment();
  items.forEach(function(item) {
    const tr = document.createElement('tr');
    tr.innerHTML = rowFn(item);
    if (setupTr) setupTr(tr, item);
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}
async function invokeOrError(promise, errMsg) {
  try {
    return await promise;
  } catch (e) {
    showToast(errMsg || ('Error: ' + e), 'error');
    return undefined;
  }
}

/* ========== MODAL HELPERS ========== */
let lastFocused = null;
function showModal(el) {
  lastFocused = document.activeElement;
  qsa('.modal').forEach(m => { if (m !== el) m.classList.add('hidden'); });
  el.classList.remove('hidden');
  var content = el.querySelector('.modal-content');
  if (content && !content.classList.contains('dragging')) content.style.transform = '';
}
function closeModal(el) {
  el.classList.add('hidden');
  if (lastFocused && lastFocused.focus) {
    try { lastFocused.focus(); } catch (_) {}
    lastFocused = null;
  }
}

function isBsMethod(m) { return m === METODO_EFECTIVO_BS || m === METODO_BIOPAGO || m === METODO_PUNTO || m === METODO_PAGO_MOVIL; }

function esRefPagoMovilValida(ref) { return !!ref && ref.length === PAGO_MOVIL_REF_LEN; }
function bsToUsd(bs, tasa) { return bs / tasa; }
async function getTasaConFallback() { return tasaActual || await invoke('get_tasa'); }

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

var modalDragEnabled = true;

function initModalDrag() {
  if (window.innerWidth <= 768) return;
  qsa('.modal').forEach(function(modal) {
    if (modal.id === 'confirm-modal') return;
    var header = modal.querySelector('.modal-header');
    var content = modal.querySelector('.modal-content');
    if (!header || !content) return;
    var isDragging = false, startX, startY, originX = 0, originY = 0;

    function getTranslate() {
      var t = content.style.transform;
      var m = t && t.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
      return m ? [parseFloat(m[1]) || 0, parseFloat(m[2]) || 0] : [0, 0];
    }

    header.addEventListener('mousedown', function(e) {
      if (!modalDragEnabled) return;
      if (e.button !== 0) return;
      var pos = getTranslate();
      originX = pos[0]; originY = pos[1];
      startX = e.clientX; startY = e.clientY;
      isDragging = true;
      content.classList.add('dragging');
      modal.style.background = 'transparent';
      content.style.opacity = '0.75';
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      var dx = e.clientX - startX + originX;
      var dy = e.clientY - startY + originY;
      content.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    });
    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      content.classList.remove('dragging');
      modal.style.background = '';
      content.style.opacity = '';
    });
  });
}

function initModalResize() {
  if (window.innerWidth > 768) return;
  qsa('.modal .modal-content').forEach(function(content) {
    if (content.querySelector('.modal-resize-handle')) return;
    var handle = document.createElement('div');
    handle.className = 'modal-resize-handle';
    content.insertBefore(handle, content.firstChild);
    var startY, startH;
    handle.addEventListener('pointerdown', function(e) {
      startY = e.clientY;
      startH = content.offsetHeight;
      content.classList.add('resizing');
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function(e) {
      if (startY === undefined) return;
      var dy = e.clientY - startY;
      var newH = Math.max(250, Math.min(window.innerHeight * 0.92, startH - dy));
      content.style.maxHeight = newH + 'px';
      content.style.height = newH + 'px';
    });
    handle.addEventListener('pointerup', function() {
      content.classList.remove('resizing');
      startY = undefined;
    });
    handle.addEventListener('pointercancel', function() {
      content.classList.remove('resizing');
      startY = undefined;
    });
  });
}

function formatUSD(v) { return '$' + v.toFixed(2); }
function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }

/* ========== COUNT-UP ANIMATION ========== */
function animateCountUp(el, to, formatFn, duration) {
  if (!el) return;
  if (document.body.classList.contains('no-animations')) { el.textContent = formatFn ? formatFn(to) : to; return; }
  var raw = String(el.textContent).replace(/[^0-9.,-]/g, '');
  var from = parseFloat(raw.replace(',', '.')) || 0;
  if (from === to) { el.textContent = formatFn ? formatFn(to) : to; return; }
  var start = performance.now();
  var dur = duration || 450;
  function frame(now) {
    var t = Math.min((now - start) / dur, 1);
    var eased = 1 - Math.pow(1 - t, 3);
    var val = from + (to - from) * eased;
    el.textContent = formatFn ? formatFn(val) : String(Math.round(val));
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = formatFn ? formatFn(to) : String(to);
  }
  requestAnimationFrame(frame);
}

function runCountUps(root) {
  if (!root) return;
  var els = root.querySelectorAll('[data-count]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var target = parseFloat(el.dataset.count) || 0;
    var fmt = el.dataset.fmt;
    var fmtFn = fmt === 'usd' ? formatUSD : fmt === 'bs' ? formatBS : fmt === 'int' ? function(v) { return Math.round(v); } : null;
    animateCountUp(el, target, fmtFn, 500);
  }
}

/* ========== PAYMENT SUCCESS CHECKMARK ========== */
function showPaymentSuccess(venta) {
  if (document.body.classList.contains('no-animations')) return;
  var overlay = document.createElement('div');
  overlay.className = 'payment-success-overlay';
  overlay.innerHTML =
    '<div class="payment-success-card">' +
      '<svg class="payment-success-check" viewBox="0 0 52 52">' +
        '<circle cx="26" cy="26" r="24" fill="none"/>' +
        '<path fill="none" d="M14 27l8 8 16-16"/>' +
      '</svg>' +
      '<div class="payment-success-text">Venta #' + venta.id + ' registrada</div>' +
      '<div class="payment-success-sub">' + formatUSD(venta.total_usd) + '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  setTimeout(function() {
    overlay.classList.add('fade-out');
    setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 400);
  }, 1200);
}
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

/* ========== BS/USD BIDIRECTIONAL CONVERSION ========== */
var _convLock = false;
function initBsUsdConversion(bsSelector, usdSelector) {
  var bsInput = qs(bsSelector);
  var usdInput = qs(usdSelector);
  if (!bsInput || !usdInput) return;
  bsInput.addEventListener('input', function () {
    if (_convLock) return;
    _convLock = true;
    var bs = parseInput(this.value);
    if (bs > 0 && tasaActual > 0) {
      usdInput.value = (bs / tasaActual).toFixed(2);
    } else if (!this.value || parseFloat(this.value) === 0) {
      usdInput.value = '';
    }
    _convLock = false;
  });
  usdInput.addEventListener('input', function () {
    if (_convLock) return;
    _convLock = true;
    var usd = parseInput(this.value);
    if (usd > 0 && tasaActual > 0) {
      bsInput.value = (usd * tasaActual).toFixed(2);
    } else if (!this.value || parseFloat(this.value) === 0) {
      bsInput.value = '';
    }
    _convLock = false;
  });
}

/* ========== TABLE SCROLL INDICATOR ========== */
function initTableScrollIndicators() {
  function checkScroll(container) {
    if (container.scrollHeight > container.clientHeight) {
      container.classList.add('scrollable');
    } else {
      container.classList.remove('scrollable');
    }
  }
  var containers = qsa('.table-container');
  for (var i = 0; i < containers.length; i++) {
    checkScroll(containers[i]);
  }
  var ro = new ResizeObserver(function(entries) {
    for (var j = 0; j < entries.length; j++) {
      checkScroll(entries[j].target);
    }
  });
  for (var k = 0; k < containers.length; k++) {
    ro.observe(containers[k]);
  }
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
    creditos: 'creditos-table',
    reports: 'report-sales-table',
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

    // Extract display name from JSON (product name or client name)
    var displayName = remoteData.nombre || remoteData.nombre || c.item_id;
    var tablaLabel = c.tabla === 'productos' ? 'Producto' : 'Cliente';

    // Build diff table only for non-timestamp fields
    var fields = [];
    var tsFields = ['local_updated_at', 'remote_updated_at', 'updated_at'];
    for (var key of Object.keys(remoteData)) {
      if (tsFields.includes(key)) continue;
      var lv = JSON.stringify(localData[key]);
      var rv = JSON.stringify(remoteData[key]);
      if (lv !== rv) {
        fields.push('<tr><td style="padding:2px 8px;font-weight:600">' + escapeHtml(key) + '</td><td style="padding:2px 8px;color:var(--text)">' + escapeHtml(lv) + '</td><td style="padding:2px 8px;color:var(--accent)">' + escapeHtml(rv) + '</td></tr>');
      }
    }

    // Show local/remote timestamps if present in JSON
    var localTs = localData.local_updated_at || '';
    var remoteTs = remoteData.remote_updated_at || '';
    var tsInfo = '';
    if (localTs && remoteTs) {
      tsInfo = '<div class="text-muted text-sm" style="margin-bottom:6px">Local: ' + escapeHtml(localTs) + ' &middot; Remoto: ' + escapeHtml(remoteTs) + '</div>';
    } else {
      tsInfo = '<div class="text-muted text-sm" style="margin-bottom:6px">Detectado: ' + escapeHtml(c.created_at) + '</div>';
    }

    var diffHtml;
    if (fields.length > 0) {
      diffHtml = '<table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:8px"><thead><tr style="border-bottom:1px solid var(--border)"><th style="padding:4px 8px;text-align:left">Campo</th><th style="padding:4px 8px;text-align:left">Local</th><th style="padding:4px 8px;text-align:left">Remoto</th></tr></thead><tbody>' + fields.join('') + '</tbody></table>';
    } else {
      diffHtml = '<p class="text-muted text-sm" style="margin:6px 0 8px">Los datos coinciden. El conflicto es solo de tiempo (ambos modificados cerca del mismo momento).</p>';
    }

    card.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:4px"><strong>' + escapeHtml(tablaLabel) + ': ' + escapeHtml(displayName) + '</strong></div>' +
      tsInfo +
      diffHtml +
      '<div style="display:flex;gap:8px;margin-top:6px"><button class="btn btn-outline btn-sm conflict-keep-local" data-id="' + c.id + '"><i class="nf nf-fa-check"></i> Mantener local</button><button class="btn btn-accent btn-sm conflict-use-remote" data-id="' + c.id + '"><i class="nf nf-fa-cloud_download"></i> Usar remoto</button></div>';
    container.appendChild(card);
  });
  showModal(qs(SEL.conflictModal));
}

/* ========== PAGINATION HELPERS ========== */
function renderPagination(container, currentPage, total, pageSize, label, onPageChange) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) { container.style.display = 'none'; return; }
  container.style.display = 'flex';
  container.innerHTML =
    '<button class="btn btn-sm btn-outline" data-page="' + (currentPage - 1) + '" ' + (currentPage <= 1 ? 'disabled' : '') + '>Anterior</button>' +
    '<span class="pagination-info">P\u00e1gina ' + currentPage + ' de ' + totalPages + ' (' + total + ' ' + label + ')</span>' +
    '<button class="btn btn-sm btn-outline" data-page="' + (currentPage + 1) + '" ' + (currentPage >= totalPages ? 'disabled' : '') + '>Siguiente</button>';
  container.querySelectorAll('[data-page]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (this.disabled) return;
      onPageChange(parseInt(this.dataset.page));
    });
  });
}

