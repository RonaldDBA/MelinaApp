/**
 * Clips (specs of kind «clip»): short video, no sound, looping. They come from packs in the
 * assets/packs-inbox folder and go through the parents' approval, like the images. The app does not generate video.
 *
 * The type is checked from the content, never from the extension. Sound never plays: the game always plays muted.
 */

export interface VideoInfo {
  mime: 'video/mp4' | 'video/webm';
}

export const videoLimits = {
  maxBytes: 40 * 1024 * 1024,
};

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to));

/** MP4 brands the browser can play. Excludes HEIC/AVIF, which also start with «ftyp» but are images. */
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'M4V ', 'mmp4']);

export function sniffVideo(buf: Uint8Array): VideoInfo | null {
  if (buf.length < 32) return null;
  if (ascii(buf, 4, 8) === 'ftyp' && MP4_BRANDS.has(ascii(buf, 8, 12))) return { mime: 'video/mp4' };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    // EBML header: the DocType must be «webm» (generic Matroska does not always play in the browser)
    if (ascii(buf, 0, Math.min(buf.length, 64)).includes('webm')) return { mime: 'video/webm' };
  }
  return null;
}
