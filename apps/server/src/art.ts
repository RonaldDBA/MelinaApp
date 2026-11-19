import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import {
  ArtError,
  artSpecs,
  artStyle,
  buildPrompt,
  getArtSpec,
  mockProvider,
  openaiProvider,
  reviewCandidate,
  reviewPreview,
  sniffVideo,
  techCheck,
  videoLimits,
  writePrompt,
  type ArtSpec,
  type ImageProvider,
  type TechReport,
} from '@melina/art';
import { imageLimits, sniffImage } from '@melina/handwriting';
import type { GridSpec } from '@melina/shared';
import { tx } from './db';
import { getSettings, HttpError, type Ctx } from './service';

/**
 * Art production line: spec → prompt → generation → review → parent approval → catalog.
 * Nothing generated is shown to the child before approval. No request carries any of her data.
 */

type Row = Record<string, unknown>;
const one = (c: Ctx, sql: string, ...p: Array<string | number | null>) => c.db.prepare(sql).get(...p) as Row | undefined;
const all = (c: Ctx, sql: string, ...p: Array<string | number | null>) => c.db.prepare(sql).all(...p) as Row[];
const run = (c: Ctx, sql: string, ...p: Array<string | number | null>) => c.db.prepare(sql).run(...p);
const iso = (c: Ctx) => c.now().toISOString();
const parse = <T>(s: unknown, fallback: T): T => {
  if (typeof s !== 'string' || !s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

const candidatesDir = (c: Ctx) => join(c.cfg.dataDir, 'art', 'candidates');
const approvedDir = (c: Ctx) => join(c.cfg.dataDir, 'art', 'approved');
const EXT: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'video/mp4': 'mp4', 'video/webm': 'webm' };
const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', mp4: 'video/mp4', webm: 'video/webm' };
const FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp|jpg|mp4|webm)$/;
const isClip = (s: ArtSpec) => s.kind === 'clip';

const jobs = new Set<Promise<void>>();
/** Waits for in-flight generations (used in tests and on shutdown). */
export const waitForArtJobs = async () => {
  await Promise.all([...jobs]);
};

export function bootstrapArt(c: Ctx) {
  mkdirSync(candidatesDir(c), { recursive: true });
  mkdirSync(approvedDir(c), { recursive: true });
  // generations interrupted by the app being closed
  run(c, "UPDATE art_jobs SET status = 'failed', error_code = 'interrupted', error_message = 'L’application a été fermée pendant la génération.', finished_at = ? WHERE status = 'running'", iso(c));
}

function spec(id: string): ArtSpec {
  const s = getArtSpec(id);
  if (!s) throw new HttpError(404, 'unknown-spec', 'Fiche d’art inconnue.');
  return s;
}

function provider(c: Ctx): ImageProvider | null {
  if (c.imageProvider) return c.imageProvider;
  if (c.cfg.imageProvider === 'mock') return mockProvider();
  if (c.cfg.imageProvider === 'openai') return openaiProvider({ apiKey: c.cfg.imageApiKey, model: c.cfg.imageModel, fetchImpl: c.fetchImpl });
  return null;
}

function usage(c: Ctx) {
  const now = iso(c);
  const count = (from: string) => Number(one(c, 'SELECT COUNT(*) AS n FROM art_candidates WHERE created_at >= ?', from)?.n ?? 0);
  return { today: count(`${now.slice(0, 10)}T00:00:00.000Z`), month: count(`${now.slice(0, 7)}-01T00:00:00.000Z`) };
}

function gridOf(s: ArtSpec, metaJson: unknown): GridSpec | undefined {
  if (!s.grid) return undefined;
  const inset = parse<{ inset?: number[] }>(metaJson, {}).inset;
  return inset && inset.length === 4 ? { ...s.grid, inset: inset as GridSpec['inset'] } : s.grid;
}

// ------------------------------------------------------------------ catalog (read by the game)

export function artCatalog(c: Ctx) {
  const items: Record<string, { url: string; source: string; mime: string; grid?: GridSpec }> = {};
  for (const r of all(c, 'SELECT spec_id, file, mime, source, meta_json FROM art_assets WHERE active = 1')) {
    const s = getArtSpec(String(r.spec_id));
    if (s) items[s.id] = { url: `/art-files/${String(r.file)}`, source: String(r.source), mime: String(r.mime), grid: gridOf(s, r.meta_json) };
  }
  return { items };
}

/** First `n` bytes of a file, without reading the rest. */
function readHead(path: string, n: number): Uint8Array {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.alloc(n);
    const got = readSync(fd, buf, 0, n, 0);
    return buf.subarray(0, got);
  } finally {
    closeSync(fd);
  }
}

/** Approved file (image or clip) served from disk without loading it into memory (supports range requests). */
export function approvedFileInfo(c: Ctx, file: string): { mime: string; path: string } {
  if (!FILE_RE.test(file) || !one(c, 'SELECT id FROM art_assets WHERE file = ?', file)) throw new HttpError(404, 'not-found', 'Illustration introuvable.');
  const path = join(approvedDir(c), file);
  if (!existsSync(path)) throw new HttpError(404, 'not-found', 'Illustration introuvable.');
  return { mime: MIME[file.split('.').pop() as string] as string, path };
}

// ------------------------------------------------------------------ studio (parent area)

function candidateView(r: Row) {
  return {
    id: String(r.id),
    specId: String(r.spec_id),
    url: `/api/art/candidates/${String(r.id)}/image`,
    width: Number(r.width),
    height: Number(r.height),
    status: String(r.status),
    tech: parse<TechReport | null>(r.tech_json, null),
    techOk: Number(r.tech_ok) === 1,
    review: parse<Record<string, unknown> | null>(r.ai_json, null),
    reviewVerdict: (r.ai_verdict as string | null) ?? null,
    createdAt: String(r.created_at),
  };
}

function specView(c: Ctx, s: ArtSpec) {
  const saved = one(c, 'SELECT prompt, source FROM art_prompts WHERE spec_id = ?', s.id);
  const versions = all(c, 'SELECT * FROM art_assets WHERE spec_id = ? ORDER BY version DESC', s.id).map((r) => ({
    id: String(r.id),
    version: Number(r.version),
    url: `/art-files/${String(r.file)}`,
    mime: String(r.mime),
    source: String(r.source),
    provider: (r.provider as string | null) ?? null,
    model: (r.model as string | null) ?? null,
    credit: (r.credit as string | null) ?? null,
    active: Number(r.active) === 1,
    approvedAt: String(r.approved_at),
    grid: gridOf(s, r.meta_json),
  }));
  const job = one(c, 'SELECT id, status, provider, model, requested, received, error_code, error_message, created_at FROM art_jobs WHERE spec_id = ? ORDER BY created_at DESC LIMIT 1', s.id);
  return {
    ...s,
    defaultPrompt: buildPrompt(artStyle, s),
    prompt: saved ? String(saved.prompt) : null,
    promptSource: saved ? String(saved.source) : 'default',
    versions,
    active: versions.find((v) => v.active) ?? null,
    candidates: all(c, "SELECT * FROM art_candidates WHERE spec_id = ? AND status = 'pending' ORDER BY created_at DESC", s.id).map(candidateView),
    job: job
      ? { id: String(job.id), status: String(job.status), provider: String(job.provider), model: String(job.model), requested: Number(job.requested), received: Number(job.received), errorCode: job.error_code ?? null, errorMessage: job.error_message ?? null, createdAt: String(job.created_at) }
      : null,
  };
}

export function artStudio(c: Ctx) {
  const st = getSettings(c);
  const p = provider(c);
  return {
    enabled: st['art.enabled'],
    consentAt: st['art.consentAt'],
    provider: p ? { id: p.id, label: p.label, model: p.model, keyConfigured: p.id !== 'openai' || Boolean(c.cfg.imageApiKey) } : null,
    claudeAvailable: Boolean(c.cfg.apiKey),
    claudeModel: c.cfg.model,
    limits: { daily: st['art.dailyLimit'], monthly: st['art.monthlyLimit'] },
    usage: usage(c),
    style: artStyle,
    specs: artSpecs.map((s) => specView(c, s)),
    packs: listPacks(c),
  };
}

export function setArtPrompt(c: Ctx, specId: string, text: unknown) {
  const s = spec(specId);
  if (text === null || text === '') run(c, 'DELETE FROM art_prompts WHERE spec_id = ?', s.id);
  else {
    if (typeof text !== 'string' || text.trim().length < 20 || text.length > 4000) throw new HttpError(400, 'invalid-prompt', 'La demande doit contenir entre 20 et 4000 caractères.');
    run(c, "INSERT INTO art_prompts (spec_id, prompt, source, updated_at) VALUES (?, ?, 'parent', ?) ON CONFLICT(spec_id) DO UPDATE SET prompt = excluded.prompt, source = 'parent', updated_at = excluded.updated_at", s.id, text.trim(), iso(c));
  }
  return specView(c, s);
}

function requireEnabled(c: Ctx) {
  const st = getSettings(c);
  if (!st['art.enabled'] || !st['art.consentAt']) throw new HttpError(403, 'art-disabled', 'La génération d’art est désactivée. Activez-la dans l’Atelier d’art.');
}

const httpFromArt = (e: unknown) => (e instanceof ArtError ? new HttpError(e.code === 'no-key' || e.code === 'invalid-key' ? 409 : 502, e.code, e.message) : e);

/** Claude drafts the prompt from the style guide and the spec. Parents can edit it afterwards. */
export async function draftArtPrompt(c: Ctx, specId: string) {
  const s = spec(specId);
  requireEnabled(c);
  if (!c.cfg.apiKey) throw new HttpError(409, 'no-key', 'La clé de l’API de Claude n’est pas configurée.');
  try {
    const text = await writePrompt({ apiKey: c.cfg.apiKey, model: c.cfg.model, style: artStyle, spec: s, base: buildPrompt(artStyle, s), fetchImpl: c.fetchImpl });
    run(c, "INSERT INTO art_prompts (spec_id, prompt, source, updated_at) VALUES (?, ?, 'claude', ?) ON CONFLICT(spec_id) DO UPDATE SET prompt = excluded.prompt, source = 'claude', updated_at = excluded.updated_at", s.id, text, iso(c));
  } catch (e) {
    throw httpFromArt(e);
  }
  return specView(c, s);
}

function activeFile(c: Ctx, specId: string): { mime: string; data: Uint8Array } | null {
  const r = one(c, 'SELECT file, mime FROM art_assets WHERE spec_id = ? AND active = 1', specId);
  if (!r) return null;
  const path = join(approvedDir(c), String(r.file));
  return existsSync(path) ? { mime: String(r.mime), data: readFileSync(path) } : null;
}

/** Starts a generation. Returns immediately; the work continues in the background and the screen polls its progress. */
export function startArtGeneration(c: Ctx, specId: string, body: { n?: unknown }) {
  const s = spec(specId);
  if (isClip(s)) throw new HttpError(409, 'clip-not-generated', 'Les clips ne sont pas générés par l’application. Placez la vidéo (MP4 ou WebM) dans assets\\packs-inbox\\<paquet>\\, cliquez sur « Chercher des paquets » dans l’Atelier d’art, puis choisissez-la dans cette fiche.');
  requireEnabled(c);
  const p = provider(c);
  if (!p) throw new HttpError(409, 'no-provider', 'Aucun fournisseur d’images n’est configuré. Définissez IMAGE_PROVIDER et IMAGE_API_KEY dans le fichier .env.');
  const n = Number.isInteger(body.n) ? Math.max(1, Math.min(4, body.n as number)) : 3;
  const st = getSettings(c);
  const u = usage(c);
  if (u.today + n > st['art.dailyLimit']) throw new HttpError(409, 'daily-limit', `Limite quotidienne de ${st['art.dailyLimit']} images atteinte (${u.today} aujourd’hui).`);
  if (u.month + n > st['art.monthlyLimit']) throw new HttpError(409, 'monthly-limit', `Limite mensuelle de ${st['art.monthlyLimit']} images atteinte (${u.month} ce mois-ci).`);
  if (one(c, "SELECT id FROM art_jobs WHERE spec_id = ? AND status = 'running'", s.id)) throw new HttpError(409, 'busy', 'Une génération est déjà en cours pour cette fiche.');

  let reference: { mime: string; data: Uint8Array } | null = null;
  if (s.reference) {
    reference = activeFile(c, s.reference);
    if (!reference) throw new HttpError(409, 'reference-missing', `Approuvez d’abord l’image maîtresse (${getArtSpec(s.reference)?.title ?? s.reference}); elle sert de modèle pour celle-ci.`);
  }
  const saved = one(c, 'SELECT prompt FROM art_prompts WHERE spec_id = ?', s.id);
  const prompt = saved ? String(saved.prompt) : buildPrompt(artStyle, s);
  const jobId = randomUUID();
  run(c, "INSERT INTO art_jobs (id, spec_id, provider, model, prompt, requested, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'running', ?)", jobId, s.id, p.id, p.model, prompt, n, iso(c));

  const work = runJob(c, jobId, s, p, prompt, reference, n).finally(() => jobs.delete(work));
  jobs.add(work);
  return specView(c, s);
}

async function runJob(c: Ctx, jobId: string, s: ArtSpec, p: ImageProvider, prompt: string, reference: { mime: string; data: Uint8Array } | null, n: number) {
  const made: Array<{ id: string; data: Uint8Array; mime: string }> = [];
  try {
    const res = await p.generate({ prompt, size: s.size, transparent: s.transparent, references: reference ? [reference] : [], n, quality: c.cfg.imageQuality });
    for (const image of res.images.slice(0, n)) {
      const info = sniffImage(image.data);
      const tech = techCheck(s, image.data, info, imageLimits.maxBytes);
      if (!info) continue; // content that is not an image is never written
      const id = randomUUID();
      const file = `${id}.${EXT[info.mime]}`;
      writeFileSync(join(candidatesDir(c), file), image.data);
      run(
        c,
        'INSERT INTO art_candidates (id, job_id, spec_id, file, mime, sha256, width, height, tech_json, tech_ok, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id,
        jobId,
        s.id,
        file,
        info.mime,
        createHash('sha256').update(image.data).digest('hex'),
        info.width,
        info.height,
        JSON.stringify(tech),
        tech.ok ? 1 : 0,
        iso(c),
      );
      made.push({ id, data: image.data, mime: info.mime });
    }
    if (made.length === 0) throw new ArtError('malformed', 'Le fournisseur d’images n’a renvoyé aucune image valide.');
    run(c, "UPDATE art_jobs SET status = 'done', received = ?, model = ?, finished_at = ? WHERE id = ?", made.length, res.model, iso(c), jobId);
  } catch (e) {
    const err = e instanceof ArtError ? e : new ArtError('unavailable', 'Échec inattendu de la génération.');
    run(c, "UPDATE art_jobs SET status = 'failed', received = ?, error_code = ?, error_message = ?, finished_at = ? WHERE id = ?", made.length, err.code, err.message, iso(c), jobId);
  }
  for (const m of made) await reviewOne(c, m.id, s, m, reference);
}

/** Claude review. A failure here never breaks the generation: it is recorded on the candidate. */
async function reviewOne(c: Ctx, candidateId: string, s: ArtSpec, image: { data: Uint8Array; mime: string }, reference: { mime: string; data: Uint8Array } | null) {
  if (!c.cfg.apiKey) return;
  try {
    const small = image.mime === 'image/png' ? reviewPreview(image.data) : null;
    const send = small ? { mime: 'image/png', data: small } : image;
    if (send.data.length > 3_500_000) throw new ArtError('bad-request', 'Image trop volumineuse pour la vérification par Claude; vérifiez-la vous-même.');
    const refSmall = reference && reference.mime === 'image/png' ? reviewPreview(reference.data) : null;
    const ref = reference ? (refSmall ? { mime: 'image/png', data: refSmall } : reference.data.length <= 3_500_000 ? reference : undefined) : undefined;
    const r = await reviewCandidate({ apiKey: c.cfg.apiKey, model: c.cfg.model, style: artStyle, spec: s, image: send, reference: ref, fetchImpl: c.fetchImpl });
    run(c, 'UPDATE art_candidates SET ai_json = ?, ai_verdict = ? WHERE id = ?', JSON.stringify(r), r.verdict, candidateId);
  } catch (e) {
    const msg = e instanceof ArtError ? e.message : 'La vérification par Claude a échoué.';
    run(c, "UPDATE art_candidates SET ai_json = ?, ai_verdict = 'error' WHERE id = ?", JSON.stringify({ error: msg }), candidateId);
  }
}

function candidate(c: Ctx, id: string): Row {
  const r = one(c, 'SELECT * FROM art_candidates WHERE id = ?', id);
  if (!r) throw new HttpError(404, 'not-found', 'Candidate introuvable.');
  return r;
}

export function readCandidateImage(c: Ctx, id: string) {
  const r = candidate(c, id);
  const path = join(candidatesDir(c), String(r.file));
  if (!existsSync(path)) throw new HttpError(404, 'not-found', 'Fichier de la candidate introuvable.');
  return { mime: String(r.mime), data: readFileSync(path) };
}

export async function reviewArtCandidate(c: Ctx, id: string) {
  const r = candidate(c, id);
  const s = spec(String(r.spec_id));
  requireEnabled(c);
  if (!c.cfg.apiKey) throw new HttpError(409, 'no-key', 'La clé de l’API de Claude n’est pas configurée.');
  await reviewOne(c, id, s, readCandidateImage(c, id), s.reference ? activeFile(c, s.reference) : null);
  return candidateView(candidate(c, id));
}

function parseInset(s: ArtSpec, meta: unknown): string | null {
  if (!s.grid || !meta || typeof meta !== 'object') return null;
  const inset = (meta as { inset?: unknown }).inset;
  if (inset === undefined) return null;
  if (!Array.isArray(inset) || inset.length !== 4 || inset.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 0.45)) throw new HttpError(400, 'invalid-meta', 'Marges de la grille invalides.');
  return JSON.stringify({ inset });
}

/** Checks the file against the spec kind: an image spec only accepts images; a clip spec only accepts video. */
function validMedia(s: ArtSpec, data: Uint8Array): { mime: string; width: number; height: number } {
  if (isClip(s)) {
    const v = sniffVideo(data);
    if (!v) throw new HttpError(400, 'invalid-video', 'Cette fiche est un clip : utilisez une vidéo MP4 ou WebM.');
    if (data.length > videoLimits.maxBytes) throw new HttpError(400, 'invalid-video', `Le clip dépasse ${videoLimits.maxBytes / 1024 / 1024} Mo.`);
    return { mime: v.mime, width: 0, height: 0 };
  }
  const info = sniffImage(data);
  if (!info || data.length > imageLimits.maxBytes || info.width > 4096 || info.height > 4096 || info.width < 16 || info.height < 16) throw new HttpError(400, 'invalid-image', 'L’image envoyée n’est pas valide ou est trop volumineuse.');
  return info;
}

function insertAsset(c: Ctx, s: ArtSpec, data: Uint8Array, extra: { source: 'generated' | 'pack'; candidateId?: string; packFileId?: string; provider?: string; model?: string; prompt?: string; credit?: string; meta?: string | null }) {
  const info = validMedia(s, data);
  const id = randomUUID();
  const file = `${id}.${EXT[info.mime]}`;
  writeFileSync(join(approvedDir(c), file), data);
  tx(c.db, () => {
    const version = Number(one(c, 'SELECT COALESCE(MAX(version), 0) + 1 AS v FROM art_assets WHERE spec_id = ?', s.id)?.v ?? 1);
    run(c, 'UPDATE art_assets SET active = 0 WHERE spec_id = ?', s.id);
    run(
      c,
      'INSERT INTO art_assets (id, spec_id, version, file, mime, width, height, source, candidate_id, pack_file_id, provider, model, prompt, credit, meta_json, active, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
      id,
      s.id,
      version,
      file,
      info.mime,
      info.width,
      info.height,
      extra.source,
      extra.candidateId ?? null,
      extra.packFileId ?? null,
      extra.provider ?? null,
      extra.model ?? null,
      extra.prompt ?? null,
      extra.credit ?? null,
      extra.meta ?? null,
      iso(c),
    );
    if (extra.candidateId) run(c, "UPDATE art_candidates SET status = 'approved', decided_at = ? WHERE id = ?", iso(c), extra.candidateId);
  });
  return id;
}

/**
 * Parent approval. `processed` is the version prepared by the browser (margins trimmed, WebP);
 * without it, the candidate's original file is used.
 */
export function approveArtCandidate(c: Ctx, id: string, processed: Uint8Array | null, meta: unknown) {
  const r = candidate(c, id);
  if (r.status !== 'pending') throw new HttpError(409, 'already-decided', 'Une décision a déjà été prise pour cette candidate.');
  const s = spec(String(r.spec_id));
  const job = one(c, 'SELECT provider, model, prompt FROM art_jobs WHERE id = ?', String(r.job_id));
  insertAsset(c, s, processed ?? readCandidateImage(c, id).data, {
    source: 'generated',
    candidateId: id,
    provider: String(job?.provider ?? ''),
    model: String(job?.model ?? ''),
    prompt: String(job?.prompt ?? ''),
    credit: `Générée par ${String(job?.provider ?? '?')} (${String(job?.model ?? '?')})`,
    meta: parseInset(s, meta),
  });
  return specView(c, s);
}

export function rejectArtCandidate(c: Ctx, id: string, reason: unknown) {
  const r = candidate(c, id);
  if (r.status !== 'pending') throw new HttpError(409, 'already-decided', 'Une décision a déjà été prise pour cette candidate.');
  run(c, "UPDATE art_candidates SET status = 'rejected', reject_reason = ?, decided_at = ? WHERE id = ?", typeof reason === 'string' ? reason.slice(0, 300) : null, iso(c), id);
  return specView(c, spec(String(r.spec_id)));
}

/** Switches the active version. A null `assetId` goes back to the built-in art. */
export function activateArt(c: Ctx, specId: string, assetId: unknown) {
  const s = spec(specId);
  tx(c.db, () => {
    if (assetId !== null && assetId !== undefined) {
      if (!one(c, 'SELECT id FROM art_assets WHERE id = ? AND spec_id = ?', String(assetId), s.id)) throw new HttpError(404, 'not-found', 'Version introuvable.');
      run(c, 'UPDATE art_assets SET active = 0 WHERE spec_id = ?', s.id);
      run(c, 'UPDATE art_assets SET active = 1 WHERE id = ?', String(assetId));
    } else run(c, 'UPDATE art_assets SET active = 0 WHERE spec_id = ?', s.id);
  });
  return specView(c, s);
}

export function setArtGrid(c: Ctx, assetId: string, meta: unknown) {
  const r = one(c, 'SELECT spec_id FROM art_assets WHERE id = ?', assetId);
  if (!r) throw new HttpError(404, 'not-found', 'Version introuvable.');
  const s = spec(String(r.spec_id));
  const json = parseInset(s, meta);
  if (!json) throw new HttpError(400, 'invalid-meta', 'Cette image n’a pas de grille d’emplacements.');
  run(c, 'UPDATE art_assets SET meta_json = ? WHERE id = ?', json, assetId);
  return specView(c, s);
}

// ------------------------------------------------------------------ ready-made packs

const PACK_IMAGE = /\.(png|webp|jpe?g)$/i;
const PACK_VIDEO = /\.(mp4|webm)$/i;

function walk(dir: string, base: string, out: string[], depth = 0) {
  if (depth > 5 || out.length >= 600) return;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, base, out, depth + 1);
    else if (st.isFile() && out.length < 600 && ((PACK_IMAGE.test(name) && st.size <= imageLimits.maxBytes) || (PACK_VIDEO.test(name) && st.size <= videoLimits.maxBytes))) out.push(relative(base, path).split(sep).join('/'));
  }
}

/** Reads the packs placed by the parents in assets/packs-inbox/<pack-name>/ and registers their images. */
export function scanArtPacks(c: Ctx) {
  const root = c.cfg.packsDir;
  mkdirSync(root, { recursive: true });
  let added = 0;
  for (const folder of readdirSync(root).sort()) {
    const dir = join(root, folder);
    if (folder.startsWith('.') || !statSync(dir).isDirectory()) continue;
    const licenseFile = readdirSync(dir).find((f) => /^(licen[cs]e|readme|credits?|cr[eé]ditos?)(\.(txt|md))?$/i.test(f));
    const note = licenseFile
      ? readFileSync(join(dir, licenseFile), 'utf8')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500)
      : null;
    let pack = one(c, 'SELECT id FROM art_packs WHERE folder = ?', folder);
    if (!pack) {
      const id = randomUUID();
      run(c, 'INSERT INTO art_packs (id, folder, name, license_note, imported_at) VALUES (?, ?, ?, ?, ?)', id, folder, folder.replace(/[_-]+/g, ' '), note, iso(c));
      pack = { id };
    } else run(c, 'UPDATE art_packs SET license_note = ? WHERE id = ?', note, String(pack.id));
    const files: string[] = [];
    walk(dir, dir, files);
    for (const rel of files) {
      if (one(c, 'SELECT id FROM art_pack_files WHERE pack_id = ? AND rel_path = ?', String(pack.id), rel)) continue;
      const full = join(dir, rel);
      let info: { mime: string; width: number; height: number } | null;
      let bytes: number;
      if (PACK_VIDEO.test(rel)) {
        // video: the start of the file is enough to check the type (up to 40 MB are not read needlessly)
        bytes = statSync(full).size;
        const video = sniffVideo(readHead(full, 64));
        info = video ? { mime: video.mime, width: 0, height: 0 } : null;
      } else {
        const data = readFileSync(full);
        bytes = data.length;
        info = sniffImage(data);
      }
      if (!info) continue; // image or video extension with other content: ignored
      run(c, 'INSERT INTO art_pack_files (id, pack_id, rel_path, mime, width, height, bytes) VALUES (?, ?, ?, ?, ?, ?, ?)', randomUUID(), String(pack.id), rel, info.mime, info.width, info.height, bytes);
      added++;
    }
  }
  return { added, packs: listPacks(c) };
}

export function listPacks(c: Ctx) {
  return all(c, 'SELECT * FROM art_packs ORDER BY name').map((p) => ({
    id: String(p.id),
    name: String(p.name),
    folder: String(p.folder),
    licenseNote: (p.license_note as string | null) ?? null,
    files: all(c, 'SELECT id, rel_path, mime, width, height FROM art_pack_files WHERE pack_id = ? ORDER BY rel_path LIMIT 600', String(p.id)).map((f) => ({
      id: String(f.id),
      path: String(f.rel_path),
      mime: String(f.mime),
      media: String(f.mime).startsWith('video/') ? ('video' as const) : ('image' as const),
      width: Number(f.width),
      height: Number(f.height),
      url: `/api/art/pack-files/${String(f.id)}/image`,
    })),
  }));
}

/** Pack file (image or clip) served from disk for the studio preview. */
export function packFileInfo(c: Ctx, id: string): { mime: string; path: string; pack: string; licenseNote: string | null } {
  const f = one(c, 'SELECT f.rel_path, f.mime, p.folder, p.name, p.license_note FROM art_pack_files f JOIN art_packs p ON p.id = f.pack_id WHERE f.id = ?', id);
  if (!f) throw new HttpError(404, 'not-found', 'Image du pack introuvable.');
  const base = resolve(c.cfg.packsDir, String(f.folder));
  const path = resolve(base, String(f.rel_path));
  // never leave the pack folder, even if the record has been tampered with
  if (!path.startsWith(base + sep) || !existsSync(path)) throw new HttpError(404, 'not-found', 'Image du pack introuvable.');
  return { mime: String(f.mime), path, pack: String(f.name), licenseNote: (f.license_note as string | null) ?? null };
}

export function readPackFile(c: Ctx, id: string) {
  const f = packFileInfo(c, id);
  return { ...f, data: readFileSync(f.path) };
}

/** Uses a pack image as a spec's art. It becomes a version like any other. */
export function usePackFile(c: Ctx, fileId: string, specId: unknown, processed: Uint8Array | null, meta: unknown) {
  const s = spec(String(specId ?? ''));
  const f = readPackFile(c, fileId);
  // a clip goes in as is (the browser does not process video); validation checks the type against the spec
  if (isClip(s) && processed) throw new HttpError(400, 'invalid-video', 'Les clips sont utilisés tels quels : envoyez seulement votre choix, sans fichier traité.');
  insertAsset(c, s, processed ?? f.data, { source: 'pack', packFileId: fileId, credit: `Pack «${f.pack}»${f.licenseNote ? ` — ${f.licenseNote.slice(0, 160)}` : ''}`, meta: parseInset(s, meta) });
  return specView(c, s);
}
