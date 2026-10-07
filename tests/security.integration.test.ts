import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../apps/server/src/app.js';
import { migrate } from '../apps/server/src/migrate.js';
import { advancePlayer, applyAction, MAX_OFFLINE_MS } from '@azeroth/game';

const origin = 'http://localhost:5173';
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;

integration('authoritative API security with PostgreSQL', () => {
  const schema = `security_${randomUUID().replaceAll('-', '')}`;
  const now = Date.parse('2026-10-07T12:00:00Z');
  let admin: pg.Pool;
  let pool: pg.Pool;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    // Every run owns a distinct schema; never truncate application tables.
    admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    await migrate(pool);
    app = await buildApp({
      pool,
      now: () => now,
      allowedOrigins: [origin],
      secureCookies: false,
      logger: false,
    });
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  });

  async function guest(name = 'Tester') {
    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin },
      payload: { name },
    });
    expect(response.statusCode).toBe(201);
    const session = response.cookies.find((cookie) => cookie.name === 'wc_session');
    expect(session).toBeDefined();
    return { cookie: `wc_session=${session!.value}`, player: response.json().player, response };
  }

  async function action(
    cookie: string,
    intent: unknown,
    idempotencyKey = randomUUID(),
    headers: Record<string, string> = {},
  ) {
    return app.inject({
      method: 'POST',
      url: '/api/game/action',
      headers: { origin, cookie, ...headers },
      payload: { idempotencyKey, action: intent },
    });
  }

  it('keeps two guests isolated and stores only a cookie digest', async () => {
    const alice = await guest('Alice');
    const bob = await guest('Bob');
    expect(alice.player.id).not.toBe(bob.player.id);
    expect(alice.cookie).not.toBe(bob.cookie);
    expect(String(alice.response.headers['set-cookie'])).toMatch(/HttpOnly/i);
    expect(String(alice.response.headers['set-cookie'])).toMatch(/SameSite=Lax/i);
    const started = await action(alice.cookie, { type: 'startHunt', mobId: 'wolf' });
    expect(started.statusCode).toBe(200);
    const bobState = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: bob.cookie },
    });
    expect(bobState.json().player.name).toBe('Bob');
    expect(bobState.json().player.mode).toBe('idle');
    const stored = await pool.query('SELECT token_hash FROM guest_sessions WHERE player_id = $1', [
      alice.player.id,
    ]);
    expect(stored.rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.rows[0].token_hash).not.toBe(alice.cookie.split('=')[1]);
    const impersonation = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: `wc_session=${alice.player.id}` },
    });
    expect(impersonation.statusCode).toBe(401);
  });

  it('rejects absent and hostile origins before any mutation', async () => {
    const user = await guest();
    for (const maliciousOrigin of [
      'https://attacker.example',
      'http://localhost:5173.attacker.example',
      'null',
    ]) {
      const response = await action(
        user.cookie,
        { type: 'startHunt', mobId: 'wolf' },
        randomUUID(),
        { origin: maliciousOrigin },
      );
      expect(response.statusCode).toBe(403);
    }
    const absent = await app.inject({
      method: 'POST',
      url: '/api/game/action',
      headers: { cookie: user.cookie },
      payload: { idempotencyKey: randomUUID(), action: { type: 'rest' } },
    });
    expect(absent.statusCode).toBe(403);
    const sessionAttack = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin: 'https://attacker.example' },
      payload: { name: 'Attack' },
    });
    expect(sessionAttack.statusCode).toBe(403);
    const state = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(state.json().player.mode).toBe('idle');
  });

  it('rejects forged progression and arbitrary player selection', async () => {
    const user = await guest();
    const attacks = [
      { type: 'startHunt', mobId: 'wolf', xp: 999_999 },
      { type: 'rest', copper: 999_999 },
      { type: 'equip', itemInstanceId: 'unowned-item' },
      { type: 'startHunt', mobId: '__proto__' },
      { type: 'acceptQuest', questId: 'constructor' },
    ];
    for (const intent of attacks) expect((await action(user.cookie, intent)).statusCode).toBe(400);
    const selection = await app.inject({
      method: 'POST',
      url: '/api/game/action',
      headers: { origin, cookie: user.cookie },
      payload: { idempotencyKey: randomUUID(), playerId: randomUUID(), action: { type: 'rest' } },
    });
    expect(selection.statusCode).toBe(400);
    const state = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(state.json().player.xp).toBe(user.player.xp);
    expect(state.json().player.copper).toBe(user.player.copper);
  });

  it('serializes concurrent identical actions and rejects reuse for another intent', async () => {
    const user = await guest();
    const idempotencyKey = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        action(user.cookie, { type: 'acceptQuest', questId: 'wolves-at-the-gate' }, idempotencyKey),
      ),
    );
    expect(responses.map((response) => response.statusCode)).toEqual(Array(8).fill(200));
    for (const response of responses) expect(response.json()).toEqual(responses[0].json());
    const receipts = await pool.query(
      'SELECT count(*)::int AS count FROM action_receipts WHERE player_id = $1 AND idempotency_key = $2',
      [user.player.id, idempotencyKey],
    );
    expect(receipts.rows[0].count).toBe(1);
    const conflict = await action(user.cookie, { type: 'rest' }, idempotencyKey);
    expect(conflict.statusCode).toBe(409);
  });

  it('allows only one reward across concurrent turn-ins with distinct keys', async () => {
    const user = await guest();
    // Seed a legitimate finished objective inside this run's isolated schema.
    const read = await pool.query('SELECT state FROM players WHERE id = $1', [user.player.id]);
    const state = read.rows[0].state;
    state.quests = [{ questId: 'wolves-at-the-gate', kills: 8, status: 'active' }];
    await pool.query('UPDATE players SET state = $2::jsonb WHERE id = $1', [
      user.player.id,
      JSON.stringify(state),
    ]);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        action(user.cookie, { type: 'turnInQuest', questId: 'wolves-at-the-gate' }),
      ),
    );
    expect(results.filter((response) => response.statusCode === 200)).toHaveLength(1);
    expect(results.filter((response) => response.statusCode === 400)).toHaveLength(5);
    const final = await pool.query('SELECT state FROM players WHERE id = $1', [user.player.id]);
    expect(final.rows[0].state.copper).toBe(state.copper + 35);
    expect(
      final.rows[0].state.inventory.filter(
        (item: { itemId: string }) => item.itemId === 'militia-hammer',
      ),
    ).toHaveLength(1);
  });

  it('does not grant expired bearer sessions access', async () => {
    const user = await guest();
    await pool.query(
      "UPDATE guest_sessions SET expires_at = '2000-01-01T00:00:00Z' WHERE player_id = $1",
      [user.player.id],
    );
    const response = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(response.statusCode).toBe(401);
  });

  it('never exposes internal random state in session, polling, action, or replay DTOs', async () => {
    const user = await guest();
    const idempotencyKey = randomUUID();
    const polling = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    const resumed = await app.inject({
      method: 'POST',
      url: '/api/session',
      headers: { origin, cookie: user.cookie },
      payload: {},
    });
    const acting = await action(user.cookie, { type: 'startHunt', mobId: 'wolf' }, idempotencyKey);
    const replay = await action(user.cookie, { type: 'startHunt', mobId: 'wolf' }, idempotencyKey);
    for (const response of [user.response, polling, resumed, acting, replay]) {
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
      expect(response.json().player).not.toHaveProperty('rngState');
    }
    const stored = await pool.query('SELECT state FROM players WHERE id = $1', [user.player.id]);
    expect(stored.rows[0].state.rngState).toEqual(expect.any(Number));
  });

  it('caps offline progress and applies it only once across concurrent polls', async () => {
    const user = await guest();
    const read = await pool.query('SELECT state FROM players WHERE id = $1', [user.player.id]);
    const offlineStartedAt = now - MAX_OFFLINE_MS * 3;
    let state = read.rows[0].state;
    state.createdAt = offlineStartedAt;
    state.lastAdvancedAt = offlineStartedAt;
    state.nextTickAt = offlineStartedAt + 3_000;
    state = applyAction(state, { type: 'startHunt', mobId: 'wolf' }, offlineStartedAt);
    const expected = advancePlayer(state, now);
    await pool.query('UPDATE players SET state = $2::jsonb WHERE id = $1', [
      user.player.id,
      JSON.stringify(state),
    ]);
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.inject({ method: 'GET', url: '/api/game', headers: { cookie: user.cookie } }),
      ),
    );
    expect(results.map((response) => response.statusCode)).toEqual(Array(6).fill(200));
    for (const response of results) {
      const player = response.json().player;
      expect(player.totalKills).toBe(expected.totalKills);
      expect(player.copper).toBe(expected.copper);
      expect(player.inventory).toEqual(expected.inventory);
      expect(player.lastAdvancedAt).toBe(now);
    }
    const reports = results
      .map((response) => response.json().player.offlineReport)
      .filter((report) => report?.capped);
    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) {
      expect(report.simulatedMs).toBe(MAX_OFFLINE_MS);
      expect(report.kills).toBe(expected.totalKills - state.totalKills);
    }
  });
});
