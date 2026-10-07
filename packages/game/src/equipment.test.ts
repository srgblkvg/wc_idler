import { describe, expect, it } from 'vitest';
import {
  COMBAT_RULES,
  EQUIPMENT_SLOTS,
  ITEM_BY_ID,
  ITEMS,
  MOBS,
  STATE_SCHEMA_VERSION,
  TICK_MS,
} from './content.js';
import {
  advancePlayer,
  applyAction,
  createPlayer,
  getDerivedStats,
  resolveBattleTurn,
} from './engine.js';
import {
  createDefaultSkills,
  getAvailableSkills,
  getEquipConflict,
  getEquippedItem,
} from './equipment.js';
import { migratePlayerState } from './migration.js';
import { parseAction } from './validation.js';
import type { ItemId, PlayerState } from './types.js';

function veteran(): PlayerState {
  const player = createPlayer({ id: 'gear-test', name: 'Мирослава', now: 0, rngSeed: 17 });
  player.level = 5;
  return player;
}
function withItem(
  player: PlayerState,
  itemId: ItemId,
  instanceId = `owned:${itemId}`,
): PlayerState {
  const result = structuredClone(player);
  result.inventory.push({ instanceId, itemId });
  return result;
}
function equip(player: PlayerState, itemId: ItemId): PlayerState {
  return applyAction(
    withItem(player, itemId),
    { type: 'equip', itemInstanceId: `owned:${itemId}` },
    0,
  );
}

describe('authoritative equipment compatibility', () => {
  it('creates fourteen independent slots and starts with abilities actually granted by the two starter items', () => {
    const player = createPlayer({ id: 'new', name: 'Велимир', now: 0, rngSeed: 1 });
    expect(Object.keys(player.equipment)).toEqual(EQUIPMENT_SLOTS);
    expect(Object.keys(player.equipment)).toHaveLength(14);
    expect(getAvailableSkills(player)).toEqual(['heavyStrike', 'secondWind']);
    expect(player.skills.loadout).toEqual(['heavyStrike', 'secondWind']);
    expect(Object.values(player.equipment).filter(Boolean)).toHaveLength(2);
  });
  it('replaces an offhand with a two-handed weapon in one action without destroying either owned item', () => {
    const original = equip(veteran(), 'birch-shield');
    const armorBefore = getDerivedStats(original).armor;
    const result = equip(original, 'thunder-axe');
    expect(result.equipment.offhand).toBeNull();
    expect(result.equipment.weapon).toBe('owned:thunder-axe');
    expect(result.inventory).toContainEqual({
      instanceId: 'owned:birch-shield',
      itemId: 'birch-shield',
    });
    expect(getDerivedStats(result).armor).toBe(
      armorBefore - ITEM_BY_ID['birch-shield'].stats.armor!,
    );
    expect(original.equipment.offhand).toBe('owned:birch-shield');
    expect(getAvailableSkills(result)).not.toContain('ward');
  });
  it.each(['birch-shield', 'wolf-fang', 'reed-parrying-dagger'] as const)(
    'rejects %s while both hands hold a two-handed weapon',
    (itemId) => {
      const player = withItem(equip(veteran(), 'thunder-axe'), itemId);
      const before = structuredClone(player);
      expect(() =>
        applyAction(player, { type: 'equip', itemInstanceId: `owned:${itemId}` }, 0),
      ).toThrowError(expect.objectContaining({ code: 'EQUIPMENT_CONFLICT' }));
      expect(player).toEqual(before);
      expect(getEquipConflict(player, ITEM_BY_ID[itemId])).toContain('обе руки');
    },
  );
  it('requires a main-hand dagger for the offhand dagger and removes it when changing or removing that weapon', () => {
    const ordinary = withItem(veteran(), 'reed-parrying-dagger');
    expect(() =>
      applyAction(ordinary, { type: 'equip', itemInstanceId: 'owned:reed-parrying-dagger' }, 0),
    ).toThrowError(expect.objectContaining({ code: 'EQUIPMENT_CONFLICT' }));
    const dual = equip(equip(veteran(), 'reed-dagger'), 'reed-parrying-dagger');
    expect(dual.equipment.offhand).toBe('owned:reed-parrying-dagger');
    expect(getAvailableSkills(dual).filter((id) => id === 'flurry')).toHaveLength(1);
    const changed = applyAction(
      dual,
      { type: 'equip', itemInstanceId: dual.inventory[0].instanceId },
      0,
    );
    expect(changed.equipment.offhand).toBeNull();
    expect(changed.skills.loadout).not.toContain('flurry');
    const removed = applyAction(dual, { type: 'unequip', slot: 'weapon' }, 0);
    expect(removed.equipment.offhand).toBeNull();
    expect(getAvailableSkills(removed)).not.toContain('flurry');
  });
  it('keeps a shield or talisman compatible with one-handed weapons and an empty main hand', () => {
    for (const itemId of ['birch-shield', 'wolf-fang'] as const) {
      const player = equip(veteran(), itemId);
      const removed = applyAction(player, { type: 'unequip', slot: 'weapon' }, 0);
      expect(removed.equipment.offhand).toBe(`owned:${itemId}`);
      expect(getEquippedItem(removed, 'offhand')?.id).toBe(itemId);
    }
  });
  it('adds and removes visible feet stats independently from leg armor', () => {
    const player = equip(veteran(), 'watch-greaves');
    const before = getDerivedStats(player);
    const result = equip(player, 'sun-watch-boots');
    expect(result.equipment.legs).toBe(player.equipment.legs);
    expect(getDerivedStats(result).armor).toBe(before.armor + 40);
    expect(getDerivedStats(applyAction(result, { type: 'unequip', slot: 'feet' }, 0))).toEqual(
      before,
    );
  });
});

describe('paired jewellery and server-owned stats', () => {
  it.each([
    ['copper-ring', 'ring1', 'ring2'],
    ['copper-earring', 'earring1', 'earring2'],
  ] as const)(
    'fills both compatible slots with two owned %s instances',
    (itemId, first, second) => {
      let player = withItem(withItem(veteran(), itemId, 'pair:a'), itemId, 'pair:b');
      const baseline = getDerivedStats(player);
      player = applyAction(player, { type: 'equip', itemInstanceId: 'pair:a' }, 0);
      player = applyAction(player, { type: 'equip', itemInstanceId: 'pair:b' }, 0);
      expect(player.equipment[first]).toBe('pair:a');
      expect(player.equipment[second]).toBe('pair:b');
      for (const key of ['maxHp', 'maxMana'] as const)
        expect(getDerivedStats(player)[key]).toBe(
          baseline[key] + (ITEM_BY_ID[itemId].stats[key] ?? 0) * 2,
        );
      const repeated = applyAction(player, { type: 'equip', itemInstanceId: 'pair:b' }, 0);
      expect(repeated.equipment).toEqual(player.equipment);
    },
  );
  it('moves one instance between paired slots atomically and never doubles its stats', () => {
    let player = withItem(veteran(), 'river-ring', 'single-ring');
    const before = getDerivedStats(player);
    player = applyAction(
      player,
      { type: 'equip', itemInstanceId: 'single-ring', slot: 'ring1' },
      0,
    );
    player = applyAction(
      player,
      { type: 'equip', itemInstanceId: 'single-ring', slot: 'ring2' },
      0,
    );
    expect(player.equipment.ring1).toBeNull();
    expect(player.equipment.ring2).toBe('single-ring');
    expect(Object.values(player.equipment).filter((id) => id === 'single-ring')).toHaveLength(1);
    expect(getDerivedStats(player).attack).toBe(before.attack + 1);
    expect(getEquippedItem(player, 'ring2')?.id).toBe('river-ring');
  });
  it('rejects a valid but incompatible target, unknown slots, client buffs, and unowned instances', () => {
    const player = withItem(veteran(), 'copper-ring', 'ring');
    for (const intent of [
      { type: 'equip', itemInstanceId: 'ring', slot: 'armor' },
      { type: 'equip', itemInstanceId: 'ring', slot: 'earring2' },
      { type: 'equip', itemInstanceId: 'ring', slot: '__proto__' },
      { type: 'equip', itemInstanceId: 'ring', slot: null },
      { type: 'equip', itemInstanceId: 'ring', slot: 'ring2', stats: { attack: 999 } },
      { type: 'equip', itemInstanceId: 'another-player:ring', slot: 'ring2' },
    ])
      expect(() => applyAction(player, intent, 0)).toThrow();
    expect(() => parseAction({ type: 'unequip', slot: 'trinket' })).toThrow();
  });
  it('rejects a corrupted save that places one owned instance into both ring slots', () => {
    const player = withItem(veteran(), 'river-ring', 'ring');
    player.equipment.ring1 = 'ring';
    player.equipment.ring2 = 'ring';
    expect(() => advancePlayer(player, TICK_MS)).toThrowError(
      expect.objectContaining({ code: 'STATE_INVALID' }),
    );
  });
});

describe('abilities follow equipment without cooldown exploits', () => {
  it('rejects known but ungranted skills even at maximum character level', () => {
    const player = { ...veteran(), level: 20 };
    for (const skill of ['ward', 'mend', 'flurry'])
      expect(() => applyAction(player, { type: 'setSkills', skills: [skill] }, 0)).toThrowError(
        expect.objectContaining({ code: 'SKILL_NOT_GRANTED' }),
      );
    for (const skill of ['adminHeal', 'constructor', '__proto__'])
      expect(() => applyAction(player, { type: 'setSkills', skills: [skill] }, 0)).toThrowError(
        expect.objectContaining({ code: 'INVALID_SKILLS' }),
      );
  });
  it('loses a skill immediately when its last granting item is removed and preserves all cooldowns while swapping back', () => {
    let player = equip(veteran(), 'wolf-fang');
    player = applyAction(player, { type: 'setSkills', skills: ['heavyStrike', 'mend'] }, 0);
    player.skills.cooldowns.mend = 4;
    player.skills.cooldowns.heavyStrike = 3;
    player.hp = 5;
    player.mana = 11;
    const before = structuredClone(player);
    player = applyAction(player, { type: 'unequip', slot: 'offhand' }, 0);
    expect(player.skills.loadout).toEqual(['heavyStrike', 'secondWind']);
    expect(getAvailableSkills(player)).not.toContain('mend');
    expect(player.skills.cooldowns.mend).toBe(4);
    player = applyAction(player, { type: 'equip', itemInstanceId: 'owned:wolf-fang' }, 0);
    player = applyAction(player, { type: 'setSkills', skills: ['heavyStrike', 'mend'] }, 0);
    expect(player.skills.cooldowns).toEqual(before.skills.cooldowns);
    expect(player.hp).toBe(5);
    expect(player.mana).toBe(11);
    player = advancePlayer(player, TICK_MS);
    expect(player.skills.cooldowns.mend).toBe(3);
  });
  it('keeps a selected skill if another equipped item still grants it', () => {
    let player = equip(equip(veteran(), 'birch-shield'), 'watch-helmet');
    player = applyAction(player, { type: 'setSkills', skills: ['ward'] }, 0);
    player.skills.cooldowns.ward = 4;
    player = applyAction(player, { type: 'unequip', slot: 'offhand' }, 0);
    expect(player.skills.loadout).toContain('ward');
    expect(player.skills.cooldowns.ward).toBe(4);
  });
  it('retains an explicitly empty loadout while polling or reloading', () => {
    const player = applyAction(veteran(), { type: 'setSkills', skills: [] }, 0);
    expect(migratePlayerState(player).skills.loadout).toEqual([]);
    expect(advancePlayer(player, 60_000).skills.loadout).toEqual([]);
  });
  it('resolves both dagger cuts with independent rolls and charges mana once', () => {
    const player = equip(veteran(), 'reed-dagger');
    const stats = getDerivedStats(player);
    const skills = createDefaultSkills(['flurry']);
    const rolls = [0.999, 0.1, 0.001, 0.5, 0.999];
    let roll = 0;
    const result = resolveBattleTurn(
      { ...player, mana: 20, stats, skills },
      { mobId: 'wolf', hp: 100, maxHp: 100, round: 0 },
      () => rolls[roll++],
    );
    const attacks = result.combatEvents.filter((event) => event.source === 'player');
    expect(attacks).toHaveLength(2);
    expect(attacks[0]).toMatchObject({ ability: 'flurry', missed: true, damage: 0 });
    expect(attacks[1]).toMatchObject({ ability: 'flurry', critical: true, missed: false });
    expect(result.mana).toBe(16);
    expect(result.skills.cooldowns.flurry).toBe(2);
    expect(roll).toBe(5);
  });
  it('stops a dagger sequence at a lethal first cut and prevents retaliation', () => {
    const player = equip(veteran(), 'reed-dagger');
    const result = resolveBattleTurn(
      { ...player, stats: getDerivedStats(player), skills: createDefaultSkills(['flurry']) },
      { mobId: 'wolf', hp: 1, maxHp: 22, round: 0 },
      () => 0.5,
    );
    expect(result.combatEvents.filter((event) => event.kind === 'attack')).toHaveLength(1);
    expect(result.won).toBe(true);
    expect(result.hp).toBe(player.hp);
  });
  it('uses armor recovery only at its threshold and with sufficient mana', () => {
    const player = veteran();
    const stats = getDerivedStats(player);
    const skills = createDefaultSkills(['secondWind']);
    const encounter = { mobId: 'wolf' as const, hp: 100, maxHp: 100, round: 0 };
    const wounded = resolveBattleTurn(
      { ...player, hp: 5, mana: 7, stats, skills },
      encounter,
      () => 0.5,
    );
    expect(wounded.combatEvents[0]).toMatchObject({
      kind: 'heal',
      ability: 'secondWind',
      healing: Math.round(stats.maxHp * COMBAT_RULES.secondWindFraction),
    });
    for (const condition of [
      { hp: stats.maxHp, mana: 30 },
      { hp: 5, mana: 0 },
    ]) {
      const result = resolveBattleTurn(
        { ...player, ...condition, stats, skills },
        encounter,
        () => 0.5,
      );
      expect(result.combatEvents[0].ability).toBe('basicAttack');
    }
  });
});

describe('schema 3 migration and obtainable gear', () => {
  it('upgrades schema 2 trinkets and customized appearance, preserving old cooldowns and all progress', () => {
    const current = equip(veteran(), 'wolf-fang');
    const previous = {
      ...current,
      schemaVersion: 2,
      appearance: { gender: 'female', hair: 'red', hairStyle: 'braid', skin: 'tan', mark: 'scar' },
      equipment: {
        weapon: current.equipment.weapon,
        armor: current.equipment.armor,
        trinket: current.equipment.offhand,
      },
      skills: { loadout: ['heavyStrike', 'mend'], cooldowns: { heavyStrike: 3, ward: 2, mend: 4 } },
    };
    const before = structuredClone(previous);
    const result = migratePlayerState(previous);
    expect(result.schemaVersion).toBe(STATE_SCHEMA_VERSION);
    expect(result.equipment.offhand).toBe(previous.equipment.trinket);
    expect(result.equipment).not.toHaveProperty('trinket');
    for (const slot of [
      'feet',
      'helmet',
      'gloves',
      'legs',
      'ring1',
      'ring2',
      'earring1',
      'earring2',
      'belt',
      'cloak',
      'amulet',
    ] as const)
      expect(result.equipment[slot]).toBeNull();
    expect(result.skills.loadout).toEqual(['heavyStrike', 'mend']);
    expect(result.skills.cooldowns).toEqual({
      heavyStrike: 3,
      ward: 2,
      mend: 4,
      flurry: 0,
      secondWind: 0,
    });
    expect(result.appearance).toEqual(previous.appearance);
    for (const key of [
      'id',
      'inventory',
      'quests',
      'hp',
      'mana',
      'level',
      'copper',
      'rngState',
      'nextItemId',
      'lastAdvancedAt',
    ] as const)
      expect(result[key]).toEqual(previous[key]);
    expect(migratePlayerState(result)).toEqual(result);
    expect(previous).toEqual(before);
  });
  it('returns an obsolete offhand to the bag when a legacy axe now occupies two hands', () => {
    const current = withItem(equip(veteran(), 'militia-hammer'), 'wolf-fang', 'legacy-talisman');
    const legacy = {
      ...current,
      schemaVersion: 2,
      equipment: {
        weapon: current.equipment.weapon,
        armor: current.equipment.armor,
        trinket: 'legacy-talisman',
      },
    };
    const result = migratePlayerState(legacy);
    expect(result.equipment.offhand).toBeNull();
    expect(result.inventory).toEqual(current.inventory);
    expect(getAvailableSkills(result)).not.toContain('mend');
  });
  it('keeps all catalog gear obtainable from real loot tables with explicit low legendary chances', () => {
    const obtainable = new Set(MOBS.flatMap((mob) => mob.loot.map((drop) => drop.itemId)));
    obtainable.add('training-hammer');
    obtainable.add('abbey-tabard');
    for (const item of ITEMS) expect(obtainable.has(item.id), item.id).toBe(true);
    for (const item of ITEMS.filter((item) => item.rarity === 'legendary')) {
      const drop = MOBS.flatMap((mob) => mob.loot).find((entry) => entry.itemId === item.id)!;
      expect(drop.chance).toBeGreaterThan(0);
      expect(drop.chance).toBeLessThanOrEqual(0.002);
      expect(item.requiredLevel).toBe(4);
    }
    expect(ITEM_BY_ID['sun-watch-armor'].visual.armorVariant).toBe('sun');
  });
});
