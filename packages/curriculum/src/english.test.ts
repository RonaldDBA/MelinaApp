import { describe, expect, it } from 'vitest';
import type { CommandsSpec, Difficulty, ListenPickSpec } from '@melina/shared';
import { englishPairs, englishWord, englishWords, evaluate, generateGameRound, LISTEN_OPTIONS, soundAlikes, strategyPraise, tagsOf, TAG_LABELS, toPublic } from './index';

const LEVELS: Difficulty[] = [1, 2, 3, 4, 5, 6];
const SEEDS = Array.from({ length: 300 }, (_, i) => 11 + i * 977);
const round = (d: Difficulty, seed: number) => generateGameRound('game.listen-garden', 'en.listen-words', d, seed);
const spec = (d: Difficulty, seed: number) => round(d, seed).game as ListenPickSpec;
const target = (d: Difficulty, seed: number) => {
  const ex = round(d, seed);
  return englishWord(ex.expected.type === 'word' ? ex.expected.value : '')!;
};
const words = (s: string) => s.toLowerCase().match(/[a-z]+(?:-[a-z]+)*/g) ?? [];

describe('English word list (original content)', () => {
  it('ids, pictures and sound-alike pairs are consistent', () => {
    const ids = englishWords.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    const pics = englishWords.map((w) => w.pic);
    expect(new Set(pics).size, 'two words with the same picture').toBe(pics.length);
    for (const p of englishPairs) expect(englishWord(p.a) && englishWord(p.b), `${p.a}/${p.b}`).toBeTruthy();
    for (const w of englishWords) {
      expect(w.level).toBeGreaterThanOrEqual(1);
      expect(w.level).toBeLessThanOrEqual(6);
      expect(w.fr.length).toBeGreaterThan(1);
      if (w.kind === 'action') expect(w.ing, w.id).toMatch(/ing\b/);
    }
  });

  it('every level has enough words: at least 25 new ones on levels 1 to 5, and at least 60 riddles', () => {
    for (const d of [1, 2, 3, 4, 5]) expect(englishWords.filter((w) => w.level === d).length, `level ${d}`).toBeGreaterThanOrEqual(25);
    expect(englishWords.filter((w) => w.clue).length).toBeGreaterThanOrEqual(60);
  });

  it('a riddle never says its own word, and is short', () => {
    for (const w of englishWords.filter((x) => x.clue)) {
      const said = words(w.clue as string);
      for (const part of words(w.en)) expect(said, `${w.id}: «${w.clue}»`).not.toContain(part);
      expect((w.clue as string).split(/[.!?]/).filter((x) => x.trim()).length, w.id).toBeLessThanOrEqual(2);
    }
  });
});

describe('Le potager qui écoute: rounds per level', () => {
  it('right number of pictures, all different, the answer among them; the answer is accepted and a distractor is not', () => {
    for (const d of LEVELS)
      for (const seed of SEEDS.slice(0, 120)) {
        const ex = round(d, seed);
        const g = ex.game as ListenPickSpec;
        const id = ex.expected.type === 'word' ? ex.expected.value : '';
        expect(g.options).toHaveLength(LISTEN_OPTIONS[d] as number);
        expect(new Set(g.options).size).toBe(g.options.length);
        expect(new Set(g.options.map((o) => g.pics[o])).size).toBe(g.options.length);
        expect(g.options).toContain(id);
        expect(evaluate(ex, id).result).toBe('correct');
        expect(evaluate(ex, g.options.find((o) => o !== id) as string).result).toBe('incorrect');
        // nothing written in English before the answer (listening game): only the spoken text carries the word
        const pub = JSON.stringify({ ...toPublic(ex), game: { ...g, say: '' } });
        expect(pub).not.toContain('"expected"');
        expect(ex.statement).toBe('Écoute bien.');
      }
  });

  it('level 1: the word alone, 3 pictures from different themes', () => {
    for (const seed of SEEDS.slice(0, 80)) {
      const g = spec(1, seed);
      expect(g.mode).toBe('word');
      const themes = g.options.map((o) => englishWord(o)!.theme);
      expect(new Set(themes).size).toBe(3);
      expect(g.options.every((o) => englishWord(o)!.level === 1)).toBe(true);
    }
  });

  it('levels 2 and 3: pictures of the same theme (closer meanings); level 3 puts the word in a sentence', () => {
    for (const d of [2, 3] as Difficulty[])
      for (const seed of SEEDS.slice(0, 80)) {
        const ex = round(d, seed);
        const g = ex.game as ListenPickSpec;
        const t = target(d, seed);
        const same = g.options.filter((o) => englishWord(o)!.theme === t.theme).length;
        expect(same, `${t.id} n${d}`).toBeGreaterThanOrEqual(Math.min(LISTEN_OPTIONS[d] as number, englishWords.filter((w) => w.theme === t.theme && w.level <= d).length));
        if (d === 3) {
          expect(g.mode).toBe('phrase');
          expect(g.say.split(' ').length).toBeGreaterThanOrEqual(2);
          expect(g.say.toLowerCase()).toContain((t.kind === 'action' ? t.ing : t.say ?? t.en)!.toLowerCase());
        } else expect(g.say).toBe(t.kind === 'action' ? t.ing : t.say ?? t.en);
      }
  });

  it('levels 4 and 5: a word with a sound-alike always meets it (ship / sheep), and the contrast is tagged', () => {
    let tested = 0;
    for (const d of [4, 5] as Difficulty[])
      for (const seed of SEEDS) {
        const ex = round(d, seed);
        const t = target(d, seed);
        const partners = soundAlikes(t.id);
        if (!partners.length) continue;
        const g = ex.game as ListenPickSpec;
        const met = partners.filter((p) => g.options.includes(p.id));
        expect(met.length, `${t.id} n${d}`).toBeGreaterThanOrEqual(1);
        for (const p of met) expect(tagsOf(ex)).toContain(p.tag);
        tested++;
      }
    expect(tested).toBeGreaterThan(30);
  });

  it('level 6: always a riddle that does not say the word, with 6 pictures', () => {
    for (const seed of SEEDS.slice(0, 120)) {
      const g = spec(6, seed);
      const t = target(6, seed);
      expect(g.mode).toBe('riddle');
      expect(g.say.endsWith('?')).toBe(true);
      for (const part of words(t.en)) expect(words(g.say)).not.toContain(part);
    }
  });

  it('real variety: many different words per level, and new words of the level come up often', () => {
    for (const d of LEVELS) {
      const ids = SEEDS.slice(0, 200).map((s) => target(d, s));
      expect(new Set(ids.map((w) => w.id)).size, `level ${d}`).toBeGreaterThanOrEqual(d === 1 ? 25 : 40);
      if (d < 6) expect(ids.filter((w) => w.level === d).length / ids.length, `level ${d}`).toBeGreaterThan(0.45);
    }
  });

  it('tags have French labels for the parents, and praise names what she heard', () => {
    for (const d of LEVELS)
      for (const seed of SEEDS.slice(0, 60)) {
        const ex = round(d, seed);
        const tags = tagsOf(ex);
        expect(tags.length).toBeGreaterThanOrEqual(2);
        for (const t of tags) expect(TAG_LABELS[t], t).toBeTruthy();
        const p = strategyPraise(ex);
        expect(p.split(' ').length).toBeLessThanOrEqual(10);
        if (tags.includes('en-devinette')) expect(p).toMatch(/devinette/);
      }
  });
});

describe('La jardinière dit: English commands done by tapping', () => {
  const cmd = (d: Difficulty, seed: number) => generateGameRound('game.garden-says', 'en.commands', d, seed);
  const steps: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 3 };
  it('every level: the right number of taps, things that exist on the table, the answer accepted and each predicted mistake rejected', () => {
    for (const d of LEVELS)
      for (const seed of SEEDS.slice(0, 150)) {
        const ex = cmd(d, seed);
        const g = ex.game as CommandsSpec;
        const ans = ex.expected.type === 'word' ? ex.expected.value : '';
        expect(g.steps).toBe(steps[d]);
        expect(ans.split(',')).toHaveLength(g.steps);
        for (const id of ans.split(',')) expect([...g.items, ...g.containers]).toContain(id);
        expect(new Set(Object.values(g.pics)).size, `n${d} #${seed}`).toBe(Object.keys(g.pics).length);
        expect(evaluate(ex, ans).result).toBe('correct');
        for (const e of ex.commonErrors) {
          const r = evaluate(ex, e.match);
          expect(r.result, e.match).toBe('incorrect');
          expect(r.errorType).toBe(e.type);
        }
        expect(g.say).toMatch(/[.!]$/);
        expect(ex.statement).toBe('Écoute bien.');
        for (const t of tagsOf(ex)) expect(TAG_LABELS[t], t).toBeTruthy();
      }
  });

  it('colour levels: the colour comes before the noun, and both the colour and the noun matter', () => {
    for (const d of [2, 4, 5, 6] as Difficulty[])
      for (const seed of SEEDS.slice(0, 80)) {
        const ex = cmd(d, seed);
        const g = ex.game as CommandsSpec;
        const target = (ex.expected.type === 'word' ? ex.expected.value : '').split(',')[0] as string;
        const [colour, noun] = target.split('-');
        expect(g.say).toContain(`${colour} ${noun}`);
        // there is always another object of the same kind in another colour, and another object in the same colour
        expect(g.items.some((i) => i !== target && i.endsWith(`-${noun}`))).toBe(true);
        expect(g.items.some((i) => i !== target && i.startsWith(`${colour}-`))).toBe(true);
        expect(tagsOf(ex)).toContain('en-couleur-nom');
        expect(ex.commonErrors.map((e) => e.type)).toEqual(expect.arrayContaining(['en-couleur', 'en-nom']));
      }
  });

  it('two steps: doing them in the wrong order is a recognized mistake; «put in» knows the wrong container', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      for (const d of [3, 5] as Difficulty[]) {
        const ex = cmd(d, seed);
        const [a, b] = (ex.expected.type === 'word' ? ex.expected.value : '').split(',');
        expect(evaluate(ex, `${b},${a}`).errorType).toBe('en-ordre');
        expect(tagsOf(ex)).toContain('en-deux-etapes');
        expect((ex.game as CommandsSpec).say).toMatch(/then/i);
      }
      const put = cmd(4, seed);
      const g = put.game as CommandsSpec;
      const [obj, box] = (put.expected.type === 'word' ? put.expected.value : '').split(',');
      expect(g.containers).toEqual(['basket', 'box']);
      expect(g.say).toBe(`Put the ${obj!.replace('-', ' ')} in the ${box}.`);
      expect(evaluate(put, `${obj},${g.containers.find((c) => c !== box)}`).errorType).toBe('en-contenant');
      expect(tagsOf(put)).toContain('en-mettre-dans');
    }
  });

  it('real variety and French help after the answer', () => {
    for (const d of LEVELS) {
      const keys = new Set(SEEDS.slice(0, 120).map((s) => cmd(d, s).questionKey));
      expect(keys.size, `level ${d}`).toBeGreaterThanOrEqual(d === 2 ? 15 : 30);
      const ex = cmd(d, 5);
      expect(ex.explanation.length).toBeGreaterThan(10);
      expect(strategyPraise(ex).split(' ').length).toBeLessThanOrEqual(10);
    }
  });
});

describe('Le potager qui écoute: words due for review come back', () => {
  it('with words due, about 4 rounds in 10 bring one back (the most overdue first); without, nothing changes', () => {
    const due = ['cow', 'pig', 'seven', 'blue'];
    const picked = SEEDS.slice(0, 300).map((s) => generateGameRound('game.listen-garden', 'en.listen-words', 1, s, [], { due }));
    const back = picked.filter((ex) => ex.expected.type === 'word' && due.includes(ex.expected.value)).length / picked.length;
    expect(back).toBeGreaterThan(0.35);
    expect(back).toBeLessThan(0.6);
    // a due word above the level is not forced into the round
    const tooHard = SEEDS.slice(0, 100).map((s) => generateGameRound('game.listen-garden', 'en.listen-words', 1, s, [], { due: ['penguin'] }));
    expect(tooHard.some((ex) => ex.expected.type === 'word' && ex.expected.value === 'penguin')).toBe(false);
  });
});
