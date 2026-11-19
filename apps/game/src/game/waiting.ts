import type { Assignment } from '../api';
import type { PointId } from './bridge';

/**
 * Paper sheets that wait for a parent, placed on the garden map.
 *
 * Before (bug seen by the guardian on 18/11/2026): every time the garden scene started (and every time the parents'
 * area closed) the app re-opened the newest waiting sheet as a pop-up that said «Bravo pour ton travail! Appelle un
 * parent». A mission sheet left in `answered_on_paper` for days therefore greeted her on every visit, though she had
 * not played. Now a waiting sheet is only a calm chip on its station; the card opens when she goes to that station.
 */

/** She said the sheet is finished (or a parent started to look at it): only a parent can move it on. */
const WAITING = new Set<string>(['answered_on_paper', 'in_review', 'illegible']);
/** Practice sheets live at the station of their subject. */
const SUBJECT_POINT: Record<string, PointId> = { mathematics: 'shed', french: 'well' };

type Steps = ReadonlyArray<{ pointId: string }>;

/** Station of a sheet: the mission step's point, or the subject's station for a practice sheet. */
export function sheetPoint(a: Assignment, steps: Steps): PointId | null {
  if (a.missionId && a.missionStep !== null) return (steps[a.missionStep]?.pointId as PointId | undefined) ?? null;
  return SUBJECT_POINT[a.exercise.subject] ?? null;
}

export const isWaiting = (a: Assignment) => WAITING.has(a.status);

/** Stations that have a waiting sheet, without repeats (mission sheets first: they hold the story back). */
export function waitingPoints(pending: Assignment[], steps: Steps): PointId[] {
  const sorted = [...pending].filter(isWaiting).sort((a, b) => Number(Boolean(b.missionId)) - Number(Boolean(a.missionId)));
  const out: PointId[] = [];
  for (const a of sorted) {
    const p = sheetPoint(a, steps);
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** The waiting sheet of one station (a mission sheet first), or null. */
export function waitingAt(pending: Assignment[], steps: Steps, id: PointId): Assignment | null {
  const here = pending.filter((a) => isWaiting(a) && sheetPoint(a, steps) === id);
  return here.find((a) => a.missionId) ?? here[0] ?? null;
}
