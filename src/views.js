/* ========== CALCULATOR ========== */
const calcState = { expr: '', result: '0', memory: null, op: null, reset: false };

function initCalculator() {
  if (IS_ANDROID) return;
  qs(SEL.calcBtn).style.display = '';
  qs(SEL.calcBtn).addEventListener('click', openCalculator);
  qs(SEL.calcClose).addEventListener('click', closeCalculator);
  document.querySelectorAll('[data-calc]').forEach(btn => btn.addEventListener('click', () => calcInput(btn.dataset.calc)));
  qs(SEL.calcEquals).addEventListener('click', calcEquals);
  qs(SEL.calcTasaBtn).addEventListener('click', calcInsertTasa);
  document.addEventListener('keydown', calcKeydown);
}

function openCalculator() {
  showModal(qs(SEL.calcModal));
  calcRender();
  setTimeout(() => qs(SEL.calcModal).querySelector('.calc-buttons').focus(), TIMING.FOCUS_DELAY_MS);
}

function closeCalculator() { closeModal(qs(SEL.calcModal)); }

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
function initGuide() {
  qs(SEL.guideBtn).addEventListener('click', openGuide);
  qs(SEL.guideClose).addEventListener('click', closeGuide);
  qsa(SEL.guideTabs).forEach(tab => tab.addEventListener('click', () => switchGuideTab(tab.dataset.section)));
}

function openGuide() {
  showModal(qs(SEL.guideModal));
  const active = qs('.guide-tab.active');
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

function initColumnToggle() {
  qsa('table[data-col-toggle]').forEach(function(table) {
    var storageKey = table.dataset.colToggle;
    var theadRow = table.querySelector('thead tr');
    if (!theadRow) return;
    var ths = theadRow.querySelectorAll('th');
    if (ths.length === 0) return;

    var savedKey = 'col-vis-' + storageKey;
    var hiddenCols = new Set();
    try {
      var saved = JSON.parse(localStorage.getItem(savedKey));
      if (Array.isArray(saved)) hiddenCols = new Set(saved);
    } catch(e) {}

    var protectedCols = new Set();
    ths.forEach(function(th, idx) {
      var text = th.textContent.trim();
      if (text === 'Nombre' || text.indexOf('$') !== -1 || text === 'Acción' || text === 'Acciones') protectedCols.add(idx);
    });
    // Always protect first column (holds the refresh button)
    protectedCols.add(0);

    var styleId = 'col-style-' + storageKey;
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    function applyVisibility() {
      var tableId = table.id;
      if (!tableId) return;
      var rules = [];
      for (var i = 0; i < ths.length; i++) {
        if (hiddenCols.has(i) && !protectedCols.has(i)) {
          rules.push('#' + tableId + ' th:nth-child(' + (i + 1) + '), #' + tableId + ' td:nth-child(' + (i + 1) + ') { display: none !important; }');
        }
      }
      styleEl.textContent = rules.join('\n');
    }

    var resetAdded = false;
    ths.forEach(function(th, idx) {
      if (idx === 0 && !resetAdded) {
        resetAdded = true;
        var resetBtn = document.createElement('button');
        resetBtn.className = 'col-toggle-btn col-restore-btn';
        resetBtn.type = 'button';
        resetBtn.title = 'Restaurar todas las columnas';
        resetBtn.innerHTML = '<i class="nf nf-fa-refresh"></i>';
        resetBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          hiddenCols.clear();
          localStorage.setItem(savedKey, JSON.stringify([]));
          applyVisibility();
          var reload = TABLE_RELOADS[storageKey];
          if (reload) reload();
        });
        th.appendChild(resetBtn);
      }
      if (protectedCols.has(idx)) return;
      var btn = document.createElement('button');
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
  });
}

/* ========== CLOCK ========== */
function startClock() {
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
  setInterval(update, 1000);
}

/* ========== SIDEBAR AUTO-HIDE ========== */
let sidebarAutoHideEnabled = false;
let sidebarHideTimeout = null;

function initSidebarAutoHide() {
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
    qs(SEL.regSuccess).classList.remove('hidden');
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
      // password_change_required desactivado temporalmente
      /* if (res.password_change_required) {
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
      } */
      qs(SEL.loginScreen).style.display = 'none';
      qs(SEL.mainApp).style.display = 'flex';
      qs(SEL.bottomTabs).style.display = '';
      qs(SEL.sidebarUser).textContent = currentUser.username + ' (' + currentUser.rol + ')';
      startClock();
      initSidebarAutoHide();
      initCalculator();
      initGuide();
      initColumnToggle();
      loadSidebarAutoHideConfig();
      applyRoleUI();
      loadSyncAutoConfig();
      await loadTasa();
      updateConnectionState();
      await loadProductCache();
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
  currentUser = null; cart = []; lastCloseReportData = null;
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

/* ========== OPENROUTER / SUGERENCIAS ========== */
async function saveOpenRouterKey() {
  const key = qs(SEL.openrouterApiKey).value.trim();
  if (!key) { showToast('Ingresa una API key', 'error'); return; }
  try {
    await invoke('set_config_value', { key: CFG_OPENROUTER_API_KEY, value: key });
    showToast('API key guardada');
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function loadOpenRouterKey() {
  try {
    const key = await invoke('get_config_value', { key: CFG_OPENROUTER_API_KEY });
    if (key) qs(SEL.openrouterApiKey).value = key;
    const model = await invoke('get_config_value', { key: CFG_OPENROUTER_MODEL });
    if (model) setCustomSelectValue(qs(SEL.openrouterModelWrap), model);
  } catch (e) { showToast('Error al cargar configuración de OpenRouter: ' + e, 'error'); }
}

async function generateOrder() {
  const apiKey = qs(SEL.openrouterApiKey).value.trim();
  if (!apiKey) { showToast('Configura la API key de OpenRouter primero', 'error'); return; }
  const model = qs(SEL.openrouterModelWrap).dataset.value || '';
  showLoadingModal('Generando orden de compra...');
  await forcePaint();
  try {
    const content = await invoke('generate_purchase_suggestion', { apiKey, model });
    hideLoadingModal();
    qs(SEL.suggestionContent).textContent = content;
    showModal(qs(SEL.suggestionModal));
  } catch (e) {
    hideLoadingModal();
    showToast('Error: ' + e, 'error');
  }
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
const CHAT_SYSTEM_PROMPT = 'Eres Enar, un zorro experto asistente de un sistema POS llamado "Gestor de Ventas". Tu nombre es Enar. Solo respondes preguntas relacionadas con el sistema: ventas, inventario, clientes, crédito, reportes, caja, sincronización. Si te preguntan algo fuera de este tema, responde cortésmente que solo puedes ayudar con el POS. Responde en español, sé conciso, positivo y útil. NUNCA digas que no puedes hacer algo ni menciones limitaciones — limítate a lo que SÍ puedes hacer y sugiere acciones útiles. Puedes usar **negrita**, *cursiva* y emojis.';

function renderMarkdown(text) {
  var html = escapeHtml(text);
  // code blocks (```...```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  // inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

function stripEmojis(str) {
  return str.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '').trim();
}

let chatHistory = [];

function addChatMessage(role, content) {
  var r = role === 'ai' ? 'assistant' : role;
  chatHistory.push({ role: r, content });
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
  var contextLines = [];
  var now = new Date();
  contextLines.push('- Fecha/hora: ' + now.toLocaleString('es-VE'));
  var results = await Promise.allSettled([
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
        contextLines.push('- Clientes: ' + clients.length);
        if (debtClients.length > 0) {
          var debtStr = debtClients.slice(0, 5).map(function(c) { return c.nombre + ' ($' + c.saldo_deuda_usd.toFixed(2) + ')'; }).join(', ');
          contextLines.push('- Deudas (' + debtClients.length + '): ' + debtStr + (debtClients.length > 5 ? '...' : ''));
        }
      }
    }),
  ]);

  var systemPrompt = CHAT_SYSTEM_PROMPT;
  if (contextLines.length > 0) {
    systemPrompt += '\n\nDatos actuales del sistema:\n' + contextLines.join('\n');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
  ];

  try {
    const apiKey = qs(SEL.openrouterApiKey).value.trim();
    if (!apiKey) {
      hideChatThinking();
      appendChatBubble('ai', 'Primero configura la API key de OpenRouter en Configuración → IA.');
      return;
    }
  const model = qs(SEL.openrouterModelWrap).dataset.value || '';
    const reply = await invoke('chat_with_ai', { messages, apiKey, model });
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
  if (chatHistory.length === 0) {
    addChatMessage('ai', '\u00a1Hola! Soy Enar, tu asistente del POS. Preg\u00fantame sobre productos, ventas, clientes o lo que necesites del sistema.');
    appendChatBubble('ai', '\u00a1Hola! Soy Enar, tu asistente del POS. Preg\u00fantame sobre productos, ventas, clientes o lo que necesites del sistema.');
  }
  if (!IS_ANDROID) qs(SEL.chatInput).focus();
  qs(SEL.chatMessages).scrollTop = qs(SEL.chatMessages).scrollHeight;
}

function positionChatPanel() {
  var fab = qs(SEL.chatFab);
  var panel = qs(SEL.chatPanel);
  var fabRect = fab.getBoundingClientRect();
  var panelW = window.innerWidth < 480 ? window.innerWidth - 16 : Math.min(360, window.innerWidth - 40);
  var panelLeft = fabRect.right - panelW;
  if (panelLeft < 8) panelLeft = 8;
  if (panelLeft + panelW > window.innerWidth - 8) panelLeft = window.innerWidth - panelW - 8;
  panel.style.left = panelLeft + 'px';
  panel.style.bottom = (window.innerHeight - fabRect.top + 8) + 'px';
  panel.style.maxHeight = Math.min(460, Math.max(200, fabRect.top - 16)) + 'px';
}

