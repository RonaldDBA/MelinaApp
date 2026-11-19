import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { selectSamples, sniffImage, stripMetadata, type SampleCandidate } from './index';

const fx = (n: string) => new Uint8Array(readFileSync(join(__dirname, '../../../tests/fixtures', n)));
const has = (buf: Uint8Array, text: string) => Buffer.from(buf).includes(Buffer.from(text, 'latin1'));

describe('images', () => {
  it('recognizes the real content, not the extension', () => {
    expect(sniffImage(fx('synthetic-47-gps.jpg'))).toMatchObject({ mime: 'image/jpeg', width: 420, height: 200 });
    expect(sniffImage(fx('synthetic-chats.png'))).toMatchObject({ mime: 'image/png', width: 520, height: 200 });
    expect(sniffImage(fx('synthetic-9.webp'))).toMatchObject({ mime: 'image/webp', width: 200, height: 200 });
    expect(sniffImage(fx('not-an-image.jpg'))).toBeNull();
  });

  it('removes EXIF/GPS from the JPEG while keeping the image valid', () => {
    const src = fx('synthetic-47-gps.jpg');
    expect(has(src, 'Exif')).toBe(true);
    expect(has(src, 'SyntheticCam')).toBe(true);
    const out = stripMetadata(src, 'image/jpeg');
    expect(has(out, 'Exif')).toBe(false);
    expect(has(out, 'SyntheticCam')).toBe(false);
    expect(sniffImage(out)).toMatchObject({ width: 420, height: 200 });
  });

  it('removes text chunks from the PNG and EXIF from the WebP', () => {
    const png = stripMetadata(fx('synthetic-chats.png'), 'image/png');
    expect(has(png, 'secret-location')).toBe(false);
    expect(sniffImage(png)?.mime).toBe('image/png');
    const webp = stripMetadata(fx('synthetic-9.webp'), 'image/webp');
    expect(has(webp, 'SyntheticCam')).toBe(false);
    expect(sniffImage(webp)?.mime).toBe('image/webp');
  });
});

describe('sample selection', () => {
  const s = (id: string, kind: SampleCandidate['kind'], t: string, q: 1 | 2 | 3, allow = true, skill: string | null = null): SampleCandidate => ({
    id,
    kind,
    transcription: t,
    quality: q,
    allowExternal: allow,
    skillId: skill,
    createdAt: `2026-11-${10 + Number(id.replace(/\D/g, '') || 0)}`,
  });
  const all = [
    s('n1', 'number', '47', 3),
    s('n2', 'number', '47', 3),
    s('n3', 'number', '89', 2),
    s('n4', 'number', '12', 1, false),
    s('w1', 'word', 'chats', 3),
  ];

  it('uses only the same kind, authorized ones, without duplicate transcriptions', () => {
    const r = selectSamples(all, { kind: 'number', max: 3, externalOnly: true });
    expect(r.map((x) => x.id)).toEqual(['n2', 'n3']);
    expect(r.every((x) => x.why.length > 0)).toBe(true);
  });

  it('respects the per-call limit', () => {
    expect(selectSamples(all, { kind: 'number', max: 1, externalOnly: true })).toHaveLength(1);
  });

  it('a deleted sample (not in the list) is no longer retrieved', () => {
    const r = selectSamples(all.filter((x) => x.id !== 'w1'), { kind: 'word', max: 3, externalOnly: true });
    expect(r).toHaveLength(0);
  });
});
