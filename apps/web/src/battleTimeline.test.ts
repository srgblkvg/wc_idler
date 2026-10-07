import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatEvent, LootEvent } from '@azeroth/game';
import { BattleTimeline, BATTLE_TIMING, type BattleSnapshot } from './battleTimeline';

const now = 1_800_000_000_000;
const attack = (id: number, extra: Partial<CombatEvent> = {}): CombatEvent => ({
  id,
  timestamp: now,
  kind: 'attack',
  source: 'player',
  target: 'enemy',
  mobId: 'wolf',
  damage: 6,
  healing: 0,
  critical: false,
  missed: false,
  ability: 'basicAttack',
  ...extra,
});
const drop = (id: number, extra: Partial<LootEvent> = {}): LootEvent => ({
  id,
  timestamp: now,
  itemId: 'wolf-fang',
  instanceId: `loot-${id}`,
  source: 'drop',
  rarity: 'uncommon',
  salvaged: false,
  ...extra,
});
const snapshot = (extra: Partial<BattleSnapshot> = {}): BattleSnapshot => ({
  id: 'first-player',
  targetMobId: 'wolf',
  combatEvents: [],
  lootEvents: [],
  inventory: [],
  equipment: {
    weapon: null,
    armor: null,
    helmet: null,
    gloves: null,
    legs: null,
    feet: null,
    offhand: null,
    ring1: null,
    ring2: null,
    earring1: null,
    earring2: null,
    belt: null,
    cloak: null,
    amulet: null,
  },
  ...extra,
});

describe('battle presentation timeline', () => {
  let timeline: BattleTimeline;
  const presented: number[] = [];
  const shownLoot: number[] = [];
  const sequence: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    presented.length = 0;
    shownLoot.length = 0;
    sequence.length = 0;
    timeline = new BattleTimeline(
      (event) => {
        if (event) {
          presented.push(event.id);
          sequence.push(`combat-${event.id}`);
        }
      },
      (event) => {
        if (event) {
          shownLoot.push(event.id);
          sequence.push(`loot-${event.id}`);
        }
      },
    );
  });

  afterEach(() => {
    timeline.dispose();
    vi.useRealTimers();
  });

  it('does not replay persisted combat or loot on initial load', () => {
    timeline.synchronize(snapshot({ combatEvents: [attack(1)], lootEvents: [drop(2)] }));
    vi.runAllTimers();
    expect(sequence).toEqual([]);
    timeline.synchronize(snapshot({ combatEvents: [attack(1), attack(3)] }));
    expect(presented).toEqual([3]);
  });

  it('keeps events ordered across overlapping polls without replaying duplicate payloads', () => {
    timeline.synchronize(snapshot());
    timeline.synchronize(snapshot({ combatEvents: [attack(2), attack(1)] }));
    expect(presented).toEqual([1]);
    vi.advanceTimersByTime(200);
    const latest = snapshot({ combatEvents: [attack(3), attack(1), attack(2)] });
    timeline.synchronize(latest);
    timeline.synchronize(latest);
    vi.advanceTimersByTime(BATTLE_TIMING.attack - 200);
    expect(presented).toEqual([1, 2]);
    vi.runAllTimers();
    expect(presented).toEqual([1, 2, 3]);
  });

  it('cancels queued events when the character changes and suppresses new character history', () => {
    timeline.synchronize(snapshot());
    timeline.synchronize(snapshot({ combatEvents: [attack(1), attack(2)] }));
    timeline.synchronize(snapshot({ id: 'second-player', combatEvents: [attack(7)] }));
    vi.runAllTimers();
    expect(presented).toEqual([1]);
    timeline.synchronize(snapshot({ id: 'second-player', combatEvents: [attack(7), attack(8)] }));
    expect(presented).toEqual([1, 8]);
  });

  it('cancels old location attacks and presents only events for the current opponent', () => {
    timeline.synchronize(snapshot());
    timeline.synchronize(snapshot({ combatEvents: [attack(1), attack(2)] }));
    timeline.synchronize(
      snapshot({
        targetMobId: 'kobold',
        combatEvents: [attack(1), attack(2), attack(3), attack(4, { mobId: 'kobold' })],
      }),
    );
    vi.runAllTimers();
    expect(presented).toEqual([1, 4]);
  });

  it('skips offline history and consumes it so later polls cannot replay it', () => {
    timeline.synchronize(snapshot());
    const historical = attack(1, { timestamp: now - 10_001 });
    timeline.synchronize(snapshot({ combatEvents: [historical, attack(2)] }));
    vi.runAllTimers();
    timeline.synchronize(snapshot({ combatEvents: [historical, attack(2)] }));
    vi.runAllTimers();
    expect(presented).toEqual([2]);
  });

  it('consumes events received while hidden and does not replay them on resume', () => {
    timeline.synchronize(snapshot());
    timeline.setVisible(false);
    const hidden = snapshot({ combatEvents: [attack(1)] });
    timeline.synchronize(hidden);
    timeline.setVisible(true);
    timeline.synchronize(hidden);
    vi.runAllTimers();
    expect(presented).toEqual([]);
  });

  it('does not replay the hidden interval when network polling was suspended', () => {
    timeline.synchronize(snapshot());
    timeline.setVisible(false);
    vi.advanceTimersByTime(5000);
    timeline.setVisible(true);
    timeline.synchronize(snapshot({ combatEvents: [attack(1, { timestamp: now + 3000 })] }));
    vi.runAllTimers();
    expect(presented).toEqual([]);
    vi.advanceTimersByTime(1);
    timeline.synchronize(
      snapshot({
        combatEvents: [attack(1, { timestamp: now + 3000 }), attack(2, { timestamp: Date.now() })],
      }),
    );
    expect(presented).toEqual([2]);
  });

  it('reveals a real owned drop after the victory animation has finished', () => {
    timeline.synchronize(snapshot());
    timeline.synchronize(
      snapshot({
        combatEvents: [attack(1), attack(2, { kind: 'victory', damage: 0 })],
        lootEvents: [drop(3)],
        inventory: [{ instanceId: 'loot-3', itemId: 'wolf-fang' }],
      }),
    );
    expect(sequence).toEqual(['combat-1']);
    vi.advanceTimersByTime(BATTLE_TIMING.attack);
    expect(sequence).toEqual(['combat-1', 'combat-2']);
    vi.advanceTimersByTime(BATTLE_TIMING.victory - 1);
    expect(shownLoot).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sequence).toEqual(['combat-1', 'combat-2', 'loot-3']);
  });

  it('keeps each loot notice until dismissed and skips sold, salvaged or equipped items', () => {
    timeline.synchronize(snapshot());
    timeline.synchronize(
      snapshot({
        lootEvents: [drop(1), drop(2), drop(3), drop(4), drop(5, { salvaged: true })],
        inventory: [1, 2, 4, 5].map((id) => ({ instanceId: `loot-${id}`, itemId: 'wolf-fang' })),
        equipment: { ...snapshot().equipment, offhand: 'loot-4' },
      }),
    );
    expect(shownLoot).toEqual([1]);
    timeline.dismissLoot();
    expect(shownLoot).toEqual([1, 2]);
    timeline.dismissLoot();
    expect(shownLoot).toEqual([1, 2]);
  });

  it('cancels all queued callbacks after disposal', () => {
    timeline.synchronize(snapshot());
    timeline.synchronize(snapshot({ combatEvents: [attack(1), attack(2)] }));
    timeline.dispose();
    vi.runAllTimers();
    timeline.synchronize(snapshot({ combatEvents: [attack(3)] }));
    expect(presented).toEqual([1]);
  });

  it('keeps owned loot while another game page suppresses combat and return does not replay it', () => {
    timeline.synchronize(snapshot());
    const looted = snapshot({
      combatEvents: [attack(1), attack(2, { kind: 'victory', damage: 0 })],
      lootEvents: [drop(3)],
      inventory: [{ instanceId: 'loot-3', itemId: 'wolf-fang' }],
    });
    timeline.synchronize(looted);
    expect(presented).toEqual([1]);
    timeline.setActive(false);
    vi.runAllTimers();
    expect(presented).toEqual([1]);
    expect(shownLoot).toEqual([3]);
    vi.advanceTimersByTime(3_000);
    const whileAway = {
      ...looted,
      combatEvents: [...looted.combatEvents, attack(4, { timestamp: Date.now() })],
    };
    timeline.synchronize(whileAway);
    timeline.setActive(true);
    timeline.synchronize(whileAway);
    vi.runAllTimers();
    expect(presented).toEqual([1]);
    expect(shownLoot).toEqual([3]);
    vi.advanceTimersByTime(1);
    timeline.synchronize({
      ...whileAway,
      combatEvents: [...whileAway.combatEvents, attack(5, { timestamp: Date.now() })],
    });
    expect(presented).toEqual([1, 5]);
  });
});
