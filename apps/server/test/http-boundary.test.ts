import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

describe('HTTP boundary rejects requests before touching PostgreSQL', () => {
  const pool = new pg.Pool();
  const connect = vi.spyOn(pool, 'connect');
  const app = buildApp({ pool, allowedOrigins: ['https://game.example'] });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it.each([undefined, 'https://attacker.example', 'null'])(
    'rejects absent or foreign Origin (%s)',
    async (origin) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/session',
        payload: {},
        headers: origin ? { origin } : {},
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe('CSRF_ORIGIN');
      expect(connect).not.toHaveBeenCalled();
    },
  );

  it('rejects cross-site fetch even with a permitted Origin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: {},
      headers: { origin: 'https://game.example', 'sec-fetch-site': 'cross-site' },
    });
    expect(response.statusCode).toBe(403);
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects client-injected player state and identity', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/game/action',
      headers: { origin: 'https://game.example' },
      payload: {
        idempotencyKey: randomUUID(),
        action: { type: 'rest' },
        playerId: randomUUID(),
        gold: 99_999,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('INVALID_REQUEST');
    expect(connect).not.toHaveBeenCalled();
  });

  it('requires a UUID idempotency key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/game/action',
      headers: { origin: 'https://game.example' },
      payload: { idempotencyKey: 'anything', action: { type: 'rest' } },
    });
    expect(response.statusCode).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects missing and malformed bearer cookies without a database query', async () => {
    for (const cookie of [undefined, 'wc_session=forged']) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/game',
        headers: cookie ? { cookie } : {},
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe('UNAUTHENTICATED');
    }
    expect(connect).not.toHaveBeenCalled();
  });

  it('keeps character creation schema strict', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: 'https://game.example' },
      payload: { name: 'Hero', level: 60 },
    });
    expect(response.statusCode).toBe(400);
    expect(connect).not.toHaveBeenCalled();
  });
});
