/* ========== SNAKE (Solo PC, gráficos ASCII) ==========
   Lógica pura (snakeCreate/snakePlaceFood/snakeStep/snakeRender) separada de la
   integración DOM para poder testearla. El juego vive en un modal y se renderiza
   como texto en un <pre>. Solo disponible en escritorio (se oculta en Android). */

const SNAKE = {
  W: 24,
  H: 15,
  BASE_TICK_MS: 140,
  CHAR_EMPTY: '\u00b7',     // ·
  CHAR_BODY: '\u25a0',      // ■ (cuerpo P1)
  CHAR_BODY2: '\u25a1',     // □ (cuerpo P2)
  CHAR_HEAD: '@',           // cabeza P1
  CHAR_HEAD2: '%',          // cabeza P2
  CHAR_FOOD: '$',
  CHAR_WALL: '#',
};

/* Tamaños preestablecidos de la cuadrícula. */
const SNAKE_SIZES = {
  small:  { W: 16, H: 10 },
  medium: { W: 24, H: 15 },
  large:  { W: 32, H: 20 },
};
const SNAKE_SIZE_KEY = 'snake_size';
const SNAKE_2P_KEY = 'snake_2p';

/* Paletas monocromáticas (una sola tonalidad). La primera es el default (Gris Game Boy). */
const SNAKE_PALETTES = {
  gbGray:  { label: 'Gris Game Boy', bg: '#c6c6ba', fg: '#2b2b28' },
  gbGreen: { label: 'Verde Game Boy', bg: '#9bbc0f', fg: '#0f380f' },
  vboy:    { label: 'Virtual Boy', bg: '#2a0000', fg: '#ff2a2a' },
};
const SNAKE_PALETTE_KEY = 'snake_palette';

/* --- Lógica pura (testable) --- */
function snakeCreate(w, h, initial) {
  w = w || SNAKE.W;
  h = h || SNAKE.H;
  const headX = Math.floor(w / 2);
  const headY = Math.floor(h / 2);
  const body = initial || [
    { x: headX, y: headY },
    { x: headX - 1, y: headY },
    { x: headX - 2, y: headY },
  ];
  return {
    w,
    h,
    snake: body,        // índice 0 = cabeza
    dir: { x: 1, y: 0 },
    pendingDir: null,
    food: { x: -1, y: -1 },
    score: 0,
    running: false,
    over: false,
    tickMs: SNAKE.BASE_TICK_MS,
  };
}

function snakePlaceFood(state) {
  const empty = [];
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (!state.snake.some(s => s.x === x && s.y === y)) empty.push({ x, y });
    }
  }
  if (empty.length === 0) return false; // tablero lleno -> victoria
  state.food = empty[Math.floor(Math.random() * empty.length)];
  return true;
}

/* Devuelve: 'ok' | 'eat' | 'win' | 'wall' | 'self' */
function snakeStep(state) {
  let dx = state.dir.x, dy = state.dir.y;
  if (state.pendingDir && !(state.pendingDir.x === -dx && state.pendingDir.y === -dy)) {
    dx = state.pendingDir.x;
    dy = state.pendingDir.y;
  }
  const head = state.snake[0];
  const nx = head.x + dx, ny = head.y + dy;

  if (nx < 0 || ny < 0 || nx >= state.w || ny >= state.h) return 'wall';

  const eating = state.food.x === nx && state.food.y === ny;
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some(s => s.x === nx && s.y === ny)) return 'self';

  state.dir = { x: dx, y: dy };
  state.pendingDir = null;
  state.snake.unshift({ x: nx, y: ny });

  if (eating) {
    state.score += 10;
    state.tickMs = Math.max(70, state.tickMs - 3);
    if (!snakePlaceFood(state)) return 'win';
    return 'eat';
  }
  state.snake.pop();
  return 'ok';
}

function snakeRender(state) {
  const wall = SNAKE.CHAR_WALL;
  const top = Array(state.w + 2).fill(wall).join('');
  const lines = [top];
  for (let y = 0; y < state.h; y++) {
    let row = wall;
    for (let x = 0; x < state.w; x++) {
      if (state.snake[0].x === x && state.snake[0].y === y) row += SNAKE.CHAR_HEAD;
      else if (state.snake.some(s => s.x === x && s.y === y)) row += SNAKE.CHAR_BODY;
      else if (state.food.x === x && state.food.y === y) row += SNAKE.CHAR_FOOD;
      else row += SNAKE.CHAR_EMPTY;
    }
    row += wall;
    lines.push(row);
  }
  lines.push(top);
  return lines.join('\n');
}

/* ===== Lógica pura: 2 jugadores (sin paredes, bordes que envuelven) ===== */
function wrapPos(x, y, w, h) {
  return { x: ((x % w) + w) % w, y: ((y % h) + h) % h };
}

function snake2Create(w, h, p1initial, p2initial) {
  const cy = Math.floor(h / 2);
  const p1 = p1initial || [
    { x: Math.floor(w / 4), y: cy },
    { x: Math.floor(w / 4) - 1, y: cy },
    { x: Math.floor(w / 4) - 2, y: cy },
  ];
  const p2 = p2initial || [
    { x: Math.floor(w * 3 / 4), y: cy },
    { x: Math.floor(w * 3 / 4) + 1, y: cy },
    { x: Math.floor(w * 3 / 4) + 2, y: cy },
  ];
  return {
    w, h, twoPlayer: true, winner: null,
    players: [
      { name: 'P1', head: SNAKE.CHAR_HEAD, body: SNAKE.CHAR_BODY, snake: p1, dir: { x: 1, y: 0 }, pendingDir: null, score: 0 },
      { name: 'P2', head: SNAKE.CHAR_HEAD2, body: SNAKE.CHAR_BODY2, snake: p2, dir: { x: -1, y: 0 }, pendingDir: null, score: 0 },
    ],
    food: { x: -1, y: -1 },
    tickMs: SNAKE.BASE_TICK_MS,
  };
}

function snake2PlaceFood(state) {
  const occupied = (p) => state.players.some(pl => pl.snake.some(s => s.x === p.x && s.y === p.y));
  const empty = [];
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (!occupied({ x, y })) empty.push({ x, y });
    }
  }
  if (empty.length === 0) return false;
  state.food = empty[Math.floor(Math.random() * empty.length)];
  return true;
}

/* Avanza ambos jugadores de forma simultánea.
   Devuelve: 'ok' | 'P1' | 'P2' | 'tie' | 'win' (ganador/empate o tablero lleno). */
function snake2Step(state) {
  const step = (pl) => {
    if (pl.pendingDir && !(pl.pendingDir.x === -pl.dir.x && pl.pendingDir.y === -pl.dir.y)) {
      pl.dir = { x: pl.pendingDir.x, y: pl.pendingDir.y };
    }
    pl.pendingDir = null;
    const t = wrapPos(pl.snake[0].x + pl.dir.x, pl.snake[0].y + pl.dir.y, state.w, state.h);
    const eat = t.x === state.food.x && t.y === state.food.y;
    return { pl, t, eat };
  };
  const sa = step(state.players[0]);
  const sb = step(state.players[1]);
  const headClash = sa.t.x === sb.t.x && sa.t.y === sb.t.y;
  const na = [sa.t, ...(sa.eat ? sa.pl.snake : sa.pl.snake.slice(0, -1))];
  const nb = [sb.t, ...(sb.eat ? sb.pl.snake : sb.pl.snake.slice(0, -1))];
  const aSelf = na.slice(1).some(c => c.x === sa.t.x && c.y === sa.t.y);
  const aHitB = nb.some(c => c.x === sa.t.x && c.y === sa.t.y);
  const bSelf = nb.slice(1).some(c => c.x === sb.t.x && c.y === sb.t.y);
  const bHitA = na.some(c => c.x === sb.t.x && c.y === sb.t.y);
  const aDead = headClash || aSelf || aHitB;
  const bDead = headClash || bSelf || bHitA;

  if (aDead || bDead) {
    state.winner = aDead && bDead ? 'tie' : (aDead ? 'P2' : 'P1');
    return state.winner;
  }

  sa.pl.snake = na;
  sb.pl.snake = nb;
  if (sa.eat) { sa.pl.score += 10; state.tickMs = Math.max(70, state.tickMs - 3); }
  if (sb.eat) { sb.pl.score += 10; state.tickMs = Math.max(70, state.tickMs - 3); }
  if (sa.eat || sb.eat) {
    if (!snake2PlaceFood(state)) {
      state.winner = sa.pl.score >= sb.pl.score ? 'P1' : 'P2';
      return 'win';
    }
  }
  return 'ok';
}

/* Render sin paredes (bordes que envuelven): solo la región w×h. */
function snake2Render(state) {
  const pos = {};
  state.players.forEach(pl => {
    pl.snake.forEach((s, i) => { pos[s.x + ',' + s.y] = (i === 0) ? pl.head : pl.body; });
  });
  if (state.food.x >= 0) pos[state.food.x + ',' + state.food.y] = SNAKE.CHAR_FOOD;
  const lines = [];
  for (let y = 0; y < state.h; y++) {
    let row = '';
    for (let x = 0; x < state.w; x++) row += pos[x + ',' + y] || SNAKE.CHAR_EMPTY;
    lines.push(row);
  }
  return lines.join('\n');
}

/* --- Integración DOM --- */
let snakeState = null;
let snakeTimer = null;
let snakeInit = false;

function stopSnakeLoop() {
  if (snakeTimer) { clearTimeout(snakeTimer); snakeTimer = null; }
}

function scheduleSnakeTick() {
  stopSnakeLoop();
  snakeTimer = setTimeout(snakeDoTick, snakeState.tickMs);
}

function setSnakeStatus(text, kind) {
  const st = qs(SEL.snakeStatus);
  if (!st) return;
  st.textContent = text;
  st.className = kind ? 'snake-status ' + kind : 'snake-status';
}

function updateSnakePauseBtn() {
  const btn = qs(SEL.snakePauseBtn);
  if (!btn) return;
  const paused = snakeState && !snakeState.running && !snakeState.over;
  btn.innerHTML = paused
    ? '<i class="nf nf-fa-play"></i> Continuar'
    : '<i class="nf nf-fa-pause"></i> Pausa';
}

function snakeGetPalette() {
  try {
    if (SNAKE_PALETTES[localStorage.getItem(SNAKE_PALETTE_KEY)]) {
      return localStorage.getItem(SNAKE_PALETTE_KEY);
    }
  } catch (e) {}
  return 'gbGray';
}

/* Aplica el estilo monocromático al tablero y marca el botón activo. */
function snakeApplyPalette(key) {
  const p = SNAKE_PALETTES[key] || SNAKE_PALETTES.gbGray;
  const board = qs(SEL.snakeBoard);
  if (board) {
    board.style.background = p.bg;
    board.style.color = p.fg;
    board.style.borderColor = p.fg;
  }
  document.querySelectorAll(SEL.snakePaletteBtns).forEach(b => {
    const bp = SNAKE_PALETTES[b.dataset.palette];
    if (bp) {
      b.style.background = bp.bg;
      b.style.color = bp.fg;
      b.style.borderColor = bp.fg;
    }
    b.classList.toggle('active', b.dataset.palette === key);
  });
  try { localStorage.setItem(SNAKE_PALETTE_KEY, key); } catch (e) {}
}

function snakeGetSize() {
  try { if (SNAKE_SIZES[localStorage.getItem(SNAKE_SIZE_KEY)]) return localStorage.getItem(SNAKE_SIZE_KEY); } catch (e) {}
  return 'medium';
}

function snakeApplySize(size) {
  document.querySelectorAll(SEL.snakeSizeBtns).forEach(b => b.classList.toggle('active', b.dataset.size === size));
  try { localStorage.setItem(SNAKE_SIZE_KEY, size); } catch (e) {}
}

function snakeGet2p() {
  try { return localStorage.getItem(SNAKE_2P_KEY) === '1'; } catch (e) {}
  return false;
}

function snakeApply2p(enabled) {
  const t = qs(SEL.snake2pToggle);
  if (t) t.checked = !!enabled;
  const help = document.querySelector(SEL.snake2pHelp);
  if (help) help.classList.toggle('hidden', !enabled);
  try { localStorage.setItem(SNAKE_2P_KEY, enabled ? '1' : '0'); } catch (e) {}
}

function snakeRenderBoard() {
  const board = qs(SEL.snakeBoard);
  if (board && snakeState) {
    board.textContent = snakeState.twoPlayer ? snake2Render(snakeState) : snakeRender(snakeState);
  }
}

function snakeRenderUI() {
  const score = qs(SEL.snakeScore);
  if (score) score.textContent = String(snakeState.twoPlayer ? snakeState.players[0].score : snakeState.score);
  const p2 = qs(SEL.snakeScoreP2);
  if (p2) {
    p2.textContent = snakeState.twoPlayer ? String(snakeState.players[1].score) : '';
    p2.style.visibility = snakeState.twoPlayer ? 'visible' : 'hidden';
  }
  snakeRenderBoard();
}

function snakeStart() {
  stopSnakeLoop();
  const sz = SNAKE_SIZES[snakeGetSize()] || SNAKE_SIZES.medium;
  const two = snakeGet2p();
  if (two) {
    snakeState = snake2Create(sz.W, sz.H);
    snake2PlaceFood(snakeState);
    snakeState.running = true;
    setSnakeStatus('Jugando \u00b7 P1 (WASD) vs P2 (Flechas)', 'ok');
  } else {
    snakeState = snakeCreate(sz.W, sz.H);
    snakePlaceFood(snakeState);
    snakeState.running = true;
    setSnakeStatus('Jugando', 'ok');
  }
  updateSnakePauseBtn();
  snakeRenderUI();
  scheduleSnakeTick();
}

function snakeBroadcastResult(result) {
  snakeState.running = false;
  snakeState.over = true;
  stopSnakeLoop();
  snakeRenderBoard();
  if (snakeState.twoPlayer) {
    if (result === 'tie' || snakeState.winner === 'tie') setSnakeStatus('EMPATE \u00b7 ' + snakeState.players[0].score + ' - ' + snakeState.players[1].score, 'over');
    else setSnakeStatus('\u00a1Gana ' + (snakeState.winner || result) + '! \u00b7 ' + snakeState.players[0].score + ' - ' + snakeState.players[1].score, 'over');
  } else if (result === 'win') {
    setSnakeStatus('\u00a1Ganaste! \u00b7 Puntaje: ' + snakeState.score, 'over');
  } else {
    setSnakeStatus('GAME OVER \u00b7 Puntaje: ' + snakeState.score, 'over');
  }
}

function snakeDoTick() {
  const snakeModalEl = qs(SEL.snakeModal);
  if (snakeModalEl && snakeModalEl.classList.contains('hidden')) { stopSnakeLoop(); return; }
  if (!snakeState || !snakeState.running || snakeState.over) return;
  const result = snakeState.twoPlayer ? snake2Step(snakeState) : snakeStep(snakeState);
  if (result === 'wall' || result === 'self') { snakeBroadcastResult('wall'); return; }
  if (result === 'win') { snakeBroadcastResult('win'); return; }
  if (result === 'P1' || result === 'P2' || result === 'tie') { snakeBroadcastResult(result); return; }
  snakeRenderUI();
  scheduleSnakeTick();
}

function snakeTogglePause() {
  if (!snakeState || snakeState.over) return;
  snakeState.running = !snakeState.running;
  if (snakeState.running) {
    setSnakeStatus('Jugando', 'ok');
    scheduleSnakeTick();
  } else {
    stopSnakeLoop();
    setSnakeStatus('PAUSA', 'paused');
  }
  updateSnakePauseBtn();
}

function openSnake() {
  showModal(qs(SEL.snakeModal));
  snakeStart();
}

function closeSnake() {
  stopSnakeLoop();
  snakeState = null;
  closeModal(qs(SEL.snakeModal));
}

function snakeHandleKey(e) {
  const modal = qs(SEL.snakeModal);
  if (!modal || modal.classList.contains('hidden')) return;
  if (!snakeState) return;
  const k = e.key;
  const p1Map = {
    w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 },
    W: { x: 0, y: -1 }, S: { x: 0, y: 1 }, A: { x: -1, y: 0 }, D: { x: 1, y: 0 },
  };
  const p2Map = {
    ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  };
  if (snakeState.twoPlayer) {
    if (p2Map[k]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (snakeState.running) snakeState.players[1].pendingDir = p2Map[k];
      return;
    }
    if (p1Map[k]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (snakeState.running) snakeState.players[0].pendingDir = p1Map[k];
      return;
    }
  } else {
    const dir = p1Map[k] || p2Map[k];
    if (dir) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (snakeState.running) snakeState.pendingDir = dir;
      return;
    }
  }
  if (k === 'p' || k === 'P' || k === ' ') {
    e.preventDefault();
    e.stopImmediatePropagation();
    snakeTogglePause();
    return;
  }
  if (k === 'r' || k === 'R' || k === 'Enter') {
    e.preventDefault();
    e.stopImmediatePropagation();
    snakeStart();
    return;
  }
}

function initSnake() {
  if (snakeInit) return;
  snakeInit = true;
  const juegoTab = document.querySelector(SEL.guideJuegoTab);
  if (IS_ANDROID) {
    if (juegoTab) juegoTab.style.display = 'none';
    return; // Snake solo en PC
  }
  document.addEventListener('keydown', snakeHandleKey, true);
  const btn = qs(SEL.snakeBtn);
  if (btn) btn.addEventListener('click', function() { closeGuide(); openSnake(); });
  const close = qs(SEL.snakeClose);
  if (close) close.addEventListener('click', closeSnake);
  const modal = qs(SEL.snakeModal);
  if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeSnake(); });
  const pauseBtn = qs(SEL.snakePauseBtn);
  if (pauseBtn) pauseBtn.addEventListener('click', snakeTogglePause);
  const restartBtn = qs(SEL.snakeRestartBtn);
  if (restartBtn) restartBtn.addEventListener('click', snakeStart);
  document.querySelectorAll(SEL.snakePaletteBtns).forEach(b => {
    b.addEventListener('click', function() { snakeApplyPalette(b.dataset.palette); });
  });
  document.querySelectorAll(SEL.snakeSizeBtns).forEach(b => {
    b.addEventListener('click', function() { snakeApplySize(b.dataset.size); });
  });
  const twoToggle = qs(SEL.snake2pToggle);
  if (twoToggle) twoToggle.addEventListener('change', function() { snakeApply2p(twoToggle.checked); });
  snakeApplyPalette(snakeGetPalette());
  snakeApplySize(snakeGetSize());
  snakeApply2p(snakeGet2p());
}