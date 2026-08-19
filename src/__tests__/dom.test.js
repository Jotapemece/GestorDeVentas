import { describe, it, expect, beforeEach, vi } from 'vitest';

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
function formatUSD(v) { return '$' + v.toFixed(2); }
function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }
function redondeado2(v) { const n = parseFloat(String(v).replace(',', '.')) || 0; return (Math.round(n * 100) / 100); }
function contrastTextColor(hex) { var h = (hex || '#CCCCCC').replace('#', '').trim(); if (h.length !== 6) return '#111'; var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b > 150) ? '#111111' : '#FFFFFF'; }

describe('createProductRow (DOM)', () => {
  let tasaActual = 40;

  function createProductRow(p) {
    const name = escapeHtml(p.nombre);
    const inariBadge = p.es_inari ? ' <span class="badge badge-inari">Inari</span>' : '';
    return '<td title="' + name + '">' + name + inariBadge + '</td><td>' + formatUSD(p.precio_usd) + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasaActual) + '</span></td><td>' + p.stock + '</td><td><button class="btn btn-primary btn-sm" data-action="add-to-cart" data-codigo="' + escapeHtml(p.codigo) + '">+</button></td>';
  }

  it('genera fila con datos del producto', () => {
    const p = { codigo: 'P001', nombre: 'Producto 1', precio_usd: 10.5, stock: 5 };
    const html = createProductRow(p);
    expect(html).toContain('Producto 1');
    expect(html).toContain('$10.50');
    expect(html).toContain('Bs. 420,00');
    expect(html).toContain('>5<');
    expect(html).toContain('data-codigo="P001"');
  });

  it('incluye badge Inari si es inari', () => {
    const p = { codigo: 'I001', nombre: 'Inari Roll', precio_usd: 8, stock: 10, es_inari: true };
    const html = createProductRow(p);
    expect(html).toContain('badge-inari');
  });

  it('no incluye badge Inari si no es inari', () => {
    const p = { codigo: 'N001', nombre: 'Normal', precio_usd: 5, stock: 3, es_inari: false };
    const html = createProductRow(p);
    expect(html).not.toContain('badge-inari');
  });

  it('escapa nombre del producto', () => {
    const p = { codigo: 'X', nombre: '<script>alert("xss")</script>', precio_usd: 1, stock: 1 };
    const html = createProductRow(p);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('createCartRow (DOM)', () => {
  let tasaActual = 40;
  let cartShowBs = false;

  function createCartRow(item) {
    const showBs = cartShowBs;
    if (item.es_efectivo) {
      const name = escapeHtml(item.nombre || 'Efectivo');
      const code = escapeHtml(item.codigo);
      const entregar = item.monto_entregar_bs || item.cantidad;
      const cobrar = item.monto_cobrar_bs || (item.cantidad * item.precio_usd * tasaActual);
      const totalUsd = item.cantidad * item.precio_usd;
      const totalText = showBs ? formatBS(totalUsd * tasaActual) : formatUSD(totalUsd);
      const cls = 'cart-item-total' + (showBs ? ' bs-mode' : '');
      const editBtn = '<button class="cart-edit-price-btn" data-action="edit-efectivo" data-codigo="' + code + '" title="Ver disponibilidad y montos"><i class="nf nf-fa-pencil"></i></button>';
      return '<td><div class="cart-product-info"><span class="cart-product-name" title="' + name + '">' + name + '</span><span class="cart-product-code">' + code + '</span></div></td>' +
        '<td><div class="cart-qty-wrap cart-efectivo-inline">' +
          '<label class="cart-efectivo-field">Entregar<input type="text" inputmode="decimal" class="cart-qty-input cart-efectivo-input" data-action="efectivo-entregar" data-codigo="' + code + '" value="' + redondeado2(entregar) + '"></label>' +
          '<label class="cart-efectivo-field">Cobrar<input type="text" inputmode="decimal" class="cart-qty-input cart-efectivo-input" data-action="efectivo-cobrar" data-codigo="' + code + '" value="' + redondeado2(cobrar) + '"></label>' +
        '</div></td>' +
        '<td class="' + cls + '"><span class="cart-total-text">' + totalText + '</span>' + editBtn + '</td>' +
        '<td><button class="cart-remove-btn" data-action="remove-from-cart" data-codigo="' + code + '" title="Eliminar"><i class="nf nf-fa-trash"></i></button></td>';
    }
    const displayName = item.nombre || item.codigo;
    const name = escapeHtml(displayName);
    const code = escapeHtml(item.codigo);
    const totalUsd = item.cantidad * item.precio_usd;
    const totalBs = totalUsd * tasaActual;
    const totalText = showBs ? formatBS(totalBs) : formatUSD(totalUsd);
    const cls = 'cart-item-total' + (showBs ? ' bs-mode' : '');
    return '<td><div class="cart-product-info"><span class="cart-product-name" title="' + name + '">' + name + '</span><span class="cart-product-code">' + code + '</span></div></td><td><div class="cart-qty-wrap"><button class="cart-qty-btn" data-action="qty-dec" data-codigo="' + code + '">&minus;</button><input type="number" class="cart-qty-input" value="' + item.cantidad + '" min="1" max="' + item.stock + '" data-codigo="' + code + '"><button class="cart-qty-btn" data-action="qty-inc" data-codigo="' + code + '">+</button></div></td><td class="' + cls + '">' + totalText + '</td><td><button class="cart-remove-btn" data-action="remove-from-cart" data-codigo="' + code + '" title="Eliminar"><i class="nf nf-fa-trash"></i></button></td>';
  }

  it('muestra total en USD por defecto', () => {
    cartShowBs = false;
    const item = { codigo: 'P001', nombre: 'Prod', precio_usd: 10, cantidad: 2, stock: 5 };
    const html = createCartRow(item);
    expect(html).toContain('$20.00');
    expect(html).not.toContain('bs-mode');
  });

  it('muestra total en BS si cartShowBs es true', () => {
    cartShowBs = true;
    const item = { codigo: 'P001', nombre: 'Prod', precio_usd: 10, cantidad: 2, stock: 5 };
    const html = createCartRow(item);
    expect(html).toContain('Bs. 800,00');
    expect(html).toContain('bs-mode');
  });

  it('usa codigo como displayName si no hay nombre', () => {
    cartShowBs = false;
    const item = { codigo: 'P001', precio_usd: 5, cantidad: 1, stock: 3 };
    const html = createCartRow(item);
    expect(html).toContain('P001');
  });

  it('botones qty tienen data-codigo', () => {
    cartShowBs = false;
    const item = { codigo: 'A1', nombre: 'Test', precio_usd: 1, cantidad: 3, stock: 10 };
    const html = createCartRow(item);
    expect(html).toContain('data-action="qty-dec"');
    expect(html).toContain('data-action="qty-inc"');
    expect(html).toContain('data-action="remove-from-cart"');
  });

  it('input tiene min=1 y max=stock', () => {
    cartShowBs = false;
    const item = { codigo: 'B2', nombre: 'Item', precio_usd: 2, cantidad: 1, stock: 7 };
    const html = createCartRow(item);
    expect(html).toContain('max="7"');
    expect(html).toContain('min="1"');
  });

  it('línea Efectivo muestra entregar/cobrar editables en Bs. y botón editar', () => {
    cartShowBs = false;
    const item = { codigo: 'EFECTIVO', nombre: 'Efectivo', es_efectivo: true, cantidad: 600, precio_usd: 610 / 40 / 600, monto_entregar_bs: 600, monto_cobrar_bs: 610 };
    const html = createCartRow(item);
    expect(html).toContain('data-action="efectivo-entregar"');
    expect(html).toContain('data-action="efectivo-cobrar"');
    expect(html).toContain('value="600"');
    expect(html).toContain('value="610"');
    expect(html).toContain('data-action="edit-efectivo"');
    expect(html).toContain('data-action="remove-from-cart"');
    expect(html).not.toContain('qty-inc');
  });

  it('línea Efectivo muestra total según cobrar (USD y Bs.)', () => {
    cartShowBs = false;
    const item = { codigo: 'EFECTIVO', es_efectivo: true, cantidad: 600, precio_usd: 610 / 40 / 600, monto_entregar_bs: 600, monto_cobrar_bs: 610 };
    const htmlUsd = createCartRow(item);
    expect(htmlUsd).toContain('$15.25');
    cartShowBs = true;
    const htmlBs = createCartRow(item);
    expect(htmlBs).toContain('Bs. 610,00');
    expect(htmlBs).toContain('bs-mode');
  });
});

describe('createInventoryRow (DOM)', () => {
  let tasaActual = 40;
  let tasaInventario = 0;
  let currentUser = { rol: 'admin' };
  const ROL_ADMIN = 'admin';

  function createInventoryRow(p, editBtn) {
    var stockClass = (p.stock < p.stock_minimo) ? ' class="low-stock"' : '';
    var stockBadge = (p.stock < p.stock_minimo) ? '<span class="badge badge-danger" title="Debajo del stock mínimo">!</span>' : '';
    var costo = p.costo || 0;
    var margen = (costo > 0 && p.precio_usd > 0) ? ((p.precio_usd - costo) / p.precio_usd * 100).toFixed(1) + '%' : '—';
    var tasa = tasaInventario > 0 ? tasaInventario : tasaActual;
    var inariBadge = p.es_inari ? ' <span class="badge badge-inari">Inari</span>' : '';
    var catColor = p.categoria_color || '#CCCCCC';
    var catChip = p.categoria
      ? ' <span class="cat-chip" style="background:' + escapeHtml(catColor) + ';color:' + contrastTextColor(catColor) + '">' + escapeHtml(p.categoria) + '</span>'
      : '';
    var inariToggleBtn = (currentUser && currentUser.rol === ROL_ADMIN)
      ? (p.es_inari
          ? '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="false"><i class="nf nf-fa-fire"></i> Quitar Inari</button>'
          : '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="true"><i class="nf nf-fa-fire"></i> Marcar Inari</button>')
      : '';
    return '<td>' + escapeHtml(p.nombre) + catChip + inariBadge + '</td><td>' + formatUSD(p.precio_usd) + '</td><td>' + formatUSD(costo) + '</td><td>' + margen + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasa) + '</span></td><td' + stockClass + '>' + p.stock + ' ' + stockBadge + '</td><td>' + p.stock_minimo + '</td><td><div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones"><i class="nf nf-fa-ellipsis_v"></i></button><div class="dropdown-menu"><button data-action="show-product-detail" data-codigo="' + escapeHtml(p.codigo) + '"><i class="nf nf-fa-info_circle"></i> Detalles</button><button data-action="show-product-history" data-codigo="' + escapeHtml(p.codigo) + '" data-nombre="' + escapeHtml(p.nombre) + '"><i class="nf nf-fa-history"></i> Historial</button>' + editBtn + inariToggleBtn + '</div></div></td>';
  }

  it('renderiza datos básicos del producto', () => {
    const p = { codigo: 'P001', nombre: 'Producto', precio_usd: 10, costo: 4, stock: 20, stock_minimo: 5 };
    const html = createInventoryRow(p, '<button>Editar</button>');
    expect(html).toContain('Producto');
    expect(html).toContain('$10.00');
    expect(html).toContain('60.0%');
    expect(html).toContain('>20 <');
    expect(html).toContain('>5<');
  });

  it('marca low-stock si stock < stock_minimo', () => {
    const p = { codigo: 'P002', nombre: 'Bajo', precio_usd: 5, costo: 2, stock: 3, stock_minimo: 10 };
    const html = createInventoryRow(p, '');
    expect(html).toContain('low-stock');
    expect(html).toContain('badge-danger');
  });

  it('no marca low-stock si stock >= stock_minimo', () => {
    const p = { codigo: 'P003', nombre: 'Normal', precio_usd: 5, costo: 2, stock: 15, stock_minimo: 10 };
    const html = createInventoryRow(p, '');
    expect(html).not.toContain('low-stock');
    expect(html).not.toContain('badge-danger');
  });

  it('incluye toggle-inari para admin', () => {
    const p = { codigo: 'I001', nombre: 'Inari', precio_usd: 8, costo: 3, stock: 10, stock_minimo: 2, es_inari: true };
    const html = createInventoryRow(p, '');
    expect(html).toContain('toggle-inari');
    expect(html).toContain('Quitar Inari');
  });

it('botón Marcar Inari para no-inari', () => {
    const p = { codigo: 'N001', nombre: 'Normal', precio_usd: 8, costo: 3, stock: 10, stock_minimo: 2, es_inari: false };
    const html = createInventoryRow(p, '');
    expect(html).toContain('toggle-inari');
    expect(html).toContain('Marcar Inari');
  });

  it('incluye chip de categoría con color', () => {
    const p = { codigo: 'C001', nombre: 'Galleta', precio_usd: 8, costo: 3, stock: 10, stock_minimo: 2, categoria: 'Snacks', categoria_color: '#3B82F6' };
    const html = createInventoryRow(p, '');
    expect(html).toContain('cat-chip');
    expect(html).toContain('Snacks');
    expect(html).toContain('#3B82F6');
  });

  it('sin categoría no genera chip', () => {
    const p = { codigo: 'C002', nombre: 'Galleta', precio_usd: 8, costo: 3, stock: 10, stock_minimo: 2 };
    const html = createInventoryRow(p, '');
    expect(html).not.toContain('cat-chip');
  });
});

describe('createClientRow (DOM)', () => {
  let currentUser = { rol: 'admin' };
  const ROL_ADMIN = 'admin';

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
  function formatUSD(v) { return '$' + v.toFixed(2); }

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
      var toggleLabel = c.credito_activo ? 'Desactivar cr\u00e9dito' : 'Activar cr\u00e9dito';
      var deleteBtn = '<button data-action="delete-cliente" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '" data-deuda="' + c.saldo_deuda_usd + '"><i class="nf nf-fa-trash"></i> Eliminar</button>';
      dropdownItems += '<div class="dropdown-divider"></div>' +
        '<button data-action="toggle-cliente-credito" data-id="' + c.id + '" data-activo="' + c.credito_activo + '"><i class="nf ' + toggleIcon + '"></i> ' + toggleLabel + '</button>' +
        '<button data-action="edit-cliente" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '"><i class="nf nf-fa-pencil"></i> Editar</button>' +
        '<button data-action="open-quick-debt" data-id="' + c.id + '" data-nombre="' + escapeHtml(c.nombre) + '"><i class="nf nf-fa-bolt"></i> Deuda r\u00e1pida</button>' +
        deleteBtn;
    }
    var dropdown = '<div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones"><i class="nf nf-fa-ellipsis_v"></i></button><div class="dropdown-menu">' + dropdownItems + '</div></div>';
    return '<td>' + escapeHtml(c.nombre) + '</td><td>' + activoBadge + '</td><td>' + formatUSD(c.saldo_deuda_usd) + '</td><td>' + ultimaCompra + '</td><td>' + dropdown + '</td>';
  }

  it('renderiza cliente con crédito activo', () => {
    const c = { id: 1, nombre: 'Juan', credito_activo: true, saldo_deuda_usd: 100, ultima_compra: '2025-06-15 10:00' };
    const html = createClientRow(c);
    expect(html).toContain('Juan');
    expect(html).toContain('$100.00');
    expect(html).toContain('Activo');
    expect(html).toContain('2025-06-15');
  });

  it('muestra badge Inactivo si credito_activo es false', () => {
    const c = { id: 2, nombre: 'Maria', credito_activo: false, saldo_deuda_usd: 0, ultima_compra: '' };
    const html = createClientRow(c);
    expect(html).toContain('Inactivo');
    expect(html).toContain('text-muted');
  });

  it('admin ve botones extra', () => {
    const c = { id: 3, nombre: 'AdminView', credito_activo: true, saldo_deuda_usd: 50, ultima_compra: '2025-01-01' };
    const html = createClientRow(c);
    expect(html).toContain('toggle-cliente-credito');
    expect(html).toContain('edit-cliente');
    expect(html).toContain('open-quick-debt');
    expect(html).toContain('delete-cliente');
  });

  it('no-admin no ve botones extra', () => {
    currentUser = { rol: 'vendedor' };
    const c = { id: 4, nombre: 'Vendedor', credito_activo: false, saldo_deuda_usd: 0, ultima_compra: '' };
    const html = createClientRow(c);
    expect(html).not.toContain('toggle-cliente-credito');
    expect(html).not.toContain('delete-cliente');
    currentUser = { rol: 'admin' };
  });

  it('escapa nombre', () => {
    const c = { id: 5, nombre: '<b>XSS</b>', credito_activo: false, saldo_deuda_usd: 0, ultima_compra: '' };
    const html = createClientRow(c);
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('createReportRow', () => {
  function formatUSD(v) { return '$' + v.toFixed(2); }
  function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }
  const METODO_LABELS = { efectivo_bs: 'Efectivo Bs.', efectivo_usd: 'Efectivo USD', biopago: 'Biopago', punto: 'Punto', pago_movil: 'Pago M\u00f3vil', credito: 'Cr\u00e9dito', mixto: 'Mixto' };
  function formatMetodoLabel(m) { return METODO_LABELS[m] || m; }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso.replace(' ', 'T'));
    if (isNaN(d.getTime())) return iso;
    const p = function(n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
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
    const detailBtn = '<button class="sale-detail-btn" data-id="' + vv.id + '" data-total="' + vv.total_usd + '" data-metodo="' + escapeHtml(metodoLabel) + '" data-usuario="' + escapeHtml(vv.username) + '" data-fecha="' + escapeHtml(vv.fecha_hora) + '" data-tasa="' + (vv.tasa_aplicada || '') + '" data-nota="' + notaEsc + '" data-obs="' + obs + '" data-pago-detalle="' + escapeHtml(vv.pago_detalle || '') + '" title="Ver detalles"><i class="nf nf-fa-receipt"></i> Ver detalle</button>';
    const menu = '<div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones"><i class="nf nf-fa-ellipsis_v"></i></button><div class="dropdown-menu">' + detailBtn + '</div></div>';
    return '<td data-label="#">' + vv.id + '</td><td data-label="Fecha">' + escapeHtml(formatDateTime(vv.fecha_hora)) + '</td><td data-label="Usuario">' + escapeHtml(vv.username) + '</td><td data-label="Método">' + escapeHtml(metodoLabel) + '</td><td data-label="Prod.">' + prodCount + '</td><td data-label="Total ($)">' + formatUSD(vv.total_usd) + '</td><td data-label="Costo ($)">' + formatUSD(costoTotal) + '</td><td data-label="Ganancia ($)">' + formatUSD(Math.max(0, ganancia)) + '</td><td data-label="Total (Bs.)">' + formatBS(vv.total_bs) + badge + '</td><td data-label="Acción">' + menu + '</td>';
  }

  it('renderiza venta normal', () => {
    const data = {
      venta: { id: 1, fecha_hora: '2025-06-01 12:00', username: 'admin', metodo_pago: 'efectivo_bs', total_usd: 100, total_bs: 4000, anulada: false },
      productos: [{ cantidad: 2, costo: 10 }, { cantidad: 1, costo: 20 }]
    };
    const html = createReportRow(data);
    expect(html).toContain('>1<');
    expect(html).toContain('$100.00');
    expect(html).toContain('$40.00');
    expect(html).toContain('$60.00');
    expect(html).toContain('Bs. 4000,00');
    expect(html).not.toContain('Anulada');
  });

  it('marca anulada si corresponde', () => {
    const data = {
      venta: { id: 2, fecha_hora: '2025-06-01', username: 'admin', metodo_pago: 'punto', total_usd: 50, total_bs: 2000, anulada: true },
      productos: []
    };
    const html = createReportRow(data);
    expect(html).toContain('Anulada');
  });

  it('calcula ganancia 0 si es negativa', () => {
    const data = {
      venta: { id: 3, fecha_hora: '2025-06-01', username: 'admin', metodo_pago: 'credito', total_usd: 10, total_bs: 400, anulada: false },
      productos: [{ cantidad: 1, costo: 15 }]
    };
    const html = createReportRow(data);
    expect(html).toContain('$0.00');
  });

  it('cuenta productos correctamente', () => {
    const data = {
      venta: { id: 4, fecha_hora: '2025-06-01', username: 'admin', metodo_pago: 'mixto', total_usd: 30, total_bs: 1200, anulada: false },
      productos: [{ cantidad: 3, costo: 2 }, { cantidad: 5, costo: 1 }]
    };
    const html = createReportRow(data);
    expect(html).toContain('>8<');
  });
});

describe('createDebtSaleCard', () => {
  function formatUSD(v) { return '$' + v.toFixed(2); }

  function createDebtSaleCard(v, prodHtml) {
    return '<div class="debt-sale-header"><span># Venta ' + v.id + '</span><span>' + v.fecha_hora + '</span></div><div class="debt-sale-total">Total: ' + formatUSD(v.total_usd) + '</div>' + prodHtml;
  }

  it('genera HTML con datos de venta', () => {
    const v = { id: 42, fecha_hora: '2025-06-10 15:30', total_usd: 75.5 };
    const html = createDebtSaleCard(v, '<div>productos</div>');
    expect(html).toContain('# Venta 42');
    expect(html).toContain('2025-06-10 15:30');
    expect(html).toContain('$75.50');
    expect(html).toContain('productos');
  });
});

describe('createDailySaleRow', () => {
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
  function formatUSD(v) { return '$' + v.toFixed(2); }
  function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }
  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso.replace(' ', 'T'));
    if (isNaN(d.getTime())) return iso;
    const p = function(n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function createDailySaleRow(v, metodoLabel) {
    const nota = v.nota_anulacion ? escapeHtml(v.nota_anulacion) : '';
    const anuladaBadge = v.anulada
      ? (nota
          ? '<span class="badge badge-danger" title="' + nota + '"><i class="nf nf-fa-ban"></i> Anulada</span>'
          : '<span class="badge badge-danger"><i class="nf nf-fa-ban"></i> Anulada</span>')
      : '';
    const detailAttrs = 'data-id="' + v.id + '" data-total="' + v.total_usd + '" data-metodo="' + escapeHtml(metodoLabel) + '" data-usuario="' + escapeHtml(v.username) + '" data-fecha="' + escapeHtml(v.fecha_hora) + '" data-tasa="' + (v.tasa_aplicada || '') + '" data-nota="' + nota + '" data-obs="' + (v.nota ? escapeHtml(v.nota) : '') + '" data-pago-detalle="' + escapeHtml(v.pago_detalle || '') + '"';
    const detailItem = '<button class="sale-detail-btn" ' + detailAttrs + '><i class="nf nf-fa-receipt"></i> Ver detalle</button>';
    const canVoid = currentUser && currentUser.rol === ROL_ADMIN;
    const voidItem = (v.anulada || !canVoid)
      ? ''
      : '<button class="void-sale-btn" data-id="' + v.id + '" title="Anular venta"><i class="nf nf-fa-ban"></i> Anular</button>';
    const requestVoidItem = (!v.anulada && !canVoid)
      ? '<button class="request-void-btn" data-id="' + v.id + '" title="Solicitar anulación al administrador"><i class="nf nf-fa-paper_plane"></i> Solicitar anulación</button>'
      : '';
    const menu = '<div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones"><i class="nf nf-fa-ellipsis_v"></i></button><div class="dropdown-menu">' + detailItem + voidItem + requestVoidItem + '</div></div>';
    return '<td data-label="#">' + v.id + '</td><td data-label="Hora">' + escapeHtml(formatDateTime(v.fecha_hora)) + '</td><td data-label="Usuario">' + escapeHtml(v.username) + '</td><td data-label="Método">' + escapeHtml(metodoLabel) + '</td><td data-label="Total ($)">' + formatUSD(v.total_usd) + '</td><td data-label="Total (Bs.)">' + formatBS(v.total_bs) + '</td><td data-label="Acción">' + (v.anulada ? anuladaBadge : menu) + '</td>';
  }
  let currentUser = { rol: ROL_ADMIN, username: 'admin' };

  it('renderiza venta diaria no anulada', () => {
    const v = { id: 10, fecha_hora: '2025-06-15 14:30:00', username: 'admin', total_usd: 25, total_bs: 1000, anulada: false };
    const html = createDailySaleRow(v, 'Efectivo Bs.');
    expect(html).toContain('>10<');
    expect(html).toContain('14:30');
    expect(html).toContain('admin');
    expect(html).toContain('Efectivo Bs.');
    expect(html).toContain('$25.00');
    expect(html).toContain('void-sale-btn');
  });

  it('anulada muestra badge en vez de menú', () => {
    const v = { id: 11, fecha_hora: '2025-06-15 15:00', username: 'admin', total_usd: 30, total_bs: 1200, anulada: true };
    const html = createDailySaleRow(v, 'Punto');
    expect(html).toContain('Anulada');
    expect(html).toContain('badge-danger');
    expect(html).not.toContain('void-sale-btn');
    expect(html).not.toContain('dropdown-menu');
  });

  it('vendedor no ve botón de anular (void admin-only) y sí solicitar anulación', () => {
    currentUser = { rol: 'vendedor', username: 'vendedor1' };
    const v = { id: 12, fecha_hora: '2025-06-15 15:30:00', username: 'vendedor1', total_usd: 12, total_bs: 480, anulada: false };
    const html = createDailySaleRow(v, 'Efectivo Bs.');
    expect(html).not.toContain('void-sale-btn');
    expect(html).toContain('request-void-btn');
    currentUser = { rol: ROL_ADMIN, username: 'admin' };
  });
});

describe('setupMonedaToggle (toggle excluyente USD/Bs.)', () => {
  let tasaActual = 40;

  function parseInput(v) { return parseFloat(String(v).replace(',', '.')) || 0; }

  function setupMonedaToggle(cfg) {
    const toggle = cfg.toggle;
    const usdInput = cfg.usdInput;
    const bsInput = cfg.bsInput;
    const bsGroup = cfg.bsGroup;
    const onUsdChange = cfg.onUsdChange || function() {};
    const onBsChange = cfg.onBsChange || function() {};
    let activeMoneda = 'usd';

    function setActive(moneda) {
      activeMoneda = moneda;
      toggle.querySelectorAll('.moneda-toggle-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.moneda === moneda);
      });
      const isBs = moneda === 'bs';
      if (bsGroup) bsGroup.classList.toggle('hidden', !isBs);
    }

    function switchTo(moneda) {
      if (moneda === activeMoneda) return;
      const fromBs = activeMoneda === 'bs';
      const curVal = fromBs ? parseInput(bsInput.value) : parseInput(usdInput.value);
      setActive(moneda);
      if (curVal > 0 && tasaActual > 0) {
        if (moneda === 'bs') {
          bsInput.value = (curVal * tasaActual).toFixed(2);
          usdInput.value = '';
        } else {
          usdInput.value = (curVal / tasaActual).toFixed(2);
          bsInput.value = '';
        }
      } else {
        usdInput.value = '';
        bsInput.value = '';
      }
      onUsdChange();
      onBsChange();
    }

    toggle.querySelectorAll('.moneda-toggle-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { switchTo(this.dataset.moneda); });
    });
    usdInput.addEventListener('input', function() {
      if (activeMoneda !== 'usd') setActive('usd');
      bsInput.value = '';
      onUsdChange();
    });
    bsInput.addEventListener('input', function() {
      if (activeMoneda !== 'bs') setActive('bs');
      usdInput.value = '';
      onBsChange();
    });
    setActive('usd');
    return { setUsd: function() { switchTo('usd'); }, setBs: function() { switchTo('bs'); }, getMoneda: function() { return activeMoneda; } };
  }

  function makeHarness() {
    const btns = [
      document.createElement('button'),
      document.createElement('button')
    ];
    btns[0].dataset.moneda = 'usd';
    btns[1].dataset.moneda = 'bs';
    const usdInput = document.createElement('input');
    const bsInput = document.createElement('input');
    const bsGroup = document.createElement('div');
    const toggle = document.createElement('div');
    btns.forEach(b => toggle.appendChild(b));
    return { toggle, usdInput, bsInput, bsGroup };
  }

  function bsGroupHidden(g) { return g.classList.contains('hidden'); }

  it('por defecto el grupo Bs. está oculto y moneda activa es USD', () => {
    const tasaActual = 40;
    const h = makeHarness();
    const t = setupMonedaToggle({ toggle: h.toggle, usdInput: h.usdInput, bsInput: h.bsInput, bsGroup: h.bsGroup });
    expect(t.getMoneda()).toBe('usd');
    expect(bsGroupHidden(h.bsGroup)).toBe(true);
  });

  it('escribir en Bs. vacía el campo USD y marca el toggle Bs.', () => {
    const tasaActual = 40;
    const h = makeHarness();
    setupMonedaToggle({ toggle: h.toggle, usdInput: h.usdInput, bsInput: h.bsInput, bsGroup: h.bsGroup });
    h.usdInput.value = '100';
    h.bsInput.value = '4000';
    h.bsInput.dispatchEvent(new Event('input'));
    expect(h.usdInput.value).toBe('');
    expect(bsGroupHidden(h.bsGroup)).toBe(false);
  });

  it('cambiar a Bs. convierte el monto USD actual', () => {
    const tasaActual = 40;
    const h = makeHarness();
    const t = setupMonedaToggle({ toggle: h.toggle, usdInput: h.usdInput, bsInput: h.bsInput, bsGroup: h.bsGroup });
    h.usdInput.value = '100';
    t.setBs();
    expect(h.bsInput.value).toBe('4000.00');
    expect(h.usdInput.value).toBe('');
  });

  it('cambiar a USD convierte el monto Bs. actual', () => {
    const tasaActual = 40;
    const h = makeHarness();
    const t = setupMonedaToggle({ toggle: h.toggle, usdInput: h.usdInput, bsInput: h.bsInput, bsGroup: h.bsGroup });
    t.setBs();
    h.bsInput.value = '4000';
    t.setUsd();
    expect(h.usdInput.value).toBe('100.00');
    expect(h.bsInput.value).toBe('');
  });
});

describe('buildCustomSelect (DOM)', () => {
  function qsa(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }
  function buildCustomSelect(opts) {
    opts = opts || {};
    var options = opts.options || [];
    var wrap = document.createElement('div');
    wrap.className = 'custom-select' + (opts.className ? ' ' + opts.className : '');
    wrap.innerHTML = '<button type="button" class="custom-select-btn"><span class="custom-select-value"></span><i class="nf nf-fa-chevron_down"></i></button><div class="custom-select-menu"></div>';
    var btn = wrap.querySelector('.custom-select-btn');
    var valSpan = wrap.querySelector('.custom-select-value');
    var menu = wrap.querySelector('.custom-select-menu');
    function buildMenu() {
      menu.innerHTML = '';
      options.forEach(function(o) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.value = o.value;
        if (o.color) {
          var sw = document.createElement('span');
          sw.className = 'cs-swatch';
          sw.style.background = o.color;
          b.appendChild(sw);
          b.className = 'has-swatch';
        }
        b.appendChild(document.createTextNode(o.label));
        if (o.disabled) b.disabled = true;
        b.addEventListener('click', function() {
          if (o.disabled) return;
          wrap.setValue(o.value);
          wrap.classList.remove('open');
          if (opts.onChange) opts.onChange(o.value);
        });
        menu.appendChild(b);
      });
    }
    wrap.setValue = function(value) {
      wrap.dataset.value = value;
      var opt = null;
      for (var i = 0; i < options.length; i++) {
        if (String(options[i].value) === String(value)) { opt = options[i]; break; }
      }
      valSpan.innerHTML = '';
      if (opt && opt.color) {
        var sw = document.createElement('span');
        sw.className = 'cs-swatch';
        sw.style.background = opt.color;
        valSpan.appendChild(sw);
      }
      valSpan.appendChild(document.createTextNode(opt ? opt.label : ''));
      menu.querySelectorAll('button').forEach(function(b) {
        b.classList.toggle('selected', String(b.dataset.value) === String(value));
      });
    };
    wrap.getValue = function() { return wrap.dataset.value; };
    btn.addEventListener('click', function() {
      var isOpen = wrap.classList.contains('open');
      wrap.classList.toggle('open', !isOpen);
    });
    buildMenu();
    wrap.setValue(opts.value !== undefined ? opts.value : (options[0] ? options[0].value : ''));
    return wrap;
  }

  it('setValue/getValue y opción con color', () => {
    const w = buildCustomSelect({
      options: [
        { value: '', label: 'Sin categor\u00eda' },
        { value: '1', label: 'Snacks', color: '#3B82F6' }
      ],
      value: ''
    });
    expect(w.getValue()).toBe('');
    w.setValue('1');
    expect(w.getValue()).toBe('1');
    expect(w.querySelector('.custom-select-value').querySelector('.cs-swatch')).toBeTruthy();
  });

  it('marca opción seleccionada', () => {
    const w = buildCustomSelect({
      options: [
        { value: '0', label: 'A' },
        { value: '1', label: 'B' }
      ],
      value: '1'
    });
    const selBtns = w.querySelectorAll('.custom-select-menu button.selected');
    expect(selBtns.length).toBe(1);
    expect(selBtns[0].dataset.value).toBe('1');
  });

  it('opción deshabilitada no cambia el valor', () => {
    const w = buildCustomSelect({
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true }
      ],
      value: 'a'
    });
    const disabledBtn = w.querySelector('.custom-select-menu button[disabled]');
    disabledBtn.click();
    expect(w.getValue()).toBe('a');
  });
});

describe('contrastTextColor', () => {
  function contrastTextColor(hex) {
    var h = (hex || '#CCCCCC').replace('#', '').trim();
    if (h.length !== 6) return '#111';
    var r = parseInt(h.substr(0, 2), 16);
    var g = parseInt(h.substr(2, 2), 16);
    var b = parseInt(h.substr(4, 2), 16);
    var lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum > 150 ? '#111111' : '#FFFFFF';
  }

  it('color claro → texto oscuro', () => {
    expect(contrastTextColor('#FFFFFF')).toBe('#111111');
  });
  it('color oscuro → texto blanco', () => {
    expect(contrastTextColor('#111111')).toBe('#FFFFFF');
  });
  it('inválido → texto oscuro por defecto', () => {
    expect(contrastTextColor('no')).toBe('#111');
  });
});

describe('initTableSorting — sin bucle infinito', () => {
  // Reproduce la lógica de initTableSorting (utils.js) con el fix: el observer
  // se desconecta durante sortRows y las filas ya ordenadas NO se re-mueven.
  // Antes, sortRows re-appendeaba todo → mutación → observer → sortRows → ∞
  // (bug: la app se colgaba al restaurar una columna / recargar con orden guardado).
  function initTableSorting(table, tableId, savedSort) {
    if (table.dataset.sortInit) return;
    table.dataset.sortInit = '1';
    const headers = table.querySelectorAll('th[data-sortable]');
    const sortKey = 'sort-' + tableId;
    let currentSort = savedSort || { col: null, asc: true };

    function sortRows() {
      const tbody = table.querySelector('tbody');
      if (!tbody || !currentSort.col) return;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const th = Array.from(headers).find(h => h.getAttribute('data-sortable') === currentSort.col);
      if (!th) return;
      const isAsc = currentSort.asc;
      rows.sort((a, b) => {
        const aVal = a.getAttribute('data-sort-' + currentSort.col) || a.children[Array.from(th.parentNode.children).indexOf(th)]?.textContent?.trim() || '';
        const bVal = b.getAttribute('data-sort-' + currentSort.col) || b.children[Array.from(th.parentNode.children).indexOf(th)]?.textContent?.trim() || '';
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return isAsc ? aNum - bNum : bNum - aNum;
        return isAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
      });
      const current = Array.from(tbody.children);
      let changed = rows.length !== current.length;
      if (!changed) {
        for (let i = 0; i < rows.length; i++) {
          if (rows[i] !== current[i]) { changed = true; break; }
        }
      }
      if (changed) rows.forEach(r => tbody.appendChild(r));
    }

    const tbody = table.querySelector('tbody');
    if (tbody) {
      const mo = new MutationObserver(function() {
        if (!currentSort.col) return;
        mo.disconnect();
        sortRows();
        mo.observe(tbody, { childList: true });
      });
      mo.observe(tbody, { childList: true });
    }
  }

  it('ordena al repoblar el tbody y no entra en bucle infinito', async () => {
    const table = document.createElement('table');
    table.id = 't';
    table.dataset.sortInit = '';
    table.innerHTML = '<thead><tr><th data-sortable="nombre">Nombre</th></tr></thead><tbody></tbody>';
    initTableSorting(table, 't', { col: 'nombre', asc: true });
    document.body.appendChild(table);

    const tbody = table.querySelector('tbody');
    const order = ['Zeta', 'Alfa', 'Milo'];
    order.forEach(n => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = n;
      tr.appendChild(td);
      tbody.appendChild(tr);
    });

    await new Promise(r => setTimeout(r, 0));
    const vals = Array.from(tbody.querySelectorAll('tr td')).map(td => td.textContent);
    expect(vals).toEqual(['Alfa', 'Milo', 'Zeta']);
  });

  it('filas ya ordenadas no se re-mueven (evita mutación→observer en cadena)', async () => {
    const table = document.createElement('table');
    table.id = 't2';
    table.dataset.sortInit = '';
    table.innerHTML = '<thead><tr><th data-sortable="nombre">Nombre</th></tr></thead><tbody></tbody>';
    initTableSorting(table, 't2', { col: 'nombre', asc: true });
    document.body.appendChild(table);

    const tbody = table.querySelector('tbody');
    ['Alfa', 'Milo', 'Zeta'].forEach(n => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.textContent = n;
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    await new Promise(r => setTimeout(r, 0));
    // Ya está en el orden correcto: repoblar de nuevo no debe colgar la app.
    const first = tbody.children[0];
    tbody.appendChild(first);
    await new Promise(r => setTimeout(r, 0));
    const order = Array.from(tbody.children).map(r => r.textContent);
    expect(order).toEqual(['Alfa', 'Milo', 'Zeta']);
  });
});

describe('buildMixtoDetailHtml (desglose de pago mixto en detalle de venta)', () => {
  const METODO_LABELS = { efectivo_bs: 'Efectivo Bs.', efectivo_usd: 'Efectivo USD', biopago: 'Biopago', punto: 'Punto', pago_movil: 'Pago M\u00f3vil', credito: 'Cr\u00e9dito', mixto: 'Mixto' };
  function formatMetodoLabel(m) { return METODO_LABELS[m] || m; }
  function formatUSD(v) { return '$' + v.toFixed(2); }
  function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }

  function buildMixtoDetailHtml(pagoDetalleJson, tasa) {
    if (!pagoDetalleJson) return '';
    var items = null;
    try { items = JSON.parse(pagoDetalleJson); } catch (e) { return ''; }
    if (!Array.isArray(items) || items.length === 0) return '';
    var tasaOk = isFinite(tasa) && tasa > 0;
    var rows = items.map(function(item) {
      var label = formatMetodoLabel(item.metodo);
      var usd = formatUSD(item.monto_usd || 0);
      var bs = tasaOk ? ' (' + formatBS((item.monto_usd || 0) * tasa) + ')' : '';
      var ref = item.referencia ? ' <span class="text-muted">ref ' + escapeHtml(item.referencia) + '</span>' : '';
      return '<div class="mixto-method"><span class="mixto-method-label">' + escapeHtml(label) + ':</span> ' + usd + bs + ref + '</div>';
    });
    return '<div class="mixto-pago-desglose"><strong>Pago:</strong>' + rows.join('') + '</div>';
  }

  it('desglosa métodos con USD y Bs usando la tasa', () => {
    const json = JSON.stringify([
      { metodo: 'efectivo_bs', monto_usd: 1.4, referencia: null },
      { metodo: 'punto', monto_usd: 25, referencia: null }
    ]);
    const html = buildMixtoDetailHtml(json, 100);
    expect(html).toContain('Efectivo Bs.:');
    expect(html).toContain('$1.40');
    expect(html).toContain('(Bs. 140,00)');
    expect(html).toContain('Punto:');
    expect(html).toContain('$25.00');
    expect(html).toContain('(Bs. 2500,00)');
  });

  it('incluye la referencia del pago móvil', () => {
    const json = JSON.stringify([
      { metodo: 'efectivo_usd', monto_usd: 5, referencia: null },
      { metodo: 'pago_movil', monto_usd: 10, referencia: '1234' }
    ]);
    const html = buildMixtoDetailHtml(json, 40);
    expect(html).toContain('ref 1234');
    expect(html).toContain('$10.00');
  });

  it('sin pago_detalle o JSON inválido devuelve string vacío', () => {
    expect(buildMixtoDetailHtml(null, 40)).toBe('');
    expect(buildMixtoDetailHtml('', 40)).toBe('');
    expect(buildMixtoDetailHtml('{no-json', 40)).toBe('');
    expect(buildMixtoDetailHtml('[]', 40)).toBe('');
  });
});
