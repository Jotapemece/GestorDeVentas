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
  var tr = document.createElement('tr');
  tr.innerHTML =
    '<td>' + formatAlertaFecha(a.fecha_hora) + '</td>' +
    '<td>' + escapeHtml(a.usuario || '-') + '</td>' +
    '<td><span class="' + badgeCls + '"><i class="nf ' + icon + '"></i> ' + escapeHtml(alertaTipoLabel(tipo)) + '</span></td>' +
    '<td>' + escapeHtml(a.cliente_nombre || ('#' + (a.cliente_id || '-'))) + '</td>' +
    '<td>' + monto + '</td>' +
    '<td>' + escapeHtml(metodo) + '</td>' +
    '<td>' + nota + '</td>';
  return tr;
}

function currentUserIsAdmin() {
  return !!(currentUser && currentUser.rol === ROL_ADMIN);
}

async function refreshCreditoAlertBadge() {
  if (!currentUserIsAdmin()) return;
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
  if (!currentUserIsAdmin()) return;
  await loadAlertasCredito();
  showModal(qs(SEL.alertasCreditoModal));
  refreshCreditoAlertBadge();
}

async function closeAlertasCredito() {
  closeModal(qs(SEL.alertasCreditoModal));
  refreshCreditoAlertBadge();
}

async function markAllAlertasVistas() {
  if (!currentUserIsAdmin()) return;
  var ok = await invokeOrError(invoke('marcar_alertas_credito_vistas'));
  if (ok === undefined) return;
  showToast('Todas las alertas marcadas como vistas');
  refreshCreditoAlertBadge();
  loadAlertasCredito();
}
