import type { Difficulty, HelpLevel, MasteryState, SelectionDecision, SkillDefinition } from '@melina/shared';

/**
 * Deterministic adaptive engine (no AI). Every decision carries a readable reason.
 * Initial parameters, to be validated with real use (see docs/adaptive-engine.md).
 */
export interface EngineParams {
  reviewIntervalsDays: number[]; // spaced review after positive evidence
  masteredIntervalsDays: number[]; // after the normal intervals, only for what is already mastered
  masteredEstimate: number; // estimate from which the skill counts as mastered
  advanceAfterIndependentStreak: number; // consecutive independent successes to leave level 1 (foundation confirmed)
  advanceStreakAbove: number; // above level 1: consecutive independent successes to go up again (look for the limit)
  reinforceAfterErrors: number; // consecutive errors to go down a level
  gainIndependent: number;
  gainWithHint: number;
  gainWithAdult: number;
  lossOnError: number;
  evidenceForFullConfidence: number;
  prerequisiteMinEstimate: number;
}

export const defaultParams: EngineParams = {
  reviewIntervalsDays: [1, 2, 4, 7],
  masteredIntervalsDays: [14, 30],
  masteredEstimate: 0.8,
  advanceAfterIndependentStreak: 3,
  advanceStreakAbove: 2,
  reinforceAfterErrors: 2,
  gainIndependent: 0.15,
  gainWithHint: 0.06,
  gainWithAdult: 0.02,
  lossOnError: 0.12,
  evidenceForFullConfidence: 8,
  prerequisiteMinEstimate: 0.35,
};

/** Local midnight, `days` days after `d`: the review is due on the scheduled DAY, at any hour (and with no DST error). */
/** «2026-11-17» in local time, to compare days. */
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayStart = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).toISOString();
const round = (n: number) => Math.round(n * 1000) / 1000;

export function initialState(skillId: string): MasteryState {
  return {
    skillId,
    estimate: 0,
    level: 1,
    evidenceCount: 0,
    independentStreak: 0,
    consecutiveErrors: 0,
    helpCount: 0,
    recent: [],
    lastPracticedAt: null,
    nextReviewAt: null,
    reviewStep: 0,
    confidence: 0,
    lastChangeReason: 'Aucun historique.',
  };
}

export interface Evidence {
  correct: boolean;
  help: HelpLevel;
  difficulty: Difficulty;
  at: Date;
}

/**
 * Updates mastery with ONE valid piece of learning evidence.
 * An illegible or cancelled reading NEVER gets here (guaranteed on the server and tested).
 * The parents correcting the reading is not "help": only `help` counts.
 */
export function applyEvidence(prev: MasteryState, ev: Evidence, p: EngineParams = defaultParams, maxLevel: Difficulty = 3): MasteryState {
  const s: MasteryState = { ...prev, recent: [...prev.recent], lastLevelChange: null };
  s.evidenceCount += 1;
  // A paper sheet from a DAY BEFORE the last practice (the parents confirmed it later): it counts as information about
  // her (estimate), but does not touch the present: no streak, no level-up, no level-down, no review.
  if (prev.lastPracticedAt && dayKey(ev.at) < dayKey(new Date(prev.lastPracticedAt))) {
    const w = ev.difficulty >= s.level ? 1 : 0.5;
    if (ev.correct) {
      const gain = ev.help === 'none' ? p.gainIndependent : ev.help === 'hint' ? p.gainWithHint : p.gainWithAdult;
      s.estimate = round(s.estimate + gain * w * (1 - s.estimate));
    } else s.estimate = round(Math.max(0, s.estimate - p.lossOnError * w * s.estimate));
    if (ev.help !== 'none') s.helpCount += 1;
    s.recent = [...s.recent, { correct: ev.correct, help: ev.help, at: ev.at.toISOString() }].sort((a, b) => a.at.localeCompare(b.at)).slice(-8);
    s.confidence = round(Math.min(1, s.evidenceCount / p.evidenceForFullConfidence));
    s.lastChangeReason = `Réponse sur papier d’un jour précédent (${ev.correct ? 'réussie' : 'à revoir'}) : estimation ajustée, niveau et révisions inchangés.`;
    return s;
  }
  // a paper sheet confirmed later may carry an EARLIER date: dates never move backward
  const later = (a: string | null | undefined) => (a && new Date(a).getTime() > ev.at.getTime() ? a : ev.at.toISOString());
  s.lastPracticedAt = later(prev.lastPracticedAt);
  s.recent = [...s.recent, { correct: ev.correct, help: ev.help, at: ev.at.toISOString() }].sort((a, b) => a.at.localeCompare(b.at)).slice(-8);
  if (ev.help !== 'none') s.helpCount += 1;

  // Evidence at a level below the current one weighs less.
  const levelWeight = ev.difficulty >= s.level ? 1 : 0.5;
  const reasons: string[] = [];

  if (ev.correct) {
    const gain = ev.help === 'none' ? p.gainIndependent : ev.help === 'hint' ? p.gainWithHint : p.gainWithAdult;
    s.estimate = round(s.estimate + gain * levelWeight * (1 - s.estimate));
    s.consecutiveErrors = 0;
    if (ev.help === 'none') {
      s.independentStreak += 1;
      // Spacing by DAYS: the review step goes up at most once per day (several successes in the same
      // session do not push the review far away). 14 and 30 days only for what is already mastered.
      const mastered = s.estimate >= p.masteredEstimate;
      const steps = mastered ? [...p.reviewIntervalsDays, ...p.masteredIntervalsDays] : p.reviewIntervalsDays;
      const len = steps.length;
      // the step only goes up with a first-try success on a day it has not gone up yet (a success with a hint does not count)
      const stepUp = s.reviewStep === 0 || !s.reviewStepAt || dayKey(ev.at) > dayKey(new Date(s.reviewStepAt));
      const idx = Math.min(stepUp ? s.reviewStep : Math.max(0, s.reviewStep - 1), len - 1);
      const days = steps[idx] ?? 1;
      if (stepUp) {
        // without mastery, the step stops at the last normal interval: once mastered, the next one is 14 (not 30)
        s.reviewStep = Math.min(s.reviewStep + 1, len);
        s.reviewStepAt = later(s.reviewStepAt);
      }
      s.nextReviewAt = dayStart(ev.at, days);
      reasons.push(`Réussite autonome (+${round(gain * levelWeight)}); révision dans ${days} jour(s).`);
      // Foundation (level 1) confirmed with 3 successes in a row; after that, 2 are enough: the app climbs until it finds her limit,
      // and 2 errors in a row bring it back down one level.
      // A level-up is only confirmed in a session on ANOTHER day (research recommendation: mastery is confirmed
      // after an interval). On the same day, the learning model keeps giving «avant-goûts» of the next level.
      const need = s.level === 1 ? p.advanceAfterIndependentStreak : p.advanceStreakAbove;
      const pending = s.pendingAdvance;
      // confirm only with evidence from a day AFTER the pending level-up (not with a sheet done before it)
      if (pending && dayKey(ev.at) > dayKey(new Date(pending.since)) && ev.difficulty >= s.level) {
        // confirms up to the level of THIS answer (at least one level more): a level-1 answer does not confirm level 5;
        // the rest stays pending, and a harder success later the same day confirms it
        const reached = Math.min(pending.level, Math.max(s.level + 1, ev.difficulty)) as Difficulty;
        s.level = reached;
        s.pendingAdvance = reached < pending.level ? { level: pending.level, since: pending.since, climb: null } : null;
        s.independentStreak = 0;
        s.lastLevelChange = 'advanced';
        // new level (already confirmed on 2 different days): review in 4 days, instead of inheriting 7 to 30 days from the previous
        // level. Restarting at 1 day would leave the skill always «due», jumping ahead of the others.
        s.reviewStep = Math.min(s.reviewStep, 3);
        s.reviewStepAt = later(s.reviewStepAt);
        s.nextReviewAt = dayStart(ev.at, p.reviewIntervalsDays[Math.max(0, s.reviewStep - 1)] ?? 1);
        reasons.push(`Niveau ${s.level} confirmé lors d’une nouvelle séance, un autre jour.`);
      } else if (!pending && s.independentStreak >= need && s.level < maxLevel) {
        s.pendingAdvance = { level: (s.level + 1) as Difficulty, since: ev.at.toISOString() };
        s.independentStreak = 0;
        s.nextReviewAt = dayStart(ev.at, 1); // comes back tomorrow to confirm
        reasons.push(`Prête pour le niveau ${s.level + 1} après ${need} réussites autonomes : à confirmer lors d’une prochaine séance, un autre jour.`);
      } else if (pending && ev.difficulty > pending.level) {
        // she is already succeeding ABOVE the pending level (the session climbs with her): after `advanceStreakAbove`
        // first-try successes in a row at that level, it becomes the level to confirm
        const n = pending.climb?.level === ev.difficulty ? pending.climb.n + 1 : 1;
        const top = Math.min(maxLevel, ev.difficulty) as Difficulty;
        if (n >= p.advanceStreakAbove && top > pending.level) {
          s.pendingAdvance = { level: top, since: pending.since, climb: null };
          reasons.push(`Niveau ${top} réussi ${n} fois de suite sans aide : c’est ce niveau qui sera confirmé lors d’une prochaine séance.`);
        } else s.pendingAdvance = { ...pending, climb: { level: top, n } };
      }
      // pending level-up: the next review is tomorrow, to confirm the new level
      if (s.pendingAdvance) s.nextReviewAt = new Date(Math.min(new Date(s.nextReviewAt).getTime(), new Date(dayStart(ev.at, 1)).getTime())).toISOString();
      if (s.lastLevelChange === 'advanced' || s.pendingAdvance) {
        /* already handled */
      } else if (s.independentStreak >= need && s.level >= maxLevel) {
        reasons.push(`Niveau maximum (${maxLevel}) réussi de façon autonome.`);
      }
    } else {
      // A success with help does not count toward advancing nor push the review far away.
      s.independentStreak = 0;
      if (s.pendingAdvance?.climb) s.pendingAdvance = { ...s.pendingAdvance, climb: null };
      s.nextReviewAt = dayStart(ev.at, 1);
      reasons.push(`Réussite avec aide (${ev.help === 'hint' ? 'indice' : 'adulte'}) — poids moindre, pas de montée de niveau.`);
    }
  } else {
    // an error on an item ABOVE her level (exploration, the session climbing, avant-goût) is the price of looking for
    // her limit: half the loss, no level-down, and the review schedule of what she does know stays
    const above = ev.difficulty > s.level;
    s.estimate = round(Math.max(0, s.estimate - p.lossOnError * (above ? 0.5 : levelWeight) * s.estimate));
    s.independentStreak = 0;
    if (!above) {
      s.consecutiveErrors += 1;
      s.reviewStep = 0;
      s.nextReviewAt = ev.at.toISOString(); // becomes available again for reinforcement
      reasons.push('Réponse incorrecte — renforcement prévu.');
    } else reasons.push(`Réponse incorrecte au niveau ${ev.difficulty}, au-dessus de son niveau ${s.level} : c’est sa limite pour l’instant.`);
    const pend = s.pendingAdvance;
    if (pend) {
      if (ev.difficulty > pend.level) s.pendingAdvance = { ...pend, climb: null }; // above what is pending: nothing to undo
      else if (ev.difficulty - 1 > s.level) {
        // she showed up to the level below this error: that is what stays pending
        s.pendingAdvance = { level: (ev.difficulty - 1) as Difficulty, since: pend.since, climb: null };
        reasons.push(`Montée ramenée au niveau ${ev.difficulty - 1}, à confirmer.`);
      } else {
        s.pendingAdvance = null;
        reasons.push('Montée de niveau à reconfirmer.');
      }
    }
    if (s.consecutiveErrors >= p.reinforceAfterErrors && s.level > 1) {
      s.level = (s.level - 1) as Difficulty;
      s.consecutiveErrors = 0;
      s.lastLevelChange = 'lowered';
      reasons.push(`Niveau abaissé à ${s.level} après ${p.reinforceAfterErrors} erreurs consécutives.`);
    }
  }
  s.confidence = round(Math.min(1, s.evidenceCount / p.evidenceForFullConfidence));
  s.lastChangeReason = reasons.join(' ');
  return s;
}

export interface SelectionInput {
  skills: SkillDefinition[]; // candidates (already filtered by subject)
  states: Record<string, MasteryState | undefined>;
  now: Date;
  lastSkillId?: string | null; // last skill presented (variety)
  allStates?: Record<string, MasteryState | undefined>; // for prerequisites from another subject
  params?: EngineParams;
}

function prerequisitesOk(skill: SkillDefinition, all: Record<string, MasteryState | undefined>, p: EngineParams): boolean {
  return skill.prerequisites.every((pre) => {
    const st = all[pre];
    // Not enough evidence: does not block (we are still finding the level).
    if (!st || st.evidenceCount < 3) return true;
    return st.estimate >= p.prerequisiteMinEstimate;
  });
}

/**
 * Picks the next skill and difficulty. Priority:
 * 1) reinforcement after a recent error; 2) review due; 3) first contact; 4) practice of the weakest skill.
 * Avoids repeating the same skill right away when there is an alternative.
 */
export function selectNext(input: SelectionInput): SelectionDecision {
  const p = input.params ?? defaultParams;
  const all = input.allStates ?? input.states;
  const candidates = input.skills.filter((s) => prerequisitesOk(s, all, p));
  const pool = candidates.length ? candidates : input.skills;
  if (pool.length === 0) throw new Error('Aucune compétence disponible.');

  const varied = (list: SkillDefinition[]) => {
    const others = list.filter((s) => s.id !== input.lastSkillId);
    return others.length ? others : list;
  };
  const stateOf = (id: string) => input.states[id];

  const reinforcement = pool.filter((s) => (stateOf(s.id)?.consecutiveErrors ?? 0) > 0);
  if (reinforcement.length) {
    const skill = varied(reinforcement)[0] as SkillDefinition;
    const st = stateOf(skill.id) as MasteryState;
    return { skillId: skill.id, difficulty: st.level, reasonCode: 'reinforcement', reason: 'Renforcement après une difficulté récente.' };
  }

  const due = pool
    .filter((s) => {
      const st = stateOf(s.id);
      return st && st.nextReviewAt && new Date(st.nextReviewAt).getTime() <= input.now.getTime();
    })
    .sort((a, b) => new Date(stateOf(a.id)?.nextReviewAt ?? 0).getTime() - new Date(stateOf(b.id)?.nextReviewAt ?? 0).getTime());
  if (due.length) {
    const skill = varied(due)[0] as SkillDefinition;
    const st = stateOf(skill.id) as MasteryState;
    // The structured field decides; the text is only read in old states, saved before the field existed
    // (in Portuguese, «Avanço», or in the first French versions).
    const advancedNow = st.lastLevelChange !== undefined ? st.lastLevelChange === 'advanced' : /Avanço|Passage au niveau/.test(st.lastChangeReason);
    const justAdvanced = st.independentStreak === 0 && st.recent.at(-1)?.correct === true && st.recent.at(-1)?.help === 'none' && advancedNow;
    return justAdvanced
      ? { skillId: skill.id, difficulty: st.level, reasonCode: 'advance', reason: `Passage au niveau supérieur après des réussites autonomes (niveau ${st.level}).` }
      : { skillId: skill.id, difficulty: st.level, reasonCode: 'review-due', reason: 'Révision prévue.' };
  }

  const fresh = pool.filter((s) => !stateOf(s.id) || stateOf(s.id)?.evidenceCount === 0);
  if (fresh.length) {
    const skill = varied(fresh)[0] as SkillDefinition;
    return { skillId: skill.id, difficulty: 1, reasonCode: 'first-contact', reason: 'Premier contact avec cette compétence (niveau d’introduction).' };
  }

  const weakest = [...varied(pool)].sort((a, b) => {
    const sa = stateOf(a.id) as MasteryState;
    const sb = stateOf(b.id) as MasteryState;
    if (sa.estimate !== sb.estimate) return sa.estimate - sb.estimate;
    return (sa.lastPracticedAt ?? '').localeCompare(sb.lastPracticedAt ?? '');
  })[0] as SkillDefinition;
  const st = stateOf(weakest.id) as MasteryState;
  return { skillId: weakest.id, difficulty: st.level, reasonCode: 'practice', reason: `Pratique de la compétence la moins consolidée (estimation ${st.estimate}).` };
}

export function parentChoice(skillId: string, state: MasteryState | undefined, difficulty?: Difficulty): SelectionDecision {
  return {
    skillId,
    difficulty: difficulty ?? state?.level ?? 1,
    reasonCode: 'parent-choice',
    reason: 'Choix manuel des parents.',
  };
}

export * from './learner';
export * from './words';
