// Mirrors the party-battle types in functions/src/shared-types/index.ts (kept in sync by hand,
// same reason as every other server-authored document shape - see CLAUDE.md). Clients only ever
// read these via onSnapshot; every write goes through a Cloud Function in
// functions/src/functions/partyBattle.ts / endlessBattle.ts.

import type { ActiveAilment } from './ailment';
import type { CombatAction } from './combat';

export type PartyBattleMode = 'endless' | 'pvp';
export type PartyBattleStatus = 'active' | 'awaitingContinueVote' | 'victory' | 'defeated' | 'withdrawn';

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
}

export interface PartyBattleEnemyState {
  enemyId: string;
  level: number;
  hp: number;
  maxHp: number;
}

export interface PartyBattleRoundResult {
  round: number;
  log: string[];
  resolvedAt: number;
}

export interface PartyBattleWaveRewards {
  xp: number;
  gold: number;
  itemIds: string[];
}

export interface PartyBattleSession {
  id: string;
  clanId: string | null;
  mode: PartyBattleMode;
  participants: string[];
  locationId: string;
  partyAverageLevel: number;
  wave: number;
  enemies: PartyBattleEnemyState[];
  round: number;
  status: PartyBattleStatus;
  turnDeadlineAt: number;
  pendingActions: Record<string, CombatAction | null>;
  participantStats: Record<string, PartyBattleParticipantStats>;
  lastRoundResult: PartyBattleRoundResult | null;
  lastWaveRewards: Record<string, PartyBattleWaveRewards> | null;
  continueVotes: Record<string, boolean>;
  startedAt: number;
  updatedAt: number;
}
