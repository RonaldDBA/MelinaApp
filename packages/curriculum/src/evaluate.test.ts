import { describe, expect, it } from 'vitest';
import type { ExerciseInstance } from '@melina/shared';
import { evaluate, generateExercise } from './index';

/** Minimal sequence exercise (only what grading uses). */
const seq = (values: number[]) => ({ expected: { type: 'sequence', values }, commonErrors: [] }) as unknown as ExerciseInstance;
const num = (value: number) => ({ expected: { type: 'number', value }, commonErrors: [] }) as unknown as ExerciseInstance;

describe('grading sequences written on paper (deep review)', () => {
  it('numbers separated by a space are not merged (before: «120 130» became 120130)', () => {
    expect(evaluate(seq([120, 130]), '120 130').result).toBe('correct');
    expect(evaluate(seq([95, 100]), '95 100').result).toBe('correct');
    expect(evaluate(seq([95, 100]), '95  100').result).toBe('correct');
  });
  it('a dash between numbers is a separator, not a minus sign (before: «34-35» → 34, −35)', () => {
    expect(evaluate(seq([34, 35]), '34-35').result).toBe('correct');
    expect(evaluate(seq([34, 35]), '34 - 35').result).toBe('correct');
  });
  it('commas and semicolons still work; a thousands space within each part too', () => {
    expect(evaluate(seq([120, 130]), '120, 130').result).toBe('correct');
    expect(evaluate(seq([120, 130]), '120;130').result).toBe('correct');
    expect(evaluate(seq([1000, 1100]), '1 000, 1 100').result).toBe('correct');
    expect(evaluate(seq([4028, 4428]), '4028,4428').result).toBe('correct');
  });
  it('thousands space WITHOUT a comma, as written in Québec: «1 750 2 000» (level 6)', () => {
    expect(evaluate(seq([1750, 2000]), '1 750 2 000').result).toBe('correct');
    expect(evaluate(seq([120, 130, 140]), '120 130, 140').result).toBe('correct');
    expect(evaluate(seq([1750, 2000]), '1750 2000').result).toBe('correct');
  });

  it('a wrong answer stays wrong', () => {
    expect(evaluate(seq([120, 130]), '120 131').result).toBe('incorrect');
    expect(evaluate(seq([120, 130]), '120130').result).toBe('incorrect');
    expect(evaluate(seq([120, 130]), '120').result).toBe('incorrect');
  });
  it('single number: a thousands space and «= 37» still work', () => {
    expect(evaluate(num(1000), '1 000').result).toBe('correct');
    expect(evaluate(num(37), '30 + 7 = 37').result).toBe('correct');
  });

  it('compréhension: «2» counts the same as «deux» (before: «deux» right, «2» wrong)', () => {
    const q = { expected: { type: 'short-text', variants: [['deux dollar'], ['2 dollar'], ['2$'], ['2 $'], ['deux']], display: 'Deux dollars (2 $).' }, commonErrors: [] } as unknown as ExerciseInstance;
    for (const a of ['2', 'deux', '2 dollars', 'Il donne 2 $.', 'deux dollars']) expect(evaluate(q, a).result, a).toBe('correct');
    for (const a of ['3', 'trois', '12', 'vingt']) expect(evaluate(q, a).result, a).toBe('incorrect');
  });

  it('pluriel of a group with the adjective in front: «de beaux chapeaux» counts; «de chapeaux» does not', () => {
    let gn: ExerciseInstance | null = null;
    let plain: ExerciseInstance | null = null;
    for (let seed = 1; seed < 4000 && (!gn || !plain); seed++) {
      for (const d of [1, 2, 3, 4, 5, 6] as const) {
        const ex = generateExercise('fr.plural', d, seed);
        const v = (ex.expected as { value: string }).value;
        if (v === 'beaux chapeaux') gn = ex;
        if (v === 'chapeaux') plain = ex;
      }
    }
    expect(gn, 'item «un beau chapeau» exists').not.toBeNull();
    expect(evaluate(gn as ExerciseInstance, 'de beaux chapeaux').result).toBe('correct');
    expect(evaluate(gn as ExerciseInstance, 'des beaux chapeaux').result).toBe('correct');
    if (plain) expect(evaluate(plain, 'de chapeaux').result).toBe('incorrect');
  });

  it('reformed spelling (1990, accepted in Québec): «traineau» counts as «traîneau»; required accents still apply', () => {
    const w = (value: string) => ({ expected: { type: 'word', value, accentsMatter: true }, commonErrors: [] }) as unknown as ExerciseInstance;
    expect(evaluate(w('traîneau'), 'traineau').result).toBe('correct');
    expect(evaluate(w('boîte'), 'boite').result).toBe('correct');
    expect(evaluate(w('fenêtre'), 'fenetre').result).toBe('incorrect'); // ê does not change in the reform
    expect(evaluate(w('sûr'), 'sur').result).toBe('incorrect'); // exception: sûr ≠ sur
  });
});

