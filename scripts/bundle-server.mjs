// Builds apps/server/dist/server.mjs: the whole server in ONE file.
// This way the family's computer only needs Node.js — no pnpm and no "install".
import { build } from 'esbuild';

await build({
  entryPoints: ['apps/server/src/main.ts'],
  outfile: 'apps/server/dist/server.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'none',
  banner: {
    js: [
      "import { createRequire as __melinaCreateRequire } from 'node:module';",
      "import { fileURLToPath as __melinaFileURLToPath } from 'node:url';",
      "import { dirname as __melinaDirname } from 'node:path';",
      'const require = __melinaCreateRequire(import.meta.url);',
      'const __filename = __melinaFileURLToPath(import.meta.url);',
      'const __dirname = __melinaDirname(__filename);',
    ].join('\n'),
  },
});
console.log('Server bundled into apps/server/dist/server.mjs');
