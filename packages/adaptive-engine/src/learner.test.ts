import { describe, expect, it } from 'vitest';
import { almostTags, CLIMB_AFTER, comfortableLevel, CONQUER_STREAK, conqueredTags, learnProfile, planRound, predict, sessionLevel, strongTags, weakTags, type DayAnswer, type LearnEvent } from './learner';

const ev = (outcome: LearnEvent['outcome'], level: number, tags: string[], skillId = 'math.add-sub'): LearnEvent => ({ skillId, level, tags, outcome });

describe('model that learns from her answers', () => {
  it('reinforcement right after consecutive errors stays at the official level (does not go back to the level where she missed)', () => {
    const events: LearnEvent[] = [];
    // she does well up to level 3 and the retenue is weak there; the engine just went down to level 2
    for (let i = 0; i < 25; i++) events.push(ev('first', 3, ['addition']), ev('first', 4, ['addition']));
    for (let i = 0; i < 2; i++) events.push(ev('wrong', 3, ['retenue']));
    const p = learnProfile(events);
    expect(weakTags(p['math.add-sub'])).toContain('retenue');
    expect(comfortableLevel(p['math.add-sub'], 6)).toBeGreaterThan(2); // the scenario: the model still sees her above the official level
    for (let roll = 0; roll < 1; roll += 0.05) {
      const plan = planRound(p, 'math.add-sub', 2, 6, roll, {}, { allowExplore: false });
      expect(plan.level, `roll ${roll}: ${plan.mode}`).toBeLessThanOrEqual(2);
    }
  });

  it('weak point: on the same day it only becomes «presque»; the win counts with a first-try success on ANOTHER day', () => {
    const d1 = '2026-11-17';
    const d2 = '2026-11-18';
    const at = (day: string, outcome: LearnEvent['outcome'], tags: string[]): LearnEvent => ({ ...ev(outcome, 3, tags), day });
    const events: LearnEvent[] = [];
    for (let i = 0; i < 5; i++) events.push(at(d1, 'wrong', ['retenue']), at(d1, 'first', []));
    // while still weak, not even a streak of successes makes it «presque»
    for (let i = 0; i < CONQUER_STREAK; i++) events.push(at(d1, 'first', ['retenue']));
    const early = learnProfile(events)['math.add-sub'];
    expect(weakTags(early)).toContain('retenue');
    expect(almostTags(early)).toEqual([]);
    for (let i = 0; i < 30; i++) events.push(at(d1, 'first', ['retenue']));
    const sameDay = learnProfile(events)['math.add-sub'];
    expect(weakTags(sameDay)).not.toContain('retenue');
    expect(almostTags(sameDay)).toContain('retenue');
    // on the next day, an answer without the tag confirms nothing; an error with it postpones to another day
    events.push(at(d2, 'first', []));
    const b = learnProfile(events)['math.add-sub'];
    events.push(at(d2, 'wrong', ['retenue']));
    expect(conqueredTags(b, learnProfile(events)['math.add-sub'])).toEqual([]);
    for (let i = 0; i < 10; i++) events.push(at(d2, 'first', ['retenue']));
    expect(almostTags(learnProfile(events)['math.add-sub'])).toContain('retenue');
    // day 3: the 1st first-try success confirms
    const before = learnProfile(events)['math.add-sub'];
    events.push(at('2026-11-19', 'first', ['retenue']));
    const after = learnProfile(events)['math.add-sub'];
    expect(conqueredTags(before, after)).toEqual(['retenue']);
    expect(almostTags(after)).toEqual([]);
  });

  it('weak point overcome: remembers it was weak, announces it only once; an error resets the success streak', () => {
    const events: LearnEvent[] = [];
    for (let i = 0; i < 5; i++) events.push(ev('wrong', 3, ['retenue']), ev('first', 3, []));
    expect(weakTags(learnProfile(events)['math.add-sub'])).toContain('retenue');
    const won: number[] = [];
    let wentNormal = false;
    for (let i = 0; i < 40; i++) {
      const before = learnProfile(events)['math.add-sub'];
      events.push(ev('first', 3, ['retenue']));
      const after = learnProfile(events)['math.add-sub'];
      const w = after?.tags.retenue?.w ?? 0;
      if (w < 0.2 && !weakTags(after).includes('retenue') && after?.tags.retenue?.wasWeak) wentNormal = true; // no longer «weak», but not overcome yet
      if (conqueredTags(before, after).includes('retenue')) won.push(i);
    }
    expect(wentNormal).toBe(true);
    expect(won).toHaveLength(1);
    // a single error afterwards does not reopen the celebration
    events.push(ev('wrong', 3, ['retenue']));
    const b = learnProfile(events)['math.add-sub'];
    events.push(ev('first', 3, ['retenue']));
    expect(conqueredTags(b, learnProfile(events)['math.add-sub'])).toEqual([]);
  });

  it('always misses the retenue and gets the rest right: retenue becomes a point to strengthen, the rest a strong point', () => {
    const events: LearnEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push(ev('wrong', 3, ['addition', 'retenue']));
      events.push(ev('first', 3, ['soustraction']));
      events.push(ev('first', 3, ['addition']));
    }
    const m = learnProfile(events)['math.add-sub'];
    expect(weakTags(m)[0]).toBe('retenue');
    expect(strongTags(m)).toContain('soustraction');
    // the model predicts less success with retenue than without
    expect(predict(m, 3, ['addition', 'retenue'])).toBeLessThan(predict(m, 3, ['addition']) - 0.2);
  });

  it('gets everything right on the first try: ability rises above the official level (strong points to explore)', () => {
    const events = Array.from({ length: 12 }, () => ev('first', 2, ['bonds-5-10'], 'math.sequences'));
    const prof = learnProfile(events);
    expect(prof['math.sequences']!.theta).toBeGreaterThan(2.6);
    expect(comfortableLevel(prof['math.sequences'], 5)).toBeGreaterThanOrEqual(2);
    expect(predict(prof['math.sequences'], 3)).toBeGreaterThan(0.6); // the model thinks level 3 is already within reach
    // strong and bored: the plan explores the level above, even without a draw
    const plan = planRound(prof, 'math.sequences', 2, 5, 0.99);
    expect(plan.mode).toBe('explore');
    expect(plan.level).toBe(3);
    expect(plan.reason).toMatch(/Exploration d’un point fort/);
  });

  it('with a known weak point, the plan reinforces and prefers exercises with that tag', () => {
    const events: LearnEvent[] = [];
    for (let i = 0; i < 8; i++) events.push(ev('wrong', 3, ['emprunt', 'soustraction']), ev('first', 3, ['addition']));
    const plan = planRound(learnProfile(events), 'math.add-sub', 3, 5, 0.5, { emprunt: 'emprunt (échanger une dizaine)' });
    expect(plan.mode).toBe('reinforce');
    expect(plan.focus).toContain('emprunt');
    expect(plan.reason).toContain('emprunt (échanger une dizaine)');
    expect(plan.prefer!(['soustraction', 'emprunt'])).toBeGreaterThan(plan.prefer!(['addition']));
    // very low chance on the weak point: goes down a level so she does not get discouraged
    expect(plan.level).toBeLessThanOrEqual(3);
  });

  it('little information (fewer than 4 answers): standard round, without inventing strong or weak points', () => {
    const prof = learnProfile([ev('wrong', 1, ['retenue']), ev('wrong', 1, ['retenue'])]);
    expect(planRound(prof, 'math.add-sub', 1, 5, 0.1).mode).toBe('standard');
    expect(planRound({}, 'math.add-sub', 2, 5, 0.1)).toMatchObject({ mode: 'standard', level: 2 });
  });

  it('a success after a mistake counts less than a first-try success', () => {
    const a = learnProfile(Array.from({ length: 6 }, () => ev('first', 2, ['x'])))['math.add-sub']!;
    const b = learnProfile(Array.from({ length: 6 }, () => ev('retry', 2, ['x'])))['math.add-sub']!;
    expect(a.theta).toBeGreaterThan(b.theta);
  });

  it('never explores after consecutive errors (the server turns exploration off)', () => {
    const prof = learnProfile(Array.from({ length: 12 }, () => ev('first', 2, ['bonds-5-10'], 'math.sequences')));
    expect(planRound(prof, 'math.sequences', 2, 5, 0.1, {}, { allowExplore: false }).mode).not.toBe('explore');
  });
});

describe('session staircase: the play level follows her during the day', () => {
  /** She answers every round at the level the staircase gives her. */
  const play = (results: boolean[], start = 1, floor = 1, max = 6) => {
    const answers: DayAnswer[] = [];
    const levels: number[] = [];
    for (const ok of results) {
      const level = sessionLevel(answers, start, floor, max).level;
      levels.push(level);
      answers.push({ difficulty: level, correct: ok, help: 'none' });
    }
    return { levels, final: sessionLevel(answers, start, floor, max).level };
  };

  it('21 right answers in a row (her evening of 18/11) take her from level 1 to the top, not stuck at level 2', () => {
    const { levels, final } = play(Array(21).fill(true));
    expect(levels.slice(0, CLIMB_AFTER)).toEqual([1, 1, 1]);
    expect(levels[CLIMB_AFTER]).toBe(2);
    expect(final).toBe(6);
    expect(Math.max(...levels.slice(0, 15))).toBeGreaterThanOrEqual(5);
  });

  it('an error brings it down one step, never below the official level', () => {
    expect(play([true, true, true, false]).final).toBe(1);
    expect(play([true, true, true, true, true, true, false]).final).toBe(2);
    expect(play([false, false, false], 3, 2).final).toBe(2);
  });

  it('help or easier rounds do not climb; a success with help counts as a step down', () => {
    const helped: DayAnswer[] = [
      { difficulty: 2, correct: true, help: 'none' },
      { difficulty: 2, correct: true, help: 'hint' },
      { difficulty: 1, correct: true, help: 'none' },
      { difficulty: 1, correct: true, help: 'none' },
    ];
    expect(sessionLevel(helped, 2, 1, 6)).toEqual({ level: 1, streak: 2 });
    const easier: DayAnswer[] = Array(5).fill({ difficulty: 1, correct: true, help: 'none' });
    expect(sessionLevel(easier, 3, 1, 6).level).toBe(3); // a review at level 1 says nothing about level 4
  });

  it('starts the day at the level already proven (pending), and stops at the skill maximum', () => {
    expect(sessionLevel([], 4, 2, 6).level).toBe(4);
    expect(play(Array(20).fill(true), 1, 1, 3).final).toBe(3);
  });

  it('planRound plays at the session level when it is above the official one', () => {
    const prof = learnProfile(Array.from({ length: 12 }, () => ev('first', 2, ['bonds-5-10'], 'math.sequences')));
    const plan = planRound(prof, 'math.sequences', 1, 6, 0.95, {}, { sessionLevel: 4 });
    expect(plan.level).toBeGreaterThanOrEqual(4);
    expect(plan.reasonCode).toBe('learner-explore');
    // after consecutive errors (exploration off) the staircase does not apply
    expect(planRound(prof, 'math.sequences', 1, 6, 0.95, {}, { sessionLevel: 4, allowExplore: false }).level).toBe(1);
  });
});

describe('guessing floor for picture choices (English listening: 1 chance in 3 by luck)', () => {
  const at = (outcome: LearnEvent['outcome'], guess?: number): LearnEvent => ({ skillId: 'en.listen-words', level: 1, tags: ['en-mot-cat'], outcome, guess });
  it('a right tap counts less when it could be luck; an error counts the same', () => {
    const plain = learnProfile([at('first')])['en.listen-words']!;
    const lucky = learnProfile([at('first', 1 / 3)])['en.listen-words']!;
    expect(lucky.theta).toBeLessThan(plain.theta);
    expect(lucky.theta).toBeGreaterThan(1); // still evidence
    const wrongPlain = learnProfile([at('wrong')])['en.listen-words']!;
    const wrongLucky = learnProfile([at('wrong', 1 / 3)])['en.listen-words']!;
    expect(wrongLucky.theta).toBeCloseTo(wrongPlain.theta, 6);
  });
  it('random tapping (1 in 3 right) does not look like knowing the words', () => {
    const taps: LearnEvent[] = Array.from({ length: 30 }, (_, i) => at(i % 3 === 0 ? 'first' : 'wrong', 1 / 3));
    expect(learnProfile(taps)['en.listen-words']!.theta).toBeLessThan(1);
  });
});
