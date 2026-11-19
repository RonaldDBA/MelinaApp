export * from './catalog';
export * from './generators';
export * from './evaluate';
export * from './games';
export * from './counting';
export { tagsOf, TAG_LABELS, spellingTags } from './tags';
export { strategyPraise } from './praise';
export { buildCommandRound } from './commands';
export { workedFor, workedHint, addSubWorked, sequenceWorked, type Worked } from './worked';
export { englishWords, englishWord, englishPairs, buildListenRound, listenPool, soundAlikes, LISTEN_OPTIONS, THEME_FR, type EnglishWord } from './english';
export { faceLabel as dominoFaceLabel, faceValue as dominoFaceValue } from './dominoes';
export { occurrences as hiddenWordOccurrences, LEVELS as hiddenWordLevels } from './hiddenwords';
export { schoolWeeks, schoolPool, isSchoolWeek, gridForms, levelOf as wordLevel, type SchoolWeek } from './schoolwords';

import type { ExerciseInstance, PublicExercise } from '@melina/shared';

/** Removes everything that must not reach the child before confirmation. */
export function toPublic(i: ExerciseInstance): PublicExercise {
  return {
    exerciseId: i.exerciseId,
    exerciseVersion: i.exerciseVersion,
    skillId: i.skillId,
    subject: i.subject,
    difficulty: i.difficulty,
    responseType: i.responseType,
    instruction: i.instruction,
    statement: i.statement,
    visual: i.visual,
    hint: i.hint,
    answerFormat: i.answerFormat,
    readingHint: i.readingHint,
    game: i.game,
  };
}
