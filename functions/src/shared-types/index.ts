// Mirrors src/types/*.ts. Deliberately duplicated rather than imported via a relative path:
// `firebase deploy --only functions` zips only the functions/ directory, so a `../../../src/types`
// import would resolve locally but 404 in the deployed bundle. Keep shapes in sync by hand — these
// are small, low-churn interfaces (save-document shape), not the fast-moving gameplay content data.

// Type-only, erased at compile time - both files live inside functions/ (the same deployed
// bundle), unlike the src/ boundary the comment above guards against, so this doesn't risk the
// same "resolves locally but 404s once deployed" problem. Used only by PartyBattleTurnResult's
// hits/enemyHits/pvpHit fields below.
import type { PartyCombatHitResult, PartyEnemyHitResult, PvpHitResult } from '../engine/partyCombatEngine';

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
/** Awarded automatically from player level, in 10-level chunks across the level-100 cap - see
 *  explorerRankForLevel in data/leveling.ts for the exact level boundaries. */
export type ExplorerRank =
  | 'Newcomer'
  | 'Wayfarer'
  | 'Pathfinder'
  | 'Trailblazer'
  | 'Ridgewalker'
  | 'Keeper'
  | 'Wayshaper'
  | 'Deepwalker'
  | 'Lantern Sage'
  | 'Legend of Mytherra';

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
  /** Specialty Attacks (data/skills.ts) this player has learned - 'skill' actions may only request
   *  a skillId in this list (see resolveCombatAction.ts). Defaults to ['keepers-strike'] for a
   *  fresh character (newCharacter.ts) and as a read-time fallback for any save that predates this
   *  field - never absent/undefined once read, even though older Firestore documents lack it. */
  knownSkillIds: string[];
  /** Which player sprite variant to render (see registry.ts's sprite.player.male/female) - chosen
   *  at character creation, changeable any time via setPlayerSkin.ts. Only two options today; the
   *  shape is a plain string union (not an enum) so a future third option is a one-line type edit. */
  skin: 'male' | 'female';
  /** Server clock reading the last time a Daily Chest was claimed - 0 for a fresh character
   *  (newCharacter.ts) and as a read-time fallback for any save that predates this field (see
   *  claimDailyChest.ts), which naturally means "eligible immediately" against
   *  data/dailyChest.ts's CHEST_CLAIM_INTERVAL_MS with no separate first-claim special case. */
  lastChestClaimedAt: number;
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
  /** Every item id ever granted to the player (shop, chest, combat loot, quest reward, trade) -
   *  monotonic, like the other Journal lists: once acquired, an item stays in this compendium
   *  even after being consumed/sold/traded away. Distinct from the live inventory field, which
   *  only reflects current holdings. Maintained centrally by grantItem (inventoryEngine.ts) since
   *  that's the one chokepoint every item-granting path already funnels through, plus
   *  collectWorldItem.ts's own direct inventory push (the one caller that bypasses grantItem). */
  itemsDiscovered: string[];
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
  /** Timestamp (ms) of the last time the player opened the Friends tab of their User Profile -
   *  drives the "new social activity" indicator next to their name in PlayerHUD (any incoming
   *  friend request or direct message newer than this counts as unreviewed). 0 for a fresh
   *  character, so any pre-existing activity would show as new. */
  lastReviewedSocialAt: number;
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

/** One ailment currently afflicting the player mid-battle - see functions/src/data/ailments.ts
 *  for what each ailmentId actually does. Ailments only ever apply to the player in this system
 *  (enemies inflict them, nothing currently inflicts them on enemies) and live only on
 *  CombatSession, never PlayerSave - "all active ailments are automatically removed when combat
 *  ends" falls out for free from that, since nothing ever reads or writes this once the session
 *  is resolved. */
export interface ActiveAilment {
  ailmentId: string;
  /** Turns remaining before this auto-expires (see AilmentDefinition.autoExpireAfterTurns) -
   *  undefined for a "until cured or battle ends" ailment. */
  turnsRemaining?: number;
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
  playerAilments: ActiveAilment[];
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

export type TradeStatus = 'awaiting_recipient' | 'awaiting_initiator' | 'accepted' | 'declined' | 'cancelled';

export interface TradeOfferSide {
  items: { itemId: string; quantity: number }[];
  gold: number;
}

/** trades/{id} - flat collection, `participants` ([initiatorUid, recipientUid], order meaningful
 *  unlike directMessages' sorted pair) is what security rules and the client's live query filter
 *  on. `initiatorOffer` is escrowed (physically removed from the initiator's own save) the moment
 *  this doc is created; `recipientOffer` is escrowed the same way the moment the recipient
 *  counters (null until then, since decline never populates it). Only ever mutated by
 *  trade.ts's four Cloud Functions, inside a transaction, alongside whichever users/{uid} docs
 *  it's moving escrowed assets to/from. */
export interface TradeDoc {
  id: string;
  participants: [string, string];
  initiatorUid: string;
  recipientUid: string;
  status: TradeStatus;
  initiatorOffer: TradeOfferSide;
  recipientOffer: TradeOfferSide | null;
  createdAt: number;
  updatedAt: number;
}

/** activeTradeLocks/{sortedPairKey} ([uidA,uidB].sort().join('_')) - internal bookkeeping only,
 *  never read by the client (see firestore.rules). Exists so proposeTrade can check "no other
 *  active trade already exists between this pair" atomically inside its own transaction
 *  (`tx.get` on a doc ref - every transaction read in this codebase is a doc ref, never a query,
 *  and a query-then-transact approach here would have a TOCTOU race between two concurrent
 *  proposals). Deleted in the same transaction whenever a trade reaches a terminal status. */
export interface ActiveTradeLockDoc {
  tradeId: string;
}

/** worldChatMessages/{id} - flat, global feed (not partitioned per-location - see worldChat.ts).
 *  `displayName` is frozen at send time from the sender's own save.displayName (never a
 *  client-supplied value, never userDirectory), same reasoning as FriendRequest's
 *  fromDisplayName/toDisplayName - a fast-moving multi-party feed needs a name on every line,
 *  which live per-message resolution doesn't fit the way it does for a DM thread. */
export interface WorldChatMessage {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  sentAt: number;
}

/** worldChatModeration/{uid} - one doc per account, server-only, never read by the client (the
 *  Cloud Function's own rejection message carries "muted for Ns" instead of the client reading
 *  this doc directly). See chatModerationEngine.ts's checkAndRecordMessage for how all three
 *  fields get updated together. */
export interface WorldChatModerationDoc {
  lastMessageAt: number;
  recentMessageTimestamps: number[];
  mutedUntil: number;
}

/** worldChatMeta/cleanup - a single singleton doc tracking when the auto-purge query (messages
 *  older than 1 hour) last ran, so sendWorldChatMessage doesn't re-run that query on literally
 *  every message - see worldChat.ts. */
export interface WorldChatCleanupMeta {
  lastCleanupAt: number;
}

export const MAX_CLAN_SIZE = 6;

/** clans/{clanId} - one doc per clan, auto-id. `memberUids` always includes `leaderUid` (checked
 *  by every clan.ts mutation, not enforced by the doc shape itself). `level`/`xp`/
 *  `highestEndlessWave` are placeholders written by the future Endless Battle phase - clan.ts's
 *  functions only ever initialize them to 0, never advance them. */
export interface ClanDoc {
  id: string;
  name: string;
  tag: string;
  leaderUid: string;
  memberUids: string[];
  level: number;
  xp: number;
  highestEndlessWave: number;
  createdAt: number;
  updatedAt: number;
}

/** clanMemberships/{uid} - one doc per account, mirrors friendships/{uid}'s "one doc per account"
 *  pattern - lets any function answer "what clan is this player in, if any" with a single doc
 *  read by uid instead of scanning the clans collection. `clanId: null` means not in a clan.
 *  Kept in sync by hand inside every clan.ts mutation that changes membership. */
export interface ClanMembershipDoc {
  clanId: string | null;
}

export type ClanInviteStatus = 'pending' | 'accepted' | 'declined';

/** clanInvites/{id} - flat collection, auto-id (unlike friendRequests' deterministic
 *  `${fromUid}_${toUid}` id, a player could plausibly hold pending invites from more than one
 *  clan before accepting one, so there's no single natural deterministic key here). Mirrors
 *  FriendRequest's shape otherwise, including freezing display names at invite time. */
export interface ClanInvite {
  id: string;
  clanId: string;
  clanName: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  status: ClanInviteStatus;
  createdAt: number;
}

// --- Multiplayer Battle System: the shared party/PvP combat session (see
// functions/src/engine/partyCombatEngine.ts for round resolution). Phase C (functions/src/
// functions/endlessBattle.ts) is the first real consumer - PvP matchmaking (Phase D) is still
// unbuilt and will reuse this same doc/round-resolution mechanism with mode: 'pvp'.

export type PartyBattleMode = 'endless' | 'pvp';
/** 'awaitingContinueVote' is Endless Battle-only (see endlessBattleEngine.ts/endlessBattle.ts) -
 *  submitPartyBattleAction transitions a victory to this instead of the plain 'victory' terminal
 *  state when `mode === 'endless'`, since a wave win isn't the end of the run. PvP (once built)
 *  will use 'victory'/'defeated' as real terminal states directly. */
export type PartyBattleStatus = 'active' | 'awaitingContinueVote' | 'victory' | 'defeated' | 'withdrawn';

/** One participant's combat-relevant stats, snapshotted onto the battle doc at battle start (full
 *  HP/Spirit/Oil per the design doc's "every player restored to 100% at battle start") and
 *  updated in place as rounds resolve - deliberately not a live read of users/{uid} mid-battle, so
 *  a party fight has one authoritative, self-contained state rather than depending on a second
 *  document staying in sync. */
export interface PartyBattleParticipantStats {
  hp: number;
  maxHp: number;
  spirit: number;
  maxSpirit: number;
  lanternOil: number;
  maxLanternOil: number;
  attack: number;
  defense: number;
  speed: number;
  ailments: ActiveAilment[];
  /** Whether this participant chose Defend (or flee, treated the same) on their turn this round -
   *  read by the enemy phase (partyCombatEngine.ts's resolvePartyEnemyPhase) to halve incoming
   *  damage, then cleared back to false once the enemy phase runs. */
  defending: boolean;
  /** Snapshotted once at battle start (fullyRestoredParticipantStats, partyBattle.ts) from the
   *  real save - can't change mid-battle (no re-learning a skill or re-equipping a lantern while
   *  locked in a fight), so there's no need for a live per-turn read the way item ownership needs
   *  (see submitPartyBattleAction's own inventory read). Used both to validate a submitted
   *  skillId/abilityId actually belongs to this participant (Phase F's action-menu enforcement)
   *  and to know which sprite to render them as in PvP (skin). */
  knownSkillIds: string[];
  lanternId: string | null;
  skin: 'male' | 'female';
}

export interface PartyBattleEnemyState {
  enemyId: string;
  level: number;
  hp: number;
  maxHp: number;
}

/** Whichever single player-turn or enemy-phase just resolved, persisted onto the doc (not just
 *  returned from whichever client's submitPartyBattleAction call happened to trigger it) - unlike
 *  solo combat's resolveCombatAction, every participant needs to see what just happened via their
 *  own onSnapshot listener, not only the one caller who got the function response. Overwritten
 *  every turn (not just every round), so the party sees each player's action land one at a time
 *  rather than a whole round's worth of text appearing at once. */
export interface PartyBattleTurnResult {
  round: number;
  log: string[];
  resolvedAt: number;
  /** Structured hit data for the client's battle canvas to animate (Phase F of the Multiplayer
   *  Battle System plan) - optional so a battle doc written before this field existed doesn't fail
   *  client typing; absence just means "nothing to animate," same as an empty array would. Endless
   *  Battle only: `hits` is the acting player's own offensive swing this turn; `enemyHits` is only
   *  present on the turn that also ran the enemy phase (every other turn, no enemy acted yet). */
  hits?: PartyCombatHitResult[];
  enemyHits?: PartyEnemyHitResult[];
  /** PvP only - null on a Defend/item/forfeit/stunned turn (nothing was thrown at the opponent). */
  pvpHit?: PvpHitResult | null;
}

export interface PartyBattleWaveRewards {
  xp: number;
  gold: number;
  itemIds: string[];
}

/** partyBattles/{battleId} - auto-id, `participants` is the trades-style array
 *  firestore.rules/the client's live query filter on. Resolution is sequential, one player at a
 *  time - `turnOrder` (recomputed from currently-alive participants at the start of each round)
 *  plus `currentTurnIndex` say whose turn it is; `turnOrder[currentTurnIndex]` is the only
 *  participant submitPartyBattleAction will currently accept an action from (see its own doc
 *  comment). Once every player in `turnOrder` has gone, the enemy phase resolves and a new round
 *  begins - see partyCombatEngine.ts's own top comment for why this is sequential rather than
 *  collect-everyone-then-resolve-at-once. */
export interface PartyBattleSession {
  id: string;
  clanId: string | null;
  mode: PartyBattleMode;
  participants: string[];
  /** Where the party was standing when the run started - fixed for the run's lifetime. Endless
   *  Battle's own wave enemies aren't drawn from this location's encounter table (see
   *  endlessBattleEngine.ts) - this is purely a record of where the party gathered. */
  locationId: string;
  /** The party's average real level at battle start, frozen for the whole run - each wave's
   *  difficulty escalates from this fixed baseline (see endlessBattleEngine.ts's
   *  effectiveLevelForWave), not from real characters' levels changing mid-run as rewards land. */
  partyAverageLevel: number;
  /** A registry.ts battle-background asset id, rolled once at battle start and fixed for the run -
   *  same "looks like a normal encounter" background solo combat shows, picked at random from
   *  every overworld location's battleBackgroundAssetId (see endlessBattle.ts). */
  battleBackgroundAssetId: string;
  wave: number;
  enemies: PartyBattleEnemyState[];
  round: number;
  status: PartyBattleStatus;
  /** Whose turn it is this round, alive participants only, recomputed at the start of every round
   *  (a player who goes down mid-round is simply skipped for the rest of it, not removed from
   *  future rounds if somehow revived - not currently possible mid-battle, but the recompute-per-
   *  round design leaves room for it). */
  turnOrder: string[];
  /** Index into `turnOrder` - `turnOrder[currentTurnIndex]` is the active player. */
  currentTurnIndex: number;
  turnDeadlineAt: number;
  participantStats: Record<string, PartyBattleParticipantStats>;
  lastTurnResult: PartyBattleTurnResult | null;
  /** Independent per-player rewards from the wave just won - see endlessBattle.ts. null until the
   *  first wave is cleared; endless-mode only (PvP grants rewards once, at the very end). */
  lastWaveRewards: Record<string, PartyBattleWaveRewards> | null;
  /** Endless-mode only, meaningful only while status === 'awaitingContinueVote' - see
   *  endlessBattle.ts's voteContinueEndlessBattle. Reset to {} every time a new vote opens. */
  continueVotes: Record<string, boolean>;
  /** PvP-only - which participant won, once status is 'victory'/'defeated'. Endless Battle's
   *  status is shared party-wide (everyone wins or loses together), so this stays null for that
   *  mode; PvP's win/loss is per-uid, which the shared PartyBattleStatus field alone can't express -
   *  see pvpBattle.ts. */
  winnerUid: string | null;
  startedAt: number;
  updatedAt: number;
}

/** partyBattleLocks/{uid} - one doc per account, mirrors activeTradeLocks' own reasoning: lets
 *  startEndlessBattle check "is this player already in a battle" atomically inside its own
 *  transaction (a doc-ref read, never a query), and prevents them from being started into a
 *  second one. Deleted the moment their battle reaches any terminal status. */
export interface PartyBattleLockDoc {
  battleId: string;
}

export type PvpChallengeStatus = 'pending' | 'accepted' | 'declined';

/** pvpChallenges/{fromUid}_{toUid} - deterministic id, same pattern as FriendRequest (a player
 *  could plausibly hold more than one pending challenge, but a duplicate challenge to the same
 *  target should just overwrite rather than pile up). Kept (not deleted) after resolution, same
 *  "history stays, status changes" precedent as friendRequests/clanInvites. */
export interface PvpChallengeDoc {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  status: PvpChallengeStatus;
  createdAt: number;
}

/** pvpQueue/{uid} - one doc per account, only exists while queued. joinPvpQueue matches greedily
 *  against whichever other queued player is closest in level (see pvpBattle.ts) rather than a
 *  fully general matchmaking service - "basic matchmaking" per the design doc's own reduced
 *  ambition for casual PvP. */
export interface PvpQueueEntry {
  uid: string;
  level: number;
  joinedAt: number;
}
