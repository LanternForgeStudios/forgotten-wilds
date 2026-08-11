import type { Difficulty, EquipmentSlot, ExplorerRank, RegionalReputationRank, SpiritRank, Stats } from './stats';
import type { InventoryItem } from './item';
import type { QuestProgress } from './quest';
import type { JournalState } from './journal';

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
  regionalReputationRank: RegionalReputationRank;
  equipment: PlayerEquipment;
  currentLocationId: string;
  /** Server clock reading the last time Stamina was reconciled - lets Dash compute how much has
   *  regenerated since without a scheduled job ticking every player. Only meaningful once Stamina
   *  is unlocked. */
  staminaUpdatedAt: number;
  /** Specialty Attacks (data/skills.ts) this player has learned - drives whether CombatScene shows
   *  a single fixed button or a "Select Spirit Ability" submenu. Always present once hydrated from
   *  the server (defaults to ['keepers-strike']), even for a save that predates this field. */
  knownSkillIds: string[];
  /** Body silhouette - render call sites still resolve sprite.player.male/female (registry.ts)
   *  off this alone; `appearance` isn't wired into rendering yet. See
   *  docs/Equipment-Layering-Plan.md and functions/src/shared-types/index.ts's matching field. */
  gender: 'male' | 'female';
  /** Which of the 4 base-body skin/hair variants - captured but not yet rendered, see `gender`. */
  appearance: 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark';
  /** Server clock reading the last time a Daily Chest was claimed - 0 for a fresh character,
   *  which naturally means "eligible immediately" (see data/dailyChest.ts's
   *  CHEST_CLAIM_INTERVAL_MS) without a separate first-claim special case. */
  lastChestClaimedAt: number;
  /** Permanent gold-bought Lantern Oil capacity upgrade tier per lantern equipment id (see
   *  data/lanternOilUpgrades.ts) - 0/absent means never upgraded. See
   *  functions/src/shared-types/index.ts's matching field for the full design reasoning. */
  lanternOilUpgrades: Record<string, number>;
  /** Solo-combat-only, see the Difficulty type's own doc comment. Defaults to 'medium'. */
  difficulty: Difficulty;
}

/** One dynamically-generated Apothecary/Herbalist "restock" request - see PlayerSave's own
 *  apothecaryQuests doc comment. */
export interface ApothecaryQuest {
  materialId: string;
  requiredCount: number;
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
   *  that NPC - drives the "new dialogue available" indicator above their head. */
  seenNpcDialogueVariant: Record<string, string>;
  /** Timestamp (ms) of the last time the player opened the Friends tab of their User Profile -
   *  drives the "new social activity" indicator next to their name in PlayerHUD. */
  lastReviewedSocialAt: number;
  /** One active dynamically-generated restock request per Apothecary/Herbalist shopId - see
   *  functions/src/shared-types/index.ts's matching field for the full design reasoning. */
  apothecaryQuests: Record<string, ApothecaryQuest>;
  updatedAt: number;
}
