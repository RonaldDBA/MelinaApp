import { alphaStats, decodePng, encodePng, isPng } from './png';
import type { ArtSpec } from './specs';

/** Technical check of a candidate, without AI. `ok: null` means «could not be checked». */
export interface TechCheck {
  id: string;
  label: string;
  ok: boolean | null;
  detail: string;
}

export interface TechReport {
  ok: boolean;
  width: number;
  height: number;
  checks: TechCheck[];
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

export function techCheck(spec: ArtSpec, data: Uint8Array, info: { mime: string; width: number; height: number } | null, maxBytes: number): TechReport {
  const checks: TechCheck[] = [];
  if (!info) return { ok: false, width: 0, height: 0, checks: [{ id: 'format', label: 'Fichier d’image valide', ok: false, detail: 'Le contenu n’est ni PNG, ni JPEG, ni WebP.' }] };
  checks.push({ id: 'format', label: 'Fichier d’image valide', ok: true, detail: `${info.mime.replace('image/', '').toUpperCase()}, ${info.width}×${info.height}` });
  checks.push({ id: 'bytes', label: 'Taille du fichier', ok: data.length <= maxBytes, detail: `${(data.length / 1024 / 1024).toFixed(2).replace('.', ',')} Mo` });

  const want = spec.size[0] / spec.size[1];
  const got = info.width / info.height;
  checks.push({ id: 'ratio', label: 'Proportions demandées', ok: Math.abs(got - want) / want <= 0.05, detail: `demandé ${spec.size[0]}×${spec.size[1]}, reçu ${info.width}×${info.height}` });
  checks.push({ id: 'resolution', label: 'Résolution suffisante', ok: info.width >= spec.size[0] * 0.5, detail: `${info.width} pixels de largeur` });

  const px = isPng(data) ? decodePng(data) : null;
  if (!px) {
    checks.push({ id: 'alpha', label: spec.transparent ? 'Fond vraiment transparent' : 'Image sans transparence', ok: null, detail: 'Ce format n’a pas pu être lu ici; vérifiez à l’œil.' });
  } else {
    const st = alphaStats(px);
    if (spec.transparent) {
      checks.push({
        id: 'alpha',
        label: 'Fond vraiment transparent',
        ok: px.hasAlphaChannel && st.cornersTransparent && st.transparent >= 0.08,
        detail: !px.hasAlphaChannel ? 'Le fichier n’a pas de canal de transparence.' : `${pct(st.transparent)} de l’image est transparente; coins ${st.cornersTransparent ? 'libres' : 'occupés'}`,
      });
      checks.push({ id: 'content', label: 'Un objet est visible', ok: st.opaque >= 0.04, detail: `${pct(st.opaque)} de l’image est occupée` });
      const min = Math.min(...st.margins);
      checks.push({ id: 'margins', label: 'Objet entier, sans toucher le bord', ok: min >= 0.004, detail: `plus petite marge : ${(min * 100).toFixed(1).replace('.', ',')} %` });
    } else {
      checks.push({ id: 'alpha', label: 'Image sans transparence', ok: st.transparent < 0.01, detail: `${pct(st.transparent)} transparente` });
    }
  }
  return { ok: checks.every((c) => c.ok !== false), width: info.width, height: info.height, checks };
}

/**
 * Small version of a PNG without transparency (light background), to send to Claude for review.
 * Returns null when the PNG could not be read.
 */
export function reviewPreview(data: Uint8Array, maxSide = 768): Uint8Array | null {
  const px = decodePng(data);
  if (!px) return null;
  const k = Math.max(1, Math.ceil(Math.max(px.width, px.height) / maxSide));
  const w = Math.floor(px.width / k);
  const h = Math.floor(px.height / k);
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const o = ((y * k + dy) * px.width + x * k + dx) * 4;
          const a = (px.data[o + 3] as number) / 255;
          // composites over a very light grey: the silhouette of white objects stays visible
          r += (px.data[o] as number) * a + 236 * (1 - a);
          g += (px.data[o + 1] as number) * a + 240 * (1 - a);
          b += (px.data[o + 2] as number) * a + 244 * (1 - a);
        }
      }
      const o = (y * w + x) * 4;
      const n = k * k;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = 255;
    }
  }
  return encodePng(w, h, out);
}
