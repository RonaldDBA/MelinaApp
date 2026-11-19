import { describe, expect, it } from 'vitest';
import { conquestPhrase, pick, successPhrase } from './praise';

describe('child-facing phrases', () => {
  it('list of 3 phrases: never repeats the previous one (before, it could repeat right after 3 draws)', () => {
    let prev = '';
    for (let i = 0; i < 300; i++) {
      const p = pick('test-3', ['a', 'b', 'c']);
      expect(p).not.toBe(prev);
      prev = p;
    }
  });
  it('list of 2 phrases: alternates', () => {
    let prev = '';
    for (let i = 0; i < 50; i++) {
      const p = pick('test-2', ['x', 'y']);
      expect(p).not.toBe(prev);
      prev = p;
    }
  });
  it('the weak-spot celebration never repeats the previous phrase', () => {
    let prev = '';
    for (let i = 0; i < 60; i++) {
      const p = conquestPhrase('retenue (10 unités = 1 dizaine)');
      expect(p).not.toBe(prev);
      expect(p).not.toMatch(/\(/); // without the explanation in parentheses
      prev = p;
    }
  });
  it('hard item or a challenge she chose: full phrase with the strategy', () => {
    const r = successPhrase({ strategy: 'Tu as bien fait la retenue.', afterError: false, hard: true, streak: 1 });
    expect(r.spoken).toContain('Tu as bien fait la retenue.');
  });
});
