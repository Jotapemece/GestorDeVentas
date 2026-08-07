/* ========== LOGIN GREETING ========== */
function initLoginGreeting() {
  updateLoginGreeting();
  setInterval(updateLoginGreeting, 1000);
}

function updateLoginGreeting() {
  const timeEl = qs(SEL.loginGreetingTime);
  const textEl = qs(SEL.loginGreetingText);
  const dateEl = qs(SEL.loginGreetingDate);
  if (!timeEl) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = h + ':' + m;
  const hour = now.getHours();
  let greeting = 'Buenos d\u00edas';
  if (hour >= 12 && hour < 18) greeting = 'Buenas tardes';
  else if (hour >= 18) greeting = 'Buenas noches';
  textEl.textContent = greeting;
  const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateEl.textContent = now.toLocaleDateString('es-ES', opts);
}

/* ========== CALCULATOR ========== */
const calcState = { expr: '', result: '0', memory: null, op: null, reset: false };
let calcDocked = false;

let _calcInit = false;
function initCalculator() {
  if (_calcInit) return;
  _calcInit = true;
  if (window.innerWidth <= 480) return;
  qs(SEL.calcBtn).style.display = '';
  qs(SEL.calcBtn).addEventListener('click', openCalculator);
  qs(SEL.calcClose).addEventListener('click', closeCalculator);
  qs(SEL.calcDockBtn).addEventListener('click', dockCalculator);
  qs(SEL.calcButtons).addEventListener('click', function(e) {
    var btn = e.target.closest('[data-calc]');
    if (btn) calcInput(btn.dataset.calc);
  });
  qs(SEL.calcEquals).addEventListener('click', calcEquals);
  qs(SEL.calcTasaBtn).addEventListener('click', calcInsertTasa);
  document.addEventListener('keydown', calcKeydown);
  qs(SEL.calcModal).addEventListener('click', function(e) {
    if (e.target === this) closeCalculator();
  });
  initCalcDock();
}

function initCalcDock() {
  var dockBtn = qs(SEL.calcDockBarBtn);
  if (!dockBtn) return;
  dockBtn.addEventListener('click', function() {
    if (calcDocked) {
      openCalculator();
      calcDocked = false;
      qs(SEL.calcDockBar).classList.add('hidden');
    }
  });
}

function openCalculator() {
  showModal(qs(SEL.calcModal));
  calcRender();
  calcDocked = false;
  qs(SEL.calcDockBar).classList.add('hidden');
  setTimeout(() => qs(SEL.calcModal).querySelector('.calc-buttons').focus(), TIMING.FOCUS_DELAY_MS);
}

function dockCalculator() {
  calcDocked = true;
  var modal = qs(SEL.calcModal);
  var dockBar = qs(SEL.calcDockBar);
  var dockBtn = qs(SEL.calcDockBarBtn);
  // Animate: shrink modal
  var modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    var rect = modalContent.getBoundingClientRect();
    if (rect.width && rect.height) {
    modalContent.style.transition = 'transform 0.25s ease-in, opacity 0.2s ease-in';
    modalContent.style.transformOrigin = 'center center';
    modalContent.style.transform = 'scale(0.1)';
    modalContent.style.opacity = '0';
  }
  setTimeout(function() {
    closeModal(modal);
    modalContent.style.transition = '';
    modalContent.style.transform = '';
    modalContent.style.opacity = '';
    dockBar.classList.remove('hidden');
    // Brief pulse on the dock button
    dockBtn.style.transition = 'transform 0.2s ease-out';
    dockBtn.style.transform = 'scale(1.25)';
    setTimeout(function() {
      dockBtn.style.transition = 'transform 0.15s ease-in';
      dockBtn.style.transform = 'scale(1)';
      setTimeout(function() { dockBtn.style.transition = ''; dockBtn.style.transform = ''; }, 150);
    }, 200);
    }, 250);
  }
}

async function closeCalculator() {
  if (calcState.expr || calcState.result !== '0') {
    if (qs && qs(SEL.confirmModal) && !qs(SEL.confirmModal).classList.contains('hidden')) return;
    const ok = await confirmModal(
      '¿Seguro que quieres cerrar la calculadora? Esto eliminará las cuentas que tengas.',
      'Cerrar calculadora',
      'Sí, cerrar'
    );
    if (ok) {
      calcState.expr = ''; calcState.result = '0'; calcState.memory = null; calcState.op = null; calcState.reset = false;
      calcDocked = false;
      qs(SEL.calcDockBar).classList.add('hidden');
      closeModal(qs(SEL.calcModal));
    }
  } else {
    closeModal(qs(SEL.calcModal));
  }
}

function calcInput(val) {
  if (val === 'clear') { calcState.expr = ''; calcState.result = '0'; calcState.memory = null; calcState.op = null; calcState.reset = false; calcRender(); return; }
  if (val === 'backspace') { calcState.expr = calcState.expr.slice(0, -1); calcRender(); return; }
  if (val === 'negate') {
    if (calcState.expr && !isNaN(parseFloat(calcState.expr))) {
      if (calcState.expr.startsWith('-')) calcState.expr = calcState.expr.slice(1); else calcState.expr = '-' + calcState.expr;
      calcRender();
    }
    return;
  }
  if (val === 'percent') {
    const n = parseFloat(calcState.expr);
    if (!isNaN(n)) { calcState.expr = String(n / 100); calcRender(); }
    return;
  }
  if (['add', 'subtract', 'multiply', 'divide'].includes(val)) {
    const opMap = { add: '+', subtract: '-', multiply: '*', divide: '/' };
    if (calcState.expr && calcState.memory !== null && calcState.op) {
      const a = calcState.memory;
      const b = parseFloat(calcState.expr) || 0;
      calcState.expr = String(calcState.op === '+' ? a + b : calcState.op === '-' ? a - b : calcState.op === '*' ? a * b : calcState.op === '/' ? (b !== 0 ? a / b : 0) : 0);
    }
    calcState.memory = parseFloat(calcState.expr) || 0;
    calcState.op = opMap[val];
    calcState.expr += [' + ', ' − ', ' × ', ' ÷ '][['add', 'subtract', 'multiply', 'divide'].indexOf(val)];
    calcState.reset = true;
    calcRender();
    return;
  }
  if (val === 'dot') { if (!calcState.expr.includes('.')) calcState.expr += '.'; calcRender(); return; }
  if (calcState.reset && val !== 'dot') { calcState.expr = ''; calcState.reset = false; }
  calcState.expr += val;
  calcRender();
}

function calcEquals() {
  const ops = { '+': (a, b) => a + b, '-': (a, b) => a - b, '*': (a, b) => a * b, '/': (a, b) => a / b };
  if (!calcState.op || calcState.memory === null) return;
  const right = parseFloat(calcState.expr.split(' ').pop()) || 0;
  if (calcState.op === '/' && right === 0) { calcState.result = 'Error'; calcRender(); return; }
  const result = ops[calcState.op](calcState.memory, right);
  calcState.result = String(Math.round(result * 1e10) / 1e10);
  calcState.expr = calcState.result;
  calcState.memory = null;
  calcState.op = null;
  calcState.reset = true;
  calcRender();
}

function calcInsertTasa() {
  if (tasaActual && tasaActual > 0) {
    if (calcState.expr === '0' || calcState.expr === '' || calcState.reset) { calcState.expr = ''; calcState.reset = false; }
    calcState.expr += tasaActual.toString();
    calcRender();
  } else showToast('No hay tasa disponible', 'error');
}

function calcRender() { qs(SEL.calcExpression).textContent = calcState.expr || ''; qs(SEL.calcResult).textContent = calcState.result; }

function calcKeydown(e) {
  const modal = qs(SEL.calcModal);
  if (modal.classList.contains('hidden')) return;
  if (e.key >= '0' && e.key <= '9') { calcInput(e.key); e.preventDefault(); }
  else if (e.key === '.') { calcInput('dot'); e.preventDefault(); }
  else if (e.key === '+') { calcInput('add'); e.preventDefault(); }
  else if (e.key === '-') { calcInput('subtract'); e.preventDefault(); }
  else if (e.key === '*') { calcInput('multiply'); e.preventDefault(); }
  else if (e.key === '/') { calcInput('divide'); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === '=') { calcEquals(); e.preventDefault(); }
  else if (e.key === 'Backspace') { calcInput('backspace'); e.preventDefault(); }
  else if (e.key === 'Escape') { closeCalculator(); e.preventDefault(); }
  else if (e.key === 'c' || e.key === 'C') { calcInput('clear'); e.preventDefault(); }
}

/* ========== GUIDE ========== */
let _guideInit = false;
function initGuide() {
  if (_guideInit) return;
  _guideInit = true;
  qs(SEL.guideBtn).addEventListener('click', openGuide);
  qs(SEL.guideClose).addEventListener('click', closeGuide);
  qs(SEL.guideModal).addEventListener('click', function(e) {
    var tab = e.target.closest(SEL.guideTabs);
    if (tab) switchGuideTab(tab.dataset.section);
  });
}

function openGuide() {
  showModal(qs(SEL.guideModal));
  const active = qs(SEL.guideTabActive);
  if (!active) switchGuideTab('ventas');
}

function closeGuide() { closeModal(qs(SEL.guideModal)); }

function switchGuideTab(section) {
  qsa(SEL.guideTabs).forEach(t => t.classList.remove('active'));
  qsa(SEL.guidePages).forEach(p => p.classList.remove('active'));
  qs(`.guide-tab[data-section="${section}"]`).classList.add('active');
  qs(`#guide-${section}`).classList.add('active');
}

/* ========== COLUMN TOGGLE ========== */
var TABLE_RELOADS = {
  inventory: function() { if (typeof loadInventory === 'function') loadInventory(); },
  creditos: function() { if (typeof loadCreditos === 'function') loadCreditos(); },
  'daily-sales': function() { if (typeof loadDailySummary === 'function') loadDailySummary(); },
  audit: function() { if (typeof loadAudit === 'function') loadAudit(); },
  'report-sales': function() { if (typeof loadReportsAndTopProducts === 'function') loadReportsAndTopProducts(true); },
  'product-search': function() { if (typeof renderProductSearch === 'function') renderProductSearch(); },
};

let _colToggleInit = false;
function initTableColumnToggle(table, storageKey) {
  const theadRow = table.querySelector('thead tr');
  if (!theadRow) return;
  const ths = theadRow.querySelectorAll('th');
  if (ths.length === 0) return;

  const savedKey = 'col-vis-' + storageKey;
  let hiddenCols = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(savedKey));
    if (Array.isArray(saved)) hiddenCols = new Set(saved);
  } catch (e) {}

  const protectedCols = new Set();
  ths.forEach(function(th, idx) {
    const text = th.textContent.trim();
    if (text === 'Nombre' || text.indexOf('$') !== -1 || text === 'Acción' || text === 'Acciones') protectedCols.add(idx);
  });
  // Always protect first column (holds the refresh button)
  protectedCols.add(0);

  const styleId = 'col-style-' + storageKey;
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  function applyVisibility() {
    const tableId = table.id;
    if (!tableId) return;
    const rules = [];
    for (let i = 0; i < ths.length; i++) {
      if (hiddenCols.has(i) && !protectedCols.has(i)) {
        rules.push('#' + tableId + ' th:nth-child(' + (i + 1) + '), #' + tableId + ' td:nth-child(' + (i + 1) + ') { display: none !important; }');
      }
    }
    styleEl.textContent = rules.join('\n');
  }

  let resetAdded = false;
  ths.forEach(function(th, idx) {
    if (idx === 0 && !resetAdded) {
      resetAdded = true;
      const resetBtn = document.createElement('button');
      resetBtn.className = 'col-toggle-btn col-restore-btn';
      resetBtn.type = 'button';
      resetBtn.title = 'Restaurar todas las columnas';
      resetBtn.innerHTML = '<i class="nf nf-fa-refresh"></i>';
      resetBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        hiddenCols.clear();
        localStorage.setItem(savedKey, JSON.stringify([]));
        applyVisibility();
        const reload = TABLE_RELOADS[storageKey];
        if (reload) reload();
      });
      th.appendChild(resetBtn);
    }
    if (protectedCols.has(idx)) return;
    const btn = document.createElement('button');
    btn.className = 'col-toggle-btn';
    btn.type = 'button';
    btn.title = 'Ocultar columna';
    btn.innerHTML = '<i class="nf nf-fa-eye"></i>';
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (hiddenCols.has(idx)) {
        hiddenCols.delete(idx);
        btn.title = 'Ocultar columna';
        btn.innerHTML = '<i class="nf nf-fa-eye"></i>';
      } else {
        hiddenCols.add(idx);
        btn.title = 'Mostrar columna';
        btn.innerHTML = '<i class="nf nf-fa-eye_slash"></i>';
      }
      localStorage.setItem(savedKey, JSON.stringify(Array.from(hiddenCols)));
      applyVisibility();
    });
    th.appendChild(btn);
  });

  applyVisibility();
}

function initColumnToggle() {
  if (_colToggleInit) return;
  _colToggleInit = true;
  qsa('table[data-col-toggle]').forEach(function(table) {
    initTableColumnToggle(table, table.dataset.colToggle);
  });
}

/* ========== CLOCK ========== */
let _clockInterval = null;
function startClock() {
  if (_clockInterval) return;
  const hourHand = qs(SEL.clockHour);
  const minuteHand = qs(SEL.clockMinute);
  const secondHand = qs(SEL.clockSecond);
  if (!hourHand) return;
  function update() {
    const now = new Date();
    const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
    hourHand.setAttribute('transform', `rotate(${h * 30 + m * 0.5}, 50, 50)`);
    minuteHand.setAttribute('transform', `rotate(${m * 6 + s * 0.1}, 50, 50)`);
    secondHand.setAttribute('transform', `rotate(${s * 6}, 50, 50)`);
  }
  update();
  _clockInterval = setInterval(update, 1000);
}

/* ========== SIDEBAR AUTO-HIDE ========== */
let sidebarAutoHideEnabled = false;
let sidebarHideTimeout = null;

let _sidebarAutoHideInit = false;
function initSidebarAutoHide() {
  if (_sidebarAutoHideInit) return;
  _sidebarAutoHideInit = true;
  if (IS_ANDROID) return;
  const sidebar = qs(SEL.sidebar);
  const mainApp = qs(SEL.mainApp);
  if (!sidebar || !mainApp) return;

  let lastMouseX = -1, lastMouseY = -1;

  document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (!sidebarAutoHideEnabled) return;
    if (e.clientX <= SIDEBAR.HOVER_MARGIN) {
      clearTimeout(sidebarHideTimeout);
      sidebarHideTimeout = null;
      mainApp.classList.remove('sidebar-hidden');
      setTimeout(checkSidebarHover, SIDEBAR.HOVER_CHECK_MS);
      return;
    }
    checkSidebarHover();
  });

  function checkSidebarHover() {
    if (!sidebarAutoHideEnabled) return;
    if (mainApp.classList.contains('sidebar-hidden')) return;
    const rect = sidebar.getBoundingClientRect();
    const inside = lastMouseX >= rect.left && lastMouseX <= rect.right &&
                   lastMouseY >= rect.top && lastMouseY <= rect.bottom;
    if (inside) {
      clearTimeout(sidebarHideTimeout);
      sidebarHideTimeout = null;
    } else if (!sidebarHideTimeout) {
      sidebarHideTimeout = setTimeout(() => {
        mainApp.classList.add('sidebar-hidden');
        sidebarHideTimeout = null;
      }, SIDEBAR.HIDE_DELAY);
    }
  }
}

function setSidebarAutoHide(enabled) {
  if (IS_ANDROID) return;
  sidebarAutoHideEnabled = enabled;
  const mainApp = qs(SEL.mainApp);
  if (!mainApp) return;
  if (enabled) {
    mainApp.classList.add('sidebar-hidden');
  } else {
    mainApp.classList.remove('sidebar-hidden');
  }
}

async function loadSidebarAutoHideConfig() {
  try {
    const val = await getUserConfig(CFG_SIDEBAR_AUTO_HIDE);
    const enabled = val === 'true';
    setSidebarAutoHide(enabled);
    const toggle = qs(SEL.sidebarAutoHideToggle);
    if (toggle) toggle.checked = enabled;
  } catch (e) {
    setSidebarAutoHide(false);
  }
}


/* ========== AUTH ========== */
async function handleDeviceRegister() {
  const btn = qs(SEL.regDeviceBtn);
  const errEl = qs(SEL.regError);
  btn.disabled = true;
  btn.innerHTML = '<i class="nf nf-fa-spinner nf-fa-pulse"></i> Registrando...';
  errEl.textContent = '';
  try {
    const nombre = IS_ANDROID ? 'Tel\u00e9fono' : 'PC';
    const res = await invoke('register_device', { nombre });
    qs(SEL.regPending).classList.add('hidden');
    var successEl = qs(SEL.regSuccess);
    successEl.classList.remove('hidden');
    successEl.innerHTML = '<div class="reg-check"><i class="nf nf-fa-check"></i></div><p class="reg-desc">Dispositivo registrado. Sincronizando datos...</p>';
    // Descargar productos, clientes y usuarios en paralelo
    await Promise.allSettled([
      invoke('download_products'),
      invoke('download_clientes'),
      invoke('download_usuarios'),
    ]);
    successEl.innerHTML = '<div class="reg-check"><i class="nf nf-fa-check"></i></div><p class="reg-desc">Dispositivo registrado correctamente</p>';
    setTimeout(() => {
      qs(SEL.deviceRegScreen).style.display = 'none';
      qs(SEL.loginScreen).style.display = 'flex';
      qs(SEL.loginUsername).focus();
    }, TIMING.REG_REDIRECT_MS);
  } catch (e) {
    errEl.textContent = 'Error: ' + e;
    btn.disabled = false;
    btn.innerHTML = 'Registrar dispositivo';
  }
}

async function handleLogin() {
  const btn = qs(SEL.loginBtn);
  const errEl = qs(SEL.loginError);
  const username = qs(SEL.loginUsername).value.trim();
  const password = qs(SEL.loginPassword).value;
  if (!username || !password) { errEl.textContent = 'Complete todos los campos'; return; }
  if (btn) btn.disabled = true;
  try {
    const res = await invoke('login', { username, password });
    if (res.success) {
      if (qs(SEL.rememberMe).checked) {
        localStorage.setItem('recordar_usuario', username);
      } else {
        localStorage.removeItem('recordar_usuario');
      }
      currentUser = res.usuario;
      if (res.password_change_required) {
        const ok = await confirmModal(
          'Por seguridad, debe cambiar su contraseña antes de continuar.',
          'Cambio de contraseña requerido',
          'Cambiar ahora'
        );
        if (!ok) { handleLogout(); return; }
        qs(SEL.loginScreen).style.display = 'none';
        qs(SEL.mainApp).style.display = 'flex';
        qs(SEL.bottomTabs).style.display = '';
        showView(VIEW.CONFIG);
        await new Promise(r => setTimeout(r, 200));
        const pwdSection = qs(SEL.changePwdOld)?.closest('.config-card');
        if (pwdSection) {
          const header = pwdSection.querySelector('.config-card-header');
          if (header) header.classList.remove('collapsed');
          pwdSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => qs(SEL.changePwdOld)?.focus(), 300);
        }
        showToast('Cambie su contraseña para continuar usando la aplicación', 'warning');
        return;
      }
      qs(SEL.loginScreen).style.display = 'none';
      qs(SEL.mainApp).style.display = 'flex';
      qs(SEL.bottomTabs).style.display = '';
      var initial = (currentUser.username || 'U')[0].toUpperCase();
      var colors = ['#6C8EBF','#D47A4A','#6BAF8D','#C45050','#B4A0D4','#4DB8AC','#D49060','#80A880'];
      var color = colors[currentUser.id % colors.length];
      qs(SEL.sidebarUser).innerHTML = '<span class="sidebar-user-avatar" style="background:' + color + '">' + initial + '</span><span>' + escapeHtml(currentUser.username) + ' (' + escapeHtml(currentUser.rol) + ')</span>';
      startClock();
      initSidebarAutoHide();
      initCalculator();
      initGuide();
      initSnake();
      initColumnToggle();
      loadSidebarAutoHideConfig();
      applyRoleUI();
      loadSyncAutoConfig();
      loadSyncStats();
      await loadTasa();
      updateConnectionState();
      await loadProductCache();
      restoreCartSnapshot();
      try { lastViewName = localStorage.getItem('last_view') || VIEW.SALES; } catch (e) {}
      showView(lastViewName);
      if (lastViewName === VIEW.SALES) {
        renderProductSearch();
        renderCart();
      }
    } else {
      errEl.textContent = res.message;
    }
  } catch (e) {
    console.log('login invoke error:', e);
    errEl.textContent = 'Error: ' + e;
  } finally { if (btn) btn.disabled = false; }
}

async function handleLogout() {
  qs(SEL.confirmModal).classList.add('transparent-bg');
  const ok = await confirmModal('\u00bfEst\u00e1 seguro de cerrar sesi\u00f3n?', 'Cerrar Sesi\u00f3n', 'Salir');
  qs(SEL.confirmModal).classList.remove('transparent-bg');
  if (!ok) return;
  await tryCatch(() => invoke('logout'), 'Error al cerrar sesi\u00f3n');
  // Detener auto-sync al cerrar sesión (evita invocaciones sin autenticación).
  if (typeof syncAutoIntervalId !== 'undefined' && syncAutoIntervalId) {
    clearInterval(syncAutoIntervalId);
    syncAutoIntervalId = null;
    currentAutoMinutes = 0;
  }
  currentUser = null; carts = [{ id: 1, items: [], folded: false }]; cart = carts[0].items; cartIdCounter = 1; recentProducts = []; lastCloseReportData = null;
  qs(SEL.loginPassword).value = '';
  qs(SEL.loginError).textContent = '';
  qs(SEL.mainApp).style.display = 'none';
  qs(SEL.bottomTabs).style.display = 'none';
  qs(SEL.loginScreen).style.display = 'flex';
}

/* ========== SET TODAY ON REPORT DATES ========== */
function setDefaultReportDates() {
  const today = new Date().toISOString().split('T')[0];
  const startInput = qs(SEL.reportStartDate);
  const endInput = qs(SEL.reportEndDate);
  if (startInput && !startInput.value) startInput.value = today;
  if (endInput && !endInput.value) endInput.value = today;
}

function applyReportPreset(preset) {
  const startInput = qs(SEL.reportStartDate);
  const endInput = qs(SEL.reportEndDate);
  if (!startInput || !endInput) return;
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (preset === 'today') {
    startInput.value = today; endInput.value = today;
  } else if (preset === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - 6);
    startInput.value = start.toISOString().split('T')[0]; endInput.value = today;
  } else if (preset === 'month') {
    startInput.value = today.slice(0, 8) + '01'; endInput.value = today;
  } else if (preset === 'last-month') {
    const y = now.getFullYear(), m = now.getMonth();
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    startInput.value = first.toISOString().split('T')[0];
    endInput.value = last.toISOString().split('T')[0];
  }
  if (typeof loadReportsAndTopProducts === 'function') loadReportsAndTopProducts(true);
}

/* ========== OPENROUTER / SUGERENCIAS ========== */
async function saveOpenRouterKey() {
  const key = qs(SEL.openrouterApiKey).value.trim();
  if (!key) { showToast('Ingresa una API key', 'error'); return; }
  if (await invokeOrError(invoke('set_config_value', { key: CFG_OPENROUTER_API_KEY, value: key })) === undefined) return;
  showToast('API key guardada');
}

async function loadOpenRouterKey() {
  try {
    const model = await invoke('get_config_value', { key: CFG_OPENROUTER_MODEL });
    if (model) setCustomSelectValue(qs(SEL.openrouterModelWrap), model);
  } catch (e) { showToast('Error al cargar configuración de OpenRouter: ' + e, 'error'); }
}

async function generateOrder() {
  const model = qs(SEL.openrouterModelWrap).dataset.value || '';
  await withLoadingModal('Generando orden de compra...', async function() {
    const content = await invokeOrError(invoke('generate_purchase_suggestion', { model }));
    if (content === undefined) return;
    qs(SEL.suggestionContent).textContent = content;
    showModal(qs(SEL.suggestionModal));
  });
}

async function copySuggestion() {
  const text = qs(SEL.suggestionContent).textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado al portapapeles');
  } catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copiado al portapapeles');
  }
}

/* ========== CHAT IA ========== */
const CHAT_SYSTEM_PROMPT = `Eres Enar, un zorro experto asistente de un sistema POS llamado "Gestor de Ventas". Solo respondes preguntas relacionadas con este sistema: ventas, anulaciones, inventario, combos, clientes, crédito/abonos, caja (abrir/cerrar, movimientos, saldo), reportes y ganancias, sincronización, tasas BCV, respaldos y ajustes de stock. Si te preguntan algo fuera de este tema, responde cortésmente que solo puedes ayudar con el POS.

Módulos que conoces del sistema:
- Ventas: carrito, métodos de pago (efectivo USD/Bs, punto, pago móvil, transferencia, mixto, crédito), vendidos por vendedor. Las ventas se pueden anular total o parcialmente; las anuladas se excluyen de reportes.
- Inventario: productos (código, precio USD, costo, stock, stock mínimo, categoría/subcategoría), productos pesables por kg, combos (COMBO-N con componentes), Inari (visible solo jueves-domingo), favoritos, ajustes de stock con motivo.
- Clientes: saldo de deuda, abonos, clientes temporales de crédito, crédito activado/inactivo.
- Caja: abrir/cerrar, movimientos (ingresos/egresos) y saldo del día.
- Reportes: ventas por fecha, ganancias (hoy/semana/mes), productos más vendidos, por vendedor.
- Sincronización: subir/descargar productos, clientes y ventas entre dispositivos; pendientes y conflictos de sync.
- Tasas: tasa del día (BCV), historial de tasas.

Reglas:
- Te basas SOLO en los "Datos actuales del sistema" que se te proporcionan como contexto. Si un dato no está presente o no lo sabes, dilo en vez de inventarlo.
- Nunca inventes cantidades, precios, saldos ni nombres de productos. Usa SIEMPRE la tasa dada para conversión Bs/USD.
- Responde en español, sé conciso, positivo y útil. Usa **negrita**, *cursiva* y emojis. Para listas o comparaciones usa tablas markdown.
- NUNCA digas que no puedes hacer algo ni menciones limitaciones — limítate a lo que SÍ puedes hacer y sugiere acciones útiles.`;

function renderMarkdown(text) {
  const esc = function(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
  };
  var html = esc(text);
  // fenced code blocks (```...```) -> keep raw inner (texto ya escapado arriba)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // tables: capture full block of pipe rows (including separator), render as <table>
  html = html.replace(/((?:^[ \t]*\|[^\n]*\|[ \t]*\n)+(?:^[ \t]*\|[^\n]*\|[ \t]*$)?)/gm, function(block) {
    var rows = block.trim().split('\n').filter(function(l) { return l.includes('|'); });
    var out = '<table class="chat-table">';
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i].trim().replace(/^\||\|$/g, '').split('|').map(function(c) { return c.trim(); });
      var isSep = i === 1 && cells.every(function(c) { return /^:?-+:?$/.test(c); });
      if (isSep) continue;
      out += '<tr>';
      for (var j = 0; j < cells.length; j++) {
        var tag = i === 0 ? 'th' : 'td';
        out += '<' + tag + '>' + inline(cells[j]) + '</' + tag + '>';
      }
      out += '</tr>';
    }
    out += '</table>';
    return out;
  });
  // unordered lists (consecutive - items)
  html = html.replace(/(?:^|\n)([ \t]*- [^\n]+(?:\n[ \t]*- [^\n]+)*)/gm, function(m, group) {
    var items = group.split('\n').map(function(l) { return l.replace(/^\s*-\s+/, ''); });
    return '\n<ul>' + items.map(function(it) { return '<li>' + inline(it) + '</li>'; }).join('') + '</ul>';
  });
  // ordered lists (consecutive 1. items)
  html = html.replace(/(?:^|\n)([ \t]*\d+\. [^\n]+(?:\n[ \t]*\d+\. [^\n]+)*)/gm, function(m, group) {
    var items = group.split('\n').map(function(l) { return l.replace(/^\s*\d+\.\s+/, ''); });
    return '\n<ol>' + items.map(function(it) { return '<li>' + inline(it) + '</li>'; }).join('') + '</ol>';
  });
  // inline code (before bold/italic)
  html = html.replace(/`([^`]+)`/g, function(_, code) { return '<code>' + code + '</code>'; });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

function inline(s) {
  return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function stripEmojis(str) {
  return str.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '').trim();
}

let chatHistory = [];

const CHAT_HISTORY_KEY = 'enar_history';
const CHAT_HISTORY_LIMIT = 30;

function saveChatHistory() {
  try { localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(chatHistory.slice(-CHAT_HISTORY_LIMIT))); } catch (e) {}
}

function loadChatHistory() {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return arr.filter(function(m) { return m && (m.role === 'user' || m.role === 'assistant') && m.content; });
  } catch (e) {}
  return [];
}

function clearChatHistory() {
  chatHistory = [];
  try { localStorage.removeItem(CHAT_HISTORY_KEY); } catch (e) {}
  const container = qs(SEL.chatMessages);
  if (container) container.innerHTML = '';
}

function addChatMessage(role, content) {
  var r = role === 'ai' ? 'assistant' : role;
  chatHistory.push({ role: r, content });
  saveChatHistory();
}

function appendChatBubble(role, content) {
  const container = qs(SEL.chatMessages);
  const div = document.createElement('div');
  div.className = 'chat-msg chat-msg-' + role;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'chat-msg-content';
  contentDiv.innerHTML = renderMarkdown(content);
  div.appendChild(contentDiv);

  if (role === 'ai') {
    const footer = document.createElement('div');
    footer.className = 'chat-msg-footer';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'chat-copy-btn';
    copyBtn.innerHTML = '<i class="nf nf-fa-copy"></i> Copiar';
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(content).catch(() => {});
      showToast('Copiado');
    });
    footer.appendChild(copyBtn);
    div.appendChild(footer);
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showChatThinking() {
  const el = qs(SEL.chatThinking);
  if (!el) return;
  el.style.display = '';
  el.offsetHeight; // force reflow to ensure paint before continuing
  const container = qs(SEL.chatMessages);
  container.scrollTop = container.scrollHeight;
}

function hideChatThinking() {
  const el = qs(SEL.chatThinking);
  if (el) el.style.display = 'none';
}

var chatPending = false;

async function buildChatContext() {
  var contextLines = [];
  var now = new Date();
  var today = now.toISOString().split('T')[0];
  contextLines.push('- Fecha/hora: ' + now.toLocaleString('es-VE'));
  await Promise.allSettled([
    invoke('list_products', { search: null, page: 1, pageSize: 20 }).then(function(r) {
      if (r && r.data) {
        contextLines.push('- Productos activos: ' + (r.total || 0));
        var names = r.data.map(function(p) { return p.nombre + ' ($' + p.precio_usd.toFixed(2) + ')'; }).join(', ');
        contextLines.push('- Productos: ' + names + ((r.total || 0) > 20 ? '...' : ''));
      }
    }),
    invoke('get_config_value', { key: CFG_TASA_DOLAR }).then(function(cfg) {
      if (cfg) contextLines.push('- Tasa del d\u00f3lar: Bs. ' + parseFloat(cfg).toFixed(2));
    }),
    invoke('get_caja_abierta').then(function(abierta) {
      contextLines.push('- Caja: ' + (abierta ? 'abierta' : 'cerrada'));
    }),
    invoke('list_categorias').then(function(cats) {
      if (cats && cats.length > 0) {
        var catNames = cats.map(function(c) { return c.nombre; }).join(', ');
        contextLines.push('- Categor\u00edas: ' + catNames);
      }
    }),
    invoke('get_daily_summary').then(function(todayRes) {
      if (todayRes) contextLines.push('- Ventas hoy: ' + (todayRes.total_ventas || 0) + ' por $' + (todayRes.total_usd || 0).toFixed(2));
    }),
    invoke('get_saldo_caja').then(function(saldo) {
      if (saldo) {
        contextLines.push('- Saldo de caja hoy: $' + (saldo.saldo_usd || 0).toFixed(2) + ' (Bs ' + (saldo.saldo_bs || 0).toFixed(2) + ')');
        if ((saldo.total_ingresos_usd || 0) > 0 || (saldo.total_egresos_usd || 0) > 0) {
          contextLines.push('- Movimientos de caja hoy: ingresos $' + (saldo.total_ingresos_usd || 0).toFixed(2) + ', egresos $' + (saldo.total_egresos_usd || 0).toFixed(2));
        }
      }
    }),
    invoke('get_sync_stats').then(function(stats) {
      if (stats) {
        contextLines.push('- Sync pendientes: productos ' + (stats.pending_products || 0) + ', clientes ' + (stats.pending_clientes || 0) + ', ventas ' + (stats.pending_ventas || 0) + ' (total ' + (stats.pending_total || 0) + ')');
        if (stats.ultimo_upload) contextLines.push('- Último upload productos: ' + stats.ultimo_upload);
      }
    }),
    invoke('get_conflictos').then(function(conflictos) {
      if (conflictos && conflictos.length > 0) contextLines.push('- Conflictos de sync sin resolver: ' + conflictos.length);
    }),
    invoke('list_combos_simple').then(function(combos) {
      if (combos && combos.length > 0) {
        var names = combos.slice(0, 5).map(function(c) { return c.nombre + ' ($' + c.precio_usd.toFixed(2) + ')'; }).join(', ');
        contextLines.push('- Combos (' + combos.length + '): ' + names + (combos.length > 5 ? '...' : ''));
      }
    }),
    invoke('get_dashboard_payment_methods', { period: 'day' }).then(function(metodos) {
      if (metodos && metodos.length > 0) {
        var str = metodos.map(function(m) { return formatMetodoLabel(m.metodo) + ' $' + m.total_usd.toFixed(2); }).join(', ');
        contextLines.push('- M\u00e9todos hoy: ' + str);
      }
    }),
    invoke('get_dashboard_summary').then(function(dash) {
      if (dash && dash.today) {
        if (dash.today.total_ganancia_usd !== undefined) {
          contextLines.push('- Ganancia hoy: $' + dash.today.total_ganancia_usd.toFixed(2) + ' (costo: $' + (dash.today.total_costo_usd || 0).toFixed(2) + ')');
        }
        if (dash.month && dash.month.total_ganancia_usd !== undefined) {
          contextLines.push('- Ganancia del mes: $' + dash.month.total_ganancia_usd.toFixed(2) + ' (de $' + dash.month.total_usd.toFixed(2) + ' en ventas)');
        }
      }
    }),
    invoke('get_top_products', { limit: 3 }).then(function(top) {
      if (top && top.length > 0) {
        var topStr = top.map(function(p) { return p.nombre + ' (' + p.cantidad_vendida + ' uds, $' + p.total_usd.toFixed(2) + ')'; }).join(', ');
        contextLines.push('- Más vendidos: ' + topStr);
      }
    }),
    invoke('list_products', { search: null, page: 1, pageSize: 200 }).then(function(lowStock) {
      if (lowStock && lowStock.data) {
        var low = lowStock.data.filter(function(p) { return p.stock < p.stock_minimo; });
        if (low.length > 0) {
          var lowStr = low.slice(0, 5).map(function(p) { return p.nombre + ' (stock: ' + p.stock + ', mínimo: ' + p.stock_minimo + ')'; }).join(', ');
          contextLines.push('- Stock bajo (' + low.length + '): ' + lowStr);
        }
      }
    }),
    invoke('list_clientes').then(function(clients) {
      if (clients && clients.length > 0) {
        var debtClients = clients.filter(function(c) { return c.saldo_deuda_usd > 0; });
        var temporales = clients.filter(function(c) { return c.es_temporal; });
        contextLines.push('- Clientes: ' + clients.length);
        if (temporales.length > 0) contextLines.push('- Clientes temporales activos: ' + temporales.length);
        if (debtClients.length > 0) {
          var debtStr = debtClients.slice(0, 5).map(function(c) { return c.nombre + ' ($' + c.saldo_deuda_usd.toFixed(2) + ')'; }).join(', ');
          contextLines.push('- Deudas (' + debtClients.length + '): ' + debtStr + (debtClients.length > 5 ? '...' : ''));
        }
      }
    }),
    invoke('get_sales_by_vendor', { startDate: today, endDate: today }).then(function(vendors) {
      if (vendors && vendors.length > 0) {
        var vStr = vendors.map(function(v) { return v.username + ' (' + v.total_ventas + ' ventas, $' + v.total_usd.toFixed(2) + ')'; }).join(', ');
        contextLines.push('- Ventas por vendedor hoy: ' + vStr);
      }
    }),
  ]);
  return contextLines;
}

async function handleChatSend(forcedText) {
  if (chatPending) return;
  const input = qs(SEL.chatInput);
  const text = forcedText || input.value.trim();
  if (!text) return;

  chatPending = true;
  const btn = qs(SEL.chatSendBtn);
  btn.disabled = true;

  input.value = '';
  input.style.height = 'auto';

  addChatMessage('user', text);
  appendChatBubble('user', text);
  showChatThinking();

  // Get live context (parallel)
  const contextLines = await buildChatContext();

  var systemPrompt = CHAT_SYSTEM_PROMPT;
  if (contextLines.length > 0) {
    systemPrompt += '\n\nDatos actuales del sistema:\n' + contextLines.join('\n');
  }
  if (currentUser) systemPrompt += '\n\nUsuario: ' + (currentUser.rol || '') + ' · Vista abierta: ' + (lastViewName || '') + '.';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
  ];

  try {
  const model = qs(SEL.openrouterModelWrap).dataset.value || '';
    const reply = await invoke('chat_with_ai', { messages, model });
    hideChatThinking();
    addChatMessage('ai', reply);
    appendChatBubble('ai', reply);
  } catch (e) {
    hideChatThinking();
    appendChatBubble('ai', 'Error: ' + e);
  } finally {
    btn.disabled = false;
    chatPending = false;
    input.focus();
  }
}

function toggleChat() {
  const panel = qs(SEL.chatPanel);
  const isOpening = panel.classList.contains('hidden');
  if (isOpening) positionChatPanel();
  panel.classList.toggle('hidden');
  if (!isOpening) return;
  if (chatHistory.length === 0 && !qs(SEL.chatMessages).querySelector('.chat-msg')) {
    const restored = loadChatHistory();
    if (restored.length > 0) {
      chatHistory = restored;
      const container = qs(SEL.chatMessages);
      restored.forEach(function(m) {
        appendChatBubble(m.role === 'assistant' ? 'ai' : 'user', m.content);
      });
      container.scrollTop = container.scrollHeight;
    } else {
      addChatMessage('ai', '\u00a1Hola! Soy Enar, tu asistente del POS. Preg\u00fantame sobre productos, ventas, clientes o lo que necesites del sistema.');
      appendChatBubble('ai', '\u00a1Hola! Soy Enar, tu asistente del POS. Preg\u00fantame sobre productos, ventas, clientes o lo que necesites del sistema.');
    }
  }
  if (!IS_ANDROID) qs(SEL.chatInput).focus();
  qs(SEL.chatMessages).scrollTop = qs(SEL.chatMessages).scrollHeight;
}

function positionChatPanel() {
  var fab = qs(SEL.chatFab);
  var panel = qs(SEL.chatPanel);
  var fabRect = fab.getBoundingClientRect();
  var margin = 8;
  var navH = (IS_ANDROID || window.innerWidth <= 768) ? ((qs(SEL.bottomTabs) || {}).offsetHeight || 60) : 0;
  var usableBottom = window.innerHeight - navH;
  var panelW = panel.offsetWidth || (window.innerWidth < 480 ? window.innerWidth - 16 : Math.min(360, window.innerWidth - 40));
  var prefH = panel.classList.contains('expanded') ? Math.min(600, window.innerHeight - 24) : Math.min(460, window.innerHeight - 24);

  var spaceAbove = fabRect.top - margin;
  var spaceBelow = usableBottom - fabRect.bottom - margin;
  var openAbove = spaceAbove >= spaceBelow || spaceAbove >= prefH - 40;
  if (spaceAbove < 220 && spaceBelow >= 220) openAbove = false;
  if (spaceBelow < 220 && spaceAbove >= 220) openAbove = true;

  var panelLeft = fabRect.right - panelW;
  if (panelLeft < margin) panelLeft = margin;
  if (panelLeft + panelW > window.innerWidth - margin) panelLeft = window.innerWidth - panelW - margin;
  if (panelLeft < margin) panelLeft = margin;
  panel.style.left = panelLeft + 'px';

  if (openAbove) {
    panel.style.top = 'auto';
    panel.style.bottom = (usableBottom - fabRect.top + margin) + 'px';
    var maxH = Math.max(200, Math.min(prefH, spaceAbove));
    panel.style.maxHeight = maxH + 'px';
  } else {
    panel.style.top = (fabRect.bottom + margin) + 'px';
    panel.style.bottom = 'auto';
    var maxHB = Math.max(200, Math.min(prefH, spaceBelow));
    panel.style.maxHeight = maxHB + 'px';
  }
}

