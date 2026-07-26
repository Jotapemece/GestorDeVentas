import { describe, it, expect, beforeEach, vi } from 'vitest';

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function formatUSD(v) { return '$' + v.toFixed(2); }
function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }

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
    var inariToggleBtn = (currentUser && currentUser.rol === ROL_ADMIN)
      ? (p.es_inari
          ? '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="false"><i class="nf nf-fa-fire"></i> Quitar Inari</button>'
          : '<button data-action="toggle-inari" data-codigo="' + escapeHtml(p.codigo) + '" data-inari="true"><i class="nf nf-fa-fire"></i> Marcar Inari</button>')
      : '';
    return '<td>' + escapeHtml(p.nombre) + inariBadge + '</td><td>' + formatUSD(p.precio_usd) + '</td><td>' + formatUSD(costo) + '</td><td>' + margen + '</td><td><span class="bs-price-cell" data-usd-price="' + p.precio_usd + '">' + formatBS(p.precio_usd * tasa) + '</span></td><td' + stockClass + '>' + p.stock + ' ' + stockBadge + '</td><td>' + p.stock_minimo + '</td><td><div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones">&ctdot;</button><div class="dropdown-menu"><button data-action="show-product-detail" data-codigo="' + escapeHtml(p.codigo) + '"><i class="nf nf-fa-info_circle"></i> Detalles</button><button data-action="show-product-history" data-codigo="' + escapeHtml(p.codigo) + '" data-nombre="' + escapeHtml(p.nombre) + '"><i class="nf nf-fa-history"></i> Historial</button>' + editBtn + inariToggleBtn + '</div></div></td>';
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
    expect(html).toContain('Marcar Inari');
  });
});

describe('createClientRow (DOM)', () => {
  let currentUser = { rol: 'admin' };
  const ROL_ADMIN = 'admin';

  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
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
    var dropdown = '<div class="dropdown"><button class="dropdown-btn" data-action="toggle-dropdown" title="Acciones">&ctdot;</button><div class="dropdown-menu">' + dropdownItems + '</div></div>';
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
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function formatUSD(v) { return '$' + v.toFixed(2); }
  function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }

  function createDailySaleRow(v, metodoLabel) {
    const isAdmin = 'admin';
    const voidBtn = v.anulada ? '<span class="text-muted">Anulada</span>' : '<button class="btn btn-sm btn-danger void-sale-btn" data-id="' + v.id + '" title="Anular venta"><i class="nf nf-fa-ban"></i></button>';
    const detailBtn = '<button class="btn btn-sm btn-outline sale-detail-btn" data-id="' + v.id + '" data-total="' + v.total_usd + '" data-metodo="' + escapeHtml(metodoLabel) + '" data-usuario="' + escapeHtml(v.username) + '" data-fecha="' + escapeHtml(v.fecha_hora) + '" title="Ver detalles"><i class="nf nf-fa-receipt"></i></button>';
    return '<td>' + v.id + '</td><td>' + escapeHtml(v.fecha_hora.split(' ')[1]) + '</td><td>' + escapeHtml(v.username) + '</td><td>' + escapeHtml(metodoLabel) + '</td><td>' + formatUSD(v.total_usd) + '</td><td>' + formatBS(v.total_bs) + '</td><td>' + detailBtn + ' ' + voidBtn + '</td>';
  }

  it('renderiza venta diaria no anulada', () => {
    const v = { id: 10, fecha_hora: '2025-06-15 14:30:00', username: 'admin', total_usd: 25, total_bs: 1000, anulada: false };
    const html = createDailySaleRow(v, 'Efectivo Bs.');
    expect(html).toContain('>10<');
    expect(html).toContain('14:30:00');
    expect(html).toContain('admin');
    expect(html).toContain('Efectivo Bs.');
    expect(html).toContain('$25.00');
    expect(html).toContain('void-sale-btn');
  });

  it('anulada muestra texto en vez de botón', () => {
    const v = { id: 11, fecha_hora: '2025-06-15 15:00', username: 'admin', total_usd: 30, total_bs: 1200, anulada: true };
    const html = createDailySaleRow(v, 'Punto');
    expect(html).toContain('Anulada');
    expect(html).not.toContain('void-sale-btn');
  });
});
