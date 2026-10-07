import { DEFAULT_APPEARANCE, MOB_BY_ID, QUEST_BY_ID, SKILL_BY_ID } from './content.js';
import type { Appearance, GameAction } from './types.js';

export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

export function parseAppearance(input: unknown): Appearance {
  if (input === undefined) return { ...DEFAULT_APPEARANCE };
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new GameError('INVALID_APPEARANCE', 'Выберите внешность персонажа.');
  const value = input as Record<string, unknown>;
  const options: Record<keyof Appearance, string[]> = {
    gender: ['male', 'female'],
    hair: ['dark', 'fair', 'red'],
    hairStyle: ['short', 'braid'],
    skin: ['light', 'tan'],
    mark: ['none', 'scar'],
  };
  if (
    Object.keys(value).length !== Object.keys(options).length ||
    Object.keys(value).some((key) => !Object.hasOwn(options, key))
  )
    throw new GameError('INVALID_APPEARANCE', 'Внешность содержит недопустимые параметры.');
  for (const [key, allowed] of Object.entries(options))
    if (typeof value[key] !== 'string' || !allowed.includes(value[key] as string))
      throw new GameError('INVALID_APPEARANCE', 'Выберите доступные параметры внешности.');
  return { ...value } as unknown as Appearance;
}

/** Only these intent fields are accepted; all progression is calculated on the server. */
export function parseAction(input: unknown): GameAction {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new GameError('INVALID_ACTION', 'Действие должно быть объектом.');
  const value = input as Record<string, unknown>;
  let keys: string[];
  switch (value.type) {
    case 'startHunt':
      keys = ['type', 'mobId'];
      if (typeof value.mobId !== 'string' || !Object.hasOwn(MOB_BY_ID, value.mobId))
        throw new GameError('INVALID_ACTION', 'Выберите существующего противника.');
      break;
    case 'acceptQuest':
    case 'turnInQuest':
      keys = ['type', 'questId'];
      if (typeof value.questId !== 'string' || !Object.hasOwn(QUEST_BY_ID, value.questId))
        throw new GameError('INVALID_ACTION', 'Выберите существующее задание.');
      break;
    case 'equip':
      keys = ['type', 'itemInstanceId'];
      if (
        typeof value.itemInstanceId !== 'string' ||
        value.itemInstanceId.length < 1 ||
        value.itemInstanceId.length > 128
      )
        throw new GameError('INVALID_ACTION', 'Выберите предмет из сумки.');
      break;
    case 'unequip':
      keys = ['type', 'slot'];
      if (!['weapon', 'armor', 'trinket'].includes(value.slot as string))
        throw new GameError('INVALID_ACTION', 'Выберите доступную ячейку экипировки.');
      break;
    case 'setSkills':
      keys = ['type', 'skills'];
      if (
        !Array.isArray(value.skills) ||
        value.skills.length > 2 ||
        new Set(value.skills).size !== value.skills.length ||
        value.skills.some(
          (skill) => typeof skill !== 'string' || !Object.hasOwn(SKILL_BY_ID, skill),
        )
      )
        throw new GameError('INVALID_SKILLS', 'Выберите не более двух разных доступных умений.');
      break;
    case 'stopHunt':
    case 'rest':
      keys = ['type'];
      break;
    default:
      throw new GameError('INVALID_ACTION', 'Неизвестное действие.');
  }
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new GameError('INVALID_ACTION', 'В действии есть лишние поля.');
  return { ...value } as GameAction;
}
