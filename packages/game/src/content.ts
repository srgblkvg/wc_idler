import type { ItemDefinition, MobDefinition, QuestDefinition } from './types.js';

export const ITEMS: ItemDefinition[] = [
  {
    id: 'training-hammer',
    name: 'Учебный молот',
    slot: 'weapon',
    rarity: 'common',
    requiredLevel: 1,
    stats: { attack: 2 },
    description: 'Потёртый молот из оружейной аббатства.',
  },
  {
    id: 'recruit-vest',
    name: 'Жилет новобранца',
    slot: 'armor',
    rarity: 'common',
    requiredLevel: 1,
    stats: { armor: 1, maxHp: 4 },
    description: 'Простой кожаный жилет для первых приключений.',
  },
  {
    id: 'wolf-fang',
    name: 'Безупречный волчий клык',
    slot: 'trinket',
    rarity: 'uncommon',
    requiredLevel: 1,
    stats: { attack: 1, maxHp: 3 },
    description: 'Небольшой трофей с полей Североземья.',
  },
  {
    id: 'militia-hammer',
    name: 'Молот ополченца',
    slot: 'weapon',
    rarity: 'uncommon',
    requiredLevel: 2,
    stats: { attack: 5 },
    description: 'Надёжное оружие защитников аббатства.',
  },
  {
    id: "miner's-boots",
    name: 'Кольчуга шахтёра',
    slot: 'armor',
    rarity: 'uncommon',
    requiredLevel: 2,
    stats: { armor: 3, maxHp: 8 },
    description: 'Кольчуга, найденная в руднике Горного Эха.',
  },
  {
    id: 'abbey-tabard',
    name: 'Накидка защитника аббатства',
    slot: 'armor',
    rarity: 'rare',
    requiredLevel: 3,
    stats: { armor: 4, maxHp: 15 },
    description: 'Награда за защиту жителей Североземья.',
  },
  {
    id: 'defias-blade',
    name: 'Ятаган Братства',
    slot: 'weapon',
    rarity: 'rare',
    requiredLevel: 3,
    stats: { attack: 8 },
    description: 'Сбалансированный клинок налётчика с виноградников.',
  },
  {
    id: 'northshire-signet',
    name: 'Печать Североземья',
    slot: 'trinket',
    rarity: 'rare',
    requiredLevel: 3,
    stats: { maxHp: 10, maxMana: 15, attack: 2 },
    description: 'Печать аббатства, которую носят у самого сердца.',
  },
];

export const MOBS: MobDefinition[] = [
  {
    id: 'wolf',
    name: 'Молодой волк',
    level: 1,
    hp: 22,
    attack: 4,
    armor: 0,
    xp: 12,
    copper: 4,
    location: 'Поля Североземья',
    description: 'Голодные волки бродят по лугам у аббатства.',
    loot: [{ itemId: 'wolf-fang', chance: 0.08 }],
  },
  {
    id: 'kobold',
    name: 'Кобольд-вредитель',
    level: 2,
    hp: 38,
    attack: 7,
    armor: 1,
    xp: 21,
    copper: 7,
    location: 'Рудник Горного Эха',
    description: 'Кобольды со свечами на голове захватили старый рудник.',
    loot: [
      { itemId: "miner's-boots", chance: 0.07 },
      { itemId: 'militia-hammer', chance: 0.04 },
    ],
  },
  {
    id: 'defias',
    name: 'Головорез Братства',
    level: 3,
    hp: 65,
    attack: 10,
    armor: 2,
    xp: 35,
    copper: 12,
    location: 'Виноградники Североземья',
    description: 'Налётчики в красных масках угрожают виноградарям.',
    loot: [
      { itemId: 'defias-blade', chance: 0.04 },
      { itemId: 'northshire-signet', chance: 0.02 },
    ],
  },
];

export const QUESTS: QuestDefinition[] = [
  {
    id: 'wolves-at-the-gate',
    title: 'Волки у ворот',
    giver: 'Иган Меховщик',
    requiredLevel: 1,
    description:
      'Волки подходят слишком близко к аббатству. Сократи их численность и защити наших новобранцев.',
    objective: { mobId: 'wolf', count: 8 },
    rewards: { xp: 55, copper: 35, itemId: 'militia-hammer' },
  },
  {
    id: 'kobold-cleanup',
    title: 'Зачистка от кобольдов',
    giver: 'Маршал Макбрайд',
    requiredLevel: 2,
    prerequisite: 'wolves-at-the-gate',
    description:
      'Рудник Горного Эха принадлежит жителям Североземья. Прогони кобольдов-вредителей.',
    objective: { mobId: 'kobold', count: 10 },
    rewards: { xp: 100, copper: 70, itemId: 'abbey-tabard' },
  },
  {
    id: 'defias-brotherhood',
    title: 'Братство Справедливости',
    giver: 'Заместитель Виллем',
    requiredLevel: 3,
    prerequisite: 'kobold-cleanup',
    description:
      'Братство Справедливости жжёт наши виноградники. Останови налётчиков и возвращайся ко мне.',
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

export const TICK_MS = 3_000;
export const MAX_OFFLINE_MS = 8 * 60 * 60 * 1_000;
export const MAX_INVENTORY = 100;
export const MAX_LEVEL = 20;
export const MAX_LOG_ENTRIES = 40;
