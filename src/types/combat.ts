import type { Party } from './future';

export type CombatActionType = 'attack' | 'skill' | 'lanternAbility' | 'item' | 'defend' | 'flee';

export interface CombatAction {
  type: CombatActionType;
  skillId?: string;
  abilityId?: string;
  itemId?: string;
}

export type CombatPhase =
  | 'idle'
  | 'intro'
  | 'playerTurnSelect'
  | 'resolvingAction'
  | 'victory'
  | 'defeat'
  | 'fled';

export interface CombatLogLine {
  text: string;
}

export interface CombatRewards {
  xp: number;
  gold: number;
  itemIds: string[];
  leveledUp: boolean;
}

/** Client-side view of the server-authoritative combat session; hydrated from Cloud Function responses only. */
export interface CombatState {
  sessionId: string | null;
  phase: CombatPhase;
  enemyId: string;
  enemyName: string;
  enemyBattleSpriteAssetId: string;
  enemyHp: number;
  enemyMaxHp: number;
  playerHp: number;
  playerMaxHp: number;
  playerSpirit: number;
  playerMaxSpirit: number;
  round: number;
  log: CombatLogLine[];
  rewards: CombatRewards | null;
  backgroundAssetId: string;
  // TODO(party-system): once co-op combat lands, this will carry the full party's
  // combatant state instead of a single player; reserved now so the turn queue can
  // grow from 1-vs-1 to N-vs-many without a rewrite.
  party?: Party;
}
