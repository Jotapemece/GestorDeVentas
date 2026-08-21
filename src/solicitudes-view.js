/* ========== SOLICITUDES DE ANULACIÓN (vendedor pide, admin resuelve) ========== */

const SOLICITUD_ESTADO_LABEL = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

function solicitudEstadoLabel(estado) {
  return SOLICITUD_ESTADO_LABEL[estado] || estado || 'Pendiente';
}

function solicitudEstadoBadge(estado) {
  var cls = 'badge-warning';
  if (estado === 'aprobada') cls = 'badge-success';
  if (estado === 'rechazada') cls = 'badge-danger';
  return '<span class="' + cls + '">' + escapeHtml(solicitudEstadoLabel(estado)) + '</span>';
}

function formatSolicitudFecha(iso) {
  if (!iso) return '-';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return formatDateTime(iso);
}

function currentUserIsAdminS() {
  return !!(currentUser && currentUser.rol === ROL_ADMIN);
}

function createSolicitudRow(s) {
  var acciones = '';
  if (s.estado === 'pendiente') {
    acciones =
      '<button class="btn btn-sm btn-success resolve-solicitud-btn" data-id="' + s.id + '" data-aprobar="1" title="Aprobar y anular la venta (restaura el stock)"><i class="nf nf-fa-circle_check"></i></button>' +
      '<button class="btn btn-sm btn-danger resolve-solicitud-btn" data-id="' + s.id + '" data-aprobar="0" title="Rechazar la solicitud (pide el motivo)"><i class="nf nf-fa-circle_xmark"></i></button>';
  } else if (s.resuelto_por) {
    acciones = '<span class="text-muted">Resuelta por ' + escapeHtml(s.resuelto_por) + '</span>';
  }
  var motivo = escapeHtml(s.motivo);
  var notaRes = s.nota_resolucion
    ? '<div class="text-muted" style="margin-top:4px">Nota: ' + escapeHtml(s.nota_resolucion) + '</div>'
    : '';
  var tr = '<td data-label="Fecha">' + formatSolicitudFecha(s.fecha_hora) + '</td>' +
    '<td data-label="# Venta">#' + s.venta_id + '</td>' +
    '<td data-label="Solicitante">' + escapeHtml(s.solicitante) + '</td>' +
    '<td data-label="Motivo">' + motivo + notaRes + '</td>' +
    '<td data-label="Estado">' + solicitudEstadoBadge(s.estado) + '</td>' +
    '<td data-label="Acciones" class="row-actions">' + acciones + '</td>';
  return tr;
}

async function refreshSolicitudesBadge() {
  if (!currentUserIsAdminS()) return;
  var count = await invokeOrError(invoke('get_solicitudes_anulacion_pendientes'));
  if (count === undefined) return;
  var badge = qs(SEL.solicitudesBtnCount);
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
    badge.title = count === 1 ? '1 solicitud pendiente' : (count + ' solicitudes pendientes');
  }
}

async function loadSolicitudes() {
  var body = qs(SEL.solicitudesBody);
  showSkeleton(body, 4);
  var list = await invokeOrError(invoke('get_solicitudes_anulacion', { limit: 100, offset: 0 }));
  if (list === undefined) return;
  body.innerHTML = '';
  if (!list.length) {
    body.innerHTML = emptyTableRow(6, '<i class="nf nf-fa-paper_plane"></i>', 'No hay solicitudes de anulación', 'Cuando un vendedor pida anular una venta, aparecerá aquí');
  } else {
    appendRows(body, list, createSolicitudRow);
  }
}

async function openSolicitudes() {
  if (!currentUserIsAdminS()) return;
  await loadSolicitudes();
  showModal(qs(SEL.solicitudesModal));
  refreshSolicitudesBadge();
}

async function closeSolicitudes() {
  closeModal(qs(SEL.solicitudesModal));
  refreshSolicitudesBadge();
}

async function refreshSolicitudesOnly() {
  if (!currentUserIsAdminS()) return;
  var btn = qs(SEL.solicitudesRefreshBtn);
  if (btn) btn.disabled = true;
  var res = await invokeOrError(invoke('refresh_solicitudes'));
  if (btn) btn.disabled = false;
  if (res === undefined) return;
  showToast(res);
  await loadSolicitudes();
  refreshSolicitudesBadge();
}

let solicitudVentaId = null;

function openSolicitudMotivo(ventaId) {
  solicitudVentaId = ventaId;
  var input = qs(SEL.solicitudMotivoInput);
  if (input) input.value = '';
  showModal(qs(SEL.solicitudMotivoModal));
}

async function closeSolicitudMotivo() {
  closeModal(qs(SEL.solicitudMotivoModal));
  solicitudVentaId = null;
}

async function confirmSolicitudMotivo() {
  if (!solicitudVentaId) return;
  var input = qs(SEL.solicitudMotivoInput);
  var motivo = input ? input.value.trim() : '';
  if (!motivo) {
    showToast('Escribe el motivo de la solicitud', 'error');
    return;
  }
  var res = await invokeOrError(invoke('solicitar_anulacion', { ventaId: solicitudVentaId, motivo: motivo }));
  if (res === undefined) return;
  showToast(res);
  closeSolicitudMotivo();
}

async function resolveSolicitud(id, aprobar) {
  if (!currentUserIsAdminS()) return;
  var nota = '';
  if (!aprobar) {
    nota = await promptModal('Indica el motivo del rechazo', 'Rechazar solicitud', 'Rechazar');
    if (nota === null || nota === undefined) return;
    if (!nota) {
      showToast('El motivo de rechazo es obligatorio', 'error');
      return;
    }
  }
  var res = await invokeOrError(invoke('resolver_solicitud_anulacion', { solicitudId: id, aprobar: aprobar, nota: nota }));
  if (res === undefined) return;
  showToast(res);
  loadSolicitudes();
  refreshSolicitudesBadge();
}