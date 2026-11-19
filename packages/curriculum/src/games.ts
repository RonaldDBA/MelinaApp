import { createRng, type Difficulty, type ExerciseInstance, type ResponseType, type Rng, type Subject } from '@melina/shared';
import texts from '../../../content/french/texts.json';
import words from '../../../content/french/words.json';
import { bigSequence, buildCountingPath, countingErrors, countingExplanation, countingHint, holeValues } from './counting';
import { buildDominoRound, decoFace, dominoErrors, faceLabel } from './dominoes';
import { evaluate } from './evaluate';
import { blanksFor, buildGrid, letterBank, letters, LEVELS, pickWords, soundHint } from './hiddenwords';
import { schoolPool } from './schoolwords';
import { pickPreferred } from './pick';
import { pluralDistractors, pluralRule, splitArticle } from './plural';

/**
 * On-screen mini-games. Each round is a versioned exercise like the paper ones:
 * the server keeps the snapshot (with the answer) and grades the child's answer.
 */
export interface GameDefinition {
  id: string; // also the exercise_id of the rounds
  version: number;
  title: string; // fr-CA (the whole app is in French)
  description: string; // fr-CA, parent panel
  skills: string[];
  subject: Subject;
  responseType: ResponseType;
  roundsPerSession: number;
  generate(skillId: string, difficulty: Difficulty, rng: Rng, seed: number, opts: GameOptions): ExerciseInstance;
}

/** Parent choices that change a game's content. */
export interface GameOptions {
  /** Les mots cachés: the school-list week the class is at («3.2»); without it, the whole list. */
  schoolWeek?: string | null;
  /** Keys of this game's latest rounds: Les mots cachés avoids repeating the same words. */
  recentKeys?: string[];
  /**
   * The engine's preference (weak points to reinforce, strong points to explore): a score for an exercise's
   * tags. With it, several candidate rounds are drawn and the one with the highest score is kept.
   */
  prefer?: (tags: string[]) => number;
}



const fruits = [
  { fruit: 'red_apple', label: 'pommes' },
  { fruit: 'green_apple', label: 'pommes' },
  { fruit: 'pear', label: 'poires' },
] as const;

const nonMultiple = (rng: Rng, min: number, max: number) => {
  let n = rng.int(min, max);
  if (n % 10 === 0) n += rng.int(1, 9);
  return Math.min(n, max % 10 === 0 ? max - 1 : max);
};

export const appleCrates: GameDefinition = {
  id: 'game.apple-crates',
  version: 1,
  title: 'Les caisses de pommes',
  description: 'Ranger des fruits dans des caisses de 10 et dire le total ou le nombre de caisses (dénombrement organisé, dizaines et unités).',
  skills: ['math.place-value', 'math.grouping-tens'],
  subject: 'mathematics',
  responseType: 'number',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed) {
    const f = rng.pick(fruits);
    const question = skillId === 'math.grouping-tens' ? 'crates' : 'total';
    let loose: number;
    let packed = 0;
    if (question === 'total') {
      if (difficulty === 1) loose = nonMultiple(rng, 11, 29);
      else if (difficulty === 2) {
        packed = rng.int(1, 3);
        loose = nonMultiple(rng, 11, 25);
      } else if (difficulty === 3) {
        packed = rng.int(4, 7);
        loose = nonMultiple(rng, 12, 27);
      } else {
        // 4 and 5: more crates already closed and more loose fruit (up to 10 crates, what fits on screen)
        packed = rng.int(difficulty === 4 ? 4 : 5, 7);
        loose = nonMultiple(rng, difficulty === 4 ? 18 : 21, (10 - packed) * 10 - 1);
      }
    } else if (difficulty === 1) loose = rng.pick([20, 30]);
    else if (difficulty === 2) loose = nonMultiple(rng, 12, 29);
    else if (difficulty === 3) {
      packed = rng.int(2, 6);
      loose = nonMultiple(rng, 11, 25);
    } else {
      packed = rng.int(4, 7);
      loose = nonMultiple(rng, 13, 29);
    }
    const total = packed * 10 + loose;
    const full = Math.floor(total / 10);
    const rest = total % 10;
    const crates = full + (rest > 0 ? 1 : 0);
    const pl = (n: number, w: string) => `${n} ${w}${n > 1 ? 's' : ''}`;
    const common = {
      exerciseId: this.id,
      exerciseVersion: this.version,
      skillId,
      subject: 'mathematics' as const,
      difficulty,
      responseType: 'number' as const,
      seed,
      questionKey: `ac-${question}-${packed}-${loose}`,
      instruction: `Range les ${f.label} dans les caisses. Une caisse contient 10 ${f.label}.`,
      answerFormat: 'un nombre',
      readingHint: 'un nombre',
      game: { game: 'apple-crates' as const, loose, packed, perCrate: 10, question, fruit: f.fruit, fruitLabel: f.label } as const,
      origin: 'Original — même objectif que la situation « La récolte de citrouilles » (groupes de 10).',
      retryMessage: 'Pas tout à fait. Regarde bien les caisses.',
    };
    if (question === 'total') {
      const errs: ExerciseInstance['commonErrors'] = [
        { match: String(rest * 10 + full), type: 'inversion-dizaines-unites', message: 'Les caisses pleines, ce sont les dizaines : elles s’écrivent à gauche.' },
        { match: String(full), type: 'dizaines-seulement', message: `Tu as compté les caisses. Mais chaque caisse contient 10 ${f.label}!` },
      ];
      if (packed > 0) errs.push({ match: String(loose), type: 'caisses-fermees-oubliees', message: 'N’oublie pas les caisses qui étaient déjà fermées.' });
      return {
        ...common,
        statement: `Combien de ${f.label} y a-t-il en tout?`,
        hint: 'Compte les caisses pleines par bonds de 10 : 10, 20, 30… Puis ajoute les fruits de la dernière caisse.',
        expected: { type: 'number', value: total },
        explanation: rest > 0 ? `${pl(full, 'caisse')} de 10, ça fait ${full * 10}. Et ${rest} de plus : ${total}.` : `${pl(full, 'caisse')} de 10, ça fait ${total}.`,
        commonErrors: errs.filter((e) => e.match !== String(total)),
      };
    }
    if (difficulty >= 5 && rest > 0) {
      const missing = 10 - rest;
      return {
        ...common,
        questionKey: `ac-missing-${packed}-${loose}`,
        statement: `Combien de ${f.label} manque-t-il pour que toutes les caisses soient pleines?`,
        hint: 'Regarde la dernière caisse : combien de places vides reste-t-il? Une caisse pleine a 10 fruits.',
        expected: { type: 'number', value: missing },
        explanation: `La dernière caisse a ${rest} ${rest === 1 ? f.label.replace(/s$/, '') : f.label}. Il en manque ${missing} pour arriver à 10.`,
        commonErrors: [
          { match: String(rest), type: 'complement-inverse', message: 'On cherche les places vides, pas les fruits déjà rangés.' },
          { match: String(crates), type: 'nombre-de-caisses', message: 'On cherche le nombre de fruits qui manquent.' },
        ].filter((e) => e.match !== String(missing)),
      };
    }
    const errs: ExerciseInstance['commonErrors'] = [{ match: String(total), type: 'quantite-au-lieu-des-groupes', message: 'On cherche le nombre de caisses, pas le nombre de fruits.' }];
    if (rest > 0) errs.unshift({ match: String(full), type: 'groupe-incomplet-oublie', message: 'La caisse qui n’est pas pleine compte aussi : ses fruits doivent voyager!' });
    return {
      ...common,
      statement: `Combien de caisses faut-il pour transporter toutes les ${f.label}?`,
      hint: 'Compte toutes les caisses où il y a des fruits, même celle qui n’est pas pleine.',
      expected: { type: 'number', value: crates },
      explanation: rest > 0 ? `${pl(full, 'caisse')} ${full > 1 ? 'pleines' : 'pleine'} et 1 caisse pour les ${rest} qui restent : ${pl(crates, 'caisse')}.` : `${total}, c’est ${pl(full, 'dizaine')} : il faut ${pl(crates, 'caisse')}.`,
      commonErrors: errs,
    };
  },
};

const gameBase = (g: GameDefinition, skillId: string, difficulty: Difficulty, seed: number) => ({
  exerciseId: g.id,
  exerciseVersion: g.version,
  skillId,
  subject: g.subject,
  difficulty,
  responseType: g.responseType,
  seed,
});

// ---------------------------------------------------------------- Le train des nombres

export const numberTrain: GameDefinition = {
  id: 'game.number-train',
  version: 1,
  title: 'Le train des nombres',
  description: 'Découvrir la règle d’une suite de nombres et compléter le wagon manquant (compter par bonds de 1, 2, 5 ou 10, en ordre croissant et décroissant).',
  skills: ['math.sequences'],
  subject: 'mathematics',
  responseType: 'number',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed) {
    let step: number;
    let start: number;
    if (difficulty === 1) {
      step = rng.pick([1, 2]);
      start = rng.int(1, 40);
    } else if (difficulty === 2) {
      step = rng.pick([5, 10, 2]);
      start = step === 5 ? rng.int(1, 10) * 5 : rng.int(3, 40);
    } else if (difficulty === 3) {
      step = rng.pick([-2, -10, 3, -5, -1]);
      start = step < 0 ? rng.int(55, 95) : rng.int(1, 30);
      if (step === -5) start = rng.int(11, 19) * 5;
    } else {
      ;({ step, start } = bigSequence(rng, difficulty));
    }
    const all = Array.from({ length: 6 }, (_, i) => start + i * step);
    const hole = difficulty === 1 ? rng.pick([4, 5]) : difficulty === 2 ? rng.int(2, 5) : rng.int(1, 4);
    const value = all[hole] as number;
    const prev = all[hole - 1] as number;
    const rule = step > 0 ? `on ajoute ${step}` : `on enlève ${-step}`;
    const errs: ExerciseInstance['commonErrors'] = [];
    if (Math.abs(step) !== 1) errs.push({ match: String(prev + (step > 0 ? 1 : -1)), type: 'compte-de-un', message: 'Ce train ne compte pas de 1 en 1. Regarde l’écart entre deux wagons voisins.' });
    if (step < 0) errs.push({ match: String(prev - step), type: 'sens-inverse', message: 'Attention : dans ce train, les nombres diminuent.' });
    return {
      ...gameBase(this, skillId, difficulty, seed),
      questionKey: `nt-${start}-${step}-${hole}`,
      instruction: 'Trouve la règle du train.',
      statement: 'Quel nombre manque sur le wagon?',
      hint: 'Regarde deux wagons voisins : l’écart est toujours le même.',
      answerFormat: 'un nombre',
      readingHint: 'un nombre',
      game: { game: 'number-train', terms: all.map((t, i) => (i === hole ? null : t)) },
      expected: { type: 'number', value },
      explanation: `D’un wagon au suivant, ${rule}. Le nombre qui manque est ${value}.`,
      commonErrors: errs.filter((e) => e.match !== String(value)),
      origin: 'Original.',
      retryMessage: 'Pas tout à fait. Compare les wagons voisins.',
    };
  },
};

// ---------------------------------------------------------------- Saute-grenouille

export const frogJump: GameDefinition = {
  id: 'game.frog-jump',
  version: 1,
  title: 'Saute-grenouille',
  description: 'Additionner et soustraire mentalement : la grenouille part d’un nombre, fait un saut et l’enfant choisit où elle arrive.',
  skills: ['math.add-sub'],
  subject: 'mathematics',
  responseType: 'number',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed) {
    const op = rng.pick(difficulty === 1 ? (['+', '+', '-'] as const) : (['+', '-'] as const));
    let start: number;
    let jump: number;
    if (difficulty === 1) {
      jump = rng.int(2, 6);
      start = op === '+' ? rng.int(3, 14) : rng.int(jump + 2, 18);
    } else if (difficulty === 2) {
      jump = rng.pick([10, 10, 20, rng.int(6, 9)]);
      start = op === '+' ? rng.int(12, 60) : rng.int(jump + 6, 79);
    } else if (difficulty === 3) {
      jump = rng.int(11, 28);
      start = op === '+' ? rng.int(18, 70) : rng.int(jump + 9, 98);
    } else if (difficulty === 4) {
      // 3-digit numbers, a 2-digit jump that bridges through ten
      jump = rng.int(12, 49);
      start = op === '+' ? rng.int(101, 450) : rng.int(jump + 101, 499);
    } else if (difficulty === 5) {
      // hundreds and tens: 240 + 130
      jump = rng.int(1, 3) * 100 + rng.int(1, 9) * 10;
      start = op === '+' ? rng.int(10, 60) * 10 + rng.int(0, 9) : rng.int(Math.ceil((jump + 100) / 10), 99) * 10 + rng.int(0, 9);
    } else {
      // «Défi»: thousands and hundreds (3 450 + 1 200)
      jump = rng.int(1, 2) * 1000 + rng.int(1, 9) * 100;
      start = op === '+' ? rng.int(10, 60) * 100 + rng.int(0, 99) : rng.int(Math.ceil((jump + 500) / 100), 95) * 100 + rng.int(0, 99);
    }
    const target = op === '+' ? start + jump : start - jump;
    const wrong = [op === '+' ? start - jump : start + jump, target + 1, target - 1, target + 10, target - 10, target + 2, ...(difficulty >= 5 ? [target + 100, target - 100] : []), ...(difficulty >= 6 ? [target + 1000, target - 1000] : [])].filter((n) => n >= 0 && n <= (difficulty >= 6 ? 9999 : 999) && n !== target && n !== start);
    const options = rng.shuffle([target, ...rng.shuffle([...new Set(wrong)]).slice(0, 3)]).map(String);
    const tens = Math.floor(jump / 10);
    const ones = jump % 10;
    const hundreds = Math.floor(jump / 100);
    const thousands = Math.floor(jump / 1000);
    // «1 bond», «2 bonds»; and never «puis 0 bonds de 100»
    const bonds = (n: number, size: number) => `${n} ${n > 1 ? 'bonds' : 'bond'} de ${size}`;
    const then = (n: number, size: number) => (n > 0 ? `, puis ${bonds(n, size)}` : '');
    const how = thousands > 0 ? `Fais d’abord ${bonds(thousands, 1000)}${then(Math.floor((jump % 1000) / 100), 100)}.` : hundreds > 0 ? `Fais d’abord ${bonds(hundreds, 100)}${then(Math.floor((jump % 100) / 10), 10)}.` : jump >= 10 && ones > 0 ? `Fais d’abord ${tens > 1 ? `${tens} bonds` : '1 bond'} de 10, puis ${ones > 1 ? `${ones} petits bonds` : '1 petit bond'} de 1.` : jump >= 10 ? `Compte par bonds de 10 à partir de ${start}.` : `Compte ${jump} petits bonds à partir de ${start}.`;
    return {
      ...gameBase(this, skillId, difficulty, seed),
      questionKey: `fj-${start}${op}${jump}`,
      instruction: 'Aide la grenouille à sauter.',
      statement: `La grenouille est sur ${start}. Elle ${op === '+' ? 'avance' : 'recule'} de ${jump}. Où arrive-t-elle?`,
      hint: how,
      answerFormat: 'un nombre',
      readingHint: 'un nombre',
      game: { game: 'frog-jump', start, jump, op, options },
      expected: { type: 'number', value: target },
      explanation: `${start} ${op === '+' ? '+' : '−'} ${jump} = ${target}.`,
      commonErrors: [
        { match: String(op === '+' ? start - jump : start + jump), type: 'operation-inverse', message: op === '+' ? 'La grenouille avance : le nombre devient plus grand.' : 'La grenouille recule : le nombre devient plus petit.' },
        { match: String(target + 10), type: 'dizaine-en-trop', message: 'Tu es tout près. Vérifie les bonds de 10.' },
        { match: String(target - 10), type: 'dizaine-oubliee', message: 'Tu es tout près. Vérifie les bonds de 10.' },
        { match: String(target + 100), type: 'centaine-en-trop', message: 'Tu es tout près. Vérifie les bonds de 100.' },
        { match: String(target - 100), type: 'centaine-oubliee', message: 'Tu es tout près. Vérifie les bonds de 100.' },
        { match: String(target + 1000), type: 'millier-en-trop', message: 'Tu es tout près. Vérifie les bonds de 1000.' },
        { match: String(target - 1000), type: 'millier-oublie', message: 'Tu es tout près. Vérifie les bonds de 1000.' },
      ].filter((e) => options.includes(e.match)),
      origin: 'Original.',
      retryMessage: 'Pas tout à fait. Compte les bonds encore une fois.',
    };
  },
};

// ---------------------------------------------------------------- La pêche aux mots

export const wordFishing: GameDefinition = {
  id: 'game.word-fishing',
  version: 1,
  title: 'La pêche aux mots',
  description: 'Choisir l’orthographe correcte du pluriel : -s, -x des noms en -au/-eau/-eu, noms qui ne changent pas, les noms en -ou et leurs exceptions, puis tout le groupe du nom (déterminant, nom et adjectif).',
  skills: ['fr.plural'],
  subject: 'french',
  responseType: 'word',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed) {
    const pool = words.plural.filter((w) => w.level === difficulty);
    const w = rng.pick(pool.length ? pool : words.plural);
    const [, sing] = splitArticle(w.singular);
    const [article, plural] = splitArticle(w.plural);
    const options = rng.shuffle([plural, ...rng.shuffle(pluralDistractors(sing, plural, w.rule)).slice(0, 2)]);
    const errs: ExerciseInstance['commonErrors'] = [];
    if (w.rule !== 'same') errs.push({ match: sing, type: 'marque-pluriel-oubliee', message: w.rule === 'gn' ? 'Tout le groupe se met au pluriel : le nom et l’adjectif aussi.' : 'Au pluriel, le nom change. Regarde bien la fin du mot.' });
    if (w.rule === 'x' || w.rule === 'xou') errs.push({ match: `${sing}s`, type: `pluriel-${w.rule}`, message: pluralRule[w.rule] ?? '' });
    if (w.rule === 'sou' || w.rule === 'eus') errs.push({ match: `${sing}x`, type: `pluriel-${w.rule}`, message: pluralRule[w.rule] ?? '' });
    if (w.rule === 'aux') errs.push({ match: `${sing}s`, type: 'pluriel-aux', message: pluralRule.aux ?? '' });
    if (w.rule === 'als') errs.push({ match: sing.replace(/(al|ail)$/, 'aux'), type: 'pluriel-als', message: pluralRule.als ?? '' });
    return {
      ...gameBase(this, skillId, difficulty, seed),
      questionKey: `wf-${sing.replace(/ /g, '_')}`,
      instruction: w.rule === 'gn' ? 'Pêche le groupe de mots bien écrit au pluriel.' : 'Pêche le mot bien écrit au pluriel.',
      statement: `${w.singular} → ${article} …`,
      hint: pluralRule[w.rule],
      answerFormat: w.rule === 'gn' ? 'un groupe de mots' : 'un mot',
      readingHint: 'un mot',
      game: { game: 'word-fishing', prompt: `${w.singular} → ${article} …`, options },
      expected: { type: 'word', value: plural, accentsMatter: true, alternatives: [w.plural, `des ${plural}`, `les ${plural}`] },
      explanation: `${w.singular} → ${w.plural}. ${pluralRule[w.rule] ?? ''}`,
      commonErrors: errs.filter((e) => options.includes(e.match)),
      origin: 'Original — règles du pluriel alignées sur l’aide-mémoire de l’école (2e année).',
      retryMessage: 'Pas tout à fait. Regarde bien la fin des mots.',
    };
  },
};

// ---------------------------------------------------------------- L’histoire mystère

export const mysteryStory: GameDefinition = {
  id: 'game.mystery-story',
  version: 1,
  title: 'L’histoire mystère',
  description: 'Lire un court texte original et choisir la réponse à une question portant sur une information écrite dans le texte.',
  skills: ['fr.comprehension'],
  subject: 'french',
  responseType: 'short-text',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed) {
    const pool = texts.texts.filter((t) => t.level === difficulty);
    const text = rng.pick(pool.length ? pool : texts.texts);
    const q = rng.pick(text.questions);
    const partial: ExerciseInstance = {
      ...gameBase(this, skillId, difficulty, seed),
      questionKey: `ms-${text.id}-${q.id}`,
      instruction: 'Lis l’histoire, puis choisis la bonne réponse.',
      statement: q.q,
      visual: { kind: 'text', title: text.title, paragraphs: text.paragraphs },
      hint: 'La réponse est écrite dans l’histoire. Relis-la doucement.',
      answerFormat: 'une réponse',
      readingHint: 'une réponse courte',
      expected: { type: 'short-text', variants: q.variants, display: q.display },
      explanation: `La réponse est écrite dans l’histoire : ${q.display}`,
      commonErrors: [],
      origin: 'Texte original écrit pour l’application.',
      retryMessage: 'Pas tout à fait. Relis l’histoire.',
    };
    // Distractors: answers to other questions (from the same text first), never one that is also correct.
    const others = [...rng.shuffle(text.questions.filter((x) => x.id !== q.id)), ...rng.shuffle(texts.texts.filter((t) => t.id !== text.id).flatMap((t) => t.questions))]
      .map((x) => x.display)
      .filter((d, i, arr) => d !== q.display && arr.indexOf(d) === i && evaluate(partial, d).result !== 'correct');
    const options = rng.shuffle([q.display, ...others.slice(0, 2)]);
    return { ...partial, game: { game: 'mystery-story', prompt: q.q, options } };
  },
};

// ---------------------------------------------------------------- Le chemin des nombres

export const numberPath: GameDefinition = {
  id: 'game.number-path',
  version: 1,
  title: 'Le chemin des nombres',
  description:
    'Compléter les pierres vides d’un chemin de nombres : compter de 1 en 1 jusqu’à 20 (niveau 1), à partir de n’importe quel nombre jusqu’à 100, en ordre croissant et décroissant, toujours avec un changement de dizaine (niveau 2), puis dans un morceau caché de la grille de 100, où descendre d’une ligne fait +10 (niveau 3).',
  skills: ['math.counting'],
  subject: 'mathematics',
  responseType: 'sequence',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed) {
    const p = buildCountingPath(rng, difficulty);
    const missing = holeValues(p);
    const grid = p.layout === 'grid';
    return {
      ...gameBase(this, skillId, difficulty, seed),
      questionKey: `np-${p.layout}-${p.cells.map((c) => c.value).join('.')}-${p.holes.join('.')}`,
      instruction: grid ? 'Trouve les nombres cachés dans la grille de 100.' : 'Complète les nombres qui manquent sur le chemin.',
      statement: grid ? 'Quels nombres manquent sur ce morceau de la grille de 100?' : 'Quels nombres manquent sur le chemin?',
      hint: countingHint(p),
      answerFormat: `${missing.length} nombres`,
      readingHint: 'des nombres',
      game: {
        game: 'number-path',
        layout: p.layout,
        cells: p.cells.map((c, i) => ({ value: p.holes.includes(i) ? null : c.value, ...(grid ? { row: c.row, col: c.col } : {}) })),
        ...(p.grid ? { grid: p.grid } : {}),
      },
      expected: { type: 'sequence', values: missing },
      explanation: countingExplanation(p),
      commonErrors: countingErrors(p),
      origin: 'Original — vise la précision dans la suite des nombres (difficulté observée en comptant de grandes collections).',
      retryMessage: 'Pas tout à fait. Recompte à partir du caillou d’avant. Les cailloux justes deviennent verts.',
    };
  },
};

// ---------------------------------------------------------------- Les mots cachés



export const hiddenWords: GameDefinition = {
  id: 'game.hidden-words',
  version: 1,
  title: 'Les mots cachés',
  description:
    'Mots cachés en français avec accents (seulement à l’horizontale et à la verticale aux niveaux 1 et 2; aussi en diagonale au niveau 3). Trouver les mots n’est pas évalué; à la fin, un des mots trouvés revient avec des lettres manquantes et seule cette orthographe est évaluée.',
  skills: ['fr.spelling'],
  subject: 'french',
  responseType: 'word',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed, opts) {
    const { size, dirs } = LEVELS[difficulty];
    // level 6 «Défi»: the whole year's list, even the weeks the class has not reached yet
    const { pool, focus } = schoolPool(difficulty >= 6 ? null : opts.schoolWeek);
    // key «hw-word.word…-target»: the words of the latest rounds go to the back of the line
    const avoid = new Set((opts.recentKeys ?? []).flatMap((k) => (k.startsWith('hw-') ? k.slice(3).split(/[.-]/) : [])));
    const { chosen, target } = pickWords(rng, pool, difficulty, focus, avoid);
    const { grid } = buildGrid(rng, chosen.map((w) => w.word), size, dirs);
    const ls = letters(target.word);
    const blanks = blanksFor(target, difficulty);
    const hidden = blanks.map((i) => ls[i] as string);
    const gh = soundHint(target.word, blanks);
    const pattern = ls.map((ch, i) => (blanks.includes(i) ? null : ch));
    return {
      ...gameBase(this, skillId, difficulty, seed),
      questionKey: `hw-${chosen.map((w) => w.word).sort().join('.')}-${target.word}`,
      instruction: 'Trouve les mots cachés dans la grille.',
      statement: 'Complète le mot que tu as trouvé.',
      hint: gh ?? 'Dis le mot lentement et écoute chaque son.',
      answerFormat: 'un mot',
      readingHint: 'un mot',
      game: {
        game: 'hidden-words',
        grid,
        directions: dirs,
        words: chosen.map((w) => ({ word: w.word, ...(w.emoji ? { emoji: w.emoji } : {}) })),
        final: { index: chosen.indexOf(target), pattern, letters: letterBank(rng, hidden) },
      },
      expected: { type: 'word', value: target.word, accentsMatter: true },
      explanation: `Le mot s’écrit : ${target.word}.`,
      commonErrors: [],
      origin: 'Liste « Les mots à savoir écrire » de l’école (aide-mémoire 2e année).',
      retryMessage: 'Pas tout à fait. Dis le mot lentement et regarde chaque lettre.',
    };
  },
};

// ---------------------------------------------------------------- Les dominos des nombres

export const dominoes: GameDefinition = {
  id: 'game.dominoes',
  version: 1,
  title: 'Les dominos des nombres',
  description:
    'Placer le domino dont une moitié montre le même nombre que le bout de la chaîne sur la table, dans une autre représentation : points et chiffres (niveau 1), opérations et résultats jusqu’à 20 (niveau 2), dizaines et unités jusqu’à 99 (niveau 3).',
  skills: ['math.representations'],
  subject: 'mathematics',
  responseType: 'word',
  roundsPerSession: 3,
  generate(skillId, difficulty, rng, seed) {
    const d = buildDominoRound(rng, difficulty);
    const pieces = rng.shuffle([d.correct, ...d.distractors.map((x) => x.face)]).map((left) => ({ label: faceLabel(left), left, right: decoFace(rng, difficulty) }));
    const right = faceLabel(d.correct);
    return {
      ...gameBase(this, skillId, difficulty, seed),
      questionKey: `do-${faceLabel(d.open)}-${right}`,
      instruction: 'Trouve le domino qui s’attache : il doit montrer le même nombre.',
      statement: 'Quel domino va avec le bout libre?',
      hint: d.hint,
      answerFormat: 'un domino',
      readingHint: 'un domino',
      game: { game: 'dominoes', table: { left: decoFace(rng, difficulty), open: d.open }, pieces, options: pieces.map((p) => p.label) },
      expected: { type: 'word', value: right, accentsMatter: false },
      explanation: d.explanation,
      commonErrors: dominoErrors(d),
      origin: 'Original.',
      retryMessage: 'Pas tout à fait. Ce domino ne montre pas le même nombre.',
    };
  },
};

export const games: GameDefinition[] = [appleCrates, numberTrain, frogJump, wordFishing, mysteryStory, numberPath, hiddenWords, dominoes];

export function getGame(id: string): GameDefinition {
  const g = games.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown game: ${id}`);
  return g;
}

export function generateGameRound(gameId: string, skillId: string, difficulty: Difficulty, seed: number, avoidKeys: string[] = [], opts: GameOptions = {}): ExerciseInstance {
  const g = getGame(gameId);
  if (!g.skills.includes(skillId)) throw new Error(`Game ${gameId} does not train ${skillId}`);
  return pickPreferred((s) => g.generate(skillId, difficulty, createRng(s), s, opts), seed, avoidKeys, opts.prefer);
}
