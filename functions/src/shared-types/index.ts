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
  /** Fuel for the equipped lantern's ability - capacity comes entirely from whichever lantern is
   *  equipped (see EquipmentDefinition.oilCapacity), same pattern as any other equipment-derived
   *  stat. 0/0 with nothing equipped. */
  lanternOil: number;
  maxLanternOil: number;
  /** Powers Dash - regenerates on its own over real time (see Player.staminaUpdatedAt), unlike
   *  every other resource here. Stays 0/0 until the Guardian of Ironwood quest chain unlocks it. */
  stamina: number;
  maxStamina: number;
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
  /** Server clock reading the last time Stamina was reconciled - lets the dash function compute
   *  how much has regenerated since without a scheduled job ticking every player. */
  staminaUpdatedAt: number;
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
  /** World chest ids this player has already opened - a chest only ever grants its item once per
   *  player, regardless of how many times it's interacted with afterward. */
  openedChests: string[];
  /** npcId -> the dialogue variant key (a gating quest id, or 'base') the player last heard from
   *  that NPC - drives the "new dialogue available" indicator above their head. Absent/missing
   *  entries are treated as 'base', so an NPC never talked to shows the indicator by default. */
  seenNpcDialogueVariant: Record<string, string>;
  updatedAt: number;
}

// 'skill' = a Specialty Attack (Keeper's Strike and future shrine-taught ones), gated by Spirit.
// 'lanternAbility' = whatever ability(s) the currently-equipped lantern grants, gated by Lantern
// Oil - a separate roster from Specialty Attacks, tied to gear rather than learned independently.
export type CombatActionType = 'attack' | 'skill' | 'lanternAbility' | 'item' | 'defend' | 'flee';

export interface CombatAction {
  type: CombatActionType;
  /** for 'skill' - which Specialty Attack (data/specialAttacks.ts); defaults to keepers-strike. */
  skillId?: string;
  /** for 'lanternAbility' - which ability of the equipped lantern (data/lanternAbilities.ts). */
  abilityId?: string;
  /** 0-3 item ids (duplicates allowed, e.g. 2x the same potion) - consumed before the turn-order
   *  loop regardless of `type`, so they never cost a turn or trigger an extra enemy attack. A bare
   *  `type: 'item'` action is "use these and nothing else"; any other type (attack/skill/
   *  lanternAbility/defend/flee) can carry itemIds alongside its primary action in the same round. */
  itemIds?: string[];
  /** Index into the session's `enemies` array - which foe attack/skill/lanternAbility targets.
   *  Ignored for item/defend/flee, and ignored when `targetAll` is true. Defaults to the first
   *  still-alive enemy if omitted/invalid. */
  targetIndex?: number;
  /** attack/skill/offensive lanternAbility hit every living enemy instead of one, at reduced
   *  damage per target and a chance to miss each one independently. No-ops to single-target
   *  behavior when only one enemy is alive. */
  targetAll?: boolean;
}

export type CombatSessionStatus = 'active' | 'resolved';

export interface CombatEnemyState {
  enemyId: string;
  /** 1-50 for every enemy, including bosses - see rollEnemyLevel. */
  level: number;
  hp: number;
  maxHp: number;
}

export interface CombatSession {
  sessionId: string;
  uid: string;
  locationId: string;
  /** 1-6 enemies for a regular encounter, 1-4 for a boss fight (the boss plus 0-3 "adds" - see
   *  rollBossEncounter). Array order is fixed for the session's lifetime - `targetIndex` in
   *  CombatAction refers to this order. */
  enemies: CombatEnemyState[];
  round: number;
  status: CombatSessionStatus;
  startedAt: number;
  expiresAt: number;
}

// --- Social: friend search/requests/blocking/DMs. All server-authoritative - clients only ever
// read these via onSnapshot, never write them directly (see firestore.rules). ---

/** Public, minimal directory entry for friend search - deliberately excludes email/anything
 *  sensitive. One entry per account, written once at createCharacter time. */
export interface UserDirectoryEntry {
  uid: string;
  displayName: string;
  displayNameLower: string;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  status: FriendRequestStatus;
  createdAt: number;
}

/** friendships/{uid} - one doc per account, kept symmetric by the accepting function (both
 *  sides' docs are updated in the same transaction). */
export interface FriendshipDoc {
  friendUids: string[];
}

/** blocks/{uid} - one doc per account. Never readable by anyone but the owner - a blocked user
 *  is never told they've been blocked. */
export interface BlockListDoc {
  blockedUids: string[];
}

/** directMessages/{id} - flat collection, `participants` (sorted [uidA, uidB]) is what security
 *  rules and client queries filter on. Only exchanged between accepted friends (see
 *  sendDirectMessage.ts) - a lightweight stand-in for the full town Chat feature planned later. */
export interface DirectMessage {
  id: string;
  participants: [string, string];
  fromUid: string;
  text: string;
  sentAt: number;
}
