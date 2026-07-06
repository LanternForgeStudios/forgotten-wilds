import { httpsCallable } from 'firebase/functions';
import type { EnemyTier, PlayerSave } from '@/types';
import { functions } from './firebaseConfig';

export async function callCreateCharacter(name: string): Promise<PlayerSave> {
  const fn = httpsCallable<{ name: string }, PlayerSave>(functions, 'createCharacter');
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
): Promise<{ alreadyCollected: boolean; questsCompleted: string[] }> {
  const fn = httpsCallable<
    { locationId: string; refId: string },
    { alreadyCollected: boolean; questsCompleted: string[] }
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
  rewards: { xp: number; gold: number; itemIds: string[]; leveledUp: boolean } | null;
  playerLevel: number;
  playerGold: number;
  currentLocationId: string;
  /** Sum of all enemy->player damage this round (after Defend halving). */
  damageTakenByPlayer: number;
  /** Every enemy the player damaged/missed this round (attack/skill/offensive lanternAbility). */
  hits: CombatHitResult[];
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

export async function callUseItem(itemId: string): Promise<void> {
  const fn = httpsCallable<{ itemId: string }, unknown>(functions, 'useItem');
  await fn({ itemId });
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

export async function callDash(): Promise<{ stamina: number; maxStamina: number; staminaUpdatedAt: number }> {
  const fn = httpsCallable<Record<string, never>, { stamina: number; maxStamina: number; staminaUpdatedAt: number }>(
    functions,
    'dash',
  );
  const result = await fn({});
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
