import { describe, expect, it } from 'vitest';
import type { Difficulty, ExerciseInstance } from '@melina/shared';
import { addSubWorked, games, generateExercise, generateGameRound, sequenceWorked, workedFor, workedHint } from './index';

const LEVELS: Difficulty[] = [1, 2, 3, 4, 5, 6];
const SEEDS = Array.from({ length: 120 }, (_, i) => 5 + i * 613);
const answerOf = (ex: ExerciseInstance) => (ex.expected.type === 'number' ? String(ex.expected.value) : ex.expected.type === 'sequence' ? ex.expected.values.join(', ') : '');

/** Every «a op b = c» written in the steps is true. */
function arithmeticHolds(lines: string[]) {
  for (const l of lines)
    for (const m of l.matchAll(/(?<![+−]\s?)(?<!\d)(\d+)\s*([+−])\s*(\d+)\s*=\s*(\d+)/g)) {
      const [a, op, b, c] = [Number(m[1]), m[2], Number(m[3]), Number(m[4])];
      expect(op === '+' ? a + b : a - b, l).toBe(c);
    }
}

describe('«Comment calculer»: worked explanations for math mistakes', () => {
  it('completing the ten: 8 + 5 and 52 − 7', () => {
    expect(addSubWorked(8, 5, true)).toMatchObject({
      plan: 'On part de 8 et on avance de 5.',
      steps: ['8 + 2 = 10 (on complète la dizaine).', 'Il reste 3 : 10 + 3 = 13.'],
      answer: 'Donc 8 + 5 = 13.',
    });
    expect(addSubWorked(52, 7, false).steps).toEqual(['52 − 2 = 50 (on recule jusqu’à la dizaine).', 'Il reste 5 : 50 − 5 = 45.']);
  });

  it('jumps by place value: 34 + 28 and 245 + 130', () => {
    const w = addSubWorked(34, 28, true);
    expect(w.plan).toBe('On découpe 28 : 20 + 8. On saute un morceau à la fois.');
    expect(w.steps).toEqual(['34 + 20 = 54.', '54 + 6 = 60 (on complète la dizaine).', 'Il reste 2 : 60 + 2 = 62.']);
    expect(addSubWorked(245, 130, true).steps).toEqual(['245 + 100 = 345.', '345 + 30 = 375.']);
  });

  it('a sequence: the gap between neighbours is the rule', () => {
    const w = sequenceWorked([15, 20, null, 30], [25])!;
    expect(w.plan).toBe('Regarde l’écart entre deux nombres voisins : 15 → 20. À chaque fois, on ajoute 5.');
    expect(w.steps).toEqual(['Après 20 : 20 + 5 = 25.']);
    expect(sequenceWorked([null, 80, 70, 60], [90])!.steps).toEqual(['Avant 80 : 80 + 10 = 90.']);
  });

  it('every math game and paper exercise, every level: an explanation whose arithmetic is right and which ends on the answer', () => {
    const mathGames = games.filter((g) => g.subject === 'mathematics');
    for (const g of mathGames)
      for (const skill of g.skills)
        for (const d of LEVELS)
          for (const seed of SEEDS.slice(0, 40)) {
            const ex = generateGameRound(g.id, skill, d, seed);
            const w = workedFor(ex);
            expect(w, `${g.id} n${d} #${seed}`).not.toBeNull();
            arithmeticHolds([...w!.steps, w!.answer]);
            if (g.id !== 'game.dominoes') expect(w!.answer, `${g.id} n${d}`).toContain(answerOf(ex).split(', ')[0] as string);
            expect(w!.steps.length + 1).toBeLessThanOrEqual(6); // short enough for her
          }
    for (const skill of ['math.add-sub', 'math.sequences'])
      for (const d of LEVELS)
        for (const seed of SEEDS.slice(0, 30)) {
          const ex = generateExercise(skill, d, seed);
          const w = workedFor(ex);
          expect(w, `${skill} n${d}`).not.toBeNull();
          arithmeticHolds([...w!.steps, w!.answer]);
          expect(w!.answer).toContain(answerOf(ex).split(', ')[0] as string);
        }
  });

  it('the hint after the 2nd mistake never gives the final answer', () => {
    for (const g of games.filter((x) => x.subject === 'mathematics'))
      for (const skill of g.skills)
        for (const d of LEVELS)
          for (const seed of SEEDS.slice(0, 30)) {
            const ex = generateGameRound(g.id, skill, d, seed);
            const w = workedFor(ex);
            if (!w) continue;
            const hint = workedHint(w);
            for (const v of answerOf(ex).split(', ')) expect(hint, `${g.id} n${d}: «${hint}» / ${v}`).not.toMatch(new RegExp(`=\\s*${v}(?!\\d)`));
          }
  });

  it('French games have no math explanation (they keep their own help)', () => {
    expect(workedFor(generateGameRound('game.word-fishing', 'fr.plural', 2, 7))).toBeNull();
  });
});
