import {
  EQUIPMENT_SLOTS,
  ITEM_BY_ID,
  SKILL_BY_ID,
  SKILLS,
  STATE_SCHEMA_VERSION,
  WORLD,
} from './content.js';
import {
  createDefaultSkills,
  getEquippedItem,
  getItemSlots,
  reconcileEquipmentSkills,
} from './equipment.js';
import type { PlayerState, SkillId } from './types.js';
import { GameError, parseAppearance } from './validation.js';

export { createDefaultSkills } from './equipment.js';

function invalidState(message = 'Сохранение персонажа повреждено.'): never {
  throw new GameError('STATE_INVALID', message);
}

/** Stable storage keys preserve inventory and progression while schema 3 adds individual gear slots. */
export function migratePlayerState(input: unknown): PlayerState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalidState();
  const candidate = input as Record<string, unknown>;
  const version = candidate.schemaVersion;
  if (version !== 1 && version !== 2 && version !== STATE_SCHEMA_VERSION)
    throw new GameError(
      'STATE_VERSION_UNSUPPORTED',
      'Версия сохранения не поддерживается. Необходима миграция состояния.',
    );
  if (
    !Array.isArray(candidate.inventory) ||
    !Array.isArray(candidate.quests) ||
    !candidate.equipment ||
    typeof candidate.equipment !== 'object' ||
    Array.isArray(candidate.equipment) ||
    !Array.isArray(candidate.log)
  )
    invalidState();
  const player = structuredClone(input) as PlayerState;
  const instances = new Map<string, (typeof player.inventory)[number]>();
  for (const instance of player.inventory) {
    if (
      !instance ||
      typeof instance.instanceId !== 'string' ||
      !instance.instanceId ||
      instances.has(instance.instanceId) ||
      !Object.hasOwn(ITEM_BY_ID, instance.itemId)
    )
      invalidState('В сохранении найден неизвестный или повторный предмет.');
    instances.set(instance.instanceId, instance);
  }
  const legacyEquipment = candidate.equipment as Record<string, unknown>;
  const equipment = Object.fromEntries(
    EQUIPMENT_SLOTS.map((slot) => [slot, null]),
  ) as PlayerState['equipment'];
  const equippedInstances = new Set<string>();
  for (const slot of EQUIPMENT_SLOTS) {
    const instanceId =
      slot === 'offhand' && version < 3
        ? (legacyEquipment.offhand ?? legacyEquipment.trinket)
        : legacyEquipment[slot];
    if (instanceId === undefined || instanceId === null) continue;
    if (typeof instanceId !== 'string' || equippedInstances.has(instanceId))
      invalidState('Один предмет нельзя надеть в несколько ячеек.');
    const instance = instances.get(instanceId);
    if (!instance || !getItemSlots(ITEM_BY_ID[instance.itemId]).includes(slot))
      invalidState('Предмет в сохранении находится в неверной ячейке.');
    equipment[slot] = instanceId;
    equippedInstances.add(instanceId);
  }
  player.equipment = equipment;
  const weapon = getEquippedItem(player, 'weapon');
  const offhand = getEquippedItem(player, 'offhand');
  if (
    weapon?.handType === 'twoHand' ||
    (offhand?.offhandType === 'dagger' && weapon?.visual.weaponStyle !== 'dagger')
  ) {
    // Former single-slot axes become two-handed; preserve the displaced item in the bag.
    player.equipment.offhand = null;
  }
  if (version === 1) {
    player.race = 'Человек';
    player.class = 'Ратник';
    player.zone = WORLD.zone;
    player.appearance = parseAppearance(undefined);
    player.skills = createDefaultSkills();
    player.combatEvents = [];
    player.lootEvents = [];
    player.nextEventId = 1;
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
      typeof player.skills.cooldowns !== 'object' ||
      Array.isArray(player.skills.cooldowns) ||
      !Array.isArray(player.combatEvents) ||
      !Array.isArray(player.lootEvents)
    )
      invalidState();
    if (
      player.skills.loadout.some((id) => typeof id !== 'string' || !Object.hasOwn(SKILL_BY_ID, id))
    )
      invalidState('В сохранении найдено неизвестное умение.');
    const previous = player.skills.cooldowns;
    const cooldowns = createDefaultSkills().cooldowns;
    for (const skill of SKILLS) {
      const remaining = previous[skill.id];
      if (remaining === undefined && version < 3) continue;
      if (!Number.isSafeInteger(remaining) || remaining < 0)
        invalidState('В сохранении неверно указано восстановление умения.');
      cooldowns[skill.id] = remaining;
    }
    player.skills = { loadout: [...player.skills.loadout] as SkillId[], cooldowns };
  }
  player.skills = reconcileEquipmentSkills(player, version < 3);
  player.schemaVersion = STATE_SCHEMA_VERSION;
  return player;
}
