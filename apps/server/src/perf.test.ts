import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { bootstrap, learnerProfile, resetLearnerCache, type Ctx } from './service';

process.env.MELINA_SKIP_ENV_FILE = '1';
const H = { 'x-melina-client': '1', host: '127.0.0.1:3001' };
let dir = '';
let close: (() => void) | null = null;
afterEach(() => {
  close?.();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Simulated large history (years of use): copies real rounds with new ids and dates. */
function inflate(ctx: Ctx, n: number) {
  const db = ctx.db;
  db.exec('PRAGMA foreign_keys = OFF');
  const asg = db.prepare('SELECT * FROM assignments').all() as Array<Record<string, unknown>>;
  const att = db.prepare('SELECT * FROM attempts').all() as Array<Record<string, unknown>>;
  const insA = db.prepare(`INSERT INTO assignments (${Object.keys(asg[0] as object).join(',')}) VALUES (${Object.keys(asg[0] as object).map(() => '?').join(',')})`);
  const insT = db.prepare(`INSERT INTO attempts (${Object.keys(att[0] as object).join(',')}) VALUES (${Object.keys(att[0] as object).map(() => '?').join(',')})`);
  const t0 = new Date('2024-01-01T15:00:00Z').getTime();
  db.exec('BEGIN');
  for (let i = 0; i < n; i++) {
    const t = att[i % att.length] as Record<string, unknown>;
    const a = asg.find((x) => x.id === t.assignment_id) as Record<string, unknown>;
    const aid = randomUUID();
    const at = new Date(t0 + i * 3_600_000).toISOString();
    insA.run(...(Object.values({ ...a, id: aid, created_at: at, updated_at: at }) as never[]));
    insT.run(...(Object.values({ ...t, id: randomUUID(), assignment_id: aid, review_id: randomUUID(), created_at: at }) as never[]));
  }
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
}

describe('performance with a large history', () => {
  it('measures the time of a game answer with 20 000 answers in the history', async () => {
    dir = mkdtempSync(join(tmpdir(), 'melina-perf-'));
    let clock = new Date('2026-11-17T15:00:00Z');
    const cfg = loadConfig({ dataDir: dir, apiKey: '', staticDir: null, port: 3001 });
    const ctx: Ctx = { db: openDatabase(join(dir, 'melina.db')), cfg, now: () => clock };
    bootstrap(ctx);
    close = () => ctx.db.close();
    const app = await buildApp(ctx);
    const play = async () => {
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
      const exp = JSON.parse((ctx.db.prepare('SELECT snapshot_json FROM assignments WHERE id = ?').get(r.id) as { snapshot_json: string }).snapshot_json).expected;
      const t = performance.now();
      await app.inject({ method: 'POST', url: `/api/game-rounds/${r.id}/answer`, headers: H, payload: { answer: String(exp.value) } });
      clock = new Date(clock.getTime() + 60_000);
      return performance.now() - t;
    };
    for (let i = 0; i < 6; i++) await play();
    inflate(ctx, 20_000);
    const t1 = performance.now();
    learnerProfile(ctx);
    const one = performance.now() - t1;
    const times: number[] = [];
    for (let i = 0; i < 3; i++) times.push(await play());
    console.log(`PERF profile=${one.toFixed(0)}ms answer=${times.map((x) => x.toFixed(0)).join('/')}ms`);
    // the incremental profile (answers applied one by one to the stored profile) is IDENTICAL to the full recomputation
    const incremental = learnerProfile(ctx);
    resetLearnerCache(ctx.db);
    expect(incremental).toEqual(learnerProfile(ctx));
    // and an answer with 20 000 in the history does not re-read the whole history (before: ~850 ms on this machine)
    expect(Math.min(...times)).toBeLessThan(400);
  }, 120_000);
});
