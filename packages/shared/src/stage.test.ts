import { describe, expect, it } from 'vitest';
import scene from '../../../content/scenes/apple-crates.json';
import { crateRects, createRng, inside, overlaps, pileSpots, sceneProblems, slotSpots, spotRect, type GridSpec, type Rect } from './index';
import frog from '../../../content/scenes/frog-jump.json';
import story from '../../../content/scenes/mystery-story.json';
import train from '../../../content/scenes/number-train.json';
import fishing from '../../../content/scenes/word-fishing.json';


const zones = scene.zones as Record<string, Rect>;
const grid = scene.crate.grid as GridSpec;

describe('every scene fits on the stage', () => {
  it('zones, props and choice positions stay inside 1920×1080 and the choices do not overlap', () => {
    const full: Rect = { x: 0, y: 0, w: 1920, h: 1080 };
    for (const sc of [scene, train, frog, fishing, story]) expect(sceneProblems(sc as never), sc.id).toEqual([]);
    for (const list of [frog.pads, fishing.fish, story.options] as Rect[][]) {
      for (const r of list) expect(inside(r, full)).toBe(true);
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) expect(overlaps(list[i] as Rect, list[j] as Rect)).toBe(false);
    }
    // the whole train fits in its zone
    const t = train.train;
    expect(t.locoW + 6 * (t.wagonW + t.gap)).toBeLessThanOrEqual(train.zones.train.w);
  });
});

describe('fixed stage: geometry of the apple game', () => {
  it('the project scene fits on the 1920×1080 stage', () => {
    expect(sceneProblems(scene as never)).toEqual([]);
    expect(sceneProblems({ stage: { width: 1920, height: 1080 }, zones: { x: { x: 1800, y: 0, w: 200, h: 10 } } })).toEqual(['zones.x: outside the stage']);
  });

  it('from 1 to 10 crates: all inside the zone, not overlapping, with room for the label', () => {
    for (let n = 1; n <= 10; n++) {
      const rects = crateRects(n, zones.crates as Rect, scene.crate.aspect, scene.crate.gapX, scene.crate.gapY);
      expect(rects).toHaveLength(n);
      for (const r of rects) {
        expect(inside({ ...r, h: r.h + scene.crate.gapY }, zones.crates as Rect)).toBe(true);
        expect(r.w / r.h).toBeCloseTo(scene.crate.aspect, 3);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlaps(rects[i] as Rect, rects[j] as Rect)).toBe(false);
    }
  });

  it('the 10 slots stay inside the crate and do not overlap, for any crate size', () => {
    for (let n = 1; n <= 10; n++) {
      for (const crate of crateRects(n, zones.crates as Rect, scene.crate.aspect, scene.crate.gapX, scene.crate.gapY)) {
        const spots = slotSpots(crate, grid);
        expect(spots).toHaveLength(10);
        const rects = spots.map(spotRect);
        for (const r of rects) expect(inside(r, crate)).toBe(true);
        for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) expect(overlaps(rects[i] as Rect, rects[j] as Rect)).toBe(false);
      }
    }
  });

  it('from 1 to 40 loose fruits: all inside the blanket and not overlapping, with any seed', () => {
    for (let n = 1; n <= 40; n++) {
      for (const seed of [1, 77, 4242]) {
        const rects = pileSpots(n, zones.pile as Rect, createRng(seed + n).next).map(spotRect);
        expect(rects).toHaveLength(n);
        for (const r of rects) expect(inside(r, zones.pile as Rect)).toBe(true);
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlaps(rects[i] as Rect, rects[j] as Rect)).toBe(false);
      }
    }
  });

  it('the fruit zone sits on the blanket, and the play zones do not intrude on the bar or the guide', () => {
    expect(inside(zones.pile as Rect, scene.props.blanket)).toBe(true);
    expect(overlaps(zones.pile as Rect, zones.crates as Rect)).toBe(false);
    for (const z of [zones.pile, zones.crates] as Rect[]) {
      expect(z.y).toBeGreaterThanOrEqual(128);
      expect(z.y + z.h).toBeLessThanOrEqual(846);
    }
  });
});
