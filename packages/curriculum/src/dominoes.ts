import type { Difficulty, DominoFace, ExerciseInstance, Rng } from '@melina/shared';

/**
 * « Les dominos des nombres » (skill math.representations): the same number in different
 * representations. Level 1: dots ↔ digit (1 to 9). Level 2: operation ↔ result (sums and differences up to 20,
 * almost always bridging through ten). Level 3: tens and units (bars and cubes) ↔ number up to 99.
 * Level 4: operation with two 2-digit numbers ↔ result up to 99 (with or without regrouping).
 * Level 5: 3-digit number ↔ expanded form (300 + 40 + 7), with zeros in the middle.
 */

export const faceValue = (f: DominoFace): number => {
  if (f.kind === 'dots' || f.kind === 'digit') return f.n;
  if (f.kind === 'tens') return f.tens * 10 + f.units;
  // «a + b», «a − b» or several terms («300 + 40 + 7»)
  const parts = f.text.split(' ');
  if (parts.length < 3 || parts.length % 2 === 0) throw new Error(`invalid expression: ${f.text}`);
  let v = Number(parts[0]);
  for (let i = 1; i < parts.length; i += 2) {
    const n = Number(parts[i + 1]);
    if (!/^\d+$/.test(parts[i + 1] ?? '') || !['+', '−'].includes(parts[i] ?? '')) throw new Error(`invalid expression: ${f.text}`);
    v = parts[i] === '+' ? v + n : v - n;
  }
  if (!/^\d+$/.test(parts[0] ?? '')) throw new Error(`invalid expression: ${f.text}`);
  return v;
};

const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;

/** Text of the half: it is also the option sent to the server and what appears in the parents' history. */
export const faceLabel = (f: DominoFace): string =>
  f.kind === 'dots' ? pl(f.n, 'point') : f.kind === 'digit' ? String(f.n) : f.kind === 'expr' ? f.text : `${pl(f.tens, 'dizaine')} et ${pl(f.units, 'unité')}`;

export interface DominoRound {
  open: DominoFace;
  correct: DominoFace;
  distractors: Array<{ face: DominoFace; type: string; message: string }>;
  explanation: string;
  hint: string;
}

/** An operation (sum or difference up to 20) equal to `v`. */
function exprFor(rng: Rng, v: number, op: '+' | '−'): DominoFace {
  if (op === '+' && v >= 4) {
    const a = rng.int(Math.max(2, v - 9), Math.min(9, v - 2));
    return { kind: 'expr', text: `${a} + ${v - a}` };
  }
  const b = rng.int(2, 9);
  return { kind: 'expr', text: `${v + b} − ${b}` };
}

function level1(rng: Rng): DominoRound {
  const n = rng.int(1, 9);
  const dotsOpen = rng.next() < 0.5;
  const face = (k: number): DominoFace => (dotsOpen ? { kind: 'digit', n: k } : { kind: 'dots', n: k });
  // nearest neighbours first; at the ends (1 and 9) it fills in with ±3
  const pool = [n - 1, n + 1, n - 2, n + 2, n - 3, n + 3].filter((k) => k >= 1 && k <= 9);
  const near = rng.shuffle(pool.slice(0, 4)).slice(0, 3);
  return {
    open: dotsOpen ? { kind: 'dots', n } : { kind: 'digit', n },
    correct: face(n),
    distractors: near.map((k) => ({ face: face(k), type: Math.abs(k - n) === 1 ? 'compte-plus-moins-un' : 'compte-imprecis', message: 'Presque! Recompte les points un par un, en les touchant.' })),
    explanation: `${pl(n, 'point')}, c’est le nombre ${n}.`,
    hint: 'Compte les points un par un, en touchant chaque point.',
  };
}

function level2(rng: Rng): DominoRound {
  const op = rng.pick(['+', '+', '−'] as const);
  let a: number;
  let b: number;
  if (op === '+') {
    a = rng.int(3, 9);
    b = rng.int(Math.max(2, 11 - a), 9); // a + b ≥ 11: bridges through ten
  } else {
    a = rng.int(11, 18);
    b = rng.int(a - 9, 9); // a − b ≤ 9: bridges back through ten
  }
  const r = op === '+' ? a + b : a - b;
  const text = `${a} ${op} ${b}`;
  const exprOpen = rng.next() < 0.5;
  const values = rng.shuffle([r - 1, r + 1, r - 2, r + 2, r + 10, r - 10].filter((v) => v >= 1 && v <= 20 && v !== r)).slice(0, 3);
  const make = (v: number): DominoFace => (exprOpen ? { kind: 'digit', n: v } : exprFor(rng, v, op));
  const how =
    op === '+'
      ? `Fais d’abord 10 : ${a} + ${10 - a} = 10, puis ajoute ${b - (10 - a)}.`
      : `Recule d’abord jusqu’à 10 : ${a} − ${a - 10} = 10, puis enlève encore ${b - (a - 10)}.`;
  return {
    open: exprOpen ? { kind: 'expr', text } : { kind: 'digit', n: r },
    correct: exprOpen ? { kind: 'digit', n: r } : { kind: 'expr', text },
    distractors: values.map((v) => ({
      face: make(v),
      type: Math.abs(v - r) === 10 ? 'dizaine-en-trop' : 'calcul-presque',
      message: Math.abs(v - r) === 10 ? 'Attention aux dizaines : vérifie si le résultat dépasse 10 ou pas.' : 'Presque! Refais le calcul en passant par 10.',
    })),
    explanation: `${text} = ${r}.`,
    hint: how,
  };
}

function level3(rng: Rng): DominoRound {
  const t = rng.int(1, 9);
  const u = rng.int(1, 9);
  const v = 10 * t + u;
  const tensOpen = rng.next() < 0.5;
  const cands: Array<{ tens: number; units: number; type: string; message: string }> = [];
  if (u !== t) cands.push({ tens: u, units: t, type: 'inversion-dizaines-unites', message: 'Les dizaines s’écrivent à gauche : compte d’abord les barres.' });
  const steps = [...rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>), ...rng.shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]] as Array<[number, number]>)];
  for (const [dt, du] of steps) {
    if (dt === u - t && du === t - u) continue; // would be the same piece as the inversion
    const nt = t + dt;
    const nu = u + du;
    if (nt >= 1 && nt <= 9 && nu >= 1 && nu <= 9) cands.push({ tens: nt, units: nu, type: dt ? 'dizaine-de-plus-ou-de-moins' : 'unite-de-plus-ou-de-moins', message: dt ? 'Recompte les barres de 10.' : 'Recompte les petits cubes.' });
  }
  const chosen = cands.slice(0, 3);
  const face = (tt: number, uu: number): DominoFace => (tensOpen ? { kind: 'digit', n: 10 * tt + uu } : { kind: 'tens', tens: tt, units: uu });
  return {
    open: tensOpen ? { kind: 'tens', tens: t, units: u } : { kind: 'digit', n: v },
    correct: face(t, u),
    distractors: chosen.map((c) => ({ face: face(c.tens, c.units), type: c.type, message: c.message })),
    explanation: `${pl(t, 'dizaine')} et ${pl(u, 'unité')}, c’est ${v}.`,
    hint: 'Une barre, c’est 10; un petit cube, c’est 1. Le chiffre des dizaines s’écrit à gauche.',
  };
}

function level4(rng: Rng): DominoRound {
  const op = rng.pick(['+', '−'] as const);
  const regroup = rng.next() < 0.6;
  let a = 0;
  let b = 0;
  for (;;) {
    a = rng.int(12, 88);
    b = rng.int(11, 79);
    if (op === '+' ? a + b > 99 : b >= a) continue;
    const carry = op === '+' ? (a % 10) + (b % 10) >= 10 : a % 10 < b % 10;
    if (carry === regroup) break;
  }
  const r = op === '+' ? a + b : a - b;
  const text = `${a} ${op} ${b}`;
  const exprOpen = rng.next() < 0.5;
  // a forgotten retenue/emprunt gives 10 less/more; close ones: ±1 and ±10
  const forgot = op === '+' ? r - 10 : r + 10;
  const values = [...new Set([...(regroup ? [forgot] : []), ...rng.shuffle([r + 1, r - 1, r + 10, r - 10, r + 2])])].filter((v) => v >= 1 && v <= 99 && v !== r).slice(0, 3);
  const make = (v: number): DominoFace => {
    if (exprOpen) return { kind: 'digit', n: v };
    const [lo, hi] = op === '+' ? [Math.max(11, v - 79), Math.min(88, v - 11)] : [Math.max(v + 11, 12), Math.min(99, v + 79)];
    for (let k = 0; k < 40 && lo <= hi; k++) {
      const x = rng.int(lo, hi);
      const y = op === '+' ? v - x : x - v;
      if (x >= 11 && y >= 11 && y <= 89) return { kind: 'expr', text: `${x} ${op} ${y}` };
    }
    return { kind: 'expr', text: `${v + 11} − 11` };
  };
  return {
    open: exprOpen ? { kind: 'expr', text } : { kind: 'digit', n: r },
    correct: exprOpen ? { kind: 'digit', n: r } : { kind: 'expr', text },
    distractors: values.map((v) => ({
      face: make(v),
      type: v === forgot && regroup ? (op === '+' ? 'retenue-oubliee' : 'emprunt-oublie') : Math.abs(v - r) === 10 ? 'dizaine-de-plus-ou-de-moins' : 'calcul-presque',
      message: v === forgot && regroup ? (op === '+' ? 'N’oublie pas la retenue : 10 unités font 1 dizaine.' : 'Il faut échanger 1 dizaine contre 10 unités.') : 'Presque! Calcule les dizaines, puis les unités.',
    })),
    explanation: `${text} = ${r}.`,
    hint: op === '+' ? 'Additionne les dizaines, puis les unités. Si les unités font plus de 10, ça fait une dizaine de plus.' : 'Enlève les dizaines, puis les unités. S’il manque des unités, échange une dizaine.',
  };
}

/** «347» ↔ «300 + 40 + 7»; «4507» ↔ «4000 + 500 + 7» (parts equal to zero are left out). */
const expanded = (v: number): string => {
  const parts = [Math.floor(v / 1000) * 1000, Math.floor((v % 1000) / 100) * 100, Math.floor((v % 100) / 10) * 10, v % 10].filter((x) => x > 0);
  return parts.length > 1 ? parts.join(' + ') : `${v} + 0`;
};

function level5(rng: Rng): DominoRound {
  const h = rng.int(1, 9);
  const t = rng.next() < 0.3 ? 0 : rng.int(1, 9);
  const u = rng.next() < 0.2 && t !== 0 ? 0 : rng.int(1, 9);
  const v = 100 * h + 10 * t + u;
  const numOpen = rng.next() < 0.5;
  const cands: Array<{ v: number; type: string; message: string }> = [];
  if (u !== h && u > 0) cands.push({ v: 100 * u + 10 * t + h, type: 'inversion-centaines-unites', message: 'Les centaines s’écrivent à gauche, les unités à droite.' });
  if (t !== u) cands.push({ v: 100 * h + 10 * u + t, type: 'inversion-dizaines-unites', message: 'Regarde bien : la dizaine et l’unité ne sont pas à la même place.' });
  for (const d of rng.shuffle([10, -10, 100, -100, 1, -1])) {
    const w = v + d;
    if (w >= 101 && w <= 999 && w % 100 !== 0) cands.push({ v: w, type: Math.abs(d) === 100 ? 'centaine-de-plus-ou-de-moins' : Math.abs(d) === 10 ? 'dizaine-de-plus-ou-de-moins' : 'unite-de-plus-ou-de-moins', message: 'Presque! Vérifie les centaines, les dizaines et les unités.' });
  }
  const chosen = cands.filter((c, i, arr) => c.v !== v && arr.findIndex((x) => x.v === c.v) === i).slice(0, 3);
  const face = (w: number): DominoFace => (numOpen ? { kind: 'expr', text: expanded(w) } : { kind: 'digit', n: w });
  return {
    open: numOpen ? { kind: 'digit', n: v } : { kind: 'expr', text: expanded(v) },
    correct: face(v),
    distractors: chosen.map((c) => ({ face: face(c.v), type: c.type, message: c.message })),
    explanation: `${expanded(v)} = ${v} : ${pl(h, 'centaine')}, ${pl(t, 'dizaine')} et ${pl(u, 'unité')}.`,
    hint: 'Le premier chiffre donne les centaines, le deuxième les dizaines, le dernier les unités. Une place vide prend un 0.',
  };
}

/** Level 6 «Défi»: 4-digit number ↔ expanded form (4000 + 500 + 7), with zeros in the middle. */
function level6(rng: Rng): DominoRound {
  const m = rng.int(1, 9);
  const h = rng.next() < 0.35 ? 0 : rng.int(1, 9);
  const t = rng.next() < 0.3 ? 0 : rng.int(1, 9);
  const u = rng.int(1, 9);
  const v = 1000 * m + 100 * h + 10 * t + u;
  const numOpen = rng.next() < 0.5;
  const cands: Array<{ v: number; type: string; message: string }> = [];
  if (h === 0) cands.push({ v: 100 * m + 10 * t + u, type: 'zero-oublie', message: 'Il manque un zéro : il n’y a pas de centaine, on écrit 0 à sa place.' });
  if (u !== m) cands.push({ v: 1000 * u + 100 * h + 10 * t + m, type: 'inversion-ordre', message: 'Les milliers s’écrivent à gauche, les unités à droite.' });
  for (const d of rng.shuffle([1000, -1000, 100, -100, 10, -10])) {
    const w = v + d;
    if (w >= 1001 && w <= 9999 && w % 1000 !== 0) cands.push({ v: w, type: 'position-de-plus-ou-de-moins', message: 'Presque! Vérifie chaque position : milliers, centaines, dizaines, unités.' });
  }
  const chosen = cands.filter((c, i, arr) => c.v !== v && c.v >= 101 && arr.findIndex((x) => x.v === c.v) === i).slice(0, 3);
  const face = (w: number): DominoFace => (numOpen ? { kind: 'expr', text: expanded(w) } : { kind: 'digit', n: w });
  return {
    open: numOpen ? { kind: 'digit', n: v } : { kind: 'expr', text: expanded(v) },
    correct: face(v),
    distractors: chosen.map((c) => ({ face: face(c.v), type: c.type, message: c.message })),
    explanation: `${expanded(v)} = ${v}.`,
    hint: 'Le premier chiffre donne les milliers, puis les centaines, les dizaines et les unités. Une place vide prend un 0.',
  };
}

export function buildDominoRound(rng: Rng, difficulty: Difficulty): DominoRound {
  return [level1, level2, level3, level4, level5, level6][difficulty - 1]?.(rng) ?? level3(rng);
}

/** A «decorative» half (the other end of each piece), of the same kind of representation as the level. */
export function decoFace(rng: Rng, difficulty: Difficulty): DominoFace {
  if (difficulty === 1) return rng.next() < 0.5 ? { kind: 'dots', n: rng.int(1, 9) } : { kind: 'digit', n: rng.int(1, 9) };
  if (difficulty === 2) return rng.next() < 0.5 ? { kind: 'digit', n: rng.int(2, 18) } : exprFor(rng, rng.int(4, 18), '+');
  if (difficulty === 3) return rng.next() < 0.5 ? { kind: 'digit', n: rng.int(11, 99) } : { kind: 'tens', tens: rng.int(1, 9), units: rng.int(1, 9) };
  if (difficulty === 4) return rng.next() < 0.5 ? { kind: 'digit', n: rng.int(11, 99) } : { kind: 'expr', text: `${rng.int(20, 60)} + ${rng.int(11, 39)}` };
  if (difficulty >= 6) {
    const k = rng.int(1, 9) * 1000 + rng.int(0, 9) * 100 + rng.int(1, 9) * 10 + rng.int(0, 9);
    return rng.next() < 0.5 ? { kind: 'digit', n: k } : { kind: 'expr', text: expanded(k) };
  }
  const n = rng.int(1, 9) * 100 + rng.int(1, 9) * 10 + rng.int(0, 9); // never an exact hundred («200 + 0»)
  return rng.next() < 0.5 ? { kind: 'digit', n } : { kind: 'expr', text: expanded(n) };
}

export type { DominoFace };
export const dominoErrors = (d: DominoRound): ExerciseInstance['commonErrors'] => d.distractors.map((x) => ({ match: faceLabel(x.face), type: x.type, message: x.message }));
