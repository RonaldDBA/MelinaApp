import type { AssignmentStatus, GridSpec, HelpLevel, MasteryState, PublicExercise, ReviewStatus } from '@melina/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const HEADERS = { 'x-melina-client': '1' };

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { ...HEADERS, 'content-type': 'application/json' } : HEADERS,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', 'Le serveur local n’a pas répondu. L’application est-elle toujours ouverte?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `Erreur ${res.status}`);
  }
  return data as T;
}

export interface Review {
  id: string;
  assignmentId: string;
  source: 'photo' | 'manual';
  status: ReviewStatus;
  hasPhoto: boolean;
  photoId: string | null;
  readingOrigin: string | null;
  suggestedText: string | null;
  draftText: string | null;
  finalText: string | null;
  uncertain: string[];
  modelConfidence: string | null;
  model: string | null;
  samplesUsed: Array<{ id: string; why: string }>;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface Outcome {
  attemptId: string;
  result: 'correct' | 'incorrect';
  confirmedAnswer: string;
  help: HelpLevel;
  transcriptionSource: string;
  errorType: string | null;
  errorMessage: string | null;
  correctAnswerDisplay: string;
  explanation: string;
  /** process praise (what she did right), only on correct answers */
  praise: string | null;
  /** weak spot overcome with this answer (big celebration) */
  conquered: { tag: string; label: string } | null;
  /** Weak spot almost overcome: confirmation on another day («presque!»), no big celebration. */
  almost: { tag: string; label: string } | null;
  masteryChange: { skillId: string; before: number; after: number; levelBefore: number; levelAfter: number; reason: string } | null;
  missionStep: { missionId: string; stepIndex: number } | null;
}

export interface Assignment {
  id: string;
  status: AssignmentStatus;
  exercise: PublicExercise;
  hintUsed: boolean;
  missionId: string | null;
  missionStep: number | null;
  selectionReason: string;
  createdAt: string;
  reviews: Review[];
  outcome: Outcome | null;
}

export interface ConfirmResponse {
  outcome: 'evaluated' | 'illegible';
  duplicate: boolean;
  assignment: Assignment;
  result: Outcome | null;
  rewards: Array<{ key: string; label: string }>;
}

export interface GameProgress {
  state: { x?: number | null; y?: number | null };
  rewards: Array<{ key: string; label: string; at: string }>;
  missions: Array<{ id: string; status: string; completedSteps: number[]; nextStep: number | null; completedAt: string | null }>;
}

export interface Settings {
  'ai.enabled': boolean;
  'ai.consentAt': string | null;
  'ai.maxSamples': number;
  'engine.reviewIntervalsDays': number[];
  'parent.nextChoice': { skillId: string; difficulty?: number } | null;
  'french.schoolWeek': string | null;
  'art.enabled': boolean;
  'art.dailyLimit': number;
  'art.monthlyLimit': number;
  aiKeyConfigured: boolean;
  aiModel: string;
  schoolWeeks: Array<{ key: string; label: string; words: Array<{ text: string; forms: string[] }> }>;
}

export interface ReportTag {
  tag: string;
  label: string;
  skill: string;
  n: number; // answers with this tag in the period
  rate: number | null; // % right on the first try in the period (null = not practised in the period)
  prevRate: number | null;
}
interface ReportTotals {
  answers: number;
  firstTry: number;
  firstTryRate: number | null;
  correctRate: number | null;
  activeDays: number;
  minutes: number;
}
/** Progress report (week or month) — see apps/server/src/report.ts. */
export interface ProgressReport {
  kind: 'week' | 'month';
  offset: number;
  period: { start: string; end: string; label: string };
  previous: { start: string; end: string; label: string };
  generatedAt: string;
  totals: ReportTotals;
  prevTotals: ReportTotals;
  days: Array<{ date: string; answers: number; firstTry: number }>;
  skills: Array<{ skillId: string; title: string; subject: string; answers: number; firstTryRate: number | null; prevRate: number | null; levelStart: number | null; levelEnd: number | null; trend: string; reviews: { n: number; ok: number }; helpRate: number | null }>;
  tags: { strong: ReportTag[]; weak: ReportTag[]; improving: ReportTag[]; declining: ReportTag[]; almost: ReportTag[] };
  activities: Array<{ id: string; title: string; answers: number }>;
  recommendations: string[];
  /** Few answers in the period: the trends are hints, not conclusions. */
  lowData: boolean;
  home: { skill: string; text: string } | null;
  talk: string;
  goal: string | null;
}

/** What the model learned from her answers, per skill. */
export interface LearnedSkill {
  skillId: string;
  title: string;
  answers: number;
  comfortableLevel: number;
  ability: number;
  weak: Array<{ tag: string; label: string }>;
  strong: Array<{ tag: string; label: string }>;
}

export interface SkillProgress {
  id: string;
  subject: string;
  title: string;
  titleFr: string;
  curriculumRef: string;
  reviewStatus: string;
  levels: Record<string, string>;
  state: MasteryState | null;
  reviewDue: boolean;
}

export interface GameRound {
  id: string;
  gameId: string;
  status: AssignmentStatus;
  exercise: PublicExercise;
  tries: number;
  triesLeft: number;
  selectionReason: string;
  outcome: (Outcome & { stars: number }) | null;
  sessionId?: string;
}

export interface GameInfo {
  id: string;
  title: string;
  description: string;
  skills: string[];
  roundsPerSession: number;
  roundsPlayed: number;
  /** Current level (the highest among the game's skills) and flowers earned: competence, not currency. */
  level: number;
  flowers: number;
}

export interface ArtCheck {
  id: string;
  label: string;
  ok: boolean | null;
  detail: string;
}
export interface ArtCandidate {
  id: string;
  specId: string;
  url: string;
  width: number;
  height: number;
  status: string;
  tech: { ok: boolean; checks: ArtCheck[] } | null;
  techOk: boolean;
  review: { verdict?: string; problems?: string[]; error?: string; model?: string } | null;
  reviewVerdict: 'approve' | 'reject' | 'error' | null;
  createdAt: string;
}
export interface ArtVersion {
  id: string;
  version: number;
  url: string;
  mime: string;
  source: 'generated' | 'pack';
  provider: string | null;
  model: string | null;
  credit: string | null;
  active: boolean;
  approvedAt: string;
  grid?: GridSpec;
}
export interface ArtSpecView {
  id: string;
  kind: 'background' | 'prop' | 'character' | 'clip';
  title: string;
  size: [number, number];
  transparent: boolean;
  brief: string;
  mustNot: string[];
  fallback: string;
  usedBy: string[];
  grid?: GridSpec;
  master?: boolean;
  reference?: string;
  drawnByCode?: boolean;
  defaultPrompt: string;
  prompt: string | null;
  promptSource: 'default' | 'parent' | 'claude';
  versions: ArtVersion[];
  active: ArtVersion | null;
  candidates: ArtCandidate[];
  job: { id: string; status: 'running' | 'done' | 'failed'; provider: string; model: string; requested: number; received: number; errorCode: string | null; errorMessage: string | null; createdAt: string } | null;
}
export interface ArtPack {
  id: string;
  name: string;
  folder: string;
  licenseNote: string | null;
  files: Array<{ id: string; path: string; mime: string; media: 'image' | 'video'; width: number; height: number; url: string }>;
}
export interface ArtStudio {
  enabled: boolean;
  consentAt: string | null;
  provider: { id: string; label: string; model: string; keyConfigured: boolean } | null;
  claudeAvailable: boolean;
  claudeModel: string;
  limits: { daily: number; monthly: number };
  usage: { today: number; month: number };
  style: { name: string; summary: string; palette: string[]; always: string[]; never: string[] };
  specs: ArtSpecView[];
  packs: ArtPack[];
}

async function sendForm<T>(url: string, fields: Record<string, unknown>, file: Blob | null): Promise<T> {
  if (!file) return req<T>('POST', url, fields);
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, JSON.stringify(v)); // fields before the file
  fd.append('image', file, 'arte');
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: HEADERS, body: fd });
  } catch {
    throw new ApiError(0, 'offline', 'Le serveur local n’a pas répondu.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } }).error;
    throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `Erreur ${res.status}`);
  }
  return data as T;
}

export const artApi = {
  studio: () => req<ArtStudio>('GET', '/api/art/studio'),
  setPrompt: (specId: string, prompt: string | null) => req<ArtSpecView>('PATCH', `/api/art/specs/${specId}/prompt`, { prompt }),
  draftPrompt: (specId: string) => req<ArtSpecView>('POST', `/api/art/specs/${specId}/prompt/draft`, {}),
  generate: (specId: string, n: number) => req<ArtSpecView>('POST', `/api/art/specs/${specId}/generate`, { n }),
  activate: (specId: string, assetId: string | null) => req<ArtSpecView>('POST', `/api/art/specs/${specId}/activate`, { assetId }),
  review: (candidateId: string) => req<ArtCandidate>('POST', `/api/art/candidates/${candidateId}/review`, {}),
  approve: (candidateId: string, file: Blob | null, meta?: { inset: number[] }) => sendForm<ArtSpecView>(`/api/art/candidates/${candidateId}/approve`, { meta }, file),
  reject: (candidateId: string, reason: string) => req<ArtSpecView>('POST', `/api/art/candidates/${candidateId}/reject`, { reason }),
  scanPacks: () => req<{ added: number; packs: ArtPack[] }>('POST', '/api/art/packs/scan', {}),
  usePackFile: (fileId: string, specId: string, file: Blob | null, meta?: { inset: number[] }) => sendForm<ArtSpecView>(`/api/art/pack-files/${fileId}/use`, { specId, meta }, file),
};

export const api = {
  games: () => req<GameInfo[]>('GET', '/api/games'),
  startRound: (gameId: string, sessionId?: string, challenge = false) => req<GameRound>('POST', '/api/game-rounds', { gameId, sessionId, ...(challenge ? { challenge: true } : {}) }),
  answerRound: (id: string, answer: string) =>
    req<{ state: 'retry' | 'done'; duplicate: boolean; round: GameRound; feedback: { message: string; showCounting: boolean; slots?: boolean[] } | null }>('POST', `/api/game-rounds/${id}/answer`, { answer }),
  health: () => req<{ ok: boolean; ai: { keyConfigured: boolean; enabled: boolean; consent: boolean; model: string } }>('GET', '/api/health'),
  settings: () => req<Settings>('GET', '/api/settings'),
  patchSettings: (b: Record<string, unknown>) => req<Settings>('PATCH', '/api/settings', b),
  startSession: (b: { mode: 'mission' | 'practice'; missionId?: string; subject?: string }) =>
    req<{ id: string }>('POST', '/api/sessions', b),
  createAssignment: (b: { sessionId: string; missionStep?: number; subject?: string }) => req<Assignment>('POST', '/api/assignments', b),
  assignment: (id: string) => req<Assignment>('GET', `/api/assignments/${id}`),
  pending: () => req<Assignment[]>('GET', '/api/assignments/pending'),
  hint: (id: string) => req<Assignment>('POST', `/api/assignments/${id}/hint`, {}),
  done: (id: string) => req<Assignment>('POST', `/api/assignments/${id}/done`, {}),
  cancel: (id: string) => req<Assignment>('POST', `/api/assignments/${id}/cancel`, {}),
  manual: (id: string) => req<{ review: Review; duplicate: boolean }>('POST', `/api/assignments/${id}/manual`, {}),
  async uploadPhoto(id: string, blob: Blob): Promise<{ review: Review; duplicate: boolean }> {
    const fd = new FormData();
    fd.append('photo', blob, 'answer.jpg');
    let res: Response;
    try {
      res = await fetch(`/api/assignments/${id}/photo`, { method: 'POST', headers: HEADERS, body: fd });
    } catch {
      throw new ApiError(0, 'offline', 'Le serveur local n’a pas répondu.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = (data as { error?: { code?: string; message?: string } }).error;
      throw new ApiError(res.status, e?.code ?? 'error', e?.message ?? `Erreur ${res.status}`);
    }
    return data as { review: Review; duplicate: boolean };
  },
  analyze: (reviewId: string) => req<Review>('POST', `/api/reviews/${reviewId}/analyze`, {}),
  saveDraft: (reviewId: string, text: string) => req<Review>('PATCH', `/api/reviews/${reviewId}/transcription`, { text }),
  confirm: (reviewId: string, b: { text?: string; illegible?: boolean; help?: HelpLevel; saveSample?: boolean; allowExternal?: boolean; quality?: number }) =>
    req<ConfirmResponse>('POST', `/api/reviews/${reviewId}/confirm`, b),
  async photoUrl(photoId: string): Promise<string> {
    const res = await fetch(`/api/photos/${photoId}`, { headers: HEADERS });
    if (!res.ok) throw new ApiError(res.status, 'photo', 'Photo non disponible.');
    return URL.createObjectURL(await res.blob());
  },
  report: (kind: 'week' | 'month', offset: number) => req<ProgressReport>('GET', `/api/report?kind=${kind}&offset=${offset}`),
  progress: () => req<{ skills: SkillProgress[]; totals: Record<string, number>; learned: LearnedSkill[] }>('GET', '/api/progress'),
  history: () => req<Array<Record<string, unknown>>>('GET', '/api/history'),
  missions: () => req<unknown[]>('GET', '/api/missions'),
  gameProgress: () => req<GameProgress>('GET', '/api/game-progress'),
  saveGameState: (b: { x: number; y: number }) => req<GameProgress>('PUT', '/api/game-progress', b),
  samples: () =>
    req<Array<{ id: string; photoId: string; transcription: string; kind: string; skillId: string | null; quality: number; allowExternal: boolean; createdAt: string }>>(
      'GET',
      '/api/handwriting-samples',
    ),
  patchSample: (id: string, b: Record<string, unknown>) => req('PATCH', `/api/handwriting-samples/${id}`, b),
  deleteSample: (id: string) => req('DELETE', `/api/handwriting-samples/${id}`),
  readingStats: () => req<Record<string, unknown>>('GET', '/api/reading-stats'),
  backups: () => req<Array<{ name: string; createdAt: string }>>('GET', '/api/backups'),
  createBackup: () => req<{ folder: string; photos: number }>('POST', '/api/backups', {}),
  skills: () => req<Array<{ id: string; title: string; subject: string }>>('GET', '/api/skills'),
};
