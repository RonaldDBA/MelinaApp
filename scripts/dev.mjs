// Development mode: server (port 3001) + Vite (port 5173) with a proxy for /api.
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
const run = (name, args) => {
  const p = spawn(isWin ? 'pnpm.cmd' : 'pnpm', args, { stdio: 'inherit', shell: isWin });
  p.on('exit', (code) => {
    console.log(`[${name}] exited (${code})`);
    process.exit(code ?? 0);
  });
  return p;
};
const server = run('server', ['--filter', '@melina/server', 'dev']);
const game = run('game', ['--filter', '@melina/game', 'dev']);
const stop = () => {
  server.kill();
  game.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
console.log('Abra http://127.0.0.1:5173 (desenvolvimento).');
