import { describe, expect, it } from 'vitest';
import type { Difficulty } from '@melina/shared';
import { games, generateGameRound, strategyPraise, tagsOf } from './index';

const seeds = Array.from({ length: 40 }, (_, i) => 500 + i * 53);

describe('specific praise (strategyPraise)', () => {
  it('every round of every game and level has a short sentence, in French, about what she did', () => {
    for (const g of games)
      for (const skill of g.skills)
        for (const d of [1, 2, 3, 4, 5, 6] as Difficulty[])
          for (const s of seeds) {
            const ex = generateGameRound(g.id, skill, d, s);
            const p = strategyPraise(ex);
            expect(p, `${g.id} ${skill} ${d}`).toMatch(/^Tu /);
            expect(p.endsWith('.')).toBe(true);
            expect(p.split(/\s+/).length, p).toBeLessThanOrEqual(10);
            expect(p).not.toMatch(/intelligente|génie|parfait|meilleure/i); // the process, never the person
          }
  });

  it('uses the real data of the round: the suite rule, the grenouille jump, the word sound', () => {
    let seq = 0;
    let frog = 0;
    let sound = 0;
    for (const g of games)
      for (const skill of g.skills)
        for (const d of [1, 2, 3, 4] as Difficulty[])
          for (const s of seeds) {
            const ex = generateGameRound(g.id, skill, d, s);
            const p = strategyPraise(ex);
            const t = new Set(tagsOf(ex));
            const m = /^(?:seq|nt)-(-?\d+)-(-?\d+)/.exec(ex.questionKey);
            if (skill === 'math.sequences' && m) {
              seq++;
              const step = Number(m[2]);
              expect(p).toContain(step > 0 ? `on ajoute ${step}` : `on enlève ${-step}`);
            }
            const game = ex.game as { game?: string; jump?: number } | undefined;
            if (skill === 'math.add-sub' && game?.game === 'frog-jump' && !t.has('retenue') && !t.has('emprunt') && !t.has('calcul-passage-dizaine') && !t.has('retenue-centaine') && !t.has('emprunt-centaine') && (game.jump ?? 0) < 100 && (game.jump ?? 0) % 10 !== 0) {
              frog++;
              expect(p).toBe(`Tu as fait le saut de ${game.jump} sans te tromper.`);
            }
            if (skill === 'fr.spelling' && [...t].some((x) => x.startsWith('son-'))) {
              sound++;
              expect(p).toMatch(/^Tu as bien écrit le son « .+ »\.$/);
            }
            if (t.has('retenue') && skill === 'math.add-sub' && !t.has('retenue-centaine')) expect(p).toBe('Tu as bien fait la retenue.');
          }
    expect(seq).toBeGreaterThan(0);
    expect(frog).toBeGreaterThan(0);
    expect(sound).toBeGreaterThan(0);
  });

  it('8 + 5 is not «retenue»: the praise talks about bridging through ten', () => {
    let found = 0;
    for (const s of seeds)
      for (const d of [1, 2] as Difficulty[]) {
        const ex = generateGameRound('game.frog-jump', 'math.add-sub', d, s);
        const g = ex.game as { start: number; jump: number; op: string };
        if (g.op === '+' && Math.min(g.start, g.jump) < 10 && (g.start % 10) + (g.jump % 10) >= 10) {
          found++;
          expect(strategyPraise(ex)).not.toMatch(/retenue/);
        }
      }
    expect(found).toBeGreaterThan(0);
  });
});

