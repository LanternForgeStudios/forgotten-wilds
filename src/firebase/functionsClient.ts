import { httpsCallable } from 'firebase/functions';
import type {
  ActiveAilment,
  ClanLeaderboardEntry,
  CombatAction,
  EnemyTier,
  PartyBattleParticipantStats,
  PartyBattleStatus,
  PlayerSave,
  TradeStatus,
} from '@/types';
import { functions } from './firebaseConfig';

export async function callCreateCharacter(name: string, skin: 'male' | 'female' = 'male'): Promise<PlayerSave> {
  const fn = httpsCallable<{ name: string; skin: 'male' | 'female' }, PlayerSave>(functions, 'createCharacter');
  const result = await fn({ name, skin });
  return result.data;
}

export async function callSetPlayerSkin(skin: 'male' | 'female'): Promise<{ skin: 'male' | 'female' }> {
  const fn = httpsCallable<{ skin: 'male' | 'female' }, { skin: 'male' | 'female' }>(functions, 'setPlayerSkin');
  const result = await fn({ skin });
  return result.data;
}

export async function callSetDisplayName(name: string): Promise<{ displayName: string }> {
  const fn = httpsCallable<{ name: string }, { displayName: string }>(functions, 'setDisplayName');
  const result = await fn({ name });
  return result.data;
}

export interface EncounterEnemy {
  index: number;
  enemyId: string;
  name: string;
  tier: EnemyTier;
  level: number;
  hp: number;
  maxHp: number;
  isBoss: boolean;
}

export interface StartEncounterResponse {
  sessionId: string;
  enemies: EncounterEnemy[];
  playerHp: number;
  playerMaxHp: number;
  playerSpirit: number;
  playerMaxSpirit: number;
  playerAilments: ActiveAilment[];
}

export async function callStartEncounter(locationId: string, bossId?: string): Promise<StartEncounterResponse> {
  const fn = httpsCallable<{ locationId: string; bossId?: string }, StartEncounterResponse>(
    functions,
    'startEncounter',
  );
  const result = await fn({ locationId, bossId });
  return result.data;
}

export async function callTalkToNpc(npcId: string): Promise<{ questsCompleted: string[] }> {
  const fn = httpsCallable<{ npcId: string }, { questsCompleted: string[] }>(functions, 'talkToNpc');
  const result = await fn({ npcId });
  return result.data;
}

export async function callEnterLocation(locationId: string): Promise<{ questsCompleted: string[] }> {
  const fn = httpsCallable<{ locationId: string }, { questsCompleted: string[] }>(functions, 'enterLocation');
  const result = await fn({ locationId });
  return result.data;
}

export async function callVisitLandmark(
  landmarkId: string,
): Promise<{ alreadyVisited: boolean; questsCompleted: string[] }> {
  const fn = httpsCallable<{ landmarkId: string }, { alreadyVisited: boolean; questsCompleted: string[] }>(
    functions,
    'visitLandmark',
  );
  const result = await fn({ landmarkId });
  return result.data;
}

export async function callCollectWorldItem(
  locationId: string,
  refId: string,
): Promise<{ alreadyCollected: boolean; questsCompleted: string[]; itemId: string }> {
  const fn = httpsCallable<
    { locationId: string; refId: string },
    { alreadyCollected: boolean; questsCompleted: string[]; itemId: string }
  >(functions, 'collectWorldItem');
  const result = await fn({ locationId, refId });
  return result.data;
}

export interface CombatActionRequest {
  type: 'attack' | 'skill' | 'lanternAbility' | 'item' | 'defend' | 'flee';
  /** for 'skill' - which Specialty Attack; defaults to keepers-strike. */
  skillId?: string;
  /** for 'lanternAbility' - which ability of the equipped lantern. */
  abilityId?: string;
  /** 0-3 item ids (duplicates allowed) - consumed before the turn-order loop regardless of `type`. */
  itemIds?: string[];
  /** Which enemy (by its index from StartEncounterResponse.enemies) attack/skill/lanternAbility
   *  hits. Ignored for item/defend/flee, and ignored when `targetAll` is true. */
  targetIndex?: number;
  /** attack/skill/offensive lanternAbility hit every living enemy at reduced damage + a per-target
   *  miss chance, instead of one. No-ops to single-target when only one enemy is alive. */
  targetAll?: boolean;
}

export interface CombatHitResult {
  targetIndex: number;
  damage: number;
  missed: boolean;
  defeated: boolean;
}

export interface EnemyHitResult {
  attackerIndex: number;
  damage: number;
  /** Always false today - enemies have no miss roll. */
  missed: boolean;
  /** True when this hit was halved by the player's Defend/a defensive lanternAbility this round. */
  wasDefended: boolean;
  /** Ready-to-display line naming this specific attacker - reveal it in step with this hit's own
   *  staggered animation (see BattleScene.playIncomingHits) rather than dumping every round's log
   *  lines at once. */
  logLine: string;
}

export interface ResolveCombatActionResponse {
  log: string[];
  phase: 'continue' | 'victory' | 'defeat' | 'fled';
  playerHp: number;
  playerMaxHp: number;
  playerSpirit: number;
  playerMaxSpirit: number;
  playerLanternOil: number;
  playerMaxLanternOil: number;
  enemies: { index: number; hp: number; maxHp: number }[];
  rewards: {
    xp: number;
    gold: number;
    itemIds: string[];
    leveledUp: boolean;
    restore: { stat: 'hp' | 'spirit' | 'lanternOil'; amount: number } | null;
  } | null;
  playerLevel: number;
  playerGold: number;
  currentLocationId: string;
  /** Sum of all enemy->player damage this round (after Defend halving). */
  damageTakenByPlayer: number;
  /** Every enemy the player damaged/missed this round (attack/skill/offensive lanternAbility). */
  hits: CombatHitResult[];
  /** Every enemy attack that landed on the player this round, one entry per attacking enemy. */
  enemyHits: EnemyHitResult[];
  /** The player's ailments after this round - empty on any terminal phase (victory/defeat/fled),
   *  since ailments never carry past the end of combat. See shared-types' ActiveAilment. */
  playerAilments: ActiveAilment[];
}

export async function callResolveCombatAction(
  sessionId: string,
  action: CombatActionRequest,
): Promise<ResolveCombatActionResponse> {
  const fn = httpsCallable<{ sessionId: string; action: CombatActionRequest }, ResolveCombatActionResponse>(
    functions,
    'resolveCombatAction',
  );
  const result = await fn({ sessionId, action });
  return result.data;
}

export async function callEquipItem(itemId: string): Promise<void> {
  const fn = httpsCallable<{ itemId: string }, unknown>(functions, 'equipItem');
  await fn({ itemId });
}

export async function callUnequipItem(slot: string): Promise<void> {
  const fn = httpsCallable<{ slot: string }, unknown>(functions, 'unequipItem');
  await fn({ slot });
}

export async function callPurchaseItem(itemId: string, shopId: string): Promise<void> {
  const fn = httpsCallable<{ itemId: string; shopId: string }, unknown>(functions, 'purchaseItem');
  await fn({ itemId, shopId });
}

export async function callRestAtInn(): Promise<void> {
  const fn = httpsCallable(functions, 'restAtInn');
  await fn({});
}

interface UseItemResponse {
  playerAilments: ActiveAilment[];
}

/** The response's playerAilments is only meaningful mid-combat (a cureAilmentId item, e.g. Eye
 *  Drops on Blind, used via the free item-menu "Done" path rather than as a full turn action) -
 *  see useItem.ts. Outside combat it's always []. */
export async function callUseItem(itemId: string): Promise<UseItemResponse> {
  const fn = httpsCallable<{ itemId: string }, UseItemResponse>(functions, 'useItem');
  const res = await fn({ itemId });
  return res.data;
}

export async function callInteractWithShrine(
  locationId: string,
  refId: string,
): Promise<{ questsCompleted: string[]; unlockedStamina: boolean }> {
  const fn = httpsCallable<
    { locationId: string; refId: string },
    { questsCompleted: string[]; unlockedStamina: boolean }
  >(functions, 'interactWithShrine');
  const result = await fn({ locationId, refId });
  return result.data;
}

export async function callDash(
  options: { isDashStart?: boolean } = {},
): Promise<{ stamina: number; maxStamina: number; staminaUpdatedAt: number }> {
  const fn = httpsCallable<{ isDashStart?: boolean }, { stamina: number; maxStamina: number; staminaUpdatedAt: number }>(
    functions,
    'dash',
  );
  const result = await fn(options);
  return result.data;
}

export async function callOpenChest(
  locationId: string,
  chestId: string,
): Promise<{ alreadyOpened: boolean; itemId: string }> {
  const fn = httpsCallable<
    { locationId: string; chestId: string },
    { alreadyOpened: boolean; itemId: string }
  >(functions, 'openChest');
  const result = await fn({ locationId, chestId });
  return result.data;
}

export interface DailyChestRewards {
  gold: number;
  premiumCurrency: number;
  itemIds: string[];
}

export async function callClaimDailyChest(): Promise<{
  tier: 'standard' | 'elite';
  rewards: DailyChestRewards;
  lastChestClaimedAt: number;
}> {
  const fn = httpsCallable<
    void,
    { tier: 'standard' | 'elite'; rewards: DailyChestRewards; lastChestClaimedAt: number }
  >(functions, 'claimDailyChest');
  const result = await fn();
  return result.data;
}

export async function callCraftItem(recipeId: string): Promise<{ inventory: { itemId: string; quantity: number }[] }> {
  const fn = httpsCallable<{ recipeId: string }, { inventory: { itemId: string; quantity: number }[] }>(
    functions,
    'craftItem',
  );
  const result = await fn({ recipeId });
  return result.data;
}

export async function callSellItem(
  itemId: string,
  quantity?: number,
): Promise<{ gold: number; soldQuantity: number; goldEarned: number }> {
  const fn = httpsCallable<
    { itemId: string; quantity?: number },
    { gold: number; soldQuantity: number; goldEarned: number }
  >(functions, 'sellItem');
  const result = await fn({ itemId, quantity });
  return result.data;
}

export async function callSearchUsers(query: string): Promise<{ results: { uid: string; displayName: string }[] }> {
  const fn = httpsCallable<{ query: string }, { results: { uid: string; displayName: string }[] }>(
    functions,
    'searchUsers',
  );
  const result = await fn({ query });
  return result.data;
}

export async function callSendFriendRequest(
  toUid: string,
): Promise<{ status: 'sent' | 'accepted' | 'already-pending' }> {
  const fn = httpsCallable<{ toUid: string }, { status: 'sent' | 'accepted' | 'already-pending' }>(
    functions,
    'sendFriendRequest',
  );
  const result = await fn({ toUid });
  return result.data;
}

export async function callRespondToFriendRequest(
  requestId: string,
  accept: boolean,
): Promise<{ status: string }> {
  const fn = httpsCallable<{ requestId: string; accept: boolean }, { status: string }>(
    functions,
    'respondToFriendRequest',
  );
  const result = await fn({ requestId, accept });
  return result.data;
}

export async function callRemoveFriend(friendUid: string): Promise<void> {
  const fn = httpsCallable<{ friendUid: string }, unknown>(functions, 'removeFriend');
  await fn({ friendUid });
}

export async function callBlockUser(targetUid: string): Promise<void> {
  const fn = httpsCallable<{ targetUid: string }, unknown>(functions, 'blockUser');
  await fn({ targetUid });
}

export async function callUnblockUser(targetUid: string): Promise<void> {
  const fn = httpsCallable<{ targetUid: string }, unknown>(functions, 'unblockUser');
  await fn({ targetUid });
}

export async function callSendDirectMessage(toUid: string, text: string): Promise<void> {
  const fn = httpsCallable<{ toUid: string; text: string }, unknown>(functions, 'sendDirectMessage');
  await fn({ toUid, text });
}

export async function callResetPlayerProgress(confirmEmail: string): Promise<void> {
  const fn = httpsCallable<{ confirmEmail: string }, unknown>(functions, 'resetPlayerProgress');
  await fn({ confirmEmail });
}

export async function callMarkSocialReviewed(): Promise<void> {
  const fn = httpsCallable(functions, 'markSocialReviewed');
  await fn({});
}

export interface TradeItemRequest {
  itemId: string;
  quantity: number;
}

export async function callProposeTrade(
  toUid: string,
  items: TradeItemRequest[],
  gold: number,
): Promise<{ tradeId: string }> {
  const fn = httpsCallable<{ toUid: string; items: TradeItemRequest[]; gold: number }, { tradeId: string }>(
    functions,
    'proposeTrade',
  );
  const result = await fn({ toUid, items, gold });
  return result.data;
}

export async function callRespondToTradeOffer(
  tradeId: string,
  action: 'decline' | 'counter',
  counter?: { items: TradeItemRequest[]; gold: number },
): Promise<{ status: TradeStatus }> {
  const fn = httpsCallable<
    { tradeId: string; action: 'decline' | 'counter'; items?: TradeItemRequest[]; gold?: number },
    { status: TradeStatus }
  >(functions, 'respondToTradeOffer');
  const result = await fn({ tradeId, action, items: counter?.items, gold: counter?.gold });
  return result.data;
}

export async function callFinalizeTrade(tradeId: string, accept: boolean): Promise<{ status: TradeStatus }> {
  const fn = httpsCallable<{ tradeId: string; accept: boolean }, { status: TradeStatus }>(functions, 'finalizeTrade');
  const result = await fn({ tradeId, accept });
  return result.data;
}

export async function callCancelTrade(tradeId: string): Promise<{ cancelled: boolean; status: TradeStatus }> {
  const fn = httpsCallable<{ tradeId: string }, { cancelled: boolean; status: TradeStatus }>(functions, 'cancelTrade');
  const result = await fn({ tradeId });
  return result.data;
}

export async function callSendWorldChatMessage(text: string): Promise<void> {
  const fn = httpsCallable<{ text: string }, { sent: true }>(functions, 'sendWorldChatMessage');
  await fn({ text });
}

export async function callCreateClan(name: string, tag: string): Promise<{ clanId: string }> {
  const fn = httpsCallable<{ name: string; tag: string }, { clanId: string }>(functions, 'createClan');
  const result = await fn({ name, tag });
  return result.data;
}

export async function callInviteToClan(clanId: string, toUid: string): Promise<{ status: 'sent' }> {
  const fn = httpsCallable<{ clanId: string; toUid: string }, { status: 'sent' }>(functions, 'inviteToClan');
  const result = await fn({ clanId, toUid });
  return result.data;
}

export async function callRespondToClanInvite(
  inviteId: string,
  accept: boolean,
): Promise<{ status: 'accepted' | 'declined' }> {
  const fn = httpsCallable<{ inviteId: string; accept: boolean }, { status: 'accepted' | 'declined' }>(
    functions,
    'respondToClanInvite',
  );
  const result = await fn({ inviteId, accept });
  return result.data;
}

export async function callLeaveClan(): Promise<{ left: true }> {
  const fn = httpsCallable<void, { left: true }>(functions, 'leaveClan');
  const result = await fn();
  return result.data;
}

export async function callRemoveFromClan(uid: string): Promise<{ removed: true }> {
  const fn = httpsCallable<{ uid: string }, { removed: true }>(functions, 'removeFromClan');
  const result = await fn({ uid });
  return result.data;
}

export async function callTransferClanLeadership(toUid: string): Promise<{ newLeaderUid: string }> {
  const fn = httpsCallable<{ toUid: string }, { newLeaderUid: string }>(functions, 'transferClanLeadership');
  const result = await fn({ toUid });
  return result.data;
}

export async function callDisbandClan(): Promise<{ disbanded: true }> {
  const fn = httpsCallable<void, { disbanded: true }>(functions, 'disbandClan');
  const result = await fn();
  return result.data;
}

export async function callGetClanLeaderboard(): Promise<{ entries: ClanLeaderboardEntry[] }> {
  const fn = httpsCallable<void, { entries: ClanLeaderboardEntry[] }>(functions, 'getClanLeaderboard');
  const result = await fn();
  return result.data;
}

export async function callStartEndlessBattle(participantUids: string[]): Promise<{ battleId: string }> {
  const fn = httpsCallable<{ participantUids: string[] }, { battleId: string }>(functions, 'startEndlessBattle');
  const result = await fn({ participantUids });
  return result.data;
}

export async function callVoteContinueEndlessBattle(
  battleId: string,
  wantsToContinue: boolean,
): Promise<{ status: PartyBattleStatus; wave?: number }> {
  const fn = httpsCallable<{ battleId: string; continue: boolean }, { status: PartyBattleStatus; wave?: number }>(
    functions,
    'voteContinueEndlessBattle',
  );
  const result = await fn({ battleId, continue: wantsToContinue });
  return result.data;
}

export async function callSubmitPartyBattleAction(
  battleId: string,
  action?: CombatAction,
): Promise<{ resolved: boolean; status: PartyBattleStatus }> {
  const fn = httpsCallable<{ battleId: string; action?: CombatAction }, { resolved: boolean; status: PartyBattleStatus }>(
    functions,
    'submitPartyBattleAction',
  );
  const result = await fn({ battleId, action });
  return result.data;
}

/** Consumes an item mid-battle without spending a turn - the party-battle equivalent of
 *  callUseItem, applying the effect to both the real save and the battle's own in-fight
 *  participantStats snapshot. See useItemInPartyBattle's own doc comment for why party battle
 *  can't just reuse callUseItem as-is. */
export async function callUseItemInPartyBattle(
  battleId: string,
  itemId: string,
): Promise<{ stats: PartyBattleParticipantStats; inventory: { itemId: string; quantity: number }[] }> {
  const fn = httpsCallable<
    { battleId: string; itemId: string },
    { stats: PartyBattleParticipantStats; inventory: { itemId: string; quantity: number }[] }
  >(functions, 'useItemInPartyBattle');
  const result = await fn({ battleId, itemId });
  return result.data;
}

export async function callChallengeToPvp(toUid: string): Promise<{ status: 'sent' | 'already-pending' }> {
  const fn = httpsCallable<{ toUid: string }, { status: 'sent' | 'already-pending' }>(functions, 'challengeToPvp');
  const result = await fn({ toUid });
  return result.data;
}

export async function callRespondToPvpChallenge(
  challengeId: string,
  accept: boolean,
): Promise<{ status: 'accepted' | 'declined'; battleId?: string }> {
  const fn = httpsCallable<{ challengeId: string; accept: boolean }, { status: 'accepted' | 'declined'; battleId?: string }>(
    functions,
    'respondToPvpChallenge',
  );
  const result = await fn({ challengeId, accept });
  return result.data;
}

export async function callJoinPvpQueue(): Promise<{ matched: boolean; battleId?: string }> {
  const fn = httpsCallable<void, { matched: boolean; battleId?: string }>(functions, 'joinPvpQueue');
  const result = await fn();
  return result.data;
}

export async function callLeavePvpQueue(): Promise<{ left: true }> {
  const fn = httpsCallable<void, { left: true }>(functions, 'leavePvpQueue');
  const result = await fn();
  return result.data;
}
