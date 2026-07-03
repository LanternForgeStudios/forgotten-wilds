// Mirrors src/types/*.ts. Deliberately duplicated rather than imported via a relative path:
// `firebase deploy --only functions` zips only the functions/ directory, so a `../../../src/types`
// import would resolve locally but 404 in the deployed bundle. Keep shapes in sync by hand — these
// are small, low-churn interfaces (save-document shape), not the fast-moving gameplay content data.

export type EquipmentSlot =
  | 'weapon'
  | 'armor'
  | 'boots'
  | 'gloves'
  | 'charm'
  | 'lantern'
  | 'spiritTotem';

export interface Stats {
  hp: number;
  maxHp: number;
  spirit: number;
  maxSpirit: number;
  attack: number;
  defense: number;
  speed: number;
}

export type SpiritRank = 'Unawakened' | 'Attuned' | 'Resonant' | 'Warden';
export type ExplorerRank = 'Newcomer' | 'Wayfarer' | 'Pathfinder' | 'Keeper';

export type PlayerEquipment = Partial<Record<EquipmentSlot, string | null>>;

export interface Player {
  uid: string;
  name: string;
  level: number;
  xp: number;
  gold: number;
  spiritEssence: number;
  festivalTokens: number;
  premiumCurrency: number;
  stats: Stats;
  spiritRank: SpiritRank;
  explorerRank: ExplorerRank;
  regionalReputation: number;
  equipment: PlayerEquipment;
  currentLocationId: string;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export type QuestStatus = 'notStarted' | 'active' | 'completed';

export interface QuestProgress {
  status: QuestStatus;
  objectiveCounts: Record<string, number>;
}

export interface JournalState {
  creaturesDiscovered: string[];
  locationsVisited: string[];
  loreUnlocked: string[];
  bossesDefeated: string[];
}

export interface PlayerSave {
  displayName: string;
  createdAt: number;
  lastLoginAt: number;
  player: Player;
  inventory: InventoryItem[];
  quests: Record<string, QuestProgress>;
  journal: JournalState;
  updatedAt: number;
}

export type CombatActionType = 'attack' | 'skill' | 'spiritArt' | 'item' | 'defend' | 'flee';

export interface CombatAction {
  type: CombatActionType;
  skillId?: string;
  itemId?: string;
}

export type CombatSessionStatus = 'active' | 'resolved';

export interface CombatSession {
  sessionId: string;
  uid: string;
  locationId: string;
  enemyId: string;
  enemyHp: number;
  enemyMaxHp: number;
  round: number;
  status: CombatSessionStatus;
  startedAt: number;
  expiresAt: number;
}
