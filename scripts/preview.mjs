import { spawn } from 'node:child_process';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  loadEnvFile(new URL('../.env', import.meta.url));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const port = '4173';
console.log(`\nИгра с PostgreSQL: http://localhost:${port}\nДля остановки нажмите Ctrl+C.\n`);
const child = spawn(
  process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['run', 'start', '-w', '@azeroth/server'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: port,
      HOST: '127.0.0.1',
      APP_ORIGIN: `http://localhost:${port}`,
      SERVE_CLIENT: 'true',
      NODE_ENV: 'development',
    },
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
