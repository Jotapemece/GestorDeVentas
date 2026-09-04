/* ========== SUPABASE SYNC ========== */
async function loadSyncConfig() {
  const urlEl = qs(SEL.syncUrl);
  const keyEl = qs(SEL.syncKey);
  if (!urlEl) return;
  try {
    const cfg = await getConfigValues([CFG_SUPABASE_URL, CFG_SUPABASE_KEY]);
    const url = cfg[CFG_SUPABASE_URL];
    if (url) urlEl.value = url;
    const key = cfg[CFG_SUPABASE_KEY];
    if (key) keyEl.value = key;
  } catch (e) { showToast('Error al cargar configuración de sincronización: ' + e, 'error'); }
  loadSyncStats();
  loadSyncAutoConfig();
}

let lastSyncTs = null;
let syncRelInterval = null;

function formatRelativeTime(sec) {
  if (sec < 60) return 'ahora';
  if (sec < 3600) return 'hace ' + Math.floor(sec / 60) + ' min';
  if (sec < 86400) return 'hace ' + Math.floor(sec / 3600) + ' h';
  return 'hace ' + Math.floor(sec / 86400) + ' d';
}

function renderSyncRelative() {
  const el = qs(SEL.syncIndicator);
  const textEl = qs(SEL.syncIndicatorText);
  if (!el || !textEl) return;
  el.classList.remove('sync-ok', 'sync-warn', 'sync-stale');
  if (!lastSyncTs) {
    textEl.textContent = 'Sin sincronizar';
    el.classList.add('sync-stale');
    return;
  }
  const d = new Date(lastSyncTs);
  if (isNaN(d.getTime())) {
    textEl.textContent = 'Sin sincronizar';
    el.classList.add('sync-stale');
    return;
  }
  const diff = (Date.now() - d.getTime()) / 1000;
  textEl.textContent = formatRelativeTime(diff);
  // Punto de estado: verde si es reciente, ámbar si lleva unas horas, rojo si viejo.
  if (diff < 30 * 60) el.classList.add('sync-ok');
  else if (diff < 2 * 3600) el.classList.add('sync-warn');
  else el.classList.add('sync-stale');
}

function updateSyncIndicator(text, isSyncActive) {
  const el = qs(SEL.syncIndicator);
  const textEl = qs(SEL.syncIndicatorText);
  if (!el || !textEl) return;
  el.classList.toggle('syncing', !!isSyncActive);
  if (isSyncActive) {
    textEl.textContent = text;
    el.classList.remove('sync-ok', 'sync-warn', 'sync-stale');
  } else {
    renderSyncRelative();
  }
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
    // Update sync indicator in sidebar with most recent sync time (relativa)
    var timestamps = [stats.ultimo_upload, stats.ultimo_download, stats.ultimo_upload_ventas, stats.ultimo_download_ventas].filter(Boolean);
    lastSyncTs = timestamps.length ? timestamps.sort().pop() : null;
    updateSyncIndicator(null, false);
    // Refresca la etiqueta "hace X min" sin reconsultar el backend.
    if (!syncRelInterval) syncRelInterval = setInterval(renderSyncRelative, 30000);
    // Refresco del badge de alertas de crédito alineado al ciclo de sync (10 min auto-sync)
    if (typeof refreshCreditoAlertBadge === 'function') refreshCreditoAlertBadge();
    if (typeof refreshStockAlertBadge === 'function') refreshStockAlertBadge();
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
        let minutes = parseInt(input.value) || SYNC.AUTO_MIN;
        minutes = Math.max(SYNC.AUTO_MIN, Math.min(SYNC.AUTO_MAX, minutes));
        input.value = minutes;
        saveConfigValue(CFG_SYNC_AUTO_INTERVAL, minutes);
        applySyncAutoConfig();
      });
      if (toggle) toggle.addEventListener('change', () => {
        saveConfigValue(CFG_SYNC_AUTO_ENABLED, toggle.checked);
        applySyncAutoConfig();
      });
  }
}

function applySyncAutoConfig() {
  const enabled = qs(SEL.syncAutoEnabled);
  const badge = qs(SEL.syncAutoBadge);
  // En teléfono el auto-sync es SOLO descarga (download_all) para recibir alertas
  // sin arriesgar una subida pesada de catálogo desde el móvil.
  const on = (!enabled || enabled.checked);
  if (badge) {
    badge.textContent = on ? (IS_ANDROID ? 'Activo (descarga)' : 'Activo') : 'Desactivado';
    badge.classList.toggle('sync-auto-off', !on);
  }
  const minutes = parseInt(qs(SEL.syncAutoInterval)?.value) || SYNC.AUTO_MIN;
  startSyncAutoInterval(on ? minutes : 0);
}

function startSyncAutoInterval(minutes) {
  if (minutes === currentAutoMinutes && syncAutoIntervalId) return;
  currentAutoMinutes = minutes;
  if (syncAutoIntervalId) clearInterval(syncAutoIntervalId);
  syncAutoIntervalId = null;
  if (minutes <= 0) return;
  syncAutoIntervalId = setInterval(() => {
    if (!isSyncing) {
      isSyncing = true;
      updateSyncIndicator('Sincronizando...', true);
      // En teléfono solo descarga (recibe alertas de crédito sin subir catálogo).
      invoke(IS_ANDROID ? 'download_all' : 'sync_all')
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
  if (typeof applyCartFabVisibility === 'function') applyCartFabVisibility();
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
    [VIEW.REPORTS]: () => { setDefaultReportDates(); if (typeof ensureDashboardExpanded === 'function') ensureDashboardExpanded(); loadReportsAndTopProducts(false); },
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
      console.warn('download_all en cierre pendiente:', e);
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
    console.warn('error en checkPendienteCierre:', e);
  }
}

function closePendienteCierre() {
  closeModal(qs(SEL.pendienteCierreModal));
  lastPendienteFecha = null;
  lastPendienteCierre = null;
}
