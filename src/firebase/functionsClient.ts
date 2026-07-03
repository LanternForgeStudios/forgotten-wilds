import { httpsCallable } from 'firebase/functions';
import type { PlayerSave } from '@/types';
import { functions } from './firebaseConfig';

export async function callCreateCharacter(name: string): Promise<PlayerSave> {
  const fn = httpsCallable<{ name: string }, PlayerSave>(functions, 'createCharacter');
  const result = await fn({ name });
  return result.data;
}

export interface StartEncounterResponse {
  sessionId: string;
  enemyId: string;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
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
  type: 'attack' | 'skill' | 'spiritArt' | 'item' | 'defend' | 'flee';
  skillId?: string;
  itemId?: string;
}

export interface ResolveCombatActionResponse {
  log: string[];
  phase: 'continue' | 'victory' | 'defeat' | 'fled';
  playerHp: number;
  playerMaxHp: number;
  playerSpirit: number;
  playerMaxSpirit: number;
  enemyHp: number;
  enemyMaxHp: number;
  rewards: { xp: number; gold: number; itemIds: string[]; leveledUp: boolean } | null;
  playerLevel: number;
  playerGold: number;
  currentLocationId: string;
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

export async function callPurchaseItem(itemId: string): Promise<void> {
  const fn = httpsCallable<{ itemId: string }, unknown>(functions, 'purchaseItem');
  await fn({ itemId });
}

export async function callRestAtInn(): Promise<void> {
  const fn = httpsCallable(functions, 'restAtInn');
  await fn({});
}

export async function callUseItem(itemId: string): Promise<void> {
  const fn = httpsCallable<{ itemId: string }, unknown>(functions, 'useItem');
  await fn({ itemId });
}
