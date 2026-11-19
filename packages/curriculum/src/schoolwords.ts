import data from '../../../content/french/school-words.json';
import type { Difficulty } from '@melina/shared';
import { letters, type WordEntry } from './hiddenwords';

/**
 * The « Les mots à savoir écrire » list from Melina's school (content/french/school-words.json), by theme and week.
 * In the parents' area the parents choose the week the class is at; the game uses the words up to that week
 * and prefers the chosen week's words for the final test.
 */

export interface SchoolWord {
  text: string; // as written in the book
  forms: string[]; // forms that can go into the grid (empty = only on the list)
}
export interface SchoolWeek {
  key: string; // "3.2" = theme 3, week 2
  theme: number;
  week: number;
  label: string;
  words: SchoolWord[];
}

/** Letters that fit in one grid square (œ is left out: children usually write «oe»). */
const GRID_WORD = /^[a-zàâçéèêëîïôûùü]+$/;
const MIN = 3;
const MAX = 10; // the largest grid (level 3) has 10 squares

/** Forms of a book entry: removes «(2e)», splits «a / b», and keeps only what fits in the grid. */
export function gridForms(text: string): string[] {
  return text
    .replace(/\([^)]*\)/g, '')
    .split('/')
    .map((p) => p.trim().normalize('NFC'))
    .filter((p) => GRID_WORD.test(p) && letters(p).length >= MIN && letters(p).length <= MAX);
}

type RawEntry = string | { text: string; forms: string[] };

export const schoolWeeks: SchoolWeek[] = (data.themes as Array<{ theme: number; weeks: RawEntry[][] }>).flatMap((t) =>
  t.weeks.map((ws, i) => ({
    key: `${t.theme}.${i + 1}`,
    theme: t.theme,
    week: i + 1,
    label: `Thème ${t.theme} · semaine ${i + 1}`,
    words: ws.map((w) =>
      typeof w === 'string'
        ? { text: w, forms: gridForms(w) }
        : { text: w.text, forms: w.forms.filter((f) => GRID_WORD.test(f) && letters(f).length >= MIN && letters(f).length <= MAX) },
    ),
  })),
);

const emoji = data.emoji as Record<string, string>;

/**
 * Spelling difficulty of the word, from 1 to 5: 1 + one point for each hard thing:
 * 7 letters or more; an accent or cedilla; a sound written with more than one letter (eau, ai, ou, an, ch…);
 * a silent final letter; a double consonant. E.g. «ici» 1, «chèvre» 3, «printemps» 4, «traîneau» 4.
 */
export function levelOf(w: string): Difficulty {
  const ls = letters(w);
  let score = 0;
  if (ls.length >= 7) score++;
  if (/[àâçéèêëîïôûùü]/.test(w)) score++;
  if (/eau|ai|ei|oi|ou|eu|au|on|an|en|in|ch|gn|qu|ph/.test(w)) score++;
  if (ls.length > 3 && /[tdsxzp]$/.test(w)) score++;
  if (/(bb|cc|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt)/.test(w)) score++;
  return Math.min(5, 1 + score) as Difficulty;
}

/**
 * The game's words up to the chosen week (all of them if none was chosen) and those of that week itself (focus).
 * Repeated forms («fais» in «je fais» and «tu fais») are included only once.
 */
export function schoolPool(weekKey?: string | null): { pool: WordEntry[]; focus: Set<string> } {
  const idx = weekKey ? schoolWeeks.findIndex((w) => w.key === weekKey) : -1;
  const weeks = idx >= 0 ? schoolWeeks.slice(0, idx + 1) : schoolWeeks;
  const seen = new Set<string>();
  const pool: WordEntry[] = [];
  for (const wk of weeks)
    for (const sw of wk.words)
      for (const f of sw.forms) {
        if (seen.has(f)) continue;
        seen.add(f);
        pool.push({ word: f, level: levelOf(f), ...(emoji[f] ? { emoji: emoji[f] } : {}) });
      }
  const focus = new Set(idx >= 0 ? (schoolWeeks[idx] as SchoolWeek).words.flatMap((w) => w.forms) : []);
  return { pool, focus };
}

export const isSchoolWeek = (key: unknown): key is string => typeof key === 'string' && schoolWeeks.some((w) => w.key === key);
