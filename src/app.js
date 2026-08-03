/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async function() {
  initConnectionMonitor();
  initSalesDivider();
  initModalDrag();
  initModalResize();
  initBsUsdConversion(SEL.movimientosMontoBs, SEL.movimientosMontoUsd);
  initBsUsdConversion(SEL.abonoMontoBs, SEL.abonoMonto);
  initBsUsdConversion(SEL.quickDebtMontoBs, SEL.quickDebtMonto);
  initTableScrollIndicators();
  initLoginGreeting();
  initHoverCard();
  initCompactToggle();
  window.addEventListener('beforeunload', function() { saveCartSnapshot(); });
  // Collapse all config cards by default
  qsa(SEL.configCardHeader).forEach(h => h.classList.add('collapsed'));

  // Auth
  qs(SEL.loginBtn).addEventListener('click', handleLogin);
  qs(SEL.loginUsername).addEventListener('keydown', e => {
    if (e.key === 'Enter') qs(SEL.loginPassword).focus();
  });
  qs(SEL.loginPassword).addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  qs(SEL.togglePassword)?.addEventListener('click', function() {
    const input = qs(SEL.loginPassword);
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    this.innerHTML = isPassword ? ICON.EYE_SLASH : ICON.EYE;
    this.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  qs(SEL.logoutBtn).addEventListener('click', handleLogout);
  qs(SEL.mobileLogoutBtn)?.addEventListener('click', handleLogout);

  // Changelog
  qs(SEL.changelogBtn)?.addEventListener('click', function() {
    showModal(qs(SEL.changelogModal));
  });
  qs(SEL.changelogClose)?.addEventListener('click', function() {
    closeModal(qs(SEL.changelogModal));
  });

  // Navigation
  qsa('.nav-btn').forEach(btn => {
    if (!btn.id) btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  /* More menu (mobile overflow) */
  qs(SEL.moreBtn).addEventListener('click', function(e) {
    e.stopPropagation();
    qs(SEL.moreMenu).classList.toggle('hidden');
  });
  qsa('.more-menu-item[data-view]').forEach(function(item) {
    item.addEventListener('click', function() {
      qs(SEL.moreMenu).classList.add('hidden');
      showView(this.dataset.view);
    });
  });
  qs(SEL.moreWrap).addEventListener('click', function(e) { e.stopPropagation(); });
  document.addEventListener('click', function() { qs(SEL.moreMenu).classList.add('hidden'); });
  // Close More menu on view change
  document.addEventListener('viewChanged', function() { qs(SEL.moreMenu).classList.add('hidden'); });

  /* Swipe-to-delete on cart items (mobile) */
  if ('ontouchstart' in window) {
    var cartSwipeState = { el: null, startX: 0 };
    qs(SEL.cartBody).addEventListener('touchstart', function(e) {
      var row = e.target.closest('tr');
      if (!row) return;
      cartSwipeState.el = row;
      cartSwipeState.startX = e.touches[0].clientX;
      row.classList.add('cart-item-swipe');
    }, { passive: true });
    qs(SEL.cartBody).addEventListener('touchmove', function(e) {
      if (!cartSwipeState.el) return;
      var dx = cartSwipeState.startX - e.touches[0].clientX;
      var pct = Math.min(dx / 120, 1);
      cartSwipeState.el.style.transform = 'translateX(-' + (pct * 80) + 'px)';
      cartSwipeState.el.classList.toggle('swiping', dx > 40);
    }, { passive: true });
    qs(SEL.cartBody).addEventListener('touchend', function() {
      if (cartSwipeState.el && cartSwipeState.el.classList.contains('swiping')) {
        var row = cartSwipeState.el;
        row.style.transform = '';
        row.classList.add('deleting');
        setTimeout(function() {
          var btn = row.querySelector('[data-action="remove-from-cart"]');
          if (btn) btn.click();
          row.classList.remove('deleting', 'swiping', 'cart-item-swipe');
        }, TIMING.SWIPE_DELETE_MS);
      } else {
        if (cartSwipeState.el) {
          cartSwipeState.el.style.transform = '';
          cartSwipeState.el.classList.remove('swiping', 'cart-item-swipe');
        }
      }
      cartSwipeState.el = null;
    }, { passive: true });
  }

  // Tasa
  qs(SEL.tasaInput).addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      handleTasaChange();
      showToast('Precios actualizados', 'info');
    }
  });
  qs(SEL.tasaInput).addEventListener('blur', handleTasaChange);
  qs(SEL.tasaFetchBtn)?.addEventListener('click', fetchTasaBcv);
  qs(SEL.syncDownloadBtn)?.addEventListener('click', async function() {
    await withLoadingModal('Descargando datos...', async function() {
      const msg = await invokeOrError(invoke('download_all'));
      if (msg === undefined) return;
      showToast(msg, 'success');
      await loadProductCache();
    });
  });
  qs(SEL.inventoryTasaBtn)?.addEventListener('click', openTasaHistorialModal);
  qs(SEL.tasaHistorialApply)?.addEventListener('click', applyTasaHistorial);
  qs(SEL.tasaHistorialClear)?.addEventListener('click', clearTasaHistorial);
  qs(SEL.tasaHistorialClose)?.addEventListener('click', function() { closeModal(qs(SEL.tasaHistorialModal)); });
  qs(SEL.tasaHistorialOkBtn)?.addEventListener('click', function() { closeModal(qs(SEL.tasaHistorialModal)); });

  // Search clear buttons
  document.addEventListener('click', e => {
    const btn = e.target.closest('.search-clear-btn');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.clear);
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });

  // Sales search
  qs(SEL.productSearch).addEventListener('input', handleProductSearch);
  qs(SEL.checkoutBtn).addEventListener('click', openPaymentModal);
  qs(SEL.cancelSaleBtn).addEventListener('click', async () => {
    if (cart.length === 0) return;
    const ok = await confirmModal('\u00bfEst\u00e1 seguro de cancelar la venta? El carrito se perder\u00e1.', 'Cancelar Venta', 'S\u00ed, cancelar');
    if (ok) clearCart();
  });
  qs(SEL.holdCartBtn)?.addEventListener('click', holdCart);
  qs(SEL.cartTabs)?.addEventListener('click', function(e) {
    var tab = e.target.closest('.cart-tab');
    if (tab) unholdCart(parseInt(tab.dataset.cartId));
  });

  // Event delegation: product search add-to-cart
  qs(SEL.productListContainer).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="add-to-cart"]');
    if (btn) addToCart(btn.dataset.codigo);
  });

  // Event delegation: toggle product favorite
  qs(SEL.productListContainer).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="toggle-favorito"]');
    if (btn) {
      e.stopPropagation();
      toggleProductFavorito(btn.dataset.codigo, btn);
    }
  });

  // Quantity shortcut: typing a number + Enter in the product search fixes the quantity for the next add
  qs(SEL.productSearch).addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const val = qs(SEL.productSearch).value.trim();
    const num = parseFloat(val);
    const isCodeMatch = productCache.some(p => p.codigo === val);
    if (!isNaN(num) && String(num) === val && !isCodeMatch) {
      pendingCartQty = Math.max(1, Math.round(num));
      qs(SEL.productSearch).value = '';
      qs(SEL.productSearch).placeholder = 'Cantidad: ' + pendingCartQty + ' — busca el producto o escribe c\u00f3digo';
      handleProductSearch();
      showToast('Cantidad fijada: ' + pendingCartQty, 'info');
    }
  });

  // Currency toggle for cart totals column
  const currencyToggle = qs(SEL.cartCurrencyToggle);
  if (currencyToggle) {
    currencyToggle.addEventListener('click', function() {
      cartShowBs = !cartShowBs;
      this.textContent = cartShowBs ? 'Bs.' : '$';
      this.classList.toggle('active', cartShowBs);
      this.title = cartShowBs ? 'Cambiar a USD' : 'Cambiar a Bs';
      renderCart();
      updateCartTotals();
    });
  }

  // Mobile cart FAB + backdrop (cart bottom-sheet)
  const cartFab = qs(SEL.cartFab);
  if (cartFab) cartFab.addEventListener('click', function(e) {
    e.stopPropagation();
    if (cart.length === 0) { showToast('El carrito est\u00e1 vac\u00edo', 'info'); return; }
    toggleCartSheet();
  });
  const cartBackdrop = qs(SEL.cartBackdrop);
  if (cartBackdrop) cartBackdrop.addEventListener('click', closeCartSheet);

  // Event delegation: cart qty input and remove
  qs(SEL.cartBody).addEventListener('focusin', e => {
    const input = e.target.closest('.cart-qty-input');
    if (input) input.select();
  });
  qs(SEL.cartBody).addEventListener('change', e => {
    const input = e.target.closest('.cart-qty-input');
    if (input) handleCartQtyInput(input.dataset.codigo, input.value);
  });
  qs(SEL.cartBody).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="remove-from-cart"]');
    if (btn) {
      e.stopPropagation();
      removeFromCart(btn.dataset.codigo);
      return;
    }
    const inc = e.target.closest('[data-action="qty-inc"]');
    if (inc) {
      const input = inc.parentElement.querySelector('.cart-qty-input');
      if (input) {
        input.value = Math.min(parseInt(input.value) + 1, parseInt(input.max));
        handleCartQtyInput(input.dataset.codigo, input.value);
      }
      return;
    }
    const dec = e.target.closest('[data-action="qty-dec"]');
    if (dec) {
      const input = dec.parentElement.querySelector('.cart-qty-input');
      if (input) {
        input.value = Math.max(parseInt(input.value) - 1, parseInt(input.min));
        handleCartQtyInput(input.dataset.codigo, input.value);
      }
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-price"]');
    if (editBtn) {
      cartEditPrice(editBtn.dataset.codigo);
      return;
    }
  });

  /* Cart inline price editor */
  function cartEditPrice(codigo) {
    var item = cart.find(function(i) { return i.codigo === codigo; });
    if (!item) return;
    var tr = qs(SEL.cartBody).querySelector('tr[data-codigo="' + codigo + '"]');
    if (!tr) return;
    var totalTd = tr.querySelector('.cart-item-total');
    if (!totalTd) return;
    var currentPrice = item.precio_usd;
    totalTd.innerHTML = '<input type="number" class="cart-price-edit" step="0.01" min="0" value="' + currentPrice.toFixed(2) + '">';
    var input = totalTd.querySelector('.cart-price-edit');
    input.focus();
    input.select();
    function commitPrice() {
      var val = parseFloat(input.value);
      if (!isNaN(val) && val >= 0) {
        item.precio_usd = val;
        renderCart();
        updateCheckoutBtn();
        saveCartSnapshot();
      } else {
        renderCart();
      }
    }
    input.addEventListener('blur', commitPrice);
    input.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
      if (ev.key === 'Escape') { ev.preventDefault(); renderCart(); }
    });
  }

  // Payment modal
  qs(SEL.paymentModalClose).addEventListener('click', closePaymentModal);
  qs(SEL.paymentCancelBtn).addEventListener('click', closePaymentModal);
  qs(SEL.mixtoAddRow).addEventListener('click', function() { addMixtoRow('mixto-items'); });
  qs(SEL.cambioRecibido)?.addEventListener('input', function() {
    const recibido = parseInput(this.value);
    const methodBtn = qs(SEL.paymentMethodActive);
    if (!methodBtn) return;
    const method = methodBtn.dataset.method;
    const total = cart.reduce((s, i) => s + i.cantidad * i.precio_usd, 0);
    const totalMoneda = method === METODO_EFECTIVO_BS ? totalBsRedondeado(total) : total;
    const cambioEl = qs(SEL.cambioResultado);
    const montoEl = qs(SEL.cambioMonto);
    if (recibido > 0) {
      if (recibido < totalMoneda) {
        montoEl.textContent = method === METODO_EFECTIVO_BS ? 'Faltan ' + formatBS(totalMoneda - recibido) : 'Faltan ' + formatUSD(totalMoneda - recibido);
        cambioEl.classList.remove('hidden');
        cambioEl.style.color = 'var(--danger)';
      } else if (recibido > totalMoneda && calcularVuelto) {
        const cambio = recibido - totalMoneda;
        const cambioTexto = method === METODO_EFECTIVO_BS ? formatBS(cambio) : formatUSD(cambio);
        montoEl.textContent = cambioTexto;
        cambioEl.classList.remove('hidden');
        cambioEl.style.color = '';
      } else {
        cambioEl.classList.add('hidden');
      }
    } else {
      cambioEl.classList.add('hidden');
    }
  });
  qs(SEL.abonoMixtoAddRow).addEventListener('click', function() { addMixtoRow('abono-mixto-items'); });
  qs(SEL.paymentConfirmBtn).addEventListener('click', confirmPayment);
  qsa('.payment-method-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
  });

  // Inventory
  let inventoryTimer = null;
  qs(SEL.inventorySearch).addEventListener('input', () => {
    clearTimeout(inventoryTimer);
    inventoryPage = 1;
    inventoryTimer = setTimeout(loadInventory, SEARCH_DEBOUNCE_MS);
  });
  qs(SEL.inventoryAddBtn).addEventListener('click', openNewProductModal);
  // Dropdown handler for inventory more-menu
  var invMoreBtn = qs('#inventory-more-menu')?.previousElementSibling;
  if (invMoreBtn && invMoreBtn.matches('[data-action="toggle-dropdown"]')) {
    invMoreBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleDropdown(this);
    });
  }
  qs(SEL.inventoryExportBtn).addEventListener('click', exportProducts);
  qs(SEL.inventoryImportBtn).addEventListener('click', openImportModal);
  qs(SEL.inventoryInariBtn).addEventListener('click', () => {
    var hoy = new Date().getDay();
    var allowed = INARI_DIAS.includes(hoy);
    if (!allowed && !showInari) {
      showToast('Inari solo está disponible de jueves a domingo', 'error');
      return;
    }
    showInari = !showInari;
    inventoryPage = 1;
    updateInariBtn();
    qs(SEL.inariSubcatBar).style.display = showInari ? 'flex' : 'none';
    if (!showInari) { inariSubcat = ''; }
    loadInventory();
  });

  // Inari subcategory click
  qs(SEL.inariSubcatBar).addEventListener('click', e => {
    const btn = e.target.closest('.inari-subcat-btn');
    if (!btn) return;
    qsa('.inari-subcat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    inariSubcat = btn.dataset.subcat || '';
    inventoryPage = 1;
    loadInventory();
  });

  // Create combo button
  qs(SEL.inariCreateComboBtn).addEventListener('click', openComboModal);

  // Event delegation: inventory dropdown and actions
  qs(SEL.inventoryBody).addEventListener('click', e => {
    const dropdownBtn = e.target.closest('[data-action="toggle-dropdown"]');
    if (dropdownBtn) {
      e.stopPropagation();
      toggleDropdown(dropdownBtn);
      return;
    }
    const detailBtn = e.target.closest('[data-action="show-product-detail"]');
    if (detailBtn) {
      showProductDetail(detailBtn.dataset.codigo);
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-product"]');
    if (editBtn) {
      editProduct(editBtn.dataset.codigo);
      return;
    }
    const histBtn = e.target.closest('[data-action="show-product-history"]');
    if (histBtn) {
      showProductHistory(histBtn.dataset.codigo, histBtn.dataset.nombre);
      return;
    }
    const priceHistBtn = e.target.closest('[data-action="show-price-history"]');
    if (priceHistBtn) {
      showPriceHistory(priceHistBtn.dataset.codigo, priceHistBtn.dataset.nombre);
      return;
    }
    const adjustBtn = e.target.closest('[data-action="open-stock-adjust"]');
    if (adjustBtn) {
      openStockAdjustModal(adjustBtn.dataset.codigo);
      return;
    }
    const inariBtn = e.target.closest('[data-action="toggle-inari"]');
    if (inariBtn) {
      const codigo = inariBtn.dataset.codigo;
      const esInari = inariBtn.dataset.inari === 'true';
      withButtonLock(inariBtn, async () => {
        try {
          await invoke('set_product_inari', { codigo, esInari });
          showToast(esInari ? 'Producto marcado como Inari' : 'Producto quitado de Inari', 'success');
          loadInventory();
        } catch (e) {
          showToast('Error: ' + e, 'error');
        }
      });
    }
  });

  // Double-click cart row to edit unit price (admin only)
  qs(SEL.cartBody).addEventListener('dblclick', function(e) {
    if (!currentUser || currentUser.rol !== ROL_ADMIN) return;
    if (e.target.closest('.cart-qty-input') || e.target.closest('.cart-qty-btn') || e.target.closest('.cart-remove-btn') || e.target.closest('[data-action="edit-price"]')) return;
    var tr = e.target.closest('tr');
    if (!tr) return;
    var codigo = tr.dataset.codigo;
    if (!codigo) return;
    cartEditPrice(codigo);
  });

  // Product modal
  qs(SEL.productModalClose).addEventListener('click', closeProductModal);
  qs(SEL.productCancelBtn).addEventListener('click', closeProductModal);
  qs(SEL.productSaveBtn).addEventListener('click', saveProduct);
  qs(SEL.productDeleteBtn).addEventListener('click', deleteProduct);
  qs(SEL.productPrecio).addEventListener('input', function() { applyComaAutomatica(this); });
  qs(SEL.productEsPesable).addEventListener('change', function() { updateProductFormLabels(this.checked); });

  // Combo modal
  qs(SEL.comboSaveBtn).addEventListener('click', saveCombo);
  qs(SEL.comboCancelBtn).addEventListener('click', closeComboModal);
  qs(SEL.comboModalClose).addEventListener('click', closeComboModal);
  qs(SEL.comboSearch).addEventListener('input', function() {
    clearTimeout(combosearchTimer);
    combosearchTimer = setTimeout(renderComboDisponibles, SEARCH_DEBOUNCE_MS);
  });

  // Product detail modal
  qs(SEL.productDetailClose).addEventListener('click', closeProductDetail);
  qs(SEL.productDetailOkBtn).addEventListener('click', closeProductDetail);

  // Stock adjust modal
  qs(SEL.stockAdjustClose).addEventListener('click', closeStockAdjustModal);
  qs(SEL.stockAdjustCancelBtn).addEventListener('click', closeStockAdjustModal);
  qs(SEL.stockAdjustConfirmBtn).addEventListener('click', confirmStockAdjust);

  // Creditos
  qs(SEL.creditoAddBtn).addEventListener('click', () => openCreditoModal());
  qs(SEL.clientModalClose).addEventListener('click', closeClientModal);
  qs(SEL.clientCancelBtn).addEventListener('click', closeClientModal);
  qs(SEL.clientSaveBtn).addEventListener('click', saveClient);

  // Temp clients history
  qs(SEL.tempHistoryBtn).addEventListener('click', openTempHistoryModal);
  qs(SEL.tempHistoryClose).addEventListener('click', closeTempHistoryModal);
  qs(SEL.tempHistoryOkBtn).addEventListener('click', closeTempHistoryModal);

  // Creditos search
  const creditosSearch = qs(SEL.creditosSearch);
  if (creditosSearch) {
    creditosSearch.addEventListener('input', applyCreditoFilter);
  }

  // Event delegation: creditos table
  qs(SEL.creditosBody).addEventListener('click', async e => {
    const dropdownBtn = e.target.closest('[data-action="toggle-dropdown"]');
    if (dropdownBtn) {
      e.stopPropagation();
      toggleDropdown(dropdownBtn);
      return;
    }
    const detailBtn = e.target.closest('[data-action="open-debt-detail"]');
    if (detailBtn) {
      openDebtDetail(parseInt(detailBtn.dataset.id));
      return;
    }
    const abonoBtn = e.target.closest('[data-action="open-abono"]');
    if (abonoBtn) {
      openAbonoModal(parseInt(abonoBtn.dataset.id));
      return;
    }
    const editBtn = e.target.closest('[data-action="edit-cliente"]');
    if (editBtn) {
      openCreditoModal({ id: parseInt(editBtn.dataset.id), nombre: editBtn.dataset.nombre });
      return;
    }
    const delBtn = e.target.closest('[data-action="delete-cliente"]');
    if (delBtn) {
      const id = parseInt(delBtn.dataset.id);
      const nombre = delBtn.dataset.nombre;
      const deuda = parseFloat(delBtn.dataset.deuda);
      let msg = '\u00bfEliminar a "' + nombre + '"? Esta acci\u00f3n no se puede deshacer.';
      if (deuda > 0) msg += ' Tiene una deuda de ' + formatUSD(deuda) + ' pendiente.';
      const ok = await confirmModal(msg, 'Eliminar Cliente', 'Eliminar');
      if (!ok) return;
      const res = await invokeOrError(invoke('delete_cliente', { clienteId: id }));
      if (res === undefined) return;
      showToast(res || 'Cliente eliminado');
      loadCreditos();
      return;
    }
    const toggleBtn = e.target.closest('[data-action="toggle-cliente-credito"]');
    if (toggleBtn) {
      const id = parseInt(toggleBtn.dataset.id);
      const activo = toggleBtn.dataset.activo === 'true';
      const ok = await confirmModal((activo ? 'Desactivar' : 'Activar') + ' cr\u00e9dito para este cliente?', 'Cambiar Cr\u00e9dito', (activo ? 'Desactivar' : 'Activar'));
      if (!ok) return;
      if (await invokeOrError(invoke('toggle_cliente_credito', { clienteId: id, activo: !activo })) === undefined) return;
      showToast('Cr\u00e9dito ' + (!activo ? 'activado' : 'desactivado'));
      loadCreditos();
      return;
    }
    const quickDebtBtn = e.target.closest('[data-action="open-quick-debt"]');
    if (quickDebtBtn) {
      const id = parseInt(quickDebtBtn.dataset.id);
      const nombre = quickDebtBtn.dataset.nombre;
      qs(SEL.quickDebtClienteNombre).textContent = nombre;
      qs(SEL.quickDebtMonto).value = '';
      qs(SEL.quickDebtMontoBs).value = '';
      qs(SEL.quickDebtMonto).dataset.clienteId = id;
      showModal(qs(SEL.quickDebtModal));
      return;
    }
  });

  // Quick debt
  qs(SEL.quickDebtConfirm)?.addEventListener('click', confirmQuickDebt);
  qs(SEL.quickDebtCancel)?.addEventListener('click', () => closeModal(qs(SEL.quickDebtModal)));
  qs(SEL.quickDebtClose)?.addEventListener('click', () => closeModal(qs(SEL.quickDebtModal)));

  // Client select dropdown
  qs(SEL.clienteSelectBtn)?.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleClientDropdown();
  });
  // Cashier
  qs(SEL.openCashierBtn).addEventListener('click', handleOpenCashier);
  qs(SEL.closeCashierBtn).addEventListener('click', openCloseCashier);
  qs(SEL.closeCashierClose).addEventListener('click', closeCloseCashier);
  qs(SEL.closeCashierCancelBtn).addEventListener('click', closeCloseCashier);
  qs(SEL.closeCashierConfirmBtn).addEventListener('click', confirmCloseCashier);
  qs(SEL.closeReportClose).addEventListener('click', closeReport);
  qs(SEL.closeReportOkBtn).addEventListener('click', closeReport);

  // Event delegation: close report print button
  qs(SEL.closeReportBody).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="print-close-report"]');
    if (btn) printCloseReport();
  });

  /* ========== USER MANAGEMENT ========== */
  const createUserBtn = qs(SEL.createUserBtn);
  if (createUserBtn) createUserBtn.addEventListener('click', handleCreateUser);
  const userListRefreshBtn = qs(SEL.userListRefreshBtn);
  if (userListRefreshBtn) userListRefreshBtn.addEventListener('click', loadUserList);
  const resetUsersBtn = qs(SEL.resetUsersBtn);
  if (resetUsersBtn) resetUsersBtn.addEventListener('click', async function() {
    const ok = await confirmModal('\u00bfEliminar TODOS los usuarios y dejar solo superadmin? Esta acci\u00f3n no se puede deshacer.', 'Reset Usuarios', 'Resetear');
    if (!ok) return;
    const msg = await invokeOrError(invoke('reset_usuarios'));
    if (msg === undefined) return;
    showToast(msg);
    loadUserList();
  });
  document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('.delete-user-btn');
    if (delBtn) {
      withButtonLock(delBtn, async function() {
        const id = parseInt(delBtn.dataset.id);
        const ok = await confirmModal('\u00bfEliminar este usuario?', 'Eliminar Usuario', 'Eliminar');
        if (!ok) return;
        const msg = await invokeOrError(invoke('delete_usuario', { usuarioId: id }));
        if (msg === undefined) return;
        showToast(msg);
        loadUserList();
      });
    }
  });

  /* ========== COLLAPSIBLE CARDS ========== */
  qs(SEL.viewConfig).addEventListener('click', function(e) {
    const header = e.target.closest('.config-card-header');
    if (header) header.classList.toggle('collapsed');
  });
  qs(SEL.viewReports)?.addEventListener('click', function(e) {
    const header = e.target.closest('.config-card-header');
    if (header) header.classList.toggle('collapsed');
  });
  qs(SEL.viewSync)?.addEventListener('click', function(e) {
    const header = e.target.closest('.config-card-header');
    if (header) header.classList.toggle('collapsed');
  });

  /* ========== CHANGE PASSWORD ========== */
  const changePwdBtn = qs(SEL.changePwdBtn);
  if (changePwdBtn) changePwdBtn.addEventListener('click', handleChangePassword);

  /* ========== ADMIN CHANGE PASSWORD MODAL ========== */
  let adminPwdUserId = null;
  const adminPwdModal = qs(SEL.adminPwdModal);
  const adminPwdInput = qs(SEL.adminPwdInput);
  function openAdminPwdModal(id, username) {
    adminPwdUserId = id;
    qs(SEL.adminPwdUserInfo).textContent = 'Cambiar contrase\u00f1a de: ' + escapeHtml(username);
    adminPwdInput.value = '';
    showModal(adminPwdModal);
    setTimeout(function() { adminPwdInput.focus(); }, TIMING.FOCUS_DELAY_MS);
  }
  function closeAdminPwdModal() { adminPwdUserId = null; closeModal(adminPwdModal); }
  qs(SEL.adminPwdModalClose).addEventListener('click', closeAdminPwdModal);
  qs(SEL.adminPwdCancelBtn).addEventListener('click', closeAdminPwdModal);
  qs(SEL.adminPwdSaveBtn).addEventListener('click', async function() {
    const pwd = adminPwdInput.value.trim();
    if (!pwd || pwd.length < MIN_PASSWORD_LEN) { showToast(passwordTooShortMsg(), 'error'); return; }
    if (await invokeOrError(invoke('admin_change_password', { usuarioId: adminPwdUserId, newPassword: pwd })) === undefined) return;
    showToast('Contrase\u00f1a cambiada exitosamente');
    closeAdminPwdModal();
  });
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.admin-pwd-btn');
    if (btn) {
      openAdminPwdModal(parseInt(btn.dataset.id), btn.dataset.username);
    }
  });

  /* ========== BACKUP DATABASE ========== */
  const backupBtn = qs(SEL.backupDbBtn);
  if (backupBtn) {
    backupBtn.addEventListener('click', async function() {
      try {
        backupBtn.disabled = true;
        backupBtn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Guardando...';
        const msg = await invoke('backup_database', { destPath: '' });
        showToast(msg);
      } catch (e) {
        showToast('Error: ' + e, 'error');
      } finally {
        backupBtn.disabled = false;
        backupBtn.innerHTML = '<i class="nf nf-fa-save"></i> Descargar respaldo';
      }
    });
  }

  /* Restore backup */
  qs(SEL.restoreBackupBtn).addEventListener('click', async function() {
    try {
      var result = await invoke('plugin:dialog|open', {
        filters: [{ name: 'Backup cifrado', extensions: ['enc'] }],
        multiple: false,
      });
      if (!result) return;
      this.disabled = true;
      this.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Restaurando...';
      const msg = await invoke('restore_backup', { backupPath: result });
      showToast(msg, 'warning');
    } catch (e) {
      showToast('Error: ' + e, 'error');
    } finally {
      this.disabled = false;
      this.innerHTML = '<i class="nf nf-fa-upload"></i> Restaurar';
    }
  });

  /* Show backup key */
  qs(SEL.showBackupKeyBtn).addEventListener('click', async function() {
    try {
      const key = await invoke('get_backup_key');
      await navigator.clipboard.writeText(key);
      showToast('Clave de cifrado copiada al portapapeles', 'info');
    } catch (e) {
      showToast('Error: ' + e, 'error');
    }
  });

  /* ========== SUPABASE SYNC ========== */
  /* Guardar URL y Key al cambiar */
  document.addEventListener('change', function(e) {
    if (e.target.id === 'sync-url') {
      invoke('set_config_value', { key: CFG_SUPABASE_URL, value: e.target.value }).catch(() => {});
    }
    if (e.target.id === 'sync-key') {
      invoke('set_config_value', { key: CFG_SUPABASE_KEY, value: e.target.value }).catch(() => {});
    }
  });

  /* Ver ID del dispositivo */
  const viewIdBtn = qs(SEL.viewDeviceIdBtn);
  if (viewIdBtn) {
    viewIdBtn.addEventListener('click', async function() {
      const display = qs(SEL.deviceIdDisplay);
      if (display && display.style.display !== 'none') {
        display.style.display = 'none';
        return;
      }
      const stats = await invokeOrError(invoke('get_sync_stats'));
      if (stats === undefined) return;
      if (stats.dispositivo_id) {
        if (display) {
          display.textContent = 'ID: ' + stats.dispositivo_id;
          display.style.display = 'block';
        }
      } else {
        showToast('No hay dispositivo registrado', 'error');
      }
    });
  }

  /* Subir productos */
  /* Conflictos: botones de resolución delegados */
  qs(SEL.conflictModal)?.addEventListener('click', async function(e) {
    const btn = e.target.closest('.conflict-keep-local, .conflict-use-remote');
    if (!btn) return;
    const id = parseInt(btn.dataset.id);
    const useRemote = btn.classList.contains('conflict-use-remote');
    btn.disabled = true;
    btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i>';
    const msg = await invokeOrError(invoke('resolve_conflicto', { conflictoId: id, useRemote }));
    if (msg === undefined) { btn.disabled = false; btn.innerHTML = '<i class="nf nf-fa-bolt"></i> ' + (useRemote ? 'Usar remoto' : 'Mantener local'); return; }
    showToast(msg);
    openConflictModal();
    loadConflictCount();
  });

  /* Ver conflictos */
  qs(SEL.viewConflictsBtn)?.addEventListener('click', openConflictModal);

  /* Refrescar dispositivos vinculados */
  qs(SEL.refreshDevicesBtn)?.addEventListener('click', loadLinkedDevices);

  /* Sync all progress UI */
  const syncProgressModal = qs(SEL.syncProgressModal);
  const syncProgressText = qs(SEL.syncProgressText);
  const syncProgressBar = qs(SEL.syncProgressBar);
  function showSyncProgress() {
    syncProgressModal.classList.remove('hidden');
    void syncProgressModal.offsetHeight;
  }
  function hideSyncProgress() { syncProgressModal.classList.add('hidden'); syncProgressBar.style.width = '0%'; }
  function updateSyncProgress(step, current, total) {
    const pct = Math.round((current / total) * 100);
    syncProgressText.textContent = step + ' (' + current + '/' + total + ')';
    syncProgressBar.style.width = pct + '%';
  }
  window.__TAURI__.event.listen('sync-progress', function(e) {
    var d = e.payload;
    updateSyncProgress(d.step, d.current, d.total);
  });

  async function runSyncCommand(opts) {
    showSyncProgress();
    updateSyncIndicator(opts.label, true);
    await forcePaint();
    try {
      var r = await opts.cmd();
      hideSyncProgress();
      showToast(opts.successMsg || r || 'Sincronizaci\u00f3n completa');
      if (opts.onSuccess) opts.onSuccess();
      loadSyncStats();
    } catch (e) {
      hideSyncProgress();
      updateSyncIndicator('Error en sync', false);
      showToast('Error: ' + e, 'error');
      loadSyncStats();
    }
  }

  /* Subir todo */
  qs(SEL.uploadAllBtn)?.addEventListener('click', async function() {
    const ok = await confirmModal('¿Subir productos, clientes y ventas a Supabase?', 'Subir todo', 'Subir');
    if (!ok) return;
    runSyncCommand({
      cmd: () => invoke('upload_all'),
      label: 'Subiendo...',
      successMsg: 'Subida completa',
      onSuccess: () => { loadConflictCount(); }
    });
  });

  /* Descargar todo */
  qs(SEL.downloadAllBtn)?.addEventListener('click', async function() {
    const ok = await confirmModal('¿Descargar productos, clientes y ventas desde Supabase?', 'Descargar todo', 'Descargar');
    if (!ok) return;
    runSyncCommand({
      cmd: () => invoke('download_all'),
      label: 'Descargando...',
      successMsg: 'Descarga completa',
      onSuccess: () => { loadProductCache(); loadConflictCount(); }
    });
  });

  /* Subir usuarios */
  qs(SEL.uploadUsuariosBtn)?.addEventListener('click', async function() {
    var ok = await confirmModal('¿Subir usuarios a Supabase?', 'Subir usuarios', 'Subir');
    if (!ok) return;
    runSyncCommand({ cmd: () => invoke('upload_usuarios'), label: 'Subiendo usuarios...' });
  });

  /* Descargar usuarios */
  qs(SEL.downloadUsuariosBtn)?.addEventListener('click', async function() {
    var ok = await confirmModal('¿Descargar usuarios de otros dispositivos desde Supabase?', 'Descargar usuarios', 'Descargar');
    if (!ok) return;
    runSyncCommand({ cmd: () => invoke('download_usuarios'), label: 'Descargando usuarios...' });
  });

  /* Sincronizar todo */
  qs(SEL.syncAllBtn)?.addEventListener('click', function() {
    withButtonLock(this, async function() {
      const ok = await confirmModal('\u00bfSincronizar completamente (subir y descargar todo) con Supabase?', 'Sincronizar todo', 'Sincronizar');
      if (!ok) return;
      runSyncCommand({
        cmd: () => invoke('sync_all'),
        label: 'Sincronizando...',
        successMsg: 'Sincronizaci\u00f3n completa',
        onSuccess: () => { loadProductCache(); loadConflictCount(); }
      });
    });
  });

  /* Probar conexión */
  qs(SEL.testConnectionBtn)?.addEventListener('click', async function() {
    var statusEl = qs(SEL.connectionStatus);
    if (!statusEl) return;
    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Probando...';
statusEl.style.color = cssVar('--text-secondary');
    statusEl.title = 'Probando...';
    await withLoadingModal('Probando conexión con Supabase...', async function() {
      try {
        var ok = await invoke('test_supabase_connection');
        if (ok) {
          statusEl.style.color = cssVar('--success');
          statusEl.title = 'Conectado';
          showToast('Conexión exitosa');
        } else {
          statusEl.style.color = cssVar('--danger');
          statusEl.title = 'Error de conexión';
          showToast('No se pudo conectar a Supabase', 'error');
        }
      } catch (e) {
        statusEl.style.color = cssVar('--danger');
        statusEl.title = 'Error: ' + e;
        showToast('Error: ' + e, 'error');
      }
    });
    btn.disabled = false;
    btn.innerHTML = '<i class="nf nf-fa-plug"></i> Probar conexión';
    loadSyncStats();
  });

  /* Cerrar modal conflictos */
  qs(SEL.conflictModalClose)?.addEventListener('click', function() { closeModal(qs(SEL.conflictModal)); });
  qs(SEL.conflictCloseBtn)?.addEventListener('click', function() { closeModal(qs(SEL.conflictModal)); });

  /* ========== REPORTS ========== */
  const reportSearchBtn = qs(SEL.reportSearchBtn);
  if (reportSearchBtn) reportSearchBtn.addEventListener('click', function() { loadReportsAndTopProducts(true); });
  [SEL.reportStartDate, SEL.reportEndDate].forEach(function(sel) {
    const el = qs(sel);
    if (el) el.addEventListener('change', setDefaultReportDates);
  });
  const topLimitSelect = qs(SEL.topProductsLimit);
  if (topLimitSelect) topLimitSelect.addEventListener('change', loadTopProducts);
  qs(SEL.reportPrevBtn).addEventListener('click', function() { if (reportPage > 1) { reportPage--; loadReportsAndTopProducts(); } });
  qs(SEL.reportNextBtn).addEventListener('click', function() { reportPage++; loadReportsAndTopProducts(); });

  /* ========== EXPORT REPORT ========== */
  const exportBtn = qs(SEL.reportExportBtn);
  if (exportBtn) exportBtn.addEventListener('click', handleExportReport);
  const pdfBtn = qs(SEL.reportPdfBtn);
  if (pdfBtn) pdfBtn.addEventListener('click', handleExportReportPdf);

  /* ========== PRECIO HISTORY MODAL ========== */
  qs(SEL.precioHistoryClose)?.addEventListener('click', function() { closeModal(qs(SEL.precioHistoryModal)); });
  qs(SEL.precioHistoryOkBtn)?.addEventListener('click', function() { closeModal(qs(SEL.precioHistoryModal)); });

  /* ========== PRODUCT HISTORY MODAL ========== */
  qs(SEL.productHistoryModalClose)?.addEventListener('click', function() { closeModal(qs(SEL.productHistoryModal)); });
  qs(SEL.productHistoryOkBtn)?.addEventListener('click', function() { closeModal(qs(SEL.productHistoryModal)); });

  /* ========== VOID SALE (delegation on daily sales table) ========== */
  qs(SEL.dailySalesBody).addEventListener('click', function(e) {
    const btn = e.target.closest('.void-sale-btn');
    if (btn) handleVoidSale(parseInt(btn.dataset.id), btn);
    const detailBtn = e.target.closest('.sale-detail-btn');
    if (detailBtn) showSaleDetail(parseInt(detailBtn.dataset.id), detailBtn);
  });

  /* ========== SALE DETAIL MODAL ========== */
  qs(SEL.saleDetailClose)?.addEventListener('click', function() { closeModal(qs(SEL.saleDetailModal)); });
  qs(SEL.saleDetailOkBtn)?.addEventListener('click', function() { closeModal(qs(SEL.saleDetailModal)); });
  qs(SEL.saleDetailList)?.addEventListener('click', function(e) {
    const btn = e.target.closest('.void-item-btn');
    if (btn) handleVoidItem(parseInt(btn.dataset.ventaId), parseInt(btn.dataset.detalleId));
  });
  qs(SEL.saleDetailShareBtn)?.addEventListener('click', function() {
    var ventaId = parseInt(this.dataset.ventaId);
    shareReceiptById(ventaId);
  });

  /* ========== VIEW-SPECIFIC LOAD ========== */
  function observeView(viewEl, callback) {
    if (!viewEl) return;
    const obs = new MutationObserver(function() {
      if (viewEl.classList.contains('active')) callback();
    });
    obs.observe(viewEl, { attributes: true, attributeFilter: ['class'] });
    return obs;
  }
  // Reports: set default dates + dashboard on show
  observeView(qs(SEL.viewReports), function() { setDefaultReportDates(); loadDashboard(); });
  // Config: load user list on show
  observeView(qs(SEL.viewConfig), function() { loadUserList(); });

  // Go to reports (cashier header button)
  const gotoReportsBtn = qs(SEL.gotoReportsBtn);
  if (gotoReportsBtn) gotoReportsBtn.addEventListener('click', function() { showView(VIEW.REPORTS); });

  // Historial cierres
  qs(SEL.historialCierresBtn).addEventListener('click', openHistorialCierres);
  qs(SEL.historialCierresClose).addEventListener('click', closeHistorialCierres);
  qs(SEL.historialCierresOkBtn).addEventListener('click', closeHistorialCierres);

  // Event delegation: historial cierres list
  qs(SEL.historialCierresList).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="show-cierre-detalle"]');
    if (btn) showCierreDetalle(parseInt(btn.dataset.id));
  });

  qs(SEL.historialCierreDetalleClose).addEventListener('click', closeHistorialDetalle);
  qs(SEL.historialCierreDetalleOkBtn).addEventListener('click', closeHistorialDetalle);

  // Movimientos caja
  qs(SEL.movimientosBtn)?.addEventListener('click', openMovimientosModal);
  qs(SEL.movimientosClose)?.addEventListener('click', function() { closeModal(qs(SEL.movimientosModal)); });
  qs(SEL.movimientosSaveBtn)?.addEventListener('click', saveMovimiento);
  qs(SEL.movimientosTasaRefresh)?.addEventListener('click', function() { refreshTasaFromInfo('movimientos'); });
  qs(SEL.abonoTasaRefresh)?.addEventListener('click', function() { refreshTasaFromInfo('abono'); });

  // Debt detail
  qs(SEL.debtDetailClose).addEventListener('click', closeDebtDetail);
  qs(SEL.debtDetailOkBtn).addEventListener('click', closeDebtDetail);

  // Abono modal
  qs(SEL.abonoClose).addEventListener('click', closeAbonoModal);
  qs(SEL.abonoCancelBtn).addEventListener('click', closeAbonoModal);
  qs(SEL.abonoConfirmBtn).addEventListener('click', confirmAbono);
  qs(SEL.abonoMonto).addEventListener('input', function() {
    updateAbonoSaldoRestante();
    if (qs(SEL.abonoMetodoBtnActive)?.dataset.method === METODO_MIXTO) distributeMixto('abono-mixto-items');
  });
  qsa('.abono-metodo-btn').forEach(btn => {
    btn.addEventListener('click', () => selectAbonoMethod(btn));
  });

  // Theme buttons
  qsa('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => handleThemeClick(btn.dataset.theme));
  });

  // Modal backdrop click
  qsa('.modal').forEach(m => {
    if (m.id === 'calculator-modal') return; // handled by closeCalculator
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
  });

  // Sound config
  const soundToggle = qs(SEL.soundToggle);
  const soundVolumeRange = qs(SEL.soundVolume);
  if (soundToggle) {
    soundToggle.addEventListener('change', function() {
      soundEnabled = this.checked;
      setUserConfig(CFG_SONIDO_HABILITADO, this.checked ? SOUND_ENABLED : SOUND_DISABLED).catch(e => showToast('Error al guardar configuración de sonido', 'error'));
    });
  }
  if (soundVolumeRange) {
    soundVolumeRange.addEventListener('input', function() {
      soundVolume = parseInt(this.value) / 100;
      setUserConfig(CFG_SONIDO_VOLUMEN, String(this.value)).catch(e => showToast('Error al guardar configuración de sonido', 'error'));
    });
  }
  const sidebarToggle = qs(SEL.sidebarAutoHideToggle);
  if (sidebarToggle) {
    if (IS_ANDROID) {
      sidebarToggle.closest('.config-row').style.display = 'none';
    } else {
      sidebarToggle.addEventListener('change', function() {
        setSidebarAutoHide(this.checked);
        setUserConfig(CFG_SIDEBAR_AUTO_HIDE, this.checked ? 'true' : 'false').catch(e => showToast('Error al guardar configuración', 'error'));
      });
    }
  }

  // Confirmar venta toggle
  const confirmarToggle =   qs(SEL.confirmarVentaToggle);
  if (confirmarToggle) {
    confirmarToggle.addEventListener('change', function() {
      setUserConfig(CFG_CONFIRMAR_VENTA, this.checked ? '1' : '0').catch(e => showToast('Error al guardar configuración', 'error'));
    });
  }

  // Fullscreen toggle
  const fullscreenToggle = qs(SEL.fullscreenToggle);
  if (fullscreenToggle) {
    fullscreenToggle.addEventListener('change', function() {
      toggleFullscreen();
    });
    document.addEventListener('fullscreenchange', function() {
      fullscreenToggle.checked = !!document.fullscreenElement;
    });
  }

  // Font size controls
  const fontIncBtn = qs(SEL.fontIncBtn);
  const fontDecBtn = qs(SEL.fontDecBtn);
  if (fontIncBtn) {
    fontIncBtn.addEventListener('click', function() {
      applyFontSize(currentFontPct + FONT.SIZE_STEP);
      saveFontSize(currentFontPct);
    });
  }
  if (fontDecBtn) {
    fontDecBtn.addEventListener('click', function() {
      applyFontSize(currentFontPct - FONT.SIZE_STEP);
      saveFontSize(currentFontPct);
    });
  }
  loadFontSize();

  // Coma automática
  const comaToggle = qs(SEL.comaAutomaticaToggle);
  function updatePrecioInputType() {
    const input = qs(SEL.productPrecio);
    if (comaAutomaticaEnabled) {
      input.type = 'text';
      input.inputMode = 'decimal';
    } else {
      input.type = 'number';
      input.step = 'any';
    }
  }
  if (comaToggle) {
    comaToggle.addEventListener('change', async function() {
      comaAutomaticaEnabled = this.checked;
      updatePrecioInputType();
      try { await setUserConfig(CFG_COMA_AUTOMATICA, this.checked ? '1' : '0'); } catch (e) {}
    });
  }
  const vueltoToggle = qs(SEL.calcularVueltoToggle);
  if (vueltoToggle) {
    vueltoToggle.addEventListener('change', async function() {
      calcularVuelto = this.checked;
      try { await setUserConfig(CFG_CALCULAR_VUELTO, this.checked ? '1' : '0'); } catch (e) {}
    });
  }
  const redondeoToggle = qs(SEL.redondeoBsToggle);
  if (redondeoToggle) {
    redondeoToggle.addEventListener('change', async function() {
      redondeoBs = this.checked;
      try { await setUserConfig(CFG_REDONDEO_BS, this.checked ? '1' : '0'); } catch (e) {}
    });
  }
  const redondeoTotalToggle = qs(SEL.redondeoTotalToggle);
  if (redondeoTotalToggle) {
    redondeoTotalToggle.addEventListener('change', async function() {
      redondeoTotal = this.checked;
      try { await setUserConfig(CFG_REDONDEO_TOTAL, this.checked ? '1' : '0'); } catch (e) {}
    });
  }

  // Load saved sound config
  try {
    const savedSound = await getUserConfig(CFG_SONIDO_HABILITADO);
    if (savedSound !== null && savedSound !== undefined) {
      soundEnabled = savedSound === SOUND_ENABLED || savedSound === true;
      if (soundToggle) soundToggle.checked = soundEnabled;
    }
    const savedVol = await getUserConfig(CFG_SONIDO_VOLUMEN);
    if (savedVol !== null && savedVol !== undefined) {
      soundVolume = parseInt(savedVol) / 100 || 0.5;
      if (soundVolumeRange) soundVolumeRange.value = soundVolume * 100;
    }
  } catch (e) {}

  // Load coma automática config
  try {
    const savedComa = await getUserConfig(CFG_COMA_AUTOMATICA);
    comaAutomaticaEnabled = savedComa === '1' || savedComa === true;
    if (comaToggle) comaToggle.checked = comaAutomaticaEnabled;
    updatePrecioInputType();
  } catch (e) {}

  // Load calcular vuelto config
  try {
    const savedVuelto = await getUserConfig(CFG_CALCULAR_VUELTO);
    calcularVuelto = savedVuelto !== '0';
    if (vueltoToggle) vueltoToggle.checked = calcularVuelto;
  } catch (e) {}

  // Load redondeo Bs config
  try {
    const savedRedondeo = await getUserConfig(CFG_REDONDEO_BS);
    redondeoBs = savedRedondeo === '1' || savedRedondeo === true;
    if (redondeoToggle) redondeoToggle.checked = redondeoBs;
  } catch (e) {}

  // Load redondeo total config
  try {
    const savedTotal = await getUserConfig(CFG_REDONDEO_TOTAL);
    redondeoTotal = savedTotal === '1' || savedTotal === true;
    if (redondeoTotalToggle) redondeoTotalToggle.checked = redondeoTotal;
  } catch (e) {}

  // Load saved theme on startup
  var savedTheme;
  try { savedTheme = localStorage.getItem(CFG_TEMA); } catch (_) {}
  if (!savedTheme) {
    try { savedTheme = await getUserConfig(CFG_TEMA); } catch (_) {}
  }
  if (savedTheme) applyTheme(savedTheme);

  // Animations toggle
  const animToggle = qs(SEL.animationsToggle);
  function setAnimations(enabled) {
    document.body.classList.toggle('no-animations', !enabled);
  }
  if (animToggle) {
    animToggle.addEventListener('change', function() {
      setAnimations(this.checked);
      setUserConfig(CFG_ANIMACIONES, this.checked ? '1' : '0').catch(e => showToast('Error al guardar configuraci\u00f3n', 'error'));
    });
  }

  // Load animations config
  try {
    const val = await getUserConfig(CFG_ANIMACIONES);
    const enabled = val !== '0';
    if (animToggle) animToggle.checked = enabled;
    setAnimations(enabled);
  } catch (e) {}

  // Load confirmar venta config
  try {
    const val = await getUserConfig(CFG_CONFIRMAR_VENTA);
    const toggle =   qs(SEL.confirmarVentaToggle);
    if (toggle) toggle.checked = val === '1';
  } catch (e) {}

  // Load IA config
  const iaToggle =   qs(SEL.iaToggle);
  function setIaEnabled(enabled) {
    qs(SEL.chatFab).style.display = enabled ? '' : 'none';
    if (!enabled) {
      const panel = qs(SEL.chatPanel);
      if (panel && !panel.classList.contains('hidden')) panel.classList.add('hidden');
    }
  }
  if (iaToggle) {
    iaToggle.addEventListener('change', function() {
      setIaEnabled(this.checked);
      setUserConfig(CFG_IA_HABILITADO, this.checked ? '1' : '0').catch(() => {});
    });
  }
  try {
    const val = await getUserConfig(CFG_IA_HABILITADO);
    const enabled = val !== '0';
    if (iaToggle) iaToggle.checked = enabled;
    setIaEnabled(enabled);
  } catch (e) {}

  // Hover card toggle
  const hoverToggle = qs(SEL.hoverCardToggle);
  if (hoverToggle) {
    hoverToggle.addEventListener('change', function() {
      setUserConfig(CFG_HOVER_CARD, this.checked ? '1' : '0').catch(() => {});
    });
    try {
      const val = await getUserConfig(CFG_HOVER_CARD);
      hoverToggle.checked = val !== '0';
    } catch (e) {}
  }

  // Modal drag toggle
  const dragToggle = qs(SEL.modalDragToggle);
  if (dragToggle) {
    dragToggle.addEventListener('change', function() {
      modalDragEnabled = this.checked;
      setUserConfig(CFG_MODAL_DRAG, this.checked ? '1' : '0').catch(() => {});
    });
    try {
      const val = await getUserConfig(CFG_MODAL_DRAG);
      var dragOn = val !== '0';
      modalDragEnabled = dragOn;
      if (dragToggle) dragToggle.checked = dragOn;
    } catch (e) {}
  }

  // Inari config toggle
  const inariToggle = qs(SEL.inariConfigToggle);
  function applyInariConfig(active) {
    var dayOk = active && INARI_DIAS.includes(new Date().getDay());
    showInari = dayOk;
    updateInariBtn();
  }
  if (inariToggle) {
    inariToggle.addEventListener('change', function() {
      const active = this.checked;
      invoke('set_config_value', { key: 'inari_activo', value: active ? '1' : '0' }).catch(() => {});
      applyInariConfig(active);
    });
  }
  try {
    const val = await invoke('get_config_value', { key: 'inari_activo' });
    const enabled = val === '1';
    if (inariToggle) inariToggle.checked = enabled;
    applyInariConfig(enabled);
  } catch (e) {}

  // Load history cleanup config
  try {
    const days = await invoke('get_config_value', { key: CFG_HISTORIAL_LIMPIEZA_DIAS });
    const input = qs(SEL.historialLimpiezaDias);
    if (input) {
      input.value = parseInt(days) || 0;
      updateHistoryCleanupStatus(parseInt(days) || 0);
    }
  } catch (e) {}
  const histSaveBtn = qs(SEL.historialLimpiezaSave);
  if (histSaveBtn) {
    histSaveBtn.addEventListener('click', async () => {
      const input = qs(SEL.historialLimpiezaDias);
      let val = parseInt(input.value);
      if (isNaN(val) || val < 0) val = 0;
      if (val > HISTORIAL_MAX_DAYS) val = HISTORIAL_MAX_DAYS;
      input.value = val;
      if (await invokeOrError(invoke('set_config_value', { key: CFG_HISTORIAL_LIMPIEZA_DIAS, value: String(val) })) === undefined) return;
      updateHistoryCleanupStatus(val);
      showToast('Configuraci\u00f3n guardada');
    });
  }

  // Load backup retention config
  try {
    const maxBackups = await invoke('get_config_value', { key: CFG_MAX_BACKUPS });
    const backupInput = qs(SEL.backupMaxInput);
    if (backupInput) backupInput.value = (parseInt(maxBackups) || DEFAULT_MAX_BACKUPS);
  } catch (e) {}
  const backupSaveBtn = qs(SEL.backupMaxSave);
  if (backupSaveBtn) {
    backupSaveBtn.addEventListener('click', async () => {
      const input = qs(SEL.backupMaxInput);
      let val = parseInt(input.value);
      if (isNaN(val) || val < 0) val = 0;
      if (val > 100) val = 100;
      input.value = val;
      if (await invokeOrError(invoke('set_config_value', { key: CFG_MAX_BACKUPS, value: String(val) })) === undefined) return;
      showToast('Configuraci\u00f3n guardada');
    });
  }

  // Manual clear history buttons
  for (const btn of [qs(SEL.auditClearBtn), qs(SEL.auditClearConfigBtn)]) {
    if (btn) {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('\u00bfEliminar todo el historial de auditor\u00eda? Esta acci\u00f3n no se puede deshacer.', 'Limpiar Historial', 'Eliminar todo');
        if (!ok) return;
        if (await invokeOrError(invoke('clear_audit')) === undefined) return;
        showToast('Historial eliminado');
        playSound('remove');
        qs(SEL.auditBody).innerHTML = emptyTableRow(4, '<i class="nf nf-fa-history"></i>', 'Historial vac\u00edo', 'No hay registros de auditor\u00eda');
        qs(SEL.auditLoadMore).classList.add('hidden');
        disconnectAuditObserver();
      });
    }
  }

  // Ensure sales panels are visible on desktop
  var lastPhoneBreakpoint = window.innerWidth <= BREAKPOINT.PHONE;
  window.addEventListener('resize', function() {
    var isPhone = window.innerWidth <= BREAKPOINT.PHONE;
    if (isPhone !== lastPhoneBreakpoint) {
      lastPhoneBreakpoint = isPhone;
      renderProductSearch();
      if (!isPhone) closeCartSheet();
    }
    if (window.innerWidth > BREAKPOINT.DESKTOP) {
      document.querySelectorAll(SEL.salesLeftCenter).forEach(el => el.style.display = '');
    }
  });

  // Audit load more
  qs(SEL.auditLoadMore).addEventListener('click', loadAuditMore);

  // Device registration
  qs(SEL.regDeviceBtn).addEventListener('click', handleDeviceRegister);

  // Check if device is already registered
  try {
    const devId = await invoke('get_config_value', { key: CFG_DISPOSITIVO_ID });
    if (devId) {
      qs(SEL.deviceRegScreen).style.display = 'none';
      qs(SEL.loginScreen).style.display = 'flex';
    } else {
      qs(SEL.deviceRegScreen).style.display = 'flex';
    }
  } catch (_) {
    qs(SEL.deviceRegScreen).style.display = 'flex';
  }

  // Restore remembered username
  const savedUser = localStorage.getItem('recordar_usuario');
  if (savedUser) {
    qs(SEL.loginUsername).value = savedUser;
    qs(SEL.rememberMe).checked = true;
    qs(SEL.loginPassword).focus();
  }

  // Swipe between main views on mobile
  var MAIN_VIEWS = [VIEW.SALES, VIEW.INVENTORY, VIEW.CREDITOS, VIEW.CASHIER];
  var swipeStartX = 0, swipeStartY = 0, swipeDistX = 0, swiping = false;
  function isSwipableTarget(el) {
    while (el && el !== document.body) {
      if (el.classList && (
        el.classList.contains('modal') ||
        el.classList.contains('dropdown-menu') ||
        el.classList.contains('more-menu') ||
        el.classList.contains('custom-select-menu')
      )) return false;
      if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return false;
      if (el.tagName === 'TABLE') return false;
      if (el.scrollWidth > el.clientWidth) return false;
      el = el.parentElement;
    }
    return true;
  }
  document.addEventListener('touchstart', function(e) {
    if (!('ontouchstart' in window)) return;
    if (!isSwipableTarget(e.target)) return;
    var active = qs(SEL.viewActive);
    if (!active || MAIN_VIEWS.indexOf(active.id.replace('view-', '')) === -1) return;
    var touch = e.touches[0];
    swipeStartX = touch.clientX;
    swipeStartY = touch.clientY;
    swipeDistX = 0;
    swiping = true;
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!swiping) return;
    var touch = e.touches[0];
    swipeDistX = touch.clientX - swipeStartX;
    var distY = Math.abs(touch.clientY - swipeStartY);
    if (Math.abs(swipeDistX) < 30 || distY > Math.abs(swipeDistX) * 1.5) return;
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', function(e) {
    if (!swiping) return;
    swiping = false;
    if (Math.abs(swipeDistX) < 50) return;
    var active = qs(SEL.viewActive);
    if (!active) return;
    var idx = MAIN_VIEWS.indexOf(active.id.replace('view-', ''));
    if (idx === -1) return;
    var target;
    if (swipeDistX < 0) {
      target = MAIN_VIEWS[(idx + 1) % MAIN_VIEWS.length];
    } else {
      target = MAIN_VIEWS[(idx - 1 + MAIN_VIEWS.length) % MAIN_VIEWS.length];
    }
    showView(target);
  }, { passive: true });

  // Mobile lifecycle
  window.addEventListener('tauri://focus', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  });
  window.addEventListener('tauri://blur', () => {});

  // Mobile keyboard: push content up when keyboard opens
  if (window.visualViewport) {
    var _prevVpHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', function() {
      var diff = _prevVpHeight - window.visualViewport.height;
      var main = qs(SEL.mainApp);
      if (!main) return;
      if (diff > KEYBOARD.THRESHOLD) {
        // Keyboard opened
        document.body.classList.add('keyboard-open');
        var view = qs(SEL.viewActive);
        if (view) view.classList.add('mobile-keyboard');
        var el = document.activeElement;
        if (el) {
          setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, KEYBOARD.SCROLL_DELAY_MS);
        }
        main.style.paddingBottom = (diff - KEYBOARD.PAD_OFFSET) + 'px';
      } else if (diff < -KEYBOARD.THRESHOLD) {
        // Keyboard closed
        document.body.classList.remove('keyboard-open');
        var view2 = qs(SEL.viewActive);
        if (view2) view2.classList.remove('mobile-keyboard');
        main.style.paddingBottom = '';
        window.scrollTo(0, 0);
      }
      _prevVpHeight = window.visualViewport.height;
    });
  }

  /* ========== OPENROUTER / SUGERENCIAS ========== */
  qs(SEL.openrouterSaveKeyBtn).addEventListener('click', saveOpenRouterKey);
  // Custom select for model
  qs(SEL.openrouterModelBtn).addEventListener('click', function(e) {
    e.stopPropagation();
    var wrap = qs(SEL.openrouterModelWrap);
    wrap.classList.toggle('open');
  });
  qs(SEL.openrouterModelMenu).addEventListener('click', function(e) {
    var opt = e.target.closest('button');
    if (!opt || !opt.dataset.value) return;
    var wrap = qs(SEL.openrouterModelWrap);
    setCustomSelectValue(wrap, opt.dataset.value);
    wrap.classList.remove('open');
    try { invoke('set_config_value', { key: CFG_OPENROUTER_MODEL, value: opt.dataset.value }); } catch (e) { showToast('Error al guardar modelo: ' + e, 'error'); }
  });
  document.addEventListener('click', function(e) {
    var wrap = qs(SEL.openrouterModelWrap);
    if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
  });
  qs(SEL.generateOrderBtn).addEventListener('click', generateOrder);
  qs(SEL.suggestionCopyBtn).addEventListener('click', copySuggestion);
  qs(SEL.suggestionModalClose).addEventListener('click', function() { closeModal(qs(SEL.suggestionModal)); });
  qs(SEL.suggestionCloseBtn).addEventListener('click', function() { closeModal(qs(SEL.suggestionModal)); });
  loadOpenRouterKey();

  /* ========== CHAT IA ========== */
  qs(SEL.chatCloseBtn).addEventListener('click', toggleChat);
  qs(SEL.chatSendBtn).addEventListener('click', handleChatSend);
  qs(SEL.chatInput).addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  });
  qs(SEL.chatInput).addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 80) + 'px';
  });

  /* Expand chat */
  qs(SEL.chatExpandBtn).addEventListener('click', function() {
    qs(SEL.chatPanel).classList.toggle('expanded');
    this.querySelector('i').className = qs(SEL.chatPanel).classList.contains('expanded') ? 'nf nf-fa-compress' : 'nf nf-fa-expand';
  });

  /* Quick prompts */
  qsa('.chat-prompt-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      handleChatSend(this.dataset.prompt);
    });
  });

  /* ========== KEYBOARD SHORTCUTS ========== */
  document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      var searchMap = {
        sales: 'product-search',
        inventory: 'inventory-search',
        creditos: 'creditos-search',
        sync: 'sync-search',
      };
      var inputId = searchMap[lastViewName];
      if (inputId) {
        var input = document.getElementById(inputId);
        if (input) { input.focus(); input.select(); }
      }
    }
    if (e.key === 'F5' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      var reloadMap = {
        sales: function() { renderProductSearch(); renderCart(); },
        inventory: loadInventory,
        creditos: loadCreditos,
        cashier: loadDailySummary,
        audit: loadAudit,
        reports: function() { loadReportsAndTopProducts(true); },
        config: function() { loadThemeConfig(); },
        sync: function() { loadSyncConfig(); loadConflictCount(); },
      };
      var fn = reloadMap[lastViewName];
      if (fn) fn();
      showToast('Vista recargada', 'info');
    }
  });

  /* ========== COMPACT TOGGLE ========== */
  function initCompactToggle() {
    document.addEventListener('click', function(e) {
      const btn = e.target.closest(SEL.colToggleBtn);
      if (!btn) return;
      const target = btn.dataset.colToggle;
      const table = document.querySelector('table[data-col-toggle="' + target + '"]');
      if (!table) return;
      table.classList.toggle('compact-mode');
      const icon = btn.querySelector('.nf');
      if (icon) {
        icon.className = table.classList.contains('compact-mode') ? 'nf nf-fa-expand' : 'nf nf-fa-compress';
      }
    });
  }

  /* ========== HOVER CARD ========== */
  function initHoverCard() {
    const container = qs(SEL.productListContainer);
    if (!container) return;
    const card = qs(SEL.productHoverCard);
    const body = qs(SEL.productHoverCardBody);
    let showTimer = null, hideTimer = null;
    let lastCodigo = null, lastX = 0, lastY = 0;

    async function isHoverEnabled() {
      try {
        const val = await getUserConfig(CFG_HOVER_CARD);
        return val !== '0' && val !== 'false' && val !== '';
      } catch (_) { return true; }
    }

    function showCard(p, codigo) {
      if (codigo !== lastCodigo) return;
      var pesable = !!p.es_pesable;
      var html = '<div class="hover-title">' + escapeHtml(p.nombre) + (pesable ? ' <span class="badge badge-info" title="Pesable por kilo">kg</span>' : '') + '</div>';
      html += '<div class="hover-row"><span class="hover-label">C&oacute;digo</span><span class="hover-value">' + escapeHtml(p.codigo) + '</span></div>';
      html += '<div class="hover-row"><span class="hover-label">' + (pesable ? 'Precio por kg' : 'Precio') + '</span><span class="hover-value">' + formatUSD(p.precio_usd) + '</span></div>';
      var stockDisplay = (pesable && !Number.isInteger(p.stock)) ? p.stock.toFixed(3) : p.stock;
      html += '<div class="hover-row"><span class="hover-label">' + (pesable ? 'Kilos' : 'Stock') + '</span><span class="hover-value">' + stockDisplay + '</span></div>';
      if (p.costo > 0) html += '<div class="hover-row"><span class="hover-label">' + (pesable ? 'Costo por kg' : 'Costo') + '</span><span class="hover-value">' + formatUSD(p.costo) + '</span></div>';
      if (p.categoria) html += '<div class="hover-row"><span class="hover-label">Categor&iacute;a</span><span class="hover-value">' + escapeHtml(p.categoria) + '</span></div>';
      body.innerHTML = html;

      var left = lastX + 16;
      var top = lastY + 16;
      card.style.left = left + 'px';
      card.style.top = top + 'px';
      card.classList.remove('hidden');
      var cw = card.offsetWidth;
      var ch = card.offsetHeight;
      if (left + cw > window.innerWidth - 8) left = lastX - cw - 16;
      if (top + ch > window.innerHeight - 8) top = window.innerHeight - ch - 8;
      if (top < 8) top = 8;
      if (left < 8) left = 8;
      card.style.left = left + 'px';
      card.style.top = top + 'px';
    }

    document.addEventListener('viewChanged', function() { card.classList.add('hidden'); clearTimeout(showTimer); });

    container.addEventListener('mouseover', async function(e) {
      if (!(await isHoverEnabled())) return;
      const tr = e.target.closest('tr');
      if (!tr) return;
      const codigo = tr.querySelector('[data-action="add-to-cart"]')?.dataset.codigo;
      if (!codigo) return;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      lastCodigo = codigo;
      lastX = e.clientX; lastY = e.clientY;
      const p = productCache.find(function(x) { return x.codigo === codigo; });
      if (!p) return;
      showTimer = setTimeout(function() { showCard(p, codigo); }, 300);
    });
    container.addEventListener('mouseout', function(e) {
      var related = e.relatedTarget;
      if (related && (related.closest('tr') || related.closest(SEL.productHoverCard))) return;
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function() { card.classList.add('hidden'); }, 150);
    });
    card.addEventListener('mouseenter', function() { clearTimeout(hideTimer); });
    card.addEventListener('mouseleave', function() { card.classList.add('hidden'); });
  }

  /* ========== SOUND TOGGLE (Ctrl+M) ========== */
  /* handled in shortcuts.js */
});
