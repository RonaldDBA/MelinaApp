// SIMULATED tests: no real API call is made here.
import { describe, expect, it } from 'vitest';
import { buildMessages, readHandwriting, ReadingError } from './index';

const img = { mime: 'image/jpeg', base64: 'AAAA' };
const okBody = (input: unknown) =>
  JSON.stringify({ content: [{ type: 'tool_use', name: 'report_transcription', input }] });

function fakeFetch(responses: Array<{ status: number; body: string } | Error>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift();
    if (!r) throw new Error('no response');
    if (r instanceof Error) throw r;
    return new Response(r.body, { status: r.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('reading with Claude (simulated)', () => {
  it('does not send the expected answer and includes confirmed samples', () => {
    const msgs = buildMessages({ image: img, readingHint: 'un nombre écrit en chiffres', samples: [{ mime: 'image/png', base64: 'BBBB', transcription: '89' }] });
    const text = JSON.stringify(msgs);
    expect(text).toContain('89');
    expect(text).toContain('un nombre écrit en chiffres');
    expect(msgs[0]?.content.filter((c) => c.type === 'image')).toHaveLength(2);
  });

  it('validates the returned structure', async () => {
    const { impl, calls } = fakeFetch([{ status: 200, body: okBody({ transcription: ' 47 ', uncertain: ['4 ou 9'], confidence: 'medium', illegible: false }) }]);
    const r = await readHandwriting({ apiKey: 'k', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl });
    expect(r).toMatchObject({ transcription: '47', uncertain: ['4 ou 9'], confidence: 'medium', model: 'm' });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('k');
    expect(JSON.parse(String(calls[0]?.init.body)).tool_choice).toEqual({ type: 'auto' });
  });

  it('leaves room for the model\'s «thinking»; a cut-off response is worth another try', async () => {
    const cut = JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'thinking' }, { type: 'tool_use', name: 'report_transcription', input: { transcription: '4' } }] });
    const { impl, calls } = fakeFetch([
      { status: 200, body: cut },
      { status: 200, body: okBody({ transcription: '47', uncertain: [], confidence: 'high', illegible: false }) },
    ]);
    const r = await readHandwriting({ apiKey: 'k', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl });
    expect(r.transcription).toBe('47'); // the half answer «4» is never accepted
    expect(calls).toHaveLength(2);
    expect(JSON.parse(String(calls[0]?.init.body)).max_tokens).toBeGreaterThanOrEqual(2000);
  });

  it('rejects a malformed response', async () => {
    const { impl } = fakeFetch([{ status: 200, body: okBody({ transcription: 47, confidence: 'x' }) }]);
    await expect(readHandwriting({ apiKey: 'k', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl })).rejects.toMatchObject({ code: 'malformed' });
    const { impl: impl2 } = fakeFetch([{ status: 200, body: 'not json' }]);
    await expect(readHandwriting({ apiKey: 'k', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl2 })).rejects.toMatchObject({ code: 'malformed' });
  });

  it('an invalid credential is not retried', async () => {
    const { impl, calls } = fakeFetch([{ status: 401, body: '{}' }, { status: 200, body: '{}' }]);
    await expect(readHandwriting({ apiKey: 'k', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl })).rejects.toMatchObject({ code: 'invalid-key' });
    expect(calls).toHaveLength(1);
  });

  it('unavailability is retried once and then fails in a recoverable way', async () => {
    const { impl, calls } = fakeFetch([{ status: 529, body: '{}' }, { status: 529, body: '{}' }]);
    const p = readHandwriting({ apiKey: 'k', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl, maxRetries: 1 });
    await expect(p).rejects.toBeInstanceOf(ReadingError);
    expect(calls).toHaveLength(2);
  });

  it('no connection becomes a network error', async () => {
    const { impl } = fakeFetch([new TypeError('fetch failed')]);
    await expect(readHandwriting({ apiKey: 'k', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl, maxRetries: 0 })).rejects.toMatchObject({ code: 'network' });
  });

  it('without a key the API is not called', async () => {
    const { impl, calls } = fakeFetch([]);
    await expect(readHandwriting({ apiKey: '', model: 'm', image: img, readingHint: 'x', samples: [], fetchImpl: impl })).rejects.toMatchObject({ code: 'no-key' });
    expect(calls).toHaveLength(0);
  });
});
