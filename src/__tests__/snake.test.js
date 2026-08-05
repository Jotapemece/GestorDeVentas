import { describe, it, expect } from 'vitest';

/* Copia de las funciones puras de snake.js (mantener en sync con src/snake.js) */
const CHAR_EMPTY = '\u00b7';
const CHAR_BODY = '\u25a0';
const CHAR_BODY2 = '\u25a1';
const CHAR_HEAD = '@';
const CHAR_HEAD2 = '%';
const CHAR_FOOD = '$';
const CHAR_WALL = '#';

function snakeCreate(w, h, initial) {
  const headX = Math.floor(w / 2);
  const headY = Math.floor(h / 2);
  const body = initial || [
    { x: headX, y: headY },
    { x: headX - 1, y: headY },
    { x: headX - 2, y: headY },
  ];
  return {
    w, h, snake: body, dir: { x: 1, y: 0 }, pendingDir: null,
    food: { x: -1, y: -1 }, score: 0, running: false, over: false, tickMs: 140,
  };
}

function snakePlaceFood(state) {
  const empty = [];
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (!state.snake.some(s => s.x === x && s.y === y)) empty.push({ x, y });
    }
  }
  if (empty.length === 0) return false;
  state.food = empty[Math.floor(Math.random() * empty.length)];
  return true;
}

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
  const top = Array(state.w + 2).fill(CHAR_WALL).join('');
  const lines = [top];
  for (let y = 0; y < state.h; y++) {
    let row = CHAR_WALL;
    for (let x = 0; x < state.w; x++) {
      if (state.snake[0].x === x && state.snake[0].y === y) row += CHAR_HEAD;
      else if (state.snake.some(s => s.x === x && s.y === y)) row += CHAR_BODY;
      else if (state.food.x === x && state.food.y === y) row += CHAR_FOOD;
      else row += CHAR_EMPTY;
    }
    row += CHAR_WALL;
    lines.push(row);
  }
  lines.push(top);
  return lines.join('\n');
}

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
      { name: 'P1', head: CHAR_HEAD, body: CHAR_BODY, snake: p1, dir: { x: 1, y: 0 }, pendingDir: null, score: 0 },
      { name: 'P2', head: CHAR_HEAD2, body: CHAR_BODY2, snake: p2, dir: { x: -1, y: 0 }, pendingDir: null, score: 0 },
    ],
    food: { x: -1, y: -1 },
    tickMs: 140,
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

function snake2Render(state) {
  const pos = {};
  state.players.forEach(pl => {
    pl.snake.forEach((s, i) => { pos[s.x + ',' + s.y] = (i === 0) ? pl.head : pl.body; });
  });
  if (state.food.x >= 0) pos[state.food.x + ',' + state.food.y] = CHAR_FOOD;
  const lines = [];
  for (let y = 0; y < state.h; y++) {
    let row = '';
    for (let x = 0; x < state.w; x++) row += pos[x + ',' + y] || CHAR_EMPTY;
    lines.push(row);
  }
  return lines.join('\n');
}

describe('snakeCreate', () => {
  it('crea serpiente centrada de 3 segmentos moviéndose a la derecha', () => {
    const s = snakeCreate(10, 10);
    expect(s.snake).toHaveLength(3);
    expect(s.snake[0]).toEqual({ x: 5, y: 5 });
    expect(s.dir).toEqual({ x: 1, y: 0 });
    expect(s.score).toBe(0);
    expect(s.w).toBe(10);
    expect(s.h).toBe(10);
  });

  it('acepta estado inicial custom', () => {
    const body = [{ x: 9, y: 5 }, { x: 8, y: 5 }];
    const s = snakeCreate(10, 10, body);
    expect(s.snake[0]).toEqual({ x: 9, y: 5 });
  });
});

describe('snakeStep', () => {
  it('avanza un paso sin crecer', () => {
    const s = snakeCreate(10, 10);
    const r = snakeStep(s);
    expect(r).toBe('ok');
    expect(s.snake[0]).toEqual({ x: 6, y: 5 });
    expect(s.snake).toHaveLength(3);
  });

  it('aplica dirección pendiente (girar arriba)', () => {
    const s = snakeCreate(10, 10);
    s.pendingDir = { x: 0, y: -1 };
    snakeStep(s);
    expect(s.snake[0]).toEqual({ x: 5, y: 4 });
  });

  it('ignora giro de 180 grados (no reversa)', () => {
    const s = snakeCreate(10, 10);
    s.pendingDir = { x: -1, y: 0 };
    snakeStep(s);
    expect(s.snake[0]).toEqual({ x: 6, y: 5 });
  });

  it('come la comida: crece y suma puntos', () => {
    const s = snakeCreate(10, 10);
    s.food = { x: 6, y: 5 };
    const r = snakeStep(s);
    expect(r).toBe('eat');
    expect(s.snake).toHaveLength(4);
    expect(s.score).toBe(10);
    expect(s.snake[0]).toEqual({ x: 6, y: 5 });
  });

  it('detecta colisión con la pared derecha', () => {
    const s = snakeCreate(10, 10, [{ x: 9, y: 5 }, { x: 8, y: 5 }]);
    expect(snakeStep(s)).toBe('wall');
  });

  it('detecta colisión con la pared superior', () => {
    const s = snakeCreate(10, 10, [{ x: 5, y: 0 }, { x: 5, y: 1 }]);
    s.dir = { x: 0, y: -1 };
    expect(snakeStep(s)).toBe('wall');
  });

  it('detecta colisión consigo mismo', () => {
    const s = snakeCreate(10, 10, [
      { x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 },
    ]);
    s.dir = { x: -1, y: 0 };
    expect(snakeStep(s)).toBe('self');
  });
});

describe('snakePlaceFood', () => {
  it('coloca comida en celda vacía', () => {
    const s = snakeCreate(4, 4);
    expect(snakePlaceFood(s)).toBe(true);
    const ocupa = s.snake.some(p => p.x === s.food.x && p.y === s.food.y);
    expect(ocupa).toBe(false);
    expect(s.food.x).toBeGreaterThanOrEqual(0);
    expect(s.food.y).toBeGreaterThanOrEqual(0);
  });

  it('devuelve false si el tablero está lleno', () => {
    const body = [];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) body.push({ x, y });
    const s = snakeCreate(2, 2, body);
    expect(snakePlaceFood(s)).toBe(false);
  });
});

describe('snakeRender', () => {
  it('genera tablero con borde, cabeza y comida', () => {
    const s = snakeCreate(5, 5);
    s.food = { x: 0, y: 0 };
    const out = snakeRender(s);
    const lines = out.split('\n');
    expect(lines).toHaveLength(7);
    expect(lines[0]).toBe('#######');
    expect(lines[6]).toBe('#######');
    expect(out).toContain(CHAR_HEAD);
    expect(out).toContain(CHAR_FOOD);
    expect(out).toContain(CHAR_WALL);
  });
});

describe('snake2Create', () => {
  it('crea dos serpientes enfrentadas', () => {
    const s = snake2Create(20, 10);
    expect(s.twoPlayer).toBe(true);
    expect(s.players).toHaveLength(2);
    expect(s.players[0].dir).toEqual({ x: 1, y: 0 });
    expect(s.players[1].dir).toEqual({ x: -1, y: 0 });
    expect(s.players[0].snake[0].x).toBeLessThan(s.players[1].snake[0].x);
    expect(s.players[1].head).toBe(CHAR_HEAD2);
  });
});

describe('snake2Step', () => {
  it('ambos avanzan y se mueven coordenada a coordenada', () => {
    const s = snake2Create(20, 10);
    const r = snake2Step(s);
    expect(r).toBe('ok');
    expect(s.players[0].snake[0]).toEqual({ x: Math.floor(20 / 4) + 1, y: Math.floor(10 / 2) });
    expect(s.players[1].snake[0].x).toBe(Math.floor(20 * 3 / 4) - 1);
  });

  it('envuelve por el borde derecho (sin paredes)', () => {
    const p1 = [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }];
    const p2 = [{ x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }];
    const s = snake2Create(20, 10, p1, p2);
    expect(snake2Step(s)).toBe('ok');
    expect(s.players[0].snake[0]).toEqual({ x: 0, y: 5 });
  });

  it('envuelve por el borde superior', () => {
    const p1 = [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }];
    p1[0].x = 5; p1[0].y = 0;
    const p2 = [{ x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }];
    const s = snake2Create(20, 10, p1, p2);
    s.players[0].dir = { x: 0, y: -1 };
    expect(snake2Step(s)).toBe('ok');
    expect(s.players[0].snake[0]).toEqual({ x: 5, y: 9 });
  });

  it('chocar contra el cuerpo rival: gana el otro', () => {
    const p1 = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
    const p2 = [{ x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 }];
    const s = snake2Create(20, 10, p1, p2);
    s.players[0].dir = { x: 0, y: 1 }; // P1 avanza hacia el cuerpo de P2
    const r = snake2Step(s);
    expect(r).toBe('P2');
    expect(s.winner).toBe('P2');
    expect(s.players[0].snake[0]).toEqual({ x: 5, y: 5 }); // no avanza
  });

  it('ambas cabezas convergen a la misma celda: empate', () => {
    const p1 = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
    const p2 = [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }];
    const s = snake2Create(20, 10, p1, p2);
    s.players[0].dir = { x: 1, y: 0 };
    s.players[1].dir = { x: -1, y: 0 };
    const r = snake2Step(s);
    expect(r).toBe('tie');
    expect(s.winner).toBe('tie');
  });

  it('P2 ignora un giro de 180 grados (no reversa)', () => {
    const s = snake2Create(20, 10);
    s.players[1].pendingDir = { x: 1, y: 0 }; // opuesto a su dirección (izquierda)
    const before = s.players[1].snake[0].x;
    snake2Step(s);
    expect(s.players[1].snake[0].x).toBe(before - 1); // sigue avanzando a la izquierda
  });
});

describe('snake2Render', () => {
  it('genera tablero sin paredes con ambas serpientes y comida', () => {
    const s = snake2Create(10, 5);
    s.food = { x: 0, y: 0 };
    const out = snake2Render(s);
    const lines = out.split('\n');
    expect(lines).toHaveLength(5);
    expect(out).toContain(CHAR_HEAD);
    expect(out).toContain(CHAR_HEAD2);
    expect(out).toContain(CHAR_BODY);
    expect(out).toContain(CHAR_BODY2);
    expect(out).toContain(CHAR_FOOD);
    expect(out).not.toContain(CHAR_WALL);
  });
});

describe('snake2PlaceFood', () => {
  it('no coloca comida sobre ninguna serpiente', () => {
    const s = snake2Create(10, 10);
    expect(snake2PlaceFood(s)).toBe(true);
    const onSnake = s.players.some(pl => pl.snake.some(p => p.x === s.food.x && p.y === s.food.y));
    expect(onSnake).toBe(false);
  });
});
