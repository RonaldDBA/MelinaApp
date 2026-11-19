import { describe, expect, it } from 'vitest';
import type { ChoiceSpec, Difficulty, DominoSpec, FrogJumpSpec, HiddenWordsSpec, NumberPathSpec, NumberTrainSpec } from '@melina/shared';
import { dominoFaceLabel, dominoFaceValue, evaluate, games, generateExercise, generateGameRound, gridForms, hiddenWordLevels, hiddenWordOccurrences, schoolPool, schoolWeeks, skills, toPublic, wordLevel } from './index';

const seeds = Array.from({ length: 150 }, (_, i) => 1000 + i * 37);
const each = (gameId: string, fn: (ex: ReturnType<typeof generateGameRound>, d: Difficulty) => void) => {
  const g = games.find((x) => x.id === gameId);
  if (!g) throw new Error(gameId);
  for (const skill of g.skills) for (const d of [1, 2, 3] as Difficulty[]) for (const s of seeds) fn(generateGameRound(gameId, skill, d, s), d);
};

/** Text of the right answer of any exercise (to check grading). */
const rightAnswer = (ex: ReturnType<typeof generateGameRound>): string => {
  const e = ex.expected;
  if (e.type === 'number') return String(e.value);
  if (e.type === 'sequence') return e.values.join(',');
  if (e.type === 'word') return e.value;
  return e.display;
};

describe('levels 4 and 5 (every skill goes up to 5)', () => {
  it('every skill has 6 described levels (6 = «Défi»)', () => {
    for (const s of skills) expect(Object.keys(s.levels).sort(), s.id).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('games at levels 4 and 5: varied, answerable rounds, right answer accepted and common errors rejected', () => {
    for (const g of games) {
      for (const skill of g.skills) {
        for (const d of [4, 5, 6] as Difficulty[]) {
          const keys = new Set<string>();
          for (const s of seeds.slice(0, 80)) {
            const ex = generateGameRound(g.id, skill, d, s);
            expect(ex.difficulty).toBe(d);
            keys.add(ex.questionKey);
            const right = rightAnswer(ex);
            expect(evaluate(ex, right).result, `${g.id} ${skill} n${d}: ${right}`).toBe('correct');
            for (const e of ex.commonErrors) expect(evaluate(ex, e.match).result, `${g.id} n${d} error ${e.match}`).toBe('incorrect');
            const opts = (ex.game as { options?: string[] }).options;
            if (opts && g.id !== 'game.dominoes') {
              expect(opts.length, `${g.id} n${d}: ${opts.join('|')}`).toBeGreaterThanOrEqual(3);
              expect(opts.filter((o) => evaluate(ex, o).result === 'correct'), `${g.id} n${d} ${opts.join('|')}`).toHaveLength(1);
            }
            // 2e année numbers: nothing above 999 and nothing negative
            for (const n of JSON.stringify(ex.game).match(/-?\d+/g) ?? []) {
              if (g.subject === 'mathematics') expect(Number(n), `${g.id} n${d}`).toBeLessThanOrEqual(d >= 6 ? 9999 : 999);
            }
            if (g.id === 'game.dominoes') {
              const dm = ex.game as DominoSpec;
              const right2 = dm.pieces.filter((p) => dominoFaceValue(p.left) === dominoFaceValue(dm.table.open));
              expect(right2).toHaveLength(1);
              expect(dominoFaceLabel(right2[0]!.left)).toBe(right);
            }
            if (g.id === 'game.number-path') {
              const np = ex.game as NumberPathSpec;
              const vals = np.cells.map((c) => c.value).filter((v): v is number => v !== null);
              expect(Math.max(...vals)).toBeGreaterThanOrEqual(90); // 3-digit numbers (or nearly)
            }
          }
          expect(keys.size, `${g.id} ${skill} n${d}: variety`).toBeGreaterThan(g.id === 'game.mystery-story' ? 5 : g.id === 'game.word-fishing' ? 5 : 25);
        }
      }
    }
  });

  it('paper exercises at levels 4 and 5: generated and graded fairly', () => {
    for (const sk of skills) {
      for (const d of [4, 5, 6] as Difficulty[]) {
        for (const s of seeds.slice(0, 40)) {
          const ex = generateExercise(sk.id, d, s);
          expect(ex.difficulty).toBe(d);
          const right = rightAnswer(ex);
          expect(evaluate(ex, right).result, `${sk.id} n${d}: ${ex.statement} → ${right}`).toBe('correct');
          for (const e of ex.commonErrors) expect(evaluate(ex, e.match).result, `${sk.id} n${d} error ${e.match}`).toBe('incorrect');
        }
      }
    }
  });
});

describe('new mini-games: rounds always answerable and graded fairly', () => {
  it('the catalog has the games, each one linked to existing skills', () => {
    expect(games.map((g) => g.id)).toEqual(['game.apple-crates', 'game.number-train', 'game.frog-jump', 'game.word-fishing', 'game.mystery-story', 'game.number-path', 'game.hidden-words', 'game.dominoes']);
    for (const g of games) for (const s of g.skills) expect(skills.some((k) => k.id === s), `${g.id} → ${s}`).toBe(true);
  });

  it('Le chemin des nombres: coherent path, limits per level, change of ten and right answer accepted', () => {
    const keys: Record<Difficulty, Set<string>> = { 1: new Set<string>(), 2: new Set<string>(), 3: new Set<string>(), 4: new Set<string>(), 5: new Set<string>(), 6: new Set<string>() };
    let backward = 0;
    each('game.number-path', (ex, d) => {
      keys[d].add(ex.questionKey);
      const g = ex.game as NumberPathSpec;
      const exp = ex.expected as { type: 'sequence'; values: number[] };
      const holes = g.cells.map((c, i) => (c.value === null ? i : -1)).filter((i) => i >= 0);
      expect(holes.length).toBe(exp.values.length);
      expect(g.cells[0]?.value).not.toBeNull(); // the first stone always shows
      const full = g.cells.map((c, i) => c.value ?? (exp.values[holes.indexOf(i)] as number));
      // never three empty stones in a row
      for (let k = 2; k < holes.length; k++) expect(holes[k] === (holes[k - 2] as number) + 2 && holes[k - 1] === (holes[k - 2] as number) + 1).toBe(false);
      if (d === 1 || d === 2) {
        expect(g.layout).toBe('line');
        expect(g.cells).toHaveLength(10);
        const steps = new Set(full.slice(1).map((v, i) => v - (full[i] as number)));
        expect(steps.size).toBe(1);
        const step = [...steps][0] as number;
        expect(Math.abs(step)).toBe(1);
        if (d === 1) {
          expect(step).toBe(1);
          expect(Math.max(...full)).toBeLessThanOrEqual(20);
          expect(holes).toHaveLength(3);
        } else {
          if (step < 0) backward++;
          expect(Math.min(...full)).toBeGreaterThanOrEqual(1);
          expect(Math.max(...full)).toBeLessThanOrEqual(100);
          // one empty stone exactly at the change of ten
          const change = full.findIndex((v, i) => i > 0 && Math.floor(v / 10) !== Math.floor((full[i - 1] as number) / 10));
          expect(change).toBeGreaterThanOrEqual(2);
          expect(holes).toContain(change);
        }
      } else {
        expect(g.layout).toBe('grid');
        expect(g.grid).toEqual({ rows: 4, cols: 5 });
        expect(new Set(g.cells.map((c) => `${c.row},${c.col}`)).size).toBe(g.cells.length);
        let vertHole = false;
        g.cells.forEach((c, i) => {
          expect(c.row).toBeGreaterThanOrEqual(0);
          expect(c.row).toBeLessThan(4);
          expect(c.col).toBeGreaterThanOrEqual(0);
          expect(c.col).toBeLessThan(5);
          if (i === 0) return;
          const p = g.cells[i - 1] as { row: number; col: number };
          const dr = (c.row as number) - p.row;
          const dc = (c.col as number) - p.col;
          expect(Math.abs(dr) + Math.abs(dc)).toBe(1); // neighbouring squares
          expect((full[i] as number) - (full[i - 1] as number)).toBe(dr * 10 + dc); // hundred chart
          if (dr !== 0 && c.value === null) vertHole = true;
        });
        expect(vertHole).toBe(true);
        expect(Math.max(...full)).toBeLessThanOrEqual(100);
        expect(Math.min(...full)).toBeGreaterThanOrEqual(1);
      }
      expect(evaluate(ex, exp.values.join(',')).result).toBe('correct');
      expect(evaluate(ex, exp.values.join(', ')).result).toBe('correct');
      for (const e of ex.commonErrors) expect(evaluate(ex, e.match).result).toBe('incorrect');
    });
    expect(backward).toBeGreaterThan(30); // level 2 has backward paths
    for (const d of [1, 2, 3] as const) expect(keys[d].size).toBeGreaterThan(60); // real variety
  });

  it('Les mots cachés: square grid, each word exactly once, directions per level, coherent final test', () => {
    const keys: Record<Difficulty, Set<string>> = { 1: new Set<string>(), 2: new Set<string>(), 3: new Set<string>(), 4: new Set<string>(), 5: new Set<string>(), 6: new Set<string>() };
    let diagonal = 0;
    each('game.hidden-words', (ex, d) => {
      keys[d].add(ex.questionKey);
      const g = ex.game as HiddenWordsSpec;
      const lv = hiddenWordLevels[d];
      expect(g.grid).toHaveLength(lv.size);
      for (const row of g.grid) {
        expect(row).toHaveLength(lv.size);
        for (const ch of row) expect(ch).toMatch(/^[a-zàâçéèêëîïôûùü]$/);
      }
      expect(g.directions).toEqual(d === 3 ? ['h', 'v', 'd'] : ['h', 'v']);
      expect(g.words).toHaveLength(lv.count);
      expect(new Set(g.words.map((w) => w.word)).size).toBe(lv.count);
      // each word appears exactly once in the allowed directions (never diagonally at levels 1 and 2)
      for (const w of g.words) {
        expect(hiddenWordOccurrences(g.grid, w.word, g.directions)).toBe(1);
        if (d < 3) expect(hiddenWordOccurrences(g.grid, w.word, ['d'])).toBe(0);
        else if (hiddenWordOccurrences(g.grid, w.word, ['d']) === 1) diagonal++;
      }
      // test: the target word is one of the found ones, with at least one gap, and the keyboard has the right letters
      const target = (g.words[g.final.index] as { word: string }).word;
      const ls = [...target];
      expect(g.final.pattern).toHaveLength(ls.length);
      const holes = g.final.pattern.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
      expect(holes.length).toBeGreaterThan(0);
      g.final.pattern.forEach((p, i) => p !== null && expect(p).toBe(ls[i]));
      for (const i of holes) expect(g.final.letters).toContain(ls[i]);
      expect(g.final.letters.length).toBeGreaterThanOrEqual(Math.min(8, new Set(holes.map((i) => ls[i])).size + 2));
      expect(new Set(g.final.letters).size).toBe(g.final.letters.length);
      expect(evaluate(ex, target).result).toBe('correct');
      expect(evaluate(ex, target.toUpperCase()).result).toBe('correct');
    });
    expect(diagonal).toBeGreaterThan(20); // level 3 really uses the diagonal
    for (const d of [1, 2, 3] as const) expect(keys[d].size).toBeGreaterThan(15);
  });

  it('School list: 31 weeks transcribed; only forms that fit in the grid', () => {
    expect(schoolWeeks).toHaveLength(31);
    expect(schoolWeeks.map((w) => w.key).slice(0, 6)).toEqual(['1.1', '1.2', '1.3', '1.4', '1.5', '2.1']);
    expect(gridForms('fâché / fâchée')).toEqual(['fâché', 'fâchée']);
    expect(gridForms('deuxième (2e)')).toEqual(['deuxième']);
    expect(gridForms('madame (Mme) / mesdames')).toEqual(['madame', 'mesdames']);
    for (const t of ['à côté de', 'grand-maman', 'me / m’', "aujourd'hui", 'cœur', 'y', 'ni']) expect(gridForms(t)).toEqual([]);
    expect(gridForms('que / qu\'')).toEqual(['que']);
    const all = schoolPool(null).pool;
    expect(all.length).toBeGreaterThan(250);
    expect(new Set(all.map((w) => w.word)).size).toBe(all.length); // «fais» from «je fais» and «tu fais» is included once
    for (const w of all) expect(w.word).toMatch(/^[a-zàâçéèêëîïôûùü]{3,10}$/);
  });

  it('Les mots cachés levels 4 and 5: bigger grid, more words, harder words, more demanding test', () => {
    const avgLevel: Record<number, number> = {};
    for (const d of [1, 2, 3, 4, 5] as Difficulty[]) {
      let sum = 0;
      for (const s of seeds.slice(0, 60)) {
        const ex = generateGameRound('game.hidden-words', 'fr.spelling', d, s);
        const g = ex.game as HiddenWordsSpec;
        const lv = hiddenWordLevels[d];
        expect(g.grid).toHaveLength(lv.size);
        expect(g.words).toHaveLength(lv.count);
        for (const w of g.words) expect(hiddenWordOccurrences(g.grid, w.word, ['h', 'v', 'd'])).toBe(1);
        const target = (ex.expected as { value: string }).value;
        const holes = g.final.pattern.filter((p) => p === null).length;
        if (d === 4) expect(holes).toBe([...target].length - 1); // only the 1st letter stays
        if (d === 5) expect(holes).toBe([...target].length); // dictation
        expect(evaluate(ex, target).result).toBe('correct');
        sum += wordLevel(target);
      }
      avgLevel[d] = sum / 60;
    }
    // the higher the game level, the harder the test word
    expect(avgLevel[5] as number).toBeGreaterThan((avgLevel[3] as number) + 0.5);
    expect(avgLevel[3] as number).toBeGreaterThan((avgLevel[1] as number) + 0.5);
    expect([wordLevel('ici'), wordLevel('chèvre'), wordLevel('printemps'), wordLevel('princesse')]).toEqual([1, 3, 4, 4]);
  });

  it('Les mots cachés: words from recent rounds do not come back right away', () => {
    let recent: string[] = [];
    let repeats = 0;
    let total = 0;
    for (const s of seeds.slice(0, 40)) {
      const ex = generateGameRound('game.hidden-words', 'fr.spelling', 2, s, recent, { recentKeys: recent });
      const words = (ex.game as HiddenWordsSpec).words.map((w) => w.word);
      const seen = new Set(recent.flatMap((k) => k.slice(3).split(/[.-]/)));
      repeats += words.filter((w) => seen.has(w)).length;
      total += words.length;
      recent = [ex.questionKey, ...recent].slice(0, 8);
    }
    expect(repeats / total).toBeLessThan(0.05);
  });

  it('Les mots cachés with a chosen week: only words up to that week, test preferably from that week itself', () => {
    for (const key of ['1.1', '1.2', '2.2', '3.5', '5.3', '7.4']) {
      const { pool, focus } = schoolPool(key);
      const allowed = new Set(pool.map((w) => w.word));
      for (const d of [1, 2, 3] as Difficulty[]) {
        let fromWeek = 0;
        for (const s of seeds.slice(0, 40)) {
          const ex = generateGameRound('game.hidden-words', 'fr.spelling', d, s, [], { schoolWeek: key });
          const g = ex.game as HiddenWordsSpec;
          expect(g.words).toHaveLength(hiddenWordLevels[d].count);
          for (const w of g.words) {
            expect(allowed.has(w.word)).toBe(true);
            expect(hiddenWordOccurrences(g.grid, w.word, g.directions)).toBe(1);
          }
          // no word inside another («tout» and «toute» together would make «tout» appear twice)
          for (const a of g.words) for (const b of g.words) if (a !== b) expect(b.word.includes(a.word)).toBe(false);
          if (focus.has((ex.expected as { value: string }).value)) fromWeek++;
        }
        // week 1.1 only has short words; in the others, the test almost always comes from the chosen week
        expect(fromWeek).toBeGreaterThanOrEqual(key === '1.1' ? 40 : 30);
      }
    }
  });

  it('Les dominos des nombres: only one piece shows the same number, in another representation, within the level limits', () => {
    const keys: Record<Difficulty, Set<string>> = { 1: new Set<string>(), 2: new Set<string>(), 3: new Set<string>(), 4: new Set<string>(), 5: new Set<string>(), 6: new Set<string>() };
    const kinds: Record<Difficulty, Set<string>> = { 1: new Set<string>(), 2: new Set<string>(), 3: new Set<string>(), 4: new Set<string>(), 5: new Set<string>(), 6: new Set<string>() };
    each('game.dominoes', (ex, d) => {
      keys[d].add(ex.questionKey);
      const g = ex.game as DominoSpec;
      const target = dominoFaceValue(g.table.open);
      expect(g.pieces).toHaveLength(4);
      expect(g.options).toEqual(g.pieces.map((p) => p.label));
      expect(new Set(g.options).size).toBe(4);
      expect(g.pieces.map((p) => p.label)).toEqual(g.pieces.map((p) => dominoFaceLabel(p.left)));
      const matches = g.pieces.filter((p) => dominoFaceValue(p.left) === target);
      expect(matches).toHaveLength(1);
      const right = matches[0] as DominoSpec['pieces'][number];
      // the right piece uses ANOTHER representation than the open end (it is not just copying)
      expect(right.left.kind).not.toBe(g.table.open.kind);
      for (const p of g.pieces) expect(p.left.kind).toBe(right.left.kind);
      kinds[d].add(`${g.table.open.kind}>${right.left.kind}`);
      const vals = g.pieces.map((p) => dominoFaceValue(p.left));
      if (d === 1) {
        expect(vals.every((v) => v >= 1 && v <= 9)).toBe(true);
        expect(['dots>digit', 'digit>dots']).toContain(`${g.table.open.kind}>${right.left.kind}`);
      } else if (d === 2) {
        expect(target).toBeGreaterThanOrEqual(2);
        expect(target).toBeLessThanOrEqual(18);
        expect(['expr>digit', 'digit>expr']).toContain(`${g.table.open.kind}>${right.left.kind}`);
        const expr = (g.table.open.kind === 'expr' ? g.table.open : right.left) as { text: string };
        const [a, op, b] = expr.text.split(' ');
        // the operation bridges through ten: a sum ≥ 11 or a subtraction from a number ≥ 11 with a result ≤ 9
        if (op === '+') expect(Number(a) + Number(b)).toBeGreaterThanOrEqual(11);
        else expect(Number(a)).toBeGreaterThanOrEqual(11);
        expect(Number(a)).toBeLessThanOrEqual(18);
        expect(Number(b)).toBeLessThanOrEqual(9);
      } else {
        expect(target).toBeGreaterThanOrEqual(11);
        expect(target).toBeLessThanOrEqual(99);
        expect(['tens>digit', 'digit>tens']).toContain(`${g.table.open.kind}>${right.left.kind}`);
        for (const p of g.pieces) if (p.left.kind === 'tens') expect(p.left.units).toBeGreaterThanOrEqual(1);
      }
      expect(evaluate(ex, right.label).result).toBe('correct');
      for (const p of g.pieces.filter((x) => x !== right)) expect(evaluate(ex, p.label).result).toBe('incorrect');
      for (const e of ex.commonErrors) expect(evaluate(ex, e.match).errorType).toBe(e.type);
    });
    for (const d of [1, 2, 3] as const) {
      expect(kinds[d].size).toBe(2); // both directions appear (e.g. dots→digit and digit→dots)
      expect(keys[d].size).toBeGreaterThan(d === 1 ? 15 : 60);
    }
  });

  it('Les dominos des nombres: at level 3, the tens/units inversion is a distractor with its own message', () => {
    let inv = 0;
    for (const s of seeds) {
      const ex = generateGameRound('game.dominoes', 'math.representations', 3, s);
      if (ex.commonErrors.some((e) => e.type === 'inversion-dizaines-unites')) inv++;
    }
    expect(inv).toBeGreaterThan(100);
  });

  it('Les mots cachés: a wrong accent is recognized as an accent error', () => {
    let accents = 0;
    for (const s of seeds) {
      const ex = generateGameRound('game.hidden-words', 'fr.spelling', 3, s);
      const target = (ex.expected as { value: string }).value;
      if (!/[éèêâà]/.test(target)) continue;
      const r = evaluate(ex, target.normalize('NFD').replace(/[̀-ͯ]/g, ''));
      expect(r.result).toBe('incorrect');
      expect(r.errorType).toBe('accent');
      accents++;
    }
    expect(accents).toBeGreaterThan(10);
  });

  it('Le chemin des nombres: common errors recognized (backward read as forward; +1 instead of +10 on the grid)', () => {
    let sens = 0;
    let col = 0;
    for (const s of seeds) {
      for (const d of [2, 3] as Difficulty[]) {
        const ex = generateGameRound('game.number-path', 'math.counting', d, s);
        for (const e of ex.commonErrors) {
          const r = evaluate(ex, e.match);
          expect(r.errorType).toBe(e.type);
          if (e.type === 'sens-inverse') sens++;
          if (e.type === 'grille-colonne-plus-un') col++;
        }
      }
    }
    expect(sens).toBeGreaterThan(20);
    expect(col).toBeGreaterThan(20);
  });

  it('no public round reveals the answer or the error sentence', () => {
    for (const g of games) {
      const pub = toPublic(generateGameRound(g.id, g.skills[0] as string, 2, 99)) as unknown as Record<string, unknown>;
      expect(Object.keys(pub)).not.toEqual(expect.arrayContaining(['expected']));
      expect(pub.retryMessage).toBeUndefined();
      expect(pub.explanation).toBeUndefined();
    }
  });

  it('Le train des nombres: a single empty wagon, constant rule, right answer accepted', () => {
    each('game.number-train', (ex) => {
      const terms = (ex.game as NumberTrainSpec).terms;
      expect(terms).toHaveLength(6);
      expect(terms.filter((t) => t === null)).toHaveLength(1);
      const hole = terms.indexOf(null);
      const value = (ex.expected as { value: number }).value;
      const full = terms.map((t) => (t === null ? value : t));
      const steps = full.slice(1).map((t, i) => t - (full[i] as number));
      expect(new Set(steps).size).toBe(1);
      expect(full.every((t) => t >= 0 && t <= 150)).toBe(true);
      expect(hole).toBeGreaterThanOrEqual(1); // there is always a neighbour before it to work out the rule
      expect(evaluate(ex, String(value)).result).toBe('correct');
      for (const e of ex.commonErrors) expect(evaluate(ex, e.match).result).toBe('incorrect');
    });
  });

  it('Saute-grenouille: landing never negative and exactly one right option', () => {
    each('game.frog-jump', (ex) => {
      const g = ex.game as FrogJumpSpec;
      const target = g.op === '+' ? g.start + g.jump : g.start - g.jump;
      expect(target).toBeGreaterThanOrEqual(0);
      expect(target).toBeLessThanOrEqual(100);
      expect(new Set(g.options).size).toBe(g.options.length);
      expect(g.options.length).toBe(4);
      expect(g.options.filter((o) => evaluate(ex, o).result === 'correct')).toEqual([String(target)]);
      expect(g.options).not.toContain(String(g.start));
    });
  });

  it('La pêche aux mots: three different spellings, only one right', () => {
    each('game.word-fishing', (ex) => {
      const g = ex.game as ChoiceSpec;
      expect(g.options).toHaveLength(3);
      expect(new Set(g.options).size).toBe(3);
      expect(g.options.filter((o) => evaluate(ex, o).result === 'correct')).toHaveLength(1);
      expect(g.options.every((o) => /^[a-zàâçéèêëîïôûùüÿœ-]+$/.test(o))).toBe(true);
    });
  });

  it('L’histoire mystère: original text, three answers, only one right', () => {
    each('game.mystery-story', (ex) => {
      const g = ex.game as ChoiceSpec;
      expect(ex.visual?.kind).toBe('text');
      expect(g.options).toHaveLength(3);
      expect(new Set(g.options).size).toBe(3);
      expect(g.options.filter((o) => evaluate(ex, o).result === 'correct')).toHaveLength(1);
    });
  });
});
