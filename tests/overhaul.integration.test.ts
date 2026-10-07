import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../apps/server/src/app.js';
import { migrate } from '../apps/server/src/migrate.js';

const origin = 'http://localhost:5173';
const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const appearance = { gender: 'female', hair: 'red', hairStyle: 'braid', skin: 'tan', mark: 'scar' };
const v2Fields = ['appearance', 'skills', 'combatEvents', 'lootEvents', 'nextEventId'];

integration('schema 2 appearance, skills, and legacy persistence', () => {
  const schema = `overhaul_${randomUUID().replaceAll('-', '')}`;
  const now = Date.now();
  let admin: pg.Pool;
  let pool: pg.Pool;
  let app: ReturnType<typeof buildApp>;
  let addressId = 0;

  beforeAll(async () => {
    admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    await migrate(pool);
    app = buildApp({ pool, now: () => now, allowedOrigins: [origin], secureCookies: false });
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

  async function session(payload: unknown, cookie?: string) {
    return app.inject({
      method: 'POST',
      url: '/api/session',
      remoteAddress: `192.0.2.${++addressId}`,
      headers: { origin, ...(cookie ? { cookie } : {}) },
      payload,
    });
  }

  async function guest(customAppearance = appearance) {
    const response = await session({ name: 'Мирослава', appearance: customAppearance });
    expect(response.statusCode).toBe(201);
    const token = response.cookies.find((value) => value.name === 'wc_session');
    expect(token).toBeDefined();
    return { cookie: `wc_session=${token!.value}`, player: response.json().player };
  }

  async function readState(id: string) {
    return (await pool.query('SELECT state FROM players WHERE id = $1', [id])).rows[0].state;
  }

  async function writeState(state: Record<string, unknown>) {
    await pool.query('UPDATE players SET state = $2::jsonb WHERE id = $1', [
      state.id,
      JSON.stringify(state),
    ]);
  }

  async function action(cookie: string, intent: unknown, key = randomUUID()) {
    return app.inject({
      method: 'POST',
      url: '/api/game/action',
      headers: { origin, cookie },
      payload: { idempotencyKey: key, action: intent },
    });
  }

  function legacy(state: Record<string, unknown>) {
    const saved = structuredClone(state);
    for (const field of v2Fields) delete saved[field];
    Object.assign(saved, {
      schemaVersion: 1,
      race: 'Human',
      class: 'Paladin',
      zone: 'Northshire Abbey',
    });
    return saved;
  }

  it('persists both genders and appearance through polling and session resumption', async () => {
    for (const gender of ['male', 'female']) {
      const expected = { ...appearance, gender };
      const user = await guest(expected);
      expect(user.player.appearance).toEqual(expected);
      const polled = await app.inject({
        method: 'GET',
        url: '/api/game',
        headers: { cookie: user.cookie },
      });
      expect(polled.statusCode).toBe(200);
      expect(polled.json().player.appearance).toEqual(expected);
      const resumed = await session(
        {
          name: 'Другой',
          appearance: { ...appearance, gender: gender === 'male' ? 'female' : 'male' },
        },
        user.cookie,
      );
      expect(resumed.statusCode).toBe(200);
      expect(resumed.json().player.id).toBe(user.player.id);
      expect(resumed.json().player.appearance).toEqual(expected);
      expect((await readState(user.player.id)).appearance).toEqual(expected);
    }
  });

  it('rejects unknown appearance fields, dangerous enum values, and client buffs', async () => {
    const before = await pool.query('SELECT count(*)::int AS count FROM players');
    const invalid = [
      { ...appearance, gender: '__proto__' },
      { ...appearance, hairStyle: 'constructor' },
      { ...appearance, mark: 'toString' },
      { ...appearance, attack: 999_999 },
      { gender: 'male' },
      null,
      [],
      JSON.parse(
        '{"gender":"male","hair":"dark","hairStyle":"short","skin":"light","mark":"none","__proto__":{"attack":999999}}',
      ),
    ];
    for (const invalidAppearance of invalid) {
      const response = await session({ name: 'Ратник', appearance: invalidAppearance });
      expect(response.statusCode).toBe(400);
    }
    const injected = await session({
      name: 'Ратник',
      appearance,
      skills: { loadout: ['ward'], cooldowns: {} },
      copper: 999_999,
    });
    expect(injected.statusCode).toBe(400);
    const players = await pool.query('SELECT count(*)::int AS count FROM players');
    expect(players.rows[0].count).toBe(before.rows[0].count);
  });

  it('upgrades persisted v1 saves without resetting identity, wealth, quests, or inventory', async () => {
    const user = await guest();
    const old = legacy(await readState(user.player.id));
    Object.assign(old, {
      copper: 731,
      xp: 19,
      totalKills: 27,
      totalDeaths: 2,
      quests: [{ questId: 'wolves-at-the-gate', kills: 8, status: 'completed' }],
    });
    (old.inventory as Array<unknown>).push({
      instanceId: `${user.player.id}:3`,
      itemId: 'wolf-fang',
    });
    old.nextItemId = 4;
    await writeState(old);
    const response = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(response.statusCode).toBe(200);
    const upgraded = response.json().player;
    expect(upgraded.schemaVersion).toBe(2);
    for (const field of [
      'id',
      'name',
      'createdAt',
      'inventory',
      'equipment',
      'quests',
      'copper',
      'xp',
      'totalKills',
      'totalDeaths',
    ]) {
      expect(upgraded[field]).toEqual(old[field]);
    }
    expect(upgraded.appearance.gender).toMatch(/^(male|female)$/);
    expect(new Set(upgraded.skills.loadout).size).toBe(upgraded.skills.loadout.length);
    expect(upgraded).not.toHaveProperty('rngState');
    const persisted = await readState(user.player.id);
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.rngState).toBe(old.rngState);
    expect(persisted.nextItemId).toBe(4);
    expect(
      (await action(user.cookie, { type: 'turnInQuest', questId: 'wolves-at-the-gate' }))
        .statusCode,
    ).toBe(400);
    expect((await readState(user.player.id)).copper).toBe(731);
  });

  it('upgrades old receipt responses without re-awarding a completed quest', async () => {
    const user = await guest();
    const old = legacy(await readState(user.player.id));
    Object.assign(old, {
      copper: 170,
      quests: [{ questId: 'wolves-at-the-gate', kills: 8, status: 'completed' }],
    });
    const key = randomUUID();
    const intent = { type: 'turnInQuest', questId: 'wolves-at-the-gate' };
    const originalHash = createHash('sha256').update(JSON.stringify(intent)).digest('hex');
    const oldResponse = { player: { ...old, copper: 135 } };
    await writeState(old);
    await pool.query(
      'INSERT INTO action_receipts (player_id,idempotency_key,action_hash,response) VALUES ($1,$2,$3,$4::jsonb)',
      [user.player.id, key, originalHash, JSON.stringify(oldResponse)],
    );
    // Reopening the UI upgrades the save before a delayed request is retried.
    const reconnect = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(reconnect.statusCode).toBe(200);
    expect(reconnect.json().player.schemaVersion).toBe(2);
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => action(user.cookie, intent, key)),
    );
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.json().player.schemaVersion).toBe(2);
      expect(response.json().player.copper).toBe(170);
      expect(response.json().player).not.toHaveProperty('rngState');
    }
    const stored = await readState(user.player.id);
    expect(stored.copper).toBe(170);
    expect(stored.quests[0].status).toBe('completed');
    expect(stored.schemaVersion).toBe(2);
    expect((await action(user.cookie, intent)).statusCode).toBe(400);
    expect((await action(user.cookie, { type: 'rest' }, key)).statusCode).toBe(409);
  });

  it('rejects duplicate, locked, unknown, and tampered skills while allowing valid intent', async () => {
    const user = await guest();
    const initial = await readState(user.player.id);
    const invalid = [
      { type: 'setSkills', skills: ['heavyStrike', 'heavyStrike'] },
      { type: 'setSkills', skills: ['ward'] },
      { type: 'setSkills', skills: ['heavyStrike', 'mend', 'ward'] },
      { type: 'setSkills', skills: ['__proto__'] },
      { type: 'setSkills', skills: ['constructor'] },
      { type: 'setSkills', skills: [0] },
      { type: 'setSkills', skills: ['heavyStrike'], cooldowns: { heavyStrike: 0 } },
      { type: 'setSkills', skills: ['heavyStrike'], damage: 999_999 },
      { type: 'castSkill', skillIndex: 0, attack: 999_999 },
    ];
    for (const intent of invalid) expect((await action(user.cookie, intent)).statusCode).toBe(400);
    const after = await readState(user.player.id);
    expect(after.skills).toEqual(initial.skills);
    expect(after.hp).toBe(initial.hp);
    expect(after.mana).toBe(initial.mana);
    expect(after.copper).toBe(initial.copper);
    for (const loadout of [[], ['heavyStrike'], ['mend', 'heavyStrike']]) {
      const response = await action(user.cookie, { type: 'setSkills', skills: loadout });
      expect(response.statusCode).toBe(200);
      expect(response.json().player.skills.loadout).toEqual(loadout);
    }
  });

  it('preserves active cooldowns when unequipping and re-equipping automatic skills', async () => {
    const user = await guest();
    const state = await readState(user.player.id);
    state.skills.cooldowns.heavyStrike = 3;
    state.skills.cooldowns.mend = 2;
    await writeState(state);
    expect((await action(user.cookie, { type: 'setSkills', skills: [] })).statusCode).toBe(200);
    const response = await action(user.cookie, {
      type: 'setSkills',
      skills: ['heavyStrike', 'mend'],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().player.skills.cooldowns).toEqual(state.skills.cooldowns);
    expect(response.json().player.mana).toBe(state.mana);
    expect(response.json().player.hp).toBe(state.hp);
  });

  it('derives automatic skill resources and structured loot events on the server', async () => {
    const user = await guest();
    const state = await readState(user.player.id);
    Object.assign(state, {
      mode: 'hunting',
      targetMobId: 'wolf',
      createdAt: now - 6_000,
      lastAdvancedAt: now - 3_000,
      nextTickAt: now,
    });
    state.skills.loadout = ['heavyStrike'];
    state.skills.cooldowns.heavyStrike = 0;
    await writeState(state);
    const advanced = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(advanced.statusCode).toBe(200);
    const player = advanced.json().player;
    const skillEvent = player.combatEvents.find(
      (event: { ability: string }) => event.ability === 'heavyStrike',
    );
    expect(skillEvent).toMatchObject({
      source: 'player',
      target: 'enemy',
      mobId: 'wolf',
      critical: expect.any(Boolean),
      damage: expect.any(Number),
    });
    expect(player.skills.cooldowns.heavyStrike).toBeGreaterThan(0);
    expect(player.mana).toBeLessThan(state.mana);
    expect(player.mana).toBeGreaterThanOrEqual(0);
    const progressed = await readState(user.player.id);
    progressed.quests = [{ questId: 'wolves-at-the-gate', kills: 8, status: 'active' }];
    await writeState(progressed);
    const turnedIn = await action(user.cookie, {
      type: 'turnInQuest',
      questId: 'wolves-at-the-gate',
    });
    expect(turnedIn.statusCode).toBe(200);
    const rewarded = turnedIn.json().player;
    const rewardEvent = rewarded.lootEvents.find(
      (event: { source: string; itemId: string }) =>
        event.source === 'quest' && event.itemId === 'militia-hammer',
    );
    expect(rewardEvent).toMatchObject({
      rarity: 'uncommon',
      salvaged: false,
      instanceId: expect.any(String),
      timestamp: now,
    });
    expect(rewarded.inventory).toContainEqual({
      instanceId: rewardEvent.instanceId,
      itemId: rewardEvent.itemId,
    });
    expect(rewarded).not.toHaveProperty('rngState');
  });
});
