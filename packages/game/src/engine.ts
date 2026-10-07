import {
  ITEM_BY_ID,
  MOB_BY_ID,
  QUEST_BY_ID,
  MAX_INVENTORY,
  MAX_LEVEL,
  MAX_LOG_ENTRIES,
  MAX_OFFLINE_MS,
  TICK_MS,
  COMBAT_RULES,
  MAX_RECENT_EVENTS,
  SKILL_BY_ID,
  SKILLS,
  EQUIPMENT_SLOTS,
  STATE_SCHEMA_VERSION,
  WORLD,
} from './content.js';
import type {
  Encounter,
  GameLog,
  ItemId,
  OfflineReport,
  PlayerState,
  RandomSource,
  Stats,
  Appearance,
  CombatEvent,
  SkillState,
} from './types.js';
import { GameError, parseAction, parseAppearance } from './validation.js';
import { migratePlayerState } from './migration.js';
import {
  createDefaultSkills,
  getAvailableSkills,
  getEquipConflict,
  getEquippedItem,
  getEquipSlot,
  getItemSlots,
  reconcileEquipmentSkills,
} from './equipment.js';

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
    armor: (player.level - 1) * 10,
    critChance: COMBAT_RULES.baseCritChance,
    hitChance: COMBAT_RULES.baseHitChance,
  };
  for (const instanceId of new Set(Object.values(player.equipment))) {
    const instance = player.inventory.find((item) => item.instanceId === instanceId);
    if (instance)
      for (const [key, value] of Object.entries(ITEM_BY_ID[instance.itemId].stats))
        stats[key as keyof Stats] += value;
  }
  stats.critChance = Math.min(0.5, stats.critChance);
  stats.hitChance = Math.min(0.99, stats.hitChance);
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
  appearance,
}: {
  id: string;
  name: string;
  now?: number;
  rngSeed?: number;
  appearance?: Appearance;
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
    schemaVersion: STATE_SCHEMA_VERSION,
    id,
    name: trimmed,
    race: 'Человек',
    class: 'Ратник',
    zone: WORLD.zone,
    appearance: parseAppearance(appearance),
    skills: createDefaultSkills(),
    combatEvents: [],
    lootEvents: [],
    nextEventId: 1,
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
    equipment: {
      ...(Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => [slot, null]),
      ) as PlayerState['equipment']),
      weapon: `${id}:1`,
      armor: `${id}:2`,
    },
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
  player.skills = reconcileEquipmentSkills(player, true);
  addLog(
    player,
    now,
    'system',
    'Добро пожаловать в Берёзовый Брод. Дарёна-травница ждёт вашей помощи у костра.',
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
export function armorMitigation(armor: number, attackerLevel: number): number {
  return (
    Math.max(0, armor) /
    (Math.max(0, armor) + COMBAT_RULES.armorBase + COMBAT_RULES.armorPerLevel * attackerLevel)
  );
}
function physicalHit(
  attack: number,
  armor: number,
  attackerLevel: number,
  defenderLevel: number,
  critChance: number,
  hitChance: number,
  random: RandomSource,
  multiplier = 1,
): { damage: number; critical: boolean; missed: boolean } {
  const roll = () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new GameError(
        'INVALID_RNG',
        'Значения генератора случайных чисел должны быть в диапазоне [0, 1).',
      );
    return value;
  };
  const chance = Math.max(
    0.5,
    hitChance - Math.max(0, defenderLevel - attackerLevel) * COMBAT_RULES.hitPenaltyPerLevel,
  );
  if (roll() >= chance) return { damage: 0, critical: false, missed: true };
  const critical = roll() < critChance;
  const varied =
    attack * (0.85 + roll() * 0.3) * multiplier * (critical ? COMBAT_RULES.criticalMultiplier : 1);
  return {
    damage: Math.max(1, Math.round(varied * (1 - armorMitigation(armor, attackerLevel)))),
    critical,
    missed: false,
  };
}
export function advanceSkillCooldowns(skills: SkillState, turns = 1): SkillState {
  return {
    loadout: [...skills.loadout],
    cooldowns: Object.fromEntries(
      SKILLS.map((skill) => [skill.id, Math.max(0, skills.cooldowns[skill.id] - turns)]),
    ) as SkillState['cooldowns'],
  };
}
export interface BattleTurnResult {
  hp: number;
  mana: number;
  encounter: Encounter;
  won: boolean;
  died: boolean;
  events: string[];
  combatEvents: Omit<CombatEvent, 'id' | 'timestamp'>[];
  skills: SkillState;
}
/** Player-first physical turn with independent hit, critical and weapon-variance rolls. */
export function resolveBattleTurn(
  character: { hp: number; mana: number; level: number; stats: Stats; skills?: SkillState },
  encounter: Encounter,
  random: RandomSource,
): BattleTurnResult {
  const mob = MOB_BY_ID[encounter.mobId];
  let hp = character.hp,
    mana = Math.min(character.stats.maxMana, character.mana + 1);
  const skills = advanceSkillCooldowns(character.skills ?? createDefaultSkills());
  const next = { ...encounter, round: encounter.round + 1 },
    events: string[] = [],
    combatEvents: BattleTurnResult['combatEvents'] = [];
  const event = (
    kind: CombatEvent['kind'],
    source: CombatEvent['source'],
    target: CombatEvent['target'],
    values: Partial<
      Omit<CombatEvent, 'id' | 'timestamp' | 'kind' | 'source' | 'target' | 'mobId'>
    > = {},
  ) => {
    combatEvents.push({
      kind,
      source,
      target,
      mobId: mob.id,
      damage: 0,
      healing: 0,
      critical: false,
      missed: false,
      ability: null,
      ...values,
    });
  };
  const ready = skills.loadout.filter((id) => {
    const skill = SKILL_BY_ID[id];
    return skills.cooldowns[id] === 0 && mana >= skill.manaCost;
  });
  // A configured survival skill takes priority over attacks at its health threshold.
  const survival = ready.find(
    (id) =>
      SKILL_BY_ID[id].policy === 'healthBelow' &&
      hp <= character.stats.maxHp * SKILL_BY_ID[id].healthBelow!,
  );
  const selected = survival ?? ready.find((id) => SKILL_BY_ID[id].policy === 'onCooldown');
  if (selected) {
    mana -= SKILL_BY_ID[selected].manaCost;
    skills.cooldowns[selected] = SKILL_BY_ID[selected].cooldownTurns;
  }
  if (selected === 'mend' || selected === 'secondWind') {
    const amount =
      selected === 'mend'
        ? 12 + character.level * 3
        : Math.max(1, Math.round(character.stats.maxHp * COMBAT_RULES.secondWindFraction));
    const healed = Math.min(character.stats.maxHp - hp, amount);
    hp += healed;
    events.push(`${SKILL_BY_ID[selected].name}: восстановлено ${healed} здоровья.`);
    event('heal', 'player', 'player', { healing: healed, ability: selected });
  } else {
    if (selected === 'ward') {
      events.push('Заслон ослабляет следующую вражескую атаку.');
      event('ward', 'player', 'player', { ability: 'ward' });
    }
    const hits = selected === 'flurry' ? 2 : 1;
    for (let strike = 0; strike < hits && next.hp > 0; strike++) {
      const hit = physicalHit(
        character.stats.attack,
        mob.armor,
        character.level,
        mob.level,
        character.stats.critChance,
        character.stats.hitChance,
        random,
        selected === 'heavyStrike'
          ? COMBAT_RULES.heavyStrikeMultiplier
          : selected === 'flurry'
            ? COMBAT_RULES.flurryHitMultiplier
            : 1,
      );
      next.hp = Math.max(0, next.hp - hit.damage);
      const ability =
        selected === 'heavyStrike' || selected === 'flurry' ? selected : 'basicAttack';
      events.push(
        hit.missed
          ? `Ваш удар по противнику «${mob.name}» не достиг цели.`
          : `${ability === 'basicAttack' ? 'Вы' : SKILL_BY_ID[ability].name}: ${hit.damage} урона противнику «${mob.name}»${hit.critical ? ' — критический удар' : ''}.`,
      );
      event('attack', 'player', 'enemy', { ...hit, ability });
    }
  }
  const won = next.hp === 0;
  if (!won) {
    const hit = physicalHit(
      mob.attack,
      character.stats.armor,
      mob.level,
      character.level,
      COMBAT_RULES.baseCritChance,
      COMBAT_RULES.baseHitChance,
      random,
    );
    const received =
      selected === 'ward' && !hit.missed
        ? Math.max(1, Math.round(hit.damage * (1 - COMBAT_RULES.wardReduction)))
        : hit.damage;
    hp = Math.max(0, hp - received);
    events.push(
      hit.missed
        ? `${mob.name} промахивается.`
        : `${mob.name} наносит вам ${received} урона${hit.critical ? ' — критический удар' : ''}.`,
    );
    event('attack', 'enemy', 'player', { ...hit, damage: received, ability: 'basicAttack' });
  }
  if (won) event('victory', 'player', 'enemy');
  if (hp === 0) event('defeat', 'enemy', 'player');
  return { hp, mana, encounter: next, won, died: hp === 0, events, combatEvents, skills };
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
function addItem(
  player: PlayerState,
  itemId: ItemId,
  at: number,
  source: 'drop' | 'quest' = 'drop',
): boolean {
  const full = player.inventory.length >= MAX_INVENTORY;
  const instanceId = full ? null : `${player.id}:${player.nextItemId++}`;
  player.lootEvents.push({
    id: player.nextEventId++,
    timestamp: at,
    itemId,
    instanceId,
    source,
    rarity: ITEM_BY_ID[itemId].rarity,
    salvaged: full,
  });
  if (player.lootEvents.length > MAX_RECENT_EVENTS)
    player.lootEvents.splice(0, player.lootEvents.length - MAX_RECENT_EVENTS);
  if (full) {
    player.copper += 5;
    addLog(
      player,
      at,
      'loot',
      `Сумка полна. Предмет «${ITEM_BY_ID[itemId].name}» разобран за 5 медных монет.`,
    );
    return false;
  }
  player.inventory.push({ instanceId: instanceId!, itemId });
  addLog(player, at, 'loot', `Получен предмет «${ITEM_BY_ID[itemId].name}».`);
  return true;
}
function tick(player: PlayerState, at: number, random: RandomSource, report: OfflineReport): void {
  const stats = getDerivedStats(player);
  if (player.mode === 'idle') {
    player.skills = advanceSkillCooldowns(player.skills);
    return;
  }
  if (player.mode === 'resting') {
    player.skills = advanceSkillCooldowns(player.skills);
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
    { hp: player.hp, mana: player.mana, level: player.level, stats, skills: player.skills },
    player.encounter,
    random,
  );
  player.hp = result.hp;
  player.mana = result.mana;
  player.encounter = result.encounter;
  player.skills = result.skills;
  for (const event of result.combatEvents)
    player.combatEvents.push({ ...event, id: player.nextEventId++, timestamp: at });
  if (player.combatEvents.length > MAX_RECENT_EVENTS)
    player.combatEvents.splice(0, player.combatEvents.length - MAX_RECENT_EVENTS);
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
      'Вы повержены. Восстанавливаетесь у костра в Берёзовом Броду, после чего охота продолжится.',
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
  original: unknown,
  now: number,
  injected?: RandomSource,
): PlayerState {
  validTime(now);
  const player = migratePlayerState(original);
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
    if (player.nextTickAt <= now) {
      const turns = Math.floor((now - player.nextTickAt) / TICK_MS) + 1;
      player.skills = advanceSkillCooldowns(player.skills, turns);
      player.nextTickAt += turns * TICK_MS;
    }
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
      addLog(player, now, 'system', 'Отдых у костра в Берёзовом Броду.');
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
      if (quest.rewards.itemId) addItem(player, quest.rewards.itemId, now, 'quest');
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
      if (action.slot && !getItemSlots(item).includes(action.slot))
        throw new GameError(
          'INVALID_EQUIPMENT_SLOT',
          'Этот предмет нельзя надеть в выбранную ячейку.',
        );
      if (player.level < item.requiredLevel)
        throw new GameError(
          'LEVEL_REQUIRED',
          `Для предмета «${item.name}» нужен уровень ${item.requiredLevel}.`,
        );
      const conflict = getEquipConflict(player, item, action.slot);
      if (conflict) throw new GameError('EQUIPMENT_CONFLICT', conflict);
      const wornSlot = EQUIPMENT_SLOTS.find(
        (slot) => player.equipment[slot] === instance.instanceId,
      );
      const slot = action.slot ?? wornSlot ?? getEquipSlot(player, item);
      if (slot === 'weapon') {
        const offhand = getEquippedItem(player, 'offhand');
        if (
          item.handType === 'twoHand' ||
          (offhand?.offhandType === 'dagger' && item.visual.weaponStyle !== 'dagger')
        )
          player.equipment.offhand = null;
      }
      // An owned instance may move between compatible jewellery slots, but never occupy both.
      for (const occupied of EQUIPMENT_SLOTS) {
        if (player.equipment[occupied] === instance.instanceId) player.equipment[occupied] = null;
      }
      player.equipment[slot] = instance.instanceId;
      player.skills = reconcileEquipmentSkills(player, true);
      addLog(player, now, 'system', `Экипирован предмет «${item.name}».`);
      break;
    }
    case 'unequip':
      player.equipment[action.slot] = null;
      if (action.slot === 'weapon' && getEquippedItem(player, 'offhand')?.offhandType === 'dagger')
        player.equipment.offhand = null;
      player.skills = reconcileEquipmentSkills(player, true);
      break;
    case 'setSkills': {
      const available = getAvailableSkills(player);
      if (action.skills.some((id) => !available.includes(id)))
        throw new GameError(
          'SKILL_NOT_GRANTED',
          'Для выбранного умения нужно надеть соответствующее снаряжение.',
        );
      player.skills.loadout = [...action.skills];
      addLog(
        player,
        now,
        'system',
        `Умения для охоты: ${action.skills.map((id) => SKILL_BY_ID[id].name).join(', ') || 'только обычные удары'}.`,
      );
      break;
    }
  }
  const stats = getDerivedStats(player);
  player.hp = Math.min(player.hp, stats.maxHp);
  player.mana = Math.min(player.mana, stats.maxMana);
  return player;
}
