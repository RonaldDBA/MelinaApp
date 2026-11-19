import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { bootstrap, learnerProfile, recoverFiles, type Ctx } from './service';
import { almostTags, conqueredTags, initialState as initialStateFor } from '@melina/adaptive-engine';
import { soundAlikes } from '@melina/curriculum';

process.env.MELINA_SKIP_ENV_FILE = '1';
const fixtures = join(__dirname, '../../../tests/fixtures');
const H = { 'x-melina-client': '1', host: '127.0.0.1:3001' };

let dir: string;
let ctx: Ctx;
let clock: Date;

async function makeApp(opts: { apiKey?: string; fetchImpl?: typeof fetch } = {}) {
  const cfg = loadConfig({ dataDir: dir, apiKey: opts.apiKey ?? '', staticDir: null, port: 3001 });
  const db = openDatabase(join(dir, 'melina.db'));
  ctx = { db, cfg, now: () => clock, fetchImpl: opts.fetchImpl };
  bootstrap(ctx);
  return buildApp(ctx);
}

function multipart(file: Buffer, name = 'photo.jpg', mime = 'image/jpeg') {
  const boundary = '----melinaTest';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, file, tail]), headers: { ...H, 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'melina-test-'));
  clock = new Date('2026-11-17T15:00:00Z');
});
afterEach(() => {
  ctx?.db.close();
  rmSync(dir, { recursive: true, force: true });
});

type App = Awaited<ReturnType<typeof makeApp>>;
async function startMissionAssignment(app: App, step = 0) {
  const s = (await app.inject({ method: 'POST', url: '/api/sessions', headers: H, payload: { mode: 'mission', missionId: 'garden-seeds' } })).json();
  const a = await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: s.id, missionStep: step } });
  return { session: s, assignment: a.json() };
}
function expectedOf(assignmentId: string) {
  const row = ctx.db.prepare('SELECT snapshot_json FROM assignments WHERE id = ?').get(assignmentId) as { snapshot_json: string };
  const ex = JSON.parse(row.snapshot_json);
  const e = ex.expected;
  return e.type === 'number' ? String(e.value) : e.type === 'sequence' ? e.values.join(', ') : e.type === 'word' ? e.value : e.display;
}

describe('local API security', () => {
  it('rejects mutations without the app header, from another origin or from another host', async () => {
    const app = await makeApp();
    expect((await app.inject({ method: 'POST', url: '/api/sessions', headers: { host: '127.0.0.1:3001' }, payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/sessions', headers: { ...H, origin: 'https://evil.example' }, payload: {} })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/health', headers: { host: 'evil.example' } })).statusCode).toBe(421);
    expect((await app.inject({ method: 'GET', url: '/api/health', headers: { host: '127.0.0.1:3001' } })).json().ok).toBe(true);
  });

  it('does not expose the expected answer before confirmation and does not serve the data folder', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const text = JSON.stringify(assignment);
    expect(text).not.toContain('"expected"');
    expect(text).not.toContain('explanation');
    expect(assignment.outcome).toBeNull();
    expect((await app.inject({ method: 'GET', url: '/data/melina.db', headers: H })).statusCode).toBe(404);
  });

  it('the frontend cannot declare the answer correct', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    const r = await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { text: 'wrong-answer-xyz', help: 'none', result: 'correct', correct: true } });
    expect(r.json().result.result).toBe('incorrect');
  });
});

describe('learning flow', () => {
  it('manual transcription → evaluation → mastery → mission, with no duplication on repeated confirmation', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/done`, headers: H });
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    const answer = expectedOf(assignment.id);
    const payload = { text: answer, help: 'none' };
    const [r1, r2] = await Promise.all([
      app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload }),
      app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload }),
    ]);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    const bodies = [r1.json(), r2.json()];
    expect(bodies.filter((b) => b.duplicate)).toHaveLength(1);
    expect(bodies.find((b) => !b.duplicate).result.result).toBe('correct');
    expect(bodies.find((b) => !b.duplicate).rewards).toEqual([{ key: 'seed.sunflower', label: 'une graine de tournesol' }]);
    const counts = ctx.db.prepare('SELECT (SELECT COUNT(*) FROM attempts) a, (SELECT COUNT(*) FROM rewards) r, (SELECT COUNT(*) FROM mission_steps) s').get() as Record<string, number>;
    expect(counts).toEqual({ a: 1, r: 1, s: 1 });
    // third attempt to confirm: still idempotent
    const r3 = await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload });
    expect(r3.json().duplicate).toBe(true);
    const progress = (await app.inject({ method: 'GET', url: '/api/progress', headers: H })).json();
    const st = progress.skills.find((s: { id: string }) => s.id === assignment.exercise.skillId).state;
    expect(st.evidenceCount).toBe(1);
    expect(st.estimate).toBeGreaterThan(0);
  });

  it('an illegible image counts as no learning error and does not change mastery; a new photo allows continuing', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const up = await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-47-gps.jpg'))) });
    expect(up.statusCode).toBe(200);
    const rv = up.json().review;
    const ill = await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { illegible: true } });
    expect(ill.json().outcome).toBe('illegible');
    expect(ctx.db.prepare('SELECT COUNT(*) n FROM attempts').get()).toEqual({ n: 0 });
    expect(ctx.db.prepare('SELECT COUNT(*) n FROM mastery').get()).toEqual({ n: 0 });
    const hist = (await app.inject({ method: 'GET', url: '/api/history', headers: H })).json();
    expect(hist[0].category).toBe('illegible');
    // new attempt with manual transcription
    const rv2 = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    const ok = await app.inject({ method: 'POST', url: `/api/reviews/${rv2.id}/confirm`, headers: H, payload: { text: 'anything', help: 'adult' } });
    expect(ok.json().outcome).toBe('evaluated');
  });

  it('the same step does not create duplicate exercises and out-of-order steps are rejected', async () => {
    const app = await makeApp();
    const { session, assignment } = await startMissionAssignment(app, 0);
    const again = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: session.id, missionStep: 0 } })).json();
    expect(again.id).toBe(assignment.id);
    const skip = await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: session.id, missionStep: 2 } });
    expect(skip.statusCode).toBe(409);
  });

  it('full mission: three steps, final reward, selection uses history; state survives a restart', async () => {
    let app = await makeApp();
    const { session } = await startMissionAssignment(app, 0);
    const skillsUsed: string[] = [];
    const reasons: string[] = [];
    // step 1 (French) answered wrong on purpose: the seed does NOT sprout (no reward just for taking part),
    // the step stays open and comes back with another, reinforcement question; nothing she already earned is taken away
    const plan: Array<{ step: number; right: boolean; help: 'none' | 'hint' }> = [
      { step: 0, right: true, help: 'none' },
      { step: 1, right: false, help: 'none' },
      { step: 1, right: true, help: 'hint' },
      { step: 2, right: true, help: 'none' },
    ];
    for (const [i, p] of plan.entries()) {
      const a = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: session.id, missionStep: p.step } })).json();
      skillsUsed.push(a.exercise.skillId);
      reasons.push(a.selectionReason);
      expect(a.selectionReason.length).toBeGreaterThan(5);
      if (p.step === 0) expect(a.exercise.subject).toBe('mathematics');
      if (p.step === 1) expect(a.exercise.subject).toBe('french');
      const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${a.id}/manual`, headers: H })).json().review;
      const res = (await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { text: p.right ? expectedOf(a.id) : 'zzz', help: p.help } })).json();
      expect(res.result.result).toBe(p.right ? 'correct' : 'incorrect');
      if (i === 1) {
        expect(res.rewards).toEqual([]); // no seed
        const gpMid = (await app.inject({ method: 'GET', url: '/api/game-progress', headers: H })).json();
        expect(gpMid.missions[0]).toMatchObject({ status: 'active', nextStep: 1 });
        expect(gpMid.rewards.map((r: { key: string }) => r.key)).toEqual(['seed.sunflower']);
      }
      clock = new Date(clock.getTime() + 60_000);
    }
    const gp = (await app.inject({ method: 'GET', url: '/api/game-progress', headers: H })).json();
    expect(gp.missions[0].status).toBe('completed');
    expect(gp.rewards.map((r: { key: string }) => r.key)).toEqual(['seed.sunflower', 'seed.carrot', 'seed.tomato', 'garden.bloom']);
    await app.inject({ method: 'PUT', url: '/api/game-progress', headers: H, payload: { x: 321, y: 222 } });

    // the step redone after the French mistake chose reinforcement of the same skill
    expect(reasons[2]).toBe('Renforcement après une difficulté récente.');
    expect(skillsUsed[2]).toBe(skillsUsed[1]);
    // the reinforcement was answered right with a hint: the next French practice switches skill
    const practice = (await app.inject({ method: 'POST', url: '/api/sessions', headers: H, payload: { mode: 'practice', subject: 'french' } })).json();
    const next = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: practice.id } })).json();
    expect(next.exercise.skillId).not.toBe(skillsUsed[2]);
    expect(next.selectionReason).toMatch(/Premier contact/);

    // restart: close and reopen the database
    await app.close();
    ctx.db.close();
    app = await makeApp();
    const gp2 = (await app.inject({ method: 'GET', url: '/api/game-progress', headers: H })).json();
    expect(gp2.missions[0].status).toBe('completed');
    expect(gp2.state).toMatchObject({ x: 321, y: 222 });
    const hist = (await app.inject({ method: 'GET', url: '/api/history', headers: H })).json();
    expect(hist.filter((h: { category: string }) => h.category === 'wrong-answer')).toHaveLength(1);
    expect(hist.find((h: { result: string | null; help: string | null }) => h.help === 'hint').result).toBe('correct');
    const pending = (await app.inject({ method: 'GET', url: '/api/assignments/pending', headers: H })).json();
    expect(pending.map((p: { id: string }) => p.id)).toContain(next.id); // pending activity can be resumed
  });

  it('the exercise version used is frozen in the history', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const snap = ctx.db.prepare('SELECT exercise_version, snapshot_json FROM assignments WHERE id = ?').get(assignment.id) as { exercise_version: number; snapshot_json: string };
    expect(snap.exercise_version).toBe(1);
    expect(JSON.parse(snap.snapshot_json).statement).toBe(assignment.exercise.statement);
  });
});

describe('photos', () => {
  it('accepts valid JPEG/PNG/WebP, strips metadata, rejects fake content and large files', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const fake = await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, 'not-an-image.jpg'))) });
    expect(fake.statusCode).toBe(415);
    const big = await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(Buffer.alloc(9 * 1024 * 1024, 1)) });
    expect(big.statusCode).toBe(413);
    for (const f of ['synthetic-chats.png', 'synthetic-9.webp', 'synthetic-47-gps.jpg']) {
      const r = await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, f)), '../../etc/passwd') });
      expect(r.statusCode, f).toBe(200);
    }
    const files = readdirSync(join(dir, 'photos')).filter((f) => /\.(jpg|png|webp)$/.test(f));
    expect(files).toHaveLength(3);
    expect(files.every((f) => /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(f))).toBe(true);
    const jpg = readFileSync(join(dir, 'photos', files.find((f) => f.endsWith('.jpg')) as string));
    expect(jpg.includes(Buffer.from('SyntheticCam'))).toBe(false);
  });

  it('accidentally resending the same photo returns the same reading', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const img = readFileSync(join(fixtures, 'synthetic-47-gps.jpg'));
    const a = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(img) })).json();
    const b = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(img) })).json();
    expect(b.duplicate).toBe(true);
    expect(b.review.id).toBe(a.review.id);
  });

  it('a photo is only accessible through the authorized flow', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const up = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-47-gps.jpg'))) })).json();
    const pid = up.review.photoId;
    expect((await app.inject({ method: 'GET', url: `/api/photos/${pid}`, headers: { host: '127.0.0.1:3001' } })).statusCode).toBe(403);
    const ok = await app.inject({ method: 'GET', url: `/api/photos/${pid}`, headers: H });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('image/jpeg');
  });

  it('orphan files are collected at startup', async () => {
    await makeApp();
    writeFileSync(join(dir, 'photos', '11111111-1111-1111-1111-111111111111.jpg'), 'x');
    writeFileSync(join(dir, 'photos', 'tmp', 'abc.part'), 'x');
    expect(recoverFiles(ctx)).toEqual({ tmpRemoved: 1, orphansMoved: 1 });
  });
});

describe('paper: bugs found in the deep review', () => {
  it('paper routes reject on-screen game rounds (before: the round was left orphaned)', async () => {
    const app = await makeApp();
    const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
    for (const url of [`/api/assignments/${r.id}/done`, `/api/assignments/${r.id}/manual`]) {
      const res = await app.inject({ method: 'POST', url, headers: H });
      expect(res.statusCode, url).toBe(400);
      expect(res.json().code ?? res.json().error, url).toBeTruthy();
    }
    // the round is still playable
    const ok = await app.inject({ method: 'POST', url: `/api/game-rounds/${r.id}/answer`, headers: H, payload: { answer: expectedOf(r.id) } });
    expect(ok.statusCode).toBe(200);
  });

  it('the hint used in the app counts at confirmation, even if the parents tick «seule»', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/hint`, headers: H });
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    const res = (await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { text: expectedOf(assignment.id), help: 'none' } })).json();
    expect(res.result.help).toBe('hint');
  });

  it('the worksheet counts on the day she FINISHED it, not on the day the parents confirmed', async () => {
    const app = await makeApp();
    clock = new Date(2026, 10, 17, 16, 0);
    const { assignment } = await startMissionAssignment(app);
    await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/done`, headers: H });
    clock = new Date(2026, 10, 18, 9, 0); // the parents confirm the next morning
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { text: expectedOf(assignment.id), help: 'none' } });
    const att = ctx.db.prepare('SELECT created_at, mastery_after_json FROM attempts').get() as { created_at: string; mastery_after_json: string };
    expect(new Date(att.created_at).getDate()).toBe(17);
    expect(new Date(JSON.parse(att.mastery_after_json).lastPracticedAt).getDate()).toBe(17);
  });

  it('resending the confirmation returns the rewards already earned (response lost on the network)', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    const payload = { text: expectedOf(assignment.id), help: 'none' };
    const first = (await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload })).json();
    const again = (await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload })).json();
    expect(first.rewards.map((r: { key: string }) => r.key)).toEqual(['seed.sunflower']);
    expect(again.duplicate).toBe(true);
    expect(again.rewards).toEqual(first.rewards);
  });

  it('a reading stuck in «analyzing» (the app crashed during the AI call) goes back to «failed» at startup; text cannot change during analysis', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    ctx.db.prepare("UPDATE ai_reviews SET status = 'analyzing' WHERE id = ?").run(rv.id);
    expect((await app.inject({ method: 'PATCH', url: `/api/reviews/${rv.id}/transcription`, headers: H, payload: { text: 'abc' } })).statusCode).toBe(409);
    bootstrap(ctx); // app restart
    expect((ctx.db.prepare('SELECT status, error_code FROM ai_reviews WHERE id = ?').get(rv.id) as { status: string; error_code: string })).toEqual({ status: 'failed', error_code: 'interrupted' });
  });
});

describe('AI (mocked) and handwriting', () => {
  const toolReply = (t: string) =>
    new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'report_transcription', input: { transcription: t, uncertain: ['4 ou 9'], confidence: 'medium', illegible: false } }] }), { status: 200 });

  it('AI disabled or without consent is not called', async () => {
    let calls = 0;
    const app = await makeApp({ apiKey: 'test-key', fetchImpl: (async () => (calls++, toolReply('47'))) as unknown as typeof fetch });
    const { assignment } = await startMissionAssignment(app);
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-47-gps.jpg'))) })).json().review;
    expect((await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/analyze`, headers: H })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'ai.enabled': true } })).statusCode).toBe(400);
    expect(calls).toBe(0);
  });

  it('suggested reading → parent correction → authorized sample → reused in the next reading (without the expected answer)', async () => {
    const bodies: string[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(String(init.body));
      return toolReply('4?');
    }) as unknown as typeof fetch;
    const app = await makeApp({ apiKey: 'test-key', fetchImpl });
    await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'ai.enabled': true, 'ai.consent': true } });
    const { session, assignment } = await startMissionAssignment(app);
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-47-gps.jpg'))) })).json().review;
    const analyzed = (await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/analyze`, headers: H })).json();
    expect(analyzed.status).toBe('suggested');
    expect(analyzed.suggestedText).toBe('4?');
    expect(analyzed.uncertain).toEqual(['4 ou 9']);
    const expected = expectedOf(assignment.id);
    expect(bodies[0]).not.toContain(assignment.exercise.statement);
    const conf = (await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { text: '47', help: 'none', saveSample: true, allowExternal: true, quality: 3 } })).json();
    expect(conf.result.transcriptionSource).toBe('ai-corrected');
    // correcting the reading does not count as help
    expect(conf.result.help).toBe('none');
    const samples = (await app.inject({ method: 'GET', url: '/api/handwriting-samples', headers: H })).json();
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ transcription: '47', allowExternal: true, kind: 'number' });

    // the next numeric reading includes the confirmed example
    // the seed only sprouts with the right answer: if «47» was not the expected one, step 0 stays open
    const okStep0 = conf.result.result === 'correct';
    const a2 = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: session.id, missionStep: okStep0 ? 1 : 0 } })).json();
    const prac = (await app.inject({ method: 'POST', url: '/api/sessions', headers: H, payload: { mode: 'practice', subject: 'mathematics' } })).json();
    const a3 = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: prac.id } })).json();
    const rv3 = (await app.inject({ method: 'POST', url: `/api/assignments/${a3.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-9.webp')), 'x.webp', 'image/webp') })).json().review;
    const an3 = (await app.inject({ method: 'POST', url: `/api/reviews/${rv3.id}/analyze`, headers: H })).json();
    expect(an3.samplesUsed).toHaveLength(1);
    expect(bodies[1]).toContain('«47»');
    expect(conf.result.result).toBe('47' === expected ? 'correct' : 'incorrect');
    expect(a2.exercise.subject).toBe(okStep0 ? 'french' : 'mathematics');

    // a deleted sample is no longer retrieved
    await app.inject({ method: 'DELETE', url: `/api/handwriting-samples/${samples[0].id}`, headers: H });
    const rv4 = (await app.inject({ method: 'POST', url: `/api/assignments/${a3.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-47-gps.jpg'))) })).json().review;
    const an4 = (await app.inject({ method: 'POST', url: `/api/reviews/${rv4.id}/analyze`, headers: H })).json();
    expect(an4.samplesUsed).toHaveLength(0);
    expect(bodies[2]).not.toContain('«47»');

    const stats = (await app.inject({ method: 'GET', url: '/api/reading-stats', headers: H })).json();
    expect(stats.correctedByParents).toBe(1);
  });

  it('an AI failure keeps manual transcription available', async () => {
    const fetchImpl = (async () => new Response('{}', { status: 529 })) as unknown as typeof fetch;
    const app = await makeApp({ apiKey: 'test-key', fetchImpl });
    await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'ai.enabled': true, 'ai.consent': true } });
    const { assignment } = await startMissionAssignment(app);
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-47-gps.jpg'))) })).json().review;
    const r = (await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/analyze`, headers: H })).json();
    expect(r.status).toBe('failed');
    expect(r.errorCode).toBe('unavailable');
    const conf = await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { text: expectedOf(assignment.id), help: 'none' } });
    expect(conf.json().result.transcriptionSource).toBe('manual');
  });

  it('the child gives up on the activity: it does not count as a mistake and the mission step comes back with a new exercise', async () => {
    const app = await makeApp();
    const { session, assignment } = await startMissionAssignment(app);
    const c = await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/cancel`, headers: H });
    expect(c.json().status).toBe('cancelled');
    expect(ctx.db.prepare('SELECT COUNT(*) n FROM attempts').get()).toEqual({ n: 0 });
    expect(ctx.db.prepare('SELECT COUNT(*) n FROM mastery').get()).toEqual({ n: 0 });
    expect(ctx.db.prepare('SELECT COUNT(*) n FROM mission_steps').get()).toEqual({ n: 0 });
    const pending = (await app.inject({ method: 'GET', url: '/api/assignments/pending', headers: H })).json() as Array<{ id: string }>;
    expect(pending.some((p) => p.id === assignment.id)).toBe(false);
    const again = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: session.id, missionStep: 0 } })).json();
    expect(again.id).not.toBe(assignment.id);
    expect(again.status).toBe('presented');
  });

  it('an incompatible state is rejected', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    const rv = (await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/manual`, headers: H })).json().review;
    await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/cancel`, headers: H });
    expect((await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/confirm`, headers: H, payload: { text: '1', help: 'none' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: `/api/reviews/${rv.id}/analyze`, headers: H })).statusCode).toBe(400);
  });
});

describe('backup', () => {
  it('makes a consistent copy with WAL active, includes photos and does not include .env', async () => {
    const app = await makeApp();
    const { assignment } = await startMissionAssignment(app);
    await app.inject({ method: 'POST', url: `/api/assignments/${assignment.id}/photo`, ...multipart(readFileSync(join(fixtures, 'synthetic-47-gps.jpg'))) });
    const b = (await app.inject({ method: 'POST', url: '/api/backups', headers: H })).json();
    expect(b.photos).toBe(1);
    const files = readdirSync(b.folder);
    expect(files.sort()).toEqual(['manifest.json', 'melina.db', 'photos']);
    const copy = openDatabase(join(b.folder, 'melina.db'));
    expect(copy.prepare('SELECT COUNT(*) n FROM assignments').get()).toEqual({ n: 1 });
    copy.close();
  });
});

describe('on-screen mini-games', () => {
  const start = async (app: App) => (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.apple-crates' } })).json();
  const answer = async (app: App, id: string, a: string) => app.inject({ method: 'POST', url: `/api/game-rounds/${id}/answer`, headers: H, payload: { answer: a } });

  it('Le potager qui écoute (English): pictures by ear, evaluated on the server; a sound-alike miss teaches the model', async () => {
    const app = await makeApp();
    const games = (await app.inject({ method: 'GET', url: '/api/games', headers: H })).json();
    expect(games.find((g: { id: string }) => g.id === 'game.listen-garden')).toMatchObject({ skills: ['en.listen-words'], roundsPerSession: 5, level: 1 });
    const start = async () => (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.listen-garden' } })).json();
    const r = await start();
    expect(r.exercise).toMatchObject({ subject: 'english', skillId: 'en.listen-words', difficulty: 1, statement: 'Écoute bien.' });
    expect(r.exercise.game).toMatchObject({ game: 'listen-pick', mode: 'word' });
    expect(r.exercise.game.options).toHaveLength(3);
    expect(JSON.stringify(r)).not.toContain('"expected"');
    const right = expectedOf(r.id);
    const wrong = r.exercise.game.options.find((o: string) => o !== right);
    // only one of the shown pictures is a valid answer
    expect((await answer(app, r.id, 'zebra-unknown')).statusCode).toBe(400);
    const miss = (await answer(app, r.id, wrong)).json();
    expect(miss.state).toBe('retry');
    expect(miss.feedback.message).toMatch(/^Pas tout à fait. Écoute encore./);
    const ok = (await answer(app, r.id, right)).json();
    expect(ok.round.outcome).toMatchObject({ result: 'correct', help: 'hint' });
    expect(ok.round.outcome.explanation).toMatch(/veut dire/);
    // paper practice never picks the English skill (screen only, no reading)
    for (let k = 0; k < 6; k++) {
      const s = (await app.inject({ method: 'POST', url: '/api/sessions', headers: H, payload: { mode: 'practice', subject: 'any' } })).json();
      const a = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: s.id } })).json();
      expect(a.exercise.subject).not.toBe('english');
      await app.inject({ method: 'POST', url: `/api/assignments/${a.id}/cancel`, headers: H });
      clock = new Date(clock.getTime() + 60_000);
    }
    // the model learns per word and theme, with French labels for the parents
    const learned = (await app.inject({ method: 'GET', url: '/api/progress', headers: H })).json().learned.find((x: { skillId: string }) => x.skillId === 'en.listen-words');
    expect(learned).toMatchObject({ answers: 1 });
    // the staircase reaches level 4 the same day: a sound-alike appears and the contrast is in the tags
    let found = false;
    for (let k = 0; k < 40 && !found; k++) {
      const x = await start();
      if (x.exercise.difficulty >= 4) {
        const sp = x.exercise.game;
        expect(sp.mode === 'phrase' || sp.mode === 'riddle').toBe(true);
        expect(sp.options.length).toBeGreaterThanOrEqual(4);
        found = true;
      }
      await answer(app, x.id, expectedOf(x.id));
      clock = new Date(clock.getTime() + 20_000);
    }
    expect(found).toBe(true);
  });

  it('La jardinière dit (English commands): taps in order, predicted mistakes explained, wrong tries kept for the parents', async () => {
    const app = await makeApp();
    const start = async (difficulty?: number) => {
      if (difficulty) await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'en.commands', difficulty } } });
      return (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.garden-says' } })).json();
    };
    const r = await start(4);
    expect(r.exercise.game).toMatchObject({ game: 'commands', steps: 2, containers: ['basket', 'box'] });
    expect(JSON.stringify(r)).not.toContain('"expected"');
    const [obj, place] = expectedOf(r.id).split(',');
    // exactly `steps` taps on things that are on the table
    expect((await answer(app, r.id, obj as string)).statusCode).toBe(400);
    expect((await answer(app, r.id, `${obj},garage`)).statusCode).toBe(400);
    const other = place === 'basket' ? 'box' : 'basket';
    const miss = (await answer(app, r.id, `${obj},${other}`)).json();
    expect(miss.state).toBe('retry');
    expect(miss.feedback.message).toMatch(/où le mettre/);
    expect((await answer(app, r.id, `${obj},${place}`)).json().round.outcome).toMatchObject({ result: 'correct', help: 'hint' });
    const kept = ctx.db.prepare('SELECT wrong_answers FROM assignments WHERE id = ?').get(r.id) as { wrong_answers: string };
    expect(JSON.parse(kept.wrong_answers)).toEqual([`${obj},${other}`]);
    // level 2: the colour comes before the noun; the right object in another colour is its own mistake
    clock = new Date(clock.getTime() + 60_000);
    const c2 = await start(2);
    const target = expectedOf(c2.id);
    const [colour, noun] = target.split('-');
    const sameNoun = c2.exercise.game.items.find((i: string) => i !== target && i.endsWith(`-${noun}`));
    expect(c2.exercise.game.say).toContain(`${colour} ${noun}`);
    expect((await answer(app, c2.id, sameNoun)).json().feedback.message).toMatch(/couleur/);
    await answer(app, c2.id, target);
    // the parents' report counts the mistake by kind
    const rep = (await app.inject({ method: 'GET', url: '/api/report?kind=week&offset=0', headers: H })).json();
    expect(rep.english.commandMistakes.map((m: { type: string }) => m.type).sort()).toEqual(['en-contenant', 'en-couleur']);
  });

  it('English words: a missed sound-alike shows in the report, due words come back, and «still known after 7 days» is measured', async () => {
    const app = await makeApp();
    const play = async (difficulty: number, right: boolean) => {
      await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'en.listen-words', difficulty } } });
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.listen-garden' } })).json();
      const ok = expectedOf(r.id);
      let pair: string | undefined;
      if (!right) {
        // she picks the sound-alike when there is one, otherwise any other picture
        pair = soundAlikes(ok).map((p) => p.id).find((w) => r.exercise.game.options.includes(w));
        await answer(app, r.id, pair ?? r.exercise.game.options.find((o: string) => o !== ok));
      }
      await answer(app, r.id, ok);
      clock = new Date(clock.getTime() + 30_000);
      return { word: ok, pair };
    };
    clock = new Date(2026, 10, 2, 16, 0);
    const first: string[] = [];
    for (let k = 0; k < 6; k++) first.push((await play(1, true)).word);
    // 8 days later: the words she got right come back (due), and the report measures what she still knows
    clock = new Date(2026, 10, 10, 16, 0);
    const back: string[] = [];
    for (let k = 0; k < 16; k++) back.push((await play(1, true)).word);
    // about 4 rounds in 10 bring back a due word (random rounds: 16 rounds make «none» practically impossible)
    expect(back.filter((w) => first.includes(w)).length).toBeGreaterThanOrEqual(1);
    // a sound-alike confusion at level 4
    let confused = false;
    for (let k = 0; k < 30 && !confused; k++) {
      confused = Boolean((await play(4, false)).pair);
    }
    expect(confused).toBe(true);
    const e = (await app.inject({ method: 'GET', url: '/api/report?kind=week&offset=0', headers: H })).json().english;
    expect(e.wordsMet).toBeGreaterThanOrEqual(6);
    // the words that came back 8 days later were right: they are «still known»
    expect(e.retention.kept).toBeGreaterThanOrEqual(1);
    expect(e.retention.tested).toBeGreaterThanOrEqual(e.retention.kept);
    expect(e.wordsKnown).toBeGreaterThanOrEqual(1);
    expect(e.confusions.length).toBeGreaterThanOrEqual(1);
    expect(e.confusions[0].label).toMatch(/anglais/);
    expect(e.canDo[0]).toMatch(/Reconnaît/);
  });

  it('round: does not expose the answer, resumes the open round and evaluates on the server', async () => {
    const app = await makeApp();
    const r = await start(app);
    expect(r.exercise.game).toMatchObject({ game: 'apple-crates', perCrate: 10 });
    expect(JSON.stringify(r)).not.toContain('"expected"');
    expect(r.outcome).toBeNull();
    expect((await start(app)).id).toBe(r.id); // resumed, no new round
    expect((await answer(app, r.id, 'abc')).statusCode).toBe(400);
    const ok = (await answer(app, r.id, expectedOf(r.id))).json();
    expect(ok.state).toBe('done');
    expect(ok.round.outcome).toMatchObject({ result: 'correct', help: 'none', stars: 3 });
    // repeating the answer duplicates nothing
    expect((await answer(app, r.id, expectedOf(r.id))).json().duplicate).toBe(true);
    expect(ctx.db.prepare("SELECT COUNT(*) n FROM attempts WHERE input_mode = 'screen'").get()).toEqual({ n: 1 });
  });

  it('progressive hints: a right answer after a mistake weighs less; three mistakes count as an incorrect answer', async () => {
    const app = await makeApp();
    const r1 = await start(app);
    const wrong = String(Number(expectedOf(r1.id)) + 100);
    const t1 = (await answer(app, r1.id, wrong)).json();
    expect(t1.state).toBe('retry');
    expect(t1.feedback.showCounting).toBe(false);
    expect(t1.round.triesLeft).toBe(2);
    expect(ctx.db.prepare('SELECT COUNT(*) n FROM attempts').get()).toEqual({ n: 0 }); // not evaluated yet
    const t2 = (await answer(app, r1.id, expectedOf(r1.id))).json();
    expect(t2.round.outcome).toMatchObject({ result: 'correct', help: 'hint', stars: 2 });
    const st = (await app.inject({ method: 'GET', url: '/api/progress', headers: H })).json().skills.find((s: { id: string }) => s.id === r1.exercise.skillId).state;
    expect(st.independentStreak).toBe(0);

    clock = new Date(clock.getTime() + 60_000);
    const r2 = await start(app);
    expect(r2.id).not.toBe(r1.id);
    const w2 = String(Number(expectedOf(r2.id)) + 100);
    await answer(app, r2.id, w2);
    const second = (await answer(app, r2.id, w2)).json();
    expect(second.feedback.showCounting).toBe(true);
    const third = (await answer(app, r2.id, w2)).json();
    expect(third.state).toBe('done');
    expect(third.round.outcome).toMatchObject({ result: 'incorrect', stars: 0 }); // no star just for taking part
    expect(third.round.outcome.correctAnswerDisplay).toBe(expectedOf(r2.id));

    const games = (await app.inject({ method: 'GET', url: '/api/games', headers: H })).json();
    expect(games[0]).toMatchObject({ id: 'game.apple-crates', roundsPlayed: 2, level: 1, flowers: 0 });
    expect(games[0].stars).toBeUndefined(); // the card shows skill, not a total that grows just from playing
    const hist = (await app.inject({ method: 'GET', url: '/api/history', headers: H })).json();
    expect(hist.every((h: { inputMode: string }) => h.inputMode === 'screen')).toBe(true);
    // on-screen rounds do not appear in the parents' review queue
    expect((await app.inject({ method: 'GET', url: '/api/assignments/pending', headers: H })).json()).toHaveLength(0);
  });

  it('the engine alternates the game\'s two skills and levels up with right answers', async () => {
    const app = await makeApp();
    const seen = new Set<string>();
    let maxLevel = 1;
    for (let i = 0; i < 10; i++) {
      const r = await start(app);
      seen.add(r.exercise.skillId);
      maxLevel = Math.max(maxLevel, r.exercise.difficulty);
      const g = r.exercise.game;
      expect(g.loose).toBeGreaterThanOrEqual(11);
      expect(g.loose).toBeLessThanOrEqual(30);
      expect(g.packed * 10 + g.loose).toBeLessThan(100);
      await answer(app, r.id, expectedOf(r.id));
      clock = new Date(clock.getTime() + 2 * 86400_000);
    }
    expect([...seen].sort()).toEqual(['math.grouping-tens', 'math.place-value']);
    expect(maxLevel).toBeGreaterThanOrEqual(2);
  });

  it('hint alarm: help in more than 30 % of the last 10 answers → the round comes one level lower', async () => {
    const app = await makeApp();
    // she is at level 3 of Additions (no parent choice: the engine decides)
    const st = { ...JSON.parse(JSON.stringify(initialStateFor('math.add-sub'))), level: 3, evidenceCount: 10, estimate: 0.6 };
    ctx.db.prepare('INSERT INTO mastery (profile_id, skill_id, state_json, updated_at) VALUES (?, ?, ?, ?)').run('local-profile', 'math.add-sub', JSON.stringify(st), clock.toISOString());
    const play = async (withHelp: boolean) => {
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
      const right = expectedOf(r.id);
      if (withHelp) await answer(app, r.id, r.exercise.game.options.find((o: string) => o !== right));
      await answer(app, r.id, right);
      clock = new Date(clock.getTime() + 60_000);
      return r;
    };
    // 3 out of 5 with help (60 %): alarm
    for (const help of [true, false, true, false, true]) await play(help);
    const next = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
    expect(next.exercise.difficulty).toBe(2);
    expect(next.selectionReason).toMatch(/Beaucoup d’aide récemment \(indice dans 60 %/);
    // she gets it right without help again: with 1 out of 10 (10 %), the alarm goes away
    await answer(app, next.id, expectedOf(next.id));
    clock = new Date(clock.getTime() + 60_000);
    for (let k = 0; k < 6; k++) await play(false);
    const later = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
    expect(later.selectionReason).not.toMatch(/Beaucoup d’aide/);
  });

  it('Le train des nombres: when she gets everything right, the rounds climb the same day (not stuck at official + 1)', async () => {
    const app = await makeApp();
    clock = new Date(2026, 10, 18, 19, 0);
    const levels: number[] = [];
    for (let k = 0; k < 21; k++) {
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.number-train' } })).json();
      levels.push(r.exercise.difficulty);
      expect((await answer(app, r.id, expectedOf(r.id).replace(/\s+/g, ''))).json().round.outcome.result).toBe('correct');
      clock = new Date(clock.getTime() + 20_000);
    }
    expect(Math.max(...levels), levels.join(' ')).toBeGreaterThanOrEqual(5);
    // never more than one step at a time
    for (let i = 1; i < levels.length; i++) expect((levels[i] as number) - (levels[i - 1] as number)).toBeLessThanOrEqual(1);
    const st = JSON.parse((ctx.db.prepare("SELECT state_json FROM mastery WHERE skill_id = 'math.sequences'").get() as { state_json: string }).state_json);
    expect(st.level).toBe(1); // the official level is confirmed another day…
    expect(st.pendingAdvance.level).toBeGreaterThanOrEqual(4); // …at the level she proved, not only level 2
    // «Un défi plus difficile?» goes above today's level
    const today = Math.max(...levels.slice(-3));
    const c = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.number-train', challenge: true } })).json();
    expect(c.exercise.difficulty).toBeGreaterThanOrEqual(Math.min(6, today));
    await app.inject({ method: 'POST', url: `/api/assignments/${c.id}/cancel`, headers: H });
    // next day: she starts at what she proved, and a success there confirms it
    clock = new Date(2026, 10, 19, 16, 0);
    const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.number-train' } })).json();
    expect(r.exercise.difficulty).toBeGreaterThanOrEqual(st.pendingAdvance.level);
    await answer(app, r.id, expectedOf(r.id).replace(/\s+/g, ''));
    const after = JSON.parse((ctx.db.prepare("SELECT state_json FROM mastery WHERE skill_id = 'math.sequences'").get() as { state_json: string }).state_json);
    expect(after.level).toBeGreaterThanOrEqual(st.pendingAdvance.level);
  });

  it('Le train des nombres: errors bring the session level back down', async () => {
    const app = await makeApp();
    clock = new Date(2026, 10, 18, 19, 0);
    const levels: number[] = [];
    const play = async (right: boolean) => {
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.number-train' } })).json();
      levels.push(r.exercise.difficulty);
      const ok = expectedOf(r.id).replace(/\s+/g, '');
      await answer(app, r.id, right ? ok : String(Number(ok) + 1));
      if (!right) await answer(app, r.id, ok); // then finds it (no longer first try)
      clock = new Date(clock.getTime() + 20_000);
    };
    for (let k = 0; k < 12; k++) await play(true);
    const top = levels.at(-1) as number;
    expect(top).toBeGreaterThanOrEqual(3);
    await play(false);
    await play(false);
    await play(true);
    expect(levels.at(-1) as number).toBeLessThan(top);
  });

  it('number games at level 6 («Défi», thousands): the right 4-digit answer is accepted', async () => {
    const app = await makeApp();
    for (const [gameId, skillId] of [['game.number-path', 'math.counting'], ['game.number-train', 'math.sequences'], ['game.apple-crates', 'math.place-value'], ['game.frog-jump', 'math.add-sub']] as const) {
      for (let k = 0; k < 6; k++) {
        await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId, difficulty: 6 } } });
        const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId } })).json();
        const right = expectedOf(r.id).replace(/\s+/g, '');
        const res = await answer(app, r.id, right);
        expect(res.statusCode, `${gameId} level 6: «${right}»`).toBe(200);
        expect(res.json().round.outcome.result, `${gameId} level 6: «${right}»`).toBe('correct');
        clock = new Date(clock.getTime() + 60_000);
      }
    }
  });

  it('Le chemin des nombres: sequence answer, correct stones shown on a mistake, evaluation on the server', async () => {
    const app = await makeApp();
    const startPath = async () => (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.number-path' } })).json();
    const r = await startPath();
    expect(r.exercise.game).toMatchObject({ game: 'number-path', layout: 'line' }); // first contact: level 1
    expect(r.exercise.skillId).toBe('math.counting');
    expect(JSON.stringify(r)).not.toContain('"expected"');
    const right: string[] = expectedOf(r.id).split(', ');
    const holes = r.exercise.game.cells.filter((c: { value: number | null }) => c.value === null).length;
    expect(right).toHaveLength(holes);
    // format: exactly one number per empty stone
    expect((await answer(app, r.id, right.slice(1).join(','))).statusCode).toBe(400);
    expect((await answer(app, r.id, `${right.join(',')},5`)).statusCode).toBe(400);
    expect((await answer(app, r.id, right.join(';'))).statusCode).toBe(400);
    // 1st mistake: only the second stone wrong → the server says which ones are right, without revealing the value
    const wrong = right.map((v, i) => (i === 1 ? String(Number(v) + 1) : v));
    const t1 = (await answer(app, r.id, wrong.join(','))).json();
    expect(t1.state).toBe('retry');
    expect(t1.feedback.slots).toEqual(right.map((_, i) => i !== 1));
    expect(JSON.stringify(t1)).not.toContain(`"${right[1]}"`);
    expect(ctx.db.prepare('SELECT COUNT(*) n FROM attempts').get()).toEqual({ n: 0 });
    // a right answer with spaces also counts
    const t2 = (await answer(app, r.id, right.join(', '))).json();
    expect(t2.round.outcome).toMatchObject({ result: 'correct', help: 'hint', stars: 2 });
    expect(t2.round.outcome.correctAnswerDisplay).toBe(right.join(', '));
    const games = (await app.inject({ method: 'GET', url: '/api/games', headers: H })).json();
    expect(games.find((g: { id: string }) => g.id === 'game.number-path')).toMatchObject({ roundsPlayed: 1, level: 1, flowers: 0 });
    // the new skill entered the database catalog without a migration
    expect(ctx.db.prepare("SELECT id FROM skills WHERE id = 'math.counting'").get()).toEqual({ id: 'math.counting' });
  });

  it('Les mots cachés: only the spelling test is evaluated; the answer must fit the pattern and the keyboard', async () => {
    const app = await makeApp();
    const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.hidden-words' } })).json();
    const g = r.exercise.game;
    expect(g.game).toBe('hidden-words');
    expect(r.exercise.skillId).toBe('fr.spelling');
    expect(JSON.stringify(r)).not.toContain('"expected"');
    const target: string = expectedOf(r.id);
    const ls = [...target];
    const holes = g.final.pattern.map((p: string | null, i: number) => (p === null ? i : -1)).filter((i: number) => i >= 0);
    const notInBank = [...'abcdefghijklmnopqrstuvwxyzéèàç'].find((ch) => !g.final.letters.includes(ch)) as string;
    const swap = (i: number, ch: string) => ls.map((x, k) => (k === i ? ch : x)).join('');
    // outside the pattern: different length, visible letter changed, letter not on the keyboard, number
    expect((await answer(app, r.id, `${target}s`)).statusCode).toBe(400);
    const visible = g.final.pattern.findIndex((p: string | null) => p !== null);
    expect((await answer(app, r.id, swap(visible, ls[visible] === 'a' ? 'o' : 'a'))).statusCode).toBe(400);
    expect((await answer(app, r.id, swap(holes[0], notInBank))).statusCode).toBe(400);
    expect((await answer(app, r.id, '123')).statusCode).toBe(400);
    expect(ctx.db.prepare('SELECT tries FROM assignments WHERE id = ?').get(r.id)).toEqual({ tries: 0 });
    // mistake inside the pattern: another keyboard letter in a gap
    const other = g.final.letters.find((ch: string) => ch !== ls[holes[0]]) as string;
    const t1 = (await answer(app, r.id, swap(holes[0], other))).json();
    expect(t1.state).toBe('retry');
    const t2 = (await answer(app, r.id, target.normalize('NFD'))).json(); // decomposed accents also count
    expect(t2.round.outcome).toMatchObject({ result: 'correct', help: 'hint', stars: 2 });
    const attempt = ctx.db.prepare("SELECT skill_id, confirmed_answer FROM attempts WHERE input_mode = 'screen'").get() as { skill_id: string; confirmed_answer: string };
    expect(attempt).toEqual({ skill_id: 'fr.spelling', confirmed_answer: target });
  });

  it('a level confirmed on the next day plants a flower in the garden; the child can ask for a harder défi', async () => {
    const app = await makeApp();
    const playRight = async () => {
      await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.representations', difficulty: 1 } } });
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.dominoes' } })).json();
      const res = (await answer(app, r.id, expectedOf(r.id))).json();
      clock = new Date(clock.getTime() + 60_000);
      return res;
    };
    clock = new Date(2026, 10, 17, 16, 0);
    for (let k = 0; k < 3; k++) await playRight();
    const flowers = () => ctx.db.prepare("SELECT reward_key FROM rewards WHERE reward_key LIKE 'flower.%'").all();
    expect(flowers()).toEqual([]); // ready, but only confirmed on another day
    clock = new Date(2026, 10, 18, 16, 0);
    const res = await playRight();
    expect(res.round.outcome.masteryChange).toMatchObject({ levelBefore: 1, levelAfter: 2 });
    expect(res.round.outcome.praise).toBeTruthy();
    expect(flowers()).toEqual([{ reward_key: 'flower.math.representations.2' }]);
    // autonomy: «un défi plus difficile» opens the round one level above the official one
    const official = (ctx.db.prepare("SELECT state_json FROM mastery WHERE skill_id = 'math.representations'").get() as { state_json: string }).state_json;
    const lvl = JSON.parse(official).level;
    const c = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.dominoes', challenge: true } })).json();
    const row = ctx.db.prepare('SELECT difficulty, selection_reason_code FROM assignments WHERE id = ?').get(c.id);
    expect(row).toEqual({ difficulty: lvl + 1, selection_reason_code: 'child-choice' });
  });

  it('weekly and monthly report: compares with the previous period and points out strong, weak, improving and declining', async () => {
    const app = await makeApp();
    const play = async (n: number, right: boolean) => {
      for (let k = 0; k < n; k++) {
        // fixed level (parent choice): this test measures the report, not the model's choices
        await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.add-sub', difficulty: 1 } } });
        const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
        const ok = expectedOf(r.id);
        if (right) await answer(app, r.id, ok);
        else for (const w of r.exercise.game.options.filter((o: string) => o !== ok).slice(0, 3)) await answer(app, r.id, w);
        clock = new Date(clock.getTime() + 2 * 60_000);
      }
    };
    clock = new Date(2026, 10, 10, 16, 0); // Tuesday, previous week
    await play(12, true);
    clock = new Date(2026, 10, 17, 16, 0); // Tuesday, current week
    await play(12, false);
    const r = (await app.inject({ method: 'GET', url: '/api/report?kind=week&offset=0', headers: H })).json();
    expect(r.period.label).toBe('Semaine du 16 novembre 2026 au 22 novembre 2026');
    expect(r.days).toHaveLength(7);
    expect(r.totals).toMatchObject({ answers: 12, firstTryRate: 0, activeDays: 1 });
    expect(r.prevTotals).toMatchObject({ answers: 12, firstTryRate: 100 });
    expect(r.totals.minutes).toBeGreaterThanOrEqual(10);
    // same level (1) in both weeks and the estimated ability dropped: then it really is «À retravailler»
    expect(r.skills[0]).toMatchObject({ skillId: 'math.add-sub', answers: 12, firstTryRate: 0, prevRate: 100, trend: 'baisse' });
    expect(r.skills[0].reviews).toEqual({ n: 1, ok: 0 }); // 1st answer of the day, on another day, at the level she had
    // 12 rounds wrong 3 times: the 3 tries show the astuce → «with help» in all of them
    expect(r.skills[0].helpRate).toBe(100);
    // weak points come from the SAME model as the Tableau de bord
    const learned = (await app.inject({ method: 'GET', url: '/api/progress', headers: H })).json().learned.find((x: { skillId: string }) => x.skillId === 'math.add-sub');
    expect(r.tags.weak.map((t: { tag: string }) => t.tag).sort()).toEqual(learned.weak.map((t: { tag: string }) => t.tag).sort());
    expect(r.tags.weak.length).toBeGreaterThan(0);
    // what declined and is already a weak point appears only in «On s’entraîne» (one board per tag)
    for (const t of r.tags.declining) {
      expect(t.rate).toBe(0);
      expect([null, 100]).toContain(t.prevRate);
    }
    expect(r.tags.toWatch).toBeUndefined(); // the «50–60 % à surveiller» band was removed
    // each tag appears on a single board
    const boards = ['strong', 'weak', 'improving', 'declining', 'almost'].flatMap((k) => r.tags[k].map((t: { tag: string }) => t.tag));
    expect(new Set(boards).size).toBe(boards.length);
    expect(r.recommendations.join(' ')).toMatch(/À renforcer/);
    // little data (12 answers in the week): the report warns that these are only hints
    expect(r.lowData).toBe(true);
    // à la maison: activity for the skill to strengthen, a question to talk about; goal only in the month
    expect(r.home).toMatchObject({ skill: 'Additions et soustractions' });
    expect(r.home.text.length).toBeGreaterThan(20);
    expect(r.talk).toMatch(/\?$/);
    expect(r.goal).toBeNull();
    // previous week: everything right first time → strong points
    const prev = (await app.inject({ method: 'GET', url: '/api/report?kind=week&offset=-1', headers: H })).json();
    expect(prev.tags.strong.length).toBeGreaterThan(0);
    // month: the whole of November
    const m = (await app.inject({ method: 'GET', url: '/api/report?kind=month&offset=0', headers: H })).json();
    expect(m.period.label).toBe('Mois de novembre 2026');
    expect(m.days).toHaveLength(30);
    expect(m.totals.answers).toBe(24);
    expect(m.goal).toMatch(/petit objectif/);
  });

  it('report: levelling up with a lower % does NOT show up as a decline', async () => {
    const app = await makeApp();
    const play = async (n: number, difficulty: number, rightEvery: number) => {
      for (let k = 0; k < n; k++) {
        await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.add-sub', difficulty } } });
        const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
        const ok = expectedOf(r.id);
        if (k % rightEvery === 0) await answer(app, r.id, ok);
        else for (const w of r.exercise.game.options.filter((o: string) => o !== ok).slice(0, 3)) await answer(app, r.id, w);
        clock = new Date(clock.getTime() + 2 * 60_000);
      }
    };
    clock = new Date(2026, 10, 10, 16, 0);
    await play(12, 1, 1); // previous week: level 1, everything right
    clock = new Date(2026, 10, 17, 16, 0);
    await play(12, 4, 2); // current week: level 4, half right (the raw % drops from 100 to 50)
    const r = (await app.inject({ method: 'GET', url: '/api/report?kind=week&offset=0', headers: H })).json();
    expect(r.skills[0].firstTryRate).toBe(50);
    expect(r.skills[0].trend).not.toBe('baisse');
    expect(r.tags.declining).toEqual([]);
    expect(r.recommendations.join(' ')).not.toMatch(/À revoir|Petit coup de pouce/);
  });

  it('the model learns from the rounds: a weak point appears on the dashboard and the next round reinforces it', async () => {
    const app = await makeApp();
    // Saute-grenouille: the child gets every carrying addition round wrong 3 times and the others right
    // (the draw decides how many additions with retenue appear: play until there are at least 5)
    let played = 0;
    let hardSeen = 0;
    while ((hardSeen < 5 || played < 14) && played < 60) {
      // training phase at level 3 (jumps from 11 to 28: many additions with retenue)
      await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.add-sub', difficulty: 3 } } });
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
      const g = r.exercise.game;
      const right = expectedOf(r.id);
      const hard = g.op === '+' && (g.start % 10) + (g.jump % 10) >= 10;
      if (hard) {
        hardSeen++;
        for (const w of g.options.filter((o: string) => o !== right).slice(0, 3)) await answer(app, r.id, w);
      } else await answer(app, r.id, right);
      played++;
      clock = new Date(clock.getTime() + 60_000);
    }
    expect(hardSeen).toBeGreaterThanOrEqual(5);
    const p = (await app.inject({ method: 'GET', url: '/api/progress', headers: H })).json();
    const l = p.learned.find((x: { skillId: string }) => x.skillId === 'math.add-sub');
    expect(l.answers).toBe(played);
    expect(l.weak.map((x: { tag: string }) => x.tag), JSON.stringify({ l, played, hardSeen })).toContain('retenue');
    expect(l.weak.find((x: { tag: string }) => x.tag === 'retenue').label).toContain('retenue');
    // the next rounds: when reinforcing, the chosen round has retenue
    let targeted = 0;
    const dbg: unknown[] = [];
    // (half of the rounds may be an «avant-goût» of the next level, awaiting confirmation on another day)
    for (let k = 0; k < 10; k++) {
      const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
      const row = ctx.db.prepare('SELECT selection_reason_code, selection_reason, snapshot_json FROM assignments WHERE id = ?').get(r.id) as { selection_reason_code: string; selection_reason: string; snapshot_json: string };
      dbg.push([row.selection_reason_code, row.selection_reason.slice(0, 90), JSON.parse(row.snapshot_json).difficulty]);
      if (row.selection_reason_code === 'learner-reinforce') {
        expect(row.selection_reason).toContain('Renforcement ciblé');
        const g = JSON.parse(row.snapshot_json).game;
        if (g.op === '+' && (g.start % 10) + (g.jump % 10) >= 10) targeted++;
      }
      await answer(app, r.id, expectedOf(r.id));
      clock = new Date(clock.getTime() + 60_000);
    }
    expect(targeted, JSON.stringify(dbg)).toBeGreaterThanOrEqual(2);
  });

  it('weak point overcome: celebration (conquered), flower in the garden and praise using the round\'s data', async () => {
    const app = await makeApp();
    const isHard = (g: { op: string; start: number; jump: number }) => g.op === '+' && (g.start % 10) + (g.jump % 10) >= 10;
    const round = async () => {
      await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.add-sub', difficulty: 3 } } });
      return (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.frog-jump' } })).json();
    };
    // 1) retenue becomes a weak point (3 mistakes on each carrying addition)
    let hardSeen = 0;
    for (let k = 0; k < 60 && hardSeen < 5; k++) {
      const r = await round();
      const right = expectedOf(r.id);
      if (isHard(r.exercise.game)) {
        hardSeen++;
        for (const w of r.exercise.game.options.filter((o: string) => o !== right).slice(0, 3)) await answer(app, r.id, w);
      } else await answer(app, r.id, right);
      clock = new Date(clock.getTime() + 60_000);
    }
    const weak = (await app.inject({ method: 'GET', url: '/api/progress', headers: H })).json().learned.find((x: { skillId: string }) => x.skillId === 'math.add-sub').weak;
    expect(weak.map((x: { tag: string }) => x.tag)).toContain('retenue');
    // 2) on the SAME day she gets everything right first time: the weight drops, but the win does not count yet («presque!»)
    const tagFlowers = () => (ctx.db.prepare("SELECT reward_key FROM rewards WHERE reward_key LIKE 'flower.tag.%' ORDER BY rowid").all() as Array<{ reward_key: string }>).map((x) => x.reward_key);
    let praise = '';
    let almost: { tag: string } | null = null;
    const seen: string[] = [];
    const tagsOfLast = (id: string) => (JSON.parse((ctx.db.prepare('SELECT snapshot_json FROM assignments WHERE id = ?').get(id) as { snapshot_json: string }).snapshot_json).questionKey as string);
    // ~17 right answers with retenue until «presque» (only the answer's own tags shrink); ~1 round in 3 has retenue
    for (let k = 0; k < 160 && !almost; k++) {
      const r = await round();
      const res = (await answer(app, r.id, expectedOf(r.id))).json();
      expect(res.round.outcome.conquered).toBeNull(); // no big celebration on the same day
      if (isHard(r.exercise.game)) {
        praise = res.round.outcome.praise;
        // the answer shows ONE almost-overcome tag (the most specific); retenue is among them
        if (res.round.outcome.almost && almostTags(learnerProfile(ctx)['math.add-sub']).includes('retenue')) almost = { tag: 'retenue' };
        seen.push(`${tagsOfLast(r.id)}→${res.round.outcome.almost?.tag ?? '-'}`);
      }
      clock = new Date(clock.getTime() + 60_000);
    }
    expect(almost, `on the same day, retenue becomes «presque gagné»: ${JSON.stringify(learnerProfile(ctx)['math.add-sub']?.tags.retenue)} ${seen.slice(-6).join(' ')}`).toMatchObject({ tag: 'retenue' });
    expect(tagFlowers()).toEqual([]);
    // 3) on the next day, the first right-first-time answer with retenue confirms it: celebration and flower
    clock = new Date(clock.getTime() + 86400_000);
    const won: string[] = [];
    const expected = new Set<string>(); // what the MODEL says was overcome in each answer
    for (let k = 0; k < 30 && !won.includes('retenue'); k++) {
      const r = await round();
      const pBefore = learnerProfile(ctx)['math.add-sub'];
      const res = (await answer(app, r.id, expectedOf(r.id))).json();
      for (const t of conqueredTags(pBefore, learnerProfile(ctx)['math.add-sub'])) expected.add(t);
      const cq = res.round.outcome.conquered as { tag: string; label: string } | null;
      if (cq) {
        won.push(cq.tag);
        expect(cq.label.length).toBeGreaterThan(3);
        expect(res.round.outcome.almost).toBeNull();
      }
      clock = new Date(clock.getTime() + 60_000);
    }
    expect(won).toContain('retenue');
    expect(new Set(won).size).toBe(won.length); // each tag celebrated only once
    // specific praise: says what she did in this round
    expect(praise).toBe('Tu as bien fait la retenue.');
    // one flower for EACH overcome tag (before, the 2nd tag overcome in the same answer got no flower)
    expect(tagFlowers().sort()).toEqual([...expected].map((t) => `flower.tag.math.add-sub.${t}`).sort());
    for (const t of won) expect(expected.has(t)).toBe(true);
    // the retenue celebration is not repeated
    for (let k = 0; k < 30; k++) {
      const r = await round();
      const res = (await answer(app, r.id, expectedOf(r.id))).json();
      expect(res.round.outcome.conquered?.tag).not.toBe('retenue');
      clock = new Date(clock.getTime() + 60_000);
      if (isHard(r.exercise.game)) break;
    }
  });

  it('Les mots cachés: the school list week chosen by the parents applies to the next round', async () => {
    const app = await makeApp();
    const s0 = (await app.inject({ method: 'GET', url: '/api/settings', headers: H })).json();
    expect(s0['french.schoolWeek']).toBeNull();
    expect(s0.schoolWeeks).toHaveLength(31);
    expect(s0.schoolWeeks[2]).toMatchObject({ key: '1.3', label: 'Thème 1 · semaine 3' });
    expect((await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'french.schoolWeek': '9.9' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'french.schoolWeek': 3 } })).statusCode).toBe(400);
    const s1 = (await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'french.schoolWeek': '1.1' } })).json();
    expect(s1['french.schoolWeek']).toBe('1.1');
    // theme 1, week 1: only ici, mais, non, oui, par, sur fit in the grid
    const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.hidden-words' } })).json();
    for (const w of r.exercise.game.words) expect(['ici', 'mais', 'non', 'oui', 'par', 'sur']).toContain(w.word);
    expect(['ici', 'mais', 'non', 'oui', 'par', 'sur']).toContain(expectedOf(r.id));
    const s2 = (await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'french.schoolWeek': null } })).json();
    expect(s2['french.schoolWeek']).toBeNull();
  });

  it('Les dominos des nombres: choice evaluated on the server, typical mistake with its own message', async () => {
    const app = await makeApp();
    await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.representations', difficulty: 3 } } });
    const r = (await app.inject({ method: 'POST', url: '/api/game-rounds', headers: H, payload: { gameId: 'game.dominoes' } })).json();
    expect(r.exercise.game.game).toBe('dominoes');
    expect(r.exercise.game.pieces).toHaveLength(4);
    expect(JSON.stringify(r)).not.toContain('"expected"');
    const right = expectedOf(r.id);
    expect((await answer(app, r.id, '100')).statusCode).toBe(400); // only one of the shown pieces is valid (level 3 goes up to 99)
    expect(ctx.db.prepare('SELECT tries FROM assignments WHERE id = ?').get(r.id)).toEqual({ tries: 0 });
    const snap = JSON.parse((ctx.db.prepare('SELECT snapshot_json FROM assignments WHERE id = ?').get(r.id) as { snapshot_json: string }).snapshot_json);
    const typed = snap.commonErrors[0] as { match: string; message: string };
    const t1 = (await answer(app, r.id, typed.match)).json();
    expect(t1.state).toBe('retry');
    expect(t1.feedback.message).toBe(typed.message);
    const t2 = (await answer(app, r.id, right)).json();
    expect(t2.round.outcome).toMatchObject({ result: 'correct', stars: 2 });
    const attempt = ctx.db.prepare("SELECT skill_id, confirmed_answer FROM attempts WHERE input_mode = 'screen'").get() as { skill_id: string; confirmed_answer: string };
    expect(attempt.skill_id).toBe('math.representations');
  });

  it('skill math.representations also has a paper exercise', async () => {
    const app = await makeApp();
    await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.representations', difficulty: 3 } } });
    const practice = (await app.inject({ method: 'POST', url: '/api/sessions', headers: H, payload: { mode: 'practice', subject: 'mathematics' } })).json();
    const a = (await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: practice.id } })).json();
    expect(a.exercise.skillId).toBe('math.representations');
    expect(a.exercise.visual).toMatchObject({ kind: 'tens-units' });
  });

  it('skill math.counting also has a paper exercise', async () => {
    const app = await makeApp();
    await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'parent.nextChoice': { skillId: 'math.counting', difficulty: 2 } } });
    const practice = (await app.inject({ method: 'POST', url: '/api/sessions', headers: H, payload: { mode: 'practice', subject: 'mathematics' } })).json();
    const res = await app.inject({ method: 'POST', url: '/api/assignments', headers: H, payload: { sessionId: practice.id } });
    expect(res.statusCode).toBe(200);
    const a = res.json();
    expect(a.exercise.skillId).toBe('math.counting');
    expect(a.exercise.statement).toMatch(/^Complète : .*___/);
  });
});

describe('migration of an existing database (version 1 → 2)', () => {
  it('keeps the data and adds the new columns', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const file = join(dir, 'melina.db');
    const app1 = await makeApp();
    const { assignment } = await startMissionAssignment(app1);
    await app1.close();
    // simulates a database that stopped at version 1
    ctx.db.exec('ALTER TABLE assignments DROP COLUMN input_mode; ALTER TABLE assignments DROP COLUMN tries; ALTER TABLE attempts DROP COLUMN input_mode; DELETE FROM schema_migrations WHERE version = 2;');
    ctx.db.close();
    const app2 = await makeApp();
    const cols = (ctx.db.prepare("SELECT name FROM pragma_table_info('assignments')").all() as Array<{ name: string }>).map((r) => r.name);
    expect(cols).toContain('input_mode');
    const row = ctx.db.prepare('SELECT id, input_mode FROM assignments').get() as { id: string; input_mode: string };
    expect(row).toEqual({ id: assignment.id, input_mode: 'paper' });
    void DatabaseSync;
    void file;
    await app2.close();
  });
});
