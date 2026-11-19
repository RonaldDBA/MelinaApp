/**
 * Word-level memory for English (research report «English learning games for kids»: spaced retrieval beats re-exposure;
 * the AMOUNT of spacing matters more than its exact shape, so a plain ladder of days is enough).
 *
 * Each word climbs a ladder of review gaps — 1, 3, 7, 14, 30 days — one step per day at most, with a first-try success.
 * A miss brings it down ONE step (not back to the start) and makes it due again right away.
 * Everything is recomputed from the history of answers: deterministic, auditable, no new table.
 */

export interface WordEvent {
  word: string;
  /** Local day of the answer («2026-11-18»). */
  day: string;
  /** Right on the first try, without help. */
  first: boolean;
}

export interface WordState {
  word: string;
  step: number; // 0 = to see again now; n = next review after WORD_LADDER[n - 1] days
  firstDay: string; // first time she met it
  lastDay: string; // last time she answered it
  stepDay: string | null; // last day the step went up (one step per day)
  successDays: string[]; // days with a first-try success
  due: string; // day from which it should come back
  tests: number;
  misses: number;
}

export const WORD_LADDER = [1, 3, 7, 14, 30] as const;

/** «2026-11-18» + n days (calendar days, no time zone involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Calendar days from `a` to `b`. */
export function daysBetween(a: string, b: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(b) - ms(a)) / 86400000);
}

export function wordSchedule(events: WordEvent[]): Record<string, WordState> {
  const out: Record<string, WordState> = {};
  for (const ev of events) {
    const s = (out[ev.word] ??= { word: ev.word, step: 0, firstDay: ev.day, lastDay: ev.day, stepDay: null, successDays: [], due: ev.day, tests: 0, misses: 0 });
    s.tests += 1;
    if (ev.first) {
      if (s.stepDay === null || ev.day > s.stepDay) {
        s.step = Math.min(s.step + 1, WORD_LADDER.length);
        s.stepDay = ev.day;
      }
      if (!s.successDays.includes(ev.day)) s.successDays.push(ev.day);
    } else {
      s.misses += 1;
      s.step = Math.max(0, s.step - 1);
    }
    if (ev.day > s.lastDay) s.lastDay = ev.day;
    s.due = s.step === 0 ? s.lastDay : addDays(s.lastDay, WORD_LADDER[s.step - 1] as number);
  }
  return out;
}

/** Words to bring back today, the most overdue first. */
export function dueWords(states: Record<string, WordState>, today: string): string[] {
  return Object.values(states)
    .filter((s) => s.due <= today)
    .sort((a, b) => (a.due === b.due ? a.word.localeCompare(b.word) : a.due.localeCompare(b.due)))
    .map((s) => s.word);
}

/** A word is «known» after first-try successes on 2 different days (one session can be misleading). */
export const isKnown = (s: WordState) => s.successDays.length >= 2;

/**
 * The honest learning measure: of the words she got right, how many does she STILL get right 7 days or more later?
 * For each word, the first answer at least 7 days after its first first-try success.
 */
export function retention(events: WordEvent[], minDays = 7): { tested: number; kept: number; words: Array<{ word: string; kept: boolean; after: number }> } {
  const firstSuccess = new Map<string, string>();
  const done = new Set<string>();
  const words: Array<{ word: string; kept: boolean; after: number }> = [];
  for (const ev of events) {
    const since = firstSuccess.get(ev.word);
    if (since === undefined) {
      if (ev.first) firstSuccess.set(ev.word, ev.day);
      continue;
    }
    if (done.has(ev.word)) continue;
    const after = daysBetween(since, ev.day);
    if (after >= minDays) {
      done.add(ev.word);
      words.push({ word: ev.word, kept: ev.first, after });
    }
  }
  return { tested: words.length, kept: words.filter((w) => w.kept).length, words };
}
