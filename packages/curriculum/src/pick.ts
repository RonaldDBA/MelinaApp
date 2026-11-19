import type { ExerciseInstance } from '@melina/shared';
import { tagsOf } from './tags';

/** How many candidates to draw when the engine has a preference. */
export const CANDIDATES = 12;

/** Among the candidates that do not repeat recent rounds, the one with the highest score (tie: the first one drawn). */
export function pickPreferred(make: (seed: number) => ExerciseInstance, seed: number, avoidKeys: string[], prefer?: (tags: string[]) => number): ExerciseInstance {
  let best: ExerciseInstance | undefined;
  let bestScore = -Infinity;
  let fallback: ExerciseInstance | undefined;
  const tries = prefer ? CANDIDATES : 25;
  for (let attempt = 0; attempt < tries + 25; attempt++) {
    const s = (seed + attempt * 7919) >>> 0;
    const ex = make(s);
    fallback ??= ex;
    if (avoidKeys.includes(ex.questionKey)) continue;
    if (!prefer) return ex;
    const score = prefer(tagsOf(ex));
    if (score > bestScore) {
      best = ex;
      bestScore = score;
    }
    if (attempt + 1 >= tries && best) break;
  }
  return best ?? (fallback as ExerciseInstance);
}
