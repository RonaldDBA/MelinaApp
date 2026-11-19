import { describe, expect, it } from 'vitest';
import { addDays, dueWords, isKnown, retention, WORD_LADDER, wordSchedule, type WordEvent } from './words';

const e = (word: string, day: string, first = true): WordEvent => ({ word, day, first });

describe('English words: spaced ladder of days', () => {
  it('climbs 1 → 3 → 7 → 14 → 30 days, one step per day at most', () => {
    let s = wordSchedule([e('cat', '2026-11-18'), e('cat', '2026-11-18'), e('cat', '2026-11-18')]).cat!;
    expect(s.step).toBe(1); // three successes the same day = one step
    expect(s.due).toBe('2026-11-19');
    s = wordSchedule([e('cat', '2026-11-18'), e('cat', '2026-11-19'), e('cat', '2026-11-22'), e('cat', '2026-11-29')]).cat!;
    expect(s.step).toBe(4);
    expect(s.due).toBe(addDays('2026-11-29', WORD_LADDER[3]));
    expect(isKnown(s)).toBe(true);
  });

  it('a miss goes down one step (not back to the start) and makes the word due again now', () => {
    const s = wordSchedule([e('ship', '2026-11-18'), e('ship', '2026-11-19'), e('ship', '2026-11-22'), e('ship', '2026-11-29', false)]).ship!;
    expect(s.step).toBe(2);
    expect(s.misses).toBe(1);
    const missedFirst = wordSchedule([e('tree', '2026-11-18', false)]).tree!;
    expect(missedFirst.step).toBe(0);
    expect(missedFirst.due).toBe('2026-11-18');
  });

  it('due words: the most overdue first; known words wait for their day', () => {
    const states = wordSchedule([e('cat', '2026-11-10'), e('dog', '2026-11-15'), e('frog', '2026-11-18', false), e('duck', '2026-11-18')]);
    expect(dueWords(states, '2026-11-18')).toEqual(['cat', 'dog', 'frog']);
    expect(dueWords(states, '2026-11-19')).toEqual(['cat', 'dog', 'frog', 'duck']);
  });

  it('known = first-try successes on 2 different days (one session can be misleading)', () => {
    expect(isKnown(wordSchedule([e('cow', '2026-11-18'), e('cow', '2026-11-18')]).cow!)).toBe(false);
    expect(isKnown(wordSchedule([e('cow', '2026-11-18'), e('cow', '2026-11-20')]).cow!)).toBe(true);
  });

  it('retention: of the words she got right, how many she still gets right 7 days or more later', () => {
    const r = retention([
      e('cat', '2026-11-01'),
      e('cat', '2026-11-03'), // 2 days later: does not count
      e('cat', '2026-11-09'), // 8 days: kept
      e('dog', '2026-11-01'),
      e('dog', '2026-11-10', false), // 9 days: forgotten
      e('dog', '2026-11-20'), // only the first test after 7 days counts
      e('frog', '2026-11-01', false), // never right yet: not in the measure
      e('frog', '2026-11-12', false),
      e('duck', '2026-11-15'), // too recent
    ]);
    expect(r).toMatchObject({ tested: 2, kept: 1 });
    expect(r.words).toEqual([
      { word: 'cat', kept: true, after: 8 },
      { word: 'dog', kept: false, after: 9 },
    ]);
  });
});
