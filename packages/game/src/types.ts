export type MobId = 'wolf' | 'kobold' | 'defias';
export type QuestId = 'wolves-at-the-gate' | 'kobold-cleanup' | 'defias-brotherhood';
export type EquipmentSlot =
  | 'weapon'
  | 'armor'
  | 'helmet'
  | 'gloves'
  | 'legs'
  | 'feet'
  | 'offhand'
  | 'ring1'
  | 'ring2'
  | 'earring1'
  | 'earring2'
  | 'belt'
  | 'cloak'
  | 'amulet';
export type ItemId =
  | 'training-hammer'
  | 'recruit-vest'
  | 'wolf-fang'
  | 'militia-hammer'
  | "miner's-boots"
  | 'abbey-tabard'
  | 'defias-blade'
  | 'northshire-signet'
  | 'thunder-axe'
  | 'hunting-coat'
  | 'watch-mail'
  | 'oath-lamellar'
  | 'linen-hood'
  | 'watch-helmet'
  | 'linen-wraps'
  | 'watch-gauntlets'
  | 'linen-trousers'
  | 'watch-greaves'
  | 'birch-shield'
  | 'ford-shield'
  | 'reed-dagger'
  | 'reed-parrying-dagger'
  | 'sun-watch-armor'
  | 'sun-watch-helmet'
  | 'sun-watch-gloves'
  | 'sun-watch-legs'
  | 'linen-shoes'
  | 'watch-boots'
  | 'sun-watch-boots'
  | 'copper-ring'
  | 'river-ring'
  | 'copper-earring'
  | 'river-earring'
  | 'woven-belt'
  | 'traveller-cloak'
  | 'birch-amulet';
export type SkillId = 'heavyStrike' | 'ward' | 'mend' | 'flurry' | 'secondWind';
export interface Appearance {
  gender: 'male' | 'female';
  hair: 'dark' | 'fair' | 'red';
  hairStyle: 'short' | 'braid';
  skin: 'light' | 'tan';
  mark: 'none' | 'scar';
}
export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  manaCost: number;
  cooldownTurns: number;
  policy: 'healthBelow' | 'onCooldown';
  healthBelow?: number;
}
export interface SkillState {
  loadout: SkillId[];
  cooldowns: Record<SkillId, number>;
}
export interface Stats {
  maxHp: number;
  maxMana: number;
  attack: number;
  armor: number;
  critChance: number;
  hitChance: number;
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
  equipSlots?: EquipmentSlot[];
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  handType?: 'oneHand' | 'twoHand';
  offhandType?: 'shield' | 'talisman' | 'dagger';
  grantedSkills: SkillId[];
  requiredLevel: number;
  stats: Partial<Stats>;
  description: string;
  visual: {
    weaponStyle?: 'axe' | 'sword' | 'mace' | 'dagger';
    armorStyle?: 'cloth' | 'leather' | 'chain';
    armorVariant?: 'hunter' | 'watch' | 'oath' | 'sun';
    accessoryStyle?: 'cloth' | 'iron' | 'sun' | 'shield' | 'talisman' | 'dagger';
    accentColor: string;
  };
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
export interface CombatEvent {
  id: number;
  timestamp: number;
  kind: 'attack' | 'heal' | 'ward' | 'defeat' | 'victory';
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  mobId: MobId;
  damage: number;
  healing: number;
  critical: boolean;
  missed: boolean;
  ability: SkillId | 'basicAttack' | null;
}
export interface LootEvent {
  id: number;
  timestamp: number;
  itemId: ItemId;
  instanceId: string | null;
  source: 'drop' | 'quest';
  rarity: ItemDefinition['rarity'];
  salvaged: boolean;
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
  schemaVersion: 3;
  id: string;
  name: string;
  race: 'Человек';
  class: 'Ратник';
  zone: 'Берёзовый Брод';
  appearance: Appearance;
  skills: SkillState;
  combatEvents: CombatEvent[];
  lootEvents: LootEvent[];
  nextEventId: number;
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
  | { type: 'equip'; itemInstanceId: string; slot?: EquipmentSlot }
  | { type: 'unequip'; slot: EquipmentSlot }
  | { type: 'setSkills'; skills: SkillId[] };
export type RandomSource = () => number;
