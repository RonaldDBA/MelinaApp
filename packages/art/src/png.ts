import { deflateSync, inflateSync } from 'node:zlib';

/**
 * PNG without native libraries: reading (8 bits, RGB or RGBA, not interlaced) to check
 * real transparency, and writing (RGBA) for the simulated provider.
 */
export interface Pixels {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel */
  data: Uint8Array;
  hasAlphaChannel: boolean;
}

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const isPng = (buf: Uint8Array) => buf.length > 33 && SIG.every((b, i) => buf[i] === b);

/** Returns null when the file is not a PNG this reader understands (16 bits, palette, interlaced). */
export function decodePng(buf: Uint8Array): Pixels | null {
  if (!isPng(buf)) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Uint8Array[] = [];
  while (pos + 12 <= buf.length) {
    const len = dv.getUint32(pos);
    const type = String.fromCharCode(buf[pos + 4] as number, buf[pos + 5] as number, buf[pos + 6] as number, buf[pos + 7] as number);
    const start = pos + 8;
    if (start + len > buf.length) return null;
    if (type === 'IHDR') {
      width = dv.getUint32(start);
      height = dv.getUint32(start + 4);
      const depth = buf[start + 8];
      colorType = buf[start + 9] as number;
      const interlace = buf[start + 12];
      if (depth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) return null;
      if (width <= 0 || height <= 0 || width > 8192 || height > 8192) return null;
    } else if (type === 'IDAT') idat.push(buf.subarray(start, start + len));
    else if (type === 'IEND') break;
    pos = start + len + 4;
  }
  if (colorType < 0 || idat.length === 0) return null;
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  let raw: Uint8Array;
  try {
    raw = inflateSync(Buffer.concat(idat), { maxOutputLength: (stride + 1) * height + 1024 });
  } catch {
    return null;
  }
  if (raw.length < (stride + 1) * height) return null;
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] as number;
    const off = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const v = raw[off + x] as number;
      const a = x >= bpp ? (line[x - bpp] as number) : 0;
      const b = prev[x] as number;
      const c = x >= bpp ? (prev[x - bpp] as number) : 0;
      let r: number;
      if (filter === 0) r = v;
      else if (filter === 1) r = v + a;
      else if (filter === 2) r = v + b;
      else if (filter === 3) r = v + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else return null;
      line[x] = r & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = line[x * bpp] as number;
      out[o + 1] = line[x * bpp + 1] as number;
      out[o + 2] = line[x * bpp + 2] as number;
      out[o + 3] = bpp === 4 ? (line[x * bpp + 3] as number) : 255;
    }
    prev.set(line);
  }
  return { width, height, data: out, hasAlphaChannel: colorType === 6 };
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = (crcTable[(c ^ (bytes[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const parts = [Uint8Array.from(SIG), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export interface AlphaStats {
  transparent: number; // fraction of fully transparent pixels
  opaque: number; // fraction of visible pixels
  cornersTransparent: boolean;
  /** free margin up to the edge, as a fraction of the size: [top, right, bottom, left] */
  margins: [number, number, number, number];
}

export function alphaStats(px: Pixels): AlphaStats {
  const { width: w, height: h, data } = px;
  let transparent = 0;
  let opaque = 0;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3] as number;
      if (a <= 8) transparent++;
      else {
        if (a >= 128) opaque++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const corner = (cx: number, cy: number) => {
    const n = Math.max(2, Math.round(Math.min(w, h) * 0.02));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((data[((cy ? h - 1 - y : y) * w + (cx ? w - 1 - x : x)) * 4 + 3] as number) > 8) return false;
    return true;
  };
  const total = w * h;
  return {
    transparent: transparent / total,
    opaque: opaque / total,
    cornersTransparent: corner(0, 0) && corner(1, 0) && corner(0, 1) && corner(1, 1),
    margins: x1 < 0 ? [1, 1, 1, 1] : [y0 / h, (w - 1 - x1) / w, (h - 1 - y1) / h, x0 / w],
  };
}
