import { describe, expect, it } from 'vitest';
import { createPlayer, type CombatEvent } from '@azeroth/game';
import { presentedEnemyHealth } from './BattleCards';

const attack = (id: number, damage: number, extra: Partial<CombatEvent> = {}): CombatEvent => ({
  id,
  timestamp: 1_800_000_000_000,
  kind: 'attack',
  source: 'player',
  target: 'enemy',
  mobId: 'wolf',
  damage,
  healing: 0,
  critical: false,
  missed: false,
  ability: 'basicAttack',
  ...extra,
});

describe('displayed health at the card impact', () => {
  it('holds pending damage until its impact when a poll contains multiple attacks', () => {
    const player = createPlayer({
      id: 'health-fixture',
      name: 'Яромир',
      now: 1_800_000_000_000,
      rngSeed: 1,
    });
    player.encounter = { mobId: 'wolf', hp: 8, maxHp: 22, round: 2 };
    player.combatEvents = [attack(1, 6), attack(2, 8)];
    expect(presentedEnemyHealth(player, player.combatEvents[0], false, 'wolf')).toBe(22);
    expect(presentedEnemyHealth(player, player.combatEvents[0], true, 'wolf')).toBe(16);
    expect(presentedEnemyHealth(player, player.combatEvents[1], false, 'wolf')).toBe(16);
    expect(presentedEnemyHealth(player, player.combatEvents[1], true, 'wolf')).toBe(8);
  });

  it('does not invent healing before an overkill attack', () => {
    const player = createPlayer({
      id: 'overkill-fixture',
      name: 'Яромир',
      now: 1_800_000_000_000,
      rngSeed: 1,
    });
    player.encounter = null;
    player.combatEvents = [attack(1, 16), attack(2, 8), attack(3, 0, { kind: 'victory' })];
    expect(presentedEnemyHealth(player, player.combatEvents[1], false, 'wolf')).toBe(6);
    expect(presentedEnemyHealth(player, player.combatEvents[1], true, 'wolf')).toBe(0);
  });
});
