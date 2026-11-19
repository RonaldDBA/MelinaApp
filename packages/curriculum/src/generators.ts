import { createRng, type Difficulty, type ExerciseInstance, type Rng } from '@melina/shared';
import texts from '../../../content/french/texts.json';
import words from '../../../content/french/words.json';
import { bigSequence, buildCountingPath, buildLinePath, buildTensPath, countingErrors, countingExplanation, countingHint, holeValues } from './counting';
import { buildDominoRound, faceValue } from './dominoes';
import { pluralRule, splitArticle } from './plural';
import { pickPreferred } from './pick';
import { blanksFor, letters as wordLetters, soundHint, type WordEntry } from './hiddenwords';
import { schoolPool } from './schoolwords';

/** Versioned exercise template. The version goes into each attempt's history. */
export interface ExerciseTemplate {
  id: string;
  version: number;
  skillId: string;
  responseType: ExerciseInstance['responseType'];
  description: string;
  generate(rng: Rng, difficulty: Difficulty, seed: number): ExerciseInstance;
}

const ADJ_FIRST = /^(beaux|belles|nouveaux|nouvelles|gros|grosses|petits|petites|grands|grandes|bons|bonnes|jolis|jolies|vieux|vieilles|longs|longues) /;
const sg = (n: number, word: string) => (n <= 1 ? word : `${word}s`);
const pl3 = (n: number, word: string) => `${n} ${sg(n, word)}`;

function base(
  t: Pick<ExerciseTemplate, 'id' | 'version' | 'skillId' | 'responseType'>,
  subject: ExerciseInstance['subject'],
  difficulty: Difficulty,
  seed: number,
) {
  return {
    exerciseId: t.id,
    exerciseVersion: t.version,
    skillId: t.skillId,
    subject,
    difficulty,
    responseType: t.responseType,
    seed,
  };
}

// ---------------------------------------------------------------- Mathématique

const placeValue: ExerciseTemplate = {
  id: 'place-value.compose',
  version: 1,
  skillId: 'math.place-value',
  responseType: 'number',
  description: 'Composer et décomposer des nombres avec des dizaines, des unités et des centaines.',
  generate(rng, difficulty, seed) {
    const b = base(this, 'mathematics', difficulty, seed);
    if (difficulty === 1) {
      const tens = rng.int(1, 5);
      const units = rng.int(1, 9);
      const n = tens * 10 + units;
      return {
        ...b,
        questionKey: `pv1-${n}`,
        instruction: 'Compte les dizaines et les unités.',
        statement: 'Combien de cubes y a-t-il en tout? Écris le nombre.',
        visual: { kind: 'tens-units', tens, units },
        hint: 'Une barre vaut 10. Compte les barres par 10, puis ajoute les petits cubes.',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: n },
        explanation: `${tens} ${sg(tens, 'dizaine')} et ${units} ${sg(units, 'unité')}, ça fait ${n}.`,
        commonErrors: [
          { match: String(units * 10 + tens), type: 'inversion-dizaines-unites', message: 'Les dizaines et les unités ont été inversées.' },
          { match: String(tens + units), type: 'addition-des-chiffres', message: 'Une barre vaut 10, pas 1.' },
        ],
        origin: 'Original — inspiré par l’objectif de groupement par 10 (La récolte de citrouilles).',
      };
    }
    if (difficulty === 2) {
      const tens = rng.int(1, 9);
      const units = rng.int(0, 9);
      const n = tens * 10 + units;
      if (rng.next() < 0.5) {
        return {
          ...b,
          questionKey: `pv2a-${n}`,
          instruction: 'Lis bien la question.',
          statement: `Écris le nombre qui a ${tens} ${sg(tens, 'dizaine')} et ${units} ${sg(units, 'unité')}.`,
          hint: 'Le chiffre des dizaines s’écrit à gauche, celui des unités à droite.',
          answerFormat: 'un nombre',
          readingHint: 'un nombre écrit en chiffres',
          expected: { type: 'number', value: n },
          explanation: `${tens} ${sg(tens, 'dizaine')} = ${tens * 10}, et ${tens * 10} + ${units} = ${n}.`,
          commonErrors: [
            { match: String(units * 10 + tens), type: 'inversion-dizaines-unites', message: 'Les dizaines vont à gauche.' },
          ],
          origin: 'Original.',
        };
      }
      const askTens = rng.next() < 0.6;
      const target = askTens ? tens : units;
      return {
        ...b,
        questionKey: `pv2b-${n}-${askTens ? 't' : 'u'}`,
        instruction: 'Lis bien la question.',
        statement: `Dans le nombre ${n}, combien y a-t-il ${askTens ? 'de dizaines' : 'd’unités'}?`,
        hint: 'Dans un nombre à deux chiffres, le chiffre de gauche donne les dizaines.',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: target },
        explanation: `${n}, c’est ${tens} ${sg(tens, 'dizaine')} et ${units} ${sg(units, 'unité')}.`,
        commonErrors: [
          { match: String(askTens ? units : tens), type: 'confusion-dizaines-unites', message: 'Attention à la position des chiffres.' },
          { match: String(n), type: 'nombre-entier', message: 'On demande seulement un chiffre du nombre.' },
        ],
        origin: 'Original.',
      };
    }
    if (difficulty === 4) {
      // 3 digits: the role of each digit (centaines, dizaines, unités), with zeros in the middle
      const h = rng.int(1, 9);
      const t = rng.next() < 0.35 ? 0 : rng.int(1, 9);
      const u = rng.int(0, 9);
      const n = h * 100 + t * 10 + u;
      const ask = rng.pick(['centaines', 'dizaines', 'unités'] as const);
      const value = ask === 'centaines' ? h : ask === 'dizaines' ? t : u;
      return {
        ...b,
        questionKey: `pv4-${n}-${ask}`,
        instruction: 'Lis bien la question.',
        statement: `Dans le nombre ${n}, quel est le chiffre des ${ask}?`,
        hint: 'Dans un nombre à trois chiffres : à gauche les centaines, au milieu les dizaines, à droite les unités.',
        answerFormat: 'un chiffre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value },
        explanation: `${n} : ${pl3(h, 'centaine')}, ${pl3(t, 'dizaine')} et ${pl3(u, 'unité')}. Le chiffre des ${ask} est ${value}.`,
        commonErrors: [
          ...(ask !== 'unités' && u !== value ? [{ match: String(u), type: 'confusion-position', message: 'Attention : le chiffre de droite, ce sont les unités.' }] : []),
          ...(ask !== 'centaines' && h !== value ? [{ match: String(h), type: 'confusion-position', message: 'Attention : le chiffre de gauche, ce sont les centaines.' }] : []),
          { match: String(n), type: 'nombre-entier', message: 'On demande seulement un chiffre du nombre.' },
        ].filter((e, i, arr) => e.match !== String(value) && arr.findIndex((x) => x.match === e.match) === i),
        origin: 'Original.',
      };
    }
    if (difficulty >= 6) {
      // «Défi»: 4-digit numbers (thousands), with a zero in the middle
      const m = rng.int(1, 9);
      const h = rng.next() < 0.35 ? 0 : rng.int(1, 9);
      const t = rng.next() < 0.3 ? 0 : rng.int(1, 9);
      const u = rng.int(0, 9);
      const n = m * 1000 + h * 100 + t * 10 + u;
      if (rng.next() < 0.5) {
        const ask = rng.pick(['milliers', 'centaines', 'dizaines'] as const);
        const value = ask === 'milliers' ? m : ask === 'centaines' ? h : t;
        return {
          ...b,
          questionKey: `pv6a-${n}-${ask}`,
          instruction: 'Défi! Lis bien la question.',
          statement: `Dans le nombre ${n}, quel est le chiffre des ${ask}?`,
          hint: 'Dans un nombre à quatre chiffres : milliers, centaines, dizaines, unités, de gauche à droite.',
          answerFormat: 'un chiffre',
          readingHint: 'un nombre écrit en chiffres',
          expected: { type: 'number', value },
          explanation: `${n} : ${pl3(m, 'millier')}, ${pl3(h, 'centaine')}, ${pl3(t, 'dizaine')} et ${pl3(u, 'unité')}.`,
          commonErrors: [{ match: String(n), type: 'nombre-entier', message: 'On demande seulement un chiffre du nombre.' }],
          origin: 'Original — défi au-delà de la 2e année (2e cycle).',
        };
      }
      return {
        ...b,
        questionKey: `pv6b-${n}`,
        instruction: 'Défi! Écris le nombre.',
        statement: `Écris le nombre : ${pl3(m, 'millier')}, ${pl3(h, 'centaine')}, ${pl3(t, 'dizaine')} et ${pl3(u, 'unité')}.`,
        hint: 'Écris les milliers, puis les centaines, les dizaines et les unités. Une position vide prend un 0.',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: n },
        explanation: `${m * 1000} + ${h * 100} + ${t * 10} + ${u} = ${n}.`,
        commonErrors: h === 0 || t === 0 ? [{ match: String(n).replace(/0/g, ''), type: 'zero-oublie', message: 'Quand une position est vide, on écrit un 0.' }].filter((e) => e.match !== String(n) && e.match !== '') : [],
        origin: 'Original — défi au-delà de la 2e année (2e cycle).',
      };
    }
    if (difficulty >= 5) {
      // a decomposition that is not the «normal» one: 2 centaines, 13 dizaines et 5 unités
      const h = rng.int(1, 7);
      const t = rng.int(10, 19);
      const u = rng.int(0, 9);
      const n = h * 100 + t * 10 + u;
      if (rng.next() < 0.5) {
        return {
          ...b,
          questionKey: `pv5a-${h}-${t}-${u}`,
          instruction: 'Lis bien la question. Attention, c’est un piège!',
          statement: `Écris le nombre : ${pl3(h, 'centaine')}, ${t} dizaines et ${pl3(u, 'unité')}.`,
          hint: '10 dizaines font 1 centaine. Échange les dizaines en trop contre une centaine.',
          answerFormat: 'un nombre',
          readingHint: 'un nombre écrit en chiffres',
          expected: { type: 'number', value: n },
          explanation: `${t} dizaines = 1 centaine et ${pl3(t - 10, 'dizaine')}. Donc ${h * 100} + ${t * 10} + ${u} = ${n}.`,
          commonErrors: [{ match: `${h}${t}${u}`, type: 'chiffres-colles', message: 'On ne peut pas coller les nombres : 10 dizaines font 1 centaine.' }],
          origin: 'Original.',
        };
      }
      const m = h * 100 + rng.int(1, 9) * 10 + u;
      const tensAll = Math.floor(m / 10);
      return {
        ...b,
        questionKey: `pv5b-${m}`,
        instruction: 'Lis bien la question.',
        statement: `Combien de dizaines y a-t-il en tout dans ${m}? (Compte aussi les dizaines qui sont dans les centaines.)`,
        hint: 'Une centaine, c’est 10 dizaines. Compte les dizaines des centaines, puis ajoute les autres.',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: tensAll },
        explanation: `${m} = ${pl3(Math.floor(m / 100), 'centaine')} (${Math.floor(m / 100) * 10} dizaines) et ${pl3(Math.floor((m % 100) / 10), 'dizaine')} de plus : ${tensAll} dizaines en tout.`,
        commonErrors: [{ match: String(Math.floor((m % 100) / 10)), type: 'chiffre-des-dizaines-seulement', message: 'Le chiffre des dizaines ne suffit pas : les centaines contiennent aussi des dizaines.' }],
        origin: 'Original.',
      };
    }
    const hundreds = rng.int(1, 9);
    const tens = rng.next() < 0.3 ? 0 : rng.int(1, 9);
    const units = rng.int(0, 9);
    const n = hundreds * 100 + tens * 10 + units;
    const errors = [
      { match: String(units * 100 + tens * 10 + hundreds), type: 'inversion-ordre', message: 'Les centaines vont à gauche.' },
    ];
    if (tens === 0) errors.push({ match: String(hundreds * 10 + units), type: 'zero-oublie', message: 'Quand il n’y a pas de dizaine, on écrit un 0.' });
    return {
      ...b,
      questionKey: `pv3-${n}`,
      instruction: 'Lis bien la question.',
      statement: `Écris le nombre : ${hundreds} ${sg(hundreds, 'centaine')}, ${tens} ${sg(tens, 'dizaine')} et ${units} ${sg(units, 'unité')}.`,
      hint: 'Écris d’abord les centaines, puis les dizaines, puis les unités. Une position vide prend un 0.',
      answerFormat: 'un nombre',
      readingHint: 'un nombre écrit en chiffres',
      expected: { type: 'number', value: n },
      explanation: `${hundreds * 100} + ${tens * 10} + ${units} = ${n}.`,
      commonErrors: errors,
      origin: 'Original.',
    };
  },
};

const groupItems = [
  { plural: 'pommes', container: 'caisse', containers: 'caisses', fem: true, itemFem: true },
  { plural: 'crayons', container: 'boîte', containers: 'boîtes', fem: true, itemFem: false },
  { plural: 'billes', container: 'sac', containers: 'sacs', fem: false, itemFem: true },
  { plural: 'carottes', container: 'panier', containers: 'paniers', fem: false, itemFem: true },
  { plural: 'livres', container: 'bac', containers: 'bacs', fem: false, itemFem: false },
] as const;

const groupingTens: ExerciseTemplate = {
  id: 'grouping.boxes',
  version: 1,
  skillId: 'math.grouping-tens',
  responseType: 'number',
  description: 'Combien de groupes de 10 (y compris le groupe incomplet).',
  generate(rng, difficulty, seed) {
    const b = base(this, 'mathematics', difficulty, seed);
    const it = rng.pick(groupItems);
    const un = it.fem ? 'une' : 'un';
    const Un = it.fem ? 'Une' : 'Un';
    const rule = `${Un} ${it.container} contient au maximum 10 ${it.plural}. On remplit ${un} ${it.container} avant d’en commencer ${it.fem ? 'une autre' : 'un autre'}.`;
    if (difficulty === 1) {
      const k = rng.int(2, 9);
      const n = k * 10;
      return {
        ...b,
        questionKey: `gt1-${n}-${it.plural}`,
        instruction: 'Fais des groupes de 10.',
        statement: `Il y a ${n} ${it.plural}. ${rule} Combien de ${it.containers} faut-il?`,
        visual: { kind: 'groups', total: n, perGroup: 10, item: it.plural },
        hint: 'Compte par bonds de 10 : 10, 20, 30…',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: k },
        explanation: `${n}, c’est ${k} dizaines. Il faut donc ${k} ${it.containers}.`,
        commonErrors: [{ match: String(n), type: 'quantite-au-lieu-des-groupes', message: 'On demande le nombre de groupes, pas le nombre d’objets.' }],
        origin: 'Original — même objectif que La récolte de citrouilles (groupes de 10).',
      };
    }
    if (difficulty === 2) {
      let n = rng.int(11, 99);
      if (n % 10 === 0) n += rng.int(1, 9);
      if (n > 99) n = 99;
      const k = Math.ceil(n / 10);
      return {
        ...b,
        questionKey: `gt2-${n}-${it.plural}`,
        instruction: 'Fais des groupes de 10.',
        statement: `Il y a ${n} ${it.plural}. ${rule} Combien de ${it.containers} faut-il pour tout ranger?`,
        hint: 'Combien de dizaines y a-t-il? Est-ce qu’il reste des objets? Ils ont aussi besoin d’une place!',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: k },
        explanation: `${n} = ${pl3(Math.floor(n / 10), 'groupe')} de 10 et ${n % 10} de plus. ${n % 10 === 1 ? `${it.itemFem ? 'Celle' : 'Celui'} qui reste a` : `Les ${n % 10} qui restent ont`} besoin ${it.fem ? 'd’une' : 'd’un'} ${it.container} de plus : ${k}.`,
        commonErrors: [
          { match: String(Math.floor(n / 10)), type: 'groupe-incomplet-oublie', message: 'Les objets qui restent ont aussi besoin d’une place.' },
          { match: String(n), type: 'quantite-au-lieu-des-groupes', message: 'On demande le nombre de groupes.' },
        ],
        origin: 'Original — même objectif que La récolte de citrouilles (groupe incomplet).',
      };
    }
    if (difficulty === 4) {
      let n = rng.int(101, 399);
      if (n % 10 === 0) n += rng.int(1, 9);
      const k = Math.ceil(n / 10);
      return {
        ...b,
        questionKey: `gt4-${n}-${it.plural}`,
        instruction: 'Fais des groupes de 10.',
        statement: `Il y a ${n} ${it.plural}. ${rule} Combien de ${it.containers} faut-il pour tout ranger?`,
        hint: 'Combien de dizaines y a-t-il en tout dans ce nombre? Une centaine, c’est 10 dizaines. N’oublie pas les objets qui restent!',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: k },
        explanation: `${n} = ${Math.floor(n / 10)} dizaines et ${n % 10} de plus. Il faut ${Math.floor(n / 10)} ${it.containers} ${it.fem ? 'pleines' : 'pleins'} et 1 de plus : ${k}.`,
        commonErrors: [
          { match: String(Math.floor(n / 10)), type: 'groupe-incomplet-oublie', message: 'Les objets qui restent ont aussi besoin d’une place.' },
          { match: String(Math.floor((n % 100) / 10) + 1), type: 'centaines-oubliees', message: 'Les centaines contiennent aussi des dizaines : 100, c’est 10 dizaines.' },
        ].filter((e) => e.match !== String(k)),
        origin: 'Original.',
      };
    }
    if (difficulty >= 6) {
      // «Défi»: groups of 100
      let n = rng.int(1001, 4999);
      if (n % 100 === 0) n += rng.int(1, 99);
      const k = Math.ceil(n / 100);
      return {
        ...b,
        questionKey: `gt6-${n}-${it.plural}`,
        instruction: 'Défi! Fais des groupes de 100.',
        statement: `Il y a ${n} ${it.plural}. Un grand carton contient au maximum 100 ${it.plural}. Combien de cartons faut-il pour tout ranger?`,
        hint: 'Combien de centaines y a-t-il en tout dans ce nombre? 1000, c’est 10 centaines. N’oublie pas ce qui reste!',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: k },
        explanation: `${n} = ${Math.floor(n / 100)} centaines et ${n % 100} de plus : ${Math.floor(n / 100)} cartons pleins et 1 de plus, donc ${k}.`,
        commonErrors: [
          { match: String(Math.floor(n / 100)), type: 'groupe-incomplet-oublie', message: 'Ce qui reste a aussi besoin d’un carton.' },
          { match: String(Math.floor((n % 1000) / 100) + 1), type: 'milliers-oublies', message: 'Les milliers contiennent aussi des centaines : 1000, c’est 10 centaines.' },
        ].filter((e) => e.match !== String(k)),
        origin: 'Original — défi au-delà de la 2e année (2e cycle).',
      };
    }
    if (difficulty >= 5) {
      let n = rng.int(150, 950);
      if (n % 10 === 0) n += rng.int(1, 9);
      const crates = Math.ceil(n / 10);
      const trucks = Math.ceil(crates / 10);
      return {
        ...b,
        questionKey: `gt5-${n}-${it.plural}`,
        instruction: 'Lis bien le problème. Laisse des traces de ta démarche.',
        statement: `Lila a ${n} ${it.plural}. ${rule} Un camion transporte au maximum 10 ${it.containers}. Combien de camions faut-il pour tout transporter?`,
        hint: 'Calcule d’abord combien de contenants il faut. Ensuite, fais des groupes de 10 contenants pour les camions.',
        answerFormat: 'un nombre',
        readingHint: 'un nombre écrit en chiffres',
        expected: { type: 'number', value: trucks },
        explanation: `Il faut ${crates} ${it.containers}. Avec 10 ${it.containers} par camion, il faut ${trucks} camions.`,
        commonErrors: [
          { match: String(crates), type: 'contenants-au-lieu-des-camions', message: 'Ça, c’est le nombre de contenants. Combien de camions pour les transporter?' },
          { match: String(Math.floor(crates / 10)), type: 'camion-incomplet-oublie', message: 'Le dernier camion n’est pas plein, mais il faut quand même le compter.' },
        ].filter((e) => e.match !== String(trucks)),
        origin: 'Original.',
      };
    }
    let a = rng.int(12, 58);
    let c = rng.int(12, 58);
    if (a % 10 === 0) a += 3;
    if (c % 10 === 0) c += 4;
    const k = Math.ceil(a / 10) + Math.ceil(c / 10);
    const merged = Math.ceil((a + c) / 10);
    const errs = [{ match: String(Math.floor(a / 10) + Math.floor(c / 10)), type: 'groupe-incomplet-oublie', message: 'Chaque jour, les objets qui restent ont besoin d’une place.' }];
    if (merged !== k) errs.push({ match: String(merged), type: 'jours-melanges', message: 'Chaque jour, on utilise des contenants nouveaux.' });
    return {
      ...b,
      questionKey: `gt3-${a}-${c}-${it.plural}`,
      instruction: 'Lis bien le problème. Laisse des traces de ta démarche.',
      statement: `Lundi, Lila range ${a} ${it.plural}. Mardi, elle range ${c} ${it.plural}. ${rule} Chaque jour, elle utilise des ${it.containers} ${it.fem ? 'neuves' : 'neufs'}. Combien de ${it.containers} utilise-t-elle en tout?`,
      hint: 'Calcule d’abord pour lundi, puis pour mardi. Additionne ensuite.',
      answerFormat: 'un nombre',
      readingHint: 'un nombre écrit en chiffres',
      expected: { type: 'number', value: k },
      explanation: `Lundi : ${Math.ceil(a / 10)}. Mardi : ${Math.ceil(c / 10)}. En tout : ${k}.`,
      commonErrors: errs,
      origin: 'Original — prolonge La récolte de citrouilles (deux journées).',
    };
  },
};

const addSub: ExerciseTemplate = {
  id: 'add-sub.compute',
  version: 1,
  skillId: 'math.add-sub',
  responseType: 'number',
  description: 'Additions et soustractions selon le niveau.',
  generate(rng, difficulty, seed) {
    const b = base(this, 'mathematics', difficulty, seed);
    const plus = rng.next() < 0.5;
    let x: number;
    let y: number;
    if (difficulty === 1) {
      if (plus) {
        x = rng.int(2, 12);
        y = rng.int(1, 20 - x);
      } else {
        x = rng.int(6, 20);
        y = rng.int(1, x - 1);
      }
    } else if (difficulty >= 4) {
      // 4: 3 digits ± 2 digits, with regrouping; 5: 3 digits ± 3 digits, with regrouping
      for (;;) {
        x = difficulty >= 6 ? rng.int(1200, 8999) : rng.int(difficulty === 4 ? 120 : 210, 899);
        y = difficulty >= 6 ? rng.int(150, 2999) : difficulty === 4 ? rng.int(12, 89) : rng.int(110, 689);
        const carry = plus ? (x % 10) + (y % 10) >= 10 || (Math.floor(x / 10) % 10) + (Math.floor(y / 10) % 10) >= 10 : x % 10 < y % 10 || Math.floor(x / 10) % 10 < Math.floor(y / 10) % 10;
        if (!carry) continue;
        if (plus ? x + y <= (difficulty >= 6 ? 9999 : 999) : y < x) break;
      }
    } else {
      const regroup = difficulty >= 3;
      for (;;) {
        x = rng.int(12, 89);
        y = rng.int(11, 79);
        const ux = x % 10;
        const uy = y % 10;
        if (plus) {
          if (x + y > 99) continue;
          if (regroup ? ux + uy >= 10 : ux + uy < 10) break;
        } else {
          if (y >= x) continue;
          if (regroup ? ux < uy : ux >= uy) break;
        }
      }
    }
    const result = plus ? x + y : x - y;
    const story = difficulty > 1 && rng.next() < 0.5;
    const statement = story
      ? plus
        ? `Lila a ${x} graines. Elle en trouve encore ${y}. Combien de graines a-t-elle maintenant?`
        : `Lila a ${x} graines. Elle en plante ${y}. Combien de graines lui reste-t-il?`
      : `Calcule : ${x} ${plus ? '+' : '−'} ${y} = ?`;
    const errs: ExerciseInstance['commonErrors'] = [];
    if (difficulty >= 3) {
      // each message only when THAT column goes past 10 (before, 152 + 63 heard «10 unités font 1 dizaine»)
      const uCarry = plus ? (x % 10) + (y % 10) >= 10 : x % 10 < y % 10;
      const tx = Math.floor(x / 10) % 10;
      const ty = Math.floor(y / 10) % 10;
      const tCarry = plus ? tx + ty + (uCarry ? 1 : 0) >= 10 : tx - (uCarry ? 1 : 0) < ty;
      if (uCarry) errs.push({ match: String(plus ? result - 10 : result + 10), type: plus ? 'retenue-oubliee' : 'emprunt-oublie', message: plus ? 'N’oublie pas la retenue : 10 unités font 1 dizaine.' : 'Il faut échanger 1 dizaine contre 10 unités.' });
      if (difficulty >= 4 && tCarry && Math.max(x, y) >= 100) errs.push({ match: String(plus ? result - 100 : result + 100), type: plus ? 'retenue-oubliee' : 'emprunt-oublie', message: plus ? 'N’oublie pas la retenue : 10 dizaines font 1 centaine.' : 'Il faut échanger 1 centaine contre 10 dizaines.' });
      if (!plus && difficulty === 3) {
        const digitwise = Math.abs(Math.floor(x / 10) - Math.floor(y / 10)) * 10 + Math.abs((x % 10) - (y % 10));
        if (digitwise !== result + 10) errs.push({ match: String(digitwise), type: 'petit-moins-grand', message: 'On ne peut pas inverser les chiffres des unités : il faut échanger une dizaine.' });
      }
    }
    if (plus) errs.push({ match: String(Math.abs(x - y)), type: 'operation-inversee', message: 'Ici, on ajoute.' });
    else errs.push({ match: String(x + y), type: 'operation-inversee', message: 'Ici, on enlève.' });
    return {
      ...b,
      questionKey: `as-${x}${plus ? '+' : '-'}${y}`,
      instruction: story ? 'Lis le problème et calcule.' : 'Calcule.',
      statement,
      hint: plus
        ? difficulty >= 4
          ? 'Additionne les unités, puis les dizaines, puis les centaines. 10 unités font 1 dizaine; 10 dizaines font 1 centaine.'
          : 'Additionne d’abord les unités, puis les dizaines.'
        : difficulty >= 4
          ? 'Enlève les unités, puis les dizaines, puis les centaines. Tu peux échanger 1 dizaine contre 10 unités, ou 1 centaine contre 10 dizaines.'
          : 'Enlève d’abord les unités, puis les dizaines. Tu peux échanger une dizaine contre 10 unités.',
      answerFormat: 'un nombre',
      readingHint: 'un nombre écrit en chiffres',
      expected: { type: 'number', value: result },
      explanation: `${x} ${plus ? '+' : '−'} ${y} = ${result}.`,
      commonErrors: errs,
      origin: 'Original.',
    };
  },
};

const sequences: ExerciseTemplate = {
  id: 'sequence.complete',
  version: 1,
  skillId: 'math.sequences',
  responseType: 'sequence',
  description: 'Compléter des suites de nombres.',
  generate(rng, difficulty, seed) {
    const b = base(this, 'mathematics', difficulty, seed);
    let step: number;
    let start: number;
    if (difficulty === 1) {
      step = rng.pick([1, 2]);
      start = rng.int(1, 40);
    } else if (difficulty === 2) {
      step = rng.pick([5, 10]);
      start = step === 5 ? rng.int(1, 10) * 5 : rng.int(1, 40);
    } else if (difficulty === 3) {
      step = rng.pick([-2, -10, 3, -5]);
      // going down: the 6 terms stay ≥ 1 (before, −10 starting from 40–49 reached 0 and negative numbers)
      start = step < 0 ? rng.int(Math.max(40, -step * 5 + 1), 95) : rng.int(1, 30);
      if (step === -5) start = rng.int(10, 19) * 5;
    } else {
      ;({ step, start } = bigSequence(rng, difficulty));
    }
    const terms = Array.from({ length: 6 }, (_, i) => start + i * step);
    const shown = terms.slice(0, 4);
    const missing = terms.slice(4);
    const dir = step > 0 ? `on ajoute ${step}` : `on enlève ${-step}`;
    return {
      ...b,
      questionKey: `seq-${start}-${step}`,
      instruction: 'Trouve la règle de la suite.',
      statement: `Complète la suite : ${shown.join(', ')}, ___, ___`,
      hint: 'Regarde comment on passe d’un nombre au suivant.',
      answerFormat: 'deux nombres',
      readingHint: 'deux nombres écrits en chiffres',
      expected: { type: 'sequence', values: missing },
      explanation: `À chaque fois, ${dir}. Donc : ${missing.join(', ')}.`,
      commonErrors: [
        { match: `${(terms[3] ?? 0) + 1},${(terms[3] ?? 0) + 2}`, type: 'compte-de-un', message: 'La règle n’est pas +1 : regarde l’écart entre les nombres.' },
      ],
      origin: 'Original.',
    };
  },
};

// ---------------------------------------------------------------- Français

type TextDef = (typeof texts.texts)[number];

const comprehension: ExerciseTemplate = {
  id: 'comprehension.explicit',
  version: 1,
  skillId: 'fr.comprehension',
  responseType: 'short-text',
  description: 'Information explicite dans un court texte original.',
  generate(rng, difficulty, seed) {
    const b = base(this, 'french', difficulty, seed);
    const pool: TextDef[] = texts.texts.filter((t) => t.level === difficulty);
    const text = rng.pick(pool.length ? pool : texts.texts);
    const q = rng.pick(text.questions);
    return {
      ...b,
      questionKey: `comp-${text.id}-${q.id}`,
      instruction: 'Lis le texte. Réponds à la question sur ta feuille.',
      statement: q.q,
      visual: { kind: 'text', title: text.title, paragraphs: text.paragraphs },
      hint: 'La réponse est écrite dans le texte. Relis-le doucement.',
      answerFormat: 'une réponse courte',
      readingHint: 'une réponse courte en français, manuscrite par un enfant',
      expected: { type: 'short-text', variants: q.variants, display: q.display },
      explanation: 'La réponse est écrite dans le texte. Relis-le pour la retrouver.',
      commonErrors: [],
      origin: 'Texte original écrit pour l’application (format inspiré des questionnaires de lecture de l’école).',
    };
  },
};

const plural: ExerciseTemplate = {
  id: 'plural.write',
  version: 1,
  skillId: 'fr.plural',
  responseType: 'word',
  description: 'Écrire le pluriel d’un nom.',
  generate(rng, difficulty, seed) {
    const b = base(this, 'french', difficulty, seed);
    const pool = words.plural.filter((w) => w.level === difficulty);
    const w = rng.pick(pool.length ? pool : words.plural);
    const [, singNoun] = splitArticle(w.singular);
    const [pluralArticle, pluralNoun] = splitArticle(w.plural);
    const errs: ExerciseInstance['commonErrors'] = [];
    if (w.rule !== 'same') errs.push({ match: singNoun, type: 'marque-pluriel-oubliee', message: w.rule === 'gn' ? 'Tout le groupe se met au pluriel.' : 'Au pluriel, le nom change.' });
    if (w.rule === 'x' || w.rule === 'xou') errs.push({ match: `${singNoun}s`, type: `pluriel-${w.rule}`, message: pluralRule[w.rule] ?? '' });
    if (w.rule === 'sou' || w.rule === 'eus') errs.push({ match: `${singNoun}x`, type: `pluriel-${w.rule}`, message: pluralRule[w.rule] ?? '' });
    if (w.rule === 'aux') errs.push({ match: `${singNoun}s`, type: 'pluriel-aux', message: pluralRule.aux ?? '' });
    if (w.rule === 'als') errs.push({ match: singNoun.replace(/(al|ail)$/, 'aux'), type: 'pluriel-als', message: pluralRule.als ?? '' });
    return {
      ...b,
      questionKey: `pl-${singNoun.replace(/ /g, '_')}`,
      instruction: w.rule === 'gn' ? 'Écris tout le groupe au pluriel.' : 'Écris le nom au pluriel.',
      statement: `${w.singular} → ${pluralArticle} ________`,
      hint: pluralRule[w.rule],
      answerFormat: w.rule === 'gn' ? 'un groupe de mots' : 'un mot',
      readingHint: 'des mots en français, manuscrits par un enfant',
      // adjective before the noun: the written norm is «de beaux chapeaux» (also accepts «des»); «de chapeaux» is not accepted
      expected: { type: 'word', value: pluralNoun, accentsMatter: true, alternatives: [w.plural, `des ${pluralNoun}`, `les ${pluralNoun}`, ...(ADJ_FIRST.test(pluralNoun) ? [`de ${pluralNoun}`] : [])] },
      explanation: `${w.singular} → ${w.plural}. ${pluralRule[w.rule] ?? ''}`,
      commonErrors: errs,
      origin: 'Original — règles alignées sur l’aide-mémoire de l’école (2e année).',
    };
  },
};


const spelling: ExerciseTemplate = {
  id: 'spelling.complete-word',
  version: 1,
  skillId: 'fr.spelling',
  responseType: 'word',
  description: 'Compléter et écrire des mots familiers.',
  generate(rng, difficulty, seed) {
    const b = base(this, 'french', difficulty, seed);
    // the list has words for levels 1 to 3; from 4 to 6, the hardest words and MORE hidden letters
    // (before, a level-6 item could be «lune» with one missing letter and count as level-6 evidence)
    // levels 4 to 6: words from the SCHOOL list that have a picture (dozens, not 6 repeated ones), harder and harder.
    // With no sound on paper, the 1st letter stays visible: with the picture, it settles the doubt (❄️ + «n…» = neige, not hiver).
    // 4: the hard parts hidden; 5 and 6: everything but the 1st letter (6: the hardest words on the list)
    const hard: WordEntry[] = schoolPool(null).pool.filter((e) => e.emoji && wordLetters(e.word).length >= 4);
    // level 6: the hardest ones (≥ 4), topped up with level-3 ones if there are not enough; never falls back to easy words
    const lvl3 = hard.filter((e) => e.level >= 3);
    const lvl4 = hard.filter((e) => e.level >= 4);
    const chosenPool = difficulty >= 6 ? (lvl4.length >= 10 ? lvl4 : lvl3) : lvl3.length >= 10 ? lvl3 : hard;
    const pick4 = chosenPool.map((e) => ({ word: e.word, emoji: e.emoji as string, blanks: [] as number[][], level: e.level }));
    const lvl = words.spelling.filter((w) => w.level === Math.min(difficulty, 3));
    const w = difficulty >= 4 && pick4.length ? rng.pick(pick4) : rng.pick(lvl.length ? lvl : words.spelling);
    const letters = wordLetters(w.word);
    const hidden = new Set<number>();
    if (difficulty >= 4) for (const i of blanksFor({ word: w.word, level: 3 }, difficulty === 4 ? 3 : 4)) hidden.add(i);
    else
      for (const [from, to] of w.blanks as number[][]) {
        for (let i = from ?? 0; i <= (to ?? from ?? 0); i++) hidden.add(i);
      }
    const masked = letters.map((ch, i) => (hidden.has(i) ? '_' : ch)).join(' ');
    const gh = soundHint(w.word, [...hidden]);
    return {
      ...b,
      questionKey: difficulty >= 4 ? `sp${difficulty}-${w.word}` : `sp-${w.word}`,
      instruction: 'Regarde l’image. Écris le mot en entier sur ta feuille.',
      statement: `Complète le mot : ${masked}`,
      visual: { kind: 'emoji', emoji: w.emoji },
      hint: gh ?? 'Dis le mot lentement et écoute chaque son.',
      answerFormat: 'un mot',
      readingHint: 'un mot en français, manuscrit par un enfant',
      expected: { type: 'word', value: w.word, accentsMatter: true },
      explanation: `Le mot s’écrit : ${w.word}.`,
      commonErrors: [],
      origin: 'Original — format inspiré de la fiche « Jour 1 » préparée à la maison.',
    };
  },
};

/** Same skill as the « Le chemin des nombres » game, on paper. Level 3: by 10 (the column of the hundred chart). */
const countingPath: ExerciseTemplate = {
  id: 'counting.path',
  version: 1,
  skillId: 'math.counting',
  responseType: 'sequence',
  description: 'Compléter les nombres manquants dans un comptage (de 1 en 1, en ordre croissant et décroissant; de 10 en 10 au niveau 3).',
  generate(rng, difficulty, seed) {
    const p = difficulty >= 4 ? buildCountingPath(rng, difficulty) : difficulty === 3 ? buildTensPath(rng) : buildLinePath(rng, difficulty as 1 | 2);
    const missing = holeValues(p);
    const shown = p.cells.map((c, i) => (p.holes.includes(i) ? '___' : String(c.value))).join(', ');
    return {
      ...base(this, 'mathematics', difficulty, seed),
      questionKey: `cnt-${p.cells.map((c) => c.value).join('.')}-${p.holes.join('.')}`,
      instruction: 'Écris les nombres qui manquent.',
      statement: `Complète : ${shown}`,
      hint: countingHint(p),
      answerFormat: `${missing.length} nombres, dans l’ordre`,
      readingHint: 'des nombres écrits en chiffres',
      expected: { type: 'sequence', values: missing },
      explanation: countingExplanation(p),
      commonErrors: countingErrors(p),
      origin: 'Original.',
    };
  },
};

/** Same skill as the « Les dominos des nombres » game, on paper: write the represented number. */
const representations: ExerciseTemplate = {
  id: 'representations.number',
  version: 1,
  skillId: 'math.representations',
  responseType: 'number',
  description: 'Écrire le nombre représenté sous une autre forme (points, opération jusqu’à 20, dizaines et unités).',
  generate(rng, difficulty, seed) {
    const b = base(this, 'mathematics', difficulty, seed);
    const d = buildDominoRound(rng, difficulty);
    // on paper, the child always starts from the «non-digit» representation and writes the number
    const from = d.open.kind === 'digit' ? d.correct : d.open;
    const value = faceValue(from);
    const common = { ...b, answerFormat: 'un nombre', readingHint: 'un nombre écrit en chiffres', expected: { type: 'number' as const, value }, explanation: d.explanation, hint: d.hint, origin: 'Original.' };
    if (from.kind === 'dots')
      return { ...common, questionKey: `rep-dots-${value}`, instruction: 'Compte les points.', statement: 'Combien de points vois-tu? Écris le nombre.', visual: { kind: 'groups', total: value, perGroup: 5, item: 'points' }, commonErrors: [] };
    if (from.kind === 'tens')
      return {
        ...common,
        questionKey: `rep-tens-${value}`,
        instruction: 'Une barre vaut 10, un cube vaut 1.',
        statement: 'Quel nombre est représenté? Écris-le.',
        visual: { kind: 'tens-units', tens: from.tens, units: from.units },
        commonErrors: from.units !== from.tens ? [{ match: String(from.units * 10 + from.tens), type: 'inversion-dizaines-unites', message: 'Les dizaines s’écrivent à gauche.' }] : [],
      };
    const text = from.kind === 'expr' ? from.text : String(value);
    return { ...common, questionKey: `rep-expr-${text}`, instruction: 'Calcule.', statement: `Quel nombre est égal à ${text}?`, commonErrors: [] };
  },
};

export const templates: ExerciseTemplate[] = [placeValue, groupingTens, addSub, sequences, countingPath, representations, comprehension, plural, spelling];

/** Skills that have a PAPER activity (the English listening skills are screen-only: no paper, no reading). */
export const hasPaper = (skillId: string) => templates.some((t) => t.skillId === skillId);

export function templatesForSkill(skillId: string): ExerciseTemplate[] {
  return templates.filter((t) => t.skillId === skillId);
}

/**
 * Generates an exercise avoiding recent keys (no immediate repetition of the same question).
 */
export function generateExercise(skillId: string, difficulty: Difficulty, seed: number, avoidKeys: string[] = [], prefer?: (tags: string[]) => number): ExerciseInstance {
  const list = templatesForSkill(skillId);
  if (list.length === 0) throw new Error(`No generator for ${skillId}`);
  return pickPreferred(
    (s) => {
      const rng = createRng(s);
      const tpl = list[Math.floor(rng.next() * list.length)] as ExerciseTemplate;
      return tpl.generate(rng, difficulty, s);
    },
    seed,
    avoidKeys,
    prefer,
  );
}
