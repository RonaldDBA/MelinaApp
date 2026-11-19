import { useEffect, useState } from 'react';
import type { GridSpec } from '@melina/shared';
import data from '../../../../content/art/specs.json';

/**
 * Art catalogue. The game asks for art by logical name («orchard.crate»).
 * Until there is a version approved by the parents, the spec's built-in art is used.
 */
interface Entry {
  url: string;
  source: 'builtin' | 'generated' | 'pack';
  mime?: string;
  grid?: GridSpec;
}

const specs = data.specs as Array<{ id: string; fallback: string; grid?: GridSpec }>;
const builtin: Record<string, Entry> = Object.fromEntries(specs.map((s) => [s.id, { url: s.fallback, source: 'builtin' as const, grid: s.grid }]));

let catalog: Record<string, Entry> = builtin;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

export function loadArtCatalog(force = false): Promise<void> {
  if (loaded && !force) return loaded;
  loaded = fetch('/api/art/catalog')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((body: { items?: Record<string, Entry> }) => {
      catalog = { ...builtin, ...(body.items ?? {}) };
      listeners.forEach((fn) => fn());
    })
    .catch(() => {
      catalog = builtin; // no server or no catalogue: the built-in art always works
    });
  return loaded;
}

/**
 * URL of the art approved by the parents, or null when only the built-in art exists.
 * Used by the pieces drawn in code (pond, water lilies, wagons): without approved art, the drawing stays.
 */
export const approvedArt = (id: string): string | null => {
  const e = catalog[id];
  return e && e.source !== 'builtin' ? e.url : null;
};

/** Clip approved by the parents (video), or null. Without a clip, the current animation applies. */
export const approvedClip = (id: string): string | null => {
  const e = catalog[id];
  return e && e.source !== 'builtin' && e.mime?.startsWith('video/') ? e.url : null;
};

/** URL of the active art for a logical name. */
export const art = (id: string): string => catalog[id]?.url ?? builtin[id]?.url ?? `/art/${id}.png`;
export const artGrid = (id: string): GridSpec | undefined => catalog[id]?.grid ?? builtin[id]?.grid;
/** Icons and small objects from the built-in library. */
export const icon = (name: string): string => `/art/${name}.png`;

/** Re-renders the component when the catalogue arrives from the server. */
export function useArtCatalog(): void {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    void loadArtCatalog();
    return () => {
      listeners.delete(fn);
    };
  }, []);
}
