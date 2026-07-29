/* ========== KEYBOARD SHORTCUTS ========== */
document.addEventListener('keydown', function(e) {
  const activeView = qs(SEL.viewActive);
  const viewId = activeView ? activeView.id : '';
  switch (e.key) {
    case 'F1': e.preventDefault(); showView(VIEW.SALES); break;
    case 'F2': e.preventDefault(); showView(VIEW.INVENTORY); break;
    case 'F3': e.preventDefault(); showView(VIEW.CREDITOS); break;
    case 'F4': e.preventDefault(); showView(VIEW.CASHIER); break;
    case 'F5': e.preventDefault(); showView(VIEW.AUDIT); break;
    case 'F6': e.preventDefault(); showView(VIEW.REPORTS); break;
    case 'F7': e.preventDefault(); showView(VIEW.CONFIG); break;
    case 'F8':
      e.preventDefault();
      if (!IS_ANDROID && viewId === 'view-sales') qs(SEL.productSearch).focus();
      else if (!IS_ANDROID && viewId === 'view-inventory') qs(SEL.inventorySearch).focus();
      break;
    case 'F12':
      e.preventDefault();
      if (cart.length > 0) openPaymentModal();
      break;
    case 'Escape':
      e.preventDefault();
      qsa('.modal').forEach(m => closeModal(m));
      break;
  }
  if (e.ctrlKey && e.key === 'n') {
    e.preventDefault();
    if (viewId === 'view-inventory') openNewProductModal();
  }
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var open = document.querySelector(SEL.customSelectOpen);
    if (open) open.classList.remove('open');
  }
});

/* ? key -> open guide, Ctrl+M -> toggle sound */
document.addEventListener('keydown', function(e) {
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    e.preventDefault();
    showModal(qs(SEL.guideModal));
    return;
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
    e.preventDefault();
    soundEnabled = !soundEnabled;
    setUserConfig(CFG_SONIDO_HABILITADO, soundEnabled ? SOUND_ENABLED : SOUND_DISABLED).catch(function() {});
    var toggle = qs(SEL.soundToggle);
    if (toggle) toggle.checked = soundEnabled;
    playSound(soundEnabled ? 'add' : 'cancel');
    showToast('Sonido ' + (soundEnabled ? 'activado' : 'desactivado'), 'info');
  }
});

/* ========== GLOBAL SEARCH (Ctrl+K) ========== */
(function initGlobalSearch() {
  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const overlay = qs(SEL.globalSearchOverlay);
      const input = qs(SEL.globalSearchInput);
      if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        input.value = '';
        qs(SEL.globalSearchResults).innerHTML = '<div class="global-search-empty">Escribe para buscar...</div>';
        setTimeout(function() { input.focus(); }, 50);
      } else {
        overlay.classList.add('hidden');
      }
    }
    if (e.key === 'Escape') {
      qs(SEL.globalSearchOverlay).classList.add('hidden');
    }
  });

  qs(SEL.globalSearchClose).addEventListener('click', function() {
    qs(SEL.globalSearchOverlay).classList.add('hidden');
  });

  qs(SEL.globalSearchOverlay).addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });

  var searchTimer = null;
  qs(SEL.globalSearchInput).addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function() { performGlobalSearch(); }, 200);
  });
})();

async function performGlobalSearch() {
  const query = qs(SEL.globalSearchInput).value.trim().toLowerCase();
  const resultsEl = qs(SEL.globalSearchResults);
  if (!query) {
    resultsEl.innerHTML = '<div class="global-search-empty">Escribe para buscar...</div>';
    return;
  }
  var html = '';

  // Products
  const products = productCache.filter(function(p) { return p.nombre.toLowerCase().includes(query) || p.codigo.toLowerCase().includes(query); });
  if (products.length > 0) {
    html += '<div class="global-search-section-title"><i class="nf nf-fa-archive"></i> Productos (' + products.length + ')</div>';
    products.slice(0, 8).forEach(function(p) {
      html += '<a class="global-search-item" data-action="search-goto" data-view="sales" data-codigo="' + escapeHtml(p.codigo) + '">';
      html += '<span class="global-search-item-icon" style="background:var(--accent);color:#fff"><i class="nf nf-fa-cube"></i></span>';
      html += '<span class="global-search-item-info"><span class="global-search-item-title">' + escapeHtml(p.nombre) + '</span><span class="global-search-item-sub">' + escapeHtml(p.codigo) + ' &middot; ' + formatUSD(p.precio_usd) + ' &middot; Stock: ' + p.stock + '</span></span></a>';
    });
    if (products.length > 8) html += '<div class="global-search-item" style="opacity:0.6;font-size:12px;justify-content:center">+' + (products.length - 8) + ' m&aacute;s...</div>';
  }

  // Clients
  try {
    const clients = await invoke('list_clients_simple');
    const matched = clients.filter(function(c) { return c.nombre.toLowerCase().includes(query); });
    if (matched.length > 0) {
      html += '<div class="global-search-section-title"><i class="nf nf-fa-users"></i> Clientes (' + matched.length + ')</div>';
      matched.slice(0, 5).forEach(function(c) {
        html += '<a class="global-search-item" data-action="search-goto" data-view="creditos">';
        html += '<span class="global-search-item-icon" style="background:var(--primary);color:#fff"><i class="nf nf-fa-user"></i></span>';
        html += '<span class="global-search-item-info"><span class="global-search-item-title">' + escapeHtml(c.nombre) + '</span><span class="global-search-item-sub">Deuda: ' + formatUSD(c.saldo_deuda_usd) + '</span></span></a>';
      });
    }
  } catch (e) {}

  if (!html) {
    html = '<div class="global-search-empty">Sin resultados para "<strong>' + escapeHtml(query) + '</strong>"</div>';
  }
  resultsEl.innerHTML = html;

  resultsEl.querySelectorAll('[data-action="search-goto"]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      qs(SEL.globalSearchOverlay).classList.add('hidden');
      showView(this.dataset.view);
      var codigo = this.dataset.codigo;
      if (codigo) {
        var input = qs(SEL.productSearch);
        if (input) { input.value = codigo; renderProductSearch(); }
      }
    });
  });
}
