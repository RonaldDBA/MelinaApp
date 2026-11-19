import type { CommandsSpec, Difficulty, ExerciseInstance, Rng } from '@melina/shared';
import { englishWords, type EnglishWord } from './english';

/**
 * « La jardinière dit » — English commands (research report «English learning games for kids»: in Québec's Cycle One,
 * children show they understood by ACTING, before they speak). She hears a command in English and does it by tapping:
 * one object, a colour + an object (in English the colour comes BEFORE the noun), two steps in order, «put X in Y».
 *
 *   1 — «Touch the cat.»                       4 objects, 1 tap
 *   2 — «Touch the red book.»                  2 objects × 2 colours, 1 tap (colour AND noun)
 *   3 — «Touch the duck, then the frog.»       5 objects, 2 taps in order
 *   4 — «Put the green apple in the basket.»   2 × 2 coloured objects + basket and box, 2 taps
 *   5 — «Touch the blue heart, then the yellow square.»  2 objects × 3 colours, 2 taps
 *   6 — «Put the red book in the box, then touch the green heart.»  6 coloured objects + containers, 3 taps
 * The answer is the list of what she tapped, in order («red-book,basket»). Each wrong answer that can be predicted
 * (right object but wrong colour, the right colour on the wrong object, the right steps in the wrong order, the wrong
 * container) has its own message and tells the model what she missed.
 */

interface Thing {
  id: string;
  en: string; // as said in English: «red book», «basket»
  fr: string; // in French, with the article: «le livre rouge», «le panier»
  pic: string;
  noun: string;
  colour?: string;
}

/** Coloured objects (system emoji that really exist in each colour). French adjectives agree with the noun. */
const COLOURED: Record<string, { fr: string; feminine?: boolean; pics: Record<string, string> }> = {
  heart: { fr: 'cœur', pics: { red: '❤️', blue: '💙', yellow: '💛', green: '💚', purple: '💜', orange: '🧡' } },
  book: { fr: 'livre', pics: { red: '📕', green: '📗', blue: '📘', orange: '📙' } },
  circle: { fr: 'cercle', pics: { red: '🔴', blue: '🔵', yellow: '🟡', green: '🟢', orange: '🟠', purple: '🟣' } },
  square: { fr: 'carré', pics: { red: '🟥', blue: '🟦', yellow: '🟨', green: '🟩', orange: '🟧', purple: '🟪' } },
  apple: { fr: 'pomme', feminine: true, pics: { red: '🍎', green: '🍏' } },
};
const COLOUR_FR: Record<string, [string, string]> = {
  red: ['rouge', 'rouge'],
  blue: ['bleu', 'bleue'],
  yellow: ['jaune', 'jaune'],
  green: ['vert', 'verte'],
  purple: ['violet', 'violette'],
  orange: ['orange', 'orange'],
};
const CONTAINERS: Thing[] = [
  { id: 'basket', en: 'basket', fr: 'le panier', pic: '🧺', noun: 'basket' },
  { id: 'box', en: 'box', fr: 'la boîte', pic: '📦', noun: 'box' },
];

function coloured(noun: string, colour: string): Thing {
  const n = COLOURED[noun]!;
  const adj = (COLOUR_FR[colour] ?? [colour, colour])[n.feminine ? 1 : 0];
  return { id: `${colour}-${noun}`, en: `${colour} ${noun}`, fr: `${n.feminine ? 'la' : 'le'} ${n.fr} ${adj}`, pic: n.pics[colour] as string, noun, colour };
}

/** Plain objects for levels 1 and 3: picturable nouns she meets in the first two levels of «Le potager qui écoute». */
const PLAIN = englishWords.filter((w) => w.kind === 'noun' && w.level <= 2 && ['animals', 'garden', 'food', 'classroom', 'body'].includes(w.theme));
const plain = (w: EnglishWord): Thing => ({ id: w.id, en: w.en, fr: w.fr, pic: w.pic, noun: w.id });

/** n nouns × k colours that all exist as emoji. */
function colourGrid(rng: Rng, nouns: number, colours: number): Thing[] {
  for (let tries = 0; tries < 50; tries++) {
    const ns = rng.shuffle(Object.keys(COLOURED)).slice(0, nouns);
    const common = Object.keys(COLOUR_FR).filter((c) => ns.every((n) => COLOURED[n]!.pics[c]));
    if (common.length < colours) continue;
    const cs = rng.shuffle(common).slice(0, colours);
    return ns.flatMap((n) => cs.map((c) => coloured(n, c)));
  }
  throw new Error('no colour grid');
}

export interface CommandRound {
  spec: CommandsSpec;
  answer: string[]; // ids tapped in order
  explanation: string;
  errors: ExerciseInstance['commonErrors'];
  kind: 'touch' | 'colour' | 'then' | 'put' | 'colour-then' | 'put-then';
}

const touch = (rng: Rng) => rng.pick(['Touch', 'Point to', 'Show me']);

export function buildCommandRound(difficulty: Difficulty, rng: Rng): CommandRound {
  const errors: ExerciseInstance['commonErrors'] = [];
  const COLOUR_MSG = 'Regarde bien la couleur : en anglais, elle vient avant le nom.';
  const NOUN_MSG = 'La couleur est bonne. Écoute bien le nom de l’objet.';
  const ORDER_MSG = 'Les bons objets, mais pas dans le bon ordre. Écoute : d’abord… ensuite (then)…';
  const PLACE_MSG = 'Le bon objet! Écoute bien où le mettre : basket (panier) ou box (boîte)?';
  /** For one coloured target, the predictable mistakes among the items (same noun / same colour). */
  const confusions = (target: Thing, items: Thing[], prefix: string[], suffix: string[]) => {
    for (const o of items) {
      if (o.id === target.id || !o.colour) continue;
      if (o.noun === target.noun) errors.push({ match: [...prefix, o.id, ...suffix].join(','), type: 'en-couleur', message: COLOUR_MSG });
      else if (o.colour === target.colour) errors.push({ match: [...prefix, o.id, ...suffix].join(','), type: 'en-nom', message: NOUN_MSG });
    }
  };
  const spec = (say: string, items: Thing[], steps: number, containers: Thing[] = []): CommandsSpec => ({
    game: 'commands',
    say,
    steps,
    items: rng.shuffle(items).map((t) => t.id),
    containers: containers.map((t) => t.id),
    pics: Object.fromEntries([...items, ...containers].map((t) => [t.id, t.pic])),
  });

  switch (difficulty) {
    case 1: {
      const items = rng.shuffle(PLAIN).slice(0, 4).map(plain);
      const t = items[0]!;
      const verb = touch(rng);
      return {
        kind: 'touch',
        spec: spec(`${verb} the ${t.en}.`, items, 1),
        answer: [t.id],
        explanation: `« ${verb} the ${t.en} » : ${verb === 'Show me' ? 'montre-moi' : verb === 'Point to' ? 'montre du doigt' : 'touche'} « ${t.fr} ».`,
        errors,
      };
    }
    case 2: {
      const items = colourGrid(rng, 2, 2);
      const t = rng.pick(items);
      confusions(t, items, [], []);
      return { kind: 'colour', spec: spec(`${touch(rng)} the ${t.en}.`, items, 1), answer: [t.id], explanation: `« ${t.en} » = ${t.fr}. En anglais, la couleur vient avant le nom.`, errors };
    }
    case 3: {
      const items = rng.shuffle(PLAIN).slice(0, 5).map(plain);
      const [a, b] = [items[0]!, items[1]!];
      const say = rng.pick([`Touch the ${a.en}, then touch the ${b.en}.`, `First touch the ${a.en}. Then touch the ${b.en}.`, `Touch the ${a.en}, then the ${b.en}.`]);
      errors.push({ match: `${b.id},${a.id}`, type: 'en-ordre', message: ORDER_MSG });
      return { kind: 'then', spec: spec(say, items, 2), answer: [a.id, b.id], explanation: `« then » veut dire « ensuite » : d’abord ${a.en}, ensuite ${b.en}.`, errors };
    }
    case 4: {
      const items = colourGrid(rng, 2, 2);
      const t = rng.pick(items);
      const place = rng.pick(CONTAINERS);
      const other = CONTAINERS.find((c) => c.id !== place.id)!;
      confusions(t, items, [], [place.id]);
      errors.push({ match: `${t.id},${other.id}`, type: 'en-contenant', message: PLACE_MSG });
      return {
        kind: 'put',
        spec: spec(`Put the ${t.en} in the ${place.en}.`, items, 2, CONTAINERS),
        answer: [t.id, place.id],
        explanation: `« Put the ${t.en} in the ${place.en} » : mets ${t.fr} dans ${place.fr}.`,
        errors,
      };
    }
    case 5: {
      const items = colourGrid(rng, 2, 3);
      const [a, b] = rng.shuffle(items) as [Thing, Thing];
      confusions(a, items, [], [b.id]);
      confusions(b, items, [a.id], []);
      errors.push({ match: `${b.id},${a.id}`, type: 'en-ordre', message: ORDER_MSG });
      const say = rng.pick([`Touch the ${a.en}, then the ${b.en}.`, `First touch the ${a.en}. Then touch the ${b.en}.`]);
      return { kind: 'colour-then', spec: spec(say, items, 2), answer: [a.id, b.id], explanation: `D’abord ${a.fr}, ensuite (then) ${b.fr}.`, errors };
    }
    default: {
      const items = colourGrid(rng, 2, 3);
      const [a, b] = rng.shuffle(items) as [Thing, Thing];
      const place = rng.pick(CONTAINERS);
      const other = CONTAINERS.find((c) => c.id !== place.id)!;
      confusions(a, items, [], [place.id, b.id]);
      confusions(b, items, [a.id, place.id], []);
      errors.push({ match: `${a.id},${other.id},${b.id}`, type: 'en-contenant', message: PLACE_MSG });
      return {
        kind: 'put-then',
        spec: spec(`Put the ${a.en} in the ${place.en}, then touch the ${b.en}.`, items, 3, CONTAINERS),
        answer: [a.id, place.id, b.id],
        explanation: `Mets ${a.fr} dans ${place.fr}, ensuite (then) touche ${b.fr}.`,
        errors,
      };
    }
  }
}

/** Tags of a command round: what the command asked for. */
export function commandTags(ex: ExerciseInstance): string[] {
  const g = ex.game as CommandsSpec | undefined;
  if (!g || g.game !== 'commands') return [];
  const t = ['en-consigne'];
  const answer = ex.expected.type === 'word' ? ex.expected.value.split(',') : [];
  if (answer.some((id) => id.includes('-'))) t.push('en-couleur-nom');
  if (g.containers.length) t.push('en-mettre-dans');
  if (g.steps >= 2 && answer.filter((id) => g.items.includes(id)).length >= 2) t.push('en-deux-etapes');
  if (g.steps >= 3) t.push('en-trois-etapes');
  for (const id of answer) if (englishWords.some((w) => w.id === id)) t.push(`en-mot-${id}`);
  return t;
}

export const COMMAND_TAG_LABELS: Record<string, string> = {
  'en-consigne': 'anglais : suivre une consigne',
  'en-couleur-nom': 'anglais : la couleur avant le nom (red book)',
  'en-mettre-dans': 'anglais : « put … in the … »',
  'en-deux-etapes': 'anglais : deux consignes dans l’ordre (then)',
  'en-trois-etapes': 'anglais : trois étapes',
};
