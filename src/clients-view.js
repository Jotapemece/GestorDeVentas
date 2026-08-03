/* ========== CREDITOS ========== */
async function loadCreditos() {
  const tbody = qs(SEL.creditosBody);
  showSkeleton(tbody, 5);
  try {
    const clientes = await invoke('list_clientes');
    tbody.innerHTML = '';
    if (clientes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">' + emptyState('<i class="nf nf-fa-credit_card"></i>', 'No hay clientes registrados', 'Registre personas para otorgar cr\u00e9dito') + '</td></tr>';
      creditoRows = [];
      updateCreditoStats([]);
      return;
    }
    const frag = document.createDocumentFragment();
    const rows = [];
    clientes.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = createClientRow(c);
      tr.dataset.nombre = c.nombre.toLowerCase();
      frag.appendChild(tr);
      rows.push(tr);
    });
    tbody.appendChild(frag);
    creditoRows = rows;
    updateCreditoStats(clientes);
    applyCreditoFilter();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

let creditoFilterTimer = null;
function applyCreditoFilter() {
  clearTimeout(creditoFilterTimer);
  creditoFilterTimer = setTimeout(function() {
    const term = (qs(SEL.creditosSearch)?.value || '').toLowerCase().trim();
    var hasVisible = false;
    creditoRows.forEach(tr => {
      const name = tr.dataset.nombre || tr.children[0]?.textContent?.toLowerCase() || '';
      var visible = name.includes(term);
      tr.style.display = visible ? '' : 'none';
      if (visible) hasVisible = true;
    });
    var tbody = qs(SEL.creditosBody);
    var emptyRow = tbody.querySelector('.creditos-empty-row');
    if (!hasVisible && creditoRows.length > 0) {
      if (!emptyRow) {
        emptyRow = document.createElement('tr');
        emptyRow.className = 'creditos-empty-row';
        emptyRow.innerHTML = '<td colspan="5">' + emptyState('<i class="nf nf-fa-search"></i>', 'Sin resultados', 'Pruebe con otro t\u00e9rmino de b\u00fasqueda') + '</td>';
        tbody.appendChild(emptyRow);
      }
    } else if (emptyRow) {
      emptyRow.remove();
    }
  }, 150);
}

function openCreditoModal(cliente) {
  editingClienteId = cliente ? cliente.id : null;
  qs(SEL.clientNombre).value = cliente ? cliente.nombre : '';
  qs(SEL.clientModalTitle).textContent = cliente ? 'Editar Cliente' : 'Registrar Persona para Cr\u00e9dito';
  qs(SEL.clientSaveBtn).textContent = cliente ? 'Guardar Cambios' : 'Guardar';
  if (qs(SEL.clientEsTemporal)) {
    qs(SEL.clientEsTemporal).checked = cliente ? !!cliente.es_temporal : false;
    qs(SEL.clientEsTemporal).disabled = !!cliente;
  }
  clearClientErrors();
  showModal(qs(SEL.clientModal));
}

function closeClientModal() {
  editingClienteId = null;
  closeModal(qs(SEL.clientModal));
  clearClientErrors();
}

function clearClientErrors() {
  var err = qs(SEL.clientNombreError);
  var input = qs(SEL.clientNombre);
  if (err) { err.textContent = ''; err.classList.remove('visible'); }
  if (input) input.classList.remove('input-error');
}

async function saveClient() {
  const btn = qs(SEL.clientSaveBtn);
  const nombre = qs(SEL.clientNombre).value.trim();
  clearClientErrors();
  if (!nombre) {
    var err = qs(SEL.clientNombreError);
    var input = qs(SEL.clientNombre);
    if (err) { err.textContent = 'El nombre del cliente es obligatorio'; err.classList.add('visible'); }
    if (input) input.classList.add('input-error');
    return;
  }
  if (btn) btn.disabled = true;
  try {
    if (editingClienteId) {
      await invoke('update_cliente', { clienteId: editingClienteId, nombre });
      showToast('Cliente actualizado');
    } else {
      const esTemporal = qs(SEL.clientEsTemporal) ? qs(SEL.clientEsTemporal).checked : false;
      await invoke('create_cliente', { nombre, esTemporal });
      showToast(esTemporal ? 'Cliente temporal creado' : 'Cliente creado');
    }
    editingClienteId = null;
    closeClientModal(); loadCreditos();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
}

/* ========== DEBT DETAIL ========== */
async function openDebtDetail(id) {
  try {
    const hist = await invoke('get_cliente_history', { clienteId: id });
    qs(SEL.debtDetailTitle).textContent = 'Deuda: ' + hist.cliente.nombre;
    qs(SEL.debtDetailDebt).textContent = formatUSD(hist.total_deuda);
    const container = qs(SEL.debtDetailList);
    container.innerHTML = '';
    if (hist.ventas.length === 0) {
      container.innerHTML = emptyState('<i class="nf nf-fa-credit_card"></i>', 'Sin ventas a cr\u00e9dito', 'Las ventas a cr\u00e9dito de este cliente aparecer\u00e1n aqu\u00ed');
    } else {
      hist.ventas.forEach(v => {
        const card = document.createElement('div');
        card.className = 'debt-sale-card';
        let prodHtml = '';
        v.productos.forEach(p => {
          prodHtml += '<div class="debt-prod"><span>' + p.producto_nombre + '</span><span>x' + p.cantidad + ' <strong>' + formatUSD(p.subtotal_usd) + '</strong></span></div>';
        });
        card.innerHTML = createDebtSaleCard(v, prodHtml);
        container.appendChild(card);
      });
    }
    showModal(qs(SEL.debtDetailModal));
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

function closeDebtDetail() {
  closeModal(qs(SEL.debtDetailModal));
}

/* ========== ABONO MODAL ========== */
function openAbonoModal(id) {
  abonoClienteId = id;
  qs(SEL.abonoMonto).value = '';
  qs(SEL.abonoMontoBs).value = '';
  qs(SEL.abonoReferencia).value = '';
  qs(SEL.abonoReferenciaGroup).style.display = 'none';
  qs(SEL.abonoMixtoGroup).style.display = 'none';
  qs(SEL.abonoMixtoItems).innerHTML = '';
  qs(SEL.abonoMixtoError).style.display = 'none';
  qs(SEL.abonoSaldoRestante).textContent = 'Saldo Restante: $0.00';
  qsa('.abono-metodo-btn').forEach(b => b.classList.remove('active'));
  qs(SEL.abonoReferenciaGroup).style.display = 'none';
  qs(SEL.abonoMixtoGroup).style.display = 'none';
  updateTasaInfo('abono');
  loadAbonoClienteInfo(id);
  showModal(qs(SEL.abonoModal));
}

async function loadAbonoClienteInfo(id) {
  await tryCatch(async () => {
    const clientes = await invoke('list_clientes');
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    qs(SEL.abonoClienteNombre).textContent = c.nombre;
    qs(SEL.abonoDeudaUsd).textContent = formatUSD(c.saldo_deuda_usd);
    qs(SEL.abonoDeudaBs).textContent = formatBS(c.saldo_deuda_usd * tasaActual);
  });
}

function closeAbonoModal() {
  closeModal(qs(SEL.abonoModal));
  abonoClienteId = null;
}

function selectAbonoMethod(btn) {
  qsa('.abono-metodo-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const method = btn.dataset.method;
  qs(SEL.abonoReferenciaGroup).style.display = method === METODO_PAGO_MOVIL ? 'block' : 'none';
  qs(SEL.abonoMixtoGroup).style.display = method === METODO_MIXTO ? 'block' : 'none';
  if (method === METODO_MIXTO) {
    if (!qs(SEL.abonoMixtoItems).querySelector('.mixto-row')) addMixtoRow('abono-mixto-items');
    distributeMixto('abono-mixto-items');
  }
}

function updateAbonoSaldoRestante() {
  const deudaTexto = qs(SEL.abonoDeudaUsd).textContent;
  const deuda = parseFloat(deudaTexto.replace(/[^0-9.-]/g, '')) || 0;
  var monto = parseInput(qs(SEL.abonoMonto).value);
  const montoBs = parseInput(qs(SEL.abonoMontoBs).value);
  if (montoBs > 0 && monto <= 0 && tasaActual > 0) monto = bsToUsd(montoBs, tasaActual);
  const restante = Math.max(0, deuda - monto);
  qs(SEL.abonoSaldoRestante).textContent = 'Saldo Restante: ' + formatUSD(restante);
}

let processingAbono = false;
function confirmAbono() {
  let monto = parseInput(qs(SEL.abonoMonto).value);
  const montoBs = parseInput(qs(SEL.abonoMontoBs).value);
  if ((monto <= 0 && montoBs <= 0)) { showToast('Ingrese un monto v\u00e1lido', 'error'); return; }
  const metodoBtn = qs(SEL.abonoMetodoBtnActive);
  if (!metodoBtn) { showToast('Seleccione un m\u00e9todo de pago', 'error'); return; }
  const metodo = metodoBtn.dataset.method;
  let referencia = null, pago_detalle = null;
  if (metodo === METODO_PAGO_MOVIL && metodo !== METODO_MIXTO) {
    referencia = qs(SEL.abonoReferencia).value.trim();
    if (!esRefPagoMovilValida(referencia)) { showToast('Ingrese los \u00faltimos 4 d\u00edgitos', 'error'); return; }
  }
  if (metodo === METODO_MIXTO) {
    pago_detalle = getMixtoData('abono-mixto-items');
    if (!validarMixto(pago_detalle, monto, 'abono-mixto-error')) return;
  }
  if (processingAbono) return;
  processingAbono = true;
  var btn = qs(SEL.abonoConfirmBtn);
  var origHtml = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-spin"></i>';
  (async function() {
    try {
      var tasa = await getTasaConFallback();
      if (montoBs > 0 && monto <= 0) monto = bsToUsd(montoBs, tasa);
      if (monto <= 0) { showToast('Ingrese un monto v\u00e1lido', 'error'); return; }
      const res = await invoke('pay_debt', {
        request: { cliente_id: abonoClienteId, monto_usd: monto, metodo_pago: metodo, referencia_pago_movil: referencia, pago_detalle }
      });
      showToast(res || 'Abono procesado. Cuenta actualizada con \u00e9xito');
      haptic(30);
      closeAbonoModal();
      loadCreditos();
    } catch (e) { showToast('Error: ' + e, 'error'); }
    finally { processingAbono = false; btn.disabled = false; btn.innerHTML = origHtml; }
  })();
}

/* ========== TASA HISTORIAL ========== */
let historialTasaData = [];
let selectedTasaFecha = '';

async function openTasaHistorialModal() {
  historialTasaData = [];
  selectedTasaFecha = tasaInventarioFecha || '';
  try {
    historialTasaData = await invoke('get_historial_tasas', { dias: 60 });
    renderTasaCalendar();
    renderTasaHistorialList();
    if (selectedTasaFecha) {
      var calDay = qs(SEL.tasaCalendarWrap).querySelector('.tasa-cal-day[data-fecha="' + selectedTasaFecha + '"]');
      if (calDay) calDay.classList.add('selected');
      var listItem = qs(SEL.tasaHistorialList).querySelector('.tasa-historial-item[data-fecha="' + selectedTasaFecha + '"]');
      if (listItem) listItem.classList.add('selected');
    }
    showModal(qs(SEL.tasaHistorialModal));
  } catch (e) { showToast('Error al cargar historial: ' + e, 'error'); }
}

function renderTasaCalendar() {
  var wrap = qs(SEL.tasaCalendarWrap);
  if (!historialTasaData.length) {
    wrap.innerHTML = emptyState('<i class="nf nf-fa-dollar"></i>', 'No hay tasas registradas', 'El historial de tasas aparecer\u00e1 aqu\u00ed');
    return;
  }
  var tasaMap = {};
  historialTasaData.forEach(function(item) { tasaMap[item.fecha] = item.tasa; });
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var html = '';
  var dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  var currentMonth = null;
  for (var i = 59; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(d.getDate() - i);
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var fechaStr = y + '-' + String(m).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var monthKey = y + '-' + String(m).padStart(2, '0');
    if (monthKey !== currentMonth) {
      currentMonth = monthKey;
      var monthName = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
      if (html) html += '</div>';
      html += '<div class="tasa-cal-month"><div class="tasa-cal-month-name">' + monthName + '</div>';
      html += '<div class="tasa-cal-grid">';
      dayNames.forEach(function(n) { html += '<div class="tasa-cal-day-name">' + n + '</div>'; });
    }
    var hasRate = tasaMap[fechaStr] !== undefined;
    var isSelected = fechaStr === selectedTasaFecha;
    var cls = 'tasa-cal-day' + (hasRate ? ' has-rate' : '') + (isSelected ? ' selected' : '');
    var rate = hasRate ? tasaMap[fechaStr] : null;
    var title = rate ? 'Bs. ' + rate.toFixed(2) : '';
    html += '<div class="' + cls + '" data-fecha="' + fechaStr + '" data-tasa="' + (rate || '') + '" title="' + title + '">' +
      '<span class="tasa-cal-day-num">' + day + '</span>' +
      (rate ? '<span class="tasa-cal-day-rate">' + rate.toFixed(2) + '</span>' : '') +
      '</div>';
  }
  if (html) html += '</div></div>';
  wrap.innerHTML = html;
  wrap.querySelectorAll('.tasa-cal-day.has-rate').forEach(function(el) {
    el.addEventListener('click', function() {
      wrap.querySelectorAll('.tasa-cal-day').forEach(function(x) { x.classList.remove('selected'); });
      this.classList.add('selected');
      selectedTasaFecha = this.dataset.fecha;
      document.querySelectorAll('.tasa-historial-item').forEach(function(x) { x.classList.remove('selected'); });
      var listItem = document.querySelector('.tasa-historial-item[data-fecha="' + selectedTasaFecha + '"]');
      if (listItem) listItem.classList.add('selected');
    });
  });
}

function renderTasaHistorialList() {
  var container = qs(SEL.tasaHistorialList);
  if (!historialTasaData.length) {
    container.innerHTML = emptyState('<i class="nf nf-fa-dollar"></i>', 'No hay tasas registradas', 'El historial de tasas aparecer\u00e1 aqu\u00ed');
    return;
  }
  container.innerHTML = historialTasaData.map(function(item) {
    var d = new Date(item.fecha + 'T00:00:00');
    var label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    return '<div class="tasa-historial-item" data-fecha="' + item.fecha + '" data-tasa="' + item.tasa + '">' +
      '<span class="tasa-historial-fecha">' + label + '</span>' +
      '<span class="tasa-historial-valor">Bs. ' + item.tasa.toFixed(2) + '</span></div>';
  }).join('');
  container.querySelectorAll('.tasa-historial-item').forEach(function(el) {
    el.addEventListener('click', function() {
      container.querySelectorAll('.tasa-historial-item').forEach(function(x) { x.classList.remove('selected'); });
      this.classList.add('selected');
      selectedTasaFecha = this.dataset.fecha;
      qs(SEL.tasaCalendarWrap).querySelectorAll('.tasa-cal-day').forEach(function(x) { x.classList.remove('selected'); });
      var calDay = qs(SEL.tasaCalendarWrap).querySelector('.tasa-cal-day[data-fecha="' + selectedTasaFecha + '"]');
      if (calDay) calDay.classList.add('selected');
    });
  });
}

function applyTasaHistorial() {
  if (!selectedTasaFecha) {
    var selected = qs(SEL.tasaHistorialList).querySelector('.selected');
    if (!selected) { showToast('Seleccione una fecha en el calendario', 'error'); return; }
    selectedTasaFecha = selected.dataset.fecha;
  }
  var item = historialTasaData.find(function(x) { return x.fecha === selectedTasaFecha; });
  if (!item) { showToast('No hay tasa para esta fecha', 'error'); return; }
  tasaInventario = item.tasa;
  tasaInventarioFecha = selectedTasaFecha;
  var d = new Date(selectedTasaFecha + 'T00:00:00');
  var label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  qs(SEL.tasaActualLabel).textContent = label;
  closeModal(qs(SEL.tasaHistorialModal));
  loadInventory();
  showToast('Usando tasa del ' + label + ': Bs. ' + tasaInventario.toFixed(2), 'info');
}

function clearTasaHistorial() {
  tasaInventario = 0;
  tasaInventarioFecha = '';
  selectedTasaFecha = '';
  qs(SEL.tasaActualLabel).textContent = 'Hoy';
  closeModal(qs(SEL.tasaHistorialModal));
  loadInventory();
  showToast('Usando tasa actual del d\u00eda', 'info');
}

/* ========== QUICK DEBT ========== */
async function confirmQuickDebt() {
  let monto = parseInput(qs(SEL.quickDebtMonto).value);
  const montoBs = parseInput(qs(SEL.quickDebtMontoBs).value);
  if (monto <= 0 && montoBs <= 0) { showToast('Ingrese un monto v\u00e1lido', 'error'); return; }
  var tasa = await getTasaConFallback();
  if (montoBs > 0 && monto <= 0) monto = bsToUsd(montoBs, tasa);
  if (monto <= 0) { showToast('Ingrese un monto v\u00e1lido', 'error'); return; }
  var clienteId = parseInt(qs(SEL.quickDebtMonto).dataset.clienteId);
  var nombre = qs(SEL.quickDebtClienteNombre).textContent;
  var ok = await confirmModal('Registrar deuda de ' + formatUSD(monto) + ' a "' + nombre + '"?', 'Deuda R\u00e1pida', 'Registrar');
  if (!ok) return;
  var btn = qs(SEL.quickDebtConfirm);
  var origHtml = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-spin"></i>';
  try {
    await invoke('add_quick_debt', { clienteId: clienteId, montoUsd: monto });
    showToast('Deuda de ' + formatUSD(monto) + ' registrada');
    closeModal(qs(SEL.quickDebtModal));
    loadCreditos();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { btn.disabled = false; btn.innerHTML = origHtml; }
}

function updateCreditoStats(clientes) {
  var total = clientes.length;
  var conDeuda = 0;
  var deudaTotal = 0;
  clientes.forEach(function(c) {
    if (c.credito_activo && (c.saldo_deuda_usd || 0) > 0) conDeuda++;
    deudaTotal += (c.saldo_deuda_usd || 0);
  });
  var totalEl = qs(SEL.creditosTotalPersonas);
  var deudaEl = qs(SEL.creditosConDeuda);
  var deudaTotalEl = qs(SEL.creditosDeudaTotal);
  if (totalEl) totalEl.textContent = total;
  if (deudaEl) deudaEl.textContent = conDeuda;
  if (deudaTotalEl) deudaTotalEl.textContent = formatUSD(deudaTotal);
}

/* ========== TEMP CLIENTS HISTORY ========== */
async function openTempHistoryModal() {
  const tbody = qs(SEL.tempHistoryBody);
  tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';
  showModal(qs(SEL.tempHistoryModal));
  try {
    const items = await invoke('list_clientes_eliminados');
    tbody.innerHTML = '';
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">' + emptyState('<i class="nf nf-fa-history"></i>', 'Sin historial', 'Los clientes temporales eliminados aparecer\u00e1n aqu\u00ed') + '</td></tr>';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(function(item) {
      const tr = document.createElement('tr');
      const motivo = item.motivo === 'deuda_pagada'
        ? '<span class="badge badge-success" style="font-size:10px">Deuda pagada</span>'
        : (item.motivo === 'eliminacion_manual'
            ? '<span class="badge badge-danger" style="font-size:10px">Eliminado manual</span>'
            : escapeHtml(item.motivo));
      tr.innerHTML = '<td>' + escapeHtml(item.nombre) + '</td>' +
        '<td>' + escapeHtml(item.creado_en) + '</td>' +
        '<td>' + escapeHtml(item.eliminado_en) + '</td>' +
        '<td>' + formatUSD(item.saldo_pagado_usd) + '</td>' +
        '<td>' + motivo + '</td>';
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  } catch (e) { tbody.innerHTML = '<tr><td colspan="5">Error: ' + escapeHtml(e) + '</td></tr>'; }
}

function closeTempHistoryModal() {
  closeModal(qs(SEL.tempHistoryModal));
}

