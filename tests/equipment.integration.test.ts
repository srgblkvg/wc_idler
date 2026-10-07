import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../apps/server/src/app.js';
import { migrate } from '../apps/server/src/migrate.js';
import {
  EQUIPMENT_SLOTS,
  STATE_SCHEMA_VERSION,
  getAvailableSkills,
  getDerivedStats,
  type ItemId,
  type PlayerState,
} from '../packages/game/src/index.js';

const integration = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const origin = 'http://localhost:5173';
integration('PostgreSQL equipment and schema 3 boundaries', () => {
  const schema = `equipment_${randomUUID().replaceAll('-', '')}`;
  const now = Date.now();
  let admin: pg.Pool;
  let pool: pg.Pool;
  let app: ReturnType<typeof buildApp>;
  let address = 0;

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
  async function state(id: string): Promise<PlayerState> {
    return (await pool.query('SELECT state FROM players WHERE id = $1', [id])).rows[0].state;
  }
  async function save(player: object & { id: string }) {
    await pool.query('UPDATE players SET state = $2::jsonb WHERE id = $1', [
      player.id,
      JSON.stringify(player),
    ]);
  }
  async function guest(items: ItemId[] = []) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      remoteAddress: `192.0.2.${++address}`,
      headers: { origin },
      payload: {
        name: 'Мирослава',
        appearance: {
          gender: 'female',
          hair: 'red',
          hairStyle: 'braid',
          skin: 'tan',
          mark: 'scar',
        },
      },
    });
    expect(response.statusCode).toBe(201);
    const cookie = `wc_session=${response.cookies.find((entry) => entry.name === 'wc_session')!.value}`;
    const player = await state(response.json().player.id);
    player.level = 5;
    for (const itemId of items)
      player.inventory.push({ instanceId: `${player.id}:${player.nextItemId++}`, itemId });
    await save(player);
    return { cookie, player };
  }
  async function action(cookie: string, intent: unknown, key = randomUUID()) {
    return app.inject({
      method: 'POST',
      url: '/api/game/action',
      headers: { origin, cookie },
      payload: { idempotencyKey: key, action: intent },
    });
  }
  function intent(player: PlayerState, itemId: ItemId, slot?: string) {
    return {
      type: 'equip',
      itemInstanceId: player.inventory.find((item) => item.itemId === itemId)!.instanceId,
      ...(slot ? { slot } : {}),
    };
  }

  it('migrates and persists an actual schema 2 save with old trinket and appearance intact', async () => {
    const user = await guest(['wolf-fang']);
    const old = {
      ...user.player,
      schemaVersion: 2,
      equipment: {
        weapon: user.player.equipment.weapon,
        armor: user.player.equipment.armor,
        trinket: intent(user.player, 'wolf-fang').itemInstanceId,
      },
      skills: { loadout: ['heavyStrike', 'mend'], cooldowns: { heavyStrike: 3, ward: 2, mend: 4 } },
      copper: 853,
      totalKills: 117,
    };
    await save(old);
    const read = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(read.statusCode).toBe(200);
    const actual = read.json().player;
    expect(actual.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(Object.keys(actual.equipment).sort()).toEqual([...EQUIPMENT_SLOTS].sort());
    expect(actual.equipment.offhand).toBe(old.equipment.trinket);
    expect(actual.equipment).not.toHaveProperty('trinket');
    expect(actual.appearance).toEqual(old.appearance);
    expect(actual.inventory).toEqual(old.inventory);
    expect(actual.skills).toEqual({
      loadout: ['heavyStrike', 'mend'],
      cooldowns: { ...old.skills.cooldowns, flurry: 0, secondWind: 0 },
    });
    expect(actual.copper).toBe(853);
    expect(actual.totalKills).toBe(117);
    expect(actual).not.toHaveProperty('rngState');
    const persisted = await state(user.player.id);
    expect(persisted.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(persisted.equipment).toEqual(actual.equipment);
    expect(persisted.rngState).toBe(old.rngState);
  });

  it('upgrades a schema 2 receipt without re-equipping its historical item or duplicating effects', async () => {
    const user = await guest(['birch-shield']);
    const equipIntent = intent(user.player, 'birch-shield');
    const key = randomUUID();
    const oldReceipt = {
      player: {
        ...user.player,
        schemaVersion: 2,
        equipment: {
          weapon: user.player.equipment.weapon,
          armor: user.player.equipment.armor,
          trinket: equipIntent.itemInstanceId,
        },
      },
    };
    const actionHash = createHash('sha256')
      .update(JSON.stringify(equipIntent, Object.keys(equipIntent).sort()))
      .digest('hex');
    await pool.query(
      'INSERT INTO action_receipts (player_id,idempotency_key,action_hash,response) VALUES ($1,$2,$3,$4::jsonb)',
      [user.player.id, key, actionHash, JSON.stringify(oldReceipt)],
    );
    const replayed = await action(user.cookie, equipIntent, key);
    expect(replayed.statusCode).toBe(200);
    expect(replayed.json().player.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(replayed.json().player.equipment.offhand).toBeNull();
    expect(replayed.json().player.skills).toEqual(user.player.skills);
    expect(replayed.json().player).not.toHaveProperty('rngState');
    const receipt = (
      await pool.query(
        'SELECT response FROM action_receipts WHERE player_id=$1 AND idempotency_key=$2',
        [user.player.id, key],
      )
    ).rows[0].response;
    expect(receipt.player.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(receipt.player.equipment.offhand).toBeNull();
  });

  it('atomically removes the offhand on two-handed equip and rolls back incompatible attempts', async () => {
    const user = await guest(['birch-shield', 'thunder-axe', 'wolf-fang']);
    expect((await action(user.cookie, intent(user.player, 'birch-shield'))).statusCode).toBe(200);
    const equipped = await action(user.cookie, intent(user.player, 'thunder-axe'));
    expect(equipped.statusCode).toBe(200);
    expect(equipped.json().player.equipment.offhand).toBeNull();
    const before = await state(user.player.id);
    for (const itemId of ['birch-shield', 'wolf-fang'] as const) {
      const rejected = await action(user.cookie, intent(user.player, itemId));
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json().code).toBe('EQUIPMENT_CONFLICT');
    }
    expect(await state(user.player.id)).toEqual(before);
    expect(before.inventory).toEqual(user.player.inventory);
  });

  it('requires paired daggers, removes the offhand after main-hand removal, and revokes its skill', async () => {
    const user = await guest(['reed-dagger', 'reed-parrying-dagger']);
    expect(
      (await action(user.cookie, intent(user.player, 'reed-parrying-dagger'))).statusCode,
    ).toBe(400);
    expect((await action(user.cookie, intent(user.player, 'reed-dagger'))).statusCode).toBe(200);
    const dual = await action(user.cookie, intent(user.player, 'reed-parrying-dagger'));
    expect(dual.statusCode).toBe(200);
    expect(getAvailableSkills(dual.json().player)).toContain('flurry');
    const removed = await action(user.cookie, { type: 'unequip', slot: 'weapon' });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().player.equipment.offhand).toBeNull();
    expect(removed.json().player.skills.loadout).not.toContain('flurry');
    expect((await action(user.cookie, { type: 'setSkills', skills: ['flurry'] })).statusCode).toBe(
      400,
    );
  });

  it('serializes concurrent moves of one ring so a single instance never grants duplicate stats', async () => {
    const user = await guest(['river-ring']);
    const baseline = getDerivedStats(user.player);
    const ring = intent(user.player, 'river-ring');
    const replies = await Promise.all(
      ['ring1', 'ring2'].map((slot) => action(user.cookie, { ...ring, slot })),
    );
    for (const reply of replies) expect(reply.statusCode).toBe(200);
    const stored = await state(user.player.id);
    expect(Object.values(stored.equipment).filter((id) => id === ring.itemInstanceId)).toHaveLength(
      1,
    );
    expect(getDerivedStats(stored).attack).toBe(baseline.attack + 1);
    const wrongSlot = await action(user.cookie, { ...ring, slot: 'earring2' });
    expect(wrongSlot.statusCode).toBe(400);
    expect(wrongSlot.json().code).toBe('INVALID_EQUIPMENT_SLOT');
    expect(await state(user.player.id)).toEqual(stored);
  });

  it('equips separate rings and earrings in both positions, and persists invisible accessory stats', async () => {
    const user = await guest([
      'copper-ring',
      'river-ring',
      'copper-earring',
      'river-earring',
      'woven-belt',
      'traveller-cloak',
      'birch-amulet',
      'sun-watch-boots',
    ]);
    for (const [itemId, slot] of [
      ['copper-ring', 'ring1'],
      ['river-ring', 'ring2'],
      ['copper-earring', 'earring1'],
      ['river-earring', 'earring2'],
      ['woven-belt', 'belt'],
      ['traveller-cloak', 'cloak'],
      ['birch-amulet', 'amulet'],
      ['sun-watch-boots', 'feet'],
    ] as const) {
      const result = await action(user.cookie, intent(user.player, itemId, slot));
      expect(result.statusCode).toBe(200);
      expect(result.json().player.equipment[slot]).toBe(intent(user.player, itemId).itemInstanceId);
    }
    const before = await state(user.player.id);
    const polled = await app.inject({
      method: 'GET',
      url: '/api/game',
      headers: { cookie: user.cookie },
    });
    expect(polled.statusCode).toBe(200);
    expect(polled.json().player.equipment).toEqual(before.equipment);
    expect(getDerivedStats(before).armor).toBeGreaterThan(getDerivedStats(user.player).armor);
    expect(getAvailableSkills(before)).toEqual(getAvailableSkills(user.player));
  });

  it('rejects injected abilities and preserves cooldowns through item removal and replacement', async () => {
    const user = await guest(['wolf-fang']);
    expect((await action(user.cookie, intent(user.player, 'wolf-fang'))).statusCode).toBe(200);
    expect(
      (await action(user.cookie, { type: 'setSkills', skills: ['heavyStrike', 'mend'] }))
        .statusCode,
    ).toBe(200);
    const stored = await state(user.player.id);
    stored.skills.cooldowns.mend = 4;
    stored.skills.cooldowns.heavyStrike = 3;
    stored.hp = 6;
    await save(stored);
    const removed = await action(user.cookie, { type: 'unequip', slot: 'offhand' });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().player.skills.loadout).not.toContain('mend');
    for (const skills of [['mend'], ['flurry'], ['__proto__']])
      expect((await action(user.cookie, { type: 'setSkills', skills })).statusCode).toBe(400);
    expect((await action(user.cookie, intent(user.player, 'wolf-fang'))).statusCode).toBe(200);
    const enabled = await action(user.cookie, {
      type: 'setSkills',
      skills: ['heavyStrike', 'mend'],
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json().player.skills.cooldowns).toEqual(stored.skills.cooldowns);
    expect(enabled.json().player.hp).toBe(6);
    expect(enabled.json().player.mana).toBe(stored.mana);
  });
});
