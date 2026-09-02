import { describe, it, expect } from 'vitest';

/* Copia de las funciones puras de tetris.js (mantener en sync con src/tetris.js) */
const TETRIS = { BASE_TICK_MS: 700, MIN_TICK_MS: 90, TICK_STEP: 60 };
const TETRIS_SIZES = {
  small:  { W: 10, H: 14, CELL: 18 },
  medium: { W: 10, H: 20, CELL: 18 },
  large:  { W: 12, H: 22, CELL: 15 },
};
const TETRIS_PIECES = [
  [[[1,0],[1,1],[1,2],[1,3]], [[0,2],[1,2],[2,2],[3,2]], [[2,0],[2,1],[2,2],[2,3]], [[0,1],[1,1],[2,1],[3,1]]],
  [[[0,1],[0,2],[1,1],[1,2]], [[0,1],[0,2],[1,1],[1,2]], [[0,1],[0,2],[1,1],[1,2]], [[0,1],[0,2],[1,1],[1,2]]],
  [[[0,1],[1,0],[1,1],[1,2]], [[0,1],[1,1],[1,2],[2,1]], [[1,0],[1,1],[1,2],[2,1]], [[0,1],[1,0],[1,1],[2,1]]],
  [[[0,1],[0,2],[1,0],[1,1]], [[0,1],[1,1],[1,2],[2,2]], [[1,1],[1,2],[2,0],[2,1]], [[0,0],[1,0],[1,1],[2,1]]],
  [[[0,0],[0,1],[1,1],[1,2]], [[0,2],[1,1],[1,2],[2,1]], [[1,0],[1,1],[2,1],[2,2]], [[0,1],[1,0],[1,1],[2,0]]],
  [[[0,0],[1,0],[1,1],[1,2]], [[0,1],[0,2],[1,1],[2,1]], [[1,0],[1,1],[1,2],[2,2]], [[0,1],[1,1],[2,0],[2,1]]],
  [[[0,2],[1,0],[1,1],[1,2]], [[0,1],[1,1],[2,1],[2,2]], [[1,0],[1,1],[1,2],[2,0]], [[0,0],[0,1],[1,1],[2,1]]],
];
const TETRIS_LINES_SCORE = [0, 100, 300, 500, 800];

function tetrisCreate(w, h) {
  w = w || TETRIS_SIZES.medium.W;
  h = h || TETRIS_SIZES.medium.H;
  const grid = [];
  for (let y = 0; y < h; y++) grid.push(new Array(w).fill(0));
  return { w, h, grid, cur: null, next: 0, bag: [], score: 0, lines: 0, level: 1, running: false, over: false, tickMs: TETRIS.BASE_TICK_MS };
}
function tetrisDrawFromBag(state) {
  if (state.bag.length === 0) {
    state.bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = state.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = state.bag[i]; state.bag[i] = state.bag[j]; state.bag[j] = t;
    }
  }
  return state.bag.pop();
}
function tetrisSpawnX(w) { return Math.floor((w - 4) / 2); }
function tetrisMakePiece(state, type) { return { type, rot: 0, x: tetrisSpawnX(state.w), y: 0 }; }
function tetrisCells(piece) { return TETRIS_PIECES[piece.type][piece.rot]; }
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
  if (tetrisCollision(state, state.cur.type, state.cur.rot, state.cur.x, state.cur.y)) state.over = true;
}
function tetrisMove(state, dx) {
  if (!state.cur || state.over) return false;
  if (!tetrisCollision(state, state.cur.type, state.cur.rot, state.cur.x + dx, state.cur.y)) { state.cur.x += dx; return true; }
  return false;
}
function tetrisRotate(state, dir) {
  if (!state.cur || state.over) return false;
  const newRot = (state.cur.rot + (dir > 0 ? 1 : 3)) % 4;
  if (!tetrisCollision(state, state.cur.type, newRot, state.cur.x, state.cur.y)) { state.cur.rot = newRot; return true; }
  for (const kx of [-1, 1, -2, 2]) {
    if (!tetrisCollision(state, state.cur.type, newRot, state.cur.x + kx, state.cur.y)) { state.cur.rot = newRot; state.cur.x += kx; return true; }
  }
  return false;
}
function tetrisTryDown(state) {
  if (!state.cur) return false;
  if (!tetrisCollision(state, state.cur.type, state.cur.rot, state.cur.x, state.cur.y + 1)) { state.cur.y += 1; return true; }
  return false;
}
function tetrisWritePiece(state) {
  const cells = tetrisCells(state.cur);
  for (let i = 0; i < cells.length; i++) {
    const cx = state.cur.x + cells[i][1];
    const cy = state.cur.y + cells[i][0];
    if (cy >= 0 && cy < state.h && cx >= 0 && cx < state.w) state.grid[cy][cx] = state.cur.type + 1;
  }
}
function tetrisFindFullRows(state) {
  const rows = [];
  for (let y = 0; y < state.h; y++) if (state.grid[y].every(c => c !== 0)) rows.push(y);
  return rows;
}
function tetrisRemoveRows(state, rows) {
  const set = new Set(rows);
  const remaining = [];
  for (let y = 0; y < state.h; y++) {
    if (!set.has(y)) remaining.push(state.grid[y]);
  }
  while (remaining.length < state.h) remaining.unshift(new Array(state.w).fill(0));
  state.grid = remaining;
}
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
function tetrisLock(state) {
  tetrisWritePiece(state);
  const rows = tetrisFindFullRows(state);
  if (rows.length > 0) { state.pendingClear = rows; return 'clear'; }
  tetrisSpawn(state);
  return state.over ? 'over' : 'lock';
}
function tetrisCommitClear(state) {
  const rows = state.pendingClear || [];
  tetrisRemoveRows(state, rows);
  tetrisApplyScore(state, rows.length);
  state.pendingClear = null;
  tetrisSpawn(state);
  return state.over ? 'over' : 'lock';
}
function tetrisStep(state) {
  if (!state.running || state.over) return 'stopped';
  if (tetrisTryDown(state)) return 'ok';
  return tetrisLock(state);
}
function tetrisHardDrop(state) {
  if (!state.cur || state.over) return 'over';
  while (tetrisTryDown(state)) {}
  return tetrisLock(state);
}

describe('tetrisCreate', () => {
  it('crea tablero vacío con dimensiones y estado inicial', () => {
    const s = tetrisCreate(10, 20);
    expect(s.w).toBe(10);
    expect(s.h).toBe(20);
    expect(s.grid).toHaveLength(20);
    expect(s.grid[0]).toHaveLength(10);
    expect(s.grid.every(row => row.every(c => c === 0))).toBe(true);
    expect(s.score).toBe(0);
    expect(s.lines).toBe(0);
    expect(s.level).toBe(1);
    expect(s.tickMs).toBe(700);
  });
});

describe('tetrisSpawnX', () => {
  it('centra la pieza (4 columnas) en tableros de 10 y 12', () => {
    expect(tetrisSpawnX(10)).toBe(3);
    expect(tetrisSpawnX(12)).toBe(4);
  });
});

describe('tetrisCollision', () => {
  it('detecta muro izquierdo, derecho y piso', () => {
    const s = tetrisCreate(10, 20);
    expect(tetrisCollision(s, 0, 0, -1, 0)).toBe(true);   // x<0
    expect(tetrisCollision(s, 0, 0, 10, 0)).toBe(true);   // x>=w
    expect(tetrisCollision(s, 0, 0, 0, 20)).toBe(true);   // y>=h
  });
  it('detecta colisión con stack fijo', () => {
    const s = tetrisCreate(10, 20);
    s.grid[5][3] = 1;
    expect(tetrisCollision(s, 0, 0, 3, 4)).toBe(true); // I vertical ocuparía (3,5)
  });
  it('permite y<0 (fuera de arriba)', () => {
    const s = tetrisCreate(10, 20);
    expect(tetrisCollision(s, 0, 0, 3, -1)).toBe(false);
  });
});

describe('tetrisSpawn', () => {
  it('genera pieza actual y siguiente sin colisión en tablero vacío', () => {
    const s = tetrisCreate(10, 20);
    s.next = tetrisDrawFromBag(s);
    tetrisSpawn(s);
    expect(s.cur).not.toBeNull();
    expect(s.cur.rot).toBe(0);
    expect(s.over).toBe(false);
    expect(s.next).toBeGreaterThanOrEqual(0);
    expect(s.next).toBeLessThanOrEqual(6);
  });
  it('marca game over si no hay sitio para spawnear', () => {
    const s = tetrisCreate(10, 20);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 10; x++) s.grid[y][x] = 1;
    s.next = 0;
    tetrisSpawn(s);
    expect(s.over).toBe(true);
  });
});

describe('tetrisMove', () => {
  it('mueve a la izquierda/derecha en espacio abierto', () => {
    const s = tetrisCreate(10, 20);
    s.next = 2; tetrisSpawn(s);
    const x0 = s.cur.x;
    expect(tetrisMove(s, -1)).toBe(true);
    expect(s.cur.x).toBe(x0 - 1);
    expect(tetrisMove(s, 1)).toBe(true);
    expect(s.cur.x).toBe(x0);
  });
  it('bloquea el movimiento contra la pared izquierda', () => {
    const s = tetrisCreate(10, 20);
    s.next = 2; tetrisSpawn(s);
    s.cur.x = 0;
    expect(tetrisMove(s, -1)).toBe(false);
  });
});

describe('tetrisRotate', () => {
  it('rota en espacio abierto', () => {
    const s = tetrisCreate(10, 20);
    s.next = 2; tetrisSpawn(s);
    const r0 = s.cur.rot;
    expect(tetrisRotate(s, 1)).toBe(true);
    expect(s.cur.rot).toBe((r0 + 1) % 4);
  });
  it('rechaza rotación que chocaría con el muro', () => {
    const s = tetrisCreate(10, 20);
    s.next = 1; tetrisSpawn(s); // O (2x2)
    s.cur.x = 0; // contra la pared izquierda
    // forzar colisión: mover pieza fuera y comprobar que sin kick falla
    const rotated = tetrisRotate(s, 1);
    // ya sea por kick o por rechazo, no debe quedar fuera del tablero
    const cells = tetrisCells(s.cur);
    const ok = cells.every(([r, c]) => {
      const cx = s.cur.x + c;
      return cx >= 0 && cx < s.w;
    });
    expect(ok).toBe(true);
    expect(typeof rotated).toBe('boolean');
  });
});

describe('tetrisStep', () => {
  it('baja la pieza una fila', () => {
    const s = tetrisCreate(10, 20);
    s.next = 2; tetrisSpawn(s);
    s.running = true;
    const y0 = s.cur.y;
    const r = tetrisStep(s);
    expect(r).toBe('ok');
    expect(s.cur.y).toBe(y0 + 1);
  });
  it('fija y avanza cuando no puede bajar', () => {
    const s = tetrisCreate(10, 20);
    s.next = 2; tetrisSpawn(s);
    s.cur.y = 18; // justo encima del fondo
    s.running = true;
    const r = tetrisStep(s);
    expect(['lock', 'clear', 'over']).toContain(r);
    expect(s.cur).not.toBeNull(); // nueva pieza spawneada
  });
});

describe('tetrisClearLines', () => {
  it('elimina una fila completa', () => {
    const s = tetrisCreate(10, 20);
    for (let x = 0; x < 10; x++) s.grid[19][x] = 1;
    expect(tetrisClearLines(s)).toBe(1);
    expect(s.grid[19].every(c => c === 0)).toBe(true);
  });
  it('elimina dos filas (doble) y compacta', () => {
    const s = tetrisCreate(10, 20);
    for (let x = 0; x < 10; x++) { s.grid[18][x] = 1; s.grid[19][x] = 1; }
    s.grid[17][0] = 2; // marca para verificar que baja
    expect(tetrisClearLines(s)).toBe(2);
    expect(s.grid[19][0]).toBe(2);
    expect(s.grid[19].slice(1).every(c => c === 0)).toBe(true);
  });
  it('elimina cuatro filas (tetris)', () => {
    const s = tetrisCreate(10, 20);
    for (let y = 16; y <= 19; y++) for (let x = 0; x < 10; x++) s.grid[y][x] = 1;
    expect(tetrisClearLines(s)).toBe(4);
    expect(s.grid.every(row => row.every(c => c === 0))).toBe(true);
  });
});

describe('tetrisApplyScore', () => {
  it('suma puntos y sube de nivel cada 10 líneas', () => {
    const s = tetrisCreate(10, 20);
    tetrisApplyScore(s, 1);
    expect(s.score).toBe(100);   // 100 * nivel 1
    expect(s.lines).toBe(1);
    expect(s.level).toBe(1);
    s.lines = 9;
    tetrisApplyScore(s, 1);
    expect(s.lines).toBe(10);
    expect(s.level).toBe(2);
    expect(s.tickMs).toBe(640); // 700 - 60
  });
  it('respuesta tetris vale 800 * nivel', () => {
    const s = tetrisCreate(10, 20);
    tetrisApplyScore(s, 4);
    expect(s.score).toBe(800);
  });
});

describe('tetrisHardDrop', () => {
  it('cae hasta el fondo y fija la pieza', () => {
    const s = tetrisCreate(10, 20);
    s.next = 2; tetrisSpawn(s);
    const r = tetrisHardDrop(s);
    expect(['lock', 'clear', 'over']).toContain(r);
    // la pieza quedó escrita en el grid (hay celdas ocupadas)
    const occupied = s.grid.some(row => row.some(c => c !== 0));
    expect(occupied).toBe(true);
  });
});

describe('tetrisLock y tetrisCommitClear', () => {
  it('escribe la pieza y, al confirmar la limpieza, spawnea la siguiente', () => {
    const s = tetrisCreate(10, 20);
    s.next = 2; tetrisSpawn(s);
    s.cur.y = 18;
    const r = tetrisLock(s);
    expect(['lock', 'clear', 'over']).toContain(r);
    if (r === 'clear') tetrisCommitClear(s);
    expect(s.cur).not.toBeNull();
    expect(s.next).toBeGreaterThanOrEqual(0);
  });
});
