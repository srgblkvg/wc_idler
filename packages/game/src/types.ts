export type MobId = 'wolf' | 'kobold' | 'defias';
export type QuestId = 'wolves-at-the-gate' | 'kobold-cleanup' | 'defias-brotherhood';
export type EquipmentSlot = 'weapon' | 'armor' | 'trinket';
export type ItemId =
  | 'training-hammer'
  | 'recruit-vest'
  | 'wolf-fang'
  | 'militia-hammer'
  | "miner's-boots"
  | 'abbey-tabard'
  | 'defias-blade'
  | 'northshire-signet';
export interface Stats {
  maxHp: number;
  maxMana: number;
  attack: number;
  armor: number;
}
export interface MobDefinition {
  id: MobId;
  name: string;
  level: number;
  hp: number;
  attack: number;
  armor: number;
  xp: number;
  copper: number;
  description: string;
  location: string;
  loot: { itemId: ItemId; chance: number }[];
}
export interface ItemDefinition {
  id: ItemId;
  name: string;
  slot: EquipmentSlot;
  rarity: 'common' | 'uncommon' | 'rare';
  requiredLevel: number;
  stats: Partial<Stats>;
  description: string;
}
export interface QuestDefinition {
  id: QuestId;
  title: string;
  description: string;
  giver: string;
  requiredLevel: number;
  prerequisite?: QuestId;
  objective: { mobId: MobId; count: number };
  rewards: { xp: number; copper: number; itemId?: ItemId };
}
export interface ItemInstance {
  instanceId: string;
  itemId: ItemId;
}
export interface QuestProgress {
  questId: QuestId;
  kills: number;
  status: 'active' | 'completed';
}
export interface Encounter {
  mobId: MobId;
  hp: number;
  maxHp: number;
  round: number;
}
export interface GameLog {
  id: number;
  at: number;
  kind: 'combat' | 'loot' | 'quest' | 'level' | 'system';
  message: string;
}
export interface OfflineReport {
  elapsedMs: number;
  simulatedMs: number;
  capped: boolean;
  kills: number;
  xp: number;
  copper: number;
  items: number;
  deaths: number;
}
export interface PlayerState {
  schemaVersion: 1;
  id: string;
  name: string;
  race: 'Human';
  class: 'Paladin';
  zone: 'Northshire Abbey';
  level: number;
  xp: number;
  hp: number;
  mana: number;
  copper: number;
  mode: 'idle' | 'hunting' | 'resting';
  targetMobId: MobId | null;
  encounter: Encounter | null;
  inventory: ItemInstance[];
  equipment: Record<EquipmentSlot, string | null>;
  quests: QuestProgress[];
  totalKills: number;
  totalDeaths: number;
  createdAt: number;
  lastAdvancedAt: number;
  nextTickAt: number;
  rngState: number;
  nextItemId: number;
  nextLogId: number;
  log: GameLog[];
  offlineReport: OfflineReport | null;
}
export type PublicPlayerState = Omit<PlayerState, 'rngState' | 'nextItemId'>;
export type GameAction =
  | { type: 'startHunt'; mobId: MobId }
  | { type: 'stopHunt' }
  | { type: 'rest' }
  | { type: 'acceptQuest' | 'turnInQuest'; questId: QuestId }
  | { type: 'equip'; itemInstanceId: string }
  | { type: 'unequip'; slot: EquipmentSlot };
export type RandomSource = () => number;
