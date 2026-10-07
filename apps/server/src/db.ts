import pg from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL): pg.Pool {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is required. Start PostgreSQL and configure the connection; there is no in-memory fallback.',
    );
  }
  return new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'azeroth-idle',
  });
}
