import { fileURLToPath } from 'node:url';
import { buildApp } from './app.js';
import { createPool } from './db.js';
import { migrate } from './migrate.js';

if (process.env.NODE_ENV === 'production' && !process.env.APP_ORIGIN) {
  throw new Error('APP_ORIGIN is required in production (the public HTTPS game origin).');
}
const pool = createPool();
pool.on('error', (error) => console.error('PostgreSQL pool error:', error.message));
const app = buildApp({
  pool,
  logger: true,
  clientDirectory:
    process.env.SERVE_CLIENT === 'true'
      ? fileURLToPath(new URL('../../web/dist/', import.meta.url))
      : undefined,
});
try {
  if (process.env.MIGRATE_ON_START !== 'false') await migrate(pool);
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  await app.close();
  await pool.end();
  process.exitCode = 1;
}

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await app.close();
  await pool.end();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
