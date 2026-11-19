import { describe, expect, it } from 'vitest';
import { evaluate, games, generateExercise, hasPaper, skills, templates, toPublic } from './index';
import type { Difficulty } from '@melina/shared';

describe('catalog', () => {
  it('has at least six skills, all with a generator (paper or game); the English skills are screen-only', () => {
    expect(skills.length).toBeGreaterThanOrEqual(6);
    for (const s of skills) expect(templates.some((t) => t.skillId === s.id) || games.some((g) => g.skills.includes(s.id)), s.id).toBe(true);
    expect(new Set(skills.filter((s) => !hasPaper(s.id)).map((s) => s.subject))).toEqual(new Set(['english']));
  });

  it('generates valid exercises for every level with real variation', () => {
    for (const s of skills.filter((k) => hasPaper(k.id))) {
      for (const d of [1, 2, 3] as Difficulty[]) {
        const keys = new Set<string>();
        for (let seed = 1; seed <= 30; seed++) {
          const ex = generateExercise(s.id, d, seed);
          expect(ex.skillId).toBe(s.id);
          expect(ex.difficulty).toBe(d);
          expect(ex.statement.length).toBeGreaterThan(5);
          keys.add(ex.questionKey);
          // the expected answer must be graded as correct
          const exp = ex.expected;
          const answer =
            exp.type === 'number' ? String(exp.value) : exp.type === 'sequence' ? exp.values.join(', ') : exp.type === 'word' ? exp.value : exp.display;
          expect(evaluate(ex, answer).result, `${ex.questionKey} -> ${answer}`).toBe('correct');
        }
        expect(keys.size, `${s.id} level ${d}`).toBeGreaterThan(3);
      }
    }
  });

  it('respects numeric ranges per level', () => {
    for (let seed = 1; seed < 200; seed++) {
      const a = generateExercise('math.add-sub', 1, seed);
      if (a.expected.type === 'number') expect(a.expected.value).toBeLessThanOrEqual(20);
      const c = generateExercise('math.add-sub', 3, seed);
      if (c.expected.type === 'number') expect(c.expected.value).toBeLessThanOrEqual(99);
      const p = generateExercise('math.place-value', 1, seed);
      if (p.expected.type === 'number') expect(p.expected.value).toBeLessThan(60);
    }
  });

  it('avoids immediately repeating the same question', () => {
    const first = generateExercise('math.sequences', 1, 42);
    const second = generateExercise('math.sequences', 1, 42, [first.questionKey]);
    expect(second.questionKey).not.toBe(first.questionKey);
  });

  it('the public version does not expose the answer', () => {
    const ex = generateExercise('fr.spelling', 2, 3);
    const pub = toPublic(ex) as unknown as Record<string, unknown>;
    expect(pub.expected).toBeUndefined();
    expect(pub.explanation).toBeUndefined();
    expect(JSON.stringify(pub)).not.toContain(ex.expected.type === 'word' ? `"${ex.expected.value}"` : '###');
  });
});

describe('grading', () => {
  const pv = generateExercise('math.place-value', 1, 5);
  it('numbers: ignores spaces and detects inversion', () => {
    if (pv.expected.type !== 'number') throw new Error('type');
    const n = pv.expected.value;
    expect(evaluate(pv, ` ${n} `).result).toBe('correct');
    const inv = Number(String(n).split('').reverse().join(''));
    if (inv !== n) expect(evaluate(pv, String(inv)).errorType).toBe('inversion-dizaines-unites');
  });

  it('spelling: the accent is part of the skill', () => {
    let ex = generateExercise('fr.spelling', 3, 1);
    for (let s = 1; ex.expected.type !== 'word' || ex.expected.value !== 'été'; s++) ex = generateExercise('fr.spelling', 3, s);
    expect(evaluate(ex, 'été').result).toBe('correct');
    expect(evaluate(ex, 'Été').result).toBe('correct');
    const r = evaluate(ex, 'ete');
    expect(r.result).toBe('incorrect');
    expect(r.errorType).toBe('accent');
  });

  it('plural: detects a forgotten mark and -x', () => {
    let ex = generateExercise('fr.plural', 2, 1);
    for (let s = 1; ex.questionKey !== 'pl-bateau'; s++) ex = generateExercise('fr.plural', 2, s);
    expect(evaluate(ex, 'bateaux').result).toBe('correct');
    expect(evaluate(ex, 'des bateaux').result).toBe('correct');
    expect(evaluate(ex, 'bateaus').errorType).toBe('pluriel-x');
    expect(evaluate(ex, 'bateau').errorType).toBe('marque-pluriel-oubliee');
  });

  it('comprehension: accepts variants, does not require exact text equality', () => {
    let ex = generateExercise('fr.comprehension', 1, 1);
    for (let s = 1; ex.questionKey !== 'comp-castor-q2'; s++) ex = generateExercise('fr.comprehension', 1, s);
    expect(evaluate(ex, 'Avec ses dents.').result).toBe('correct');
    expect(evaluate(ex, 'il coupe avec ces grandes DENTS').result).toBe('correct');
    expect(evaluate(ex, 'avec une scie').result).toBe('incorrect');
  });

  it('sequence: order matters', () => {
    const ex = generateExercise('math.sequences', 2, 9);
    if (ex.expected.type !== 'sequence') throw new Error('type');
    const [a, b] = ex.expected.values;
    expect(evaluate(ex, `${a}, ${b}`).result).toBe('correct');
    expect(evaluate(ex, `${a} ${b}`).result).toBe('correct');
    expect(evaluate(ex, `${b}, ${a}`).result).toBe('incorrect');
  });

  it('grouping: forgetting the incomplete group is detected', () => {
    let ex = generateExercise('math.grouping-tens', 2, 1);
    if (ex.expected.type !== 'number') throw new Error('type');
    const r = evaluate(ex, String(ex.expected.value - 1));
    expect(r.errorType).toBe('groupe-incomplet-oublie');
    ex = generateExercise('math.grouping-tens', 2, 2);
  });
});
