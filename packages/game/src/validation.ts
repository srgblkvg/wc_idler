import { MOB_BY_ID, QUEST_BY_ID } from './content.js';
import type { GameAction } from './types.js';

export class GameError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
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
