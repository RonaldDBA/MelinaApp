import { almostTags, dueWords, isKnown, retention, strongTags, weakTags, wordSchedule, type LearnerProfile } from '@melina/adaptive-engine';
import { englishWord, evaluate, games, skills, soundAlikes, tagsOf, TAG_LABELS } from '@melina/curriculum';
import type { ExerciseInstance, MasteryState } from '@melina/shared';
import { all, englishWordEvents, learnerProfile, localDay, PROFILE_ID, type Ctx } from './service';

/**
 * Progress report for the parents (week or month), compared with the previous period.
 * Everything is computed from the recorded attempts; nothing leaves the computer.
 * Texts in French (parents' area).
 */

export type ReportKind = 'week' | 'month';

interface Row {
  created_at: string;
  skill_id: string;
  difficulty: number;
  result: string;
  help: string;
  input_mode: string;
  mastery_before_json: string;
  mastery_after_json: string;
  snapshot_json: string;
  exercise_id: string;
}

const MIN_TAG = 3; // minimum answers before talking about a tag
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/** Period (local time): week from Monday to Sunday, or calendar month. offset 0 = current, -1 = previous… */
export function periodBounds(kind: ReportKind, now: Date, offset: number): { start: Date; end: Date; label: string } {
  if (kind === 'week') {
    const day = (now.getDay() + 6) % 7; // Monday = 0
    const start = addDays(startOfDay(now), -day + 7 * offset);
    const end = addDays(start, 7);
    const last = addDays(end, -1);
    return { start, end, label: `Semaine du ${fmt(start)} au ${fmt(last)}` };
  }
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const name = MONTHS[start.getMonth()] as string;
  return { start, end, label: `Mois de ${name} ${start.getFullYear()}` };
}

const parse = <T>(s: string, fb: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fb;
  }
};

function rowsBetween(c: Ctx, start: Date, end: Date): Row[] {
  return c.db
    .prepare(
      `SELECT t.created_at, t.skill_id, t.difficulty, t.result, t.help, t.input_mode, t.mastery_before_json, t.mastery_after_json, a.snapshot_json, a.exercise_id
       FROM attempts t JOIN assignments a ON a.id = t.assignment_id
       WHERE t.profile_id = ? AND t.created_at >= ? AND t.created_at < ? ORDER BY t.created_at`,
    )
    .all(PROFILE_ID, start.toISOString(), end.toISOString()) as unknown as Row[];
}

const firstTry = (r: Row) => r.result === 'correct' && r.help === 'none';
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : null);

/** Estimated practice minutes: sum of the gaps between consecutive answers when under 6 min (+1 min per session). */
function minutesOf(rows: Row[]): number {
  let ms = 0;
  let sessions = rows.length ? 1 : 0;
  for (let i = 1; i < rows.length; i++) {
    const gap = new Date((rows[i] as Row).created_at).getTime() - new Date((rows[i - 1] as Row).created_at).getTime();
    if (gap < 6 * 60_000) ms += gap;
    else sessions++;
  }
  return Math.round(ms / 60_000 + sessions);
}

function summary(rows: Row[]) {
  const first = rows.filter(firstTry).length;
  const correct = rows.filter((r) => r.result === 'correct').length;
  return {
    answers: rows.length,
    firstTry: first,
    firstTryRate: pct(first, rows.length),
    correctRate: pct(correct, rows.length),
    activeDays: new Set(rows.map((r) => iso(new Date(r.created_at)))).size,
    minutes: minutesOf(rows),
  };
}

/** Stats per SKILL and tag («math.add-sub|retenue»): the same tag in two games is not mixed. */
type TagAgg = Record<string, { n: number; first: number; maxLevel: number }>;
const tk = (skillId: string, tag: string) => `${skillId}|${tag}`;
function tagStats(rows: Row[]): TagAgg {
  const out: TagAgg = {};
  for (const r of rows) {
    const ex = parse<ExerciseInstance | null>(r.snapshot_json, null);
    for (const t of ex ? tagsOf(ex) : []) {
      const s = (out[tk(r.skill_id, t)] ??= { n: 0, first: 0, maxLevel: 0 });
      s.n++;
      s.maxLevel = Math.max(s.maxLevel, r.difficulty);
      if (firstTry(r)) s.first++;
    }
  }
  return out;
}

const skillTitle = (id: string) => skills.find((s) => s.id === id)?.title ?? id;

/**
 * Reviews done on ANOTHER day (the measure research considers reliable: "she remembers days later"):
 * the 1st answer of the day in a skill already practised on an earlier day, at the level she already had or below
 * (exploration rounds above her level do not count).
 */
function delayedReviews(c: Ctx, start: Date, end: Date): Record<string, { n: number; ok: number }> {
  const hist = c.db
    .prepare('SELECT created_at, skill_id, difficulty, result, help, mastery_before_json FROM attempts WHERE profile_id = ? AND created_at < ? ORDER BY created_at, id')
    .all(PROFILE_ID, end.toISOString()) as unknown as Row[];
  const lastDay: Record<string, string> = {};
  const out: Record<string, { n: number; ok: number }> = {};
  for (const r of hist) {
    const day = localDay(r.created_at);
    const prevDay = lastDay[r.skill_id];
    lastDay[r.skill_id] = day;
    if (!prevDay || prevDay >= day || r.created_at < start.toISOString()) continue;
    const level = parse<MasteryState | null>(r.mastery_before_json, null)?.level ?? r.difficulty;
    if (r.difficulty > level) continue;
    const s = (out[r.skill_id] ??= { n: 0, ok: 0 });
    s.n++;
    if (firstTry(r)) s.ok++;
  }
  return out;
}

/** Short activities for home, per skill (EEF: practical suggestions, without doing the task for her). */
const HOME: Record<string, string> = {
  'math.place-value': 'Avec des pièces de 10 ¢ et de 1 ¢, faites un montant (par exemple 47 ¢) et demandez-lui combien de dizaines et d’unités il y a.',
  'math.grouping-tens': 'Rangez des pâtes ou des blocs par paquets de 10, puis comptez les paquets et ce qui reste.',
  'math.add-sub': 'À l’épicerie, additionnez de tête deux petits nombres (18 + 7) en passant par la dizaine : 18 + 2, puis + 5.',
  'math.sequences': 'Montez l’escalier en comptant par bonds de 2, puis de 5; inventez une suite et laissez-la trouver la règle.',
  'math.counting': 'Comptez à rebours à partir de 105 pendant le brossage de dents, en faisant attention au passage de la centaine.',
  'math.representations': 'Montrez un même nombre de trois façons : avec des objets, avec les doigts et en chiffres.',
  'fr.plural': 'Jouez au « un… des… » au souper : un bateau, des bateaux; un ami, des amis. Elle dit quelle lettre on ajoute.',
  'fr.comprehension': 'Après l’histoire du soir, demandez : « Pourquoi le personnage a-t-il fait ça? Quel indice dans le texte te le dit? »',
  'fr.spelling': 'Dictez-lui 3 mots de la liste de la semaine sur une ardoise; elle vérifie elle-même avec le modèle.',
};

/** Questions to talk with her (light metacognition; never to put pressure on her). */
const TALK = [
  'Qu’est-ce qui était facile cette fois-ci? Qu’est-ce qui était difficile?',
  'Montre-moi un jeu et explique-moi comment tu trouves la réponse.',
  'Quelle astuce aimerais-tu apprendre à quelqu’un d’autre?',
  'Quand tu ne sais pas, qu’est-ce que tu fais pour trouver?',
];

/** Change in a tag's weight within a skill between two profiles (positive = it got harder). */
const wOf = (p: LearnerProfile, skillId: string, tag: string) => p[skillId]?.tags[tag]?.w ?? 0;

/** What each recognized command mistake says to the parents. */
const COMMAND_MISTAKE: Record<string, string> = {
  'en-couleur': 'la bonne chose, mais pas la bonne couleur (en anglais, la couleur vient avant le nom : « red book »)',
  'en-nom': 'la bonne couleur, mais pas le bon objet',
  'en-ordre': 'les bonnes choses, mais pas dans l’ordre (« then » = ensuite)',
  'en-contenant': 'le bon objet, mais pas au bon endroit (basket / box)',
};

/**
 * English, from the beginning up to the end of the period (research report on English: the honest measure is how many
 * words she still knows 7 days or more later, and WHAT she confuses).
 * - words met / known (first-try successes on 2 different days) / to review;
 * - retention: of the words she got right, how many she still got right 7+ days later;
 * - sound confusions: which wrong picture she chose for a sound-alike (heard «three», chose «tree»);
 * - command mistakes by kind (colour, object, order, place);
 * - «can-do» lines inspired by the CEFR for 7–10 year olds (the app's own indicators, not a certification).
 */
export function englishSection(c: Ctx, until: Date) {
  const end = iso(until); // exclusive
  const events = englishWordEvents(c).filter((e) => e.day < end);
  const rounds = all(
    c,
    `SELECT a.exercise_id, a.snapshot_json, a.wrong_answers, t.result, t.help, t.difficulty FROM attempts t JOIN assignments a ON a.id = t.assignment_id
     WHERE t.profile_id = ? AND t.skill_id IN ('en.listen-words', 'en.commands') AND t.created_at < ? ORDER BY t.created_at`,
    PROFILE_ID,
    until.toISOString(),
  );
  if (!events.length && !rounds.length) return null;
  const sched = wordSchedule(events);
  const states = Object.values(sched);
  const ret = retention(events);
  const confusions = new Map<string, { heard: string; picked: string; label: string; n: number }>();
  const mistakes = new Map<string, number>();
  const proven: Record<string, Record<number, number>> = { 'game.listen-garden': {}, 'game.garden-says': {} };
  for (const r of rounds) {
    const ex = JSON.parse(String(r.snapshot_json)) as ExerciseInstance;
    const wrong = r.wrong_answers ? (JSON.parse(String(r.wrong_answers)) as string[]) : [];
    const id = String(r.exercise_id);
    if (r.result === 'correct' && r.help === 'none' && proven[id]) proven[id]![Number(r.difficulty)] = (proven[id]![Number(r.difficulty)] ?? 0) + 1;
    if (id === 'game.listen-garden' && ex.expected.type === 'word') {
      const target = ex.expected.value;
      for (const w of wrong) {
        const pair = soundAlikes(target).find((s) => s.id === w);
        if (!pair) continue;
        const key = `${target}>${w}`;
        const cur = confusions.get(key) ?? { heard: englishWord(target)?.en ?? target, picked: englishWord(w)?.en ?? w, label: TAG_LABELS[pair.tag] ?? pair.tag, n: 0 };
        cur.n += 1;
        confusions.set(key, cur);
      }
    }
    if (id === 'game.garden-says')
      for (const w of wrong) {
        const t = evaluate(ex, w).errorType;
        if (t && COMMAND_MISTAKE[t]) mistakes.set(t, (mistakes.get(t) ?? 0) + 1);
      }
  }
  // highest level with at least 2 first-try successes (what she has really shown)
  const top = (id: string) => Math.max(0, ...Object.entries(proven[id] ?? {}).filter(([, n]) => n >= 2).map(([l]) => Number(l)));
  const listen = top('game.listen-garden');
  const cmd = top('game.garden-says');
  const canDo = [
    listen >= 1 && 'Reconnaît à l’oral des mots anglais simples (couleurs, nombres, animaux, objets de la classe).',
    listen >= 3 && 'Comprend un mot connu dans une courte phrase entendue (« Where is the cat? »).',
    listen >= 4 && 'Entend la différence entre des mots qui se ressemblent (ship / sheep, three / tree).',
    listen >= 6 && 'Comprend une courte devinette entendue en anglais.',
    cmd >= 1 && 'Fait une consigne simple entendue en anglais (« Touch the duck »).',
    cmd >= 2 && 'Comprend la couleur placée avant le nom (« the red book »).',
    cmd >= 3 && 'Suit deux consignes dans l’ordre (« then »).',
    cmd >= 4 && 'Comprend « Put the … in the … ».',
  ].filter((x): x is string => Boolean(x));
  const lastDay = iso(addDays(until, -1));
  const toReview = states
    .filter((s) => s.misses > 0 && !isKnown(s))
    .sort((a, b) => b.misses - a.misses)
    .slice(0, 8)
    .map((s) => englishWord(s.word)?.en ?? s.word);
  return {
    wordsMet: states.length,
    wordsKnown: states.filter(isKnown).length,
    dueNow: dueWords(sched, lastDay).length,
    retention: { tested: ret.tested, kept: ret.kept },
    confusions: [...confusions.values()].sort((a, b) => b.n - a.n).slice(0, 6),
    commandMistakes: [...mistakes.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, label: COMMAND_MISTAKE[type] as string, n })),
    canDo,
    toReview,
  };
}

export function buildReport(c: Ctx, kind: ReportKind, offset: number) {
  const now = c.now();
  const cur = periodBounds(kind, now, offset);
  const prev = periodBounds(kind, now, offset - 1);
  const rows = rowsBetween(c, cur.start, cur.end);
  const prevRows = rowsBetween(c, prev.start, prev.end);
  const totals = summary(rows);
  const prevTotals = summary(prevRows);

  // day-by-day activity
  const days: Array<{ date: string; answers: number; firstTry: number }> = [];
  for (let d = cur.start; d < cur.end; d = addDays(d, 1)) {
    const key = iso(d);
    const dayRows = rows.filter((r) => iso(new Date(r.created_at)) === key);
    days.push({ date: key, answers: dayRows.length, firstTry: dayRows.filter(firstTry).length });
  }

  // the learning model (the same as the Tableau de bord), at the start and end of the period
  const endIso = new Date(Math.min(cur.end.getTime(), now.getTime() + 1) - 1).toISOString();
  const pEnd = learnerProfile(c, endIso);
  const pStart = learnerProfile(c, new Date(cur.start.getTime() - 1).toISOString());
  const delayed = delayedReviews(c, cur.start, cur.end);

  // per skill
  const skillIds = [...new Set([...rows, ...prevRows].map((r) => r.skill_id))];
  const skillRows = skillIds
    .map((id) => {
      const mine = rows.filter((r) => r.skill_id === id);
      const before = prevRows.filter((r) => r.skill_id === id);
      const rate = pct(mine.filter(firstTry).length, mine.length);
      const prevRate = pct(before.filter(firstTry).length, before.length);
      const levelStart = mine.length ? parse<MasteryState | null>((mine[0] as Row).mastery_before_json, null)?.level ?? (mine[0] as Row).difficulty : null;
      const levelEnd = mine.length ? parse<MasteryState | null>((mine[mine.length - 1] as Row).mastery_after_json, null)?.level ?? null : null;
      const prevLevel = before.length ? parse<MasteryState | null>((before[before.length - 1] as Row).mastery_after_json, null)?.level ?? null : null;
      void prevLevel;
      // Trend from the ESTIMATED ability (level-adjusted) and from reviews done on another day, never from the
      // raw %: the % always drops when the engine raises the level or explores above it, and that is not a decline.
      const thetaGain = pStart[id] && pEnd[id] ? (pEnd[id]?.theta ?? 0) - (pStart[id]?.theta ?? 0) : 0;
      const rev = delayed[id] ?? { n: 0, ok: 0 };
      // a drop in ability only counts when she practised at the SAME level as before (at a new level the estimate
      // is still settling and the % drops by the engine's design)
      const sameLevel = before.length > 0 && Math.max(...mine.map((r) => r.difficulty)) <= Math.max(...before.map((r) => r.difficulty));
      let trend: 'nouveau' | 'progres' | 'stable' | 'baisse' | 'pause' | 'peu' = 'stable';
      if (!mine.length) trend = 'pause';
      else if (!before.length) trend = 'nouveau';
      else if ((levelEnd ?? 0) > (levelStart ?? 0) || thetaGain >= 0.3) trend = 'progres';
      else if ((levelEnd ?? 0) < (levelStart ?? 0) || (rev.n >= 2 && rev.ok / rev.n < 0.5) || (sameLevel && mine.length >= 4 && thetaGain <= -0.5)) trend = 'baisse';
      else if (mine.length < 3) trend = 'peu'; // few answers: no conclusion
      // help (app hint, astuce after a mistake, adult) in the period: above 30 %, the game lowers the level a little
      const helpRate = pct(mine.filter((r) => r.help !== 'none').length, mine.length);
      return { skillId: id, title: skillTitle(id), subject: skills.find((s) => s.id === id)?.subject ?? '', answers: mine.length, firstTryRate: rate, prevRate, levelStart, levelEnd, trend, reviews: rev, helpRate };
    })
    .sort((a, b) => b.answers - a.answers);

  // tags: the SAME model as the Tableau de bord (level-adjusted weights), not the raw %
  const tagNow = tagStats(rows);
  const tagPrev = tagStats(prevRows);
  // «flower.tag.math.add-sub.retenue» → «math.add-sub|retenue»
  const conqueredNow = new Set(
    (c.db
      .prepare("SELECT reward_key FROM rewards WHERE profile_id = ? AND reward_key LIKE 'flower.tag.%' AND created_at >= ? AND created_at < ?")
      .all(PROFILE_ID, cur.start.toISOString(), cur.end.toISOString()) as Array<{ reward_key: string }>).map((r) => {
      const rest = r.reward_key.slice('flower.tag.'.length);
      const dot = rest.lastIndexOf('.');
      return tk(rest.slice(0, dot), rest.slice(dot + 1));
    }),
  );
  /** Gathers the chosen tags (one row per tag, even if it appears in two skills). */
  const collect = (pick: (skillId: string, tags: string[]) => string[]) => {
    const found = new Map<string, Set<string>>();
    for (const [sid, m] of Object.entries(pEnd)) for (const t of pick(sid, Object.keys(m.tags))) (found.get(t) ?? found.set(t, new Set()).get(t))?.add(sid);
    return [...found.entries()].map(([t, sids]) => {
      // sums only the skills in which the tag made it into THIS box
      const sum = (agg: TagAgg) =>
        [...sids].reduce<{ n: number; first: number } | null>((acc, sid) => {
          const x = agg[tk(sid, t)];
          return x ? { n: (acc?.n ?? 0) + x.n, first: (acc?.first ?? 0) + x.first } : acc;
        }, null);
      const s = sum(tagNow);
      const p = sum(tagPrev);
      return {
        tag: t,
        label: TAG_LABELS[t] ?? t,
        skill: [...sids].map(skillTitle).join(', '),
        skillIds: [...sids],
        n: s?.n ?? 0,
        rate: s ? (pct(s.first, s.n) as number) : null,
        prevRate: p && p.n >= MIN_TAG ? pct(p.first, p.n) : null,
      };
    });
  };
  const nNow = (sid: string, t: string) => tagNow[tk(sid, t)]?.n ?? 0;
  const strong = collect((sid) => strongTags(pEnd[sid]));
  const weak = collect((sid) => weakTags(pEnd[sid]));
  const almost = collect((sid) => almostTags(pEnd[sid]));
  const isWeak = new Set(weak.map((x) => x.tag));
  // improving: the weight dropped (≥ 0.15) with practice in the period, or the weak point was overcome in the period
  const improving = collect((sid, ts) => ts.filter((t) => !isWeak.has(t) && (conqueredNow.has(tk(sid, t)) || (nNow(sid, t) >= 2 && wOf(pStart, sid, t) - wOf(pEnd, sid, t) >= 0.15))));
  // declining: the weight rose (≥ 0.15) while practising at the SAME level as before (or below); a new level does not count
  const seenUpTo = (sid: string, t: string) => Math.max(0, ...(pStart[sid]?.tags[t]?.levels ?? []));
  const declining = collect((sid, ts) => ts.filter((t) => nNow(sid, t) >= 2 && (tagNow[tk(sid, t)]?.maxLevel ?? 99) <= seenUpTo(sid, t) && wOf(pEnd, sid, t) - wOf(pStart, sid, t) >= 0.15));
  const lowData = totals.answers < (kind === 'week' ? 15 : 40);
  // each tag in one box only (never «super-pouvoir» and «presque gagné» at once), by priority:
  // to strengthen > almost won (to confirm) > coup de pouce > super-pouvoir > ça monte
  const shown = new Set<string>();
  const only = <T extends { tag: string }>(list: T[]) => list.filter((x) => !shown.has(x.tag) && shown.add(x.tag));
  const weakB = only(weak);
  const almostB = only(almost);
  const decliningB = only(declining);
  const strongB = only(strong);
  const improvingB = only(improving);

  // most-played games
  const gameTitles = Object.fromEntries(games.map((g) => [g.id, g.title]));
  const byGame: Record<string, number> = {};
  for (const r of rows) byGame[r.exercise_id] = (byGame[r.exercise_id] ?? 0) + 1;
  const activities = Object.entries(byGame)
    .map(([id, n]) => ({ id, title: gameTitles[id] ?? (id.includes('.') && !id.startsWith('game.') ? 'Activités sur papier' : id), answers: n }))
    .reduce<Array<{ id: string; title: string; answers: number }>>((acc, x) => {
      const same = acc.find((y) => y.title === x.title);
      if (same) same.answers += x.answers;
      else acc.push({ ...x });
      return acc;
    }, [])
    .sort((a, b) => b.answers - a.answers);

  // recommendations (short, actionable, never comparing with other children)
  const recs: string[] = [];
  const period = kind === 'week' ? 'cette semaine' : 'ce mois-ci';
  if (!rows.length) recs.push(`Aucune activité ${period}. De courtes séances de 10 à 15 minutes, plusieurs fois par semaine, valent mieux qu’une longue séance.`);
  else {
    if (totals.activeDays < (kind === 'week' ? 3 : 10)) recs.push(`Viser ${kind === 'week' ? '3 à 4 jours' : '12 à 16 jours'} de pratique courte : revenir un autre jour aide la mémoire plus qu’une longue séance.`);
    for (const w of weakB.slice(0, 2)) recs.push(`À renforcer : ${w.label} (${w.skill}). Le jeu en proposera davantage, avec des astuces.`);
    for (const a2 of almostB.slice(0, 1)) recs.push(`Presque gagné : ${a2.label}. Le jeu le vérifiera lors d’une prochaine séance, un autre jour.`);
    for (const sk of skillRows.filter((x) => x.trend === 'baisse').slice(0, 1))
      recs.push(`À revoir : ${sk.title}${sk.reviews.n ? ` — ${sk.reviews.ok} révision${sk.reviews.ok > 1 ? 's' : ''} réussie${sk.reviews.ok > 1 ? 's' : ''} sur ${sk.reviews.n}, un autre jour` : ''}. Revoir ensemble une ou deux questions, sans pression.`);
    for (const d of decliningB.slice(0, 1)) recs.push(`Petit coup de pouce : ${d.label} est devenu un peu plus difficile pour elle, même en tenant compte du niveau. Souvent passager (fatigue, nouveauté).`);
    for (const st of strongB.slice(0, 1)) recs.push(`Point fort : ${st.label}. Le jeu propose déjà des défis d’un niveau plus haut; félicitez l’effort et la stratégie, pas seulement la réussite.`);
    for (const sk of skillRows.filter((x) => x.trend === 'progres').slice(0, 1)) recs.push(`En progrès : ${sk.title}${sk.levelStart && sk.levelEnd && sk.levelEnd > sk.levelStart ? ` (niveau ${sk.levelStart} → ${sk.levelEnd})` : ''}. Bravo à souligner avec elle!`);
    const untouched = skills.filter((s) => !skillIds.includes(s.id)).map((s) => s.title);
    if (untouched.length) recs.push(`Pas pratiqué ${period} : ${untouched.slice(0, 3).join(', ')}${untouched.length > 3 ? '…' : ''}.`);
  }

  // à la maison: 1 activity, 1 question to talk about and (monthly) 1 small goal chosen with her
  const homeSkill = weak[0]?.skillIds[0] ?? skillRows.find((x) => x.trend === 'baisse')?.skillId ?? skillRows.find((x) => x.answers > 0)?.skillId ?? null;
  const home = homeSkill && HOME[homeSkill] ? { skill: skillTitle(homeSkill), text: HOME[homeSkill] as string } : null;
  const talk = TALK[Math.floor(cur.start.getTime() / (7 * 86400_000)) % TALK.length] as string;
  const goal =
    kind !== 'month'
      ? null
      : weak[0]
        ? `Choisir avec elle un petit objectif pour le mois prochain, par exemple : « ${weak[0].label.replace(/\s*\(.*\)$/, '')} ».`
        : almost[0]
          ? `Choisir avec elle un petit objectif : confirmer « ${almost[0].label.replace(/\s*\(.*\)$/, '')} » un autre jour.`
          : 'Choisir avec elle un petit objectif : un jeu qu’elle a peu essayé, ou un défi un peu plus difficile.';

  return {
    kind,
    offset,
    period: { start: iso(cur.start), end: iso(addDays(cur.end, -1)), label: cur.label },
    previous: { start: iso(prev.start), end: iso(addDays(prev.end, -1)), label: prev.label },
    generatedAt: now.toISOString(),
    totals,
    prevTotals,
    days,
    skills: skillRows,
    tags: { strong: strongB.slice(0, 6), weak: weakB.slice(0, 6), improving: improvingB.slice(0, 6), declining: decliningB.slice(0, 6), almost: almostB.slice(0, 6) },
    activities,
    recommendations: recs,
    lowData,
    home,
    talk,
    goal,
    english: englishSection(c, cur.end),
  };
}
