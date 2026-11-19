/**
 * Geometry of the fixed stage. All measurements are in drawing points (1920×1080);
 * the whole screen is scaled up or down by a single factor, so nothing here depends on the window.
 */
export const STAGE = { width: 1920, height: 1080 } as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridSpec {
  cols: number;
  rows: number;
  /** inner margins of the artwork, as a fraction of the size: [top, right, bottom, left] */
  inset: [number, number, number, number];
}

export interface Spot {
  x: number; // center
  y: number;
  size: number;
}

export const inside = (inner: Rect, outer: Rect, eps = 0.01) =>
  inner.x >= outer.x - eps && inner.y >= outer.y - eps && inner.x + inner.w <= outer.x + outer.w + eps && inner.y + inner.h <= outer.y + outer.h + eps;

export const overlaps = (a: Rect, b: Rect, eps = 0.01) => a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;

/** Lays out n equal crates inside the zone, centered, without leaving it. */
export function crateRects(n: number, zone: Rect, aspect: number, gapX: number, gapY: number): Rect[] {
  if (n <= 0) return [];
  const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const w = Math.min((zone.w - (cols - 1) * gapX) / cols, ((zone.h - rows * gapY) / rows) * aspect);
  const h = w / aspect;
  const totalW = cols * w + (cols - 1) * gapX;
  const x0 = zone.x + (zone.w - totalW) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: x0 + (i % cols) * (w + gapX), y: zone.y + Math.floor(i / cols) * (h + gapY), w, h }));
}

/** Centers of a crate's slots (order: row by row, left to right). */
export function slotSpots(crate: Rect, grid: GridSpec): Spot[] {
  const [t, r, b, l] = grid.inset;
  const ix = crate.x + crate.w * l;
  const iy = crate.y + crate.h * t;
  const cw = (crate.w * (1 - l - r)) / grid.cols;
  const ch = (crate.h * (1 - t - b)) / grid.rows;
  const size = Math.min(cw, ch) * 0.94;
  const spots: Spot[] = [];
  for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) spots.push({ x: ix + (col + 0.5) * cw, y: iy + (row + 0.5) * ch, size });
  return spots;
}

/** Positions of the loose fruits: one per cell, with a small offset that never leaves the cell. */
export function pileSpots(n: number, zone: Rect, random: () => number, maxSize = 124): Array<Spot & { rot: number }> {
  if (n <= 0) return [];
  const cols = n <= 6 ? 3 : n <= 12 ? 4 : n <= 20 ? 5 : n <= 30 ? 6 : 7;
  const rows = Math.ceil(n / cols);
  const cw = zone.w / cols;
  const ch = zone.h / rows;
  const size = Math.min(maxSize, Math.min(cw, ch) * 0.9);
  const cells = Array.from({ length: cols * rows }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cells[i], cells[j]] = [cells[j] as number, cells[i] as number];
  }
  return cells.slice(0, n).map((cell) => {
    const c = cell % cols;
    const r = Math.floor(cell / cols);
    return {
      x: zone.x + (c + 0.5) * cw + (random() - 0.5) * (cw - size),
      y: zone.y + (r + 0.5) * ch + (random() - 0.5) * (ch - size),
      size,
      rot: Math.round((random() - 0.5) * 30),
    };
  });
}

export const spotRect = (s: Spot): Rect => ({ x: s.x - s.size / 2, y: s.y - s.size / 2, w: s.size, h: s.size });

/** Checks a scene: everything inside the stage and with positive sizes. Returns the list of problems. */
export function sceneProblems(scene: { stage?: { width?: number; height?: number }; zones?: Record<string, Rect>; props?: Record<string, Rect> }): string[] {
  const out: string[] = [];
  if (scene.stage?.width !== STAGE.width || scene.stage?.height !== STAGE.height) out.push('stage must be 1920×1080');
  const full: Rect = { x: 0, y: 0, w: STAGE.width, h: STAGE.height };
  for (const [group, items] of [['zones', scene.zones ?? {}], ['props', scene.props ?? {}]] as const) {
    for (const [name, r] of Object.entries(items)) {
      if (![r.x, r.y, r.w, r.h].every((v) => typeof v === 'number' && Number.isFinite(v)) || r.w <= 0 || r.h <= 0) out.push(`${group}.${name}: invalid measurements`);
      else if (!inside(r, full)) out.push(`${group}.${name}: outside the stage`);
    }
  }
  return out;
}
