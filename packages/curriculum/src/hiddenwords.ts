import { silentEnt, silentFinal } from './tags';
import type { Difficulty, Rng } from '@melina/shared';

/**
 * « Les mots cachés »: the word-search grid and the spelling test at the end of the round.
 * The words come from the school list (content/french/school-words.json, see schoolwords.ts), up to the week
 * chosen by the parents. Emoji and gaps are optional: the gaps are computed.
 */

export interface WordEntry {
  word: string;
  emoji?: string;
  level: number;
  blanks?: number[][];
}

export type Dir = 'h' | 'v' | 'd';
const STEP: Record<Dir, [number, number]> = { h: [0, 1], v: [1, 0], d: [1, 1] };

export const LEVELS: Record<Difficulty, { size: number; count: number; dirs: Dir[] }> = {
  1: { size: 6, count: 3, dirs: ['h', 'v'] },
  2: { size: 8, count: 4, dirs: ['h', 'v'] },
  3: { size: 10, count: 5, dirs: ['h', 'v', 'd'] },
  4: { size: 11, count: 6, dirs: ['h', 'v', 'd'] },
  5: { size: 12, count: 7, dirs: ['h', 'v', 'd'] },
  6: { size: 12, count: 8, dirs: ['h', 'v', 'd'] }, // «Défi»: the whole year's list, dictation
};

/** Filler letters, weighted roughly like French; some accented, so the grid does not «give away» the accented words. */
const FILL = 'eeeeeeaaaaassssiiiiinnnnrrrrttttuuuoooollllcccdddmmmppvqfbghjxyzéééèàç';

export const letters = (w: string) => [...w.normalize('NFC')];

export interface Placement {
  word: string;
  row: number;
  col: number;
  dir: Dir;
}

/** How many times `w` appears in the grid in the allowed directions. */
export function occurrences(grid: string[][], w: string, dirs: Dir[]): number {
  const ls = letters(w);
  const n = grid.length;
  let count = 0;
  for (const d of dirs) {
    const [dr, dc] = STEP[d];
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        let ok = true;
        for (let k = 0; k < ls.length && ok; k++) ok = grid[r + dr * k]?.[c + dc * k] === ls[k];
        if (ok) count++;
      }
  }
  return count;
}

export function buildGrid(rng: Rng, words: string[], size: number, dirs: Dir[]): { grid: string[][]; placements: Placement[] } {
  for (let attempt = 0; attempt < 300; attempt++) {
    const cells: Array<Array<string | null>> = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
    const placements: Placement[] = [];
    let failed = false;
    // long words first; each word in one direction, preferably varying
    for (const w of [...words].sort((a, b) => letters(b).length - letters(a).length)) {
      const ls = letters(w);
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const dir = rng.pick(dirs);
        const [dr, dc] = STEP[dir];
        const maxR = size - 1 - dr * (ls.length - 1);
        const maxC = size - 1 - dc * (ls.length - 1);
        if (maxR < 0 || maxC < 0) continue;
        const row = rng.int(0, maxR);
        const col = rng.int(0, maxC);
        if (ls.every((ch, k) => {
          const cur = (cells[row + dr * k] as Array<string | null>)[col + dc * k];
          return cur === null || cur === ch;
        })) {
          ls.forEach((ch, k) => ((cells[row + dr * k] as Array<string | null>)[col + dc * k] = ch));
          placements.push({ word: w, row, col, dir });
          placed = true;
        }
      }
      if (!placed) {
        failed = true;
        break;
      }
    }
    if (failed) continue;
    const grid = cells.map((row) => row.map((ch) => ch ?? (FILL[Math.floor(rng.next() * FILL.length)] as string)));
    // each word appears exactly once, in ANY direction (no duplicate created by the filler,
    // nor a diagonal copy at a level where diagonals do not count: 3-letter words show up by chance)
    if (words.every((w) => occurrences(grid, w, ['h', 'v', 'd']) === 1)) return { grid, placements };
  }
  throw new Error('could not build the grid');
}

/** Graphemes that need the most attention in spelling, in order of preference for becoming a gap. */
const TRICKY = ['eau', 'ain', 'ein', 'eil', 'ai', 'ei', 'oi', 'ou', 'eu', 'au', 'on', 'an', 'en', 'in', 'ch', 'gn', 'é', 'è', 'ê', 'à', 'â', 'ç', 'ô', 'î', 'û'];

/**
 * Gaps (letter indexes) of the final test, each level more demanding:
 * 1: 1–2 letters of the hard sound · 2: the whole hard sound · 3: all the hard parts (sounds, accents,
 * silent final letter, double consonant) · 4: only the 1st letter stays · 5: dictation, no letter visible.
 */
export function blanksFor(entry: WordEntry, difficulty: Difficulty): number[] {
  const ls = letters(entry.word);
  const all = ls.map((_, i) => i);
  if (difficulty >= 5) return all;
  if (difficulty === 4) return all.filter((i) => i > 0);
  if (entry.blanks?.length && difficulty <= 2) {
    const out = new Set<number>();
    for (const [from = 0, to = from] of entry.blanks) for (let i = from; i <= to; i++) out.add(i);
    return [...out].filter((i) => i < ls.length).sort((a, b) => a - b);
  }
  const w = ls.join('');
  if (difficulty === 3) {
    const out = new Set<number>();
    for (const t of TRICKY) {
      for (let from = 0, at = w.indexOf(t); at >= 0; from = at + 1, at = w.indexOf(t, from)) {
        const k = letters(w.slice(0, at)).length;
        letters(t).forEach((_, j) => out.add(k + j));
      }
    }
    if (silentFinal(entry.word)) out.add(ls.length - 1); // silent letter (not in cactus, fils, ours…)
    ls.forEach((ch, i) => i > 0 && ch === ls[i - 1] && 'bcdfglmnprst'.includes(ch) && out.add(i)); // double consonant
    out.delete(0); // the 1st letter stays visible
    if (out.size < 2) [Math.floor(ls.length / 2), Math.floor(ls.length / 2) - 1].forEach((i) => i > 0 && out.add(i));
    return [...out].sort((a, b) => a - b);
  }
  const g = TRICKY.find((t) => w.indexOf(t) > 0) ?? TRICKY.find((t) => w.includes(t));
  if (g) {
    const at = letters(w.slice(0, w.indexOf(g))).length;
    const len = letters(g).length;
    return Array.from({ length: difficulty === 1 ? Math.min(len, 2) : len }, (_, k) => at + k);
  }
  const mid = Math.floor(ls.length / 2);
  return difficulty === 1 ? [mid] : [mid - 1, mid];
}

/** Letters confused with each letter (accents, similar sounds, mirrored). */
const CONFUSABLE: Record<string, string[]> = {
  e: ['é', 'è'], é: ['e', 'è'], è: ['é', 'e'], ê: ['e', 'è'],
  a: ['à', 'o'], à: ['a', 'â'], â: ['a', 'à'],
  c: ['ç', 's'], ç: ['c', 's'], s: ['z', 'c'], z: ['s'],
  o: ['ô', 'a'], ô: ['o'], i: ['î', 'y'], î: ['i'], u: ['ù', 'o'], û: ['u'],
  m: ['n'], n: ['m'], b: ['d', 'p'], d: ['b', 'p'], p: ['q', 'b'], q: ['p'],
  g: ['j'], j: ['g'], l: ['i'], r: ['l'], t: ['d'], f: ['v'], v: ['f'], h: ['n'], x: ['s'], y: ['i'],
};

/** Keyboard for the test: the right letters + the confusable ones + a few others, shuffled (8 to 12 keys). */
export function letterBank(rng: Rng, hidden: string[]): string[] {
  const bank = new Set(hidden);
  for (const h of hidden) for (const c of CONFUSABLE[h] ?? []) bank.add(c);
  const extra = rng.shuffle([...'aeioulnrstmé']);
  for (const x of extra) {
    if (bank.size >= 8) break;
    bank.add(x);
  }
  return rng.shuffle([...bank].slice(0, Math.max(12, hidden.length)));
}

/**
 * Picks the grid words and the test word.
 * - Difficulty: prefers words whose level (spelling difficulty, 1 to 5) is close to the game level.
 * - `focus` (week chosen by the parents) has priority, as long as it has words at the right level (±1).
 * - `avoid` (words from the last rounds) goes to the back of the line: less repetition.
 * - Never combines a word contained in another («tout» and «toute»): the shorter one would appear twice.
 */
export function pickWords(
  rng: Rng,
  pool: WordEntry[],
  difficulty: Difficulty,
  focus: Set<string> = new Set(),
  avoid: Set<string> = new Set(),
): { chosen: WordEntry[]; target: WordEntry } {
  const { size, count } = LEVELS[difficulty];
  const fits = pool.filter((w) => letters(w.word).length <= size);
  const dist = (w: WordEntry) => Math.abs(w.level - difficulty);
  const inFocus = (w: WordEntry) => focus.has(w.word);
  // order: distance from the level, recent words last, and a random draw among equals
  const rank = (list: WordEntry[]) =>
    rng
      .shuffle(list)
      .map((w, i) => ({ w, k: dist(w) * 10 + (avoid.has(w.word) ? 25 : 0) + i / 1000 }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.w);
  const focusFits = fits.filter(inFocus);
  const useFocus = focusFits.some((w) => dist(w) <= 1);
  const base = useFocus ? focusFits : fits;
  const ranked = rank(base);
  // test: a draw among the best ones (same distance, not recent, when available)
  const best = ranked.filter((w) => dist(w) === dist(ranked[0] as WordEntry) && avoid.has(w.word) === avoid.has((ranked[0] as WordEntry).word));
  const target = rng.pick(best.length ? best : ranked);
  const ordered = [...(useFocus ? rank(focusFits) : []), ...rank(fits)].filter((w) => w.word !== target.word);
  const chosen = [target];
  for (const w of ordered) {
    if (chosen.length >= count) break;
    if (chosen.some((c) => c.word === w.word || c.word.includes(w.word) || w.word.includes(c.word))) continue;
    chosen.push(w);
  }
  return { chosen: rng.shuffle(chosen), target };
}

/**
 * Sound hint for the Les mots cachés test, chosen by the WORD (not only by the hidden letters):
 * the «ain» of «main» is the « in » sound; the one in «semaine» is « è ». `nasal`: true = only when followed by a consonant or the end;
 * false = only when it is NOT nasal.
 */
const VOW = 'aeiouyéèêëàâîïôûùü';
const graphemeHint: Array<{ g: string; hint: string; nasal?: boolean }> = [
  { g: 'eau', hint: 'Le son « o » s’écrit ici avec trois lettres : e, a, u.' },
  { g: 'eil', hint: 'Le son « eil » comme dans soleil.' },
  { g: 'ain', hint: 'Le son « in » s’écrit ici avec trois lettres : a, i, n.', nasal: true },
  { g: 'ein', hint: 'Le son « in » s’écrit ici avec trois lettres : e, i, n.', nasal: true },
  { g: 'ai', hint: 'Le son « è » s’écrit ici avec deux lettres : a et i.' },
  { g: 'ei', hint: 'Le son « è » s’écrit ici avec deux lettres : e et i.' },
  { g: 'oi', hint: 'Le son « wa » s’écrit o et i.' },
  { g: 'ou', hint: 'Le son « ou » s’écrit o et u.' },
  { g: 'eu', hint: 'Le son « eu » s’écrit e et u.' },
  { g: 'ch', hint: 'Le son « ch » s’écrit c et h.' },
  { g: 'in', hint: 'Le son « in » s’écrit i et n.', nasal: true },
  { g: 'on', hint: 'Le son « on » s’écrit o et n.', nasal: true },
  { g: 'an', hint: 'Le son « an » s’écrit ici a et n.', nasal: true },
  { g: 'en', hint: 'Le son « an » s’écrit ici e et n.', nasal: true },
  { g: 'au', hint: 'Le son « o » s’écrit ici a et u.' },
  { g: 'qu', hint: 'Le son « k » s’écrit ici q et u.' },
  { g: 'gn', hint: 'Le son « gn » s’écrit g et n.' },
  { g: 'é', hint: 'Regarde bien l’accent : é.' },
  { g: 'è', hint: 'Regarde bien l’accent : è.' },
  { g: 'ê', hint: 'N’oublie pas l’accent circonflexe sur le ê.' },
  { g: 'â', hint: 'N’oublie pas l’accent circonflexe sur le â.' },
  { g: 'î', hint: 'N’oublie pas l’accent circonflexe sur le î.' },
  { g: 'ô', hint: 'N’oublie pas l’accent circonflexe sur le ô.' },
  { g: 'û', hint: 'N’oublie pas l’accent circonflexe sur le û.' },
];

export function soundHint(word: string, hidden: number[]): string | null {
  const ls = letters(word);
  const w = ls.join('');
  for (const { g, hint, nasal } of graphemeHint) {
    for (let at = w.indexOf(g); at >= 0; at = w.indexOf(g, at + 1)) {
      const k = letters(w.slice(0, at)).length;
      const len = letters(g).length;
      if (!Array.from({ length: len }, (_, j) => k + j).some((i) => hidden.includes(i))) continue;
      const next = ls[k + len];
      const isNasal = next === undefined || !(VOW + 'nm').includes(next);
      if (nasal && (!isNasal || word === 'monsieur')) continue;
      if (g === 'en' && k + len === ls.length - 1 && silentEnt(word)) continue; // «disent»: silent -ent
      // «ai»/«ei» followed by a nasal «n» are part of «ain»/«ein» (« in » sound), not of the « è » sound
      if ((g === 'ai' || g === 'ei') && next === 'n' && !(VOW + 'n').includes(ls[k + len + 1] ?? '')) continue;
      return hint;
    }
  }
  const dbl = ls.findIndex((ch, i) => i > 0 && ch === ls[i - 1] && 'bcdfglmnprst'.includes(ch) && (hidden.includes(i) || hidden.includes(i - 1)));
  return dbl > 0 ? 'Il y a deux lettres pareilles collées.' : null;
}
