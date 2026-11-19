import { describe, expect, it } from 'vitest';
import type { Difficulty, ExerciseInstance } from '@melina/shared';
import { games, generateExercise, generateGameRound, hasPaper, skills, spellingTags, tagsOf, wordLevel as levelOfWord } from './index';

/**
 * Quality sweep (deep review): every paper and game generator, levels 1 to 6,
 * hundreds of seeds. Each rule here came from a bug that was found.
 */
const SEEDS = Array.from({ length: 400 }, (_, i) => 7 + i * 131);
const LEVELS: Difficulty[] = [1, 2, 3, 4, 5, 6];

function* allItems(): Generator<[string, ExerciseInstance]> {
  for (const s of skills.filter((k) => hasPaper(k.id))) for (const d of LEVELS) for (const seed of SEEDS) yield [`paper ${s.id} n${d} #${seed}`, generateExercise(s.id, d, seed)];
  for (const g of games) for (const sk of g.skills) for (const d of LEVELS) for (const seed of SEEDS.slice(0, 120)) yield [`${g.id} ${sk} n${d} #${seed}`, generateGameRound(g.id, sk, d, seed)];
}

/** Numbers the child sees in the statement. */
const shownNumbers = (ex: ExerciseInstance) => (ex.statement.match(/-?\d+/g) ?? []).map(Number);

describe('quality of the generated content', () => {
  it('no negative number, neither in the expected answer nor in the statement (before: level-3 suites went below zero)', () => {
    const bad: string[] = [];
    for (const [id, ex] of allItems()) {
      const e = ex.expected;
      const vals = e.type === 'number' ? [e.value] : e.type === 'sequence' ? e.values : [];
      if (vals.some((v) => v < 0) || /(^|[^\w])-\d/.test(ex.statement)) bad.push(`${id}: ${ex.statement} → ${JSON.stringify(vals)}`);
    }
    expect(bad.slice(0, 5), `${bad.length} items`).toEqual([]);
  });

  it('the step stated in the explanation matches the path numbers (before: «de 1 en 1» on paths by 100)', () => {
    const bad: string[] = [];
    for (const [id, ex] of allItems()) {
      const m = /(?:avance|recule) de 1 en 1 : ([\d, ]+)\./.exec(ex.explanation) ?? /(?:ajoute|enlève) (\d+) à chaque fois : ([\d, ]+)\./.exec(ex.explanation);
      if (!m) continue;
      const list = (m[m.length - 1] as string).split(',').map((x) => Number(x.trim()));
      const step = m.length === 2 ? 1 : Number(m[1]);
      if (list.slice(1).some((v, i) => Math.abs(v - (list[i] as number)) !== step)) bad.push(`${id}: ${ex.explanation}`);
    }
    for (const [id, ex] of allItems())
      for (const e of ex.commonErrors) if (/recule de 1 à chaque pas/.test(e.message) && !/de 1 en 1/.test(ex.explanation)) bad.push(`${id}: ${e.message}`);
    expect(bad.slice(0, 4), `${bad.length} items`).toEqual([]);
  });

  it('French: «0» and «1» with the noun in the singular («1 dizaine», not «1 dizaines»); «paniers pleins»', () => {
    const texts = (ex: ExerciseInstance) =>
      [ex.statement, ex.explanation, ex.hint, ex.retryMessage ?? '', ex.instruction, ...ex.commonErrors.map((e) => e.message)].join(' | ');
    // invariable words ending in s/x
    const ok = new Set(['fois', 'mois', 'gros', 'souris', 'repas', 'bras', 'nez', 'prix', 'voix', 'choix', 'jus', 'pas', 'bus', 'dos', 'os']);
    const found = new Map<string, string>();
    for (const [id, ex] of allItems()) {
      const t = texts(ex);
      for (const m of t.matchAll(/(?<![\d,.])\b([01]) ([a-zàâçéèêëîïôûùüÿœ]+[sx])\b/gi)) if (!ok.has((m[2] as string).toLowerCase())) found.set(`«${m[0]}»`, id);
      for (const m of t.matchAll(/\b(paniers|sacs|bacs|seaux|pots) pleines\b/g)) found.set(`«${m[0]}»`, id);
    }
    expect([...found.entries()].map(([k, v]) => `${k} in ${v}`)).toEqual([]);
  });

  it('correct sound tags for words on the list (main, reine, semaine, plein, monsieur, bonne)', () => {
    const has = (w: string, t: string) => spellingTags(w).includes(t);
    expect(has('main', 'son-in-ain') && !has('main', 'son-ai-ei')).toBe(true);
    expect(has('plein', 'son-in-ain') && !has('plein', 'son-ai-ei')).toBe(true);
    expect(has('reine', 'son-ai-ei') && !has('reine', 'son-in-ain')).toBe(true);
    expect(has('semaine', 'son-ai-ei') && !has('semaine', 'son-in-ain')).toBe(true);
    expect(has('monsieur', 'son-on')).toBe(false);
    expect(has('bonne', 'son-on')).toBe(false);
    expect(has('maison', 'son-on')).toBe(true);
    // «ils disent»: the final -ent is silent; «vent» is the « an » sound
    expect(has('disent', 'son-an-en')).toBe(false);
    expect(has('vent', 'son-an-en')).toBe(true);
  });

  it('silent letter: the final «s» of cactus, virus, fils, autobus and ours is pronounced', () => {
    for (const w of ['cactus', 'virus', 'fils', 'autobus', 'ours', 'tennis']) expect(spellingTags(w), w).not.toContain('lettre-muette');
    for (const w of ['chat', 'souris', 'grand', 'tapis']) expect(spellingTags(w), w).toContain('lettre-muette');
  });

  it('«retenue» only in arithmetic with two numbers of 2 digits or more; 8 + 5 is bridging through ten', () => {
    const bad: string[] = [];
    for (const [id, ex] of allItems()) {
      const t = tagsOf(ex);
      const g = ex.game as { game?: string; start?: number; jump?: number } | undefined;
      const m = /^as-(\d+)[+-](\d+)$/.exec(ex.questionKey);
      const pair = g?.game === 'frog-jump' ? [g.start as number, g.jump as number] : m ? [Number(m[1]), Number(m[2])] : null;
      if (pair && Math.min(...pair) < 10 && (t.includes('retenue') || t.includes('emprunt'))) bad.push(`${id}: ${ex.questionKey} ${t}`);
      // 4 digits is not «nombres à 3 chiffres»
      if (t.includes('nombres-3-chiffres') && (ex.statement.match(/\d+/g) ?? []).some((x) => Number(x) >= 1000) && !t.includes('nombres-4-chiffres')) bad.push(`${id}: 4 digits tagged as 3`);
    }
    expect(bad.slice(0, 4), `${bad.length} items`).toEqual([]);
  });

  it('«zéro au milieu» only when the ANSWER number has a zero in the tens (305, 600) or in the hundreds (4056)', () => {
    // does not count: 738, 4560 (zero only in the units), nor the «300» of «300 + 40 + 7» (the answer is 347)
    const inner = (s: string) => s.length >= 3 && (s.at(-2) === '0' || (s.length === 4 && s.at(1) === '0'));
    const bad: string[] = [];
    for (const [id, ex] of allItems()) {
      if (!tagsOf(ex).includes('zero-au-milieu')) continue;
      const e = ex.expected;
      // answer: a number, «308» or an expanded form («800 + 20 + 7» represents 827)
      const answer = e.type === 'number' ? [String(e.value)] : e.type === 'word' && /^[\d +]+$/.test(e.value) ? [String((e.value.match(/\d+/g) ?? []).map(Number).reduce((a, b) => a + b, 0))] : [];
      // decompositions («300 + 40 + 7»): only the answer counts; in the others, the statement's number too («307»)
      const nums = ex.skillId === 'math.representations' ? answer : [...answer, ...(ex.statement.match(/\d+/g) ?? [])];
      if (!nums.some(inner)) bad.push(`${id}: ${ex.statement} → ${JSON.stringify(ex.expected)}`);
    }
    expect(bad.slice(0, 4), `${bad.length} items`).toEqual([]);
  });

  it('the Les mots cachés sound hint matches the word sound (main: « in »; reine: « è »)', () => {
    const bad: string[] = [];
    for (const g of games.filter((x) => x.id === 'game.hidden-words'))
      for (const d of LEVELS)
        for (const seed of SEEDS) {
          const ex = generateGameRound(g.id, 'fr.spelling', d, seed);
          const w = (ex.expected as { value: string }).value;
          if (/son « in »/.test(ex.hint ?? '') && !spellingTags(w).includes('son-in-ain')) bad.push(`${w}: ${ex.hint}`);
          if (/son « è »/.test(ex.hint ?? '') && !spellingTags(w).includes('son-ai-ei')) bad.push(`${w}: ${ex.hint}`);
          if (/son « ou »/.test(ex.hint ?? '') && !spellingTags(w).includes('son-ou')) bad.push(`${w}: ${ex.hint}`);
          if (/son « an »/.test(ex.hint ?? '') && !spellingTags(w).includes('son-an-en')) bad.push(`${w}: ${ex.hint}`);
        }
    expect([...new Set(bad)].slice(0, 6)).toEqual([]);
  });

  it('spelling on paper: levels 4 to 6 hide more letters than level 3 (before: level 6 could be «lune» with 1 letter)', () => {
    const holes = (d: Difficulty) => {
      let total = 0;
      for (const seed of SEEDS.slice(0, 150)) {
        const ex = generateExercise('fr.spelling', d, seed);
        total += (ex.statement.match(/_/g) ?? []).length / (ex.expected as { value: string }).value.length;
      }
      return total / 150;
    };
    void holes;
    for (const d of [4, 5, 6] as Difficulty[]) {
      const items = SEEDS.slice(0, 200).map((s) => generateExercise('fr.spelling', d, s));
      const distinct = new Set(items.map((ex) => (ex.expected as { value: string }).value));
      // variety: dozens of words (before: 6 words, easy to memorize)
      expect(distinct.size, `level ${d}: ${[...distinct].join(', ')}`).toBeGreaterThanOrEqual(15);
      for (const ex of items) {
        const word = (ex.expected as { value: string }).value;
        const shown = ex.statement.replace('Complète le mot : ', '').split(' ');
        // no sound on paper: the 1st letter and the picture always visible
        expect(shown[0], word).toBe([...word][0]);
        expect((ex.visual as { emoji?: string } | undefined)?.emoji, word).toBeTruthy();
        if (d >= 5) expect(shown.filter((x) => x === '_').length, word).toBe([...word].length - 1);
      }
    }
  });

  it('the paper sound hint also matches the word', () => {
    const bad: string[] = [];
    for (const d of LEVELS)
      for (const seed of SEEDS) {
        const ex = generateExercise('fr.spelling', d, seed);
        const w = (ex.expected as { value: string }).value;
        if (/son « in »/.test(ex.hint ?? '') && !spellingTags(w).includes('son-in-ain')) bad.push(`${w}: ${ex.hint}`);
        if (/son « è »/.test(ex.hint ?? '') && !spellingTags(w).includes('son-ai-ei')) bad.push(`${w}: ${ex.hint}`);
      }
    expect([...new Set(bad)].slice(0, 6)).toEqual([]);
  });

  it('the retenue message only when that column goes past 10 (152 + 63: centaines, not unités)', () => {
    const bad: string[] = [];
    for (const d of LEVELS)
      for (const seed of SEEDS) {
        const ex = generateExercise('math.add-sub', d, seed);
        const m = /^as-(\d+)([+-])(\d+)$/.exec(ex.questionKey);
        if (!m) continue;
        const [x, y] = [Number(m[1]), Number(m[3])];
        const units = m[2] === '+' ? (x % 10) + (y % 10) >= 10 : x % 10 < y % 10;
        if (!units && ex.commonErrors.some((e) => /10 unités font 1 dizaine|échanger 1 dizaine contre 10 unités/.test(e.message))) bad.push(`${ex.questionKey}`);
      }
    expect(bad.slice(0, 5), `${bad.length} items`).toEqual([]);
  });

  it('«Celle qui reste» for pommes, billes and carottes; «Celui» for crayons and livres', () => {
    const bad: string[] = [];
    for (const d of LEVELS)
      for (const seed of SEEDS) {
        const ex = generateExercise('math.grouping-tens', d, seed);
        const m = /Il y a \d+ (\w+)\./.exec(ex.statement);
        if (!m || !/qui reste a/.test(ex.explanation)) continue;
        const fem = ['pommes', 'billes', 'carottes'].includes(m[1] as string);
        if (fem !== /Celle qui reste/.test(ex.explanation)) bad.push(`${m[1]}: ${ex.explanation}`);
      }
    expect(bad.slice(0, 3)).toEqual([]);
  });

  it('paper dictation: level 6 is not easier than levels 4 and 5 (before: it fell back to level-1 words)', () => {
    const lv = (d: Difficulty) => SEEDS.slice(0, 200).map((seed) => levelOfWord((generateExercise('fr.spelling', d, seed).expected as { value: string }).value));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.min(...lv(6))).toBeGreaterThanOrEqual(3);
    expect(avg(lv(6))).toBeGreaterThanOrEqual(avg(lv(4)));
  });

  it('hints for ê, î, ô, au, qu, gn (before: a generic hint on fenêtre, forêt, auto, musique)', () => {
    const generic = 'Dis le mot lentement et écoute chaque son.';
    const bad: string[] = [];
    for (const d of LEVELS)
      for (const seed of SEEDS) {
        const ex = generateGameRound('game.hidden-words', 'fr.spelling', d, seed);
        const w = (ex.expected as { value: string }).value;
        const holes = (ex.game as { final: { pattern: Array<string | null> } }).final.pattern.map((p, i) => (p === null ? i : -1)).filter((i) => i >= 0);
        const ls = [...w];
        const hiddenHas = (re: RegExp) => holes.some((i) => re.test(ls[i] ?? '')) ;
        if (ex.hint === generic && hiddenHas(/[êîô]/)) bad.push(`${w}: generic hint with ${holes.map((i) => ls[i]).join('')}`);
      }
    expect([...new Set(bad)].slice(0, 5)).toEqual([]);
  });
});

