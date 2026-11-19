import { createHash } from 'node:crypto';
import { encodePng } from './png';

/** Image providers. The Claude API does not generate images; that is why generation sits behind this interface. */
export interface ImageRequest {
  prompt: string;
  size: [number, number];
  transparent: boolean;
  /** already-approved images that serve as a model (master character) */
  references: Array<{ mime: string; data: Uint8Array }>;
  n: number;
  quality: string;
}

export interface ImageResult {
  images: Array<{ mime: string; data: Uint8Array }>;
  model: string;
}

export interface ImageProvider {
  id: string;
  model: string;
  /** text shown to the parents */
  label: string;
  generate(req: ImageRequest): Promise<ImageResult>;
}

export type ArtErrorCode = 'no-provider' | 'no-key' | 'invalid-key' | 'rate-limited' | 'unavailable' | 'timeout' | 'network' | 'malformed' | 'bad-request';

export class ArtError extends Error {
  constructor(
    public code: ArtErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const apiError = (text: string): { message: string; code: string } => {
  try {
    const e = (JSON.parse(text) as { error?: { message?: unknown; code?: unknown } })?.error;
    return { message: typeof e?.message === 'string' ? e.message.trim().slice(0, 240) : '', code: typeof e?.code === 'string' ? e.code : '' };
  } catch {
    return { message: '', code: '' }; // body is not JSON
  }
};
const apiDetail = (text: string): string => {
  const m = apiError(text).message;
  return m ? `: ${m}` : '';
};

/** 429 error codes that waiting will not fix: out of credit or account spending limit reached. */
const BILLING_429 = new Set(['insufficient_quota', 'credit_balance_exhausted', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded']);

/** `who` starts lowercase when it begins with an article («l’API d’images»); at the start of a sentence it is capitalized. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function fetchChecked(doFetch: typeof fetch, url: string, init: RequestInit, timeoutMs: number, who: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await doFetch(url, { ...init, signal: ctrl.signal });
    const text = await res.text();
    const { code } = apiError(text);
    if (res.status === 401) throw new ArtError('invalid-key', `Clé invalide pour ${who}${apiDetail(text)}.`);
    // 403: unsupported region or, at OpenAI, organization not yet verified for the image models
    if (res.status === 403) throw new ArtError('invalid-key', `Accès refusé par ${who} (403)${apiDetail(text)}. Chez OpenAI, vérifiez que l’organisation a été vérifiée (Settings → Organization → General).`);
    if (res.status === 429 && BILLING_429.has(code)) throw new ArtError('rate-limited', `Plus de crédit, ou limite de dépenses du compte dépassée, pour ${who} (${code}). Vérifiez la facturation du compte.`);
    if (res.status === 429) throw new ArtError('rate-limited', `Limite d’utilisation atteinte pour ${who}. Réessayez plus tard.`);
    if (res.status >= 500) throw new ArtError('unavailable', `${cap(who)} est indisponible pour le moment.`);
    if (res.status === 400 && code === 'moderation_blocked') throw new ArtError('bad-request', `${cap(who)} a refusé la demande à cause de son filtre de sécurité. Reformulez la demande (par exemple, sans mots qui pourraient être mal interprétés).`);
    if (!res.ok) throw new ArtError('bad-request', `Demande refusée par ${who} (${res.status})${apiDetail(text)}.`);
    return text;
  } catch (e) {
    if (e instanceof ArtError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new ArtError('timeout', `${cap(who)} a mis trop de temps à répondre.`);
    throw new ArtError('network', `Impossible de joindre ${who} (vérifiez la connexion Internet).`);
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ OpenAI (GPT Image)

/**
 * Adapter for the OpenAI images API (generation: POST /v1/images/generations; with reference
 * images: POST /v1/images/edits, multipart field `image[]`).
 * Checked against the official documentation on 17/11/2026 (developers.openai.com, Images guide and reference):
 * - gpt-image-2.5-sunburst and -flare accept background "transparent" with output_format png or webp;
 * - free WxH size with sides that are multiples of 16, aspect ratio up to 3:1, from 655 360 to 8 294 400 pixels;
 * - the response always carries data[].b64_json (response_format is not accepted by the GPT Image models);
 * - safety filter refusal: HTTP 400 with error.code "moderation_blocked".
 */
export function openaiProvider(opts: { apiKey: string; model: string; fetchImpl?: typeof fetch; baseUrl?: string; timeoutMs?: number }): ImageProvider {
  const doFetch = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl ?? 'https://api.openai.com/v1';
  return {
    id: 'openai',
    model: opts.model,
    label: `OpenAI (${opts.model})`,
    async generate(req) {
      if (!opts.apiKey) throw new ArtError('no-key', 'Clé de l’API d’images non configurée (IMAGE_API_KEY dans le fichier .env).');
      const common = {
        model: opts.model,
        prompt: req.prompt,
        n: String(req.n),
        size: `${req.size[0]}x${req.size[1]}`,
        quality: req.quality,
        background: req.transparent ? 'transparent' : 'opaque',
        output_format: 'png',
      };
      let init: RequestInit;
      let url: string;
      if (req.references.length === 0) {
        url = `${base}/images/generations`;
        init = { method: 'POST', headers: { authorization: `Bearer ${opts.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify({ ...common, n: req.n }) };
      } else {
        url = `${base}/images/edits`;
        const form = new FormData();
        for (const [k, v] of Object.entries(common)) form.append(k, v);
        req.references.forEach((r, i) => form.append('image[]', new Blob([r.data as BlobPart], { type: r.mime }), `reference-${i + 1}.${r.mime === 'image/webp' ? 'webp' : 'png'}`));
        init = { method: 'POST', headers: { authorization: `Bearer ${opts.apiKey}` }, body: form };
      }
      const text = await fetchChecked(doFetch, url, init, opts.timeoutMs ?? 240000, 'l’API d’images');
      let body: { data?: Array<{ b64_json?: string }> };
      try {
        body = JSON.parse(text) as typeof body;
      } catch {
        throw new ArtError('malformed', 'La réponse de l’API d’images n’est pas un JSON valide.');
      }
      const images = (body.data ?? []).filter((d) => typeof d.b64_json === 'string').map((d) => ({ mime: 'image/png', data: new Uint8Array(Buffer.from(d.b64_json as string, 'base64')) }));
      if (images.length === 0) throw new ArtError('malformed', 'L’API d’images n’a renvoyé aucune image.');
      return { images, model: opts.model };
    },
  };
}

// ------------------------------------------------------------------ simulated provider

/**
 * Draws test images without calling anyone. Useful to try out the production line
 * (checks, approval, catalog) before there is an image key.
 * The third candidate deliberately comes out with an opaque background, so the technical check has something to reject.
 */
export function mockProvider(): ImageProvider {
  return {
    id: 'mock',
    model: 'simulé',
    label: 'Simulé (images de test, sans frais)',
    async generate(req) {
      const [w, h] = req.size;
      const seed = createHash('sha1').update(req.prompt).digest();
      const images = Array.from({ length: req.n }, (_, i) => {
        const hue = ((seed[i % seed.length] as number) / 255) * 360;
        const frame = /caixa|crate|caisse/i.test(req.prompt);
        const defective = req.transparent && i === 2;
        return { mime: 'image/png', data: encodePng(w, h, draw(w, h, hue, req.transparent && !defective, frame)) };
      });
      return { images, model: 'simulé' };
    },
  };
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

function draw(w: number, h: number, hue: number, transparent: boolean, frame: boolean): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w * (frame ? 0.46 : 0.36);
  const ry = h * (frame ? 0.44 : 0.38);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      // crate: rounded rectangle with a light interior; others: shaded oval shape
      const d = frame ? Math.max(Math.abs(dx), Math.abs(dy)) ** 6 + Math.min(Math.abs(dx), Math.abs(dy)) ** 6 : dx * dx + dy * dy;
      if (d <= 1) {
        const inner = frame && Math.abs(dx) < 0.86 && Math.abs(dy) < 0.74;
        const light = inner ? 0.78 : 0.42 + 0.22 * (1 - (y / h + x / w) / 2);
        const [r, g, b] = hsl(inner ? 45 : hue, inner ? 0.55 : 0.62, light);
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
      } else if (!transparent) {
        const [r, g, b] = hsl((hue + 200) % 360, 0.35, 0.86 - 0.18 * (y / h));
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
      }
    }
  }
  return out;
}
