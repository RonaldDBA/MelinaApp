import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { almostTags, applyEvidence, comfortableLevel, conqueredTags, defaultParams, initialState, learnInto, learnProfile, roundProfile, parentChoice, planRound, selectNext, sessionLevel, strongTags, weakTags, type EngineParams, type LearnEvent, type LearnerProfile, type RoundPlan } from '@melina/adaptive-engine';
import { readHandwriting, ReadingError } from '@melina/ai';
import { evaluate, games, generateExercise, generateGameRound, getGame, getMission, hasPaper, isSchoolWeek, missions, schoolWeeks, skills, skillsBySubject, strategyPraise, tagsOf, TAG_LABELS, templates, toPublic } from '@melina/curriculum';
import { imageLimits, kindForResponse, selectSamples, sniffImage, stripMetadata, type SampleCandidate } from '@melina/handwriting';
import type {
  AssignmentStatus,
  Difficulty,
  ExerciseInstance,
  HelpLevel,
  HiddenWordsSpec,
  MasteryState,
  PublicExercise,
  ReviewStatus,
  SelectionDecision,
  Subject,
} from '@melina/shared';
import { maxLevel } from '@melina/shared';
import type { AppConfig } from './config';
import { tx, type DB } from './db';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Ctx {
  db: DB;
  cfg: AppConfig;
  now: () => Date;
  fetchImpl?: typeof fetch;
  /** injected image provider (tests); in normal use it comes from the configuration */
  imageProvider?: import('@melina/art').ImageProvider;
}

export const PROFILE_ID = 'local-profile';

// ------------------------------------------------------------------ util

const iso = (c: Ctx) => c.now().toISOString();
const json = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};
const seedFrom = (id: string) => Number.parseInt(createHash('sha1').update(id).digest('hex').slice(0, 8), 16);
export const photosDir = (c: Ctx) => join(c.cfg.dataDir, 'photos');

type Row = Record<string, unknown>;
const one = (c: Ctx, sql: string, ...p: Array<string | number | null>) => c.db.prepare(sql).get(...p) as Row | undefined;
const all = (c: Ctx, sql: string, ...p: Array<string | number | null>) => c.db.prepare(sql).all(...p) as Row[];
const run = (c: Ctx, sql: string, ...p: Array<string | number | null>) => c.db.prepare(sql).run(...p);

// ------------------------------------------------------------------ bootstrap

export const defaultSettings = {
  'ai.enabled': false,
  'ai.consentAt': null as string | null,
  'ai.maxSamples': 3,
  'engine.reviewIntervalsDays': [1, 2, 4, 7],
  'parent.nextChoice': null as null | { skillId: string; difficulty?: Difficulty },
  /** Week of the school word list the class is on («3.2» = theme 3, week 2); null = whole list. */
  'french.schoolWeek': null as string | null,
  'art.enabled': false,
  'art.consentAt': null as string | null,
  'art.dailyLimit': 12,
  'art.monthlyLimit': 120,
};
export type SettingKey = keyof typeof defaultSettings;

export function bootstrap(c: Ctx) {
  mkdirSync(photosDir(c), { recursive: true });
  mkdirSync(join(photosDir(c), 'tmp'), { recursive: true });
  mkdirSync(join(c.cfg.dataDir, 'backups'), { recursive: true });
  const now = iso(c);
  tx(c.db, () => {
    if (!one(c, 'SELECT id FROM profiles WHERE id = ?', PROFILE_ID)) {
      run(c, 'INSERT INTO profiles (id, display_name, grade, created_at) VALUES (?, ?, 2, ?)', PROFILE_ID, 'Melina', now);
    }
    for (const s of skills) {
      run(c, 'INSERT OR IGNORE INTO skills (id, version, subject, definition_json, review_status, synced_at) VALUES (?, ?, ?, ?, ?, ?)', s.id, s.version, s.subject, JSON.stringify(s), s.reviewStatus, now);
    }
    for (const t of templates) {
      run(c, 'INSERT OR IGNORE INTO exercises (id, version, skill_id, response_type, description, synced_at) VALUES (?, ?, ?, ?, ?, ?)', t.id, t.version, t.skillId, t.responseType, t.description, now);
    }
    for (const g of games) {
      run(c, 'INSERT OR IGNORE INTO exercises (id, version, skill_id, response_type, description, synced_at) VALUES (?, ?, ?, ?, ?, ?)', g.id, g.version, g.skills.join(','), g.responseType, g.description, now);
    }
    for (const m of missions) {
      run(c, 'INSERT OR IGNORE INTO missions (id, version, definition_json, synced_at) VALUES (?, ?, ?, ?)', m.id, m.version, JSON.stringify(m), now);
    }
    // AI reading interrupted (the app closed while waiting): back to «failed», the parents can redo it
    run(c, "UPDATE ai_reviews SET status = 'failed', error_code = 'interrupted', error_message = 'Lecture interrompue (le jeu a été fermé). Réessayez ou saisissez à la main.', updated_at = ? WHERE status = 'analyzing'", now);
  });
  recoverFiles(c);
}

/** Orphan files: failure between writing the photo and writing to the database. Moves them to data/photos/orphans. */
export function recoverFiles(c: Ctx): { tmpRemoved: number; orphansMoved: number } {
  const dir = photosDir(c);
  let tmpRemoved = 0;
  let orphansMoved = 0;
  const tmpDir = join(dir, 'tmp');
  for (const f of safeList(tmpDir)) {
    try {
      unlinkSync(join(tmpDir, f));
      tmpRemoved++;
    } catch {
      /* ignore */
    }
  }
  const known = new Set(all(c, 'SELECT file_name FROM photos').map((r) => String(r.file_name)));
  const orphanDir = join(dir, 'orphans');
  for (const f of safeList(dir)) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(f) || known.has(f)) continue;
    mkdirSync(orphanDir, { recursive: true });
    renameSync(join(dir, f), join(orphanDir, f));
    orphansMoved++;
  }
  return { tmpRemoved, orphansMoved };
}

function safeList(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => !f.startsWith('.'));
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------ settings

export function getSettings(c: Ctx) {
  const rows = all(c, 'SELECT key, value_json FROM settings');
  const out: Record<string, unknown> = { ...defaultSettings };
  for (const r of rows) out[String(r.key)] = json(String(r.value_json), null);
  return out as typeof defaultSettings;
}

export function setSetting<K extends SettingKey>(c: Ctx, key: K, value: (typeof defaultSettings)[K]) {
  run(c, 'INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at', key, JSON.stringify(value), iso(c));
}

export function patchSettings(c: Ctx, body: Record<string, unknown>) {
  const allowed: SettingKey[] = ['ai.enabled', 'ai.maxSamples', 'engine.reviewIntervalsDays', 'parent.nextChoice', 'french.schoolWeek', 'art.enabled', 'art.dailyLimit', 'art.monthlyLimit'];
  tx(c.db, () => {
    for (const [k, v] of Object.entries(body)) {
      if (k === 'ai.consent' || k === 'art.consent') continue;
      if (!allowed.includes(k as SettingKey)) throw new HttpError(400, 'unknown-setting', `Paramètre inconnu : ${k}`);
      if (k === 'ai.enabled') {
        if (typeof v !== 'boolean') throw new HttpError(400, 'invalid', 'ai.enabled doit être un booléen');
        // Enabling requires explicit informed consent in the same request.
        if (v && body['ai.consent'] !== true) throw new HttpError(400, 'consent-required', 'Pour activer l’IA, vous devez accepter l’envoi des images au fournisseur externe.');
        setSetting(c, 'ai.enabled', v);
        setSetting(c, 'ai.consentAt', v ? iso(c) : null);
      } else if (k === 'art.enabled') {
        if (typeof v !== 'boolean') throw new HttpError(400, 'invalid', 'art.enabled doit être un booléen');
        // Enabling requires accepting, in the same request, that image requests are sent to external providers.
        if (v && body['art.consent'] !== true) throw new HttpError(400, 'consent-required', 'Pour activer la génération d’art, vous devez accepter l’envoi des demandes au fournisseur d’images externe.');
        setSetting(c, 'art.enabled', v);
        setSetting(c, 'art.consentAt', v ? iso(c) : null);
      } else if (k === 'art.dailyLimit' || k === 'art.monthlyLimit') {
        if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 2000) throw new HttpError(400, 'invalid', 'Limite entre 0 et 2000 images');
        setSetting(c, k, v as number);
      } else if (k === 'ai.maxSamples') {
        if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 5) throw new HttpError(400, 'invalid', 'ai.maxSamples entre 0 et 5');
        setSetting(c, 'ai.maxSamples', v as number);
      } else if (k === 'engine.reviewIntervalsDays') {
        if (!Array.isArray(v) || v.length < 1 || v.length > 8 || v.some((d) => !Number.isFinite(d) || d <= 0 || d > 60))
          throw new HttpError(400, 'invalid', 'Intervalles invalides');
        setSetting(c, 'engine.reviewIntervalsDays', v as number[]);
      } else if (k === 'parent.nextChoice') {
        if (v !== null) {
          const o = v as { skillId?: string; difficulty?: number };
          if (!skills.some((s) => s.id === o.skillId)) throw new HttpError(400, 'invalid', 'Compétence invalide');
          if (o.difficulty !== undefined && !(Number.isInteger(o.difficulty) && o.difficulty >= 1 && o.difficulty <= skillMax(String(o.skillId)))) throw new HttpError(400, 'invalid', 'Niveau invalide');
        }
        setSetting(c, 'parent.nextChoice', v as typeof defaultSettings['parent.nextChoice']);
      } else if (k === 'french.schoolWeek') {
        if (v !== null && !isSchoolWeek(v)) throw new HttpError(400, 'invalid', 'Semaine inconnue dans la liste de l’école');
        setSetting(c, 'french.schoolWeek', v as string | null);
      }
    }
  });
  return publicSettings(c);
}

export function publicSettings(c: Ctx) {
  const s = getSettings(c);
  return {
    ...s,
    aiKeyConfigured: Boolean(c.cfg.apiKey),
    aiModel: c.cfg.model,
    // school list, so the parents can pick the week (and see which words go into the grid)
    schoolWeeks: schoolWeeks.map((w) => ({ key: w.key, label: w.label, words: w.words })),
  };
}

// ------------------------------------------------------------------ model that learns from her

/** All evaluated answers, in order, with the exercise's tags: this is what the model learns from. */
/** Local day («2026-11-17») of an ISO instant, on the family computer's clock. */
export const localDay = (isoAt: string) => {
  const d = new Date(isoAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

type LearnRow = { rowid: number; skill_id: string; difficulty: number; result: string; help: string; created_at: string; snapshot_json: string };
const toEvent = (r: LearnRow): LearnEvent => {
  const ex = json<ExerciseInstance | null>(String(r.snapshot_json), null);
  return {
    skillId: String(r.skill_id),
    level: Number(r.difficulty),
    tags: ex ? tagsOf(ex) : [],
    outcome: r.result !== 'correct' ? 'wrong' : r.help === 'none' ? 'first' : 'retry',
    day: localDay(String(r.created_at)),
    // picture choice by ear (English): a lucky tap counts as weaker evidence (guessing floor)
    ...(ex?.game?.game === 'listen-pick' ? { guess: 1 / ex.game.options.length } : {}),
  };
};
const LEARN_SQL = `SELECT t.rowid AS rowid, t.skill_id, t.difficulty, t.result, t.help, t.created_at, a.snapshot_json
  FROM attempts t JOIN assignments a ON a.id = t.assignment_id WHERE t.profile_id = ?`;

/**
 * Already-computed profile, per database: the model is online, so each new answer is just APPLIED to the stored profile
 * (before, the whole history was re-read 2 to 4 times per answer: ~850 ms with 20 000 answers).
 * Safeguards: if any answer disappeared or arrived out of order, everything is recomputed.
 */
const learnCache = new WeakMap<DB, { count: number; lastRowid: number; lastAt: string; profile: LearnerProfile }>();
/** Forgets the stored profile (tests; or after deleting answers). */
export const resetLearnerCache = (db: DB) => learnCache.delete(db);

/** Model profile with all answers up to `until` (ISO, inclusive) or with the whole history. */
export function learnerProfile(c: Ctx, until?: string): LearnerProfile {
  const head = one(c, 'SELECT COUNT(*) AS n, MAX(created_at) AS at FROM attempts WHERE profile_id = ?', PROFILE_ID) as { n: number; at: string | null };
  // past period (report, old answer): full computation up to the requested date
  if (until !== undefined && head.at !== null && until < head.at) {
    const rows = all(c, `${LEARN_SQL} AND t.created_at <= ? ORDER BY t.created_at, t.id`, PROFILE_ID, until) as unknown as LearnRow[];
    return learnProfile(rows.map(toEvent));
  }
  const cached = learnCache.get(c.db);
  let fresh: LearnRow[] | null = null;
  if (cached && Number(head.n) >= cached.count) {
    fresh = all(c, `${LEARN_SQL} AND t.rowid > ? ORDER BY t.created_at, t.id`, PROFILE_ID, cached.lastRowid) as unknown as LearnRow[];
    const inOrder = fresh.every((r) => r.created_at > cached.lastAt);
    if (cached.count + fresh.length !== Number(head.n) || !inOrder) fresh = null; // something changed in between: recompute
  }
  if (cached && fresh) {
    if (fresh.length) {
      learnInto(cached.profile, fresh.map(toEvent));
      const last = fresh[fresh.length - 1] as LearnRow;
      cached.count += fresh.length;
      cached.lastRowid = Math.max(cached.lastRowid, ...fresh.map((r) => Number(r.rowid)));
      cached.lastAt = String(last.created_at);
    }
    return roundProfile(cached.profile);
  }
  const rows = all(c, `${LEARN_SQL} ORDER BY t.created_at, t.id`, PROFILE_ID) as unknown as LearnRow[];
  const profile = learnInto({}, rows.map(toEvent));
  const last = rows[rows.length - 1];
  learnCache.set(c.db, { count: rows.length, lastRowid: Math.max(0, ...rows.map((r) => Number(r.rowid))), lastAt: last ? String(last.created_at) : '', profile });
  return roundProfile(profile);
}

/**
 * Adjusts the engine's decision with what the model learned: reinforcing weak points or exploring
 * strong points (one level up). Parent choice and reinforcement after consecutive mistakes take priority.
 */
/** Hint limit (owner's decision, 18/11/2026): more than 30 % of the last 10 answers with help. */
export const HINT_ALARM = { last: 10, minAnswers: 5, rate: 0.3 } as const;

/** Use of help (app hint, astuce after a mistake, or adult) in a skill's latest answers. */
export function recentHelp(c: Ctx, skillId: string): { n: number; helped: number; rate: number } {
  const rows = all(c, 'SELECT help FROM attempts WHERE profile_id = ? AND skill_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?', PROFILE_ID, skillId, HINT_ALARM.last);
  const helped = rows.filter((r) => r.help !== 'none').length;
  return { n: rows.length, helped, rate: rows.length ? helped / rows.length : 0 };
}

/**
 * Level of TODAY's play for a skill (session staircase, `sessionLevel`): it starts where she was before the first answer
 * of the day (the official level, or the higher level already proven and waiting for confirmation) and climbs one step
 * per 3 first-try successes in a row, going down one step per error, never below the current official level.
 */
export function todayLevel(c: Ctx, skillId: string): number {
  const now = c.now();
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const rows = all(c, 'SELECT difficulty, result, help, mastery_before_json FROM attempts WHERE profile_id = ? AND skill_id = ? AND created_at >= ? ORDER BY created_at, rowid', PROFILE_ID, skillId, since);
  const current = getMastery(c, skillId) ?? initialState(skillId);
  const before = rows.length ? json<MasteryState>(String(rows[0]?.mastery_before_json), current) : current;
  const start = Math.max(before.level, before.pendingAdvance?.level ?? 0);
  const answers = rows.map((r) => ({ difficulty: Number(r.difficulty), correct: r.result === 'correct', help: String(r.help) as 'none' | 'hint' | 'adult' }));
  return sessionLevel(answers, start, current.level, skillMax(skillId)).level;
}

function applyLearner(c: Ctx, decision: SelectionDecision, seed: number): { decision: SelectionDecision; plan: RoundPlan | null } {
  if (decision.reasonCode === 'parent-choice') return { decision, plan: null };
  // HINT ALARM: help in more than 30 % of the last 10 answers = level too hard for her right now.
  // Instead of moving up or exploring, the round comes one level lower to consolidate; the official level does not
  // change, and the alarm clears by itself when she gets answers right without help again.
  const h = recentHelp(c, decision.skillId);
  const helpAlarm = h.n >= HINT_ALARM.minAnswers && h.rate > HINT_ALARM.rate;
  const current = Math.min(decision.difficulty, getMastery(c, decision.skillId)?.level ?? decision.difficulty);
  if (helpAlarm && current > 1) {
    const level = (current - 1) as Difficulty;
    return {
      decision: {
        ...decision,
        difficulty: level,
        reasonCode: 'learner-reinforce',
        reason: `Beaucoup d’aide récemment (indice dans ${Math.round(h.rate * 100)} % des ${h.n} dernières réponses) : on consolide au niveau ${level}.`,
      },
      plan: null,
    };
  }
  const plan = planRound(learnerProfile(c), decision.skillId, decision.difficulty, skillMax(decision.skillId), (seed % 1000) / 1000, TAG_LABELS, {
    // at level 1 there is no way down: with the hint alarm, at least no exploring above
    allowExplore: decision.reasonCode !== 'reinforcement' && !helpAlarm,
    pendingLevel: getMastery(c, decision.skillId)?.pendingAdvance?.level ?? null,
    // the staircase only climbs from a round at the official level (not from a review or a parent's choice below it)
    sessionLevel: decision.difficulty >= (getMastery(c, decision.skillId)?.level ?? 1) ? todayLevel(c, decision.skillId) : undefined,
  });
  if (plan.mode === 'standard') return { decision, plan: null };
  return { decision: { ...decision, difficulty: plan.level, reasonCode: plan.reasonCode, reason: `${plan.reason} ${decision.reason}`.trim() }, plan };
}

/**
 * Reward that INFORMS (research: the reward should say "you know more", not pay for playing):
 * a flower in the garden when a level is confirmed. One per skill and level.
 */
function plantFlower(c: Ctx, skillId: string, after: MasteryState, now: string) {
  if (after.lastLevelChange !== 'advanced') return;
  const title = skills.find((s) => s.id === skillId)?.titleFr ?? skillId;
  run(c, 'INSERT OR IGNORE INTO rewards (profile_id, reward_key, label, source, created_at) VALUES (?, ?, ?, ?, ?)', PROFILE_ID, `flower.${skillId}.${after.level}`, `une fleur : ${title}, niveau ${after.level}`, `level:${skillId}:${after.level}`, now);
}

/**
 * Weak point that is no longer weak (research: big celebration only for milestones that mean something):
 * the tag was weak (weight ≥ 0.2) and, with this answer, the weight dropped to ≤ 0.05 (`conqueredTags`).
 * Once per skill and tag: plants a flower and the result carries `conquered`.
 */
function celebrateConquest(c: Ctx, ex: ExerciseInstance, attemptId: string, prev: LearnerProfile, now: string) {
  const nowProfile = learnerProfile(c);
  const before = prev[ex.skillId];
  const after = nowProfile[ex.skillId];
  if (!before || !after) return;
  const won = new Set(conqueredTags(before, after));
  // the most specific tag first: «retenue» says more than the generic «addition»
  for (const t of [...tagsOf(ex)].reverse()) {
    if (!won.has(t)) continue;
    const label = TAG_LABELS[t] ?? t;
    // one flower per overcome tag (the screen celebrates the most specific one, which comes first)
    run(c, 'INSERT OR IGNORE INTO rewards (profile_id, reward_key, label, source, created_at) VALUES (?, ?, ?, ?, ?)', PROFILE_ID, `flower.tag.${ex.skillId}.${t}`, `un point fort gagné : ${label}`, `conquered:${attemptId}:${t}`, now);
  }
}

/** Up to which level the skill goes (3 by default; Orthographe goes up to 5). */
function skillMax(skillId: string): Difficulty {
  const sk = skills.find((x) => x.id === skillId);
  return sk ? maxLevel(sk) : 3;
}

function engineParams(c: Ctx): EngineParams {
  return { ...defaultParams, reviewIntervalsDays: getSettings(c)['engine.reviewIntervalsDays'] };
}

// ------------------------------------------------------------------ mastery

export function getMastery(c: Ctx, skillId: string): MasteryState | undefined {
  const r = one(c, 'SELECT state_json FROM mastery WHERE profile_id = ? AND skill_id = ?', PROFILE_ID, skillId);
  return r ? json<MasteryState>(String(r.state_json), initialState(skillId)) : undefined;
}

function allMastery(c: Ctx): Record<string, MasteryState> {
  const out: Record<string, MasteryState> = {};
  for (const r of all(c, 'SELECT skill_id, state_json FROM mastery WHERE profile_id = ?', PROFILE_ID)) {
    out[String(r.skill_id)] = json<MasteryState>(String(r.state_json), initialState(String(r.skill_id)));
  }
  return out;
}

// ------------------------------------------------------------------ sessions & assignments

export function startSession(c: Ctx, body: { mode?: string; missionId?: string; subject?: string }) {
  const mode = body.mode === 'mission' ? 'mission' : 'practice';
  let missionId: string | null = null;
  if (mode === 'mission') {
    missionId = String(body.missionId ?? '');
    try {
      getMission(missionId);
    } catch {
      throw new HttpError(400, 'unknown-mission', 'Mission inconnue.');
    }
  }
  const subject = body.subject === 'french' || body.subject === 'mathematics' ? body.subject : null;
  const id = randomUUID();
  tx(c.db, () => {
    run(c, 'INSERT INTO sessions (id, profile_id, mode, mission_id, subject, started_at) VALUES (?, ?, ?, ?, ?, ?)', id, PROFILE_ID, mode, missionId, subject, iso(c));
    if (missionId) {
      run(c, "INSERT OR IGNORE INTO mission_progress (profile_id, mission_id, status, started_at) VALUES (?, ?, 'active', ?)", PROFILE_ID, missionId, iso(c));
    }
  });
  return { id, mode, missionId, subject };
}

const OPEN_STATUSES: AssignmentStatus[] = ['presented', 'answered_on_paper', 'in_review', 'illegible'];

export function missionState(c: Ctx, missionId: string) {
  const m = getMission(missionId);
  const prog = one(c, 'SELECT status, started_at, completed_at FROM mission_progress WHERE profile_id = ? AND mission_id = ?', PROFILE_ID, missionId);
  const steps = all(c, 'SELECT step_index, completed_at FROM mission_steps WHERE profile_id = ? AND mission_id = ? ORDER BY step_index', PROFILE_ID, missionId);
  const done = new Set(steps.map((s) => Number(s.step_index)));
  const nextStep = m.steps.find((s) => !done.has(s.index))?.index ?? null;
  return {
    mission: m,
    status: (prog?.status as string | undefined) ?? 'not-started',
    completedSteps: [...done].sort((a, b) => a - b),
    nextStep,
    completedAt: (prog?.completed_at as string | null) ?? null,
  };
}

export function createAssignment(c: Ctx, body: { sessionId?: string; missionStep?: number; subject?: string }) {
  const session = one(c, 'SELECT * FROM sessions WHERE id = ? AND profile_id = ?', String(body.sessionId ?? ''), PROFILE_ID);
  if (!session) throw new HttpError(404, 'session-not-found', 'Séance introuvable.');

  let subject: Subject | 'any' = (body.subject === 'french' || body.subject === 'mathematics' ? body.subject : (session.subject as Subject | null)) ?? 'any';
  let missionId: string | null = null;
  let missionStep: number | null = null;

  if (session.mode === 'mission') {
    missionId = String(session.mission_id);
    const st = missionState(c, missionId);
    const step = Number(body.missionStep);
    if (!Number.isInteger(step) || st.nextStep === null || step !== st.nextStep) {
      throw new HttpError(409, 'step-not-available', 'Cette étape de la mission n’est pas disponible pour l’instant.');
    }
    missionStep = step;
    subject = st.mission.steps[step]?.subject ?? 'any';
    // Resume: if an open exercise already exists for this step, return the same one (no duplicate).
    const open = one(
      c,
      `SELECT id FROM assignments WHERE profile_id = ? AND mission_id = ? AND mission_step = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT 1`,
      PROFILE_ID,
      missionId,
      step,
      ...OPEN_STATUSES,
    );
    if (open) return getAssignment(c, String(open.id));
  }

  const id = randomUUID();
  const now = c.now();
  const settings = getSettings(c);
  const states = allMastery(c);
  const lastRow = one(c, 'SELECT skill_id FROM assignments WHERE profile_id = ? ORDER BY created_at DESC LIMIT 1', PROFILE_ID);
  // paper only: the English listening skills are played on screen (no paper activity, no reading)
  const candidates = skillsBySubject(subject).filter((s) => hasPaper(s.id));

  let decision;
  const choice = settings['parent.nextChoice'];
  if (choice && candidates.some((s) => s.id === choice.skillId)) {
    decision = parentChoice(choice.skillId, states[choice.skillId], choice.difficulty);
  } else {
    decision = selectNext({ skills: candidates, states, allStates: states, now, lastSkillId: (lastRow?.skill_id as string) ?? null, params: engineParams(c) });
  }

  const learned = applyLearner(c, decision, seedFrom(id));
  decision = learned.decision;
  const recentKeys = all(c, 'SELECT question_key FROM assignments WHERE profile_id = ? AND skill_id = ? ORDER BY created_at DESC LIMIT 6', PROFILE_ID, decision.skillId).map((r) => String(r.question_key));
  const ex = generateExercise(decision.skillId, decision.difficulty, seedFrom(id), recentKeys, learned.plan?.prefer);

  tx(c.db, () => {
    run(
      c,
      `INSERT INTO assignments (id, session_id, profile_id, skill_id, exercise_id, exercise_version, difficulty, question_key, snapshot_json,
        selection_reason_code, selection_reason, mission_id, mission_step, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'presented', ?, ?)`,
      id,
      String(session.id),
      PROFILE_ID,
      ex.skillId,
      ex.exerciseId,
      ex.exerciseVersion,
      ex.difficulty,
      ex.questionKey,
      JSON.stringify(ex),
      decision.reasonCode,
      decision.reason,
      missionId,
      missionStep,
      now.toISOString(),
      now.toISOString(),
    );
    if (decision.reasonCode === 'parent-choice') setSetting(c, 'parent.nextChoice', null);
  });
  return getAssignment(c, id);
}

function loadAssignment(c: Ctx, id: string) {
  const a = one(c, 'SELECT * FROM assignments WHERE id = ? AND profile_id = ?', id, PROFILE_ID);
  if (!a) throw new HttpError(404, 'assignment-not-found', 'Exercice introuvable.');
  return { row: a, ex: json<ExerciseInstance>(String(a.snapshot_json), null as unknown as ExerciseInstance) };
}

export interface AssignmentView {
  id: string;
  status: AssignmentStatus;
  exercise: PublicExercise;
  hintUsed: boolean;
  missionId: string | null;
  missionStep: number | null;
  selectionReason: string;
  createdAt: string;
  reviews: ReturnType<typeof reviewView>[];
  outcome: ReturnType<typeof outcomeView> | null;
}

export function getAssignment(c: Ctx, id: string): AssignmentView {
  const { row, ex } = loadAssignment(c, id);
  const reviews = all(c, 'SELECT * FROM ai_reviews WHERE assignment_id = ? ORDER BY created_at', id).map(reviewView);
  const attempt = one(c, 'SELECT * FROM attempts WHERE assignment_id = ?', id);
  return {
    id,
    status: row.status as AssignmentStatus,
    exercise: toPublic(ex),
    hintUsed: Number(row.hint_used) === 1,
    missionId: (row.mission_id as string | null) ?? null,
    missionStep: row.mission_step === null ? null : Number(row.mission_step),
    selectionReason: String(row.selection_reason),
    createdAt: String(row.created_at),
    reviews,
    // The expected answer only appears after confirmation.
    outcome: attempt ? outcomeView(c, attempt, ex) : null,
  };
}

function setAssignmentStatus(c: Ctx, id: string, status: AssignmentStatus) {
  run(c, 'UPDATE assignments SET status = ?, updated_at = ? WHERE id = ?', status, iso(c), id);
}

export function markHint(c: Ctx, id: string) {
  const { row } = loadAssignment(c, id);
  if (!OPEN_STATUSES.includes(row.status as AssignmentStatus)) throw new HttpError(409, 'closed', 'Cet exercice est déjà terminé.');
  run(c, 'UPDATE assignments SET hint_used = 1, updated_at = ? WHERE id = ?', iso(c), id);
  return getAssignment(c, id);
}

/** Paper routes (sheet, photo, transcription, confirmation) do not apply to on-screen game rounds. */
function ensurePaper(row: Row) {
  if (row.input_mode === 'screen') throw new HttpError(400, 'not-paper', 'Cette manche se joue à l’écran, pas sur papier.');
}

export function markDone(c: Ctx, id: string) {
  const { row } = loadAssignment(c, id);
  ensurePaper(row);
  if (row.status === 'presented') {
    run(c, "UPDATE assignments SET status = 'answered_on_paper', done_at = COALESCE(done_at, ?), updated_at = ? WHERE id = ?", iso(c), iso(c), id);
  } else if (!OPEN_STATUSES.includes(row.status as AssignmentStatus)) throw new HttpError(409, 'closed', 'Cet exercice est déjà terminé.');
  return getAssignment(c, id);
}

export function cancelAssignment(c: Ctx, id: string) {
  const { row } = loadAssignment(c, id);
  if (row.status === 'confirmed') throw new HttpError(409, 'already-confirmed', 'Cet exercice a déjà été confirmé.');
  if (row.status === 'cancelled') return getAssignment(c, id);
  tx(c.db, () => {
    run(c, "UPDATE ai_reviews SET status = 'cancelled', updated_at = ? WHERE assignment_id = ? AND status IN ('pending','suggested','failed','analyzing')", iso(c), id);
    setAssignmentStatus(c, id, 'cancelled');
  });
  return getAssignment(c, id);
}

export function pendingAssignments(c: Ctx) {
  return all(c, `SELECT id FROM assignments WHERE profile_id = ? AND status IN ('answered_on_paper','in_review','illegible','presented') AND input_mode = 'paper' ORDER BY created_at DESC LIMIT 20`, PROFILE_ID).map((r) =>
    getAssignment(c, String(r.id)),
  );
}

// ------------------------------------------------------------------ photos & reviews

function reviewView(r: Row) {
  return {
    id: String(r.id),
    assignmentId: String(r.assignment_id),
    source: r.source as 'photo' | 'manual',
    status: r.status as ReviewStatus,
    hasPhoto: r.photo_id !== null,
    photoId: (r.photo_id as string | null) ?? null,
    readingOrigin: (r.reading_origin as string | null) ?? null,
    suggestedText: (r.suggested_text as string | null) ?? null,
    draftText: (r.draft_text as string | null) ?? null,
    finalText: (r.final_text as string | null) ?? null,
    uncertain: json<string[]>(r.uncertain_json as string, []),
    modelConfidence: (r.model_confidence as string | null) ?? null,
    model: (r.model as string | null) ?? null,
    samplesUsed: json<Array<{ id: string; why: string }>>(r.samples_used_json as string, []),
    errorCode: (r.error_code as string | null) ?? null,
    errorMessage: (r.error_message as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

function loadReview(c: Ctx, id: string) {
  const r = one(c, 'SELECT * FROM ai_reviews WHERE id = ?', id);
  if (!r) throw new HttpError(404, 'review-not-found', 'Lecture introuvable.');
  return r;
}

function ensureReviewable(status: string) {
  if (status === 'confirmed') throw new HttpError(409, 'already-confirmed', 'Cet exercice a déjà été confirmé.');
  if (status === 'cancelled') throw new HttpError(409, 'cancelled', 'Cet exercice a été annulé.');
}

export function savePhoto(c: Ctx, assignmentId: string, data: Buffer) {
  const { row } = loadAssignment(c, assignmentId);
  ensurePaper(row);
  ensureReviewable(String(row.status));
  if (data.length > imageLimits.maxBytes) throw new HttpError(413, 'too-large', 'La photo est trop volumineuse (maximum 8 Mo).');
  const info = sniffImage(new Uint8Array(data));
  if (!info) throw new HttpError(415, 'invalid-image', 'Le fichier n’est pas une image JPEG, PNG ou WebP valide.');
  if (info.width > imageLimits.maxSide || info.height > imageLimits.maxSide || info.width < imageLimits.minSide || info.height < imageLimits.minSide)
    throw new HttpError(422, 'bad-dimensions', 'Résolution de l’image hors des limites permises.');

  const clean = Buffer.from(stripMetadata(new Uint8Array(data), info.mime));
  const sha = createHash('sha256').update(clean).digest('hex');

  // Accidental re-upload of the same photo for the same exercise: return the existing reading.
  const dup = one(
    c,
    `SELECT r.id FROM ai_reviews r JOIN photos p ON p.id = r.photo_id
     WHERE r.assignment_id = ? AND p.sha256 = ? AND r.status IN ('pending','analyzing','suggested','failed')`,
    assignmentId,
    sha,
  );
  if (dup) return { review: reviewView(loadReview(c, String(dup.id))), duplicate: true };

  const photoId = randomUUID();
  const ext = info.mime === 'image/jpeg' ? 'jpg' : info.mime === 'image/png' ? 'png' : 'webp';
  const fileName = `${photoId}.${ext}`;
  const tmp = join(photosDir(c), 'tmp', `${fileName}.part`);
  const finalPath = join(photosDir(c), fileName);
  writeFileSync(tmp, clean);
  const reviewId = randomUUID();
  try {
    tx(c.db, () => {
      const now = iso(c);
      // Earlier still-open readings of this exercise are cancelled (the new photo replaces them), including an
      // AI reading in progress: its result is discarded when it arrives
      run(c, "UPDATE ai_reviews SET status = 'cancelled', updated_at = ? WHERE assignment_id = ? AND status IN ('pending','suggested','failed','analyzing')", now, assignmentId);
      run(c, 'UPDATE assignments SET done_at = COALESCE(done_at, ?) WHERE id = ?', now, assignmentId);
      run(c, 'INSERT INTO photos (id, assignment_id, file_name, mime, bytes, width, height, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', photoId, assignmentId, fileName, info.mime, clean.length, info.width, info.height, sha, now);
      run(c, "INSERT INTO ai_reviews (id, assignment_id, photo_id, source, status, created_at, updated_at) VALUES (?, ?, ?, 'photo', 'pending', ?, ?)", reviewId, assignmentId, photoId, now, now);
      setAssignmentStatus(c, assignmentId, 'in_review');
      renameSync(tmp, finalPath); // inside the transaction: if it fails, the database rolls back
    });
  } catch (e) {
    for (const p of [tmp, finalPath]) if (existsSync(p)) unlinkSync(p);
    throw e;
  }
  return { review: reviewView(loadReview(c, reviewId)), duplicate: false };
}

export function createManualReview(c: Ctx, assignmentId: string) {
  const { row } = loadAssignment(c, assignmentId);
  ensurePaper(row);
  ensureReviewable(String(row.status));
  const open = one(c, "SELECT id FROM ai_reviews WHERE assignment_id = ? AND source = 'manual' AND status = 'pending'", assignmentId);
  if (open) return { review: reviewView(loadReview(c, String(open.id))), duplicate: true };
  const id = randomUUID();
  tx(c.db, () => {
    const now = iso(c);
    run(c, "UPDATE ai_reviews SET status = 'cancelled', updated_at = ? WHERE assignment_id = ? AND status IN ('pending','suggested','failed','analyzing')", now, assignmentId);
    run(c, "INSERT INTO ai_reviews (id, assignment_id, source, status, created_at, updated_at) VALUES (?, ?, 'manual', 'pending', ?, ?)", id, assignmentId, now, now);
    run(c, 'UPDATE assignments SET done_at = COALESCE(done_at, ?) WHERE id = ?', now, assignmentId);
    setAssignmentStatus(c, assignmentId, 'in_review');
  });
  return { review: reviewView(loadReview(c, id)), duplicate: false };
}

export function readPhoto(c: Ctx, photoId: string) {
  const p = one(c, 'SELECT file_name, mime FROM photos WHERE id = ? AND deleted_at IS NULL', photoId);
  if (!p) throw new HttpError(404, 'photo-not-found', 'Photo introuvable.');
  const file = join(photosDir(c), String(p.file_name));
  if (!existsSync(file)) throw new HttpError(404, 'photo-missing', 'Fichier de la photo introuvable.');
  return { data: readFileSync(file), mime: String(p.mime) };
}

export async function analyzeReview(c: Ctx, reviewId: string) {
  const r = loadReview(c, reviewId);
  if (r.source !== 'photo' || !r.photo_id) throw new HttpError(400, 'no-photo', 'Cette lecture n’a pas de photo.');
  if (!['pending', 'failed', 'suggested'].includes(String(r.status))) {
    if (r.status === 'analyzing') throw new HttpError(409, 'busy', 'La lecture est déjà en cours.');
    ensureReviewable(String(r.status));
    throw new HttpError(409, 'invalid-state', 'L’état de la lecture ne permet pas une nouvelle analyse.');
  }
  const settings = getSettings(c);
  if (!settings['ai.enabled'] || !settings['ai.consentAt']) throw new HttpError(403, 'ai-disabled', 'La lecture par IA est désactivée. Utilisez la transcription manuelle.');
  if (!c.cfg.apiKey) throw new HttpError(503, 'no-key', 'La clé de l’API n’est pas configurée dans le fichier .env.');

  const { ex } = loadAssignment(c, String(r.assignment_id));
  const photo = readPhoto(c, String(r.photo_id));
  const kind = kindForResponse(ex.responseType);
  const candidates: SampleCandidate[] = all(
    c,
    'SELECT id, kind, transcription, quality, allow_external, skill_id, created_at FROM handwriting_samples WHERE profile_id = ? AND deleted_at IS NULL AND allow_external = 1',
    PROFILE_ID,
  ).map((s) => ({
    id: String(s.id),
    kind: s.kind as SampleCandidate['kind'],
    transcription: String(s.transcription),
    quality: Number(s.quality) as 1 | 2 | 3,
    allowExternal: Number(s.allow_external) === 1,
    skillId: (s.skill_id as string | null) ?? null,
    createdAt: String(s.created_at),
  }));
  const chosen = selectSamples(candidates, { kind, skillId: ex.skillId, max: settings['ai.maxSamples'], externalOnly: true });
  const samples = chosen.flatMap((s) => {
    const row = one(c, 'SELECT p.id FROM handwriting_samples h JOIN photos p ON p.id = h.photo_id WHERE h.id = ?', s.id);
    if (!row) return [];
    try {
      const img = readPhoto(c, String(row.id));
      return [{ mime: img.mime, base64: img.data.toString('base64'), transcription: s.transcription }];
    } catch {
      return [];
    }
  });

  run(c, "UPDATE ai_reviews SET status = 'analyzing', error_code = NULL, error_message = NULL, updated_at = ? WHERE id = ?", iso(c), reviewId);
  try {
    const result = await readHandwriting({
      apiKey: c.cfg.apiKey,
      model: c.cfg.model,
      image: { mime: photo.mime, base64: photo.data.toString('base64') },
      readingHint: ex.readingHint, // never the expected answer nor the question text
      samples,
      fetchImpl: c.fetchImpl,
    });
    const latest = loadReview(c, reviewId);
    if (latest.status !== 'analyzing') return reviewView(latest); // cancelled while reading
    run(
      c,
      "UPDATE ai_reviews SET status = 'suggested', reading_origin = 'ai', suggested_text = ?, draft_text = ?, uncertain_json = ?, model_confidence = ?, model = ?, samples_used_json = ?, updated_at = ? WHERE id = ?",
      result.transcription,
      result.transcription,
      JSON.stringify(result.illegible ? [...result.uncertain, '(le modèle a jugé l’écriture illisible)'] : result.uncertain),
      result.confidence,
      result.model,
      JSON.stringify(chosen.map((s) => ({ id: s.id, why: s.why }))),
      iso(c),
      reviewId,
    );
  } catch (e) {
    const err = e instanceof ReadingError ? e : new ReadingError('unavailable', 'Échec inattendu de la lecture.');
    run(c, "UPDATE ai_reviews SET status = 'failed', error_code = ?, error_message = ?, updated_at = ? WHERE id = ? AND status = 'analyzing'", err.code, err.message, iso(c), reviewId);
  }
  return reviewView(loadReview(c, reviewId));
}

export function updateTranscription(c: Ctx, reviewId: string, text: unknown) {
  const r = loadReview(c, reviewId);
  ensureReviewable(String(r.status));
  if (r.status === 'illegible') throw new HttpError(409, 'illegible', 'Lecture marquée comme illisible.');
  // during the AI reading, typed text would be overwritten by its result
  if (r.status === 'analyzing') throw new HttpError(409, 'busy', 'Attendez la fin de la lecture par l’IA.');
  if (typeof text !== 'string' || text.length > 500) throw new HttpError(400, 'invalid-text', 'Transcription invalide (maximum 500 caractères).');
  run(c, 'UPDATE ai_reviews SET draft_text = ?, updated_at = ? WHERE id = ?', text, iso(c), reviewId);
  return reviewView(loadReview(c, reviewId));
}

// ------------------------------------------------------------------ confirmation (core)

export interface ConfirmBody {
  text?: unknown;
  illegible?: unknown;
  help?: unknown;
  saveSample?: unknown;
  allowExternal?: unknown;
  quality?: unknown;
}

/**
 * PROCESS praise with the round's real data (packages/curriculum/src/praise.ts). After a corrected mistake,
 * the praise goes to persistence. Without the child's name (the voice may be an online service).
 */
const praiseFor = (ex: ExerciseInstance, result: string, help: string): string | null =>
  result !== 'correct' ? null : help === 'none' ? strategyPraise(ex) : 'Tu n’as pas abandonné et tu as trouvé!';

function outcomeView(c: Ctx, attempt: Row, ex: ExerciseInstance) {
  const mission = attempt.id ? one(c, 'SELECT mission_id, step_index FROM mission_steps WHERE attempt_id = ?', String(attempt.id)) : undefined;
  const before = json<MasteryState | null>(attempt.mastery_before_json as string, null);
  const after = json<MasteryState | null>(attempt.mastery_after_json as string, null);
  return {
    attemptId: String(attempt.id),
    result: attempt.result as 'correct' | 'incorrect',
    confirmedAnswer: String(attempt.confirmed_answer),
    help: attempt.help as HelpLevel,
    transcriptionSource: String(attempt.transcription_source),
    errorType: (attempt.error_type as string | null) ?? null,
    errorMessage: ex.commonErrors.find((e) => e.type === attempt.error_type)?.message ?? (attempt.error_type === 'accent' ? 'Presque! Regarde bien les accents.' : null),
    correctAnswerDisplay: evaluate(ex, String(attempt.confirmed_answer)).correctAnswerDisplay,
    explanation: ex.explanation,
    praise: praiseFor(ex, String(attempt.result), String(attempt.help)),
    // weak point overcome in this answer (big celebration)
    conquered: (() => {
      const r = one(c, "SELECT source FROM rewards WHERE profile_id = ? AND source LIKE ? ORDER BY rowid LIMIT 1", PROFILE_ID, `conquered:${String(attempt.id)}:%`);
      if (!r) return null;
      const tag = String(r.source).split(':').slice(2).join(':');
      return { tag, label: TAG_LABELS[tag] ?? tag };
    })(),
    // weak point that is almost overcome: «presque!», confirmed on another day (no big celebration)
    almost: (() => {
      if (attempt.result !== 'correct' || attempt.help !== 'none') return null;
      const m = learnerProfile(c, String(attempt.created_at))[ex.skillId];
      const t = [...tagsOf(ex)].reverse().find((x) => almostTags(m).includes(x)); // the most specific one (retenue before addition)
      return t ? { tag: t, label: TAG_LABELS[t] ?? t } : null;
    })(),
    masteryChange: before && after ? { skillId: after.skillId, before: before.estimate, after: after.estimate, levelBefore: before.level, levelAfter: after.level, reason: after.lastChangeReason } : null,
    missionStep: mission ? { missionId: String(mission.mission_id), stepIndex: Number(mission.step_index) } : null,
  };
}

/** Narrative rewards an attempt earned: the step's seed and, if it closed the mission, the garden in bloom. */
function rewardsOfAttempt(c: Ctx, attemptId: string): Array<{ key: string; label: string }> {
  const st = one(c, 'SELECT mission_id, step_index FROM mission_steps WHERE profile_id = ? AND attempt_id = ?', PROFILE_ID, attemptId);
  if (!st) return [];
  const m = getMission(String(st.mission_id));
  const out: Array<{ key: string; label: string }> = [];
  const step = m.steps[Number(st.step_index)];
  if (step) out.push(step.reward);
  const last = one(c, 'SELECT attempt_id FROM mission_steps WHERE profile_id = ? AND mission_id = ? ORDER BY completed_at DESC, rowid DESC LIMIT 1', PROFILE_ID, String(st.mission_id));
  const done = one(c, "SELECT status FROM mission_progress WHERE profile_id = ? AND mission_id = ?", PROFILE_ID, String(st.mission_id));
  if (done?.status === 'completed' && last?.attempt_id === attemptId) out.push(m.completionReward);
  return out;
}

export function confirmReview(c: Ctx, reviewId: string, body: ConfirmBody) {
  const review = loadReview(c, reviewId);
  const assignmentId = String(review.assignment_id);

  // Idempotency: same confirmation repeated (double click, request resent).
  if (review.status === 'confirmed') {
    const prev = one(c, 'SELECT * FROM attempts WHERE review_id = ?', reviewId);
    const { ex } = loadAssignment(c, assignmentId);
    // the rewards THIS confirmation gave (if the 1st response was lost on the network, she still sees them)
    return { outcome: 'evaluated' as const, duplicate: true, assignment: getAssignment(c, assignmentId), result: prev ? outcomeView(c, prev, ex) : null, rewards: prev ? rewardsOfAttempt(c, String(prev.id)) : [] };
  }
  if (review.status === 'illegible') return { outcome: 'illegible' as const, duplicate: true, assignment: getAssignment(c, assignmentId), result: null, rewards: [] };
  ensureReviewable(String(review.status));
  if (review.status === 'analyzing') throw new HttpError(409, 'busy', 'Attendez la fin de la lecture par l’IA.');

  const { row: aRow, ex } = loadAssignment(c, assignmentId);
  ensurePaper(aRow);
  if (one(c, 'SELECT id FROM attempts WHERE assignment_id = ?', assignmentId)) throw new HttpError(409, 'already-confirmed', 'Cet exercice a déjà été évalué.');
  if (aRow.status === 'cancelled') throw new HttpError(409, 'cancelled', 'Cet exercice a été annulé.');

  const illegible = body.illegible === true;
  const given = (['none', 'hint', 'adult'] as const).includes(body.help as HelpLevel) ? (body.help as HelpLevel) : null;
  // the hint opened in the app counts as help, even if the parents tick «seule»
  const help: HelpLevel | null = given === 'none' && Number(aRow.hint_used) === 1 ? 'hint' : given;
  const now = iso(c);
  // the answer counts at the moment she FINISHED the sheet (not when the parents confirmed, sometimes the next day)
  const doneAt = typeof aRow.done_at === 'string' && aRow.done_at < now ? aRow.done_at : now;

  if (illegible) {
    // Illegible: NOT a school mistake — no attempt, no effect on mastery.
    tx(c.db, () => {
      run(c, "UPDATE ai_reviews SET status = 'illegible', final_text = NULL, confirmed_at = ?, updated_at = ? WHERE id = ?", now, now, reviewId);
      setAssignmentStatus(c, assignmentId, 'illegible');
    });
    return { outcome: 'illegible' as const, duplicate: false, assignment: getAssignment(c, assignmentId), result: null, rewards: [] };
  }

  if (typeof body.text !== 'string' || body.text.trim().length === 0 || body.text.length > 500)
    throw new HttpError(400, 'invalid-text', 'Indiquez ce qui est écrit (ou marquez la réponse comme illisible).');
  if (!help) throw new HttpError(400, 'help-required', 'Indiquez s’il y a eu de l’aide pour répondre.');
  const text = body.text.trim();
  const quality = [1, 2, 3].includes(body.quality as number) ? (body.quality as 1 | 2 | 3) : 2;
  const saveSample = body.saveSample === true && review.photo_id !== null;
  const allowExternal = saveSample && body.allowExternal === true;

  const source = review.reading_origin === 'ai' ? (String(review.suggested_text ?? '').trim() === text ? 'ai' : 'ai-corrected') : 'manual';
  const evalResult = evaluate(ex, text);
  const before = getMastery(c, ex.skillId) ?? initialState(ex.skillId);
  const after = applyEvidence(before, { correct: evalResult.result === 'correct', help, difficulty: ex.difficulty as Difficulty, at: new Date(doneAt) }, engineParams(c), skillMax(ex.skillId));
  const prevProfile = learnerProfile(c); // to know whether a weak point stopped being weak
  const attemptId = randomUUID();
  const newRewards: Array<{ key: string; label: string }> = [];

  tx(c.db, () => {
    // 1. attempt (UNIQUE on assignment_id and review_id prevents duplicates)
    run(
      c,
      `INSERT INTO attempts (id, assignment_id, review_id, profile_id, skill_id, exercise_id, exercise_version, difficulty, confirmed_answer, normalized_answer,
        result, help, transcription_source, error_type, mastery_before_json, mastery_after_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      attemptId,
      assignmentId,
      reviewId,
      PROFILE_ID,
      ex.skillId,
      ex.exerciseId,
      ex.exerciseVersion,
      ex.difficulty,
      text,
      evalResult.normalizedAnswer,
      evalResult.result,
      help,
      source,
      evalResult.errorType ?? null,
      JSON.stringify(before),
      JSON.stringify(after),
      doneAt,
    );
    // 2. reading
    run(c, "UPDATE ai_reviews SET status = 'confirmed', final_text = ?, draft_text = ?, confirmed_at = ?, updated_at = ? WHERE id = ?", text, text, now, now, reviewId);
    setAssignmentStatus(c, assignmentId, 'confirmed');
    // 3. skill
    run(c, 'INSERT INTO mastery (profile_id, skill_id, state_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, skill_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at', PROFILE_ID, ex.skillId, JSON.stringify(after), now);
    plantFlower(c, ex.skillId, after, now);
    celebrateConquest(c, ex, attemptId, prevProfile, now);
    // 4. mission: the seed sprouts with the RIGHT answer (research: no reward just for taking part);
    //    on a mistake, the step stays open and comes back with another question; nothing she already earned is taken away
    if (aRow.mission_id && aRow.mission_step !== null && evalResult.result === 'correct') {
      const missionId = String(aRow.mission_id);
      const stepIndex = Number(aRow.mission_step);
      const inserted = run(c, 'INSERT OR IGNORE INTO mission_steps (profile_id, mission_id, step_index, attempt_id, completed_at) VALUES (?, ?, ?, ?, ?)', PROFILE_ID, missionId, stepIndex, attemptId, now);
      if (Number(inserted.changes) > 0) {
        const m = getMission(missionId);
        const step = m.steps[stepIndex];
        // 5. rewards (narrative, separate from performance)
        if (step) {
          const r = run(c, 'INSERT OR IGNORE INTO rewards (profile_id, reward_key, label, source, created_at) VALUES (?, ?, ?, ?, ?)', PROFILE_ID, step.reward.key, step.reward.label, `mission:${missionId}:${stepIndex}`, now);
          if (Number(r.changes) > 0) newRewards.push(step.reward);
        }
        const doneCount = Number((one(c, 'SELECT COUNT(*) AS n FROM mission_steps WHERE profile_id = ? AND mission_id = ?', PROFILE_ID, missionId)?.n as number) ?? 0);
        if (doneCount >= m.steps.length) {
          run(c, "UPDATE mission_progress SET status = 'completed', completed_at = ? WHERE profile_id = ? AND mission_id = ? AND status = 'active'", now, PROFILE_ID, missionId);
          const r = run(c, 'INSERT OR IGNORE INTO rewards (profile_id, reward_key, label, source, created_at) VALUES (?, ?, ?, ?, ?)', PROFILE_ID, m.completionReward.key, m.completionReward.label, `mission:${missionId}:complete`, now);
          if (Number(r.changes) > 0) newRewards.push(m.completionReward);
        }
      }
    }
    // 6. handwriting sample (only if authorized)
    if (saveSample) {
      run(
        c,
        `INSERT INTO handwriting_samples (id, profile_id, attempt_id, review_id, photo_id, transcription, kind, skill_id, quality, allow_external, origin, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        randomUUID(),
        PROFILE_ID,
        attemptId,
        reviewId,
        String(review.photo_id),
        text,
        kindForResponse(ex.responseType),
        ex.skillId,
        quality,
        allowExternal ? 1 : 0,
        source,
        now,
      );
    }
  });

  const attempt = one(c, 'SELECT * FROM attempts WHERE id = ?', attemptId) as Row;
  return { outcome: 'evaluated' as const, duplicate: false, assignment: getAssignment(c, assignmentId), result: outcomeView(c, attempt, ex), rewards: newRewards };
}

// ------------------------------------------------------------------ progress, history, samples

export function progress(c: Ctx) {
  const states = allMastery(c);
  const now = c.now().getTime();
  const learned = learnerProfile(c);
  const named = (tags: string[]) => tags.slice(0, 4).map((t) => ({ tag: t, label: TAG_LABELS[t] ?? t }));
  return {
    // what the model learned from her answers (strong points and points to strengthen, per skill)
    learned: skills
      .filter((s) => learned[s.id])
      .map((s) => {
        const m = learned[s.id];
        return { skillId: s.id, title: s.title, answers: m?.n ?? 0, comfortableLevel: comfortableLevel(m, skillMax(s.id)), ability: m?.theta ?? 0, weak: named(weakTags(m)), strong: named(strongTags(m)) };
      }),
    skills: skills.map((s) => {
      const st = states[s.id];
      return {
        id: s.id,
        subject: s.subject,
        title: s.title,
        titleFr: s.titleFr,
        curriculumRef: s.curriculumRef,
        reviewStatus: s.reviewStatus,
        levels: s.levels,
        state: st ?? null,
        reviewDue: st?.nextReviewAt ? new Date(st.nextReviewAt).getTime() <= now : false,
      };
    }),
    totals: {
      attempts: Number(one(c, 'SELECT COUNT(*) AS n FROM attempts WHERE profile_id = ?', PROFILE_ID)?.n ?? 0),
      correct: Number(one(c, "SELECT COUNT(*) AS n FROM attempts WHERE profile_id = ? AND result = 'correct'", PROFILE_ID)?.n ?? 0),
      withHelp: Number(one(c, "SELECT COUNT(*) AS n FROM attempts WHERE profile_id = ? AND help <> 'none'", PROFILE_ID)?.n ?? 0),
      illegible: Number(one(c, "SELECT COUNT(*) AS n FROM ai_reviews r JOIN assignments a ON a.id = r.assignment_id WHERE a.profile_id = ? AND r.status = 'illegible'", PROFILE_ID)?.n ?? 0),
    },
  };
}

export function gameProgress(c: Ctx) {
  const row = one(c, 'SELECT state_json, updated_at FROM game_progress WHERE profile_id = ?', PROFILE_ID);
  const rewards = all(c, 'SELECT reward_key, label, created_at FROM rewards WHERE profile_id = ? ORDER BY created_at, rowid', PROFILE_ID).map((r) => ({
    key: String(r.reward_key),
    label: String(r.label),
    at: String(r.created_at),
  }));
  return {
    state: json<Record<string, unknown>>(row?.state_json as string, {}),
    rewards,
    missions: missions.map((m) => {
      const st = missionState(c, m.id);
      return { id: m.id, status: st.status, completedSteps: st.completedSteps, nextStep: st.nextStep, completedAt: st.completedAt };
    }),
  };
}

export function saveGameState(c: Ctx, body: unknown) {
  const b = body as { x?: unknown; y?: unknown; scene?: unknown };
  const state = {
    x: typeof b?.x === 'number' && Number.isFinite(b.x) ? Math.round(b.x) : null,
    y: typeof b?.y === 'number' && Number.isFinite(b.y) ? Math.round(b.y) : null,
    scene: typeof b?.scene === 'string' ? b.scene.slice(0, 40) : 'garden',
  };
  run(c, 'INSERT INTO game_progress (profile_id, state_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(profile_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at', PROFILE_ID, JSON.stringify(state), iso(c));
  return gameProgress(c);
}

export function history(c: Ctx, limit = 100) {
  const rows = all(
    c,
    `SELECT a.id, a.skill_id, a.difficulty, a.status, a.created_at, a.selection_reason, a.mission_id, a.mission_step, a.snapshot_json, a.input_mode, a.tries,
            t.result, t.help, t.confirmed_answer, t.transcription_source, t.error_type, t.created_at AS evaluated_at,
            (SELECT COUNT(*) FROM ai_reviews r WHERE r.assignment_id = a.id AND r.status = 'illegible') AS illegible_count
     FROM assignments a LEFT JOIN attempts t ON t.assignment_id = a.id
     WHERE a.profile_id = ? ORDER BY a.created_at DESC LIMIT ?`,
    PROFILE_ID,
    limit,
  );
  return rows.map((r) => {
    const ex = json<ExerciseInstance | null>(r.snapshot_json as string, null);
    let category: string;
    if (r.result === 'correct') category = 'correct';
    else if (r.result === 'incorrect') category = 'wrong-answer';
    else if (r.status === 'illegible') category = 'illegible';
    else if (r.status === 'cancelled') category = 'cancelled';
    else category = 'not-finished';
    return {
      assignmentId: String(r.id),
      skillId: String(r.skill_id),
      difficulty: Number(r.difficulty),
      statement: ex?.statement ?? '',
      status: String(r.status),
      category,
      result: (r.result as string | null) ?? null,
      help: (r.help as string | null) ?? null,
      confirmedAnswer: (r.confirmed_answer as string | null) ?? null,
      transcriptionSource: (r.transcription_source as string | null) ?? null,
      readingCorrected: r.transcription_source === 'ai-corrected',
      inputMode: String(r.input_mode),
      tries: Number(r.tries),
      illegibleReadings: Number(r.illegible_count),
      errorType: (r.error_type as string | null) ?? null,
      selectionReason: String(r.selection_reason),
      missionStep: r.mission_step === null ? null : Number(r.mission_step),
      createdAt: String(r.created_at),
      evaluatedAt: (r.evaluated_at as string | null) ?? null,
    };
  });
}

export function listSamples(c: Ctx) {
  return all(c, 'SELECT * FROM handwriting_samples WHERE profile_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', PROFILE_ID).map((s) => ({
    id: String(s.id),
    photoId: String(s.photo_id),
    transcription: String(s.transcription),
    kind: String(s.kind),
    skillId: (s.skill_id as string | null) ?? null,
    quality: Number(s.quality),
    allowExternal: Number(s.allow_external) === 1,
    origin: String(s.origin),
    createdAt: String(s.created_at),
  }));
}

export function patchSample(c: Ctx, id: string, body: Record<string, unknown>) {
  const s = one(c, 'SELECT id FROM handwriting_samples WHERE id = ? AND profile_id = ? AND deleted_at IS NULL', id, PROFILE_ID);
  if (!s) throw new HttpError(404, 'sample-not-found', 'Exemple d’écriture introuvable.');
  if (body.transcription !== undefined) {
    if (typeof body.transcription !== 'string' || !body.transcription.trim() || body.transcription.length > 200) throw new HttpError(400, 'invalid', 'Transcription invalide.');
    run(c, 'UPDATE handwriting_samples SET transcription = ? WHERE id = ?', body.transcription.trim(), id);
  }
  if (body.allowExternal !== undefined) {
    if (typeof body.allowExternal !== 'boolean') throw new HttpError(400, 'invalid', 'allowExternal invalide.');
    run(c, 'UPDATE handwriting_samples SET allow_external = ? WHERE id = ?', body.allowExternal ? 1 : 0, id);
  }
  if (body.quality !== undefined) {
    if (![1, 2, 3].includes(body.quality as number)) throw new HttpError(400, 'invalid', 'Qualité invalide.');
    run(c, 'UPDATE handwriting_samples SET quality = ? WHERE id = ?', body.quality as number, id);
  }
  return listSamples(c).find((x) => x.id === id);
}

/**
 * Removes the sample from the library (it will no longer be retrieved or sent).
 * The attempt history remains; the photo stays linked to the answered exercise.
 */
export function deleteSample(c: Ctx, id: string) {
  const s = one(c, 'SELECT id FROM handwriting_samples WHERE id = ? AND profile_id = ? AND deleted_at IS NULL', id, PROFILE_ID);
  if (!s) throw new HttpError(404, 'sample-not-found', 'Exemple d’écriture introuvable.');
  run(c, 'UPDATE handwriting_samples SET deleted_at = ?, allow_external = 0 WHERE id = ?', iso(c), id);
  return { deleted: true, keptInHistory: ['tentative', 'transcription confirmée', 'photo de l’exercice'] };
}

/** Measures the AI reading: corrections made by the parents and kinds of confusion. */
export function readingStats(c: Ctx) {
  const rows = all(c, "SELECT suggested_text, final_text, status, samples_used_json FROM ai_reviews WHERE reading_origin = 'ai' AND status IN ('confirmed','illegible')");
  let corrected = 0;
  let withSamples = 0;
  let withSamplesCorrected = 0;
  const confusions: Record<string, number> = {};
  for (const r of rows) {
    const used = json<unknown[]>(r.samples_used_json as string, []).length > 0;
    if (used) withSamples++;
    if (r.status === 'confirmed' && String(r.suggested_text ?? '') !== String(r.final_text ?? '')) {
      corrected++;
      if (used) withSamplesCorrected++;
      const a = String(r.suggested_text ?? '');
      const b = String(r.final_text ?? '');
      if (a.length === b.length) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) confusions[`${a[i]}→${b[i]}`] = (confusions[`${a[i]}→${b[i]}`] ?? 0) + 1;
    }
  }
  return {
    aiReadings: rows.length,
    correctedByParents: corrected,
    illegible: rows.filter((r) => r.status === 'illegible').length,
    withSamples,
    withSamplesCorrected,
    withoutSamples: rows.length - withSamples,
    withoutSamplesCorrected: corrected - withSamplesCorrected,
    confusions,
    note: 'Mesure descriptive; elle ne prouve pas une amélioration sans un nombre suffisant de lectures.',
  };
}

export function skillCatalog() {
  return skills;
}

// ------------------------------------------------------------------ on-screen mini-games

const MAX_TRIES = 3;

/**
 * « Les mots cachés »: the answer is the whole word, the same length as the pattern, with the visible letters
 * equal to the pattern's and the gaps filled only with letters from the keyboard shown.
 */
function spellingAnswerFits(g: HiddenWordsSpec, answer: string): boolean {
  const ls = [...answer.normalize('NFC')];
  const { pattern, letters } = g.final;
  return ls.length === pattern.length && ls.every((ch, i) => (pattern[i] === null ? letters.includes(ch) : pattern[i] === ch));
}
/**
 * Round stars: feedback on what happened (3 = first try, 2 = with a hint), never currency.
 * A wrong answer earns no star (research: rewarding mere participation lowers motivation).
 */
const starsFor = (result: string, help: string) => (result === 'correct' ? (help === 'none' ? 3 : 2) : 0);

/**
 * Game cards: instead of a star total that grows just by playing, they show competence —
 * the current level of the game's skills and the flowers earned (confirmed level or overcome weak point).
 */
export function listGames(c: Ctx) {
  const stats = all(
    c,
    `SELECT a.exercise_id AS id, COUNT(*) AS rounds
     FROM attempts t JOIN assignments a ON a.id = t.assignment_id
     WHERE t.profile_id = ? AND t.input_mode = 'screen' GROUP BY a.exercise_id`,
    PROFILE_ID,
  );
  const flowerKeys = all(c, "SELECT reward_key FROM rewards WHERE profile_id = ? AND reward_key LIKE 'flower.%'", PROFILE_ID).map((r) => String(r.reward_key));
  return games.map((g) => {
    const st = stats.find((x) => x.id === g.id);
    const levels = g.skills.map((s) => getMastery(c, s)?.level ?? 1);
    const flowers = flowerKeys.filter((k) => g.skills.some((s) => k.startsWith(`flower.${s}.`) || k.startsWith(`flower.tag.${s}.`))).length;
    return { id: g.id, title: g.title, description: g.description, skills: g.skills, roundsPerSession: g.roundsPerSession, roundsPlayed: Number(st?.rounds ?? 0), level: Math.max(...levels), flowers };
  });
}

function roundView(c: Ctx, id: string) {
  const { row, ex } = loadAssignment(c, id);
  const attempt = one(c, 'SELECT * FROM attempts WHERE assignment_id = ?', id);
  return {
    id,
    gameId: String(row.exercise_id),
    status: row.status as AssignmentStatus,
    exercise: toPublic(ex),
    tries: Number(row.tries),
    triesLeft: Math.max(0, MAX_TRIES - Number(row.tries)),
    selectionReason: String(row.selection_reason),
    outcome: attempt ? { ...outcomeView(c, attempt, ex), stars: starsFor(String(attempt.result), String(attempt.help)) } : null,
  };
}

/** Starts (or resumes) a mini-game round. The skill and level come from the adaptive engine. */
export function startGameRound(c: Ctx, body: { gameId?: unknown; sessionId?: unknown; challenge?: unknown }) {
  let game;
  try {
    game = getGame(String(body.gameId ?? ''));
  } catch {
    throw new HttpError(404, 'unknown-game', 'Jeu inconnu.');
  }
  // Resume: open round of the same game (avoids creating rounds in a row without playing).
  const open = one(c, "SELECT id FROM assignments WHERE profile_id = ? AND exercise_id = ? AND input_mode = 'screen' AND status = 'presented' ORDER BY created_at DESC LIMIT 1", PROFILE_ID, game.id);
  if (open) return roundView(c, String(open.id));

  let sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
  if (!sessionId || !one(c, 'SELECT id FROM sessions WHERE id = ? AND profile_id = ?', sessionId, PROFILE_ID)) {
    sessionId = startSession(c, { mode: 'practice', subject: game.subject }).id;
  }
  const id = randomUUID();
  const now = c.now();
  const settings = getSettings(c);
  const states = allMastery(c);
  const candidates = skills.filter((s) => game.skills.includes(s.id));
  const lastRow = one(c, 'SELECT skill_id FROM assignments WHERE profile_id = ? AND exercise_id = ? ORDER BY created_at DESC LIMIT 1', PROFILE_ID, game.id);
  const choice = settings['parent.nextChoice'];
  let decision =
    choice && candidates.some((s) => s.id === choice.skillId)
      ? parentChoice(choice.skillId, states[choice.skillId], choice.difficulty)
      : selectNext({ skills: candidates, states, allStates: states, now, lastSkillId: (lastRow?.skill_id as string) ?? null, params: engineParams(c) });
  // last 8 rounds: do not repeat the same round and (Les mots cachés) leave recent words for last
  const recentKeys = all(c, 'SELECT question_key FROM assignments WHERE profile_id = ? AND exercise_id = ? ORDER BY created_at DESC LIMIT 8', PROFILE_ID, game.id).map((r) => String(r.question_key));
  // autonomy (research): she herself asked for «un défi un peu plus difficile»
  if (body.challenge === true && decision.reasonCode !== 'parent-choice') {
    // one level above where she is playing TODAY (the session staircase), not only above the official level
    const base = Math.max(decision.difficulty, todayLevel(c, decision.skillId));
    decision = { ...decision, difficulty: Math.min(skillMax(decision.skillId), base + 1) as Difficulty, reasonCode: 'child-choice', reason: `Choix de l’enfant : un défi un peu plus difficile (niveau ${Math.min(skillMax(decision.skillId), base + 1)}).` };
  }
  const learned = decision.reasonCode === 'child-choice' ? { decision, plan: null } : applyLearner(c, decision, seedFrom(id));
  decision = learned.decision;
  const ex = generateGameRound(game.id, decision.skillId, decision.difficulty, seedFrom(id), recentKeys, { schoolWeek: settings['french.schoolWeek'], recentKeys, prefer: learned.plan?.prefer });
  tx(c.db, () => {
    run(
      c,
      `INSERT INTO assignments (id, session_id, profile_id, skill_id, exercise_id, exercise_version, difficulty, question_key, snapshot_json,
        selection_reason_code, selection_reason, status, input_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'presented', 'screen', ?, ?)`,
      id,
      sessionId,
      PROFILE_ID,
      ex.skillId,
      ex.exerciseId,
      ex.exerciseVersion,
      ex.difficulty,
      ex.questionKey,
      JSON.stringify(ex),
      decision.reasonCode,
      decision.reason,
      now.toISOString(),
      now.toISOString(),
    );
    if (decision.reasonCode === 'parent-choice') setSetting(c, 'parent.nextChoice', null);
  });
  return { ...roundView(c, id), sessionId };
}

/**
 * Answer given on screen. Evaluation happens here, on the server.
 * - right on the 1st try: independent success;
 * - right on the 2nd or 3rd (after a hint): success with help (lower weight, no advancement);
 * - 3 mistakes: incorrect answer, with a demonstration.
 */
export function answerGameRound(c: Ctx, id: string, body: { answer?: unknown }) {
  const { row, ex } = loadAssignment(c, id);
  if (row.input_mode !== 'screen') throw new HttpError(400, 'not-a-game-round', 'Cet exercice n’est pas une manche de jeu.');
  if (row.status === 'confirmed') return { state: 'done' as const, duplicate: true, round: roundView(c, id), feedback: null };
  if (row.status !== 'presented') throw new HttpError(409, 'closed', 'Manche terminée.');
  if (typeof body.answer !== 'string') throw new HttpError(400, 'invalid-answer', 'Réponse invalide.');
  const exp = ex.expected;
  // sequence (Le chemin des nombres): comma-separated numbers, one per empty stone
  const answer = exp.type === 'sequence' ? body.answer.replace(/\s+/g, '') : body.answer.trim().normalize('NFC');
  // Choice games: only one of the shown options is valid. Number games: digits only.
  const options = ex.game && 'options' in ex.game ? ex.game.options : null;
  const valid = options
    ? options.includes(answer)
    : ex.game?.game === 'hidden-words'
      ? spellingAnswerFits(ex.game, answer)
      : exp.type === 'sequence'
        ? // up to 4 digits: level 6 «Défi» goes up to the thousands (1000 → 9000)
          new RegExp(`^\\d{1,4}(,\\d{1,4}){${exp.values.length - 1}}$`).test(answer)
        : /^\d{1,4}$/.test(answer);
  if (!valid) throw new HttpError(400, 'invalid-answer', 'Réponse invalide.');
  const tries = Number(row.tries) + 1;
  const ev = evaluate(ex, answer);
  const correct = ev.result === 'correct';
  const now = iso(c);

  if (!correct && tries < MAX_TRIES) {
    run(c, 'UPDATE assignments SET tries = ?, updated_at = ? WHERE id = ?', tries, now, id);
    return {
      state: 'retry' as const,
      duplicate: false,
      round: roundView(c, id),
      // 1st mistake: message for the error type (if recognized); 2nd mistake: the exercise's hint.
      feedback: {
        // feedback that EXPLAINS (research: far more effective than just "right/wrong"): the recognized error, otherwise the strategy
        message:
          tries === 1
            ? (ev.errorMessage ?? `${ex.retryMessage ?? 'Pas tout à fait.'}${ex.hint ? ` Astuce : ${ex.hint}` : ''}`)
            : `Astuce : ${ex.hint ?? 'Essaie encore une fois, doucement.'}`,
        showCounting: tries >= 2,
        // sequence: which stones are right (without telling the value of the wrong ones), so she fixes only the others
        ...(exp.type === 'sequence' ? { slots: answer.split(',').map((v, i) => Number(v) === exp.values[i]) } : {}),
      },
    };
  }

  const help: HelpLevel = correct && tries === 1 ? 'none' : 'hint';
  const before = getMastery(c, ex.skillId) ?? initialState(ex.skillId);
  const after = applyEvidence(before, { correct, help, difficulty: ex.difficulty as Difficulty, at: c.now() }, engineParams(c), skillMax(ex.skillId));
  const prevProfile = learnerProfile(c); // to know whether a weak point stopped being weak
  const attemptId = randomUUID();
  const reviewId = randomUUID();
  tx(c.db, () => {
    run(c, "INSERT INTO ai_reviews (id, assignment_id, source, status, reading_origin, final_text, draft_text, created_at, updated_at, confirmed_at) VALUES (?, ?, 'manual', 'confirmed', 'screen', ?, ?, ?, ?, ?)", reviewId, id, answer, answer, now, now, now);
    run(
      c,
      `INSERT INTO attempts (id, assignment_id, review_id, profile_id, skill_id, exercise_id, exercise_version, difficulty, confirmed_answer, normalized_answer,
        result, help, transcription_source, error_type, mastery_before_json, mastery_after_json, input_mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?, 'screen', ?)`,
      attemptId,
      id,
      reviewId,
      PROFILE_ID,
      ex.skillId,
      ex.exerciseId,
      ex.exerciseVersion,
      ex.difficulty,
      answer,
      ev.normalizedAnswer,
      ev.result,
      help,
      ev.errorType ?? null,
      JSON.stringify(before),
      JSON.stringify(after),
      now,
    );
    run(c, "UPDATE assignments SET status = 'confirmed', tries = ?, hint_used = ?, updated_at = ? WHERE id = ?", tries, tries > 1 ? 1 : 0, now, id);
    run(c, 'INSERT INTO mastery (profile_id, skill_id, state_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, skill_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at', PROFILE_ID, ex.skillId, JSON.stringify(after), now);
    plantFlower(c, ex.skillId, after, now);
    celebrateConquest(c, ex, attemptId, prevProfile, now);
  });
  return { state: 'done' as const, duplicate: false, round: roundView(c, id), feedback: null };
}
