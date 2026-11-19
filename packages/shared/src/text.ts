/** Text normalizations used when grading. */

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

/** Lowercase, collapsed spaces, unified apostrophes and ligatures. Keeps accents. */
export function basicNormalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** For comprehension: no accents, no punctuation. */
export function looseNormalize(s: string): string {
  return stripAccents(basicNormalize(s))
    .replace(/[.,;:!?«»"()\-'’]/g, ' ') // an apostrophe becomes a space: «l'automne» contains the word «automne»
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extracts numbers from an answer such as "37"; "3 7"? no: it only accepts separate digit runs. */
export function parseIntegers(s: string): number[] {
  const matches = s.replace(/(\d)\s(?=\d{3}\b)/g, '$1').match(/-?\d+/g);
  return matches ? matches.map((m) => Number.parseInt(m, 10)) : [];
}

/**
 * Numbers of a written SEQUENCE (always positive): «120, 130», «120 130», «34-35», «1 000, 1 100», «1 750 2 000».
 * A space is ambiguous (it separates numbers OR groups thousands, as in Québec). Possible readings, in order:
 * 1) the comma separates and the space groups thousands within each part; 2) comma, space and dash all separate;
 * 3) the space groups thousands («1 750 2 000» → 1750, 2000). The first one that yields the expected COUNT wins.
 */
export function parseSequence(s: string, expectedCount?: number): number[] {
  const text = s.replace(/[\u00a0\u202f]/g, ' ');
  const parts = text.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  const thousandsInParts = parts.flatMap((part) => (/^\d{1,3}( \d{3})+$/.test(part) ? [Number(part.replace(/ /g, ''))] : (part.match(/\d+/g) ?? []).map(Number)));
  const allSplit = (text.match(/\d+/g) ?? []).map(Number);
  const grouped: number[] = [];
  const groupable: boolean[] = [];
  for (const tok of text.split(/[,;\s-]+/).filter((x) => /^\d+$/.test(x))) {
    const last = grouped.length - 1;
    // «750» after «1» (1 to 3 digits): continues the same number (1 750)
    if (tok.length === 3 && last >= 0 && /^\d{1,3}$/.test(String(grouped[last])) && groupable[last]) {
      grouped[last] = (grouped[last] as number) * 1000 + Number(tok);
      groupable[last] = false;
    } else {
      grouped.push(Number(tok));
      groupable.push(tok.length <= 3);
    }
  }
  const candidates = /[,;]/.test(text) ? [thousandsInParts, allSplit, grouped] : [allSplit, grouped];
  if (expectedCount !== undefined) {
    const fit = candidates.find((c) => c.length === expectedCount);
    if (fit) return fit;
  }
  return candidates[0] as number[];
}
