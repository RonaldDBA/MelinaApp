/**
 * Plural rules (skill fr.plural), aligned with the school's 2e année aide-mémoire:
 * -s; -au/-eau/-eu → x; s, x, z do not change; -ou → s, except 7 exceptions in x; bleu, pneu → s; agreement within the noun group.
 * Used by the « La pêche aux mots » game and by the « plural.write » paper exercise.
 */

export const pluralRule: Record<string, string> = {
  s: 'Au pluriel, on ajoute souvent un « s » à la fin du nom.',
  x: 'Les noms en -au, -eau et -eu prennent un « x » au pluriel.',
  same: 'Les noms qui finissent déjà par s, x ou z ne changent pas au pluriel.',
  sou: 'Les noms en -ou prennent un « s » au pluriel… sauf sept exceptions : bijou, caillou, chou, genou, hibou, joujou, pou.',
  xou: 'Bijou, caillou, chou, genou, hibou, joujou, pou : ces sept noms en -ou prennent un « x » au pluriel.',
  eus: 'Attention : bleu, pneu et émeu prennent un « s » au pluriel, pas un « x ».',
  gn: 'Dans le groupe du nom, le déterminant, le nom et l’adjectif se mettent tous au pluriel.',
  aux: 'Défi : beaucoup de noms en -al (et quelques-uns en -ail) font -aux au pluriel : un cheval → des chevaux, un travail → des travaux.',
  als: 'Défi : attention, ces noms en -al ou -ail prennent simplement un « s » : des bals, des carnavals, des festivals, des chandails.',
};

/** «un beau chapeau» → article «un» and the rest «beau chapeau». */
export const splitArticle = (g: string): [string, string] => {
  const i = g.indexOf(' ');
  return [g.slice(0, i), g.slice(i + 1)];
};

/** «Naive» plural of a word (only for building distractors). */
const naivePlural = (w: string) => (/[sxz]$/.test(w) ? w : `${w}s`);

/** Plausible wrong options for the plural of `sing` (a lone noun or a noun group). */
export function pluralDistractors(sing: string, plural: string, rule: string): string[] {
  if (rule === 'gn') {
    const sw = sing.split(' ');
    const pw = plural.split(' ');
    const out = [
      sing, // nothing in the plural
      sw.map(naivePlural).join(' '), // «s» on everything, without thinking about the rules
      pw.map((w, i) => (i === pw.length - 1 ? (sw[i] as string) : w)).join(' '), // the last word forgotten
      pw.map((w, i) => (i === 0 ? (sw[i] as string) : w)).join(' '), // the first word forgotten
      // adjective that already ends in s/x («gris», «joyeux»): confusion with the feminine plural
      ...(/[sxz]$/.test(sw[sw.length - 1] as string) ? [pw.map((w, i) => (i === pw.length - 1 ? `${sw[i]}es` : w)).join(' ')] : []),
    ];
    return [...new Set(out)].filter((c) => c !== plural);
  }
  const stem = sing.replace(/(s|x|z)$/, '');
  const aux = /(al|ail)$/.test(sing) ? [sing.replace(/(al|ail)$/, 'aux')] : []; // chevaux / travaux (and, the other way round, «baux»)
  return [...new Set([...aux, sing, `${sing}s`, `${sing}x`, `${sing}es`, `${sing}z`, stem])].filter((c) => c && c !== plural);
}
