import type { ExerciseInstance } from '@melina/shared';
import words from '../../../content/french/words.json';
import school from '../../../content/french/school-words.json';
import { ENGLISH_TAG_LABELS, listenTags } from './english';
import { COMMAND_TAG_LABELS, commandTags } from './commands';

/**
 * Tags of each exercise: WHAT it requires (retenue, passage de centaine, son « eau », noms en -ou…).
 * The engine's model learns, answer by answer, which tags are strong points and which are
 * points to strengthen for Melina. The tags are read from the exercise itself (key, answer, game),
 * so they also apply to the old history, with no migration.
 */

export const TAG_LABELS: Record<string, string> = {
  addition: 'addition',
  soustraction: 'soustraction',
  retenue: 'retenue (10 unités = 1 dizaine)',
  emprunt: 'emprunt (échanger une dizaine)',
  'retenue-centaine': 'retenue vers les centaines',
  'emprunt-centaine': 'emprunt d’une centaine',
  'nombres-3-chiffres': 'nombres à 3 chiffres',
  'probleme-ecrit': 'problèmes écrits',
  'saut-centaines': 'sauts de centaines',
  'suite-decroissante': 'suites qui reculent',
  'bonds-1-2': 'bonds de 1 ou 2',
  'bonds-5-10': 'bonds de 5 ou 10',
  'bonds-3-4': 'bonds de 3 ou 4',
  'grands-bonds': 'grands bonds (20, 25, 50, 100)',
  'passage-dizaine': 'changement de dizaine (39 → 40)',
  'passage-centaine': 'changement de centaine (199 → 200)',
  'compte-a-rebours': 'compter à rebours',
  'grille-100': 'grille de 100 (+10 / −10)',
  'bonds-de-10': 'compter de 10 en 10',
  'materiel-dizaines': 'barres et cubes',
  'composer-nombre': 'composer un nombre',
  'role-chiffre': 'valeur de chaque chiffre',
  centaines: 'centaines',
  'zero-au-milieu': 'zéro au milieu (305)',
  'echange-dizaines': '10 dizaines = 1 centaine',
  'dizaines-en-tout': 'dizaines en tout',
  'caisses-fermees': 'caisses déjà pleines',
  'groupes-exacts': 'groupes de 10 exacts',
  'groupe-incomplet': 'groupe incomplet',
  'deux-etapes': 'problèmes en deux étapes',
  'complement-a-10': 'compléter à 10',
  points: 'compter des points',
  'calcul-passage-dizaine': 'calcul en passant par 10',
  'calcul-2-chiffres': 'calcul à 2 chiffres',
  'forme-decomposee': 'forme décomposée (300 + 40 + 7)',
  'pluriel-s': 'pluriel en -s',
  'pluriel-x': 'pluriel en -x (-au, -eau, -eu)',
  'pluriel-same': 'noms en s, x, z (ne changent pas)',
  'pluriel-sou': 'noms en -ou (-s)',
  'pluriel-xou': 'exceptions en -oux (bijoux, cailloux…)',
  'pluriel-eus': 'bleus, pneus',
  'pluriel-gn': 'accord dans le groupe du nom',
  'pluriel-aux': 'pluriel en -aux (chevaux) — défi',
  'pluriel-als': 'exceptions en -als (bals, chandails) — défi',
  'nombres-4-chiffres': 'nombres à 4 chiffres — défi',
  'passage-millier': 'changement de millier (999 → 1000) — défi',
  milliers: 'milliers — défi',
  inference: 'inférence (lire entre les lignes) — défi',
  'son-eau': 'son « eau »',
  'son-ai-ei': 'son « ai / ei »',
  'son-ou': 'son « ou »',
  'son-on': 'son « on »',
  'son-an-en': 'son « an / en »',
  'son-in-ain': 'son « in / ain »',
  'son-oi': 'son « oi »',
  'son-eu': 'son « eu »',
  'son-ch-gn': 'sons « ch » et « gn »',
  'son-qu': 'son « qu »',
  accents: 'accents (é, è, ê, à…)',
  cedille: 'cédille (ç)',
  'lettre-muette': 'lettre muette à la fin',
  'consonne-double': 'consonne double (ss, ll, tt…)',
  'mot-long': 'mots longs',
  'question-qui': 'questions « qui »',
  'question-ou': 'questions « où »',
  'question-quand': 'questions « quand »',
  'question-pourquoi': 'questions « pourquoi »',
  'question-comment': 'questions « comment »',
  'question-combien': 'questions « combien »',
  'question-quoi': 'questions « quoi / quel »',
  'texte-long': 'textes longs',
  ...ENGLISH_TAG_LABELS,
  ...COMMAND_TAG_LABELS,
};

const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
/** «Zéro au milieu»: a zero in the tens place (305, 600) or, with 4 digits, in the hundreds place (4056). Not: 738, 4560. */
export const innerZero = (n: number) => {
  const s = String(n);
  return s.length >= 3 && (s[s.length - 2] === '0' || (s.length === 4 && s[1] === '0'));
};
/** Words whose final consonant IS PRONOUNCED (it is not a «lettre muette»). */
const PRONOUNCED_FINAL = new Set(['cactus', 'virus', 'fils', 'autobus', 'bus', 'ours', 'tennis', 'maïs', 'oasis', 'hélas', 'sens', 'mars', 'atlas', 'bonus', 'huit', 'sept', 'net', 'but', 'ouest', 'est', 'août', 'six', 'dix', 'index', 'lynx', 'gaz', 'cap', 'stop', 'sud', 'express', 'os']);
/** Is the last letter silent (chat, grand, souris)? */
export const silentFinal = (word: string) => {
  const w = word.normalize('NFC').toLowerCase();
  return [...w].length > 3 && /[tdsxzp]$/.test(w) && !PRONOUNCED_FINAL.has(w);
};
const V = 'aeiouyéèêëàâîïôûùü';
/** Verb forms from the school list with a SILENT «-ent» («ils disent»): it is not the « an » sound (as in «vent»). */
const SILENT_ENT = new Set(
  (school.themes as Array<{ weeks: Array<Array<{ text?: string; forms?: string[] } | string>> }>).flatMap((t) =>
    t.weeks.flat().flatMap((e) => (typeof e === 'object' && /^(ils|elles)\b/.test(e.text ?? '') ? (e.forms ?? []).filter((f) => f.endsWith('ent')) : [])),
  ),
);
export const silentEnt = (word: string) => SILENT_ENT.has(word.normalize('NFC').toLowerCase());
const crosses = (vals: number[], unit: number) => vals.some((v, i) => i > 0 && Math.floor(v / unit) !== Math.floor((vals[i - 1] as number) / unit));

function addSubTags(x: number, y: number, plus: boolean): string[] {
  const t = [plus ? 'addition' : 'soustraction'];
  const u = (n: number) => n % 10;
  const d = (n: number) => Math.floor(n / 10) % 10;
  // «retenue/emprunt» is column arithmetic with two numbers of 2 digits or more; 8 + 5 or 28 + 5 is bridging
  // through ten (mental math), a different skill for the model
  const columns = Math.min(x, y) >= 10;
  if (plus) {
    if (u(x) + u(y) >= 10) t.push(columns ? 'retenue' : 'calcul-passage-dizaine');
    if (Math.max(x, y) >= 100 && d(x) + d(y) + (u(x) + u(y) >= 10 ? 1 : 0) >= 10) t.push('retenue-centaine');
  } else {
    if (u(x) < u(y)) t.push(columns ? 'emprunt' : 'calcul-passage-dizaine');
    if (x >= 100 && d(x) - (u(x) < u(y) ? 1 : 0) < d(y)) t.push('emprunt-centaine');
  }
  const top = Math.max(x, y, plus ? x + y : x - y);
  if (top >= 1000) t.push('nombres-4-chiffres');
  else if (top >= 100) t.push('nombres-3-chiffres');
  return t;
}

function stepTags(vals: number[]): string[] {
  const step = (vals[1] ?? 0) - (vals[0] ?? 0);
  const a = Math.abs(step);
  const t: string[] = [];
  if (step < 0) t.push('suite-decroissante');
  t.push(a <= 2 ? 'bonds-1-2' : a === 5 || a === 10 ? 'bonds-5-10' : a <= 4 ? 'bonds-3-4' : 'grands-bonds');
  if (crosses(vals, 100)) t.push('passage-centaine');
  if (vals.some((v) => v >= 1000)) t.push('nombres-4-chiffres');
  else if (vals.some((v) => v >= 100)) t.push('nombres-3-chiffres');
  return t;
}

export function spellingTags(word: string): string[] {
  const w = word.normalize('NFC');
  const t: string[] = [];
  const has = (re: RegExp) => re.test(w);
  // nasal = followed by a consonant (other than another n/m) or by the end: «main», «plein»; not «semaine», «reine», «bonne»
  const nasal = (g: string) => new RegExp(`${g}(?![${V}nm])`);
  if (has(/eau/)) t.push('son-eau');
  if (/(ai|ei)/.test(w.replace(new RegExp(`(ai|ei)n(?![${V}n])`, 'g'), ''))) t.push('son-ai-ei');
  if (has(/ou/)) t.push('son-ou');
  if (w !== 'monsieur' && (has(nasal('on')) || has(/om[bp]/))) t.push('son-on');
  const enWord = silentEnt(w) ? w.slice(0, -3) : w; // «disent»: the final -ent is silent
  if (has(nasal('an')) || nasal('en').test(enWord) || has(/am[bp]|em[bp]/)) t.push('son-an-en');
  if (has(nasal('in')) || has(/im[bp]/)) t.push('son-in-ain');
  if (has(/oi/)) t.push('son-oi');
  if (has(/eu|œu/)) t.push('son-eu');
  if (has(/ch|gn/)) t.push('son-ch-gn');
  if (has(/qu/)) t.push('son-qu');
  if (has(/[éèêëàâîïôûùü]/)) t.push('accents');
  if (has(/ç/)) t.push('cedille');
  if (silentFinal(w)) t.push('lettre-muette');
  if (has(/(bb|cc|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt)/)) t.push('consonne-double');
  if ([...w].length >= 7) t.push('mot-long');
  return t;
}

/** Tags of an exercise (paper or game). Empty list if there is nothing to learn from it. */
export function tagsOf(ex: ExerciseInstance): string[] {
  const k = ex.questionKey;
  const g = ex.game as Record<string, unknown> | undefined;
  switch (ex.skillId) {
    case 'math.add-sub': {
      if (g && g.game === 'frog-jump') {
        const start = g.start as number;
        const jump = g.jump as number;
        const plus = g.op === '+';
        const t = addSubTags(start, jump, plus);
        if (jump >= 100) t.push('saut-centaines');
        return t;
      }
      const m = /^as-(\d+)([+-])(\d+)$/.exec(k);
      if (!m) return [];
      const t = addSubTags(Number(m[1]), Number(m[3]), m[2] === '+');
      if (/Lila a/.test(ex.statement)) t.push('probleme-ecrit');
      return t;
    }
    case 'math.sequences': {
      const m = /^(?:seq|nt)-(-?\d+)-(-?\d+)/.exec(k);
      if (!m) return [];
      const start = Number(m[1]);
      const step = Number(m[2]);
      return stepTags(Array.from({ length: 6 }, (_, i) => start + i * step));
    }
    case 'math.counting': {
      const m = /^(?:np-(?:line|grid)|cnt)-([\d.]+)-/.exec(k);
      if (!m) return [];
      const vals = (m[1] as string).split('.').map(Number);
      const t: string[] = [];
      if (k.startsWith('np-grid')) t.push('grille-100');
      else {
        const step = (vals[1] ?? 0) - (vals[0] ?? 0);
        if (step < 0) t.push('compte-a-rebours');
        if (Math.abs(step) === 10) t.push('bonds-de-10');
      }
      if (crosses(vals, 10) && !k.startsWith('np-grid')) t.push('passage-dizaine');
      if (crosses(vals, 100)) t.push('passage-centaine');
      if (crosses(vals, 1000)) t.push('passage-millier');
      if (vals.some((v) => v >= 1000)) t.push('nombres-4-chiffres');
      else if (vals.some((v) => v >= 100)) t.push('nombres-3-chiffres');
      return t;
    }
    case 'math.place-value': {
      if (k.startsWith('ac-')) return ['materiel-dizaines', ...((g?.packed as number) > 0 ? ['caisses-fermees'] : [])];
      const n = nums(k)[1] ?? nums(k)[0] ?? 0;
      if (k.startsWith('pv1')) return ['materiel-dizaines'];
      if (k.startsWith('pv2a')) return ['composer-nombre'];
      if (k.startsWith('pv2b')) return ['role-chiffre'];
      if (k.startsWith('pv3')) return ['centaines', 'composer-nombre', ...(innerZero(n) ? ['zero-au-milieu'] : [])];
      // pv4: the zero only matters when the question is precisely the tens digit
      if (k.startsWith('pv4')) return ['centaines', 'role-chiffre', ...(k.endsWith('-dizaines') && innerZero(n) ? ['zero-au-milieu'] : [])];
      if (k.startsWith('pv5a')) return ['centaines', 'echange-dizaines'];
      if (k.startsWith('pv5b')) return ['centaines', 'dizaines-en-tout'];
      if (k.startsWith('pv6')) return ['milliers', ...(/^pv6b/.test(k) && innerZero(n) ? ['zero-au-milieu'] : [])];
      return [];
    }
    case 'math.grouping-tens': {
      if (k.startsWith('ac-missing')) return ['complement-a-10'];
      if (k.startsWith('ac-')) return ['groupe-incomplet', ...((g?.packed as number) > 0 ? ['caisses-fermees'] : [])];
      if (k.startsWith('gt1')) return ['groupes-exacts'];
      if (k.startsWith('gt2')) return ['groupe-incomplet'];
      if (k.startsWith('gt3')) return ['groupe-incomplet', 'deux-etapes'];
      if (k.startsWith('gt4')) return ['groupe-incomplet', 'centaines'];
      if (k.startsWith('gt5')) return ['deux-etapes', 'centaines'];
      if (k.startsWith('gt6')) return ['groupe-incomplet', 'milliers'];
      return [];
    }
    case 'math.representations': {
      // represented value: a number; «308»; or the sum of an expanded form («800 + 20 + 7» = 827, not 800)
      const v = ex.expected.type === 'number' ? ex.expected.value : nums(ex.expected.type === 'word' ? ex.expected.value : '').reduce((a, b) => a + b, 0);
      const d = ex.difficulty;
      if (d === 1 || k.startsWith('rep-dots')) return ['points'];
      if (d === 2) return ['calcul-passage-dizaine'];
      if (d === 3 || k.startsWith('rep-tens')) return ['materiel-dizaines'];
      if (d === 4) {
        const expr = /(\d+) ([+−]) (\d+)/.exec(k);
        if (!expr) return ['calcul-2-chiffres'];
        const t = addSubTags(Number(expr[1]), Number(expr[3]), expr[2] === '+');
        return ['calcul-2-chiffres', ...t.filter((x) => x === 'retenue' || x === 'emprunt')];
      }
      const t = ['forme-decomposee', 'centaines'];
      // only the answer's number (347 in «300 + 40 + 7» has no zero in the middle; the «300» is one of the parts)
      if (innerZero(v)) t.push('zero-au-milieu');
      return t;
    }
    case 'fr.plural': {
      const sing = k.replace(/^(wf|pl)-/, '').replace(/_/g, ' ');
      const entry = words.plural.find((w) => w.singular.slice(w.singular.indexOf(' ') + 1) === sing);
      return entry ? [`pluriel-${entry.rule}`] : [];
    }
    case 'fr.spelling':
      return ex.expected.type === 'word' ? spellingTags(ex.expected.value) : [];
    case 'en.listen-words':
      return listenTags(ex);
    case 'en.commands':
      return commandTags(ex);
    case 'fr.comprehension': {
      const q = ex.statement.trim();
      const t = [
        /^Pourquoi/i.test(q) ? 'question-pourquoi'
          : /^Comment/i.test(q) ? 'question-comment'
            : /^Qui|^Avec qui|^Devant qui/i.test(q) ? 'question-qui'
              : /^Où|^Sur quoi|^Près/i.test(q) ? 'question-ou'
                : /^Quand|^Quel jour|^En quel mois|^Depuis combien/i.test(q) ? 'question-quand'
                  : /^Combien/i.test(q) ? 'question-combien'
                    : 'question-quoi',
      ];
      if (ex.difficulty >= 4) t.push('texte-long');
      if (ex.difficulty >= 6) t.push('inference');
      return t;
    }
    default:
      return [];
  }
}
