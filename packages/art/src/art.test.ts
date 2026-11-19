import { describe, expect, it } from 'vitest';
import { alphaStats, artSpecs, artStyle, buildPrompt, decodePng, encodePng, getArtSpec, mockProvider, openaiProvider, reviewCandidate, reviewPreview, sniffVideo, specProblems, techCheck, writePrompt, type ArtSpec } from './index';

const crate = getArtSpec('orchard.crate') as ArtSpec;
const bg = getArtSpec('orchard.bg') as ArtSpec;
const sniff = (w: number, h: number) => ({ mime: 'image/png', width: w, height: h });

function blob(w: number, h: number, opaqueBackground = false, touchEdge = false): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const insideShape = touchEdge ? x < w * 0.6 : Math.abs(x - w / 2) < w * 0.3 && Math.abs(y - h / 2) < h * 0.3;
      if (insideShape) px.set([200, 60, 50, 255], o);
      else if (opaqueBackground) px.set([255, 255, 255, 255], o);
    }
  return encodePng(w, h, px);
}

describe('specs and prompt', () => {
  it('the project specs are consistent', () => {
    expect(specProblems()).toEqual([]);
    expect(artSpecs.length).toBeGreaterThanOrEqual(9);
  });
  it('the style guide asks for realistic photography and Lila\'s poses are those of a real animal', () => {
    expect(artStyle.summary).toMatch(/^Photographie réaliste/);
    expect(artStyle.never.join(' ')).toMatch(/dessin animé/);
    for (const id of ['lila.idle', 'lila.happy', 'lila.thinking']) {
      const s = getArtSpec(id) as ArtSpec;
      expect(s.brief).toMatch(/quatre pattes/);
      expect(s.mustNot.join(' ')).toMatch(/posture humaine/);
    }
    expect(buildPrompt(artStyle, getArtSpec('lila.idle') as ArtSpec)).toMatch(/^Photographie d’un vrai animal/);
  });
  it('game pieces that used to be an icon or a code drawing have a spec', () => {
    for (const id of ['pond.water', 'pond.lilypad', 'pond.frog', 'pond.fish', 'train.locomotive', 'train.wagon']) {
      const s = getArtSpec(id) as ArtSpec;
      expect(s, id).toBeTruthy();
      expect(s.transparent, id).toBe(true);
    }
    // drawn by code: without an approved photo, the game keeps the drawing; the fallback only illustrates the spec
    expect(artSpecs.filter((s) => s.drawnByCode).map((s) => s.id).sort()).toEqual(['domino.tile', 'hidden.sheet', 'path.stone', 'pond.lilypad', 'pond.water', 'train.wagon']);
    expect(getArtSpec('path.basket')?.fallback).toBe('/art/basket.png');
    expect(getArtSpec('pond.frog')?.fallback).toBe('/art/frog.png');
  });
  it('victory clip: its own spec, prompt without sound and looping', () => {
    const s = getArtSpec('lila.dance') as ArtSpec;
    expect(s.kind).toBe('clip');
    const p = buildPrompt(artStyle, s);
    expect(p).toMatch(/^Clip vidéo/);
    expect(p).toContain('sans son');
    expect(p).toContain('en boucle');
    expect(specProblems(artSpecs.map((x) => (x.id === s.id ? { ...s, transparent: true } : x)))).toEqual(['lila.dance : un clip ne peut avoir ni grille, ni transparence, ni dessin par code']);
  });
  it('recognizes video by content, not by extension', () => {
    const pad = new Uint8Array(64);
    const mp4 = new Uint8Array([0, 0, 0, 32, ...new TextEncoder().encode('ftypmp42'), ...pad]);
    const heic = new Uint8Array([0, 0, 0, 32, ...new TextEncoder().encode('ftypheic'), ...pad]);
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84, ...new TextEncoder().encode('webm'), ...pad]);
    const mkv = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x88, ...new TextEncoder().encode('matroska'), ...pad]);
    expect(sniffVideo(mp4)?.mime).toBe('video/mp4');
    expect(sniffVideo(webm)?.mime).toBe('video/webm');
    expect(sniffVideo(heic)).toBeNull();
    expect(sniffVideo(mkv)).toBeNull();
    expect(sniffVideo(blob(64, 64))).toBeNull();
  });
  it('detects an invalid spec', () => {
    const bad = { ...crate, id: 'Crate', size: [1000, 300] as [number, number], reference: 'does.not.exist' };
    expect(specProblems([bad]).length).toBe(3);
  });
  it('the default prompt carries style, subject and prohibitions, and never child data', () => {
    const p = buildPrompt(artStyle, crate);
    expect(p).toContain(crate.brief);
    expect(p).toContain('fond entièrement transparent');
    expect(p).toContain('filigrane');
    expect(p).not.toMatch(/Melina/i);
    expect(buildPrompt(artStyle, getArtSpec('lila.happy') as ArtSpec)).toContain('image de référence');
  });
});

describe('PNG without native libraries', () => {
  it('writes and reads back the same pixels', () => {
    const png = blob(64, 48);
    const px = decodePng(png);
    expect(px && [px.width, px.height, px.hasAlphaChannel]).toEqual([64, 48, true]);
    expect(px?.data[(24 * 64 + 32) * 4 + 3]).toBe(255);
    expect(px?.data[3]).toBe(0);
  });
  it('measures transparency, corners and margins', () => {
    const st = alphaStats(decodePng(blob(100, 100)) as NonNullable<ReturnType<typeof decodePng>>);
    expect(st.cornersTransparent).toBe(true);
    expect(st.transparent).toBeGreaterThan(0.5);
    expect(Math.min(...st.margins)).toBeGreaterThan(0.15);
  });
  it('refuses what is not a PNG', () => {
    expect(decodePng(new Uint8Array(200))).toBeNull();
  });
  it('the preview for Claude is small and has no transparency', () => {
    const small = decodePng(reviewPreview(blob(1536, 864)) as Uint8Array);
    expect(small && Math.max(small.width, small.height)).toBeLessThanOrEqual(768);
    expect(small?.data[3]).toBe(255);
  });
});

describe('technical check', () => {
  const size = crate.size;
  it('approves an isolated object with a transparent background', () => {
    const r = techCheck(crate, blob(size[0] / 4, size[1] / 4), sniff(size[0], size[1]), 8e6);
    expect(r.ok).toBe(true);
  });
  it('rejects an opaque background when the spec asks for transparency', () => {
    const r = techCheck(crate, blob(384, 216, true), sniff(1536, 864), 8e6);
    expect(r.ok).toBe(false);
    expect(r.checks.find((c) => c.id === 'alpha')?.ok).toBe(false);
  });
  it('rejects an object that touches the edge', () => {
    const r = techCheck(crate, blob(384, 216, false, true), sniff(1536, 864), 8e6);
    expect(r.checks.find((c) => c.id === 'margins')?.ok).toBe(false);
  });
  it('rejects wrong proportions, a file that is too large and content that is not an image', () => {
    expect(techCheck(crate, blob(200, 200), sniff(1024, 1024), 8e6).checks.find((c) => c.id === 'ratio')?.ok).toBe(false);
    expect(techCheck(crate, blob(384, 216), sniff(1536, 864), 10).checks.find((c) => c.id === 'bytes')?.ok).toBe(false);
    expect(techCheck(crate, new Uint8Array(50), null, 8e6).ok).toBe(false);
  });
  it('a background must be opaque', () => {
    expect(techCheck(bg, blob(384, 216, true), sniff(1536, 864), 8e6).ok).toBe(true);
    expect(techCheck(bg, blob(384, 216), sniff(1536, 864), 8e6).ok).toBe(false);
  });
});

describe('providers', () => {
  it('simulated: returns PNGs of the requested size; the third one is deliberately defective', async () => {
    const res = await mockProvider().generate({ prompt: 'caisse en bois', size: [256, 144], transparent: true, references: [], n: 3, quality: 'medium' });
    expect(res.images).toHaveLength(3);
    const small = { ...crate, size: [256, 144] as [number, number] };
    const reports = res.images.map((i) => techCheck(small, i.data, sniff(256, 144), 8e6).ok);
    expect(reports).toEqual([true, true, false]);
  });

  it('OpenAI: simple generation sends JSON with a transparent background and reads b64_json', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const png = Buffer.from(blob(32, 32)).toString('base64');
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: [{ b64_json: png }, { b64_json: png }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = openaiProvider({ apiKey: 'k-image', model: 'model-x', fetchImpl });
    const res = await p.generate({ prompt: 'an apple', size: [1024, 1024], transparent: true, references: [], n: 2, quality: 'medium' });
    expect(res.images).toHaveLength(2);
    expect(calls[0]?.url).toBe('https://api.openai.com/v1/images/generations');
    const sent = JSON.parse(String(calls[0]?.init.body));
    expect(sent).toMatchObject({ model: 'model-x', prompt: 'an apple', n: 2, size: '1024x1024', background: 'transparent', output_format: 'png', quality: 'medium' });
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer k-image');
  });

  it('OpenAI: with a reference image it uses the edits route with a form', async () => {
    let url = '';
    let form: FormData | undefined;
    const fetchImpl = (async (u: string, init: RequestInit) => {
      url = u;
      form = init.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from(blob(16, 16)).toString('base64') }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await openaiProvider({ apiKey: 'k', model: 'm', fetchImpl }).generate({ prompt: 'same character', size: [1024, 1024], transparent: true, references: [{ mime: 'image/png', data: blob(16, 16) }], n: 1, quality: 'low' });
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(form?.get('background')).toBe('transparent');
    expect(form?.getAll('image[]')).toHaveLength(1);
  });

  it('OpenAI: errors become clear messages, with no silent retry', async () => {
    const mk = (status: number, body = '{}') => openaiProvider({ apiKey: 'k', model: 'm', fetchImpl: (async () => new Response(body, { status })) as unknown as typeof fetch });
    const req = { prompt: 'x', size: [1024, 1024] as [number, number], transparent: false, references: [], n: 1, quality: 'low' };
    await expect(mk(401).generate(req)).rejects.toMatchObject({ code: 'invalid-key' });
    await expect(mk(429).generate(req)).rejects.toMatchObject({ code: 'rate-limited' });
    await expect(mk(400, JSON.stringify({ error: { message: 'content policy' } })).generate(req)).rejects.toThrow(/content policy/);
    await expect(mk(200, '{"data":[]}').generate(req)).rejects.toMatchObject({ code: 'malformed' });
    await expect(openaiProvider({ apiKey: '', model: 'm' }).generate(req)).rejects.toMatchObject({ code: 'no-key' });
  });

  it('OpenAI: no credit, unverified organization and safety filter have their own messages', async () => {
    const mk = (status: number, body: unknown) => openaiProvider({ apiKey: 'k', model: 'm', fetchImpl: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch });
    const req = { prompt: 'x', size: [1024, 1024] as [number, number], transparent: true, references: [], n: 1, quality: 'low' };
    await expect(mk(429, { error: { code: 'credit_balance_exhausted', message: 'no credit' } }).generate(req)).rejects.toThrow(/Plus de crédit/);
    await expect(mk(429, { error: { code: 'rate_limit_exceeded' } }).generate(req)).rejects.toThrow(/Réessayez plus tard/);
    await expect(mk(403, { error: { message: 'Your organization must be verified to use the model' } }).generate(req)).rejects.toThrow(/organisation a été vérifiée/);
    await expect(mk(400, { error: { code: 'moderation_blocked', type: 'image_generation_user_error' } }).generate(req)).rejects.toThrow(/filtre de sécurité/);
  });
});

describe('Claude: review and prompt drafting', () => {
  const ok = { subject_matches: true, composition_ok: true, has_text_or_watermark: false, cropped_or_cut: false, child_appropriate: true, style_matches: true, verdict: 'approve', problems: [] };
  const reply = (content: unknown) => (async () => new Response(JSON.stringify({ content }), { status: 200 })) as unknown as typeof fetch;

  it('reads the structured verdict and does not force the tool (current models refuse)', async () => {
    let sent: Record<string, unknown> = {};
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'report_art_review', input: { ...ok, verdict: 'reject', problems: ['has text'] } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await reviewCandidate({ apiKey: 'k', model: 'm', style: artStyle, spec: crate, image: { mime: 'image/png', data: blob(8, 8) }, reference: { mime: 'image/png', data: blob(8, 8) }, fetchImpl });
    expect(r.verdict).toBe('reject');
    expect(r.problems).toEqual(['has text']);
    expect(sent.tool_choice).toEqual({ type: 'auto' });
    const content = (sent.messages as Array<{ content: Array<{ type: string }> }>)[0]?.content ?? [];
    expect(content.filter((c) => c.type === 'image')).toHaveLength(2);
    expect(JSON.stringify(sent)).not.toMatch(/Melina/i);
  });
  it('a response in the wrong format is an error, not an approval', async () => {
    await expect(reviewCandidate({ apiKey: 'k', model: 'm', style: artStyle, spec: crate, image: { mime: 'image/png', data: blob(8, 8) }, fetchImpl: reply([{ type: 'text', text: 'looks good' }]) })).rejects.toMatchObject({ code: 'malformed' });
    await expect(reviewCandidate({ apiKey: '', model: 'm', style: artStyle, spec: crate, image: { mime: 'image/png', data: blob(8, 8) } })).rejects.toMatchObject({ code: 'no-key' });
  });
  it('asks for room for the model\'s «thinking» and explains when the response is cut off', async () => {
    let sent: { max_tokens?: number } = {};
    const capture = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'thinking' }, { type: 'tool_use', name: 'report_art_review', input: { ...ok, problems: undefined } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(reviewCandidate({ apiKey: 'k', model: 'm', style: artStyle, spec: crate, image: { mime: 'image/png', data: blob(8, 8) }, fetchImpl: capture })).rejects.toThrow(/coupée/);
    expect(sent.max_tokens).toBeGreaterThanOrEqual(2000);
  });
  it('drafts the prompt as text', async () => {
    const text = 'A wide, empty light-wood fruit crate seen from above, straw bottom, thick rounded edges, soft morning light.';
    expect(await writePrompt({ apiKey: 'k', model: 'm', style: artStyle, spec: crate, base: buildPrompt(artStyle, crate), fetchImpl: reply([{ type: 'text', text }]) })).toBe(text);
    await expect(writePrompt({ apiKey: 'k', model: 'm', style: artStyle, spec: crate, base: 'x', fetchImpl: reply([{ type: 'text', text: 'ok' }]) })).rejects.toMatchObject({ code: 'malformed' });
  });
});
