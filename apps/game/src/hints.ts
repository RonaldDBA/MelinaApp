/**
 * «Think before asking» (the guardian's decision, 18/11/2026): the hint button only appears after some time
 * spent searching. 20 s at home; the browser test shortens it with the `melina.hintDelayMs` key (the family never uses it).
 */
export function hintDelayMs(): number {
  try {
    const v = Number(window.localStorage.getItem('melina.hintDelayMs'));
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    /* storage unavailable */
  }
  return 20_000;
}
