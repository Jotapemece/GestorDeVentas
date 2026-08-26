/* ========== GLOBAL STATE (Store) ========== */
let currentUser = null;
let carts = [{ id: 1, items: [], folded: false }];
let cart = carts[0].items;
let cartIdCounter = 1;
let cartUndoStack = [];
let cartRedoStack = [];
let recentProducts = [];
let tasaActual = 0;
let tasaInventario = 0;
let tasaInventarioFecha = '';
let cartShowBs = false;
let saldoShowBs = false;

function loadStoredPrefs() {
  try {
    if (localStorage.getItem('cartShowBs') === '1') cartShowBs = true;
    if (localStorage.getItem('saldoShowBs') === '1') saldoShowBs = true;
  } catch (e) {}
}

function persistCartShowBs() {
  try { localStorage.setItem('cartShowBs', cartShowBs ? '1' : '0'); } catch (e) {}
}

function persistSaldoShowBs() {
  try { localStorage.setItem('saldoShowBs', saldoShowBs ? '1' : '0'); } catch (e) {}
}
let comboCache = [];
let editingProduct = null;
let editingClienteId = null;
let abonoClienteId = null;
let selectedClienteId = null;
let productCache = [];
let creditoRows = [];
let lastCloseReportData = null;
let lastViewName = VIEW.SALES;
let comaAutomaticaEnabled = false;
let calcularVuelto = true;
let redondeoBs = false;
let redondeoTotal = false;
let soundEnabled = true;
let soundVolume = 0.5;
let auditOffset = 0;
let auditLimit = AUDIT_LIMIT_DEFAULT;
let toastQueue = [];
let toastVisible = 0;
