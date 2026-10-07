import type {
  Appearance,
  ItemDefinition,
  MobDefinition,
  QuestDefinition,
  SkillDefinition,
} from './types.js';

export const STATE_SCHEMA_VERSION = 2 as const;
export const WORLD = {
  title: 'ИРИЙ',
  zone: 'Берёзовый Брод',
  description:
    'За частоколом шумит старый лес. У брода сходятся тропы ратников, травниц и тех, кого лучше не встречать после заката.',
} as const;
export const DEFAULT_APPEARANCE: Appearance = {
  gender: 'male',
  hair: 'dark',
  hairStyle: 'short',
  skin: 'light',
  mark: 'none',
};
export const SKILLS: SkillDefinition[] = [
  {
    id: 'heavyStrike',
    name: 'Тяжёлый удар',
    description:
      'Мощный удар оружием: 160% обычного урона. Применяется автоматически, когда готов.',
    requiredLevel: 1,
    manaCost: 6,
    cooldownTurns: 3,
    policy: 'onCooldown',
  },
  {
    id: 'ward',
    name: 'Оберег',
    description:
      'Древний знак уменьшает урон следующей вражеской атаки на 50%. Не мешает обычному удару.',
    requiredLevel: 2,
    manaCost: 5,
    cooldownTurns: 4,
    policy: 'onCooldown',
  },
  {
    id: 'mend',
    name: 'Живая вода',
    description: 'Восстанавливает здоровье вместо удара, если осталось не более 35% здоровья.',
    requiredLevel: 1,
    manaCost: 10,
    cooldownTurns: 4,
    policy: 'healthBelow',
    healthBelow: 0.35,
  },
];
export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((skill) => [skill.id, skill])) as Record<
  SkillDefinition['id'],
  SkillDefinition
>;

// Stable IDs are storage keys from schema v1, not names in the world. Keep them when changing copy.
export const ITEMS: ItemDefinition[] = [
  {
    id: 'training-hammer',
    name: 'Дубовая булава',
    slot: 'weapon',
    rarity: 'common',
    requiredLevel: 1,
    stats: { attack: 2 },
    description: 'Простая булава, которую выдал кузнец перед первым дозором.',
    visual: { weaponStyle: 'mace', accentColor: '#897044' },
  },
  {
    id: 'recruit-vest',
    name: 'Стёганая рубаха',
    slot: 'armor',
    rarity: 'common',
    requiredLevel: 1,
    stats: { armor: 35, maxHp: 4 },
    description: 'Льняная рубаха с плотной стёжкой бережёт от зубов и колючек.',
    visual: { armorStyle: 'cloth', accentColor: '#a88b56' },
  },
  {
    id: 'wolf-fang',
    name: 'Волчий оберег',
    slot: 'trinket',
    rarity: 'uncommon',
    requiredLevel: 1,
    stats: { attack: 1, maxHp: 3 },
    description: 'Белый клык на кожаном шнурке. Охотники верят, что он отводит беду.',
    visual: { accentColor: '#789163' },
  },
  {
    id: 'militia-hammer',
    name: 'Топор лесного дозора',
    slot: 'weapon',
    rarity: 'uncommon',
    requiredLevel: 2,
    stats: { attack: 5 },
    description: 'Добротный топор кузнеца Твердислава, выкованный для стражей брода.',
    visual: { weaponStyle: 'axe', accentColor: '#74815c' },
  },
  {
    id: "miner's-boots",
    name: 'Кольчуга болотного сторожа',
    slot: 'armor',
    rarity: 'uncommon',
    requiredLevel: 2,
    stats: { armor: 90, maxHp: 8 },
    description: 'Кольца потемнели от воды, но железо ещё держит удар.',
    visual: { armorStyle: 'chain', accentColor: '#738478' },
  },
  {
    id: 'abbey-tabard',
    name: 'Доспех Берёзового Брода',
    slot: 'armor',
    rarity: 'rare',
    requiredLevel: 3,
    stats: { armor: 140, maxHp: 15 },
    description: 'Крепкий кожаный доспех с родовым узором старосты.',
    visual: { armorStyle: 'leather', accentColor: '#657f99' },
  },
  {
    id: 'defias-blade',
    name: 'Меч лихого атамана',
    slot: 'weapon',
    rarity: 'rare',
    requiredLevel: 3,
    stats: { attack: 8, critChance: 0.02 },
    description: 'Широкий меч с насечками: каждая напоминает о чьей-то разбитой повозке.',
    visual: { weaponStyle: 'sword', accentColor: '#748cac' },
  },
  {
    id: 'northshire-signet',
    name: 'Печать хранителя брода',
    slot: 'trinket',
    rarity: 'rare',
    requiredLevel: 3,
    stats: { maxHp: 10, maxMana: 15, attack: 2 },
    description: 'Береста под серебряной оправой хранит знак защитника поселения.',
    visual: { accentColor: '#8092a8' },
  },
  {
    id: 'thunder-axe',
    name: 'Громовой секач',
    slot: 'weapon',
    rarity: 'epic',
    requiredLevel: 3,
    stats: { attack: 12, critChance: 0.04 },
    description: 'Древний топор с грозовым узором. Редкая добыча с болотных лиходеев.',
    visual: { weaponStyle: 'axe', accentColor: '#af88c4' },
  },
];
export const MOBS: MobDefinition[] = [
  {
    id: 'wolf',
    name: 'Лесной волк',
    level: 1,
    hp: 22,
    attack: 4,
    armor: 0,
    xp: 12,
    copper: 4,
    location: 'Берёзовая опушка',
    description:
      'Волки обходят пастушьи костры и тянутся к стадам у брода. У тропы остались потерянные вещи пастухов.',
    loot: [
      { itemId: 'wolf-fang', chance: 0.08 },
      { itemId: 'recruit-vest', chance: 0.1 },
    ],
  },
  {
    id: 'kobold',
    name: 'Трухлявый страж',
    level: 2,
    hp: 38,
    attack: 7,
    armor: 60,
    xp: 21,
    copper: 7,
    location: 'Старый бор',
    description:
      'Лесные стражи вышли к лесорубной тропе, когда кто-то выжег охранные знаки на берёзах.',
    loot: [
      { itemId: "miner's-boots", chance: 0.07 },
      { itemId: 'militia-hammer', chance: 0.04 },
    ],
  },
  {
    id: 'defias',
    name: 'Болотный лиходей',
    level: 3,
    hp: 65,
    attack: 10,
    armor: 100,
    xp: 35,
    copper: 12,
    location: 'Камышовые топи',
    description: 'Люди болотного атамана требуют незаконную пошлину с каждого, кто идёт к броду.',
    loot: [
      { itemId: 'defias-blade', chance: 0.04 },
      { itemId: 'northshire-signet', chance: 0.02 },
      { itemId: 'thunder-axe', chance: 0.005 },
    ],
  },
];
export const QUESTS: QuestDefinition[] = [
  {
    id: 'wolves-at-the-gate',
    title: 'Волчья тропа',
    giver: 'Дарёна-травница',
    requiredLevel: 1,
    description:
      'У Дарёны пропали две овцы, а пастух нашёл следы стаи у берёзовой опушки. Отгони волков от тропы, пока оставшиеся овцы не стали добычей.',
    objective: { mobId: 'wolf', count: 8 },
    rewards: { xp: 55, copper: 35, itemId: 'militia-hammer' },
  },
  {
    id: 'kobold-cleanup',
    title: 'Зарубки на берёзах',
    giver: 'Староста Богдан',
    requiredLevel: 2,
    prerequisite: 'wolves-at-the-gate',
    description:
      'Кто-то выжег охранные зарубки на берёзах. Стражи старого бора вышли к лесорубной тропе и не пропускают обозы с зерном. Оттесни их, пока мы восстановим знаки.',
    objective: { mobId: 'kobold', count: 10 },
    rewards: { xp: 100, copper: 70, itemId: 'abbey-tabard' },
  },
  {
    id: 'defias-brotherhood',
    title: 'Пошлина с брода',
    giver: 'Яромир-дозорный',
    requiredLevel: 3,
    prerequisite: 'kobold-cleanup',
    description:
      'Болотный атаман обложил переправу незаконной данью. Прогони его людей из камышей, чтобы купцы могли пройти к Берёзовому Броду.',
    objective: { mobId: 'defias', count: 12 },
    rewards: { xp: 175, copper: 120, itemId: 'northshire-signet' },
  },
];
export const MOB_BY_ID = Object.fromEntries(MOBS.map((mob) => [mob.id, mob])) as Record<
  MobDefinition['id'],
  MobDefinition
>;
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((item) => [item.id, item])) as Record<
  ItemDefinition['id'],
  ItemDefinition
>;
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((quest) => [quest.id, quest])) as Record<
  QuestDefinition['id'],
  QuestDefinition
>;
export const COMBAT_RULES = {
  armorBase: 400,
  armorPerLevel: 85,
  criticalMultiplier: 2,
  baseCritChance: 0.05,
  baseHitChance: 0.95,
  hitPenaltyPerLevel: 0.02,
  heavyStrikeMultiplier: 1.6,
  wardReduction: 0.5,
} as const;
export const TICK_MS = 3_000;
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1_000;
export const MAX_INVENTORY = 100;
export const MAX_LEVEL = 20;
export const MAX_LOG_ENTRIES = 40;
export const MAX_RECENT_EVENTS = 30;
