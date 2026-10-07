import { ITEM_BY_ID, STATE_SCHEMA_VERSION, WORLD } from './content.js';
import type { PlayerState, SkillState } from './types.js';
import { GameError, parseAppearance } from './validation.js';

export function createDefaultSkills(): SkillState {
  return { loadout: ['heavyStrike', 'mend'], cooldowns: { heavyStrike: 0, ward: 0, mend: 0 } };
}

/** Stable storage keys preserve equipment, quests and progression across the world rewrite. */
export function migratePlayerState(input: unknown): PlayerState {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new GameError('STATE_INVALID', 'Сохранение персонажа повреждено.');
  const candidate = input as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 && candidate.schemaVersion !== STATE_SCHEMA_VERSION)
    throw new GameError(
      'STATE_VERSION_UNSUPPORTED',
      'Версия сохранения не поддерживается. Необходима миграция состояния.',
    );
  if (
    !Array.isArray(candidate.inventory) ||
    !Array.isArray(candidate.quests) ||
    !candidate.equipment ||
    !Array.isArray(candidate.log)
  )
    throw new GameError('STATE_INVALID', 'Сохранение персонажа повреждено.');
  const player = structuredClone(input) as PlayerState;
  for (const instance of player.inventory)
    if (!instance || !Object.hasOwn(ITEM_BY_ID, instance.itemId))
      throw new GameError('STATE_INVALID', 'В сохранении найден неизвестный предмет.');
  if (candidate.schemaVersion === 1) {
    player.schemaVersion = STATE_SCHEMA_VERSION;
    player.race = 'Человек';
    player.class = 'Ратник';
    player.zone = WORLD.zone;
    player.appearance = parseAppearance(undefined);
    player.skills = createDefaultSkills();
    player.combatEvents = [];
    player.lootEvents = [];
    player.nextEventId = 1;
    // Old prose refers to a different world; retain counters and replace only the journal copy.
    player.log = [
      {
        id: player.nextLogId++,
        at: player.lastAdvancedAt,
        kind: 'system',
        message:
          'Вы прибыли в Берёзовый Брод. Добыча, снаряжение и завершённые поручения сохранены.',
      },
    ];
  } else {
    player.appearance = parseAppearance(player.appearance);
    if (
      !player.skills ||
      !Array.isArray(player.skills.loadout) ||
      !player.skills.cooldowns ||
      !Array.isArray(player.combatEvents) ||
      !Array.isArray(player.lootEvents)
    )
      throw new GameError('STATE_INVALID', 'Сохранение персонажа повреждено.');
  }
  return player;
}
