import { describe, it, expect, beforeEach } from 'vitest';

/* ========== PURE FUNCTIONS (redefined inline for test isolation) ========== */
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;'); }
function formatUSD(v) { return '$' + v.toFixed(2); }
function formatBS(v) { return 'Bs. ' + v.toFixed(2).replace('.', ','); }
function formatDateTime(iso, opts) {
  if (!iso) return '-';
  var hasTz = /T.*(Z|[+-]\d{2}:\d{2})$/.test(iso);
  var d;
  if (hasTz) {
    d = new Date(iso);
  } else {
    d = new Date(iso.replace(' ', 'T'));
  }
  if (isNaN(d.getTime())) return iso;
  var o = opts || {};
  var parts = [];
  parts.push(String(d.getDate()).padStart(2, '0'));
  parts.push(String(d.getMonth() + 1).padStart(2, '0'));
  parts.push(String(d.getFullYear()).padStart(4, '0'));
  var time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (o.withSeconds) time += ':' + String(d.getSeconds()).padStart(2, '0');
  return parts.join('/') + (o.time === false ? '' : ' ' + time);
}
function parseInput(v) { return parseFloat(String(v).replace(',', '.')) || 0; }
function isBsMethod(m) { return m === 'efectivo_bs' || m === 'biopago' || m === 'punto' || m === 'pago_movil'; }
function emptyState(icon, text, sub) {
  return '<div class="empty-state"><span class="empty-icon">' + icon + '</span><div class="empty-text">' + text + '</div>' + (sub ? '<div class="empty-sub">' + sub + '</div>' : '') + '</div>';
}

function totalBsRedondeado(totalUsd) {
  const bs = totalUsd * tasaActual;
  if (redondeoTotal) return Math.round(bs);
  return redondeoBs ? Math.round(bs) : bs;
}

function createAuditRow(log) {
  return '<td>' + log.id + '</td><td>' + escapeHtml(log.fecha_hora) + '</td><td>' + escapeHtml(log.usuario) + '</td><td>' + escapeHtml(log.accion) + '</td>';
}

function createUserRow(u) {
  const isAdmin = u.username === 'admin';
  const pwdBtn = isAdmin ? '' : '<button class="btn btn-sm btn-outline admin-pwd-btn" data-id="' + u.id + '" data-username="' + escapeHtml(u.username) + '" title="Cambiar contrase\u00f1a" style="margin-right:4px"><i class="nf nf-fa-lock"></i></button>';
  return '<td>' + escapeHtml(u.username) + '</td><td>' + escapeHtml(u.rol) + '</td><td>' + pwdBtn + '<button class="btn btn-sm btn-danger delete-user-btn" data-id="' + u.id + '" ' + (isAdmin ? 'disabled title="No se puede eliminar"' : '') + '><i class="nf nf-fa-trash"></i></button></td>';
}

function efectivoPrecioUsd(entregar, cobrar, tasa) {
  if (!(entregar > 0) || !(cobrar > 0) || !(tasa > 0)) return 0;
  return cobrar / tasa / entregar;
}

/* ========== TESTS ========== */

describe('escapeHtml', () => {
  it('escapa & < > "', () => {
    expect(escapeHtml('&<>"')).toBe('&amp;&lt;&gt;&quot;');
  });

  it('escapa comilla simple', () => {
    expect(escapeHtml("'")).toBe('&#39;');
    expect(escapeHtml("onclick='alert(1)'")).toBe('onclick=&#39;alert(1)&#39;');
  });

  it('no modifica texto seguro', () => {
    expect(escapeHtml('hola mundo 123')).toBe('hola mundo 123');
  });

  it('convierte a string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
    expect(escapeHtml(undefined)).toBe('undefined');
  });
});

describe('formatUSD', () => {
  it('formatea con $ y 2 decimales', () => {
    expect(formatUSD(10)).toBe('$10.00');
    expect(formatUSD(10.5)).toBe('$10.50');
    expect(formatUSD(0)).toBe('$0.00');
  });

  it('redondea a 2 decimales', () => {
    expect(formatUSD(10.456)).toBe('$10.46');
    expect(formatUSD(10.454)).toBe('$10.45');
  });
});

describe('formatBS', () => {
  it('formatea con Bs. y coma decimal', () => {
    expect(formatBS(10)).toBe('Bs. 10,00');
    expect(formatBS(10.5)).toBe('Bs. 10,50');
    expect(formatBS(0)).toBe('Bs. 0,00');
  });

  it('redondea y usa coma (no agrega separador de miles)', () => {
    expect(formatBS(1234.56)).toBe('Bs. 1234,56');
  });
});

describe('parseInput', () => {
  it('parsea números', () => {
    expect(parseInput('5')).toBe(5);
    expect(parseInput('3,14')).toBe(3.14);
  });

  it('retorna 0 para vacío/inválido', () => {
    expect(parseInput('')).toBe(0);
    expect(parseInput('x')).toBe(0);
  });
});

describe('totalBsRedondeado', () => {
  beforeEach(() => {
    globalThis.tasaActual = 40;
    globalThis.redondeoBs = false;
    globalThis.redondeoTotal = false;
  });

  it('sin redondeo', () => {
    expect(totalBsRedondeado(10)).toBe(400);
    expect(totalBsRedondeado(10.5)).toBe(420);
  });

  it('redondeo BS', () => {
    globalThis.redondeoBs = true;
    expect(totalBsRedondeado(10.03)).toBe(401);
    expect(totalBsRedondeado(10.03)).not.toBe(401.2);
  });

  it('redondeo total', () => {
    globalThis.redondeoTotal = true;
    expect(totalBsRedondeado(10.03)).toBe(401);
  });

  it('BS con decimales exactos', () => {
    globalThis.tasaActual = 36.5;
    const result = totalBsRedondeado(10.25);
    expect(result).toBe(374.125);
  });
});

describe('isBsMethod', () => {
  it('retorna true para métodos Bs.', () => {
    expect(isBsMethod('efectivo_bs')).toBe(true);
    expect(isBsMethod('biopago')).toBe(true);
    expect(isBsMethod('punto')).toBe(true);
    expect(isBsMethod('pago_movil')).toBe(true);
  });

  it('retorna false para métodos USD/mixto', () => {
    expect(isBsMethod('efectivo_usd')).toBe(false);
    expect(isBsMethod('credito')).toBe(false);
    expect(isBsMethod('mixto')).toBe(false);
    expect(isBsMethod('')).toBe(false);
  });
});

describe('formatDateTime', () => {
  it('formatea ISO UTC sin sufijo +00:00 ni Z', () => {
    const out = formatDateTime('2026-08-12T19:05:00Z');
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(out).not.toContain('+00:00');
    expect(out).not.toContain('Z');
  });
  it('formatea naive local con espacio', () => {
    const out = formatDateTime('2026-08-12 10:30:45');
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });
  it('solo fecha si time:false', () => {
    const out = formatDateTime('2026-08-12 10:30:45', { time: false });
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it('con segundos si withSeconds', () => {
    const out = formatDateTime('2026-08-12 10:30:45', { withSeconds: true });
    expect(out).toMatch(/\d{2}:\d{2}:\d{2}$/);
  });
  it('devuelve "-" si vacio', () => {
    expect(formatDateTime('')).toBe('-');
    expect(formatDateTime(null)).toBe('-');
  });
  it('devuelve el original si no es fecha valida', () => {
    expect(formatDateTime('texto')).toBe('texto');
  });
});

describe('emptyState', () => {
  it('genera HTML con icono y texto', () => {
    const html = emptyState('<i class="nf nf-fa-box"></i>', 'Sin datos', 'Subtítulo');
    expect(html).toContain('empty-state');
    expect(html).toContain('nf-fa-box');
    expect(html).toContain('Sin datos');
    expect(html).toContain('Subtítulo');
  });

  it('omite subtítulo si no se da', () => {
    const html = emptyState('<i class="nf nf-fa-box"></i>', 'Sin datos');
    expect(html).not.toContain('empty-sub');
  });
});

describe('createAuditRow', () => {
  it('genera fila HTML', () => {
    const log = { id: 1, fecha_hora: '2025-01-15 10:30', usuario: 'admin', accion: 'login' };
    const html = createAuditRow(log);
    expect(html).toContain('>1<');
    expect(html).toContain('2025-01-15 10:30');
    expect(html).toContain('admin');
    expect(html).toContain('login');
  });

  it('escapa HTML en campos', () => {
    const log = { id: 2, fecha_hora: '<script>', usuario: '<b>', accion: 'test' };
    const html = createAuditRow(log);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });
});

describe('createUserRow', () => {
  it('admin no tiene botón de contraseña ni puede eliminarse', () => {
    const u = { id: 1, username: 'admin', rol: 'admin' };
    const html = createUserRow(u);
    expect(html).toContain('disabled');
    expect(html).not.toContain('admin-pwd-btn');
  });

  it('usuario normal tiene botón de contraseña', () => {
    const u = { id: 2, username: 'vendedor1', rol: 'vendedor' };
    const html = createUserRow(u);
    expect(html).toContain('admin-pwd-btn');
    expect(html).toContain('vendedor1');
    expect(html).toContain('vendedor');
  });

  it('escapa username', () => {
    const u = { id: 3, username: '<script>x</script>', rol: 'admin' };
    const html = createUserRow(u);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('efectivoPrecioUsd', () => {
  it('precio tal que cantidad*precio = cobrar/tasa', () => {
    expect(efectivoPrecioUsd(600, 610, 10)).toBeCloseTo(610 / 10 / 600, 10);
    expect(efectivoPrecioUsd(500, 500, 40)).toBeCloseTo(500 / 40 / 500, 10);
  });

  it('retorna 0 si algún dato no es válido', () => {
    expect(efectivoPrecioUsd(0, 100, 10)).toBe(0);
    expect(efectivoPrecioUsd(100, 0, 10)).toBe(0);
    expect(efectivoPrecioUsd(100, 100, 0)).toBe(0);
  });
});
