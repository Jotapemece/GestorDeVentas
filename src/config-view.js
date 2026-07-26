/* ========== AUDIT ========== */
let auditObserver = null;

async function loadAudit() {
  auditOffset = 0;
  const tbody = qs(SEL.auditBody);
  showSkeleton(tbody, 4);
  disconnectAuditObserver();
  await loadAuditMore();
}

function disconnectAuditObserver() {
  if (auditObserver) { auditObserver.disconnect(); auditObserver = null; }
}

function initAuditObserver() {
  disconnectAuditObserver();
  var sentinel = document.getElementById('audit-sentinel');
  if (!sentinel) return;
  auditObserver = new IntersectionObserver(function(entries) {
    if (entries[0].isIntersecting) {
      var btn = qs(SEL.auditLoadMore);
      if (btn && btn.style.display !== 'none') {
        loadAuditMore();
      }
    }
  }, { rootMargin: '200px' });
  auditObserver.observe(sentinel);
}

async function loadAuditMore() {
  try {
    const logs = await invoke('get_audit_logs', { limit: auditLimit, offset: auditOffset });
    const tbody = qs(SEL.auditBody);
    if (auditOffset === 0) tbody.innerHTML = '';
    if (logs.length === 0 && auditOffset === 0) {
      tbody.innerHTML = '<tr><td colspan="4">' + emptyState('<i class="nf nf-fa-history"></i>', 'No hay registros de auditor\u00eda', 'Las acciones del sistema aparecer\u00e1n aqu\u00ed') + '</td></tr>';
      qs(SEL.auditLoadMore).style.display = 'none';
      return;
    }
    const frag = document.createDocumentFragment();
    logs.forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = createAuditRow(log);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    auditOffset += logs.length;
    var hasMore = logs.length >= auditLimit;
    qs(SEL.auditLoadMore).style.display = hasMore ? 'inline-flex' : 'none';
    if (hasMore) initAuditObserver();
    else disconnectAuditObserver();
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

/* ========== CONFIG ========== */
async function loadThemeConfig() {
  try {
    let currentTheme = await getUserConfig(CFG_TEMA);
    if (!currentTheme) {
      try { currentTheme = localStorage.getItem(CFG_TEMA); } catch (_) {}
    }
    const theme = currentTheme || 'claro';
    applyTheme(theme);
    qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  } catch (e) { showToast('Error al cargar tema', 'error'); }
}

const themes = {
  oscuro: { '--bg': '#1A1825', '--card': '#282636', '--card-alt': '#333048', '--danger': '#823F3A', '--danger-dark': '#662E2A', '--primary': '#8A7BB3', '--primary-dark': '#6F5E9A', '--primary-rgb': '138, 123, 179', '--accent': '#4A9070', '--accent-dark': '#3A765A', '--accent-rgb': '74, 144, 112', '--danger-rgb': '130, 63, 58', '--success': '#3A9070', '--inari': '#C07030', '--overlay': 'rgba(0, 0, 0, 0.7)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.4)', '--hover': '#3A3752', '--border': '#4E4A68', '--text': '#E8E0F2', '--text-light': '#B0A8C4', '--text-secondary': '#B0A8C4', '--sidebar-bg': '#12101C', '--sidebar-text': '#C8C0D8', '--sidebar-text-rgb': '200, 192, 216' },
  claro: { '--bg': '#FAFAFA', '--card': '#FFFFFF', '--card-alt': '#F2F2F2', '--danger': '#D97373', '--danger-dark': '#C05555', '--primary': '#6C8EBF', '--primary-dark': '#5070A0', '--primary-rgb': '108, 142, 191', '--accent': '#6BAF8D', '--accent-dark': '#4A8F6D', '--accent-rgb': '107, 175, 141', '--danger-rgb': '217, 115, 115', '--success': '#4CAF50', '--inari': '#E67E22', '--overlay': 'rgba(0, 0, 0, 0.15)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#F5F5F5', '--border': '#DDDDDD', '--text': '#333333', '--text-light': '#777777', '--text-secondary': '#777777', '--sidebar-bg': '#F0F0F0', '--sidebar-text': '#333333', '--sidebar-text-rgb': '51, 51, 51' },
  azul: { '--bg': '#EDF2F7', '--card': '#FFFFFF', '--card-alt': '#F2F6FA', '--danger': '#E8A0A0', '--danger-dark': '#D48888', '--primary': '#7B9EBF', '--primary-dark': '#5A7D9E', '--primary-rgb': '123, 158, 191', '--accent': '#8FC1B5', '--accent-dark': '#6DA89A', '--accent-rgb': '143, 193, 181', '--danger-rgb': '232, 160, 160', '--success': '#60A090', '--inari': '#D08040', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#E2E8F0', '--border': '#CBD5E0', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#2C5282', '--sidebar-text': '#EBF4FF', '--sidebar-text-rgb': '235, 244, 255' },
  verde: { '--bg': '#F0F7F0', '--card': '#FFFFFF', '--card-alt': '#EAF3EA', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#A8C9A8', '--primary-dark': '#8BB08B', '--primary-rgb': '168, 201, 168', '--accent': '#B8DCC8', '--accent-dark': '#9CC8AC', '--accent-rgb': '184, 220, 200', '--danger-rgb': '212, 160, 160', '--success': '#5EAF5E', '--inari': '#D48840', '--overlay': 'rgba(0, 0, 0, 0.15)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.06)', '--hover': '#E6F0E6', '--border': '#D0E0D0', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#3A6A3A', '--sidebar-text': '#F0FFF0', '--sidebar-text-rgb': '240, 255, 240' },
  morado: { '--bg': '#F5F0FA', '--card': '#FFFFFF', '--card-alt': '#F0EAF5', '--danger': '#E0A8C0', '--danger-dark': '#CC90A8', '--primary': '#C4B0E0', '--primary-dark': '#B098D4', '--primary-rgb': '196, 176, 224', '--accent': '#D4A8DC', '--accent-dark': '#C090CA', '--accent-rgb': '212, 168, 220', '--danger-rgb': '224, 168, 192', '--success': '#80A880', '--inari': '#D49060', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(0, 0, 0, 0.08)', '--hover': '#F0EAF6', '--border': '#D8CCE8', '--text': '#2D3748', '--text-light': '#718096', '--text-secondary': '#718096', '--sidebar-bg': '#6A4C93', '--sidebar-text': '#F3E5F5', '--sidebar-text-rgb': '243, 229, 245' },
  turquesa: { '--bg': '#E6F7F5', '--card': '#F5FFFE', '--card-alt': '#EAF8F5', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#4DB8AC', '--primary-dark': '#3A9A8E', '--primary-rgb': '77, 184, 172', '--accent': '#80D0C4', '--accent-dark': '#60B8AA', '--accent-rgb': '128, 208, 196', '--danger-rgb': '212, 160, 160', '--success': '#50B8A0', '--inari': '#C88040', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(26, 74, 68, 0.08)', '--hover': '#E8F5F2', '--border': '#C0E0DA', '--text': '#1A4A44', '--text-light': '#5A7A74', '--text-secondary': '#5A7A74', '--sidebar-bg': '#B0E0D6', '--sidebar-text': '#1A4A44', '--sidebar-text-rgb': '26, 74, 68' },
  naranja: { '--bg': '#FDF0E8', '--card': '#FFF8F0', '--card-alt': '#F5EDE0', '--danger': '#D97050', '--danger-dark': '#C06040', '--primary': '#D47A4A', '--primary-dark': '#C06030', '--primary-rgb': '212, 122, 74', '--accent': '#E8A060', '--accent-dark': '#D48540', '--accent-rgb': '232, 160, 96', '--danger-rgb': '217, 112, 80', '--success': '#D4A040', '--inari': '#CC6010', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(74, 42, 16, 0.08)', '--hover': '#F8EDE0', '--border': '#E8D0B8', '--text': '#4A2A10', '--text-light': '#8A6A4A', '--text-secondary': '#8A6A4A', '--sidebar-bg': '#F0C8A8', '--sidebar-text': '#5C2A0A', '--sidebar-text-rgb': '92, 42, 10' },
  menta: { '--bg': '#EEF7EE', '--card': '#FFFFFF', '--card-alt': '#E8F5E8', '--danger': '#D4A0A0', '--danger-dark': '#C08888', '--primary': '#6BAF8D', '--primary-dark': '#4A8F6D', '--primary-rgb': '107, 175, 141', '--accent': '#8FC1A8', '--accent-dark': '#6DA88A', '--accent-rgb': '143, 193, 168', '--danger-rgb': '212, 160, 160', '--success': '#5AA85A', '--inari': '#D48040', '--overlay': 'rgba(0, 0, 0, 0.15)', '--shadow': '0 2px 12px rgba(58, 106, 74, 0.08)', '--hover': '#E6F5E6', '--border': '#D0E0D0', '--text': '#2A3A2A', '--text-light': '#5A7A6A', '--text-secondary': '#5A7A6A', '--sidebar-bg': '#B0D0B8', '--sidebar-text': '#2A4A3A', '--sidebar-text-rgb': '42, 74, 58' },
  rubi: { '--bg': '#FDF2F2', '--card': '#FFFFFF', '--card-alt': '#FDE8E8', '--danger': '#D45050', '--danger-dark': '#C03838', '--primary': '#C45050', '--primary-dark': '#A83838', '--primary-rgb': '196, 80, 80', '--accent': '#D47070', '--accent-dark': '#C05858', '--accent-rgb': '212, 112, 112', '--danger-rgb': '212, 80, 80', '--success': '#C05050', '--inari': '#D48040', '--overlay': 'rgba(0, 0, 0, 0.2)', '--shadow': '0 2px 12px rgba(80, 16, 16, 0.08)', '--hover': '#F8E0E0', '--border': '#E8C8C8', '--text': '#3D1A1A', '--text-light': '#8A5A5A', '--text-secondary': '#8A5A5A', '--sidebar-bg': '#B42A2A', '--sidebar-text': '#FDE8E8', '--sidebar-text-rgb': '253, 232, 232' }
};

let prevThemeKeys = null;
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (prevThemeKeys) {
    prevThemeKeys.forEach(key => document.documentElement.style.removeProperty(key));
  }
  const t = themes[theme];
  if (t) {
    prevThemeKeys = Object.keys(t);
    Object.entries(t).forEach(([key, val]) => {
      document.documentElement.style.setProperty(key, val);
    });
    try { localStorage.setItem(CFG_TEMA, theme); } catch (e) {}
  } else {
    prevThemeKeys = null;
  }
}

async function handleThemeClick(theme) {
  applyTheme(theme);
  qsa('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  try {
    await setUserConfig(CFG_TEMA, theme);
    showToast('Tema cambiado a ' + theme);
  } catch (e) { showToast('Error al guardar tema', 'error'); }
}

/* Share receipt via Web Share API */
function shareReceipt(venta) {
  if (navigator.share) {
    showToast('Recibo generado - Venta #' + venta.id, 'success');
    return;
  }
  copyReceiptToClipboard(venta);
}

function copyReceiptToClipboard(venta) {
  var text = buildReceiptText(venta);
  navigator.clipboard.writeText(text).then(function() {
    showToast('Recibo copiado al portapapeles', 'success');
  }).catch(function() {
    showToast('No se pudo copiar el recibo', 'error');
  });
}

function buildReceiptText(venta) {
  var items = venta.detalles || [];
  var lines = items.map(function(d) { return d.cantidad + 'x ' + d.nombre + ' = ' + formatUSD(d.subtotal); });
  return 'Venta #' + venta.id + '\n' +
    'Total: ' + formatUSD(venta.total_usd) + ' / ' + formatBS(venta.total_bs) + '\n' +
    'M\u00e9todo: ' + formatMetodoLabel(venta.metodo_pago) + '\n' +
    '---\n' + lines.join('\n') + '\n---\n' +
    '\u00a1Gracias por su compra!';
}

function shareReceiptById(ventaId) {
  invoke('get_sale_detail', { ventaId: ventaId }).then(function(detalles) {
    var venta = { id: ventaId, detalles: detalles, total_usd: 0, total_bs: 0, metodo_pago: '' };
    var totalUsd = 0;
    detalles.forEach(function(d) { totalUsd += d.subtotal_usd; });
    venta.total_usd = totalUsd;
    venta.total_bs = totalUsd * tasaActual;
    var text = buildReceiptText(venta);
    if (navigator.share) {
      navigator.share({ title: 'Venta #' + venta.id, text: text }).catch(function() {});
    } else {
      navigator.clipboard.writeText(text).then(function() {
        showToast('Recibo copiado al portapapeles', 'success');
      }).catch(function() {
        showToast('No se pudo copiar el recibo', 'error');
      });
    }
  }).catch(function(e) { showToast('Error al cargar venta', 'error'); });
}

/* ========== FONT SIZE ========== */
let currentFontPct = FONT_SIZE_DEFAULT;

function applyFontSize(pct) {
  currentFontPct = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, pct));
  const px = (16 * currentFontPct / 100).toFixed(1);
  document.documentElement.style.fontSize = px + 'px';
  qs(SEL.fontSizeDisplay).textContent = currentFontPct + '%';
}

async function loadFontSize() {
  try {
    const saved = await getUserConfig(CFG_FONT_SIZE);
    const pct = parseInt(saved) || FONT_SIZE_DEFAULT;
    applyFontSize(pct);
  } catch (e) { applyFontSize(FONT_SIZE_DEFAULT); }
}

async function saveFontSize(pct) {
  try {
    await setUserConfig(CFG_FONT_SIZE, String(pct));
  } catch (e) {}
}

/* ========== USER MANAGEMENT ========== */
async function loadUserList() {
  try {
    const users = await invoke('list_usuarios');
    const tbody = qs(SEL.userListBody);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3">' + emptyState('<i class="nf nf-fa-users"></i>', 'Sin usuarios', '') + '</td></tr>';
    } else {
      const frag = document.createDocumentFragment();
      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = createUserRow(u);
        frag.appendChild(tr);
      });
      tbody.appendChild(frag);
    }
  } catch (e) { showToast('Error: ' + e, 'error'); }
}

async function handleCreateUser() {
  const btn = qs(SEL.createUserBtn);
  const name = qs(SEL.newUserName).value.trim();
  const password = qs(SEL.newUserPassword).value;
  const rol = qs(SEL.newUserRol).value;
  if (!name || !password) { showToast('Complete todos los campos', 'error'); return; }
  if (password.length < MIN_PASSWORD_LEN) { showToast(`La contrase\u00f1a debe tener al menos ${MIN_PASSWORD_LEN} caracteres`, 'error'); return; }
  if (btn) btn.disabled = true;
  try {
    await invoke('create_usuario', { username: name, password, rol });
    showToast('Usuario creado exitosamente');
    qs(SEL.newUserName).value = '';
    qs(SEL.newUserPassword).value = '';
    loadUserList();
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
}

/* ========== CHANGE PASSWORD ========== */
async function handleChangePassword() {
  const btn = qs(SEL.changePwdBtn);
  const old = qs(SEL.changePwdOld).value;
  const newPwd = qs(SEL.changePwdNew).value;
  const confirm = qs(SEL.changePwdConfirm).value;
  if (!old || !newPwd || !confirm) { showToast('Complete todos los campos', 'error'); return; }
  if (newPwd !== confirm) { showToast('Las contrase\u00f1as nuevas no coinciden', 'error'); return; }
  if (newPwd.length < MIN_PASSWORD_LEN) { showToast(`La contrase\u00f1a debe tener al menos ${MIN_PASSWORD_LEN} caracteres`, 'error'); return; }
  if (btn) btn.disabled = true;
  try {
    await invoke('change_password', { request: { old_password: old, new_password: newPwd } });
    showToast('Contrase\u00f1a cambiada exitosamente');
    if (currentUser) currentUser.password_change_required = false;
    qs(SEL.changePwdOld).value = '';
    qs(SEL.changePwdNew).value = '';
    qs(SEL.changePwdConfirm).value = '';
    // Re-focus if this was a forced change from login
    qs(SEL.loginError).textContent = '';
  } catch (e) { showToast('Error: ' + e, 'error'); }
  finally { if (btn) btn.disabled = false; }
}

