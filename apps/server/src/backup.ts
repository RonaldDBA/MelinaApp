import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ctx } from './service';
import { photosDir } from './service';

/**
 * Consistent backup: `VACUUM INTO` produces an intact copy of the database even with WAL active.
 * Includes the referenced photos. Does NOT include the .env file (API key).
 */
export function createBackup(c: Ctx, label = 'manual') {
  const stamp = c.now().toISOString().replace(/[:.]/g, '-');
  const dir = join(c.cfg.dataDir, 'backups', `backup-${stamp}-${label.replace(/[^a-z0-9-]/gi, '')}`);
  mkdirSync(join(dir, 'photos'), { recursive: true });
  const dbFile = join(dir, 'melina.db');
  c.db.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
  const files = (c.db.prepare('SELECT file_name FROM photos WHERE deleted_at IS NULL').all() as Array<{ file_name: string }>).map((r) => r.file_name);
  let copied = 0;
  const missing: string[] = [];
  for (const f of files) {
    const src = join(photosDir(c), f);
    if (existsSync(src)) {
      copyFileSync(src, join(dir, 'photos', f));
      copied++;
    } else missing.push(f);
  }
  const manifest = {
    createdAt: c.now().toISOString(),
    label,
    database: 'melina.db',
    photos: copied,
    missingPhotos: missing,
    excluded: ['.env (clé de l’API)'],
    restore: 'Fermez l’application. Copiez melina.db vers data/melina.db et le dossier photos vers data/photos. Rouvrez ensuite l’application.',
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { folder: dir, ...manifest };
}

export function listBackups(c: Ctx) {
  const root = join(c.cfg.dataDir, 'backups');
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((d) => d.startsWith('backup-'))
    .map((d) => ({ name: d, createdAt: statSync(join(root, d)).mtime.toISOString() }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
