/* ========== SUPABASE SYNC ========== */
async function loadSyncConfig() {
  const urlEl = qs(SEL.syncUrl);
  const keyEl = qs(SEL.syncKey);
  if (!urlEl) return;
  try {
    const url = await invoke('get_config_value', { key: CFG_SUPABASE_URL });
    if (url) urlEl.value = url;
    const key = await invoke('get_config_value', { key: CFG_SUPABASE_KEY });
    if (key) keyEl.value = key;
  } catch (e) { showToast('Error al cargar configuración de sincronización: ' + e, 'error'); }
  loadSyncStats();
  loadSyncAutoConfig();
}

function updateSyncIndicator(text, isSyncActive) {
  const el = qs(SEL.syncIndicator);
  const textEl = qs(SEL.syncIndicatorText);
  if (!el || !textEl) return;
  textEl.textContent = text;
  el.classList.toggle('syncing', !!isSyncActive);
}

async function loadSyncStats() {
  try {
    const stats = await invoke('get_sync_stats');
    var fmt = function(v) { return v ? formatDateTime(v) : '-'; };
    qs(SEL.statProducts).textContent = stats.active_products;
    qs(SEL.statClients).textContent = stats.total_clientes;
    qs(SEL.statSales).textContent = stats.total_sales;
    qs(SEL.syncUploadTime).textContent = fmt(stats.ultimo_upload);
    qs(SEL.syncDownloadTime).textContent = fmt(stats.ultimo_download);
    qs(SEL.syncUploadSalesTime).textContent = fmt(stats.ultimo_upload_ventas);
    qs(SEL.syncDownloadSalesTime).textContent = fmt(stats.ultimo_download_ventas);
    qs(SEL.syncUploadClientesTime).textContent = fmt(stats.ultimo_upload_clientes);
    qs(SEL.syncDownloadClientesTime).textContent = fmt(stats.ultimo_download_clientes);
    qs(SEL.syncUploadUsuariosTime).textContent = fmt(stats.ultimo_upload_usuarios);
    qs(SEL.syncDownloadUsuariosTime).textContent = fmt(stats.ultimo_download_usuarios);
    // Badge de pendientes de sync en el sidebar (fix 8)
    const badge = qs(SEL.syncNavPending);
    if (badge) {
      const n = stats.pending_total || 0;
      badge.textContent = n;
      badge.classList.toggle('hidden', n === 0);
      badge.title = n === 1 ? '1 elemento pendiente de subir' : (n + ' elementos pendientes de subir');
    }
    // Update sync indicator in sidebar with most recent sync time
    var timestamps = [stats.ultimo_upload, stats.ultimo_download, stats.ultimo_upload_ventas, stats.ultimo_download_ventas].filter(Boolean);
    var latest = timestamps.length ? timestamps.sort().pop() : null;
    var label = 'Sin sincronizar';
    if (latest) {
      var dt = formatDateTime(latest);
      label = dt.indexOf(' ') > -1 ? dt.split(' ')[1] : dt;
    }
    updateSyncIndicator(label, false);
    // Refresco del badge de alertas de crédito alineado al ciclo de sync (10 min auto-sync)
    if (typeof refreshCreditoAlertBadge === 'function') refreshCreditoAlertBadge();
    if (typeof refreshSolicitudesBadge === 'function') refreshSolicitudesBadge();
  } catch (e) { showToast('Error al cargar estadísticas de sincronización: ' + e, 'error'); }
}

/* ========== SYNC AUTO TIMERS ========== */
let syncAutoIntervalId = null;
let currentAutoMinutes = 0;
let isSyncing = false;
let syncAutoListenerAttached = false;

function loadSyncAutoConfig() {
  const input = qs(SEL.syncAutoInterval);
  const toggle = qs(SEL.syncAutoEnabled);
  const badge = qs(SEL.syncAutoBadge);
  if (!input) return;
  // En teléfonos el auto-sync está desactivado hasta nuevo aviso (solo manual):
  // bloquear los controles para que la UI no muestre una configuración engañosa.
  if (IS_ANDROID) {
    if (input) input.disabled = true;
    if (toggle) toggle.disabled = true;
  }
  invoke('get_config_value', { key: CFG_SYNC_AUTO_INTERVAL }).then(val => {
    const minutes = parseInt(val) || SYNC.AUTO_MIN;
    input.value = Math.max(SYNC.AUTO_MIN, Math.min(SYNC.AUTO_MAX, minutes));
    applySyncAutoConfig();
  }).catch(() => {});
  invoke('get_config_value', { key: CFG_SYNC_AUTO_ENABLED }).then(val => {
    const enabled = val === undefined || val === null || val === '' || val === 'true' || val === '1';
    if (toggle) toggle.checked = enabled;
    applySyncAutoConfig();
  }).catch(() => {});
  if (!syncAutoListenerAttached) {
    syncAutoListenerAttached = true;
    input.addEventListener('change', () => {
      if (IS_ANDROID) return;
      let minutes = parseInt(input.value) || SYNC.AUTO_MIN;
      minutes = Math.max(SYNC.AUTO_MIN, Math.min(SYNC.AUTO_MAX, minutes));
      input.value = minutes;
      invoke('set_config_value', { key: CFG_SYNC_AUTO_INTERVAL, value: String(minutes) }).catch(() => {});
      applySyncAutoConfig();
    });
    if (toggle) toggle.addEventListener('change', () => {
      if (IS_ANDROID) return;
      invoke('set_config_value', { key: CFG_SYNC_AUTO_ENABLED, value: String(toggle.checked) }).catch(() => {});
      applySyncAutoConfig();
    });
  }
}

function applySyncAutoConfig() {
  const enabled = qs(SEL.syncAutoEnabled);
  const badge = qs(SEL.syncAutoBadge);
  // En teléfonos el auto-sync está desactivado hasta nuevo aviso (solo manual).
  const on = !IS_ANDROID && (!enabled || enabled.checked);
  if (badge) {
    badge.textContent = on ? 'Activo' : (IS_ANDROID ? 'Desactivado (teléfono)' : 'Desactivado');
    badge.classList.toggle('sync-auto-off', !on);
  }
  const minutes = parseInt(qs(SEL.syncAutoInterval)?.value) || SYNC.AUTO_MIN;
  startSyncAutoInterval(on ? minutes : 0);
}

function startSyncAutoInterval(minutes) {
  // En teléfonos el auto-sync está desactivado hasta nuevo aviso: el timer
  // nunca arranca aunque el toggle esté marcado.
  if (IS_ANDROID) {
    currentAutoMinutes = 0;
    if (syncAutoIntervalId) clearInterval(syncAutoIntervalId);
    syncAutoIntervalId = null;
    return;
  }
  if (minutes === currentAutoMinutes && syncAutoIntervalId) return;
  currentAutoMinutes = minutes;
  if (syncAutoIntervalId) clearInterval(syncAutoIntervalId);
  syncAutoIntervalId = null;
  if (minutes <= 0) return;
  syncAutoIntervalId = setInterval(() => {
    if (!isSyncing) {
      isSyncing = true;
      updateSyncIndicator('Sincronizando...', true);
      invoke('sync_all')
        .then(() => { isSyncing = false; loadSyncStats(); if (typeof refreshCashierAfterSync === 'function') refreshCashierAfterSync(); })
        .catch(() => { isSyncing = false; loadSyncStats(); });
    }
  }, minutes * 60 * 1000);
}

function showView(name) {
  // Decisión 2026-08-14: la sincronización está abierta a todos los roles
  // (vendedor y admin suben/descargan). Los guards de rol viven en el backend.
  // Decisión 2026-08-19: los reportes son solo de administradores.
  if (!viewAllowedForRole(name, currentUser)) {
    showToast('Solo los administradores pueden ver los reportes', 'error');
    name = VIEW.SALES;
  }
  lastViewName = name;
  if (typeof androidTrackView === 'function') androidTrackView(name);
  // En móvil el carrito es un bottom-sheet: cerrarlo al cambiar de vista para
  // que no quede como overlay sobre la vista nueva.
  if (document.body.classList.contains('cart-open') && typeof closeCartSheet === 'function') {
    closeCartSheet();
  }
  try { localStorage.setItem('last_view', name); } catch (e) {}
  qsa('.view').forEach(v => v.classList.remove('active'));
  getViewEl(name).classList.add('active');
  qsa('.nav-btn').forEach(b => b.classList.remove('active'));
  qs(`.nav-btn[data-view="${name}"]`).classList.add('active');
  // Inari activation: config toggle is master switch
  if (name === VIEW.INVENTORY) {
    const cfgToggle = qs(SEL.inariConfigToggle);
    const configActive = cfgToggle && cfgToggle.checked;
    if (!configActive) {
      if (showInari) {
        showInari = false;
        updateInariBtn();
      }
    } else {
      const hoy = new Date().getDay();
      if (INARI_DIAS.includes(hoy)) {
        if (!showInari) {
          showInari = true;
          updateInariBtn();
        }
      } else if (showInari) {
        showInari = false;
        updateInariBtn();
      }
    }
    qs(SEL.inariSubcatBar).style.display = showInari ? 'flex' : 'none';
    if (!showInari) { inariSubcat = ''; }
  }

  const loaders = {
    [VIEW.INVENTORY]: loadInventory,
    [VIEW.CREDITOS]: loadCreditos,
    [VIEW.CASHIER]: loadDailySummary,
    [VIEW.AUDIT]: loadAudit,
    [VIEW.REPORTS]: () => { setDefaultReportDates(); loadReportsAndTopProducts(false); },
    [VIEW.CONFIG]: () => { loadThemeConfig(); loadConflictCount(); },
    [VIEW.SYNC]: () => { loadSyncConfig(); loadConflictCount(); },
  };
  if (loaders[name]) loaders[name]();
  if (name === VIEW.SALES) {
    if (typeof updateSalesCashierBanner === 'function') updateSalesCashierBanner();
    if (!IS_ANDROID) qs(SEL.productSearch).focus();
    renderProductSearch();
    renderCart();
  }
  document.dispatchEvent(new CustomEvent('viewChanged', { detail: name }));
  if (window.innerWidth <= 768) {
    const panel = qs(SEL.chatPanel);
    if (panel && !panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
    }
  }
}

/* ========== CIERRE PENDIENTE POR CORTE DE ENERGÍA ========== */
// Objeto PendienteCierre del día/días pendientes de cierre (corte de energía).
// Se usa al cerrar caja para que el cierre apunte a los días sin cerrar.
let lastPendienteFecha = null;
let lastPendienteCierre = null;

// Tras el login: si la caja quedó abierta con ventas de días anteriores sin
// cierre (corte de energía), descarga ventas de otros dispositivos y muestra
// un modal que lleva a Caja para hacer el cierre faltante.
async function checkPendienteCierre() {
  try {
    const pend = await invoke('get_pendiente_cierre');
    if (!pend) return;
    // Descargar primero las ventas de otros dispositivos para que el cierre
    // tenga el total real (mismo comportamiento que abrir la app tras corte).
    // Solo se baja: la subida de este dispositivo va por auto-sync/tras venta.
    try {
      await invoke('download_all');
      loadSyncStats();
      if (typeof refreshCashierAfterSync === 'function') refreshCashierAfterSync();
    } catch (e) {
      console.log('download_all en cierre pendiente:', e);
    }
    const pendFinal = await invoke('get_pendiente_cierre');
    if (!pendFinal) return;
    lastPendienteFecha = pendFinal.hasta;
    lastPendienteCierre = pendFinal;
    const det = qs(SEL.pendienteCierreDetalle);
    if (det) {
      let html = '';
      (pendFinal.dias || []).forEach(d => {
        html +=
          '<div class="summary-card"><div class="summary-value">' + formatUSD(d.total_usd) + '</div>' +
          '<div class="summary-label">' + d.fecha + ' · ' + d.total_ventas + ' ventas</div></div>';
      });
      html +=
        '<div class="summary-card"><div class="summary-value">' + formatUSD(pendFinal.total_usd) + '</div>' +
        '<div class="summary-label">Total ' + (pendFinal.dias || []).length + ' d\u00edas</div></div>';
      det.innerHTML = html;
    }
    const msg = qs(SEL.pendienteCierreMensaje);
    if (msg) {
      const rango = pendFinal.desde === pendFinal.hasta
        ? 'del ' + pendFinal.desde
        : 'del ' + pendFinal.desde + ' al ' + pendFinal.hasta;
      msg.textContent = 'La caja qued\u00f3 abierta y hay ventas ' + rango +
        ' que nunca se cerraron (posible corte de energ\u00eda). Completa el cierre para que el saldo quede correcto.';
    }
    showModal(qs(SEL.pendienteCierreModal));
  } catch (e) {
    console.log('error en checkPendienteCierre:', e);
  }
}

function closePendienteCierre() {
  closeModal(qs(SEL.pendienteCierreModal));
  lastPendienteFecha = null;
  lastPendienteCierre = null;
}
