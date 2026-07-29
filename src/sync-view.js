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
    var fmt = function(v) { return v ? v : '-'; };
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
    // Update sync indicator in sidebar with most recent sync time
    var timestamps = [stats.ultimo_upload, stats.ultimo_download, stats.ultimo_upload_ventas, stats.ultimo_download_ventas].filter(Boolean);
    var latest = timestamps.length ? timestamps.sort().pop() : null;
    var label = 'Sin sincronizar';
    if (latest) {
      var parts = latest.split(' ');
      label = parts.length > 1 ? parts[1].slice(0, 5) : latest;
    }
    updateSyncIndicator(label, false);
  } catch (e) { showToast('Error al cargar estadísticas de sincronización: ' + e, 'error'); }
}

/* ========== SYNC AUTO TIMERS ========== */
let syncAutoIntervalId = null;
let saleUploadTimer = null;
let isSyncing = false;

function loadSyncAutoConfig() {
  const input = qs(SEL.syncAutoInterval);
  if (!input) return;
  invoke('get_config_value', { key: CFG_SYNC_AUTO_INTERVAL }).then(val => {
    const minutes = parseInt(val) || 30;
    input.value = Math.max(SYNC.AUTO_MIN, Math.min(SYNC.AUTO_MAX, minutes));
    startSyncAutoInterval(minutes);
  }).catch(() => {});
  input.addEventListener('change', () => {
    let minutes = parseInt(input.value) || 30;
    minutes = Math.max(SYNC.AUTO_MIN, Math.min(SYNC.AUTO_MAX, minutes));
    input.value = minutes;
    invoke('set_config_value', { key: CFG_SYNC_AUTO_INTERVAL, value: String(minutes) }).catch(() => {});
    startSyncAutoInterval(minutes);
  });
}

function startSyncAutoInterval(minutes) {
  if (syncAutoIntervalId) clearInterval(syncAutoIntervalId);
  syncAutoIntervalId = null;
  if (minutes <= 0) return;
  syncAutoIntervalId = setInterval(() => {
    if (!isSyncing) {
      isSyncing = true;
      updateSyncIndicator('Sincronizando...', true);
      invoke('sync_all').then(() => { isSyncing = false; loadSyncStats(); }).catch(() => { isSyncing = false; loadSyncStats(); });
    }
  }, minutes * 60 * 1000);
}

function scheduleSaleUpload() {
  if (saleUploadTimer) clearTimeout(saleUploadTimer);
  saleUploadTimer = setTimeout(() => {
    if (!isSyncing) {
      isSyncing = true;
      updateSyncIndicator('Sincronizando...', true);
      invoke('sync_all').then(() => { isSyncing = false; loadSyncStats(); }).catch(() => { isSyncing = false; loadSyncStats(); });
    }
    saleUploadTimer = null;
  }, SYNC.SALE_DEBOUNCE_MS);
}

function showView(name) {
  lastViewName = name;
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
        qs(SEL.inventoryInariBtn).classList.remove('active');
        qs(SEL.inventoryInariBtn).innerHTML = '<i class="nf nf-fa-fire"></i> <span>Inari</span>';
      }
    } else {
      const hoy = new Date().getDay();
      if (INARI_DIAS.includes(hoy) && !showInari) {
        showInari = true;
        qs(SEL.inventoryInariBtn).classList.add('active');
        qs(SEL.inventoryInariBtn).innerHTML = '<i class="nf nf-fa-check"></i> <span>Inari</span>';
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
    [VIEW.REPORTS]: () => { setDefaultReportDates(); },
    [VIEW.CONFIG]: () => { loadThemeConfig(); loadConflictCount(); },
    [VIEW.SYNC]: () => { loadSyncConfig(); loadConflictCount(); },
  };
  if (loaders[name]) loaders[name]();
  if (name === VIEW.SALES) {
    if (!IS_ANDROID) qs(SEL.productSearch).focus();
    renderProductSearch();
    renderCart();
    renderRecentProducts();
  }
  document.dispatchEvent(new CustomEvent('viewChanged', { detail: name }));
  if (window.innerWidth <= 768) {
    const panel = qs(SEL.chatPanel);
    if (panel && !panel.classList.contains('hidden')) {
      panel.classList.add('hidden');
    }
  }
}
