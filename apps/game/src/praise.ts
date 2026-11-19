/**
 * Completion messages (rules in research_notes/Completion sounds and messages/notes.md):
 * - praise the PROCESS (what she did), never the person («tu es intelligente»), never comparing her with anyone;
 * - short (≤ 8–10 words on a correct answer, ≤ 12 after a mistake), keyword first;
 * - easy item right on the first try: only a short marker; the full sentence comes once every 2–3 correct answers and always
 *   after a corrected mistake or on a hard item;
 * - variety: none of the last 3 sentences of the same context repeats;
 * - no «parfait/incroyable» for easy things, no «Faux!», «Dommage!», «Vite!», «Ne perds pas ta série!».
 * Without the child's name (the voice may be an online service).
 */

type Ctx = 'marker' | 'afterError' | 'wrong' | 'end' | 'milestone';

const POOLS: Record<Ctx, string[]> = {
  // right on the first try: short markers (6–8)
  marker: ['Oui!', 'C’est ça!', 'Exact!', 'Bien vu!', 'Tout juste!', 'Bravo!', 'Bonne réponse!', 'Voilà!'],
  // right after a mistake: persistence and the correction (6–8)
  afterError: [
    'Tu t’es corrigée toute seule!',
    'Tu as réessayé, et tu as trouvé!',
    'Tu as utilisé l’astuce, et ça a marché!',
    'Tu n’as pas lâché : c’est réussi!',
    'Tu as vérifié encore, bonne idée!',
    'Ton deuxième essai était le bon!',
  ],
  // answer shown after the attempts: neutral opener (4–6) + explanation
  wrong: ['On regarde ensemble.', 'Regardons comment faire.', 'Voici comment on trouve.', 'On va comprendre ensemble.', 'Regarde bien la solution.'],
  // end of activity (6–8)
  end: [
    'Tu as fini toute l’activité!',
    'Trois défis de faits, bravo pour ta concentration!',
    'Tu as travaillé jusqu’au bout!',
    'Activité terminée : tu as bien persévéré!',
    'C’est terminé! Tu as bien réfléchi à chaque question.',
    'Bel effort du début à la fin!',
  ],
  // milestone: level confirmed (5–6)
  milestone: [
    'Nouveau niveau! Une fleur pousse dans ton jardin.',
    'Tu as monté d’un niveau! Ton jardin a une nouvelle fleur.',
    'Ce qui était difficile est devenu facile : nouveau niveau!',
    'Tu as gardé ça en mémoire d’un jour à l’autre : nouveau niveau!',
    'Nouveau niveau! Regarde la nouvelle fleur dans ton jardin.',
  ],
};

/** Templates with the round's strategy (from the server: «Tu as trouvé la règle de la suite.»). */
const WITH_STRATEGY = ['{m} {s}', '{s}', '{m} {s}', 'Bonne stratégie! {s}', '{s} Continue comme ça!'];

const recent: Record<string, string[]> = {};
/** Draws a sentence from the context without repeating the last 3. */
export function pick(ctx: Ctx): string;
export function pick(ctx: string, pool: string[]): string;
export function pick(ctx: string, pool: string[] = POOLS[ctx as Ctx] ?? []): string {
  if (pool.length === 0) return '';
  const last = (recent[ctx] ??= []);
  // memory shorter than the list: with 3 sentences it never repeats the LAST one (before, it could repeat right after 3 draws)
  const memory = Math.min(3, pool.length - 1);
  const fresh = pool.filter((p) => !last.slice(-memory).includes(p));
  const from = fresh.length ? fresh : pool;
  const choice = from[Math.floor(Math.random() * from.length)] as string;
  last.push(choice);
  if (last.length > 3) last.shift();
  return choice;
}

/**
 * Sentence for a correct round.
 * `streak`: first-try successes already made in this session (before this one); `hard`: hard item (level ≥ 4 or challenge).
 */
export function successPhrase(opts: { strategy: string | null; afterError: boolean; hard: boolean; streak: number }): { headline: string; spoken: string } {
  if (opts.afterError) {
    const p = pick('afterError');
    return { headline: p, spoken: p };
  }
  const m = pick('marker');
  // full sentence: on the 1st correct answer of the session, every 3 correct answers and always on a hard item
  const full = opts.strategy && (opts.hard || opts.streak % 3 === 0);
  if (!full) return { headline: m, spoken: m };
  const t = pick('strategy', WITH_STRATEGY);
  const text = t.replace('{m}', m).replace('{s}', opts.strategy as string).trim();
  return { headline: m, spoken: text };
}

export const wrongOpener = () => pick('wrong');
export const endPhrase = () => pick('end');
export const milestonePhrase = () => pick('milestone');

/**
 * Weak spot overcome, said with the tag's label («retenue», «son « eau »», «addition»…).
 * The templates work with any label (no article before it).
 */
export function conquestPhrase(label: string): string {
  const what = label.replace(/\s*\(.*\)$/, '').replace(/\s*—\s*défi$/, '').trim();
  return pick('conquest', [
    `Nouveau point fort : ${what}! Une fleur pousse dans ton jardin.`,
    `${what} : avant, c’était difficile. Maintenant, tu y arrives!`,
    `Tu as beaucoup pratiqué. ${what} : c’est devenu un point fort!`,
  ]).replace(/^./, (c) => c.toUpperCase());
}

/** Weak spot almost overcome: «presque!», no celebration — the win is confirmed on another day (research). */
export function almostPhrase(label: string): string {
  const what = label.replace(/\s*\(.*\)$/, '').replace(/\s*—\s*défi$/, '').trim();
  return `Presque gagné : ${what}! On vérifie un autre jour.`;
}
