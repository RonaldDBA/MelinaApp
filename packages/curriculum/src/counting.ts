import type { Difficulty, ExerciseInstance, Rng } from '@melina/shared';

/**
 * Counting paths (skill math.counting), used by the « Le chemin des nombres » game
 * and by the « counting.path » paper exercise.
 *
 * Goal: accuracy in the number sequence, the difficulty observed when counting large collections.
 * That is why the paths cross a change of ten whenever possible (…9 → …0 or …0 → …9)
 * and one of the empty stones sits exactly there.
 */

export interface PathCell {
  value: number;
  row?: number;
  col?: number;
}
export interface CountingPath {
  layout: 'line' | 'grid';
  cells: PathCell[];
  /** indexes of the empty stones, in increasing order (= order of the answer) */
  holes: number[];
  /** constant step of the row (+1, −1, +10, −10); 0 on the grid */
  step: number;
  grid?: { rows: number; cols: number };
}

export const GRID_ROWS = 4;
export const GRID_COLS = 5;
const PATH_LEN = 10;
const GRID_LEN = 8;

/** Picks `count` distinct indexes from 1..len-1, always including `must` (when given). */
function pickHoles(rng: Rng, len: number, count: number, must: number[] = []): number[] {
  const chosen = new Set(must.filter((i) => i >= 1 && i < len));
  const pool = rng.shuffle(Array.from({ length: len - 1 }, (_, i) => i + 1));
  for (const i of pool) {
    if (chosen.size >= count) break;
    chosen.add(i);
  }
  const holes = [...chosen].sort((a, b) => a - b);
  // never three empty stones in a row: there is always a visible number nearby
  for (let k = 2; k < holes.length; k++) {
    if (holes[k] === (holes[k - 1] as number) + 1 && holes[k - 1] === (holes[k - 2] as number) + 1) return pickHoles(rng, len, count, must);
  }
  return holes;
}

/** Index of the stone where the ten changes (the number that comes after …9 or after …0). */
export function decadeChangeIndex(cells: PathCell[]): number {
  for (let i = 1; i < cells.length; i++) {
    const a = (cells[i - 1] as PathCell).value;
    const b = (cells[i] as PathCell).value;
    if (Math.floor(a / 10) !== Math.floor(b / 10)) return i;
  }
  return -1;
}

function linePath(rng: Rng, start: number, step: number, holeCount: number): CountingPath {
  const cells = Array.from({ length: PATH_LEN }, (_, i) => ({ value: start + i * step }));
  const change = decadeChangeIndex(cells);
  return { layout: 'line', cells, step, holes: pickHoles(rng, PATH_LEN, holeCount, change > 0 ? [change] : []) };
}

/** Level 1: up to 20, forward. Level 2: any start up to 100, forward or backward. */
export function buildLinePath(rng: Rng, difficulty: 1 | 2): CountingPath {
  if (difficulty === 1) return linePath(rng, rng.int(1, 11), 1, 3);
  const backward = rng.next() < 0.5;
  // a start that guarantees a change of ten in the middle of the path (not on the first stone)
  let start: number;
  do start = backward ? rng.int(30, 100) : rng.int(21, 91);
  while (decadeChangeIndex(Array.from({ length: PATH_LEN }, (_, i) => ({ value: start + i * (backward ? -1 : 1) }))) < 2);
  return linePath(rng, start, backward ? -1 : 1, rng.pick([3, 4]));
}

/** Paper, level 3: count by 10 from a number that is not an exact ten (the «column» of the hundred chart). */
export function buildTensPath(rng: Rng): CountingPath {
  const backward = rng.next() < 0.5;
  const ones = rng.int(1, 9);
  const start = backward ? rng.int(6, 9) * 10 + ones : rng.int(0, 2) * 10 + ones;
  const cells = Array.from({ length: 6 }, (_, i) => ({ value: start + i * (backward ? -10 : 10) }));
  return { layout: 'line', cells, step: backward ? -10 : 10, holes: pickHoles(rng, cells.length, 2) };
}

const MOVES = [
  { dr: 1, dc: 0, w: 3 }, // down: +10
  { dr: 0, dc: 1, w: 3 }, // right: +1
  { dr: 0, dc: -1, w: 2 }, // left: −1
  { dr: -1, dc: 0, w: 1 }, // up: −10
];

/** Level 3: a path hidden in a 4×5 piece of the hundred chart. Only the path's squares appear. */
export function buildGridPath(rng: Rng): CountingPath {
  for (let attempt = 0; attempt < 200; attempt++) {
    const r0 = rng.int(0, 10 - GRID_ROWS);
    const c0 = rng.int(0, 10 - GRID_COLS);
    let r = 0;
    let c = rng.int(0, 2);
    const seen = new Set([`${r},${c}`]);
    const pos = [{ r, c }];
    while (pos.length < GRID_LEN) {
      const options = MOVES.filter((m) => {
        const nr = r + m.dr;
        const nc = c + m.dc;
        return nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && !seen.has(`${nr},${nc}`);
      });
      if (options.length === 0) break;
      const total = options.reduce((s, m) => s + m.w, 0);
      let x = rng.next() * total;
      const m = options.find((o) => (x -= o.w) < 0) ?? (options[0] as (typeof options)[number]);
      r += m.dr;
      c += m.dc;
      seen.add(`${r},${c}`);
      pos.push({ r, c });
    }
    if (pos.length < GRID_LEN) continue;
    const vertical = (i: number) => (pos[i] as { r: number }).r !== (pos[i - 1] as { r: number }).r;
    const vIdx = pos.map((_, i) => i).filter((i) => i > 0 && vertical(i));
    const hIdx = pos.map((_, i) => i).filter((i) => i > 0 && !vertical(i));
    if (vIdx.length < 2 || hIdx.length < 2) continue;
    const cells = pos.map((p) => ({ value: 10 * (r0 + p.r) + (c0 + p.c) + 1, row: p.r, col: p.c }));
    // at least one empty stone after a vertical step (+10/−10) and one after a horizontal one (+1/−1)
    const holes = pickHoles(rng, GRID_LEN, rng.pick([3, 4]), [rng.pick(vIdx), rng.pick(hIdx)]);
    return { layout: 'grid', cells, step: 0, holes, grid: { rows: GRID_ROWS, cols: GRID_COLS } };
  }
  throw new Error('could not build the path on the grid');
}

/** Level 4: by 1 with 3-digit numbers, crossing the hundred (…98, 199, 200, 201…), forward or backward. */
export function buildHundredPath(rng: Rng): CountingPath {
  const backward = rng.next() < 0.5;
  const h = rng.int(1, 9) * 100; // the hundred being crossed
  // the change of hundred falls between the 3rd and the 7th stone
  const before = rng.int(2, 6);
  const start = backward ? h + before - 1 : h - before;
  const p = linePath(rng, start, backward ? -1 : 1, 4);
  return p;
}

/** Level 5: by 10 with 3-digit numbers, crossing the hundred (372, 382, 392, 402…). */
export function buildHundredTensPath(rng: Rng): CountingPath {
  const backward = rng.next() < 0.5;
  const h = rng.int(2, 9) * 100;
  const ones = rng.int(1, 9);
  const before = rng.int(2, 6);
  const start = backward ? h + (before - 1) * 10 + ones : h - before * 10 + ones;
  const cells = Array.from({ length: PATH_LEN }, (_, i) => ({ value: start + i * (backward ? -10 : 10) }));
  const change = cells.findIndex((x, i) => i > 0 && Math.floor(x.value / 100) !== Math.floor((cells[i - 1] as PathCell).value / 100));
  return { layout: 'line', cells, step: backward ? -10 : 10, holes: pickHoles(rng, PATH_LEN, 4, change > 0 ? [change] : []) };
}

/** Level 6 «Défi»: 4-digit numbers crossing the thousand, by 1 (999 → 1000) or by 100 (2 950 → 3 050). */
export function buildThousandPath(rng: Rng): CountingPath {
  const backward = rng.next() < 0.5;
  const big = rng.next() < 0.5; // by 100
  const step = (big ? 100 : 1) * (backward ? -1 : 1);
  const k = rng.int(1, 8) * 1000; // thousand being crossed
  const before = rng.int(2, 6);
  const offset = big ? rng.int(1, 9) * 10 + rng.int(0, 9) : 0;
  const start = backward ? k + (before - 1) * Math.abs(step) + offset : k - before * Math.abs(step) + offset;
  const cells = Array.from({ length: PATH_LEN }, (_, i) => ({ value: start + i * step }));
  const change = cells.findIndex((x, i) => i > 0 && Math.floor(x.value / 1000) !== Math.floor((cells[i - 1] as PathCell).value / 1000));
  return { layout: 'line', cells, step, holes: pickHoles(rng, PATH_LEN, 4, change > 0 ? [change] : []) };
}

export function buildCountingPath(rng: Rng, difficulty: Difficulty): CountingPath {
  if (difficulty >= 6) return buildThousandPath(rng);
  if (difficulty === 4) return buildHundredPath(rng);
  if (difficulty >= 5) return buildHundredTensPath(rng);
  return difficulty >= 3 ? buildGridPath(rng) : buildLinePath(rng, difficulty as 1 | 2);
}

/**
 * Suites for levels 4 and 5 (train and paper): level 4 with bonds of 3, 4 or 25 and crossing 100;
 * level 5 with bonds of 20, 50 or 100 up to 999, forward and backward.
 */
export function bigSequence(rng: Rng, difficulty: Difficulty): { step: number; start: number } {
  if (difficulty >= 6) {
    // «Défi»: times-table bonds (6, 7, 8, 9, 11, 12, 15) and big bonds (250, 500) up to 9 999
    const step = rng.pick([6, 7, 8, 9, -6, -7, -8, -9, 11, 12, 15, 250, -250, 500]);
    const a = Math.abs(step);
    if (a >= 250) {
      const span = a * 5;
      return { step, start: step > 0 ? rng.int(1, Math.floor((9999 - span) / 50)) * 50 : rng.int(Math.ceil((span + 50) / 50), 199) * 50 };
    }
    return { step, start: step > 0 ? rng.int(1, 6) * a + rng.int(0, a - 1) : rng.int(10, 15) * a + rng.int(0, a - 1) };
  }
  if (difficulty === 4) {
    const step = rng.pick([3, 4, -3, -4, 25, -25, 5]);
    if (Math.abs(step) === 25) return { step, start: step > 0 ? rng.int(0, 4) * 25 : rng.int(6, 10) * 25 };
    if (step === 5) return { step, start: rng.int(15, 19) * 5 }; // crosses 100: 80, 85, … 105
    return { step, start: step > 0 ? rng.int(70, 95) : rng.int(105, 130) };
  }
  const step = rng.pick([20, -20, 50, -50, 100, -100]);
  const span = Math.abs(step) * 5;
  const lo = step > 0 ? 10 : span + 10;
  const hi = step > 0 ? 999 - span : 990;
  return { step, start: rng.int(Math.ceil(lo / 10), Math.floor(hi / 10)) * 10 + (Math.abs(step) === 100 ? rng.int(0, 9) : 0) };
}


export const holeValues = (p: CountingPath) => p.holes.map((i) => (p.cells[i] as PathCell).value);

/**
 * Common errors, compared with the whole answer (comma-separated numbers):
 * - a path that goes backward read as if it went forward;
 * - on the grid, moving down one row counted as +1 instead of +10.
 */
export function countingErrors(p: CountingPath): ExerciseInstance['commonErrors'] {
  const out: ExerciseInstance['commonErrors'] = [];
  const first = (p.cells[0] as PathCell).value;
  if (p.layout === 'line' && p.step < 0) {
    out.push({ match: p.holes.map((i) => first - i * p.step).join(','), type: 'sens-inverse', message: `Attention : sur ce chemin, les nombres diminuent. On recule de ${-p.step} à chaque pas.` });
  }
  if (p.layout === 'grid') {
    let v = first;
    const asOnes = p.cells.map((cell, i) => {
      if (i === 0) return v;
      const prev = p.cells[i - 1] as PathCell;
      v += (cell.row ?? 0) > (prev.row ?? 0) || (cell.col ?? 0) > (prev.col ?? 0) ? 1 : -1;
      return v;
    });
    out.push({ match: p.holes.map((i) => asOnes[i]).join(','), type: 'grille-colonne-plus-un', message: 'Dans la grille de 100, descendre d’une ligne, c’est +10, pas +1.' });
  }
  const right = holeValues(p).join(',');
  return out.filter((e) => e.match !== right);
}

export function countingHint(p: CountingPath): string {
  if (p.layout === 'grid') return 'Dans la grille de 100 : un pas à droite, c’est +1; à gauche, −1; un pas vers le bas, c’est +10; vers le haut, −10.';
  if (Math.abs(p.step) === 100) return 'Chaque fois, on ajoute ou on enlève 100 : seul le chiffre des centaines change… sauf au passage du millier (2 950, 3 050).';
  if (Math.abs(p.step) === 10) return p.step > 0 ? 'Chaque fois, on ajoute 10 : le chiffre des dizaines augmente de 1, celui des unités ne change pas. Après 9 dizaines, la centaine change : 392, 402.' : 'Chaque fois, on enlève 10 : le chiffre des dizaines diminue de 1, celui des unités ne change pas. Attention au changement de centaine : 402, 392.';
  const big = p.cells.some((x) => x.value >= 100);
  if (big) return p.step > 0 ? 'Compte de 1 en 1. Attention au changement de centaine : après 199 vient 200.' : 'Ce chemin recule de 1 en 1. Attention : après 200 vient 199.';
  return p.step > 0 ? 'Compte de 1 en 1. Attention au changement de dizaine : après 39 vient 40.' : 'Ce chemin recule : on enlève 1 à chaque pas. Attention : après 40 vient 39.';
}

export function countingExplanation(p: CountingPath): string {
  const all = p.cells.map((c) => c.value).join(', ');
  if (p.layout === 'grid') return `Le chemin : ${all}. Dans la grille de 100 : à droite +1, à gauche −1, en bas +10, en haut −10.`;
  // the stated step is the real step (before, paths by 100 said «de 1 en 1»)
  if (Math.abs(p.step) !== 1) return `${p.step > 0 ? 'On ajoute' : 'On enlève'} ${Math.abs(p.step)} à chaque fois : ${all}.`;
  return `${p.step > 0 ? 'On avance' : 'On recule'} de 1 en 1 : ${all}.`;
}
