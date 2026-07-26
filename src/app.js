/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async function() {
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
  if (IS_ANDROID) {
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

  // Event delegation: product search add-to-cart
  qs(SEL.productSearchBody).addEventListener('click', e => {
    const btn = e.target.closest('[data-action="add-to-cart"]');
    if (btn) addToCart(btn.dataset.codigo);
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
  });

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
        montoEl.textContent = method === METODO_EFECTIVO_BS ? 'Faltan Bs. ' + (totalMoneda - recibido).toFixed(2).replace('.', ',') : 'Faltan ' + formatUSD(totalMoneda - recibido);
        cambioEl.classList.remove('hidden');
        cambioEl.style.color = 'var(--danger)';
      } else if (recibido > totalMoneda && calcularVuelto) {
        const cambio = recibido - totalMoneda;
        const cambioTexto = method === METODO_EFECTIVO_BS ? 'Bs. ' + cambio.toFixed(2).replace('.', ',') : formatUSD(cambio);
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
  qs(SEL.inventoryExportBtn).addEventListener('click', exportProducts);
  qs(SEL.inventoryImportBtn).addEventListener('click', openImportModal);
  qs(SEL.inventoryInariBtn).addEventListener('click', () => {
    showInari = !showInari;
    inventoryPage = 1;
    qs(SEL.inventoryInariBtn).classList.toggle('active', showInari);
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
      return;
    }
  });

  // Product modal
  qs(SEL.productModalClose).addEventListener('click', closeProductModal);
  qs(SEL.productCancelBtn).addEventListener('click', closeProductModal);
  qs(SEL.productSaveBtn).addEventListener('click', saveProduct);
  qs(SEL.productDeleteBtn).addEventListener('click', deleteProduct);
  qs(SEL.productPrecio).addEventListener('input', function() { applyComaAutomatica(this); });

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

  // Creditos
  qs(SEL.creditoAddBtn).addEventListener('click', () => openCreditoModal());
  qs(SEL.clientModalClose).addEventListener('click', closeClientModal);
  qs(SEL.clientCancelBtn).addEventListener('click', closeClientModal);
  qs(SEL.clientSaveBtn).addEventListener('click', saveClient);

  // Creditos search
  const creditosSearch = qs(SEL.creditosSearch);
  if (creditosSearch) {
    creditosSearch.addEventListener('input', applyCreditoFilter);
  }

  // Event delegation: creditos table
  qs(SEL.creditosBody).addEventListener('click', e => {
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
      confirmModal(msg, 'Eliminar Cliente', 'Eliminar').then(async ok => {
        if (!ok) return;
        try {
          await invoke('delete_cliente', { clienteId: id });
          showToast('Cliente eliminado');
          loadCreditos();
        } catch (e) { showToast('Error: ' + e, 'error'); }
      });
      return;
    }
    const toggleBtn = e.target.closest('[data-action="toggle-cliente-credito"]');
    if (toggleBtn) {
      const id = parseInt(toggleBtn.dataset.id);
      const activo = toggleBtn.dataset.activo === 'true';
      confirmModal((activo ? 'Desactivar' : 'Activar') + ' cr\u00e9dito para este cliente?', 'Cambiar Cr\u00e9dito', (activo ? 'Desactivar' : 'Activar')).then(async ok => {
        if (!ok) return;
        try {
          await invoke('toggle_cliente_credito', { clienteId: id, activo: !activo });
          showToast('Cr\u00e9dito ' + (!activo ? 'activado' : 'desactivado'));
          loadCreditos();
        } catch (e) { showToast('Error: ' + e, 'error'); }
      });
      return;
    }
    const quickDebtBtn = e.target.closest('[data-action="open-quick-debt"]');
    if (quickDebtBtn) {
      const id = parseInt(quickDebtBtn.dataset.id);
      const nombre = quickDebtBtn.dataset.nombre;
      qs(SEL.quickDebtClienteNombre).textContent = nombre;
      qs(SEL.quickDebtMonto).value = '';
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
  // Close dropdown on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var open = document.querySelector(SEL.customSelectOpen);
      if (open) open.classList.remove('open');
    }
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
  const resetUsersBtn = qs('#reset-users-btn');
  if (resetUsersBtn) resetUsersBtn.addEventListener('click', function() {
    confirmModal('\u00bfEliminar TODOS los usuarios y dejar solo superadmin? Esta acci\u00f3n no se puede deshacer.', 'Reset Usuarios', 'Resetear').then(ok => {
      if (!ok) return;
      invoke('reset_usuarios').then(msg => { showToast(msg); loadUserList(); }).catch(e => showToast('Error: ' + e, 'error'));
    });
  });
  document.addEventListener('click', function(e) {
    const delBtn = e.target.closest('.delete-user-btn');
    if (delBtn) {
      withButtonLock(delBtn, async function() {
        const id = parseInt(delBtn.dataset.id);
        const ok = await confirmModal('\u00bfEliminar este usuario?', 'Eliminar Usuario', 'Eliminar');
        if (!ok) return;
        try {
          const msg = await invoke('delete_usuario', { usuarioId: id });
          showToast(msg);
          loadUserList();
        } catch (e) { showToast('Error: ' + e, 'error'); }
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
    if (!pwd || pwd.length < MIN_PASSWORD_LEN) { showToast(`La contrase\u00f1a debe tener al menos ${MIN_PASSWORD_LEN} caracteres`, 'error'); return; }
    try {
      await invoke('admin_change_password', { usuarioId: adminPwdUserId, newPassword: pwd });
      showToast('Contrase\u00f1a cambiada exitosamente');
      closeAdminPwdModal();
    } catch (e) { showToast('Error: ' + e, 'error'); }
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
      try {
        const stats = await invoke('get_sync_stats');
        if (stats.dispositivo_id) {
          if (display) {
            display.textContent = 'ID: ' + stats.dispositivo_id;
            display.style.display = 'block';
          }
        } else {
          showToast('No hay dispositivo registrado', 'error');
        }
      } catch (e) { showToast('Error: ' + e, 'error'); }
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
    try {
      const msg = await invoke('resolve_conflicto', { conflictoId: id, useRemote });
      showToast(msg);
      openConflictModal();
      loadConflictCount();
    } catch (e) { showToast('Error: ' + e, 'error'); }
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

  /* Subir todo */
  qs(SEL.uploadAllBtn)?.addEventListener('click', function() {
    confirmModal('¿Subir productos, clientes y ventas a Supabase?', 'Subir todo', 'Subir').then(async function(ok) {
      if (!ok) return;
      showSyncProgress();
      updateSyncIndicator('Subiendo...', true);
      await forcePaint();
      invoke('upload_all').then(function(r) {
        hideSyncProgress();
        showToast('Subida completa');
        loadConflictCount();
        loadSyncStats();
      }).catch(function(e) {
        hideSyncProgress();
        updateSyncIndicator('Error en sync', false);
        showToast('Error: ' + e, 'error');
        loadSyncStats();
      });
    });
  });

  /* Descargar todo */
  qs(SEL.downloadAllBtn)?.addEventListener('click', function() {
    confirmModal('¿Descargar productos, clientes y ventas desde Supabase?', 'Descargar todo', 'Descargar').then(async function(ok) {
      if (!ok) return;
      showSyncProgress();
      updateSyncIndicator('Descargando...', true);
      await forcePaint();
      invoke('download_all').then(function(r) {
        hideSyncProgress();
        showToast('Descarga completa');
        loadProductCache();
        loadConflictCount();
        loadSyncStats();
      }).catch(function(e) {
        hideSyncProgress();
        updateSyncIndicator('Error en sync', false);
        showToast('Error: ' + e, 'error');
        loadSyncStats();
      });
    });
  });

  /* Subir usuarios */
  qs(SEL.uploadUsuariosBtn)?.addEventListener('click', async function() {
    var ok = await confirmModal('¿Subir usuarios a Supabase?', 'Subir usuarios', 'Subir');
    if (!ok) return;
    try {
      var r = await invoke('upload_usuarios');
      showToast(r);
      loadSyncStats();
    } catch (e) { showToast('Error: ' + e, 'error'); }
  });

  /* Descargar usuarios */
  qs(SEL.downloadUsuariosBtn)?.addEventListener('click', async function() {
    var ok = await confirmModal('¿Descargar usuarios de otros dispositivos desde Supabase?', 'Descargar usuarios', 'Descargar');
    if (!ok) return;
    try {
      var r = await invoke('download_usuarios');
      showToast(r);
      loadSyncStats();
    } catch (e) { showToast('Error: ' + e, 'error'); }
  });

  /* Sincronizar todo */
  qs(SEL.syncAllBtn)?.addEventListener('click', function() {
    withButtonLock(this, async function() {
      const ok = await confirmModal('\u00bfSincronizar completamente (subir y descargar todo) con Supabase?', 'Sincronizar todo', 'Sincronizar');
      if (!ok) return;
      showSyncProgress();
      updateSyncIndicator('Sincronizando...', true);
      await forcePaint();
      try {
        var r = await invoke('sync_all');
        hideSyncProgress();
        showToast('Sincronizaci\u00f3n completa');
        loadProductCache();
        loadConflictCount();
        loadSyncStats();
      } catch (e) {
        hideSyncProgress();
        updateSyncIndicator('Error en sync', false);
        showToast('Error: ' + e, 'error');
        loadSyncStats();
      }
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
    showLoadingModal('Probando conexión con Supabase...');
    await forcePaint();
    try {
      var ok = await invoke('test_supabase_connection');
      if (ok) {
        statusEl.style.color = cssVar('--success');
        statusEl.title = 'Conectado';
        showToast('Conexión exitosa');
      } else {
        statusEl.style.color = cssVar('--danger');
        statusEl.title = 'Error de conexi\u00f3n';
        showToast('No se pudo conectar a Supabase', 'error');
      }
    } catch (e) {
      statusEl.style.color = cssVar('--danger');
      statusEl.title = 'Error: ' + e;
      showToast('Error: ' + e, 'error');
    } finally {
      hideLoadingModal();
    }
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
  ['report-start-date', 'report-end-date'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', setDefaultReportDates);
  });
  const topLimitSelect = qs(SEL.topProductsLimit);
  if (topLimitSelect) topLimitSelect.addEventListener('change', loadTopProducts);
  qs(SEL.reportPrevBtn).addEventListener('click', function() { if (reportPage > 1) { reportPage--; loadReportsAndTopProducts(); } });
  qs(SEL.reportNextBtn).addEventListener('click', function() { reportPage++; loadReportsAndTopProducts(); });

  /* ========== EXPORT REPORT ========== */
  const exportBtn = qs(SEL.reportExportBtn);
  if (exportBtn) exportBtn.addEventListener('click', handleExportReport);

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

  // Goto reports from cashier
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

  // Debt detail
  qs(SEL.debtDetailClose).addEventListener('click', closeDebtDetail);
  qs(SEL.debtDetailOkBtn).addEventListener('click', closeDebtDetail);

  // Abono modal
  qs(SEL.abonoClose).addEventListener('click', closeAbonoModal);
  qs(SEL.abonoCancelBtn).addEventListener('click', closeAbonoModal);
  qs(SEL.abonoConfirmBtn).addEventListener('click', confirmAbono);
  qs(SEL.abonoMonto).addEventListener('input', function() {
    updateAbonoSaldoRestante();
    if (qs('.abono-metodo-btn.active')?.dataset.method === METODO_MIXTO) distributeMixto('abono-mixto-items');
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
    m.addEventListener('click', e => { if (e.target === m) closeModal(m); });
  });

  // Keyboard shortcuts
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

  // Inari config toggle
  const inariToggle = qs(SEL.inariConfigToggle);
  function applyInariConfig(active) {
    if (active) {
      showInari = true;
      qs(SEL.inventoryInariBtn).classList.add('active');
    } else {
      showInari = false;
      qs(SEL.inventoryInariBtn).classList.remove('active');
    }
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
      try {
        await invoke('set_config_value', { key: CFG_HISTORIAL_LIMPIEZA_DIAS, value: String(val) });
        updateHistoryCleanupStatus(val);
        showToast('Configuraci\u00f3n guardada');
      } catch (e) { showToast('Error: ' + e, 'error'); }
    });
  }

  // Manual clear history buttons
  for (const btn of [qs(SEL.auditClearBtn), qs(SEL.auditClearConfigBtn)]) {
    if (btn) {
      btn.addEventListener('click', async () => {
        const ok = await confirmModal('\u00bfEliminar todo el historial de auditor\u00eda? Esta acci\u00f3n no se puede deshacer.', 'Limpiar Historial', 'Eliminar todo');
        if (!ok) return;
        try {
          await invoke('clear_audit');
          showToast('Historial eliminado');
          playSound('remove');
          qs(SEL.auditBody).innerHTML = emptyState('<i class="nf nf-fa-history"></i>', 'Historial vac\u00edo', 'No hay registros de auditor\u00eda');
          qs(SEL.auditLoadMore).classList.add('hidden');
        } catch (e) { showToast('Error: ' + e, 'error'); }
      });
    }
  }

  // Ensure sales panels are visible on desktop
  window.addEventListener('resize', function() {
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
    if (!IS_ANDROID) return;
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
  }, { passive: true });
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
        var view = document.querySelector('.view.active');
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
        var view2 = document.querySelector('.view.active');
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
  /* FAB — click to open, drag to move (long-press or move >4px) */
  (function initFabPos() {
    var fab = qs(SEL.chatFab);
    var saved = localStorage.getItem('chat_fab_pos');
    if (saved) {
      try {
        var pos = JSON.parse(saved);
        fab.style.left = pos.left + 'px';
        fab.style.top = pos.top + 'px';
        return;
      } catch (_) {}
    }
    fab.style.left = (window.innerWidth - 72) + 'px';
    fab.style.top = (window.innerHeight - 152) + 'px';
  })();

  var fabDragActive = false, fabTouchDrag = false;
  var fabStartX, fabStartY, fabOrigLeft, fabOrigTop, fabDragTimer;

  function fabStart(e, isTouch) {
    var t = isTouch ? e.touches[0] : e;
    fabDragActive = false;
    fabTouchDrag = false;
    fabStartX = t.clientX;
    fabStartY = t.clientY;
    fabOrigLeft = parseInt(qs(SEL.chatFab).style.left) || 0;
    fabOrigTop = parseInt(qs(SEL.chatFab).style.top) || 0;
    clearTimeout(fabDragTimer);
    fabDragTimer = setTimeout(function() {
      fabDragActive = true;
      qs(SEL.chatFab).classList.add('dragging');
    }, TIMING.FAB_DRAG_START_MS);
  }

  function fabMove(e, isTouch) {
    if (fabStartX === undefined) return;
    var t = isTouch ? e.touches[0] : e;
    var dx = t.clientX - fabStartX;
    var dy = t.clientY - fabStartY;
    if (!fabDragActive && Math.abs(dx) < TIMING.FAB_DRAG_THRESHOLD && Math.abs(dy) < TIMING.FAB_DRAG_THRESHOLD) return;
    if (!fabDragActive) {
      fabDragActive = true;
      qs(SEL.chatFab).classList.add('dragging');
      clearTimeout(fabDragTimer);
    }
    e.preventDefault();
    qs(SEL.chatFab).style.left = Math.max(0, Math.min(window.innerWidth - 52, fabOrigLeft + dx)) + 'px';
    qs(SEL.chatFab).style.top = Math.max(0, Math.min(window.innerHeight - 52, fabOrigTop + dy)) + 'px';
  }

  function fabEnd(isTouch) {
    clearTimeout(fabDragTimer);
    fabDragTimer = null;
    if (fabDragActive) {
      qs(SEL.chatFab).classList.remove('dragging');
      localStorage.setItem('chat_fab_pos', JSON.stringify({
        left: parseInt(qs(SEL.chatFab).style.left) || 0,
        top: parseInt(qs(SEL.chatFab).style.top) || 0,
      }));
      if (isTouch) {
        fabTouchDrag = true;
        setTimeout(function() { fabTouchDrag = false; }, TIMING.FAB_TOUCH_RESET_MS);
      }
    }
    fabStartX = fabStartY = undefined;
  }

  qs(SEL.chatFab).addEventListener('mousedown', function(e) {
    if (fabTouchDrag) return; // ignore synthetic mousedown after touch drag
    fabStart(e, false);
  });
  document.addEventListener('mousemove', function(e) { fabMove(e, false); });
  document.addEventListener('mouseup', function() { fabEnd(false); });
  qs(SEL.chatFab).addEventListener('touchstart', function(e) { fabStart(e, true); }, { passive: true });
  document.addEventListener('touchmove', function(e) { fabMove(e, true); }, { passive: false });
  document.addEventListener('touchend', function() { fabEnd(true); });

  qs(SEL.chatFab).addEventListener('click', function() {
    if (fabDragActive || fabTouchDrag) { fabDragActive = false; fabTouchDrag = false; return; }
    toggleChat();
  });

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
});
