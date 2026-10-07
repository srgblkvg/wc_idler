import { EQUIPMENT_SLOTS, ITEM_BY_ID, SKILLS } from './content.js';
import type { EquipmentSlot, ItemDefinition, PlayerState, SkillId, SkillState } from './types.js';

type EquipmentOwner = Pick<PlayerState, 'equipment' | 'inventory'>;

export function getItemSlots(item: ItemDefinition): EquipmentSlot[] {
  return item.equipSlots ?? [item.slot];
}

export function getEquippedItem(
  player: EquipmentOwner,
  slot: EquipmentSlot,
): ItemDefinition | null {
  const instance = player.inventory.find((entry) => entry.instanceId === player.equipment[slot]);
  if (!instance) return null;
  const item = ITEM_BY_ID[instance.itemId];
  return getItemSlots(item).includes(slot) ? item : null;
}

/** The API may target either compatible jewellery slot; omitting it fills an empty slot first. */
export function getEquipSlot(
  player: EquipmentOwner,
  item: ItemDefinition,
  preferredSlot?: EquipmentSlot,
): EquipmentSlot {
  return preferredSlot ?? getItemSlots(item).find((slot) => !player.equipment[slot]) ?? item.slot;
}

export function getEquipConflict(
  player: EquipmentOwner & Pick<PlayerState, 'level'>,
  item: ItemDefinition,
  slot?: EquipmentSlot,
): string | null {
  if (slot && !getItemSlots(item).includes(slot))
    return 'Этот предмет нельзя надеть в выбранную ячейку.';
  if (player.level < item.requiredLevel)
    return `Для предмета «${item.name}» нужен уровень ${item.requiredLevel}.`;
  if (item.slot !== 'offhand') return null;
  const weapon = getEquippedItem(player, 'weapon');
  if (weapon?.handType === 'twoHand') return 'Двуручное оружие занимает обе руки.';
  if (item.offhandType === 'dagger' && weapon?.visual.weaponStyle !== 'dagger')
    return 'Нож во второй руке требует кинжал в основной руке.';
  return null;
}

/** Equipment, rather than character level or class, is the sole source of available abilities. */
export function getAvailableSkills(player: EquipmentOwner): SkillId[] {
  const result = new Set<SkillId>();
  for (const slot of EQUIPMENT_SLOTS) {
    for (const skill of getEquippedItem(player, slot)?.grantedSkills ?? []) result.add(skill);
  }
  return [...result];
}

export function createDefaultSkills(loadout: SkillId[] = []): SkillState {
  return {
    loadout: [...loadout],
    cooldowns: Object.fromEntries(SKILLS.map((skill) => [skill.id, 0])) as Record<SkillId, number>,
  };
}

/** Replacing equipment cannot reset recovery for abilities granted by another item later. */
export function reconcileEquipmentSkills(
  player: EquipmentOwner & Pick<PlayerState, 'skills'>,
  fillEmptySlots = false,
): SkillState {
  const available = getAvailableSkills(player);
  const loadout = [...new Set(player.skills.loadout)]
    .filter((id) => available.includes(id))
    .slice(0, 2);
  if (fillEmptySlots) {
    for (const id of available) {
      if (loadout.length === 2) break;
      if (!loadout.includes(id)) loadout.push(id);
    }
  }
  return { loadout, cooldowns: { ...player.skills.cooldowns } };
}
