import {
  basicNormalize,
  looseNormalize,
  parseIntegers,
  parseSequence,
  stripAccents,
  type EvaluationResult,
  type ExerciseInstance,
} from '@melina/shared';

/**
 * Grades the TRANSCRIPTION CONFIRMED by the parents. It never receives the image.
 * Rules:
 * - numbers: compares integer values (ignores spaces and surrounding text).
 * - sequence: compares the list of numbers in order.
 * - word: case is ignored; accents count when they are part of the skill.
 * - short answer: expected keywords (without accents/punctuation), never exact text equality.
 */
export function evaluate(instance: ExerciseInstance, confirmedText: string): EvaluationResult {
  const exp = instance.expected;
  const raw = confirmedText ?? '';
  let correct = false;
  let normalized = basicNormalize(raw);
  let display = '';
  let accentOnly = false;

  switch (exp.type) {
    case 'number': {
      const nums = parseIntegers(raw);
      normalized = nums.length ? String(nums[nums.length - 1]) : normalized;
      // Accepts "37" or "= 37"; if there are several numbers (traces of reasoning), the last one counts.
      correct = nums.length > 0 && nums[nums.length - 1] === exp.value;
      display = String(exp.value);
      break;
    }
    case 'sequence': {
      const nums = parseSequence(raw, exp.values.length);
      normalized = nums.join(',');
      correct = nums.length === exp.values.length && nums.every((n, i) => n === exp.values[i]);
      display = exp.values.join(', ');
      break;
    }
    case 'word': {
      const ans = basicNormalize(raw).replace(/[.!?]+$/, '');
      const base = [exp.value, ...(exp.alternatives ?? [])].map((t) => basicNormalize(t));
      // reformed spelling (1990, accepted in Québec): no circumflex on î and û («traineau», «boite»),
      // except where it distinguishes words (sûr/sur, dû/du, mûr/mur, jeûne/jeune)
      const targets = [...base, ...base.filter((t) => !RECTIF_KEEP.has(t)).map((t) => t.replace(/î/g, 'i').replace(/û/g, 'u'))];
      normalized = ans;
      correct = targets.includes(ans);
      if (!correct && exp.accentsMatter) {
        accentOnly = targets.some((t) => stripAccents(t) === stripAccents(ans));
      } else if (!correct && !exp.accentsMatter) {
        correct = targets.some((t) => stripAccents(t) === stripAccents(ans));
      }
      display = exp.value;
      break;
    }
    case 'short-text': {
      const ans = ` ${numbersAsDigits(looseNormalize(raw))} `;
      normalized = ans.trim();
      correct = exp.variants.some((keywords) =>
        keywords.every((k) => {
          const key = numbersAsDigits(looseNormalize(k));
          // keyword as the start of a word (accepts plural/feminine: "dent" → "dents"); whole number: «2» does not match «20»
          return new RegExp(`(^|\\s)${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${/\d$/.test(key) ? '(?!\\d)' : ''}`).test(ans);
        }),
      );
      display = exp.display;
      break;
    }
  }

  if (correct) return { result: 'correct', normalizedAnswer: normalized, correctAnswerDisplay: display };

  const known = instance.commonErrors.find((e) => basicNormalize(e.match).replace(/\s/g, '') === normalized.replace(/\s/g, ''));
  if (known) return { result: 'incorrect', normalizedAnswer: normalized, errorType: known.type, errorMessage: known.message, correctAnswerDisplay: display };
  if (accentOnly)
    return { result: 'incorrect', normalizedAnswer: normalized, errorType: 'accent', errorMessage: 'Presque! Regarde bien les accents.', correctAnswerDisplay: display };
  if (normalized.length === 0)
    return { result: 'incorrect', normalizedAnswer: normalized, errorType: 'sans-reponse', correctAnswerDisplay: display };
  return { result: 'incorrect', normalizedAnswer: normalized, correctAnswerDisplay: display };
}

/** Spelled-out numbers become digits («deux» = «2»), on both sides of the comparison. «un/une» stay (they are articles). */
const NUMBER_WORDS: Array<[RegExp, string]> = [
  [/\bdix sept\b/g, '17'],
  [/\bdix huit\b/g, '18'],
  [/\bdix neuf\b/g, '19'],
  ...(['zero', '', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'] as const)
    .map((w, i) => [new RegExp(`\\b${w}\\b`, 'g'), String(i)] as [RegExp, string])
    .filter((_, i) => i !== 1),
  [/\bvingt\b/g, '20'],
];
function numbersAsDigits(s: string): string {
  return NUMBER_WORDS.reduce((acc, [re, d]) => acc.replace(re, d), s);
}

const RECTIF_KEEP = new Set(['sûr', 'sûre', 'sûrs', 'sûres', 'dû', 'mûr', 'mûre', 'mûrs', 'mûres', 'jeûne', 'jeûnes']);
