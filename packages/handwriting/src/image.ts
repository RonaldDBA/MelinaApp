/**
 * Validation of the real content of images and removal of metadata (EXIF/XMP/GPS, text chunks),
 * without native dependencies. Rotation already arrives corrected by the interface (canvas);
 * here we remove everything that is not needed to display the image.
 */

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageInfo {
  mime: ImageMime;
  width: number;
  height: number;
}

export function sniffImage(buf: Uint8Array): ImageInfo | null {
  if (buf.length < 32) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    const dims = jpegDimensions(buf);
    return dims ? { mime: 'image/jpeg', ...dims } : null;
  }
  // PNG
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSig.every((b, i) => buf[i] === b)) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (ascii(buf, 12, 4) !== 'IHDR') return null;
    return { mime: 'image/png', width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  // WebP (RIFF....WEBP)
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 4) === 'WEBP') {
    const dims = webpDimensions(buf);
    return dims ? { mime: 'image/webp', ...dims } : null;
  }
  return null;
}

function ascii(buf: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = off; i < off + len && i < buf.length; i++) s += String.fromCharCode(buf[i] as number);
  return s;
}

function jpegDimensions(buf: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1] as number;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = ((buf[i + 2] as number) << 8) | (buf[i + 3] as number);
    // SOF0..SOF15 except DHT(C4), JPG(C8), DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = ((buf[i + 5] as number) << 8) | (buf[i + 6] as number);
      const width = ((buf[i + 7] as number) << 8) | (buf[i + 8] as number);
      return { width, height };
    }
    i += 2 + len;
  }
  return null;
}

function webpDimensions(buf: Uint8Array): { width: number; height: number } | null {
  const chunk = ascii(buf, 12, 4);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (chunk === 'VP8X') {
    const w = 1 + (dv.getUint8(24) | (dv.getUint8(25) << 8) | (dv.getUint8(26) << 16));
    const h = 1 + (dv.getUint8(27) | (dv.getUint8(28) << 8) | (dv.getUint8(29) << 16));
    return { width: w, height: h };
  }
  if (chunk === 'VP8 ') {
    return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    const b = dv.getUint32(21, true);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** Removes APP1..APP15 segments (EXIF, XMP, GPS, Photoshop) and comments from a JPEG. */
function stripJpeg(buf: Uint8Array): Uint8Array {
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) break;
    const marker = buf[i + 1] as number;
    if (marker === 0xda) {
      // start of the compressed data: copy the rest
      for (let j = i; j < buf.length; j++) out.push(buf[j] as number);
      return Uint8Array.from(out);
    }
    const len = ((buf[i + 2] as number) << 8) | (buf[i + 3] as number);
    const keep = !((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe);
    if (keep) for (let j = i; j < i + 2 + len && j < buf.length; j++) out.push(buf[j] as number);
    i += 2 + len;
  }
  return buf; // unexpected structure: return the original (validation has already been done)
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function stripPng(buf: Uint8Array): Uint8Array {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const parts: Uint8Array[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const len = dv.getUint32(i);
    const type = ascii(buf, i + 4, 4);
    const end = i + 12 + len;
    if (!PNG_DROP.has(type)) parts.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return concat(parts);
}

function stripWebp(buf: Uint8Array): Uint8Array {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const parts: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = ascii(buf, i, 4);
    const len = dv.getUint32(i + 4, true);
    const end = i + 8 + len + (len % 2);
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = Uint8Array.from(buf.subarray(i, Math.min(end, buf.length)));
      if (type === 'VP8X') chunk[8] = (chunk[8] ?? 0) & ~0x0c; // clears the EXIF/XMP flags
      parts.push(chunk);
    }
    i = end;
  }
  const body = concat(parts);
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46]);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  return concat([header, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function stripMetadata(buf: Uint8Array, mime: ImageMime): Uint8Array {
  if (mime === 'image/jpeg') return stripJpeg(buf);
  if (mime === 'image/png') return stripPng(buf);
  return stripWebp(buf);
}

export const imageLimits = {
  maxBytes: 8 * 1024 * 1024,
  maxSide: 6000,
  minSide: 32,
};
