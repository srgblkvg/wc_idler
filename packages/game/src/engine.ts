import {
  ITEM_BY_ID,
  MOB_BY_ID,
  QUEST_BY_ID,
  MAX_INVENTORY,
  MAX_LEVEL,
  MAX_LOG_ENTRIES,
  MAX_OFFLINE_MS,
  TICK_MS,
} from './content.js';
import type {
  Encounter,
  GameLog,
  ItemId,
  OfflineReport,
  PlayerState,
  RandomSource,
  Stats,
} from './types.js';
import { GameError, parseAction } from './validation.js';

export function xpForNextLevel(level: number): number {
  return level >= MAX_LEVEL ? 0 : 60 + (level - 1) * 40;
}
export function formatCopper(copper: number): string {
  const amount = Math.max(0, Math.floor(copper));
  const gold = Math.floor(amount / 10_000),
    silver = Math.floor((amount % 10_000) / 100),
    remainder = amount % 100;
  return [gold ? `${gold}з` : '', silver ? `${silver}с` : '', `${remainder}м`]
    .filter(Boolean)
    .join(' ');
}
export function getDerivedStats(
  player: Pick<PlayerState, 'level' | 'equipment' | 'inventory'>,
): Stats {
  const stats: Stats = {
    maxHp: 30 + (player.level - 1) * 12,
    maxMana: 30 + (player.level - 1) * 5,
    attack: 4 + (player.level - 1) * 2,
    armor: Math.floor((player.level - 1) / 2),
  };
  for (const instanceId of Object.values(player.equipment)) {
    const instance = player.inventory.find((item) => item.instanceId === instanceId);
    if (instance)
      for (const [key, value] of Object.entries(ITEM_BY_ID[instance.itemId].stats))
        stats[key as keyof Stats] += value;
  }
  return stats;
}

function addLog(player: PlayerState, at: number, kind: GameLog['kind'], message: string): void {
  player.log.push({ id: player.nextLogId++, at, kind, message });
  if (player.log.length > MAX_LOG_ENTRIES)
    player.log.splice(0, player.log.length - MAX_LOG_ENTRIES);
}
function validTime(now: number): void {
  if (!Number.isSafeInteger(now) || now < 0)
    throw new GameError('INVALID_TIME', 'Время сервера должно быть неотрицательным целым числом.');
}
export function createPlayer({
  id,
  name,
  now = Date.now(),
  rngSeed,
}: {
  id: string;
  name: string;
  now?: number;
  rngSeed?: number;
}): PlayerState {
  validTime(now);
  const trimmed = name.trim();
  if (!id || id.length > 128)
    throw new GameError('INVALID_ID', 'Необходим идентификатор персонажа.');
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '-]{1,23}$/u.test(trimmed))
    throw new GameError(
      'INVALID_NAME',
      'Имя должно содержать от 2 до 24 букв, цифр, пробелов, апострофов или дефисов.',
    );
  if (rngSeed !== undefined && (!Number.isInteger(rngSeed) || rngSeed < 0 || rngSeed > 0xffffffff))
    throw new GameError('INVALID_SEED', 'Некорректное начальное значение генератора.');
  const seed = rngSeed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  const player: PlayerState = {
    schemaVersion: 1,
    id,
    name: trimmed,
    race: 'Human',
    class: 'Paladin',
    zone: 'Northshire Abbey',
    level: 1,
    xp: 0,
    hp: 34,
    mana: 30,
    copper: 0,
    mode: 'idle',
    targetMobId: null,
    encounter: null,
    inventory: [
      { instanceId: `${id}:1`, itemId: 'training-hammer' },
      { instanceId: `${id}:2`, itemId: 'recruit-vest' },
    ],
    equipment: { weapon: `${id}:1`, armor: `${id}:2`, trinket: null },
    quests: [],
    totalKills: 0,
    totalDeaths: 0,
    createdAt: now,
    lastAdvancedAt: now,
    nextTickAt: now + TICK_MS,
    rngState: seed,
    nextItemId: 3,
    nextLogId: 1,
    log: [],
    offlineReport: null,
  };
  addLog(
    player,
    now,
    'system',
    'Добро пожаловать в аббатство Североземья. Маршал Макбрайд ждёт вашей помощи.',
  );
  return player;
}

function randomFor(player: PlayerState, injected?: RandomSource): RandomSource {
  return () => {
    if (injected) {
      const value = injected();
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw new GameError(
          'INVALID_RNG',
          'Значения генератора случайных чисел должны быть в диапазоне [0, 1).',
        );
      return value;
    }
    player.rngState = (player.rngState + 0x6d2b79f5) >>> 0;
    let value = player.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function damage(attack: number, armor: number, random: RandomSource): number {
  return Math.max(1, Math.round(attack * (0.85 + random() * 0.3)) - armor);
}

export interface BattleTurnResult {
  hp: number;
  mana: number;
  encounter: Encounter;
  won: boolean;
  died: boolean;
  events: string[];
}
/** A single player-first turn. Lethal player attacks prevent retaliation. */
export function resolveBattleTurn(
  character: { hp: number; mana: number; level: number; stats: Stats },
  encounter: Encounter,
  random: RandomSource,
): BattleTurnResult {
  const mob = MOB_BY_ID[encounter.mobId];
  let hp = character.hp,
    mana = Math.min(character.stats.maxMana, character.mana + 1);
  const next = { ...encounter, round: encounter.round + 1 },
    events: string[] = [];
  if (hp <= character.stats.maxHp * 0.35 && mana >= 10) {
    const healed = Math.min(character.stats.maxHp - hp, 12 + character.level * 3);
    hp += healed;
    mana -= 10;
    events.push(`Свет небес восстанавливает ${healed} здоровья.`);
  } else {
    const dealt = damage(character.stats.attack, mob.armor, random);
    next.hp = Math.max(0, next.hp - dealt);
    events.push(`Вы наносите ${dealt} урона противнику «${mob.name}».`);
  }
  const won = next.hp === 0;
  if (!won) {
    const received = damage(mob.attack, character.stats.armor, random);
    hp = Math.max(0, hp - received);
    events.push(`${mob.name} наносит вам ${received} урона.`);
  }
  return { hp, mana, encounter: next, won, died: hp === 0, events };
}

function grantXp(player: PlayerState, amount: number, at: number): void {
  if (player.level === MAX_LEVEL) return;
  player.xp += amount;
  while (player.level < MAX_LEVEL && player.xp >= xpForNextLevel(player.level)) {
    player.xp -= xpForNextLevel(player.level);
    player.level++;
    const stats = getDerivedStats(player);
    player.hp = stats.maxHp;
    player.mana = stats.maxMana;
    addLog(player, at, 'level', `Получен уровень ${player.level}! Здоровье и мана восстановлены.`);
  }
  if (player.level === MAX_LEVEL) player.xp = 0;
}
function addItem(player: PlayerState, itemId: ItemId, at: number): boolean {
  if (player.inventory.length >= MAX_INVENTORY) {
    player.copper += 5;
    addLog(
      player,
      at,
      'loot',
      `Сумка полна. Предмет «${ITEM_BY_ID[itemId].name}» разобран за 5 медных монет.`,
    );
    return false;
  }
  player.inventory.push({ instanceId: `${player.id}:${player.nextItemId++}`, itemId });
  addLog(player, at, 'loot', `Получен предмет «${ITEM_BY_ID[itemId].name}».`);
  return true;
}
function tick(player: PlayerState, at: number, random: RandomSource, report: OfflineReport): void {
  const stats = getDerivedStats(player);
  if (player.mode === 'idle') return;
  if (player.mode === 'resting') {
    player.hp = Math.min(stats.maxHp, player.hp + Math.ceil(stats.maxHp * 0.15));
    player.mana = Math.min(stats.maxMana, player.mana + Math.ceil(stats.maxMana * 0.15));
    if (player.hp === stats.maxHp && player.mana === stats.maxMana) {
      player.mode = player.targetMobId ? 'hunting' : 'idle';
      addLog(
        player,
        at,
        'system',
        player.targetMobId
          ? 'Вы восстановились. Охота продолжается.'
          : 'Здоровье и мана полностью восстановлены.',
      );
    }
    return;
  }
  if (!player.targetMobId) {
    player.mode = 'idle';
    return;
  }
  const mob = MOB_BY_ID[player.targetMobId];
  player.encounter ??= { mobId: mob.id, hp: mob.hp, maxHp: mob.hp, round: 0 };
  const result = resolveBattleTurn(
    { hp: player.hp, mana: player.mana, level: player.level, stats },
    player.encounter,
    random,
  );
  player.hp = result.hp;
  player.mana = result.mana;
  player.encounter = result.encounter;
  for (const event of result.events) addLog(player, at, 'combat', event);
  if (result.died) {
    player.totalDeaths++;
    report.deaths++;
    player.encounter = null;
    player.mode = 'resting';
    addLog(
      player,
      at,
      'system',
      'Вы повержены. Восстанавливаетесь в аббатстве, после чего охота продолжится.',
    );
    return;
  }
  if (!result.won) return;
  player.encounter = null;
  player.totalKills++;
  report.kills++;
  report.xp += player.level < MAX_LEVEL ? mob.xp : 0;
  report.copper += mob.copper;
  player.copper += mob.copper;
  grantXp(player, mob.xp, at);
  addLog(
    player,
    at,
    'combat',
    `${mob.name} повержен. +${mob.xp} опыта, +${mob.copper} медных монет.`,
  );
  for (const progress of player.quests) {
    const quest = QUEST_BY_ID[progress.questId];
    if (
      progress.status === 'active' &&
      quest.objective.mobId === mob.id &&
      progress.kills < quest.objective.count
    ) {
      progress.kills++;
      if (progress.kills === quest.objective.count)
        addLog(player, at, 'quest', `Задание «${quest.title}» готово к сдаче.`);
    }
  }
  for (const drop of mob.loot)
    if (random() < drop.chance) {
      const copperBefore = player.copper;
      if (addItem(player, drop.itemId, at)) report.items++;
      report.copper += player.copper - copperBefore;
    }
  if (player.hp <= getDerivedStats(player).maxHp * 0.25) {
    player.mode = 'resting';
    addLog(player, at, 'system', 'Короткий отдых перед следующей схваткой.');
  }
}

/** Advance using server time. Missed time beyond eight hours is discarded, never queued. */
export function advancePlayer(
  original: PlayerState,
  now: number,
  injected?: RandomSource,
): PlayerState {
  if (original.schemaVersion !== 1)
    throw new GameError(
      'STATE_VERSION_UNSUPPORTED',
      'Версия сохранения не поддерживается. Необходима миграция состояния.',
    );
  validTime(now);
  const player = structuredClone(original);
  if (now <= player.lastAdvancedAt) return player;
  const elapsedMs = now - player.lastAdvancedAt,
    simulatedMs = Math.min(elapsedMs, MAX_OFFLINE_MS);
  const report: OfflineReport = {
    elapsedMs,
    simulatedMs,
    capped: elapsedMs > MAX_OFFLINE_MS,
    kills: 0,
    xp: 0,
    copper: 0,
    items: 0,
    deaths: 0,
  };
  const windowStart = now - simulatedMs;
  if (player.nextTickAt <= windowStart && report.capped) player.nextTickAt = windowStart + TICK_MS;
  const random = randomFor(player, injected);
  // Idle characters need no iteration, preserving the tick phase without a catch-up backlog.
  if (player.mode === 'idle') {
    if (player.nextTickAt <= now)
      player.nextTickAt += (Math.floor((now - player.nextTickAt) / TICK_MS) + 1) * TICK_MS;
  } else {
    while (player.nextTickAt <= now) {
      tick(player, player.nextTickAt, random, report);
      player.nextTickAt += TICK_MS;
    }
  }
  player.lastAdvancedAt = now;
  if (elapsedMs >= 60_000) player.offlineReport = report;
  return player;
}

export function applyAction(
  original: PlayerState,
  input: unknown,
  now: number,
  injected?: RandomSource,
): PlayerState {
  const action = parseAction(input),
    player = advancePlayer(original, now, injected);
  switch (action.type) {
    case 'startHunt': {
      const mob = MOB_BY_ID[action.mobId];
      if (player.level < mob.level)
        throw new GameError(
          'LEVEL_REQUIRED',
          `Для противника «${mob.name}» нужен уровень ${mob.level}.`,
        );
      if (player.targetMobId !== action.mobId) player.encounter = null;
      player.targetMobId = action.mobId;
      player.mode = player.hp === 0 ? 'resting' : 'hunting';
      addLog(player, now, 'system', `Охота: ${mob.name}. Место: ${mob.location}.`);
      break;
    }
    case 'stopHunt':
      player.mode = 'idle';
      player.targetMobId = null;
      player.encounter = null;
      addLog(player, now, 'system', 'Охота остановлена.');
      break;
    case 'rest':
      player.mode = 'resting';
      player.targetMobId = null;
      player.encounter = null;
      addLog(player, now, 'system', 'Отдых в аббатстве Североземья.');
      break;
    case 'acceptQuest': {
      const quest = QUEST_BY_ID[action.questId];
      if (player.quests.some((progress) => progress.questId === quest.id))
        throw new GameError('QUEST_ALREADY_ACCEPTED', 'Это задание уже принято.');
      if (player.level < quest.requiredLevel)
        throw new GameError('LEVEL_REQUIRED', `Для задания нужен уровень ${quest.requiredLevel}.`);
      if (
        quest.prerequisite &&
        !player.quests.some(
          (progress) => progress.questId === quest.prerequisite && progress.status === 'completed',
        )
      )
        throw new GameError('PREREQUISITE_REQUIRED', 'Сначала завершите предыдущее задание.');
      player.quests.push({ questId: quest.id, status: 'active', kills: 0 });
      addLog(player, now, 'quest', `Принято задание: ${quest.title}.`);
      break;
    }
    case 'turnInQuest': {
      const quest = QUEST_BY_ID[action.questId],
        progress = player.quests.find((entry) => entry.questId === quest.id);
      if (!progress || progress.status !== 'active' || progress.kills < quest.objective.count)
        throw new GameError('QUEST_NOT_READY', 'Сначала выполните цель задания.');
      progress.status = 'completed';
      player.copper += quest.rewards.copper;
      grantXp(player, quest.rewards.xp, now);
      if (quest.rewards.itemId) addItem(player, quest.rewards.itemId, now);
      addLog(
        player,
        now,
        'quest',
        `Завершено задание: ${quest.title}. +${quest.rewards.xp} опыта, +${quest.rewards.copper} медных монет.`,
      );
      break;
    }
    case 'equip': {
      const instance = player.inventory.find((item) => item.instanceId === action.itemInstanceId);
      if (!instance) throw new GameError('ITEM_NOT_OWNED', 'Этого предмета нет в вашей сумке.');
      const item = ITEM_BY_ID[instance.itemId];
      if (player.level < item.requiredLevel)
        throw new GameError(
          'LEVEL_REQUIRED',
          `Для предмета «${item.name}» нужен уровень ${item.requiredLevel}.`,
        );
      player.equipment[item.slot] = instance.instanceId;
      addLog(player, now, 'system', `Экипирован предмет «${item.name}».`);
      break;
    }
    case 'unequip':
      player.equipment[action.slot] = null;
      break;
  }
  const stats = getDerivedStats(player);
  player.hp = Math.min(player.hp, stats.maxHp);
  player.mana = Math.min(player.mana, stats.maxMana);
  return player;
}
