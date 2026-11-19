import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

export interface AppConfig {
  port: number;
  host: string;
  dataDir: string;
  apiKey: string;
  model: string;
  staticDir: string | null; // compiled frontend (same origin)
  imageProvider: string; // '' (off), 'openai' or 'mock' (test images)
  imageApiKey: string;
  imageModel: string;
  imageQuality: string;
  packsDir: string; // art packs downloaded by the parents
  devOrigins: string[];
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const envFile = resolve(repoRoot, '.env');
  if (existsSync(envFile) && !process.env.MELINA_SKIP_ENV_FILE) {
    try {
      process.loadEnvFile(envFile);
    } catch {
      // malformed .env file: continue without it (the AI will be unavailable)
    }
  }
  const dataDirRaw = process.env.DATA_DIR || './data';
  const dataDir = isAbsolute(dataDirRaw) ? dataDirRaw : resolve(repoRoot, dataDirRaw);
  const dist = resolve(repoRoot, 'apps/game/dist');
  const port = Number(process.env.PORT || 3001);
  return {
    port,
    host: '127.0.0.1', // local computer only
    dataDir,
    apiKey: (process.env.ANTHROPIC_API_KEY || '').trim(),
    model: (process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5').trim(),
    staticDir: existsSync(resolve(dist, 'index.html')) ? dist : null,
    imageProvider: (process.env.IMAGE_PROVIDER || '').trim().toLowerCase(),
    imageApiKey: (process.env.IMAGE_API_KEY || '').trim(),
    imageModel: (process.env.IMAGE_MODEL || 'gpt-image-2.5-sunburst').trim(),
    imageQuality: (process.env.IMAGE_QUALITY || 'medium').trim(),
    // PACKS_DIR exists so tests can use a temporary folder; the default is the app folder
    packsDir: process.env.PACKS_DIR ? resolve(repoRoot, process.env.PACKS_DIR) : resolve(repoRoot, 'assets/packs-inbox'),
    devOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    ...overrides,
  };
}
