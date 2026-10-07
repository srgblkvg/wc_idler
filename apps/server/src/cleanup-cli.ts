import { createPool } from './db.js';

const pool = createPool();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const sessions = await client.query('DELETE FROM guest_sessions WHERE expires_at <= now()');
  // Guest sessions have a fixed 30-day lifetime. Old receipts can be retired
  // without deleting saved characters or touching live sessions.
  const receipts = await client.query(
    "DELETE FROM action_receipts WHERE created_at < now() - interval '30 days'",
  );
  await client.query('COMMIT');
  console.log(
    `Removed ${sessions.rowCount} expired sessions and ${receipts.rowCount} old action receipts.`,
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
