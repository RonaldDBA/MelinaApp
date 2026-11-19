import type { Difficulty, SelectionDecision } from '@melina/shared';

/**
 * A model that LEARNS from Melina's answers (local statistical learning, no external AI).
 *
 * For each skill, an Elo/IRT-style logistic model:
 *   chance of a first-try success = σ(ability − level + 0.85 − Σ weight of the exercise's tags)
 * - `ability` (theta): goes up when she succeeds more than the model predicted, goes down when she misses.
 *   With theta = level, the predicted chance is ~70 % (the «challenge zone»).
 * - `weight` of each tag (retenue, son « eau », noms en -ou…): learned only from HER answers.
 *   Positive weight = a point to strengthen (she misses more than the level would explain); negative = a strong point.
 * Each answer is one gradient step (online learning). Everything is recomputed from the history,
 * so it is deterministic, auditable and needs no new table.
 */

export interface LearnEvent {
  skillId: string;
  level: number;
  tags: string[];
  /** 'first' = right on the first try, without help; 'retry' = right after a mistake or with help; 'wrong' = wrong */
  outcome: 'first' | 'retry' | 'wrong';
  /** Local day of the answer («2026-11-17»): a win over a weak point only counts on ANOTHER day. */
  day?: string;
}

export interface TagStat {
  w: number; // learned weight (positive = harder FOR HER)
  n: number; // how many answers with this tag
  levels: number[]; // levels at which this tag has appeared (to reinforce at a level where it exists)
  /** Was a weak point and has not been overcome yet. */
  wasWeak?: boolean;
  /** Last day the tag was weak or had an error: the win needs a day after this one. */
  weakDay?: string;
  /** CONSECUTIVE first-try successes with this tag (an error or help resets it). */
  streak?: number;
}

export interface SkillModel {
  theta: number;
  n: number;
  tags: Record<string, TagStat>;
}

export type LearnerProfile = Record<string, SkillModel>;

const OFFSET = 0.85; // logit of 70 %
const K_THETA = 0.45;
const K_TAG = 0.35;
const SHRINK = 0.97; // each step pulls the weights slightly toward 0: a single answer does not become a «weak point»
const Y: Record<LearnEvent['outcome'], number> = { first: 1, retry: 0.45, wrong: 0 };

export const WEAK = 0.2;
export const STRONG = -0.2;
/**
 * A weak point that is «almost overcome»: the model no longer sees it as weak (weight < 0.2) AND she got the last
 * 4 rounds with the tag right on the first try. (A lower weight threshold does not work: with high ability, the model already predicts
 * the success and each new success barely moves the weight, so the win would be too slow or impossible.)
 */
export const CONQUER_STREAK = 4;
const MIN_TAG_N = 2;

/** Without dates (old model tests), there is no way to require another day. */
const laterDay = (day: string | undefined, since: string | undefined) => day === undefined || since === undefined || day > since;
const nearly = (s: TagStat) => s.w < WEAK && (s.streak ?? 0) >= CONQUER_STREAK;

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function predict(m: SkillModel | undefined, level: number, tags: string[] = []): number {
  const theta = m?.theta ?? 1;
  const w = tags.reduce((s, t) => s + (m?.tags[t]?.w ?? 0), 0);
  return sigmoid(theta - level + OFFSET - w);
}

/** Learns from the whole history, in the order the answers happened. */
export function learnProfile(events: LearnEvent[]): LearnerProfile {
  return roundProfile(learnInto({}, events));
}

/**
 * Continues learning from an UNROUNDED profile (the model is online: applying the new answers
 * to a saved profile gives the same result as recomputing everything). Mutates and returns `profile`.
 */
export function learnInto(profile: LearnerProfile, events: LearnEvent[]): LearnerProfile {
  for (const ev of events) {
    const m = (profile[ev.skillId] ??= { theta: ev.level, n: 0, tags: {} });
    const p = predict(m, ev.level, ev.tags);
    const err = Y[ev.outcome] - p;
    m.theta = Math.max(-1, Math.min(7, m.theta + K_THETA * err));
    for (const t of ev.tags) {
      const s = (m.tags[t] ??= { w: 0, n: 0, levels: [] });
      const wasNearly = s.wasWeak === true && nearly(s); // was already «presque» BEFORE this answer
      // caution: only the tags of THIS answer shrink. Not practising is no proof that she learned
      // (before, a weak point «faded away» and could even be «overcome» just because she answered other things)
      s.w *= SHRINK;
      s.w = Math.max(-2, Math.min(2, s.w - (K_TAG * err) / Math.sqrt(ev.tags.length)));
      s.n += 1;
      if (!s.levels.includes(ev.level)) s.levels.push(ev.level);
      // Research (Taylor & Rohrer; Vlach): success within the same session is misleading. The weak point only counts as overcome
      // with a first-try success on ANOTHER day, after the weight has dropped to ≤ 0.05 («presque!» until then).
      s.streak = ev.outcome === 'first' ? (s.streak ?? 0) + 1 : 0;
      if (s.n >= MIN_TAG_N && s.w >= WEAK) {
        s.wasWeak = true;
        s.weakDay = ev.day;
      } else if (s.wasWeak && ev.outcome !== 'first') s.weakDay = ev.day;
      else if (s.wasWeak && wasNearly && ev.outcome === 'first' && laterDay(ev.day, s.weakDay)) s.wasWeak = false;
    }
    m.n += 1;
  }
  return profile;
}

/** Rounded copy (3 decimals) for display and decisions; the saved profile stays unrounded. */
export function roundProfile(profile: LearnerProfile): LearnerProfile {
  const out: LearnerProfile = {};
  for (const [id, m] of Object.entries(profile)) {
    out[id] = {
      theta: r3(m.theta),
      n: m.n,
      tags: Object.fromEntries(Object.entries(m.tags).map(([t, s]) => [t, { ...s, w: r3(s.w), levels: [...s.levels] }])),
    };
  }
  return out;
}


export function weakTags(m: SkillModel | undefined): string[] {
  return Object.entries(m?.tags ?? {})
    .filter(([, s]) => s.n >= MIN_TAG_N && s.w >= WEAK)
    .sort((a, b) => b[1].w - a[1].w)
    .map(([t]) => t);
}

export function strongTags(m: SkillModel | undefined): string[] {
  return Object.entries(m?.tags ?? {})
    .filter(([, s]) => s.n >= MIN_TAG_N && s.w <= STRONG)
    .sort((a, b) => a[1].w - b[1].w)
    .map(([t]) => t);
}

/** Level at which she succeeds ~70 % of the time, according to the model (may exceed the official level). */
export function comfortableLevel(m: SkillModel | undefined, maxLevel: number): number {
  if (!m) return 1;
  return Math.max(1, Math.min(maxLevel, Math.floor(m.theta + 1e-9)));
}

/** One answer of TODAY's practice of a skill, in order (for the session staircase). */
export interface DayAnswer {
  difficulty: number;
  correct: boolean;
  help: 'none' | 'hint' | 'adult';
}

/** First-try successes in a row, at the session level, that take the session one level up. */
export const CLIMB_AFTER = 3;

/**
 * SESSION STAIRCASE (research: adaptive "up-down" staircase, Levitt 1971; difficulty that follows the child, so she is
 * neither bored nor lost): within the same day, the play level goes up one step after `CLIMB_AFTER` first-try successes
 * in a row at that level, and down one step after an answer not found on the first try (never below the official level). A 3-up/1-down staircase
 * settles where she succeeds about 80 % of the time, near the "85 % rule" for learning (Wilson et al., 2019).
 * The official level (the report, the flowers) still only moves with confirmation on another day: this is the level of
 * PLAY, which no longer waits for tomorrow when she gets everything right today.
 * `start` = where today begins (the official level, or the level already proven and waiting for confirmation).
 */
export function sessionLevel(answers: DayAnswer[], start: number, floor: number, maxLevel: number, up = CLIMB_AFTER): { level: number; streak: number } {
  let level = Math.max(floor, Math.min(maxLevel, start));
  let streak = 0;
  for (const a of answers) {
    if (!a.correct || a.help !== 'none') {
      // not found on the first try (an error, or right only after a retry/hint): one step down
      level = Math.max(floor, level - 1);
      streak = 0;
    } else if (a.difficulty >= level) {
      streak += 1;
      if (streak >= up && level < maxLevel) {
        level += 1;
        streak = 0;
      }
    }
    // a first-try success BELOW the session level (reinforcement, review) neither climbs nor breaks the streak
  }
  return { level, streak };
}

export interface RoundPlan {
  mode: 'standard' | 'reinforce' | 'explore';
  level: Difficulty;
  focus: string[]; // targeted tags
  prefer?: (tags: string[]) => number;
  reasonCode: SelectionDecision['reasonCode'];
  reason: string; // in French (shown in the parents' history)
  predicted: number; // predicted chance of a first-try success
}

/**
 * Plan for a skill's next round:
 * - REINFORCE (weak point): an exercise with the tags she misses most, at the current level
 *   (one level lower if the predicted chance is very low, so she does not get discouraged);
 * - EXPLORE (strong point): one level above the official one when the model predicts ≥ 55 % success, even
 *   beyond what school asks, avoiding the weak points so that the challenge is only the new material;
 * - STANDARD: everything else.
 * `roll` (0 to 1) comes from the round's seed: the choice is reproducible.
 */
export function planRound(
  profile: LearnerProfile,
  skillId: string,
  officialLevel: Difficulty,
  maxLevel: Difficulty,
  roll: number,
  labels: Record<string, string> = {},
  opts: { allowExplore?: boolean; pendingLevel?: Difficulty | null; sessionLevel?: number } = {},
): RoundPlan {
  const m = profile[skillId];
  const name = (t: string) => labels[t] ?? t;
  // the session staircase (sessionLevel) replaces the official level as the base of today's rounds when it is higher
  const climbed = opts.allowExplore !== false && (opts.sessionLevel ?? 0) > officialLevel ? (Math.min(maxLevel, opts.sessionLevel as number) as Difficulty) : null;
  const base = climbed ?? officialLevel;
  const standard: RoundPlan = climbed
    ? {
        mode: 'explore',
        level: climbed,
        focus: [],
        reasonCode: 'learner-explore',
        reason: `Elle réussit tout aujourd’hui : la séance monte au niveau ${climbed} (${CLIMB_AFTER} réussites de suite sans aide = un niveau de plus; niveau officiel ${officialLevel}, confirmé un autre jour).`,
        predicted: predict(m, climbed),
      }
    : { mode: 'standard', level: officialLevel, focus: [], reasonCode: 'learner-standard', reason: '', predicted: predict(m, officialLevel) };
  if (!m || m.n < 4) return standard; // still getting to know the child

  const weak = weakTags(m);
  const strong = strongTags(m);
  const above = Math.min(maxLevel, base + 1) as Difficulty;
  const pAbove = predict(m, above, []);
  const pHere = predict(m, base, []);

  /** Reinforcement of the weak point, at the level she is really at (the official one or the model's comfortable level, whichever is higher). */
  const reinforce = (): RoundPlan => {
    const focus = weak.slice(0, 2);
    // the weak point must exist at the chosen level (e.g. level 5 of the grenouille has no carrying in the units)
    // after consecutive errors (exploration off), reinforcement stays at the official level: it does not go back up,
    // exactly where she just made mistakes
    const cap = opts.allowExplore === false ? base : Math.max(base, comfortableLevel(m, maxLevel));
    const seen = (m.tags[focus[0] as string]?.levels ?? []).filter((l) => l <= cap);
    let level = (seen.length ? Math.max(...seen) : base) as Difficulty;
    if (predict(m, level, focus) < 0.35 && level > 1) level = (level - 1) as Difficulty;
    return {
      mode: 'reinforce',
      level,
      focus,
      prefer: (tags) => tags.filter((t) => focus.includes(t)).length * 2 + tags.filter((t) => weak.includes(t)).length * 0.5,
      reasonCode: 'learner-reinforce',
      reason: `Renforcement ciblé : ${focus.map(name).join(', ')}${level < base ? ` (niveau ${level}, pour reprendre confiance)` : ''}.`,
      predicted: predict(m, level, focus),
    };
  };

  // 1) Known weak point: ~half of the rounds reinforce it (priority, even when she is «bored»)
  if (weak.length && roll < 0.5) return reinforce();

  // 2) Level-up ready, waiting for confirmation on another day: today she already gets a taste of the next level («avant-goût»).
  //    With the session staircase (sessionLevel given), the staircase already starts the day at the proven level and
  //    goes down after misses: the avant-goût must not jump back above it.
  const pl = opts.sessionLevel === undefined ? opts.pendingLevel : null;
  if (opts.allowExplore !== false && pl && pl > base && predict(m, pl, []) >= 0.4 && roll < 0.8) {
    return {
      mode: 'explore',
      level: pl,
      focus: strong.slice(0, 2),
      prefer: (tags) => tags.filter((t) => strong.includes(t)).length * 0.5 - tags.filter((t) => weak.includes(t)).length,
      reasonCode: 'learner-explore',
      reason: `Avant-goût du niveau ${pl} (montée à confirmer lors d’une prochaine séance).`,
      predicted: predict(m, pl, []),
    };
  }

  // 3) Too easy (≥ 85 %) or an exploration draw: try the level above when the model thinks she can
  //    (once the session staircase has climbed, only when it is still too easy: the staircase already follows her)
  const bored = pHere >= 0.85;
  if (opts.allowExplore !== false && above > base && pAbove >= 0.55 && (bored || (!climbed && roll < 0.75))) {
    return {
      mode: 'explore',
      level: above,
      focus: strong.slice(0, 2),
      prefer: (tags) => tags.filter((t) => strong.includes(t)).length * 0.5 - tags.filter((t) => weak.includes(t)).length,
      reasonCode: 'learner-explore',
      reason: `Exploration d’un point fort : essai au niveau ${above} (réussite prévue ${Math.round(pAbove * 100)} %)${strong.length ? ` — points forts : ${strong.slice(0, 2).map(name).join(', ')}` : ''}.`,
      predicted: pAbove,
    };
  }

  // 4) Still a weak point: reinforcement for most of the rest too
  if (weak.length && roll < 0.9) return reinforce();
  return standard;
}

/**
 * Tags that were a weak point before an answer and were overcome with it
 * (the weight dropped from ≥ 0.2, at some point, to ≤ 0.05).
 */
export function conqueredTags(before: SkillModel | undefined, after: SkillModel | undefined): string[] {
  if (!before || !after) return [];
  return Object.entries(after.tags)
    .filter(([t, s]) => before.tags[t]?.wasWeak === true && !s.wasWeak)
    .map(([t]) => t);
}

/** Weak points that are no longer weak and have 4 first-try successes in a row: they wait for another day («presque!»). */
export function almostTags(m: SkillModel | undefined): string[] {
  return Object.entries(m?.tags ?? {})
    .filter(([, s]) => s.wasWeak === true && nearly(s))
    .map(([t]) => t);
}
