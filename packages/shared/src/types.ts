// Contracts shared by the server, the teaching engine and the interface.

export type Subject = 'french' | 'mathematics' | 'english';
/** Levels 1 to 5; each skill says how far it goes (keys of `levels`, see `maxLevel`). */
export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6; // 6 = « Défi », au-delà de la 2e année
export type ResponseType = 'number' | 'word' | 'sequence' | 'short-text';
export type HelpLevel = 'none' | 'hint' | 'adult';
export type TranscriptionSource = 'manual' | 'ai' | 'ai-corrected';
export type AttemptResult = 'correct' | 'incorrect';

export interface SkillDefinition {
  id: string;
  version: number;
  subject: Subject;
  cycle: 1 | 2 | 3;
  grade: number; // main reference grade
  title: string; // short title (parent panel)
  titleFr: string; // title for the child
  description: string; // observable description (parent panel)
  prerequisites: string[];
  exerciseTypes: string[];
  levels: Record<'1' | '2' | '3', string> & Partial<Record<'4' | '5' | '6', string>>;
  curriculumRef: string;
  reviewStatus: 'draft' | 'to-validate' | 'validated';
  inspiredBy?: string;
}

/** Last level of a skill (3 by default; some go up to 5). */
export function maxLevel(skill: Pick<SkillDefinition, 'levels'>): Difficulty {
  return Math.max(...Object.keys(skill.levels).map(Number).filter((n) => n >= 1 && n <= 6)) as Difficulty;
}

/** Optional visual, drawn by the interface (no external images). */
export type ExerciseVisual =
  | { kind: 'tens-units'; tens: number; units: number; hundreds?: number }
  | { kind: 'groups'; total: number; perGroup: number; item: string }
  | { kind: 'emoji'; emoji: string; label?: string }
  | { kind: 'text'; title: string; paragraphs: string[] };

/** Parameters of one round of the « Les caisses de pommes » mini-game. */
export interface AppleCratesSpec {
  game: 'apple-crates';
  loose: number; // loose fruits to pack
  packed: number; // crates already full at the start
  perCrate: number; // always 10
  question: 'total' | 'crates';
  fruit: 'red_apple' | 'green_apple' | 'pear';
  fruitLabel: string; // « pommes », « poires »
}
/** « Le train des nombres »: a sequence with one wagon missing its number. */
export interface NumberTrainSpec {
  game: 'number-train';
  terms: Array<number | null>; // null = wagon to fill in
}
/** « Saute-grenouille »: the frog starts on a number and makes one jump; the child picks the landing lily pad. */
export interface FrogJumpSpec {
  game: 'frog-jump';
  start: number;
  jump: number;
  op: '+' | '-';
  options: string[];
}
/** French choice games: fish the right plural or pick the answer to a story. */
export interface ChoiceSpec {
  game: 'word-fishing' | 'mystery-story';
  prompt: string;
  options: string[];
}
/**
 * « Le chemin des nombres »: a path of stones with numbers; `value: null` = stone to fill in.
 * - layout `line` (levels 1 and 2): stones in a row, counting by 1 (forward or backward);
 * - layout `grid` (level 3): a piece of the hundred chart; only the path's squares appear; `row`/`col`
 *   are the square's position in the piece (right +1, down +10).
 * The order of `cells` is the path order; the answer lists the empty stones in that order.
 */
export interface NumberPathSpec {
  game: 'number-path';
  layout: 'line' | 'grid';
  cells: Array<{ value: number | null; row?: number; col?: number }>;
  grid?: { rows: number; cols: number };
}
/**
 * « Les mots cachés »: a word search. The search is NOT graded (it is only exposure to the words).
 * At the end, one of the found words comes back with missing letters (`final.pattern`, null = gap) and the child
 * completes it by tapping the letters of `final.letters`; only that word is graded, on the server.
 * `grid` holds the rows of the grid; each cell is ONE letter (accented ones in NFC: «é» is one cell).
 */
export interface HiddenWordsSpec {
  game: 'hidden-words';
  grid: string[][];
  /** directions the words may run in: h (→), v (↓), d (↘) */
  directions: Array<'h' | 'v' | 'd'>;
  words: Array<{ word: string; emoji?: string }>;
  final: { index: number; pattern: Array<string | null>; letters: string[] };
}
/** Half of a domino: the same number in different representations. */
export type DominoFace =
  | { kind: 'dots'; n: number }
  | { kind: 'digit'; n: number }
  | { kind: 'expr'; text: string }
  | { kind: 'tens'; tens: number; units: number };
/**
 * « Les dominos des nombres »: on the table, a domino with an open end (`open`); in the hand, pieces.
 * The piece that fits is the one whose left half (`left`) shows the SAME number as the open end.
 * Each piece's `label` is also the option sent to the server (readable text in the parents' history).
 */
export interface DominoSpec {
  game: 'dominoes';
  table: { left: DominoFace; open: DominoFace };
  pieces: Array<{ label: string; left: DominoFace; right: DominoFace }>;
  options: string[];
}
/**
 * « Le potager qui écoute » (English listening): the app SAYS `say` in English (never shown before the answer) and the
 * child taps the matching picture. Each picture is an emoji or a numeral; the option id is what is sent as the answer.
 */
export interface ListenPickSpec {
  game: 'listen-pick';
  mode: 'word' | 'phrase' | 'riddle';
  say: string;
  options: string[]; // word ids, the value sent as the answer
  pics: Record<string, string>; // picture of each option
}
export type GameSpec = AppleCratesSpec | NumberTrainSpec | FrogJumpSpec | ChoiceSpec | NumberPathSpec | HiddenWordsSpec | DominoSpec | ListenPickSpec;

/** Part of the exercise that may be shown to the child before confirmation. */
export interface PublicExercise {
  exerciseId: string;
  exerciseVersion: number;
  skillId: string;
  subject: Subject;
  difficulty: Difficulty;
  responseType: ResponseType;
  instruction: string; // fr-CA, short
  statement: string; // fr-CA
  visual?: ExerciseVisual;
  hint?: string;
  answerFormat: string; // e.g. "un nombre", "un mot"
  /** Neutral label for reading the image (does not contain the answer). */
  readingHint: string;
  /** Present when the exercise is an on-screen mini-game round. */
  game?: GameSpec;
}

/** Full instance kept on the server (includes the expected answer). */
export interface ExerciseInstance extends PublicExercise {
  questionKey: string; // identifies the question to avoid immediate repetition
  seed: number;
  expected: ExpectedAnswer;
  explanation: string; // fr-CA, shown after confirmation
  commonErrors: Array<{ match: string; type: string; message: string }>;
  origin: string;
  /** Mini-games: sentence spoken after a mistake that matches no common error. */
  retryMessage?: string;
}

export type ExpectedAnswer =
  | { type: 'number'; value: number }
  | { type: 'sequence'; values: number[] }
  | { type: 'word'; value: string; accentsMatter: boolean; alternatives?: string[] }
  | { type: 'short-text'; variants: string[][]; display: string };

export interface EvaluationResult {
  result: AttemptResult;
  normalizedAnswer: string;
  errorType?: string;
  errorMessage?: string;
  correctAnswerDisplay: string;
}

export interface MasteryState {
  skillId: string;
  estimate: number; // 0..1: mastery estimate (NOT the reading confidence)
  level: Difficulty;
  evidenceCount: number;
  independentStreak: number;
  consecutiveErrors: number;
  helpCount: number;
  recent: Array<{ correct: boolean; help: HelpLevel; at: string }>;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  reviewStep: number;
  /** When the review step last went up (it goes up at most once per local day). */
  reviewStepAt?: string | null;
  confidence: number; // 0..1: confidence in the ESTIMATE (amount of evidence)
  lastChangeReason: string;
  /**
   * Level change caused by the latest evidence, in structured form (the engine does not depend on the text,
   * which may be translated). Absent in states saved before this field existed.
   */
  lastLevelChange?: 'advanced' | 'lowered' | null;
  /**
   * A level-up that is ready, waiting for confirmation in a session on ANOTHER day (spaced practice: mastery is confirmed
   * after an interval, not in the same session). Absent/null = nothing pending.
   * `level` climbs while she keeps proving higher levels before the confirmation (`climb` = independent successes in a
   * row at a level above `level`), so the next day confirms what she really showed, not just one level more.
   */
  pendingAdvance?: { level: Difficulty; since: string; climb?: { level: Difficulty; n: number } | null } | null;
}

export interface SelectionDecision {
  skillId: string;
  difficulty: Difficulty;
  reasonCode: 'first-contact' | 'review-due' | 'reinforcement' | 'advance' | 'practice' | 'parent-choice' | 'learner-reinforce' | 'learner-explore' | 'learner-standard' | 'child-choice';
  reason: string; // auditable text (parent panel)
}

export type AssignmentStatus =
  | 'presented'
  | 'answered_on_paper'
  | 'in_review'
  | 'confirmed'
  | 'illegible'
  | 'cancelled';

export type ReviewStatus =
  | 'pending' // photo received or manual transcription open
  | 'analyzing'
  | 'suggested'
  | 'failed'
  | 'confirmed'
  | 'illegible'
  | 'cancelled';

export interface ReadingResult {
  transcription: string;
  uncertain: string[];
  confidence: 'low' | 'medium' | 'high';
  model: string;
}

export interface MissionStep {
  index: number;
  pointId: string;
  subject: Subject | 'any';
  title: string; // fr-CA
  intro: string; // fr-CA
  reward: { key: string; label: string };
}

export interface MissionDefinition {
  id: string;
  version: number;
  title: string;
  intro: string;
  outro: string;
  npc: string;
  steps: MissionStep[];
  completionReward: { key: string; label: string };
}
