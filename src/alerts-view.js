/* ========== ALERTAS DE CRÉDITO (solo admin) ========== */

const ALERTA_TIPO_LABEL = {
  venta_credito: 'Venta a crédito',
  abono: 'Abono',
  deuda_rapida: 'Deuda rápida',
  anulacion: 'Anulación',
};
const ALERTA_TIPO_ICON = {
  venta_credito: 'nf-fa-credit_card',
  abono: 'nf-fa-money',
  deuda_rapida: 'nf-fa-zap',
  anulacion: 'nf-fa-ban',
};

function alertaTipoLabel(tipo) {
  return ALERTA_TIPO_LABEL[tipo] || tipo || 'Operación';
}

function alertaTipoIcon(tipo) {
  return ALERTA_TIPO_ICON[tipo] || 'nf-fa-bell';
}

function formatAlertaFecha(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return formatDateTime(iso);
}

function createAlertaRow(a) {
  var tipo = a.tipo || '';
  var monto = a.monto_usd ? formatUSD(a.monto_usd) : '-';
  var metodo = a.metodo_pago ? a.metodo_pago : '-';
  var icon = alertaTipoIcon(tipo);
  var badgeCls = 'badge-info';
  if (tipo === 'abono') badgeCls = 'badge-success';
  if (tipo === 'deuda_rapida') badgeCls = 'badge-warning';
  if (tipo === 'anulacion') badgeCls = 'badge-danger';
  var nota = a.nota ? '<div class="text-muted">' + escapeHtml(a.nota) + '</div>' : '';
  return '<td data-label="Fecha">' + formatAlertaFecha(a.fecha_hora) + '</td>' +
    '<td data-label="Usuario">' + escapeHtml(a.usuario || '-') + '</td>' +
    '<td data-label="Tipo"><span class="' + badgeCls + '"><i class="nf ' + icon + '"></i> ' + escapeHtml(alertaTipoLabel(tipo)) + '</span></td>' +
    '<td data-label="Cliente">' + escapeHtml(a.cliente_nombre || ('#' + (a.cliente_id || '-'))) + '</td>' +
    '<td data-label="Monto">' + monto + '</td>' +
    '<td data-label="Método">' + escapeHtml(metodo) + '</td>' +
    '<td data-label="Nota">' + nota + '</td>';
}

async function refreshCreditoAlertBadge() {
  if (!isAdmin()) return;
  var count = await invokeOrError(invoke('get_alertas_credito_nuevas'));
  if (count === undefined) return;
  var navBadge = qs(SEL.creditoNavAlert);
  if (navBadge) {
    navBadge.textContent = count;
    navBadge.classList.toggle('hidden', count === 0);
    navBadge.title = count === 1 ? '1 alerta de crédito' : (count + ' alertas de crédito');
  }
  var btnCount = qs(SEL.alertasCreditoBtnCount);
  if (btnCount) {
    btnCount.textContent = count;
    btnCount.classList.toggle('hidden', count === 0);
  }
}

async function loadAlertasCredito() {
  var body = qs(SEL.alertasCreditoBody);
  showSkeleton(body, 4);
  var alertas = await invokeOrError(invoke('get_alertas_credito', { limit: 100, offset: 0 }));
  if (alertas === undefined) return;
  body.innerHTML = '';
  if (!alertas.length) {
    body.innerHTML = emptyTableRow(7, '<i class="nf nf-fa-bell"></i>', 'No hay alertas de crédito', 'Las operaciones de crédito hechas por vendedores aparecerán aquí');
  } else {
    appendRows(body, alertas, createAlertaRow);
  }
}

async function openAlertasCredito() {
  if (!isAdmin()) return;
  await loadAlertasCredito();
  showModal(qs(SEL.alertasCreditoModal));
  refreshCreditoAlertBadge();
}

async function closeAlertasCredito() {
  closeModal(qs(SEL.alertasCreditoModal));
  refreshCreditoAlertBadge();
}

async function markAllAlertasVistas() {
  if (!isAdmin()) return;
  var ok = await invokeOrError(invoke('marcar_alertas_credito_vistas'));
  if (ok === undefined) return;
  showToast('Todas las alertas marcadas como vistas');
  refreshCreditoAlertBadge();
  loadAlertasCredito();
}

/* ========== ALERTAS DE STOCK (solo admin) ========== */

function createAlertaStockRow(a) {
  var cant = a.cantidad;
  var cantLabel = (cant > 0 ? '+' : '') + (Number.isInteger(cant) ? cant : cant.toFixed(3));
  var cantClass = cant > 0 ? 'badge-success' : 'badge-danger';
  return '<td data-label="Fecha">' + formatAlertaFecha(a.fecha_hora) + '</td>' +
    '<td data-label="Usuario">' + escapeHtml(a.usuario || '-') + '</td>' +
    '<td data-label="Producto">' + escapeHtml(a.producto_nombre || a.producto_codigo) + '</td>' +
    '<td data-label="Cantidad"><span class="' + cantClass + '">' + cantLabel + '</span></td>' +
    '<td data-label="Motivo">' + escapeHtml(a.motivo || '-') + '</td>';
}

async function refreshStockAlertBadge() {
  if (!isAdmin()) return;
  var count = await invokeOrError(invoke('get_alertas_stock_nuevas'));
  if (count === undefined) return;
  var navBadge = qs(SEL.stockNavAlert);
  if (navBadge) {
    navBadge.textContent = count;
    navBadge.classList.toggle('hidden', count === 0);
    navBadge.title = count === 1 ? '1 alerta de stock' : (count + ' alertas de stock');
  }
  var btnCount = qs(SEL.alertasStockBtnCount);
  if (btnCount) {
    btnCount.textContent = count;
    btnCount.classList.toggle('hidden', count === 0);
  }
}

async function loadAlertasStock() {
  var body = qs(SEL.alertasStockBody);
  showSkeleton(body, 4);
  var alertas = await invokeOrError(invoke('get_alertas_stock', { limit: 100, offset: 0 }));
  if (alertas === undefined) return;
  body.innerHTML = '';
  if (!alertas.length) {
    body.innerHTML = emptyTableRow(5, '<i class="nf nf-fa-bell"></i>', 'No hay alertas de stock', 'Los ajustes de stock hechos por vendedores aparecerán aquí');
  } else {
    appendRows(body, alertas, createAlertaStockRow);
  }
}

async function openAlertasStock() {
  if (!isAdmin()) return;
  await loadAlertasStock();
  showModal(qs(SEL.alertasStockModal));
  refreshStockAlertBadge();
}

async function closeAlertasStock() {
  closeModal(qs(SEL.alertasStockModal));
  refreshStockAlertBadge();
}

async function markAllStockAlertasVistas() {
  if (!isAdmin()) return;
  var ok = await invokeOrError(invoke('marcar_alertas_stock_vistas'));
  if (ok === undefined) return;
  showToast('Todas las alertas marcadas como vistas');
  refreshStockAlertBadge();
  loadAlertasStock();
}
