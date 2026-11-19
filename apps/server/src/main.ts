import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { buildApp } from './app';
import { createBackup } from './backup';
import { loadConfig } from './config';
import { openDatabase, pendingMigrations } from './db';
import { bootstrap, type Ctx } from './service';

/**
 * Opens the app in the browser (only when iniciar.bat asks for it, with MELINA_OPEN_BROWSER=1).
 * On Windows it prefers Microsoft Edge in its own window, because only Edge has the natural
 * Canadian French voice. With MELINA_BROWSER=default in .env, it uses the default browser.
 */
function findEdge(): string | null {
  if (process.platform !== 'win32' || (process.env.MELINA_BROWSER ?? '').toLowerCase() === 'default') return null;
  const roots = [process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter((r): r is string => Boolean(r));
  for (const r of roots) {
    const exe = join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    if (existsSync(exe)) return exe;
  }
  return null;
}

function openBrowser(url: string) {
  if (process.env.MELINA_OPEN_BROWSER !== '1') return;
  const openDefault = () => {
    try {
      const child =
        process.platform === 'win32'
          ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true })
          : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
      child.on('error', () => undefined);
      child.unref();
    } catch {
      /* if it does not open by itself, the address is printed in the window */
    }
  };
  const edge = findEdge();
  if (!edge) return openDefault();
  try {
    const child = spawn(edge, [`--app=${url}`, '--start-maximized'], { detached: true, stdio: 'ignore' });
    child.on('error', openDefault);
    child.unref();
  } catch {
    openDefault();
  }
}

async function alreadyRunning(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) });
    const body = (await res.json()) as { app?: string };
    return body.app === 'melina';
  } catch {
    return false;
  }
}

/**
 * Exclusive lock in the data folder (data/melina.lock with the process id): two quick clicks on
 * iniciar.bat can both see the port free at the same time, but only one can create the lock. A lock from a process
 * that no longer exists (window force-closed) is stale and is removed.
 */
function acquireLock(dataDir: string): boolean {
  const file = join(dataDir, 'melina.lock');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(file, 'wx');
      writeSync(fd, String(process.pid));
      closeSync(fd);
      process.on('exit', () => {
        try {
          if (readFileSync(file, 'utf8') === String(process.pid)) unlinkSync(file);
        } catch {
          /* already removed */
        }
      });
      return true;
    } catch (e) {
      if ((e as { code?: string }).code !== 'EEXIST') throw e;
      let pid = 0;
      try {
        pid = Number(readFileSync(file, 'utf8'));
      } catch {
        /* lock vanished in the meantime: try again */
      }
      // the lock only guards the seconds of STARTUP (afterwards the busy port does the guarding): older than 60 s,
      // it is stale even if the process id looks alive (Windows reuses process ids)
      let age = Infinity;
      try {
        age = Date.now() - statSync(file).mtimeMs;
      } catch {
        /* gone */
      }
      let alive = false;
      if (age < 60_000 && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, 0);
          alive = true;
        } catch (err) {
          alive = (err as { code?: string }).code === 'EPERM';
        }
      }
      if (alive) return false;
      try {
        unlinkSync(file); // stale lock
      } catch {
        /* another process removed it first */
      }
    }
  }
  return false;
}

/** Is the port free? (opens and closes a probe server, without touching anything of the app) */
function portFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.listen({ port, host }, () => srv.close(() => resolve(true)));
  });
}

async function main() {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 13)) {
    console.error(`Cette application nécessite Node.js 22.13 ou plus récent (version trouvée : ${process.versions.node}).`);
    process.exit(1);
  }

  const cfg = loadConfig();
  const url = `http://127.0.0.1:${cfg.port}`;
  // BEFORE touching the database and the photos: if the game is already open (double click on iniciar.bat), just open the browser.
  // Otherwise a 2nd instance would migrate the database under the 1st one and delete uploads in progress (photos/tmp).
  if (!(await portFree(cfg.port, cfg.host))) {
    if (await alreadyRunning(url)) {
      console.log(`L’application est déjà ouverte dans une autre fenêtre. Ouverture de ${url} dans le navigateur...`);
      openBrowser(url);
      process.exit(0);
    }
    console.error(`Le port ${cfg.port} est utilisé par un autre programme. Modifiez PORT dans le fichier .env (par exemple, PORT=3002) et rouvrez l’application.`);
    process.exit(1);
  }
  mkdirSync(cfg.dataDir, { recursive: true });
  // another instance is starting RIGHT NOW (double click): wait for it to open and just show the browser
  if (!acquireLock(cfg.dataDir)) {
    for (let i = 0; i < 20; i++) {
      if (await alreadyRunning(url)) {
        console.log(`L’application est déjà ouverte dans une autre fenêtre. Ouverture de ${url} dans le navigateur...`);
        openBrowser(url);
        process.exit(0);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    console.error(`Une autre fenêtre du jeu est en train de démarrer. Attendez une minute et rouvrez l’application (au besoin, supprimez le fichier ${join(cfg.dataDir, 'melina.lock')}).`);
    process.exit(1);
  }
  const dbFile = join(cfg.dataDir, 'melina.db');

  // Automatic backup before applying migrations to an existing database.
  if (existsSync(dbFile)) {
    const probe = new DatabaseSync(dbFile);
    let pending = 0;
    let hasSchema = false;
    try {
      const t = probe.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
      if (t) {
        hasSchema = Boolean((probe.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null }).v);
        pending = pendingMigrations(probe);
      }
    } finally {
      probe.close();
    }
    if (hasSchema && pending > 0) {
      const tmp = new DatabaseSync(dbFile);
      createBackup({ db: tmp, cfg, now: () => new Date() }, 'pre-migration'); // older backups on disk may still be named «pre-migracao»; listBackups accepts any label
      tmp.close();
    }
  }

  const db = openDatabase(dbFile);
  const ctx: Ctx = { db, cfg, now: () => new Date() };
  bootstrap(ctx);
  const app = await buildApp(ctx);
  try {
    await app.listen({ port: cfg.port, host: cfg.host });
  } catch (e) {
    db.close();
    if ((e as { code?: string }).code === 'EADDRINUSE') {
      if (await alreadyRunning(url)) {
        console.log(`L’application est déjà ouverte dans une autre fenêtre. Ouverture de ${url} dans le navigateur...`);
        openBrowser(url);
        process.exit(0);
      }
      console.error(`Le port ${cfg.port} est utilisé par un autre programme. Modifiez PORT dans le fichier .env (par exemple, PORT=3002) et rouvrez l’application.`);
      process.exit(1);
    }
    throw e;
  }

  console.log('');
  console.log('  Le jardin de Melina est en marche.');
  console.log(`  Ouvrez dans le navigateur : ${url}`);
  console.log(`  Données dans : ${cfg.dataDir}`);
  console.log(`  IA (Claude) : ${cfg.apiKey ? 'clé configurée' : 'aucune clé — transcription manuelle'}`);
  if (!cfg.staticDir) console.log('  Interface non compilée : le dossier apps/game/dist est manquant.');
  console.log('  Pour quitter : fermez cette fenêtre ou appuyez sur Ctrl+C.');
  openBrowser(url);

  const stop = async () => {
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop); // «fermez cette fenêtre» (Windows): shuts down cleanly and releases the lock
}

main().catch((e) => {
  console.error('Échec du démarrage :', (e as Error).message);
  process.exit(1);
});
