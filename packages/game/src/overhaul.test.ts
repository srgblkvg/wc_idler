import { describe, expect, it } from 'vitest';
import {
  applyAction,
  advancePlayer,
  armorMitigation,
  createPlayer,
  getDerivedStats,
  resolveBattleTurn,
} from './engine.js';
import {
  COMBAT_RULES,
  DEFAULT_APPEARANCE,
  ITEM_BY_ID,
  MAX_RECENT_EVENTS,
  MOB_BY_ID,
  STATE_SCHEMA_VERSION,
  TICK_MS,
} from './content.js';
import { createDefaultSkills, migratePlayerState } from './migration.js';
import { GameError, parseAction, parseAppearance } from './validation.js';
import type { Appearance, Encounter, SkillState } from './types.js';

const player = () => createPlayer({ id: 'slavic-ratnik', name: 'Велимир', now: 0, rngSeed: 42 });
const noSkills: SkillState = createDefaultSkills();
const encounter: Encounter = { mobId: 'wolf', hp: 1000, maxHp: 1000, round: 0 };

describe('appearance and versioned persistence', () => {
  it.each(['male', 'female'] as const)(
    'creates a %s character using validated independent customization',
    (gender) => {
      const appearance: Appearance = {
        gender,
        hair: 'red',
        hairStyle: 'braid',
        skin: 'tan',
        mark: 'scar',
      };
      const created = createPlayer({
        id: `test-${gender}`,
        name: 'Весна',
        appearance,
        now: 0,
        rngSeed: 1,
      });
      expect(created.appearance).toEqual(appearance);
      appearance.hair = 'fair';
      expect(created.appearance.hair).toBe('red');
      expect(created.schemaVersion).toBe(STATE_SCHEMA_VERSION);
      expect(created.zone).toBe('Берёзовый Брод');
    },
  );
  it.each([
    null,
    [],
    { ...DEFAULT_APPEARANCE, gender: 'unknown' },
    { ...DEFAULT_APPEARANCE, armor: 999 },
    { gender: 'female' },
    { ...DEFAULT_APPEARANCE, hairStyle: 'helmet' },
  ])('rejects unsupported or injected appearance %j', (value) => {
    expect(() => parseAppearance(value)).toThrow(GameError);
  });
  it('migrates a real v1-shaped save while preserving all progression and stable references', () => {
    const modern = player();
    const {
      appearance: _appearance,
      skills: _skills,
      combatEvents: _combat,
      lootEvents: _loot,
      nextEventId: _event,
      ...base
    } = modern;
    const legacy = {
      ...base,
      schemaVersion: 1,
      race: 'Human',
      class: 'Paladin',
      zone: 'Northshire Abbey',
      level: 3,
      xp: 17,
      copper: 357,
      hp: 25,
      mana: 13,
      totalKills: 52,
      inventory: [...base.inventory, { instanceId: 'reward:3', itemId: 'militia-hammer' }],
      equipment: { weapon: 'reward:3', armor: base.equipment.armor, trinket: null },
      quests: [{ questId: 'wolves-at-the-gate', kills: 8, status: 'completed' }],
      nextItemId: 4,
      nextLogId: 19,
      log: [{ id: 18, at: 0, kind: 'system', message: 'Welcome to Northshire Abbey.' }],
    };
    const before = structuredClone(legacy);
    const migrated = migratePlayerState(legacy);
    for (const key of [
      'id',
      'level',
      'xp',
      'copper',
      'hp',
      'mana',
      'totalKills',
      'inventory',
      'quests',
      'rngState',
      'nextItemId',
      'lastAdvancedAt',
      'nextTickAt',
    ] as const)
      expect(migrated[key]).toEqual(legacy[key]);
    expect(migrated.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(migrated.equipment).toEqual({ ...base.equipment, weapon: 'reward:3' });
    expect(migrated.appearance).toEqual(DEFAULT_APPEARANCE);
    expect(migrated.log.map((entry) => entry.message).join(' ')).not.toMatch(
      /Northshire|Северозем|аббатств/,
    );
    expect(migratePlayerState(migrated)).toEqual(migrated);
    expect(legacy).toEqual(before);
  });
});

describe('automatic skills', () => {
  it.each([
    { type: 'setSkills', skills: ['heavyStrike', 'heavyStrike'] },
    { type: 'setSkills', skills: ['heavyStrike', 'mend', 'ward'] },
    { type: 'setSkills', skills: ['adminHeal'] },
    { type: 'setSkills', skills: ['mend'], healthBelow: 1 },
    { type: 'setSkills', skills: ['heavyStrike'], damage: 999 },
  ])('rejects illegal loadouts and client-authored policies %j', (value) =>
    expect(() => parseAction(value)).toThrow(GameError),
  );
  it('enforces equipment grants and does not reset cooldowns by swapping a loadout', () => {
    let state = player();
    expect(() => applyAction(state, { type: 'setSkills', skills: ['ward'] }, 0)).toThrow();
    state.skills.cooldowns.heavyStrike = 3;
    state = applyAction(state, { type: 'setSkills', skills: [] }, 0);
    state = applyAction(state, { type: 'setSkills', skills: ['heavyStrike'] }, 0);
    expect(state.skills.cooldowns.heavyStrike).toBe(3);
    state = advancePlayer(state, TICK_MS);
    expect(state.skills.cooldowns.heavyStrike).toBe(2);
  });
  it('casts every third turn and spends authoritative mana without polling dependence', () => {
    const state = player();
    let character = { ...state, stats: getDerivedStats(state) },
      enemy = encounter;
    const used: string[] = [];
    for (let index = 0; index < 4; index++) {
      const turn = resolveBattleTurn(character, enemy, () => 0.5);
      used.push(turn.combatEvents.find((event) => event.source === 'player')!.ability!);
      character = { ...character, hp: turn.hp, mana: turn.mana, skills: turn.skills };
      enemy = turn.encounter;
    }
    expect(used).toEqual(['heavyStrike', 'basicAttack', 'basicAttack', 'heavyStrike']);
    expect(character.mana).toBe(21);
    expect(character.skills.cooldowns.heavyStrike).toBe(3);
    const active = applyAction(state, { type: 'startHunt', mobId: 'wolf' }, 0);
    const single = advancePlayer(active, 90_000);
    let polled = active;
    for (let now = 250; now <= 90_000; now += 250) polled = advancePlayer(polled, now);
    const { offlineReport: _a, ...singleProgress } = single,
      { offlineReport: _b, ...polledProgress } = polled;
    expect(polledProgress).toEqual(singleProgress);
  });
  it('uses basic attacks when mana cannot pay for a skill and prioritizes configured healing', () => {
    const state = player(),
      stats = getDerivedStats(state);
    const empty = resolveBattleTurn({ ...state, mana: 0, stats }, encounter, () => 0.5);
    expect(empty.mana).toBe(1);
    expect(empty.combatEvents.find((event) => event.source === 'player')?.ability).toBe(
      'basicAttack',
    );
    const wounded = resolveBattleTurn({ ...state, hp: 5, stats }, encounter, () => 0.5);
    expect(wounded.combatEvents[0]).toMatchObject({
      ability: 'secondWind',
      kind: 'heal',
      healing: 9,
    });
    expect(wounded.skills.cooldowns.secondWind).toBe(5);
  });
  it('reduces retaliation with ward while still attacking', () => {
    const state = { ...player(), level: 2 },
      stats = getDerivedStats(state);
    const normal = resolveBattleTurn({ ...state, skills: noSkills, stats }, encounter, () => 0.5);
    const warded = resolveBattleTurn(
      { ...state, skills: { ...noSkills, loadout: ['ward'] }, stats },
      encounter,
      () => 0.5,
    );
    expect(warded.hp).toBeGreaterThan(normal.hp);
    expect(warded.encounter.hp).toBe(normal.encounter.hp);
    expect(warded.combatEvents[0]).toMatchObject({ kind: 'ward', ability: 'ward' });
  });
});

describe('physical formulas and feedback', () => {
  it('uses explicit armor mitigation, critical hits and misses', () => {
    expect(armorMitigation(100, 3)).toBeCloseTo(100 / (100 + 400 + 85 * 3));
    expect(COMBAT_RULES.baseCritChance).toBe(0.05);
    const state = player(),
      stats = getDerivedStats(state);
    const normal = resolveBattleTurn({ ...state, skills: noSkills, stats }, encounter, () => 0.5);
    const critical = resolveBattleTurn({ ...state, skills: noSkills, stats }, encounter, () => 0);
    const missed = resolveBattleTurn(
      { ...state, skills: noSkills, stats },
      encounter,
      () => 0.99999,
    );
    expect(critical.combatEvents[0].damage).toBeGreaterThan(normal.combatEvents[0].damage);
    expect(critical.combatEvents[0].critical).toBe(true);
    expect(missed.combatEvents[0]).toMatchObject({ missed: true, damage: 0 });
    expect(missed.encounter.hp).toBe(encounter.hp);
    expect(() =>
      resolveBattleTurn({ ...state, skills: noSkills, stats }, encounter, () => NaN),
    ).toThrow(GameError);
  });
  it('provides globally unique bounded combat and loot events linked to earned epic items', () => {
    let state = { ...player(), level: 5 };
    const stats = getDerivedStats(state);
    state.hp = stats.maxHp;
    state.mana = stats.maxMana;
    state = applyAction(state, { type: 'startHunt', mobId: 'defias' }, 0);
    const advanced = advancePlayer(state, 90_000, () => 0);
    const epic = advanced.lootEvents.find((event) => event.rarity === 'epic');
    expect(epic).toBeDefined();
    expect(
      MOB_BY_ID.defias.loot.find((drop) => ITEM_BY_ID[drop.itemId].rarity === 'epic')?.chance,
    ).toBe(0.005);
    expect(
      advanced.inventory.some(
        (item) => item.instanceId === epic!.instanceId && item.itemId === epic!.itemId,
      ),
    ).toBe(true);
    expect(epic).toMatchObject({ source: 'drop', salvaged: false });
    const ids = [...advanced.combatEvents, ...advanced.lootEvents].map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(advanced.combatEvents.length).toBeLessThanOrEqual(MAX_RECENT_EVENTS);
    expect(advanced.lootEvents.length).toBeLessThanOrEqual(MAX_RECENT_EVENTS);
    const next = advancePlayer(advanced, 120_000, () => 0);
    expect(next.nextEventId).toBeGreaterThan(advanced.nextEventId);
    expect(next.combatEvents.at(-1)!.timestamp).toBeGreaterThan(
      advanced.combatEvents.at(-1)!.timestamp,
    );
  });
});
