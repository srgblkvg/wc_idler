import { describe, expect, it } from 'vitest';
import {
  applyAction,
  advancePlayer,
  createPlayer,
  formatCopper,
  getDerivedStats,
  resolveBattleTurn,
  xpForNextLevel,
} from './engine.js';
import { GameError, parseAction } from './validation.js';
import {
  ITEMS,
  MOBS,
  QUESTS,
  MAX_INVENTORY,
  MAX_LEVEL,
  MAX_OFFLINE_MS,
  TICK_MS,
} from './content.js';
import type { PlayerState } from './types.js';

const makePlayer = () => createPlayer({ id: 'test-paladin', name: 'Альдор', now: 0, rngSeed: 123 });
const huntingPlayer = () => applyAction(makePlayer(), { type: 'startHunt', mobId: 'wolf' }, 0);
const progression = ({ offlineReport: _, ...player }: PlayerState) => player;

describe('Russian game copy', () => {
  it('uses Russian throughout visible catalogue text, currency, and the initial journal', () => {
    const visibleStrings = [
      ...ITEMS.flatMap((item) => [item.name, item.description]),
      ...MOBS.flatMap((mob) => [mob.name, mob.description, mob.location]),
      ...QUESTS.flatMap((quest) => [quest.title, quest.description, quest.giver]),
      ...makePlayer().log.map((entry) => entry.message),
      formatCopper(12345),
    ];
    expect(visibleStrings.every((value) => !/[a-z]/i.test(value))).toBe(true);
    expect(makePlayer().log[0].message).toContain('Добро пожаловать');
  });
});

describe('authoritative intent validation', () => {
  it.each([
    null,
    [],
    'startHunt',
    { type: 'gainXp', xp: 10_000 },
    { type: 'startHunt', mobId: '__proto__' },
    { type: 'startHunt', mobId: 'wolf', xp: 999 },
    { type: 'acceptQuest', questId: 'constructor' },
    { type: 'unequip', slot: 'head' },
    { type: 'equip', itemInstanceId: '' },
    { type: 'stopHunt', hp: 100 },
  ])('rejects invalid or client-authored progression: %j', (input) => {
    expect(() => parseAction(input)).toThrow(GameError);
  });
  it('rejects locked content, unowned equipment, and unfinished quests', () => {
    const player = makePlayer();
    expect(() => applyAction(player, { type: 'startHunt', mobId: 'defias' }, 0)).toThrow();
    expect(() =>
      applyAction(player, { type: 'acceptQuest', questId: 'kobold-cleanup' }, 0),
    ).toThrow();
    expect(() =>
      applyAction(player, { type: 'equip', itemInstanceId: 'someone-elses-item' }, 0),
    ).toThrow();
    expect(() =>
      applyAction(player, { type: 'turnInQuest', questId: 'wolves-at-the-gate' }, 0),
    ).toThrow();
    expect(player.copper).toBe(0);
  });
  it('does not mutate the caller’s state even if an action fails after advancement', () => {
    const original = huntingPlayer(),
      before = structuredClone(original);
    expect(() =>
      applyAction(original, { type: 'equip', itemInstanceId: 'missing' }, 60_000),
    ).toThrow();
    expect(original).toEqual(before);
  });
});

describe('battle turns', () => {
  it('prevents retaliation when the player’s first attack is lethal', () => {
    const player = makePlayer();
    const result = resolveBattleTurn(
      { ...player, stats: getDerivedStats(player) },
      { mobId: 'wolf', hp: 1, maxHp: 22, round: 0 },
      () => 0.5,
    );
    expect(result.won).toBe(true);
    expect(result.hp).toBe(player.hp);
    expect(result.encounter.round).toBe(1);
  });
  it('casts Holy Light below 35% health and spends mana before enemy retaliation', () => {
    const player = makePlayer();
    const result = resolveBattleTurn(
      { ...player, hp: 5, mana: 10, stats: getDerivedStats(player) },
      { mobId: 'wolf', hp: 22, maxHp: 22, round: 0 },
      () => 0.5,
    );
    expect(result.hp).toBe(17);
    expect(result.mana).toBe(1);
    expect(result.encounter.hp).toBe(22);
    expect(result.events[0]).toContain('15');
  });
  it('recovers from defeat without negative resources and resumes the chosen hunt', () => {
    const player = { ...huntingPlayer(), hp: 1, mana: 0 };
    const defeated = advancePlayer(player, TICK_MS, () => 0.5);
    expect(defeated.hp).toBe(0);
    expect(defeated.mode).toBe('resting');
    expect(defeated.totalDeaths).toBe(1);
    expect(defeated.encounter).toBeNull();
    const recovered = advancePlayer(defeated, TICK_MS * 7, () => 0.5);
    expect(recovered.mode).toBe('hunting');
    expect(recovered.hp).toBe(getDerivedStats(recovered).maxHp);
    expect(recovered.mana).toBe(getDerivedStats(recovered).maxMana);
  });
});

describe('time and deterministic simulation', () => {
  it('rejects incompatible saves instead of silently interpreting a new schema', () => {
    const incompatible = { ...makePlayer(), schemaVersion: 2 } as unknown as PlayerState;
    expect(() => advancePlayer(incompatible, TICK_MS)).toThrowError(
      expect.objectContaining({ code: 'STATE_VERSION_UNSUPPORTED' }),
    );
  });
  it('has no advancement on equal or regressed clocks', () => {
    const original = advancePlayer(huntingPlayer(), 30_000);
    expect(advancePlayer(original, 30_000)).toEqual(original);
    expect(advancePlayer(original, 10_000)).toEqual(original);
    expect(() => advancePlayer(original, NaN)).toThrow(GameError);
  });
  it('preserves partial ticks so polling frequency cannot change progression', () => {
    const original = huntingPlayer();
    const once = advancePlayer(original, 120_000);
    let frequent = original;
    for (let now = 777; now < 120_000; now += 777) frequent = advancePlayer(frequent, now);
    frequent = advancePlayer(frequent, 120_000);
    expect(progression(frequent)).toEqual(progression(once));
  });
  it('caps absence to eight hours and permanently discards older elapsed time', () => {
    const original = huntingPlayer();
    const eightHours = advancePlayer(original, MAX_OFFLINE_MS);
    const thirtyDays = advancePlayer(original, 30 * 24 * 60 * 60 * 1000);
    expect(thirtyDays.totalKills).toBe(eightHours.totalKills);
    expect(thirtyDays.copper).toBe(eightHours.copper);
    expect(thirtyDays.rngState).toBe(eightHours.rngState);
    expect(thirtyDays.offlineReport?.simulatedMs).toBe(MAX_OFFLINE_MS);
    expect(thirtyDays.offlineReport?.capped).toBe(true);
    expect(advancePlayer(thirtyDays, thirtyDays.lastAdvancedAt)).toEqual(thirtyDays);
    expect(thirtyDays.nextTickAt).toBe(thirtyDays.lastAdvancedAt + TICK_MS);
  });
  it('does not award progress for idle time or queue an idle backlog', () => {
    const player = advancePlayer(makePlayer(), 100 * MAX_OFFLINE_MS);
    expect(player.totalKills).toBe(0);
    expect(player.copper).toBe(0);
    expect(player.nextTickAt).toBe(player.lastAdvancedAt + TICK_MS);
    const active = applyAction(player, { type: 'startHunt', mobId: 'wolf' }, player.lastAdvancedAt);
    expect(advancePlayer(active, player.lastAdvancedAt + TICK_MS - 1).encounter).toBeNull();
  });
  it('supports deterministic injection and rejects invalid RNG values', () => {
    const original = huntingPlayer();
    expect(advancePlayer(original, 30_000, () => 0.5)).toEqual(
      advancePlayer(original, 30_000, () => 0.5),
    );
    expect(() => advancePlayer(original, TICK_MS, () => 1)).toThrow(GameError);
  });
});

describe('quest and equipment progression', () => {
  it('only counts kills after accepting a quest; rewards cannot be repeated', () => {
    let player = advancePlayer(huntingPlayer(), 60_000, () => 0.5);
    player = applyAction(player, { type: 'acceptQuest', questId: 'wolves-at-the-gate' }, 60_000);
    expect(player.quests[0].kills).toBe(0);
    player = advancePlayer(player, 240_000, () => 0.5);
    expect(player.quests[0].kills).toBe(8);
    const before = player.copper;
    player = applyAction(player, { type: 'turnInQuest', questId: 'wolves-at-the-gate' }, 240_000);
    expect(player.copper).toBe(before + 35);
    expect(player.quests[0].status).toBe('completed');
    expect(player.inventory.some((item) => item.itemId === 'militia-hammer')).toBe(true);
    expect(() =>
      applyAction(player, { type: 'turnInQuest', questId: 'wolves-at-the-gate' }, 240_000),
    ).toThrow();
    expect(() =>
      applyAction(player, { type: 'acceptQuest', questId: 'wolves-at-the-gate' }, 240_000),
    ).toThrow();
    expect(
      applyAction(player, { type: 'acceptQuest', questId: 'kobold-cleanup' }, 240_000).quests,
    ).toHaveLength(2);
  });
  it('enforces item level requirements and never heals through equipment toggling', () => {
    const player = makePlayer();
    player.inventory.push({ instanceId: 'test-rare', itemId: 'abbey-tabard' });
    expect(() => applyAction(player, { type: 'equip', itemInstanceId: 'test-rare' }, 0)).toThrow();
    let wounded = { ...player, hp: 10 };
    wounded = applyAction(wounded, { type: 'unequip', slot: 'armor' }, 0);
    wounded = applyAction(
      wounded,
      { type: 'equip', itemInstanceId: player.inventory[1].instanceId },
      0,
    );
    expect(wounded.hp).toBe(10);
  });
  it('caps inventory and converts overflow drops into copper', () => {
    const player = huntingPlayer();
    while (player.inventory.length < MAX_INVENTORY)
      player.inventory.push({
        instanceId: `filler-${player.inventory.length}`,
        itemId: 'wolf-fang',
      });
    const next = advancePlayer(player, 60_000, () => 0);
    expect(next.inventory).toHaveLength(MAX_INVENTORY);
    expect(next.copper).toBe(next.totalKills * 9);
    expect(next.log.some((entry) => entry.message.includes('Сумка полна'))).toBe(true);
  });
  it('respects both loot probability extremes with a controlled RNG', () => {
    const original = huntingPlayer();
    const guaranteedDrops = advancePlayer(original, 60_000, () => 0);
    const noDrops = advancePlayer(original, 60_000, () => 0.999999);
    expect(guaranteedDrops.totalKills).toBeGreaterThan(0);
    expect(guaranteedDrops.inventory).toHaveLength(
      original.inventory.length + guaranteedDrops.totalKills,
    );
    expect(noDrops.totalKills).toBeGreaterThan(0);
    expect(noDrops.inventory).toEqual(original.inventory);
  });
  it('keeps XP and resources bounded at the level cap', () => {
    const player = advancePlayer(huntingPlayer(), MAX_OFFLINE_MS);
    expect(player.level).toBeLessThanOrEqual(MAX_LEVEL);
    expect(player.xp).toBeGreaterThanOrEqual(0);
    if (player.level === MAX_LEVEL) expect(player.xp).toBe(0);
    else expect(player.xp).toBeLessThan(xpForNextLevel(player.level));
    expect(player.hp).toBeLessThanOrEqual(getDerivedStats(player).maxHp);
    expect(player.mana).toBeLessThanOrEqual(getDerivedStats(player).maxMana);
  });
});
