import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { decodePng, encodePng, mockProvider, type ImageProvider } from '@melina/art';
import { buildApp } from './app';
import { waitForArtJobs } from './art';
import { loadConfig } from './config';
import { openDatabase } from './db';
import { bootstrap, type Ctx } from './service';

process.env.MELINA_SKIP_ENV_FILE = '1';
const H = { 'x-melina-client': '1', host: '127.0.0.1:3001' };
let dir: string;
let ctx: Ctx;
let clock: Date;

async function makeApp(opts: { provider?: ImageProvider | null; apiKey?: string; fetchImpl?: typeof fetch } = {}) {
  const cfg = loadConfig({ dataDir: dir, apiKey: opts.apiKey ?? '', staticDir: null, port: 3001, imageProvider: '', packsDir: join(dir, 'packs') });
  ctx = { db: openDatabase(join(dir, 'melina.db')), cfg, now: () => clock, fetchImpl: opts.fetchImpl, imageProvider: opts.provider === null ? undefined : (opts.provider ?? mockProvider()) };
  bootstrap(ctx);
  return buildApp(ctx);
}
type App = Awaited<ReturnType<typeof makeApp>>;
const post = (app: App, url: string, payload: unknown = {}) => app.inject({ method: 'POST', url, headers: H, payload: payload as object });
const get = (app: App, url: string) => app.inject({ method: 'GET', url, headers: { host: H.host } });
const enable = (app: App) => app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'art.enabled': true, 'art.consent': true } });
const studioSpec = async (app: App, id: string) => (await get(app, '/api/art/studio')).json().specs.find((s: { id: string }) => s.id === id);
async function generate(app: App, id: string, n = 3) {
  const r = await post(app, `/api/art/specs/${id}/generate`, { n });
  await waitForArtJobs();
  return r;
}
function upload(file: Buffer, fields: Record<string, unknown> = {}, mime = 'image/png') {
  const b = '----melinaArt';
  const parts: Buffer[] = Object.entries(fields).map(([k, v]) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${JSON.stringify(v)}\r\n`));
  parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="image"; filename="../../x.png"\r\nContent-Type: ${mime}\r\n\r\n`), file, Buffer.from(`\r\n--${b}--\r\n`));
  return { payload: Buffer.concat(parts), headers: { ...H, 'content-type': `multipart/form-data; boundary=${b}` } };
}
const tinyPng = () => Buffer.from(encodePng(64, 36, new Uint8Array(64 * 36 * 4).fill(180)));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'melina-art-'));
  clock = new Date('2026-11-17T15:00:00Z');
});
afterEach(async () => {
  await waitForArtJobs();
  ctx?.db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('art production line', () => {
  it('with nothing approved the catalog is empty: the game uses the built-in art', async () => {
    const app = await makeApp();
    expect((await get(app, '/api/art/catalog')).json()).toEqual({ items: {} });
    const studio = (await get(app, '/api/art/studio')).json();
    expect(studio.enabled).toBe(false);
    expect(studio.specs.length).toBeGreaterThanOrEqual(9);
    expect(studio.specs[0].defaultPrompt.length).toBeGreaterThan(50);
  });

  it('generation requires activation with consent and a configured provider, and respects the limits', async () => {
    let app = await makeApp();
    expect((await post(app, '/api/art/specs/orchard.crate/generate')).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'art.enabled': true } })).statusCode).toBe(400);
    expect((await enable(app)).statusCode).toBe(200);
    expect((await post(app, '/api/art/specs/does.not.exist/generate')).statusCode).toBe(404);
    await app.inject({ method: 'PATCH', url: '/api/settings', headers: H, payload: { 'art.dailyLimit': 4 } });
    expect((await generate(app, 'orchard.crate', 3)).statusCode).toBe(200);
    const r = await generate(app, 'fruit.pear', 3);
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe('daily-limit');
    ctx.db.close();
    app = await makeApp({ provider: null }); // no IMAGE_PROVIDER in .env
    expect((await post(app, '/api/art/specs/orchard.crate/generate')).json().error.code).toBe('no-provider');
  });

  it('generates candidates, checks them technically, and only parent approval changes the catalog', async () => {
    const app = await makeApp();
    await enable(app);
    await generate(app, 'orchard.crate', 3);
    let spec = await studioSpec(app, 'orchard.crate');
    expect(spec.job.status).toBe('done');
    expect(spec.candidates).toHaveLength(3);
    expect(spec.candidates.map((c: { techOk: boolean }) => c.techOk).sort()).toEqual([false, true, true]);
    expect((await get(app, '/api/art/catalog')).json().items).toEqual({}); // nothing approved yet
    const img = await get(app, spec.candidates[0].url);
    expect(img.statusCode).toBe(200);
    expect(decodePng(img.rawPayload)?.width).toBe(1536);

    const good = spec.candidates.find((c: { techOk: boolean }) => c.techOk);
    const bad = spec.candidates.find((c: { techOk: boolean }) => !c.techOk);
    expect((await post(app, `/api/art/candidates/${bad.id}/reject`, { reason: 'opaque background' })).statusCode).toBe(200);
    const approved = await app.inject({ method: 'POST', url: `/api/art/candidates/${good.id}/approve`, ...upload(tinyPng(), { meta: { inset: [0.1, 0.1, 0.1, 0.1] } }) });
    expect(approved.statusCode).toBe(200);
    expect((await post(app, `/api/art/candidates/${good.id}/approve`)).statusCode).toBe(409); // double click
    const item = (await get(app, '/api/art/catalog')).json().items['orchard.crate'];
    expect(item.source).toBe('generated');
    expect(item.grid.inset).toEqual([0.1, 0.1, 0.1, 0.1]);
    const file = await get(app, item.url);
    expect(file.statusCode).toBe(200);
    expect(file.headers['cache-control']).toContain('immutable');
    expect(decodePng(file.rawPayload)?.width).toBe(64); // the processed version sent by the browser is what counts

    spec = await studioSpec(app, 'orchard.crate');
    expect(spec.candidates).toHaveLength(1);
    expect(spec.active.version).toBe(1);
    expect(spec.active.credit).toMatch(/^Générée par .*simul/); // «simulated» or «simulé», depending on packages/art

    // second version, back to the previous one, then back to the built-in art
    await post(app, `/api/art/candidates/${spec.candidates[0].id}/approve`);
    spec = await studioSpec(app, 'orchard.crate');
    expect(spec.versions.map((v: { version: number; active: boolean }) => [v.version, v.active])).toEqual([[2, true], [1, false]]);
    await post(app, '/api/art/specs/orchard.crate/activate', { assetId: spec.versions[1].id });
    expect((await studioSpec(app, 'orchard.crate')).active.version).toBe(1);
    await post(app, '/api/art/specs/orchard.crate/activate', { assetId: null });
    expect((await get(app, '/api/art/catalog')).json().items).toEqual({});
  });

  it('rejects uploads that are not images, invalid margins and forged file names', async () => {
    const app = await makeApp();
    await enable(app);
    await generate(app, 'orchard.crate', 1);
    const c = (await studioSpec(app, 'orchard.crate')).candidates[0];
    expect((await app.inject({ method: 'POST', url: `/api/art/candidates/${c.id}/approve`, ...upload(Buffer.from('<script>alert(1)</script>'.repeat(4))) })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: `/api/art/candidates/${c.id}/approve`, ...upload(tinyPng(), { meta: { inset: [0.9, 0, 0, 0] } }) })).statusCode).toBe(400);
    expect((await studioSpec(app, 'orchard.crate')).candidates).toHaveLength(1); // still pending
    for (const f of ['..%2F..%2Fmelina.db', 'x.png', '%2e%2e%2fcandidates%2f' + c.id + '.png']) expect((await get(app, `/art-files/${f}`)).statusCode).toBe(404);
    expect(readdirSync(join(dir, 'art', 'approved'))).toEqual([]);
    expect((await app.inject({ method: 'POST', url: `/api/art/candidates/${c.id}/reject`, headers: { host: H.host }, payload: {} })).statusCode).toBe(403); // without the app header
  });

  it('a character pose is only generated after the master image is approved, which is sent as a reference', async () => {
    const seen: number[] = [];
    const base = mockProvider();
    const provider: ImageProvider = { ...base, generate: async (req) => (seen.push(req.references.length), base.generate(req)) };
    const app = await makeApp({ provider });
    await enable(app);
    const early = await generate(app, 'lila.happy', 1);
    expect(early.json().error.code).toBe('reference-missing');
    await generate(app, 'lila.idle', 1);
    await post(app, `/api/art/candidates/${(await studioSpec(app, 'lila.idle')).candidates[0].id}/approve`);
    expect((await generate(app, 'lila.happy', 1)).statusCode).toBe(200);
    expect(seen).toEqual([0, 1]);
  });

  it('a provider failure is recorded on the job and creates no candidates', async () => {
    const provider: ImageProvider = { id: 'x', model: 'm', label: 'x', generate: async () => Promise.reject(new Error('boom')) };
    const app = await makeApp({ provider });
    await enable(app);
    await generate(app, 'fruit.pear', 2);
    const spec = await studioSpec(app, 'fruit.pear');
    expect(spec.job.status).toBe('failed');
    expect(spec.candidates).toEqual([]);
    expect((await generate(app, 'fruit.pear', 1)).statusCode).toBe(200); // can try again
  });

  it('Claude review: verdict recorded on the candidate; a Claude failure does not break the generation', async () => {
    const review = { subject_matches: true, composition_ok: true, has_text_or_watermark: false, cropped_or_cut: false, child_appropriate: true, style_matches: false, verdict: 'reject', problems: ['style differs from the guide'] };
    let calls = 0;
    const fetchImpl = (async () => (++calls === 2 ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'report_art_review', input: review }] }), { status: 200 }))) as unknown as typeof fetch;
    const app = await makeApp({ apiKey: 'sk-test', fetchImpl });
    await enable(app);
    await generate(app, 'fruit.red_apple', 2);
    const spec = await studioSpec(app, 'fruit.red_apple');
    expect(spec.job.status).toBe('done');
    expect(spec.candidates.map((c: { reviewVerdict: string }) => c.reviewVerdict).sort()).toEqual(['error', 'reject']);
    expect(spec.candidates.find((c: { reviewVerdict: string }) => c.reviewVerdict === 'reject').review.problems).toEqual(['style differs from the guide']);
    // Claude's verdict decides nothing: the parents can still approve
    expect((await post(app, `/api/art/candidates/${spec.candidates[0].id}/approve`)).statusCode).toBe(200);
  });

  it('the prompt edited by the parents is what goes to the provider; clearing it goes back to the default', async () => {
    let prompt = '';
    const base = mockProvider();
    const app = await makeApp({ provider: { ...base, generate: async (req) => ((prompt = req.prompt), base.generate(req)) } });
    await enable(app);
    const custom = 'A yellow cartoon pear, transparent background, no text.';
    expect((await app.inject({ method: 'PATCH', url: '/api/art/specs/fruit.pear/prompt', headers: H, payload: { prompt: 'short' } })).statusCode).toBe(400);
    await app.inject({ method: 'PATCH', url: '/api/art/specs/fruit.pear/prompt', headers: H, payload: { prompt: custom } });
    await generate(app, 'fruit.pear', 1);
    expect(prompt).toBe(custom);
    const back = await app.inject({ method: 'PATCH', url: '/api/art/specs/fruit.pear/prompt', headers: H, payload: { prompt: null } });
    expect(back.json().promptSource).toBe('default');
  });

  it('ready-made packs: reads the folder, keeps the license and uses an image as a spec\'s art', async () => {
    const app = await makeApp();
    const pack = join(dir, 'packs', 'kenney_ui-pack');
    mkdirSync(join(pack, 'PNG'), { recursive: true });
    writeFileSync(join(pack, 'License.txt'), 'Creative Commons Zero, CC0\nhttps://kenney.nl');
    writeFileSync(join(pack, 'PNG', 'crate.png'), tinyPng());
    writeFileSync(join(pack, 'PNG', 'fake.png'), 'this is not an image, it only has the extension');
    writeFileSync(join(pack, 'notes.txt'), 'ignored');
    const scan = (await post(app, '/api/art/packs/scan')).json();
    expect(scan.added).toBe(1);
    expect(scan.packs[0].licenseNote).toContain('CC0');
    expect((await post(app, '/api/art/packs/scan')).json().added).toBe(0); // repeating does not duplicate
    const file = scan.packs[0].files[0];
    expect((await get(app, file.url)).statusCode).toBe(200);
    expect((await post(app, `/api/art/pack-files/${file.id}/use`, { specId: 'orchard.crate' })).statusCode).toBe(200);
    const item = (await get(app, '/api/art/catalog')).json().items['orchard.crate'];
    expect(item.source).toBe('pack');
    expect((await studioSpec(app, 'orchard.crate')).active.credit).toContain('kenney ui pack');
  });

  it('victory clip: only comes from a pack, only into a clip spec, and is served as video', async () => {
    const app = await makeApp();
    await enable(app);
    // minimal headers: the type is decided by the content, not by the extension
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]), Buffer.from('webm'), Buffer.alloc(200, 1)]);
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypisom'), Buffer.alloc(200, 2)]);
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from('ftypheic'), Buffer.alloc(200, 3)]);
    const pack = join(dir, 'packs', 'lila-clips');
    mkdirSync(pack, { recursive: true });
    writeFileSync(join(pack, 'danse.webm'), webm);
    writeFileSync(join(pack, 'danse.mp4'), mp4);
    writeFileSync(join(pack, 'photo.mp4'), heic); // HEIC image with a video extension: ignored
    writeFileSync(join(pack, 'fake.webm'), tinyPng()); // PNG with a video extension: ignored
    writeFileSync(join(pack, 'pear.png'), tinyPng());
    const scan = (await post(app, '/api/art/packs/scan')).json();
    expect(scan.added).toBe(3);
    const files = scan.packs[0].files as Array<{ id: string; path: string; media: string; mime: string }>;
    const byPath = Object.fromEntries(files.map((f) => [f.path, f]));
    expect(byPath['danse.webm']?.mime).toBe('video/webm');
    expect(byPath['danse.mp4']?.mime).toBe('video/mp4');
    expect(byPath['pear.png']?.media).toBe('image');

    // the app does not generate clips
    expect((await post(app, '/api/art/specs/lila.dance/generate', { n: 1 })).json().error.code).toBe('clip-not-generated');
    // video in an image spec and image in a clip spec are rejected
    expect((await post(app, `/api/art/pack-files/${byPath['danse.webm']?.id}/use`, { specId: 'fruit.pear' })).statusCode).toBe(400);
    expect((await post(app, `/api/art/pack-files/${byPath['pear.png']?.id}/use`, { specId: 'lila.dance' })).statusCode).toBe(400);
    expect((await get(app, '/api/art/catalog')).json().items).toEqual({});

    expect((await post(app, `/api/art/pack-files/${byPath['danse.webm']?.id}/use`, { specId: 'lila.dance' })).statusCode).toBe(200);
    const item = (await get(app, '/api/art/catalog')).json().items['lila.dance'];
    expect(item).toMatchObject({ source: 'pack', mime: 'video/webm' });
    expect(item.url).toMatch(/\.webm$/);
    const served = await get(app, item.url);
    expect(served.statusCode).toBe(200);
    expect(served.headers['content-type']).toContain('video/webm');
    expect(served.rawPayload.equals(webm)).toBe(true);
    // range requests: the browser needs them to play and loop videos without downloading everything
    expect(served.headers['accept-ranges']).toBe('bytes');
    const part = await app.inject({ method: 'GET', url: item.url, headers: { host: H.host, range: 'bytes=0-9' } });
    expect(part.statusCode).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 0-9/${webm.length}`);
    expect(part.rawPayload.equals(webm.subarray(0, 10))).toBe(true);
    const tail = await app.inject({ method: 'GET', url: item.url, headers: { host: H.host, range: 'bytes=-5' } });
    expect(tail.statusCode).toBe(206);
    expect(tail.rawPayload.equals(webm.subarray(webm.length - 5))).toBe(true);
    expect((await app.inject({ method: 'GET', url: item.url, headers: { host: H.host, range: `bytes=${webm.length}-` } })).statusCode).toBe(416);
    // the pack preview in the studio also supports range requests
    const prev = await app.inject({ method: 'GET', url: `/api/art/pack-files/${byPath['danse.mp4']?.id}/image`, headers: { host: H.host, range: 'bytes=4-11' } });
    expect(prev.statusCode).toBe(206);
    expect(prev.rawPayload.toString('latin1')).toBe('ftypisom');
  });

  it('a generation interrupted by closing the app shows up as failed on reopening', async () => {
    let app = await makeApp();
    ctx.db.prepare("INSERT INTO art_jobs (id, spec_id, provider, model, prompt, requested, status, created_at) VALUES ('j1', 'fruit.pear', 'mock', 'm', 'p', 2, 'running', ?)").run(clock.toISOString());
    ctx.db.close();
    app = await makeApp();
    expect((await studioSpec(app, 'fruit.pear')).job.errorCode).toBe('interrupted');
  });
});
