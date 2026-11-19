/**
 * Dates in the parents' area, always written out in full (fr-CA): «lundi 16 novembre 2026», «lundi 16 novembre, 23 h 25».
 * No raw «2026-11-16» and no abbreviations such as «mar.» (which reads as «março», March, in Portuguese).
 */

const toDate = (d: string | number | Date) => (d instanceof Date ? d : new Date(d));

/** «lundi 16 novembre 2026» */
export function fmtDate(d: string | number | Date): string {
  return toDate(d).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** «lundi 16 novembre» (without the year, for the current year) */
export function fmtDay(d: string | number | Date): string {
  const x = toDate(d);
  const sameYear = x.getFullYear() === new Date().getFullYear();
  return x.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** «23 h 25» */
export function fmtTime(d: string | number | Date): string {
  const x = toDate(d);
  return `${x.getHours()} h ${String(x.getMinutes()).padStart(2, '0')}`;
}

/** «lundi 16 novembre, 23 h 25» */
export function fmtDateTime(d: string | number | Date): string {
  return `${fmtDay(d)}, ${fmtTime(d)}`;
}
