/* ========== TETRIS (Solo PC, gráficos monocromos a canvas) ==========
   Lógica pura (tetrisCreate/tetrisSpawn/tetrisStep/tetrisRotate/...) separada de la
   integración DOM para poder testearla. El juego vive en un modal y se dibuja en un
   <canvas> con estética monocroma estilo Game Boy: cada pieza tiene un patrón de
   bloque propio para distinguirse sin color. Solo PC (se oculta en Android). */

const TETRIS = {
  BASE_TICK_MS: 700,           // velocidad inicial (nivel 1)
  MIN_TICK_MS: 90,             // tope de velocidad
  TICK_STEP: 60,               // ms que se restan por nivel
};

/* Un solo tamaño fijo, igual al Tetris de Game Boy: 10 columnas x 18 filas.
   CELL = tamaño de cada celda en px para el canvas. */
const TETRIS_SIZE = { W: 10, H: 18, CELL: 18 };

/* Paletas monocromáticas (una sola tonalidad) con fondo claro y tonos suaves para
   que las piezas se vean bien. La primera es el default (Gris Game Boy). */
const TETRIS_PALETTES = {
  gbGray:  { label: 'Gris Game Boy', bg: '#e6e6dc', fg: '#5a5a52' },
  gbGreen: { label: 'Verde Game Boy', bg: '#9bbc0f', fg: '#34662b' },
  vboy:    { label: 'Virtual Boy', bg: '#ffd3d3', fg: '#c0392b' },
};
const TETRIS_PALETTE_KEY = 'tetris_palette';

/* Tipos de piezas (0 = vacío en el grid). Cada pieza = 4 estados de rotación,
   cada estado = lista de [fila, col] dentro de una caja 4x4. */
const TETRIS_PIECES = [
  // 0 I
  [[[1,0],[1,1],[1,2],[1,3]], [[0,2],[1,2],[2,2],[3,2]], [[2,0],[2,1],[2,2],[2,3]], [[0,1],[1,1],[2,1],[3,1]]],
  // 1 O
  [[[0,1],[0,2],[1,1],[1,2]], [[0,1],[0,2],[1,1],[1,2]], [[0,1],[0,2],[1,1],[1,2]], [[0,1],[0,2],[1,1],[1,2]]],
  // 2 T
  [[[0,1],[1,0],[1,1],[1,2]], [[0,1],[1,1],[1,2],[2,1]], [[1,0],[1,1],[1,2],[2,1]], [[0,1],[1,0],[1,1],[2,1]]],
  // 3 S
  [[[0,1],[0,2],[1,0],[1,1]], [[0,1],[1,1],[1,2],[2,2]], [[1,1],[1,2],[2,0],[2,1]], [[0,0],[1,0],[1,1],[2,1]]],
  // 4 Z
  [[[0,0],[0,1],[1,1],[1,2]], [[0,2],[1,1],[1,2],[2,1]], [[1,0],[1,1],[2,1],[2,2]], [[0,1],[1,0],[1,1],[2,0]]],
  // 5 J
  [[[0,0],[1,0],[1,1],[1,2]], [[0,1],[0,2],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,0],[2,1]]],
  // 6 L
  [[[0,2],[1,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[1,2],[2,0]], [[0,0],[0,1],[1,1],[2,1]]],
];

const TETRIS_LINES_SCORE = [0, 100, 300, 500, 800];

/* --- Lógica pura (testable) --- */
function tetrisCreate(w, h) {
  w = w || TETRIS_SIZE.W;
  h = h || TETRIS_SIZE.H;
  const grid = [];
  for (let y = 0; y < h; y++) grid.push(new Array(w).fill(0));
  return {
    w, h,
    grid,
    cur: null,          // { type, rot, x, y }
    next: 0,
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    running: false,
    over: false,
    pendingClear: null,
    tickMs: TETRIS.BASE_TICK_MS,
  };
}

function tetrisDrawFromBag(state) {
  if (state.bag.length === 0) {
    state.bag = [0, 1, 2, 3, 4, 5, 6];
    // mezcla simple (Fisher-Yates)
    for (let i = state.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = state.bag[i]; state.bag[i] = state.bag[j]; state.bag[j] = t;
    }
  }
  return state.bag.pop();
}

function tetrisSpawnX(w) {
  return Math.floor((w - 4) / 2);
}

function tetrisMakePiece(state, type) {
  return { type, rot: 0, x: tetrisSpawnX(state.w), y: 0 };
}

function tetrisCells(piece) {
  return TETRIS_PIECES[piece.type][piece.rot];
}

/* ¿Colisiona la pieza en (x, y, rot) con muros/piso/stack? y<0 se permite (fuera arriba). */
function tetrisCollision(state, type, rot, x, y) {
  const cells = TETRIS_PIECES[type][rot];
  for (let i = 0; i < cells.length; i++) {
    const cx = x + cells[i][1];
    const cy = y + cells[i][0];
    if (cx < 0 || cx >= state.w || cy >= state.h) return true;
    if (cy >= 0 && state.grid[cy][cx] !== 0) return true;
  }
  return false;
}

function tetrisSpawn(state) {
  const type = state.next;
  state.cur = tetrisMakePiece(state, type);
  state.next = tetrisDrawFromBag(state);
  if (tetrisCollision(state, state.cur.type, state.cur.rot, state.cur.x, state.cur.y)) {
    state.over = true;
  }
}

function tetrisMove(state, dx) {
  if (!state.cur || state.over) return false;
  if (!tetrisCollision(state, state.cur.type, state.cur.rot, state.cur.x + dx, state.cur.y)) {
    state.cur.x += dx;
    return true;
  }
  return false;
}

function tetrisRotate(state, dir) {
  if (!state.cur || state.over) return false;
  const newRot = (state.cur.rot + (dir > 0 ? 1 : 3)) % 4;
  if (!tetrisCollision(state, state.cur.type, newRot, state.cur.x, state.cur.y)) {
    state.cur.rot = newRot;
    return true;
  }
  // kick simple: intenta desplazar 1 a cada lado
  for (const kx of [-1, 1, -2, 2]) {
    if (!tetrisCollision(state, state.cur.type, newRot, state.cur.x + kx, state.cur.y)) {
      state.cur.rot = newRot;
      state.cur.x += kx;
      return true;
    }
  }
  return false;
}

/* Baja la pieza una fila. Devuelve true si pudo bajar. */
function tetrisTryDown(state) {
  if (!state.cur) return false;
  if (!tetrisCollision(state, state.cur.type, state.cur.rot, state.cur.x, state.cur.y + 1)) {
    state.cur.y += 1;
    return true;
  }
  return false;
}

function tetrisWritePiece(state) {
  const cells = tetrisCells(state.cur);
  for (let i = 0; i < cells.length; i++) {
    const cx = state.cur.x + cells[i][1];
    const cy = state.cur.y + cells[i][0];
    if (cy >= 0 && cy < state.h && cx >= 0 && cx < state.w) {
      state.grid[cy][cx] = state.cur.type + 1; // 1..7 en el grid
    }
  }
}

/* Devuelve los índices de las filas completas. */
function tetrisFindFullRows(state) {
  const rows = [];
  for (let y = 0; y < state.h; y++) {
    if (state.grid[y].every(c => c !== 0)) rows.push(y);
  }
  return rows;
}

/* Elimina las filas indicadas y compacta el tablero hacia arriba. */
function tetrisRemoveRows(state, rows) {
  const set = new Set(rows);
  const remaining = [];
  for (let y = 0; y < state.h; y++) {
    if (!set.has(y)) remaining.push(state.grid[y]);
  }
  while (remaining.length < state.h) remaining.unshift(new Array(state.w).fill(0));
  state.grid = remaining;
}

/* Elimina todas las filas completas. Devuelve la cantidad eliminada. */
function tetrisClearLines(state) {
  const rows = tetrisFindFullRows(state);
  tetrisRemoveRows(state, rows);
  return rows.length;
}

function tetrisApplyScore(state, cleared) {
  if (cleared > 0) {
    state.score += (TETRIS_LINES_SCORE[cleared] || 0) * state.level;
    state.lines += cleared;
    state.level = Math.floor(state.lines / 10) + 1;
    state.tickMs = Math.max(TETRIS.MIN_TICK_MS, TETRIS.BASE_TICK_MS - (state.level - 1) * TETRIS.TICK_STEP);
  }
}

/* Fija la pieza actual. Si hay líneas completas, las deja pendientes (pendingClear)
   y devuelve 'clear' SIN eliminarlas todavía (para animar la limpieza). Si no, spawnea
   la siguiente pieza y continúa. Devuelve: 'clear' | 'lock' | 'over'. */
function tetrisLock(state) {
  tetrisWritePiece(state);
  const rows = tetrisFindFullRows(state);
  if (rows.length > 0) {
    state.pendingClear = rows;
    return 'clear';
  }
  tetrisSpawn(state);
  return state.over ? 'over' : 'lock';
}

/* Aplica la limpieza pendiente, puntúa y spawnea la siguiente pieza.
   Devuelve: 'lock' | 'over'. */
function tetrisCommitClear(state) {
  const rows = state.pendingClear || [];
  tetrisRemoveRows(state, rows);
  tetrisApplyScore(state, rows.length);
  state.pendingClear = null;
  tetrisSpawn(state);
  return state.over ? 'over' : 'lock';
}

/* Gravedad de un tick. */
function tetrisStep(state) {
  if (!state.running || state.over) return 'stopped';
  if (tetrisTryDown(state)) return 'ok';
  return tetrisLock(state);
}

/* Caída instantánea. */
function tetrisHardDrop(state) {
  if (!state.cur || state.over) return 'over';
  while (tetrisTryDown(state)) { /* bajar */ }
  return tetrisLock(state);
}

/* --- Integración DOM --- */
let tetrisState = null;
let tetrisTimer = null;
let tetrisInit = false;
let tetrisPalette = TETRIS_PALETTES.gbGray;

function stopTetrisLoop() {
  if (tetrisTimer) { clearTimeout(tetrisTimer); tetrisTimer = null; }
}

function scheduleTetrisTick() {
  stopTetrisLoop();
  tetrisTimer = setTimeout(tetrisDoTick, tetrisState.tickMs);
}

function setTetrisStatus(text, kind) {
  const st = qs(SEL.tetrisStatus);
  if (!st) return;
  st.textContent = text;
  st.className = kind ? 'tetris-status ' + kind : 'tetris-status';
}

function updateTetrisPauseBtn() {
  const btn = qs(SEL.tetrisPauseBtn);
  if (!btn) return;
  const paused = tetrisState && !tetrisState.running && !tetrisState.over;
  btn.innerHTML = paused
    ? '<i class="nf nf-fa-play"></i> Continuar'
    : '<i class="nf nf-fa-pause"></i> Pausa';
}

function tetrisGetPalette() {
  try {
    if (TETRIS_PALETTES[localStorage.getItem(TETRIS_PALETTE_KEY)]) {
      return localStorage.getItem(TETRIS_PALETTE_KEY);
    }
  } catch (e) {}
  return 'gbGray';
}

function tetrisApplyPalette(key) {
  tetrisPalette = TETRIS_PALETTES[key] || TETRIS_PALETTES.gbGray;
  const frame = qs(SEL.tetrisFrame);
  if (frame) {
    frame.style.background = tetrisPalette.bg;
    frame.style.color = tetrisPalette.fg;
  }
  const field = qs(SEL.tetrisField);
  if (field) field.style.background = tetrisPalette.bg;
  const board = qs(SEL.tetrisBoard);
  if (board) board.style.background = tetrisPalette.bg;
  document.querySelectorAll(SEL.tetrisPaletteBtns).forEach(b => {
    const bp = TETRIS_PALETTES[b.dataset.palette];
    if (bp) {
      b.style.background = bp.bg;
      b.style.color = bp.fg;
      b.style.borderColor = bp.fg;
    }
    b.classList.toggle('active', b.dataset.palette === key);
  });
  try { localStorage.setItem(TETRIS_PALETTE_KEY, key); } catch (e) {}
  tetrisDrawBoard();
  tetrisDrawNext();
}

/* Dibuja un bloque con el patrón propio de la pieza (monocromo estilo Game Boy). */
function tetrisDrawBlock(ctx, px, py, s, type, fg, bg) {
  const gap = Math.max(1, Math.floor(s / 12));
  const x = px + gap, y = py + gap, w = s - gap * 2, h = s - gap * 2;
  ctx.fillStyle = fg;
  ctx.fillRect(x, y, w, h);
  // motivo distintivo por tipo (1..7)
  ctx.fillStyle = bg;
  const c = s / 2;
  switch (type) {
    case 1: // I: hueco central horizontal
      ctx.fillRect(x, y + h / 2 - gap, w, gap * 2);
      break;
    case 2: // O: hueco central cuadrado
      ctx.fillRect(x + w / 2 - c / 3, y + h / 2 - c / 3, (c * 2) / 3, (c * 2) / 3);
      break;
    case 3: // T: muesca arriba-centro
      ctx.fillRect(x + w / 2 - gap, y, gap * 2, h / 3);
      break;
    case 4: // S: diagonal \
      ctx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.6, gap);
      ctx.fillRect(x + w * 0.4, y + h * 0.4, w * 0.6, gap);
      ctx.fillRect(x + w * 0.2, y + h * 0.6, w * 0.6, gap);
      break;
    case 5: // Z: diagonal /
      ctx.fillRect(x + w * 0.2, y + h * 0.6, w * 0.6, gap);
      ctx.fillRect(x + w * 0.4, y + h * 0.4, w * 0.6, gap);
      ctx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.6, gap);
      break;
    case 6: // J: muesca esquina superior derecha
      ctx.fillRect(x + w - h / 3, y, h / 3, h / 3);
      break;
    case 7: // L: muesca esquina superior izquierda
      ctx.fillRect(x, y, h / 3, h / 3);
      break;
    default:
      break;
  }
}

function tetrisCellSize() {
  return TETRIS_SIZE.CELL;
}

function tetrisDrawBoard(clearRows, clearOn) {
  const board = qs(SEL.tetrisBoard);
  if (!board || !tetrisState) return;
  const dpr = (window.devicePixelRatio && window.devicePixelRatio > 1) ? window.devicePixelRatio : 1;
  const cell = tetrisCellSize();
  const cssW = tetrisState.w * cell, cssH = tetrisState.h * cell;
  board.width = cssW * dpr;
  board.height = cssH * dpr;
  board.style.width = cssW + 'px';
  board.style.height = cssH + 'px';
  const ctx = board.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = tetrisPalette.bg;
  ctx.fillRect(0, 0, cssW, cssH);
  // rejilla tenue
  ctx.strokeStyle = tetrisPalette.fg;
  ctx.globalAlpha = 0.12;
  ctx.lineWidth = 1;
  for (let x = 0; x <= tetrisState.w; x++) {
    ctx.beginPath(); ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, cssH); ctx.stroke();
  }
  for (let y = 0; y <= tetrisState.h; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(cssW, y * cell + 0.5); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const animating = !!clearRows;
  // ghost (sombra de dónde caerá)
  if (tetrisState.cur && !tetrisState.over && !animating) {
    let gy = tetrisState.cur.y;
    while (!tetrisCollision(tetrisState, tetrisState.cur.type, tetrisState.cur.rot, tetrisState.cur.x, gy + 1)) gy++;
    if (gy !== tetrisState.cur.y) {
      const gcells = tetrisCells(tetrisState.cur);
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = tetrisPalette.fg;
      for (let i = 0; i < gcells.length; i++) {
        const gx = tetrisState.cur.x + gcells[i][1];
        const gyy = gy + gcells[i][0];
        if (gyy >= 0) ctx.fillRect(gx * cell + 2, gyy * cell + 2, cell - 4, cell - 4);
      }
      ctx.globalAlpha = 1;
    }
  }
  // celdas fijas (las filas en proceso de limpieza parpadean)
  for (let y = 0; y < tetrisState.h; y++) {
    let inClear = false;
    if (clearRows) for (let i = 0; i < clearRows.length; i++) if (clearRows[i] === y) { inClear = true; break; }
    if (inClear) {
      if (clearOn) {
        ctx.fillStyle = tetrisPalette.fg;
        ctx.fillRect(0, y * cell + 1, cssW, cell - 2);
      }
      continue;
    }
    for (let x = 0; x < tetrisState.w; x++) {
      const v = tetrisState.grid[y][x];
      if (v !== 0) tetrisDrawBlock(ctx, x * cell, y * cell, cell, v, tetrisPalette.fg, tetrisPalette.bg);
    }
  }
  // pieza en caída
  if (tetrisState.cur && !tetrisState.over && !animating) {
    const cells = tetrisCells(tetrisState.cur);
    for (let i = 0; i < cells.length; i++) {
      const cx = tetrisState.cur.x + cells[i][1];
      const cy = tetrisState.cur.y + cells[i][0];
      if (cy >= 0) tetrisDrawBlock(ctx, cx * cell, cy * cell, cell, tetrisState.cur.type + 1, tetrisPalette.fg, tetrisPalette.bg);
    }
  }
}

function tetrisDrawNext() {
  const next = qs(SEL.tetrisNext);
  if (!next || !tetrisState) return;
  const dpr = (window.devicePixelRatio && window.devicePixelRatio > 1) ? window.devicePixelRatio : 1;
  const cell = 16;
  const cssW = 4 * cell, cssH = 4 * cell;
  next.width = cssW * dpr;
  next.height = cssH * dpr;
  next.style.width = cssW + 'px';
  next.style.height = cssH + 'px';
  const ctx = next.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = tetrisPalette.bg;
  ctx.fillRect(0, 0, cssW, cssH);
  const type = tetrisState.next;
  const cells = TETRIS_PIECES[type][0];
  // centrar en la caja 4x4
  let minR = 9, maxR = -9, minC = 9, maxC = -9;
  for (const [r, c] of cells) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
  const offR = (4 - (maxR - minR + 1)) / 2 - minR;
  const offC = (4 - (maxC - minC + 1)) / 2 - minC;
  for (const [r, c] of cells) {
    tetrisDrawBlock(ctx, (c + offC) * cell, (r + offR) * cell, cell, type + 1, tetrisPalette.fg, tetrisPalette.bg);
  }
}

function tetrisRenderUI() {
  const score = qs(SEL.tetrisScore);
  if (score) score.textContent = String(tetrisState.score);
  const lines = qs(SEL.tetrisLines);
  if (lines) lines.textContent = String(tetrisState.lines);
  const level = qs(SEL.tetrisLevel);
  if (level) level.textContent = String(tetrisState.level);
  tetrisDrawBoard();
  tetrisDrawNext();
}

/* --- Sonido (reutiliza el AudioContext global de la app) --- */
function tetrisBeep(freq, dur, type, mul) {
  try {
    if (typeof soundEnabled !== 'undefined' && soundEnabled === false) return;
    const ctx = getAudioCtx();
    const vol = (typeof soundVolume !== 'undefined' ? soundVolume : 1) * 0.22;
    playNote(ctx, freq, ctx.currentTime, dur, type || 'square', vol * (mul || 1));
  } catch (e) {}
}
function tetrisSndMove()   { tetrisBeep(240, 0.04, 'square'); }
function tetrisSndRotate() { tetrisBeep(360, 0.04, 'square'); }
function tetrisSndDrop()   { tetrisBeep(150, 0.07, 'square'); }
function tetrisSndClear(n) {
  tetrisBeep(720, 0.10, 'triangle');
  if (n >= 4) tetrisBeep(1040, 0.14, 'triangle', 0.9);
}
function tetrisSndLevel()  { tetrisBeep(980, 0.10, 'triangle'); tetrisBeep(1180, 0.12, 'triangle', 0.8); }
function tetrisSndOver() {
  try {
    if (typeof soundEnabled !== 'undefined' && soundEnabled === false) return;
    const ctx = getAudioCtx();
    const vol = (typeof soundVolume !== 'undefined' ? soundVolume : 1) * 0.22;
    playNote(ctx, 440, ctx.currentTime, 0.18, 'sawtooth', vol);
    playNote(ctx, 220, ctx.currentTime + 0.16, 0.40, 'sawtooth', vol);
  } catch (e) {}
}

function tetrisHexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
  return r + ',' + g + ',' + b;
}

function tetrisShowOverlay() {
  const ov = qs(SEL.tetrisOverlay);
  if (!ov) return;
  const sc = qs(SEL.tetrisOverScore); if (sc) sc.textContent = String(tetrisState.score);
  const ln = qs(SEL.tetrisOverLines); if (ln) ln.textContent = String(tetrisState.lines);
  const lv = qs(SEL.tetrisOverLevel); if (lv) lv.textContent = String(tetrisState.level);
  ov.classList.remove('hidden');
  ov.style.background = 'rgba(' + tetrisHexToRgb(tetrisPalette.bg) + ', 0.94)';
  ov.style.color = tetrisPalette.fg;
}
function tetrisHideOverlay() {
  const ov = qs(SEL.tetrisOverlay);
  if (ov) ov.classList.add('hidden');
}

let tetrisClearRaf = null;
function tetrisAnimateClear(rows, done) {
  if (!tetrisState || !rows || rows.length === 0) { done(); return; }
  stopTetrisLoop();
  const total = 240, frames = 4;
  let start = null;
  const draw = (ts) => {
    if (start === null) start = ts;
    const t = ts - start;
    const on = (Math.floor(t / (total / frames)) % 2) === 0;
    tetrisDrawBoard(rows, on);
    if (t >= total) { tetrisDrawBoard(); done(); return; }
    tetrisClearRaf = requestAnimationFrame(draw);
  };
  tetrisClearRaf = requestAnimationFrame(draw);
}

/* Rutea el resultado de un paso (gravedad, caída, movimiento) aplicando la
   animación de limpieza cuando corresponde y reprogramando el tick. */
function tetrisAdvance(result) {
  if (result === 'clear') {
    const rows = tetrisState.pendingClear || [];
    const n = rows.length;
    const lvlBefore = tetrisState.level;
    tetrisSndClear(n);
    tetrisAnimateClear(rows, () => {
      const cr = tetrisCommitClear(tetrisState);
      if (tetrisState.level > lvlBefore) tetrisSndLevel();
      tetrisRenderUI();
      if (cr === 'over') { tetrisBroadcastOver(); return; }
      if (tetrisState.running) scheduleTetrisTick();
    });
    return;
  }
  if (result === 'over') { tetrisBroadcastOver(); return; }
  tetrisRenderUI();
  if (tetrisState && tetrisState.running) scheduleTetrisTick();
}

function tetrisStart() {
  stopTetrisLoop();
  tetrisHideOverlay();
  tetrisState = tetrisCreate(TETRIS_SIZE.W, TETRIS_SIZE.H);
  tetrisState.next = tetrisDrawFromBag(tetrisState);
  tetrisSpawn(tetrisState);
  tetrisState.running = !tetrisState.over;
  setTetrisStatus(tetrisState.over ? 'GAME OVER · ' + tetrisState.score : 'Jugando', tetrisState.over ? 'over' : 'ok');
  updateTetrisPauseBtn();
  tetrisRenderUI();
  if (!tetrisState.over) scheduleTetrisTick();
}

function tetrisBroadcastOver() {
  tetrisState.running = false;
  tetrisState.over = true;
  stopTetrisLoop();
  tetrisRenderUI();
  tetrisShowOverlay();
  setTetrisStatus('GAME OVER · ' + tetrisState.score, 'over');
  tetrisSndOver();
}

function tetrisDoTick() {
  const modal = qs(SEL.tetrisModal);
  if (modal && modal.classList.contains('hidden')) { stopTetrisLoop(); return; }
  if (!tetrisState || !tetrisState.running || tetrisState.over) return;
  const r = tetrisStep(tetrisState);
  tetrisAdvance(r);
}

function tetrisTogglePause() {
  if (!tetrisState || tetrisState.over) return;
  tetrisState.running = !tetrisState.running;
  if (tetrisState.running) {
    setTetrisStatus('Jugando', 'ok');
    scheduleTetrisTick();
  } else {
    stopTetrisLoop();
    setTetrisStatus('PAUSA', 'paused');
  }
  updateTetrisPauseBtn();
}

function openTetris() {
  showModal(qs(SEL.tetrisModal));
  tetrisStart();
}

function closeTetris() {
  stopTetrisLoop();
  tetrisState = null;
  closeModal(qs(SEL.tetrisModal));
}

function tetrisHandleKey(e) {
  const modal = qs(SEL.tetrisModal);
  if (!modal || modal.classList.contains('hidden')) return;
  if (!tetrisState) return;
  const k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'p', 'P', 'r', 'R'].includes(k)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  } else if (k === 'x' || k === 'X' || k === 'z' || k === 'Z') {
    e.preventDefault();
    e.stopImmediatePropagation();
  } else {
    return;
  }
  if (!tetrisState.running) {
    if (k === 'r' || k === 'R' || k === 'Enter') tetrisStart();
    return;
  }
  switch (k) {
    case 'ArrowLeft': tetrisMove(tetrisState, -1); tetrisSndMove(); tetrisRenderUI(); break;
    case 'ArrowRight': tetrisMove(tetrisState, 1); tetrisSndMove(); tetrisRenderUI(); break;
    case 'ArrowDown': { const r = tetrisStep(tetrisState); tetrisSndMove(); tetrisAdvance(r); break; }
    case 'ArrowUp': case 'x': case 'X': tetrisRotate(tetrisState, 1); tetrisSndRotate(); tetrisRenderUI(); break;
    case 'z': case 'Z': tetrisRotate(tetrisState, -1); tetrisSndRotate(); tetrisRenderUI(); break;
    case ' ': { const r = tetrisHardDrop(tetrisState); tetrisSndDrop(); tetrisAdvance(r); break; }
    case 'p': case 'P': tetrisTogglePause(); break;
    case 'r': case 'R': tetrisStart(); break;
    default: break;
  }
}

function initTetris() {
  if (tetrisInit) return;
  tetrisInit = true;
  const juegoTab = document.querySelector(SEL.guideJuegoTab);
  if (IS_ANDROID) {
    if (juegoTab) juegoTab.style.display = 'none';
    return; // Tetris solo en PC
  }
  document.addEventListener('keydown', tetrisHandleKey, true);
  const btn = qs(SEL.tetrisBtn);
  if (btn) btn.addEventListener('click', function() { closeGuide(); openTetris(); });
  const close = qs(SEL.tetrisClose);
  if (close) close.addEventListener('click', closeTetris);
  const modal = qs(SEL.tetrisModal);
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeTetris(); });
  const pauseBtn = qs(SEL.tetrisPauseBtn);
  if (pauseBtn) pauseBtn.addEventListener('click', tetrisTogglePause);
  const restartBtn = qs(SEL.tetrisRestartBtn);
  if (restartBtn) restartBtn.addEventListener('click', tetrisStart);
  document.querySelectorAll(SEL.tetrisPaletteBtns).forEach(b => {
    b.addEventListener('click', function() { tetrisApplyPalette(b.dataset.palette); });
  });
  tetrisApplyPalette(tetrisGetPalette());
}
