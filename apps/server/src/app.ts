import { createReadStream, statSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { missions } from '@melina/curriculum';
import { imageLimits } from '@melina/handwriting';
import * as art from './art';
import { createBackup, listBackups } from './backup';
import { pendingMigrations } from './db';
import { buildReport } from './report';
import * as svc from './service';
import { HttpError, type Ctx } from './service';

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]']);

export async function buildApp(c: Ctx): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // do not log bodies, images or secrets
    bodyLimit: 256 * 1024,
  });

  await app.register(multipart, { limits: { fileSize: imageLimits.maxBytes, files: 1, fields: 5 } });

  art.bootstrapArt(c);

  const allowedOrigins = new Set([`http://127.0.0.1:${c.cfg.port}`, `http://localhost:${c.cfg.port}`, ...c.cfg.devOrigins]);

  // Protections: local host names only (against DNS rebinding) and own header + origin on mutations (against CSRF).
  app.addHook('onRequest', async (req, reply) => {
    const host = String(req.headers.host ?? '');
    const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0] ?? '';
    if (!LOCAL_HOSTNAMES.has(hostname)) {
      return reply.code(421).send({ error: { code: 'host-not-allowed', message: 'Accès permis seulement à partir de cet ordinateur.' } });
    }
    if (!req.url.startsWith('/api/')) return;
    const mutating = req.method !== 'GET' && req.method !== 'HEAD';
    const sensitiveGet = req.url.startsWith('/api/photos/');
    if (mutating || sensitiveGet) {
      if (req.headers['x-melina-client'] !== '1') {
        return reply.code(403).send({ error: { code: 'forbidden', message: 'Requête refusée.' } });
      }
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) {
        return reply.code(403).send({ error: { code: 'origin-not-allowed', message: 'Origine non autorisée.' } });
      }
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: { code: err.code, message: err.message } });
    const e = err as { code?: string; statusCode?: number; message?: string };
    if (e.code === 'FST_REQ_FILE_TOO_LARGE') return reply.code(413).send({ error: { code: 'too-large', message: 'La photo est trop volumineuse (maximum 8 Mo).' } });
    if (e.code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') return reply.code(400).send({ error: { code: 'no-file', message: 'Envoyez la photo sous forme de fichier.' } });
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: { code: e.code ?? 'bad-request', message: 'Requête invalide.' } });
    // internal error: generic message, no internal details
    console.error('[erreur interne]', e.code ?? '', (e.message ?? '').slice(0, 200));
    return reply.code(500).send({ error: { code: 'internal', message: 'Erreur interne. Les données n’ont pas été modifiées.' } });
  });

  /**
   * Context of a request: the player comes in the «x-melina-profile» header (profile picker). Without it, Melina's
   * original profile (older clients, tests). An unknown player is refused: data is never written to the wrong child.
   */
  const cx = (req: FastifyRequest): Ctx => {
    const h = req.headers['x-melina-profile'];
    const profileId = typeof h === 'string' && h ? h : svc.PROFILE_ID;
    if (profileId !== svc.PROFILE_ID && !svc.profileExists(c, profileId)) throw new HttpError(400, 'unknown-profile', 'Joueur inconnu.');
    return { ...c, profileId };
  };
  const id = (req: FastifyRequest) => String((req.params as { id?: string }).id ?? '');
  const body = (req: FastifyRequest) => (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {});

  app.get('/api/health', async (req) => {
    const s = svc.getSettings(cx(req));
    return {
      ok: true,
      app: 'melina',
      version: '0.1.0',
      database: { pendingMigrations: pendingMigrations(c.db) },
      ai: { keyConfigured: Boolean(c.cfg.apiKey), enabled: s['ai.enabled'], consent: Boolean(s['ai.consentAt']), model: c.cfg.model },
    };
  });

  // ---- players: each one has their own history (picker before the home screen)
  app.get('/api/profiles', async () => svc.listProfiles(c));
  app.post('/api/profiles', async (req) => svc.createProfile(c, body(req)));
  app.patch('/api/profiles/:id', async (req) => svc.updateProfile(c, id(req), body(req)));

  app.get('/api/settings', async (req) => svc.publicSettings(cx(req)));
  app.patch('/api/settings', async (req) => svc.patchSettings(cx(req), body(req)));

  app.post('/api/sessions', async (req) => svc.startSession(cx(req), body(req)));
  app.get('/api/sessions/:id', async (req) => {
    const s = c.db.prepare('SELECT id, mode, mission_id, subject, started_at FROM sessions WHERE id = ? AND profile_id = ?').get(id(req), svc.pid(cx(req)));
    if (!s) throw new HttpError(404, 'session-not-found', 'Séance introuvable.');
    return s;
  });

  app.post('/api/assignments', async (req) => svc.createAssignment(cx(req), body(req)));
  app.get('/api/assignments/pending', async (req) => svc.pendingAssignments(cx(req)));
  app.get('/api/assignments/:id', async (req) => svc.getAssignment(cx(req), id(req)));
  app.post('/api/assignments/:id/hint', async (req) => svc.markHint(cx(req), id(req)));
  app.post('/api/assignments/:id/done', async (req) => svc.markDone(cx(req), id(req)));
  app.post('/api/assignments/:id/cancel', async (req) => svc.cancelAssignment(cx(req), id(req)));
  app.post('/api/assignments/:id/manual', async (req) => svc.createManualReview(cx(req), id(req)));
  app.post('/api/assignments/:id/photo', async (req) => {
    const file = await req.file();
    if (!file) throw new HttpError(400, 'no-file', 'Aucune photo envoyée.');
    const buf = await file.toBuffer(); // the name and path sent by the browser are ignored
    return svc.savePhoto(cx(req), id(req), buf);
  });

  app.post('/api/reviews/:id/analyze', async (req) => svc.analyzeReview(cx(req), id(req)));
  app.patch('/api/reviews/:id/transcription', async (req) => svc.updateTranscription(cx(req), id(req), body(req).text));
  app.post('/api/reviews/:id/confirm', async (req) => svc.confirmReview(cx(req), id(req), body(req)));

  app.get('/api/photos/:id', async (req, reply) => {
    const p = svc.readPhoto(cx(req), id(req));
    reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff').type(p.mime);
    return reply.send(p.data);
  });

  app.get('/api/progress', async (req) => svc.progress(cx(req)));
  app.get('/api/history', async (req) => svc.history(cx(req)));
  // progress report: ?kind=week|month&offset=0 (current), -1 (previous)…
  app.get('/api/report', async (req) => {
    const q = req.query as { kind?: string; offset?: string };
    const kind = q.kind === 'month' ? 'month' : 'week';
    const offset = Math.max(-52, Math.min(0, Number.parseInt(q.offset ?? '0', 10) || 0));
    return buildReport(cx(req), kind, offset);
  });
  app.get('/api/skills', async () => svc.skillCatalog());
  app.get('/api/missions', async (req) => missions.map((m) => ({ ...m, state: svc.missionState(cx(req), m.id) })));
  app.get('/api/game-progress', async (req) => svc.gameProgress(cx(req)));
  app.put('/api/game-progress', async (req) => svc.saveGameState(cx(req), req.body));

  app.get('/api/games', async (req) => svc.listGames(cx(req)));
  app.post('/api/game-rounds', async (req) => svc.startGameRound(cx(req), body(req)));
  app.post('/api/game-rounds/:id/answer', async (req) => svc.answerGameRound(cx(req), id(req), body(req)));

  app.get('/api/handwriting-samples', async (req) => svc.listSamples(cx(req)));
  app.patch('/api/handwriting-samples/:id', async (req) => svc.patchSample(cx(req), id(req), body(req)));
  app.delete('/api/handwriting-samples/:id', async (req) => svc.deleteSample(cx(req), id(req)));
  app.get('/api/reading-stats', async (req) => svc.readingStats(cx(req)));

  // ---- art: catalog (read by the game) and studio (parents' area)
  const upload = async (req: FastifyRequest): Promise<{ file: Buffer | null; fields: Record<string, unknown> }> => {
    if (!req.isMultipart()) return { file: null, fields: body(req) };
    const f = await req.file();
    if (!f) return { file: null, fields: {} };
    const file = await f.toBuffer(); // the name sent by the browser is ignored
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f.fields)) {
      if (v && !Array.isArray(v) && v.type === 'field' && typeof v.value === 'string') {
        try {
          fields[k] = JSON.parse(v.value);
        } catch {
          fields[k] = v.value;
        }
      }
    }
    return { file, fields };
  };
  const sendImage = (reply: import('fastify').FastifyReply, p: { mime: string; data: Buffer }, cache: string) => {
    reply.header('cache-control', cache).header('x-content-type-options', 'nosniff').type(p.mime);
    return reply.send(p.data);
  };
  /**
   * Streams a file from disk, with partial requests (Range). The browser needs this to play
   * and loop videos (MP4 with the index at the end, for example) without downloading it all or loading it into memory.
   */
  const sendFile = (req: FastifyRequest, reply: import('fastify').FastifyReply, p: { mime: string; path: string }, cache: string) => {
    const size = statSync(p.path).size;
    reply.header('cache-control', cache).header('x-content-type-options', 'nosniff').header('accept-ranges', 'bytes').type(p.mime);
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? '').trim());
    if (m && (m[1] || m[2])) {
      // «bytes=a-b», «bytes=a-» or «bytes=-n» (the last n bytes)
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      if (start >= size || start > end) return reply.code(416).header('content-range', `bytes */${size}`).send();
      reply.code(206).header('content-range', `bytes ${start}-${end}/${size}`).header('content-length', end - start + 1);
      return reply.send(createReadStream(p.path, { start, end }));
    }
    reply.header('content-length', size);
    return reply.send(createReadStream(p.path));
  };

  app.get('/api/art/catalog', async () => art.artCatalog(c));
  app.get('/api/art/studio', async () => art.artStudio(c));
  app.patch('/api/art/specs/:id/prompt', async (req) => art.setArtPrompt(c, id(req), body(req).prompt));
  app.post('/api/art/specs/:id/prompt/draft', async (req) => art.draftArtPrompt(c, id(req)));
  app.post('/api/art/specs/:id/generate', async (req) => art.startArtGeneration(c, id(req), body(req)));
  app.post('/api/art/specs/:id/activate', async (req) => art.activateArt(c, id(req), body(req).assetId));
  app.get('/api/art/candidates/:id/image', async (req, reply) => sendImage(reply, art.readCandidateImage(c, id(req)), 'no-store'));
  app.post('/api/art/candidates/:id/review', async (req) => art.reviewArtCandidate(c, id(req)));
  app.post('/api/art/candidates/:id/approve', async (req) => {
    const u = await upload(req);
    return art.approveArtCandidate(c, id(req), u.file, u.fields.meta);
  });
  app.post('/api/art/candidates/:id/reject', async (req) => art.rejectArtCandidate(c, id(req), body(req).reason));
  app.patch('/api/art/assets/:id/grid', async (req) => art.setArtGrid(c, id(req), body(req)));
  app.post('/api/art/packs/scan', async () => art.scanArtPacks(c));
  app.get('/api/art/pack-files/:id/image', async (req, reply) => sendFile(req, reply, art.packFileInfo(c, id(req)), 'no-store'));
  app.post('/api/art/pack-files/:id/use', async (req) => {
    const u = await upload(req);
    return art.usePackFile(c, id(req), u.fields.specId, u.file, u.fields.meta);
  });
  // approved art: the file name changes with each version, so it can be cached
  app.get('/art-files/:file', async (req, reply) => sendFile(req, reply, art.approvedFileInfo(c, String((req.params as { file?: string }).file ?? '')), 'public, max-age=31536000, immutable'));

  app.get('/api/backups', async () => listBackups(c));
  app.post('/api/backups', async () => createBackup(c, 'manual'));

  if (c.cfg.staticDir) {
    // the game files have fixed names (assets/app.js): the browser always checks whether they changed (ETag),
    // otherwise an update (e.g. the new sound) might not arrive and the old game would keep running
    await app.register(fastifyStatic, {
      root: c.cfg.staticDir,
      prefix: '/',
      index: ['index.html'],
      wildcard: false,
      cacheControl: false,
      setHeaders: (res) => res.header('cache-control', 'no-cache'),
    });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: { code: 'not-found', message: 'Adresse introuvable.' } });
    });
  } else {
    app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: { code: 'not-found', message: 'Adresse introuvable.' } }));
  }

  return app;
}
