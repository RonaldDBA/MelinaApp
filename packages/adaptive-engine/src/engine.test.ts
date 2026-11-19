import { describe, expect, it } from 'vitest';
import { applyEvidence, defaultParams, initialState, selectNext, type Evidence } from './index';
import type { Difficulty, MasteryState, SkillDefinition } from '@melina/shared';

const skill = (id: string, prerequisites: string[] = []): SkillDefinition => ({
  id,
  version: 1,
  subject: 'mathematics',
  cycle: 1,
  grade: 2,
  title: id,
  titleFr: id,
  description: '',
  prerequisites,
  exerciseTypes: [],
  levels: { '1': '', '2': '', '3': '' },
  curriculumRef: '',
  reviewStatus: 'to-validate',
});

const at = new Date('2026-11-17T15:00:00Z');
const tomorrow = new Date('2026-11-18T15:00:00Z');
const ev = (correct: boolean, help: Evidence['help'] = 'none', difficulty: 1 | 2 | 3 = 1): Evidence => ({ correct, help, difficulty, at });

describe('applyEvidence', () => {
  it('an independent success weighs more than a success with help', () => {
    const a = applyEvidence(initialState('x'), ev(true, 'none'));
    const b = applyEvidence(initialState('x'), ev(true, 'hint'));
    const c = applyEvidence(initialState('x'), ev(true, 'adult'));
    expect(a.estimate).toBeGreaterThan(b.estimate);
    expect(b.estimate).toBeGreaterThan(c.estimate);
    expect(a.independentStreak).toBe(1);
    expect(b.independentStreak).toBe(0);
  });

  it('advancing requires enough independent evidence, confirmed on another day', () => {
    let s = initialState('x');
    s = applyEvidence(s, ev(true));
    s = applyEvidence(s, ev(true));
    expect(s.level).toBe(1);
    s = applyEvidence(s, ev(true, 'hint'));
    expect(s.level).toBe(1); // help resets the streak
    s = applyEvidence(s, ev(true));
    s = applyEvidence(s, ev(true));
    s = applyEvidence(s, ev(true));
    expect(s.level).toBe(1); // ready, but the level-up waits for another day
    expect(s.pendingAdvance?.level).toBe(2);
    expect(new Date(s.nextReviewAt as string).getTime() - at.getTime()).toBeLessThanOrEqual(86400000); // comes back tomorrow
    s = applyEvidence(s, ev(true)); // same day: not yet
    expect(s.level).toBe(1);
    s = applyEvidence(s, { ...ev(true), at: tomorrow });
    expect(s.level).toBe(2);
    expect(s.pendingAdvance).toBeNull();
    expect(s.lastLevelChange).toBe('advanced');
    // new level: review within 4 days (does not inherit 7 to 30 days from the previous level, nor is it due every day)
    const gap = (new Date(s.nextReviewAt as string).getTime() - tomorrow.getTime()) / 86400000;
    expect(gap).toBeGreaterThan(1);
    expect(gap).toBeLessThanOrEqual(4);
  });

  it('missing items ABOVE her level (exploration, avant-goût) cancels the pending level-up but does not drop the level', () => {
    let s: MasteryState = { ...initialState('x'), level: 2 };
    for (let i = 0; i < 2; i++) s = applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at }, defaultParams, 3);
    expect(s.pendingAdvance?.level).toBe(3);
    for (let i = 0; i < 3; i++) s = applyEvidence(s, { correct: false, help: 'none', difficulty: 3, at }, defaultParams, 3);
    expect(s.pendingAdvance).toBeNull(); // the level-up waits for another confirmation
    expect(s.level).toBe(2); // before: it dropped to 1
    // errors at her OWN level still bring it down
    for (let i = 0; i < 2; i++) s = applyEvidence(s, { correct: false, help: 'none', difficulty: 2, at }, defaultParams, 3);
    expect(s.level).toBe(1);
  });

  it('a review is due by local DAY, not the exact hour (a 4 p.m. session picks up the review set at 6 p.m. the day before)', () => {
    const evening = new Date(2026, 10, 17, 18, 0);
    const s = applyEvidence(initialState('x'), { correct: true, help: 'none', difficulty: 1, at: evening });
    const due = new Date(s.nextReviewAt as string);
    expect(due.getTime()).toBeLessThanOrEqual(new Date(2026, 10, 18, 16, 0).getTime());
    expect(due.getDate()).toBe(18);
  });

  it('a success with a hint first in the day does not lock the review step for the rest of the day', () => {
    let s = applyEvidence(initialState('x'), { correct: true, help: 'none', difficulty: 1, at });
    expect(s.reviewStep).toBe(1);
    const d2 = new Date(at.getTime() + 2 * 86400000);
    s = applyEvidence(s, { correct: true, help: 'hint', difficulty: 1, at: d2 });
    s = applyEvidence(s, { correct: true, help: 'none', difficulty: 1, at: new Date(d2.getTime() + 60_000) });
    expect(s.reviewStep).toBe(2); // before: it stayed at 1 all day
  });

  it('a paper sheet dated BEFORE the pending level-up does not confirm it, nor move the last practice date back', () => {
    const d17 = new Date(2026, 10, 17, 18, 0);
    const d18 = new Date(2026, 10, 18, 16, 5);
    let s: MasteryState = { ...initialState('x'), level: 2 };
    for (let i = 0; i < 2; i++) s = applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at: new Date(d18.getTime() + i * 60_000) }, defaultParams, 3);
    expect(s.pendingAdvance?.level).toBe(3);
    const stepBefore = s.reviewStep;
    // in the evening the parents confirm a sheet she finished the DAY BEFORE
    s = applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at: d17 }, defaultParams, 3);
    expect(s.level).toBe(2); // before: «confirmé lors d’une nouvelle séance», with work from before the level-up
    expect(s.pendingAdvance?.level).toBe(3);
    expect(new Date(s.lastPracticedAt as string).getDate()).toBe(18);
    // and a first-try success later on the 18th does not raise the step twice on the same day
    s = applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at: new Date(2026, 10, 18, 19, 0) }, defaultParams, 3);
    expect(s.reviewStep).toBe(stepBefore);
  });

  it('a sheet from DAYS BEFORE (confirmed today) only adjusts the estimate: no level-up, no level-down, no review change', () => {
    const d = (day: number, h = 16) => new Date(2026, 10, day, h, 0);
    let s: MasteryState = { ...initialState('x'), level: 2 };
    s = applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at: d(17) }, defaultParams, 3);
    const next = s.nextReviewAt;
    // old success (the 14th): does not complete the streak nor pull the review into the past
    const s1 = applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at: d(14) }, defaultParams, 3);
    expect(s1.independentStreak).toBe(s.independentStreak);
    expect(s1.pendingAdvance ?? null).toBeNull();
    expect(s1.nextReviewAt).toBe(next);
    expect(s1.estimate).toBeGreaterThan(s.estimate);
    // two old errors (the 9th): do not drop the level nor cancel today's pending level-up
    let s2 = applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at: d(17, 17) }, defaultParams, 3);
    expect(s2.pendingAdvance?.level).toBe(3);
    for (let i = 0; i < 2; i++) s2 = applyEvidence(s2, { correct: false, help: 'none', difficulty: 2, at: d(9) }, defaultParams, 3);
    expect(s2.level).toBe(2);
    expect(s2.pendingAdvance?.level).toBe(3);
    expect(s2.estimate).toBeLessThan(applyEvidence(s, { correct: true, help: 'none', difficulty: 2, at: d(17, 17) }, defaultParams, 3).estimate);
  });

  it('an error before confirmation cancels the pending level-up', () => {
    let s = initialState('x');
    for (let i = 0; i < 3; i++) s = applyEvidence(s, ev(true));
    expect(s.pendingAdvance?.level).toBe(2);
    s = applyEvidence(s, { ...ev(false), at: tomorrow });
    expect(s.pendingAdvance).toBeNull();
    expect(s.level).toBe(1);
  });

  it('after the foundation (3 successes at level 1), 2 successes in a row go up; it goes up to the skill maximum level', () => {
    let s = initialState('x');
    let day = 0;
    const on = (d: number) => new Date(at.getTime() + d * 86400000);
    for (let i = 0; i < 3; i++) s = applyEvidence(s, ev(true), undefined, 5);
    s = applyEvidence(s, { ...ev(true), at: on(++day) }); // confirmation on the next day
    s = { ...s };
    expect(s.level).toBe(2);
    for (const lv of [3, 4, 5] as const) {
      s = applyEvidence(s, { ...ev(true), difficulty: (lv - 1) as 2 | 3 | 4, at: on(day) }, undefined, 5);
      s = applyEvidence(s, { ...ev(true), difficulty: (lv - 1) as 2 | 3 | 4, at: on(day) }, undefined, 5);
      expect(s.level).toBe(lv - 1); // ready, waiting for another day
      s = applyEvidence(s, { ...ev(true), difficulty: (lv - 1) as 2 | 3 | 4, at: on(++day) }, undefined, 5);
      expect(s.level).toBe(lv);
    }
    s = applyEvidence(s, { ...ev(true), difficulty: 5, at: on(day) }, undefined, 5);
    s = applyEvidence(s, { ...ev(true), difficulty: 5, at: on(day) }, undefined, 5);
    expect(s.level).toBe(5);
    expect(s.lastChangeReason).toContain('Niveau maximum (5)');
    // without giving the maximum, it stops at 3 (skills with 3 levels)
    let t: MasteryState = { ...initialState('y'), level: 3 };
    for (let i = 0; i < 4; i++) t = applyEvidence(t, { ...ev(true), difficulty: 3 });
    expect(t.level).toBe(3);
    // errors bring it back: the limit sits where she wavers
    s = applyEvidence(s, { ...ev(false), difficulty: 5, at: on(day) }, undefined, 5);
    s = applyEvidence(s, { ...ev(false), difficulty: 5, at: on(day) }, undefined, 5);
    expect(s.level).toBe(4);
  });

  it('a single attempt defines neither mastery nor inability', () => {
    const ok = applyEvidence(initialState('x'), ev(true));
    expect(ok.level).toBe(1);
    expect(ok.confidence).toBeLessThan(0.5);
    const ko = applyEvidence({ ...initialState('x'), level: 2 }, ev(false, 'none', 2));
    expect(ko.level).toBe(2);
  });

  it('repeated errors trigger reinforcement and a lower level', () => {
    let s: MasteryState = { ...initialState('x'), level: 3, estimate: 0.6 };
    s = applyEvidence(s, ev(false, 'none', 3));
    expect(s.level).toBe(3);
    s = applyEvidence(s, ev(false, 'none', 3));
    expect(s.level).toBe(2);
    expect(s.estimate).toBeLessThan(0.6);
  });

  it('schedules growing spaced review, one step per DAY (several successes in the same session do not push it)', () => {
    let s = initialState('x');
    const gaps: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = applyEvidence(s, ev(true));
      gaps.push(Math.round((new Date(s.nextReviewAt as string).getTime() - at.getTime()) / 86400000));
    }
    // same day: the step does not go up (and the 3rd success leaves the level-up pending, with a review tomorrow)
    expect(gaps).toEqual([1, 1, 1, 1]);
    expect(s.reviewStep).toBe(1);
  });

  it('what is already mastered moves out to 14 then 30 days; the rest stops at 7', () => {
    const maxL = 1 as Difficulty; // no pending level-up in the way: spacing only
    const run = (estimate: number) => {
      let s: MasteryState = { ...initialState('x'), estimate };
      const gaps: number[] = [];
      for (let d = 0; d < 7; d++) {
        const when = new Date(at.getTime() + d * 3 * 86400000);
        s = applyEvidence(s, { correct: true, help: 'none', difficulty: 1, at: when }, defaultParams, maxL);
        s = { ...s, estimate }; // isolates the threshold rule
        gaps.push(Math.round((new Date(s.nextReviewAt as string).getTime() - when.getTime()) / 86400000));
      }
      return gaps;
    };
    expect(run(0.5)).toEqual([1, 2, 4, 7, 7, 7, 7]);
    expect(run(0.9)).toEqual([1, 2, 4, 7, 14, 30, 30]);
  });

  it('once mastered after several days at 7, the next review is 14 (it does not jump straight to 30)', () => {
    let s: MasteryState = initialState('x');
    let estimate = 0.5;
    const gaps: number[] = [];
    for (let d = 0; d < 8; d++) {
      const when = new Date(at.getTime() + d * 3 * 86400000);
      if (d === 6) estimate = 0.85; // becomes mastered
      s = applyEvidence({ ...s, estimate }, { correct: true, help: 'none', difficulty: 1, at: when }, defaultParams, 1 as Difficulty);
      gaps.push(Math.round((new Date(s.nextReviewAt as string).getTime() - when.getTime()) / 86400000));
    }
    expect(gaps.slice(5)).toEqual([7, 14, 30]);
  });
});

describe('difficulty that follows her within the session (guardian, 18/11/2026: «growing as much as the kid is learning»)', () => {
  const evAt = (correct: boolean, difficulty: Difficulty, when = at, help: Evidence['help'] = 'none'): Evidence => ({ correct, help, difficulty, at: when });
  const six = 6 as Difficulty;

  it('the pending level climbs with what she proves the same day, and the next day confirms what this answer shows', () => {
    let s = initialState('x');
    for (let k = 0; k < 3; k++) s = applyEvidence(s, evAt(true, 1), defaultParams, six);
    expect(s.pendingAdvance?.level).toBe(2);
    for (const d of [3, 3, 4, 4, 5, 5] as Difficulty[]) s = applyEvidence(s, evAt(true, d), defaultParams, six);
    expect(s.level).toBe(1); // official level still waits for another day
    expect(s.pendingAdvance?.level).toBe(5);
    // tomorrow, an easy answer confirms one level only; the rest stays pending
    s = applyEvidence(s, evAt(true, 1, tomorrow), defaultParams, six);
    expect(s.level).toBe(2);
    expect(s.pendingAdvance?.level).toBe(5);
    // a success at level 5 confirms level 5
    s = applyEvidence(s, evAt(true, 5, new Date(tomorrow.getTime() + 60_000)), defaultParams, six);
    expect(s.level).toBe(5);
    expect(s.pendingAdvance).toBeNull();
  });

  it('one success above the pending level is not enough, and help breaks the run', () => {
    let s = initialState('x');
    for (let k = 0; k < 3; k++) s = applyEvidence(s, evAt(true, 1), defaultParams, six);
    s = applyEvidence(s, evAt(true, 3), defaultParams, six);
    expect(s.pendingAdvance?.level).toBe(2);
    s = applyEvidence(s, evAt(true, 3, at, 'hint'), defaultParams, six);
    s = applyEvidence(s, evAt(true, 3), defaultParams, six);
    expect(s.pendingAdvance?.level).toBe(2);
    s = applyEvidence(s, evAt(true, 3), defaultParams, six);
    expect(s.pendingAdvance?.level).toBe(3);
  });

  it('an error while looking for her limit does not erase what she proved below it', () => {
    let s = initialState('x');
    for (let k = 0; k < 3; k++) s = applyEvidence(s, evAt(true, 1), defaultParams, six);
    for (const d of [3, 3, 4, 4] as Difficulty[]) s = applyEvidence(s, evAt(true, d), defaultParams, six);
    expect(s.pendingAdvance?.level).toBe(4);
    s = applyEvidence(s, evAt(false, 5), defaultParams, six); // above what is pending: nothing to undo
    expect(s.pendingAdvance?.level).toBe(4);
    s = applyEvidence(s, evAt(false, 4), defaultParams, six); // at the pending level: back to what she showed (3)
    expect(s.pendingAdvance?.level).toBe(3);
    expect(s.level).toBe(1);
    expect(s.consecutiveErrors).toBe(0); // errors above her official level never bring it down
    s = applyEvidence(s, evAt(false, 2), defaultParams, six);
    expect(s.pendingAdvance).toBeNull(); // an error right above the official level: the level-up must be shown again
  });

  it('an error above the official level costs less and keeps the review schedule of what she knows', () => {
    let s: MasteryState = { ...initialState('x'), level: 2, estimate: 0.6, reviewStep: 3 };
    const above = applyEvidence(s, evAt(false, 3), defaultParams, six);
    const atLevel = applyEvidence(s, evAt(false, 2), defaultParams, six);
    expect(above.estimate).toBeGreaterThan(atLevel.estimate);
    expect(above.reviewStep).toBe(3);
    expect(atLevel.reviewStep).toBe(0);
    s = above;
    expect(s.level).toBe(2);
  });
});

describe('selectNext', () => {
  const skills = [skill('a'), skill('b'), skill('c', ['a'])];

  it('first contact when there is no history', () => {
    const d = selectNext({ skills, states: {}, now: at });
    expect(d.reasonCode).toBe('first-contact');
    expect(d.reason).toBe('Premier contact avec cette compétence (niveau d’introduction).');
    expect(d.difficulty).toBe(1);
  });

  it('a level-up comes from the structured field, not from the text (the text only counts in old states)', () => {
    // three independent successes: goes up a level and sets «advanced»
    let st = initialState('a');
    for (let i = 0; i < 3; i++) st = applyEvidence(st, ev(true, 'none'));
    st = applyEvidence(st, { ...ev(true, 'none'), at: tomorrow }); // confirmed on the next day
    expect(st.level).toBe(2);
    expect(st.lastLevelChange).toBe('advanced');
    const due = (s: MasteryState) => ({ ...s, nextReviewAt: new Date(at.getTime() - 1000).toISOString() });
    const pick = (s: MasteryState) => selectNext({ skills: [skill('a')], states: { a: due(s) }, now: at }).reasonCode;
    expect(pick(st)).toBe('advance');
    // any text (e.g. translated again) does not change the decision
    expect(pick({ ...st, lastChangeReason: 'Level up!' })).toBe('advance');
    // new evidence without a level-up clears the field, even if the old text mentions «Passage au niveau»
    const next = applyEvidence(st, ev(true, 'none', 2));
    expect(next.lastLevelChange).toBeNull();
    expect(pick({ ...next, independentStreak: 0, lastChangeReason: 'Passage au niveau 2…' })).toBe('review-due');
    // old state, saved without the field: the text counts (Portuguese or French)
    const legacy = { ...st, lastLevelChange: undefined, lastChangeReason: 'Avanço ao nível 2.' };
    delete (legacy as Partial<MasteryState>).lastLevelChange;
    expect(pick(legacy)).toBe('advance');
  });

  it('a due review influences the selection', () => {
    const past = new Date(at.getTime() - 3600_000).toISOString();
    const future = new Date(at.getTime() + 86400_000).toISOString();
    const states = {
      a: { ...initialState('a'), evidenceCount: 2, estimate: 0.3, nextReviewAt: future },
      b: { ...initialState('b'), evidenceCount: 2, estimate: 0.5, nextReviewAt: past },
      c: { ...initialState('c'), evidenceCount: 2, estimate: 0.2, nextReviewAt: future },
    };
    const d = selectNext({ skills, states, now: at });
    expect(d.skillId).toBe('b');
    expect(d.reasonCode).toBe('review-due');
  });

  it('reinforcement has priority and there is variety between skills', () => {
    const states = {
      a: { ...initialState('a'), evidenceCount: 1, consecutiveErrors: 1 },
      b: { ...initialState('b'), evidenceCount: 1, consecutiveErrors: 1 },
    };
    const d = selectNext({ skills: skills.slice(0, 2), states, now: at, lastSkillId: 'a' });
    expect(d.reasonCode).toBe('reinforcement');
    expect(d.skillId).toBe('b');
  });

  it('a weak prerequisite (with evidence) blocks the dependent skill', () => {
    const future = new Date(at.getTime() + 86400_000).toISOString();
    const states = {
      a: { ...initialState('a'), evidenceCount: 5, estimate: 0.1, nextReviewAt: future },
      b: { ...initialState('b'), evidenceCount: 5, estimate: 0.9, nextReviewAt: future },
    };
    const d = selectNext({ skills: [skill('c', ['a'])].concat(skill('b')), states, now: at });
    expect(d.skillId).toBe('b');
  });
});
