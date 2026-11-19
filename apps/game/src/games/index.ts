import type { ComponentType } from 'react';
import { AppleCrates } from './AppleCrates';
import { Dominoes } from './Dominoes';
import { FrogJump } from './FrogJump';
import { HiddenWords } from './HiddenWords';
import { MysteryStory } from './MysteryStory';
import { NumberPath } from './NumberPath';
import { NumberTrain } from './NumberTrain';
import { WordFishing } from './WordFishing';

/** Mini-games available on screen, by server identifier. */
export const gameScreens: Record<string, ComponentType<{ onExit: () => void }>> = {
  'game.apple-crates': AppleCrates,
  'game.number-train': NumberTrain,
  'game.frog-jump': FrogJump,
  'game.word-fishing': WordFishing,
  'game.mystery-story': MysteryStory,
  'game.number-path': NumberPath,
  'game.hidden-words': HiddenWords,
  'game.dominoes': Dominoes,
};
