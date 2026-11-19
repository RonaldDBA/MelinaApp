import type { Difficulty, ExerciseInstance, ListenPickSpec, Rng } from '@melina/shared';
import data from '../../../content/english/words.json';

/**
 * English listening (research report «English learning games for kids», 18/11/2026): listening first, small word sets,
 * pictures instead of translation, no reading. One round = hear a word / a short sentence / a riddle, tap the picture.
 *
 * Difficulty by level (skill en.listen-words):
 *   1 — word alone, 3 pictures from DIFFERENT themes (level-1 words)
 *   2 — word alone, 3 pictures of the SAME theme (words up to level 2)
 *   3 — the word inside a short sentence, 4 pictures of the same theme
 *   4 — sentence, 4 pictures including a SOUND-ALIKE (ship/sheep, three/tree, thirteen/thirty) when the word has one
 *   5 — sentence, 6 pictures with sound-alikes
 *   6 — an original 2-sentence riddle that never says the word, 6 pictures
 * Each wrong option is a hypothesis (a sound-alike = a sound confusion; same theme = meaning not yet anchored), and the
 * round's tags say which contrast was tested, so the learner model learns WHAT she confuses.
 */

export interface EnglishWord {
  id: string;
  en: string;
  fr: string;
  pic: string;
  theme: string;
  level: number;
  kind: 'noun' | 'plural' | 'colour' | 'number' | 'person' | 'action' | 'feeling';
  ing?: string;
  say?: string;
  article?: string;
  cognate?: boolean;
  falseFriend?: boolean;
  clue?: string;
}

export const englishWords = data.words as EnglishWord[];
export const englishPairs = data.pairs as Array<{ a: string; b: string; tag: string }>;
const byId = new Map(englishWords.map((w) => [w.id, w]));
export const englishWord = (id: string) => byId.get(id);

/** Number of pictures per level. */
export const LISTEN_OPTIONS: Record<number, number> = { 1: 3, 2: 3, 3: 4, 4: 4, 5: 6, 6: 6 };

export const THEME_FR: Record<string, string> = {
  colours: 'les couleurs',
  numbers: 'les nombres',
  animals: 'les animaux',
  classroom: 'la classe',
  garden: 'le jardin et les fruits',
  people: 'les personnes',
  body: 'le corps',
  food: 'la nourriture',
  clothes: 'les vêtements',
  toys: 'les jouets',
  weather: 'la météo',
  actions: 'les actions',
  house: 'la maison',
  school: 'l’école',
  feelings: 'les émotions',
  transport: 'les transports',
  town: 'la ville',
  seasons: 'le ciel et les fêtes',
  wild: 'les animaux sauvages',
};

/** Sound-alike partners of a word, with the contrast tag. */
export function soundAlikes(id: string): Array<{ id: string; tag: string }> {
  return englishPairs.flatMap((p) => (p.a === id ? [{ id: p.b, tag: p.tag }] : p.b === id ? [{ id: p.a, tag: p.tag }] : []));
}

/** «the cat», «Grandma», «the mittens», «rain»: the noun as it sits in a sentence. */
function named(w: EnglishWord): string {
  if (w.say) return w.say;
  if (w.article === '-') return w.en;
  return `the ${w.en}`;
}

/** Original carrier sentences (level 3 and up). */
function carrier(w: EnglishWord, rng: Rng): string {
  switch (w.kind) {
    case 'colour':
      return rng.pick([`Touch ${w.en}.`, `Find ${w.en}.`, `Where is ${w.en}?`, `Show me ${w.en}.`]);
    case 'number':
      return rng.pick([`Show me ${w.en}.`, `Find number ${w.en}.`, `Touch ${w.en}.`, `Where is ${w.en}?`]);
    case 'action':
      return rng.pick([`Who is ${w.ing}?`, `Find someone ${w.ing}.`, `Touch the picture of someone ${w.ing}.`]);
    case 'feeling':
      return rng.pick([`Who is ${w.en}?`, `Find someone ${w.en}.`, `Touch the ${w.en} face.`]);
    case 'plural':
      return rng.pick([`Where are ${named(w)}?`, `Find ${named(w)}.`, `Touch ${named(w)}.`, `Show me ${named(w)}.`]);
    case 'person':
      return rng.pick([`Where is ${named(w)}?`, `Find ${named(w)}.`, `Touch ${named(w)}.`]);
    default:
      return rng.pick([`Where is ${named(w)}?`, `Find ${named(w)}.`, `Touch ${named(w)}.`, `Show me ${named(w)}.`, `I see ${w.article === '-' ? '' : `${w.article ?? 'a'} `}${w.en}. Where is it?`]);
  }
}

/** The riddle ends with the right question for the kind of word. */
function riddle(w: EnglishWord): string {
  const ask = w.kind === 'person' ? 'Who is it?' : w.kind === 'feeling' ? 'How do you feel?' : w.kind === 'plural' ? 'What are they?' : 'What is it?';
  return `${w.clue} ${ask}`;
}

/** Words that can be the answer at this level (level 6 = words with a riddle). */
export function listenPool(difficulty: number): EnglishWord[] {
  if (difficulty >= 6) return englishWords.filter((w) => w.clue);
  return englishWords.filter((w) => w.level <= difficulty);
}

export interface ListenRound {
  target: EnglishWord;
  spec: ListenPickSpec;
  contrast: string | null; // tag of the sound-alike contrast tested, if any
}

/**
 * `due`: English words due for review today (spaced ladder of days, most overdue first). About 4 rounds in 10 bring one
 * back when there is one at this level; otherwise half of the rounds use the level's new words.
 */
export function buildListenRound(difficulty: Difficulty, rng: Rng, due: string[] = []): ListenRound {
  const pool = listenPool(difficulty);
  // half of the rounds use the words that are new at this level (the level's own content); the rest review older words
  const fresh = difficulty < 6 ? pool.filter((w) => w.level === difficulty) : [];
  const dueHere = due.map((id) => pool.find((w) => w.id === id)).filter((w): w is EnglishWord => Boolean(w)).slice(0, 6);
  const r = rng.next();
  const target = rng.pick(dueHere.length && r < 0.4 ? dueHere : fresh.length && r < (dueHere.length ? 0.7 : 0.5) ? fresh : pool);
  const n = LISTEN_OPTIONS[difficulty] ?? 3;
  const taken = new Set([target.id]);
  const pics = new Set([target.pic]);
  const options: EnglishWord[] = [target];
  const add = (w: EnglishWord | undefined) => {
    if (!w || options.length >= n || taken.has(w.id) || pics.has(w.pic)) return;
    taken.add(w.id);
    pics.add(w.pic);
    options.push(w);
  };
  let contrast: string | null = null;
  // the distractors may come from any word she can meet at this level (or a bit above, for the sound-alikes)
  const known = englishWords.filter((w) => w.level <= Math.max(difficulty, 1));
  if (difficulty >= 4) {
    for (const s of rng.shuffle(soundAlikes(target.id))) {
      const before = options.length;
      add(englishWord(s.id));
      if (options.length > before && !contrast) contrast = s.tag;
      if (difficulty === 4 && contrast) break; // level 4: a single sound-alike among 4 pictures
    }
  }
  if (difficulty === 1) {
    // different themes: she only needs to recognize the word, not to tell close meanings apart
    for (const w of rng.shuffle(known.filter((x) => x.theme !== target.theme))) {
      if (!options.some((o) => o.theme === w.theme)) add(w);
    }
  }
  for (const w of rng.shuffle(known.filter((x) => x.theme === target.theme))) add(w);
  for (const w of rng.shuffle(known)) add(w);
  for (const w of rng.shuffle(englishWords)) add(w);

  const mode: ListenPickSpec['mode'] = difficulty >= 6 && target.clue ? 'riddle' : difficulty >= 3 ? 'phrase' : 'word';
  const say = mode === 'riddle' ? riddle(target) : mode === 'phrase' ? carrier(target, rng) : target.kind === 'action' ? (target.ing as string) : target.say ?? target.en;
  return {
    target,
    contrast,
    spec: { game: 'listen-pick', mode, say, options: rng.shuffle(options).map((o) => o.id), pics: Object.fromEntries(options.map((o) => [o.id, o.pic])) },
  };
}

/** Explanation shown after the answer (French). */
export function listenExplanation(w: EnglishWord, mode: ListenPickSpec['mode']): string {
  const base = `« ${w.en} » veut dire « ${w.fr} ».`;
  if (w.falseFriend) return `${base} Attention : ce mot ressemble au français, mais il ne veut pas dire la même chose.`;
  if (w.cognate) return `${base} Presque comme en français, mais ça se dit autrement!`;
  if (mode === 'riddle') return `${base} La devinette parlait de ce mot sans jamais le dire.`;
  return base;
}

/** Tags of a listening round: theme, the word itself, the contrast tested and the kind of listening. */
export function listenTags(ex: ExerciseInstance): string[] {
  const g = ex.game as ListenPickSpec | undefined;
  const id = ex.expected.type === 'word' ? ex.expected.value : '';
  const w = englishWord(id);
  if (!g || !w) return [];
  const t = [`en-theme-${w.theme}`, `en-mot-${w.id}`];
  const pairs = soundAlikes(w.id).filter((s) => g.options.includes(s.id));
  for (const tag of new Set(pairs.map((p) => p.tag))) t.push(tag);
  if (/th/i.test(w.en) && !t.includes('en-th')) t.push('en-son-th');
  if (g.mode === 'phrase') t.push('en-phrase');
  if (g.mode === 'riddle') t.push('en-devinette');
  if (w.cognate) t.push('en-cognat');
  if (w.falseFriend) t.push('en-faux-ami');
  return t;
}

/** French labels of the English tags (parents' area and report). */
export const ENGLISH_TAG_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(THEME_FR).map(([k, v]) => [`en-theme-${k}`, `anglais : ${v}`])),
  ...Object.fromEntries(englishWords.map((w) => [`en-mot-${w.id}`, `anglais : « ${w.en} » (${w.fr})`])),
  'en-th': 'anglais : le son « th » (three / tree)',
  'en-son-th': 'anglais : les mots avec « th »',
  'en-voyelle': 'anglais : voyelles courtes et longues (ship / sheep)',
  'en-teen-ty': 'anglais : thirteen ou thirty',
  'en-rime': 'anglais : mots qui riment (cat / hat)',
  'en-phrase': 'anglais : le mot dans une phrase',
  'en-devinette': 'anglais : devinettes',
  'en-cognat': 'anglais : mots presque pareils au français',
  'en-faux-ami': 'anglais : faux amis',
};
