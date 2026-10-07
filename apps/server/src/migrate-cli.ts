import { createPool } from './db.js';
import { migrate } from './migrate.js';

const pool = createPool();
try {
  await migrate(pool);
  console.log('PostgreSQL migrations applied.');
} finally {
  await pool.end();
}
