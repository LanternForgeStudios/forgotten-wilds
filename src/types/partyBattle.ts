// Mirrors the party-battle types in functions/src/shared-types/index.ts (kept in sync by hand,
// same reason as every other server-authored document shape - see CLAUDE.md). Clients only ever
// read these via onSnapshot; every write goes through a Cloud Function in
// functions/src/functions/partyBattle.ts / endlessBattle.ts.

import type { ActiveAilment, AilmentResistance } from './ailment';
import type { DamageType } from './skill';

export type PartyBattleMode = 'endless' | 'pvp';
export type PartyBattleStatus = 'active' | 'awaitingContinueVote' | 'victory' | 'defeated' | 'withdrawn';

export interface PartyBattleParticipantStats {
  /** Snapshotted once at battle start - see shared-types/index.ts's matching comment. Display only
   *  (e.g. the PvP opponent's level chip). */
  level: number;
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
  defending: boolean;
  /** Snapshotted once at battle start - see shared-types/index.ts's matching comment for why this
   *  doesn't need a live per-turn read the way item ownership does. */
  knownSkillIds: string[];
  lanternId: string | null;
  /** The Lantern Oil upgrade tier bought for that lantern - see functions/src/shared-types/
   *  index.ts's mirror of this field for the full doc comment. */
  lanternOilTier: number;
  gender: 'male' | 'female';
  appearance: 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark';
  /** Snapshotted the same way - see shared-types/index.ts's matching comment. Used for battle log
   *  lines only (e.g. "Alys braces, ready to absorb the next blow."). */
  name: string;
  /** Snapshotted the same way - see shared-types/index.ts's matching comment. Stubbed: always
   *  null today. */
  attackAilment: { id: string; chance: number } | null;
  /** Snapshotted the same way - see shared-types/index.ts's matching comment. Stubbed: always []
   *  today. */
  ailmentResistances: AilmentResistance[];
  /** See shared-types/index.ts's matching comment - true once this participant has used a
   *  non-offensive (defensive/healing) Lantern Ability this round, disabling further Lantern
   *  Ability use until a round-ending action clears it back to false. */
  lanternUsedThisRound?: boolean;
  /** See shared-types/index.ts's matching comment - carries a defensive Lantern Ability's
   *  damage-halving bonus forward to whichever action actually ends this participant's turn. */
  defendingBonusPending?: boolean;
}

export interface PartyBattleEnemyState {
  enemyId: string;
  level: number;
  hp: number;
  maxHp: number;
  ailments: ActiveAilment[];
}

export interface PartyCombatHitResult {
  uid: string;
  targetIndex: number;
  damage: number;
  missed: boolean;
  defeated: boolean;
  /** Drives which generic impact FX (blood/holy-light/magic-spark) bursts on the target -
   *  meaningless when missed. */
  damageType: DamageType;
  /** Set only when this hit's ailment roll actually succeeded - shows that ailment's own colored
   *  FX instead of the generic damageType effect. */
  ailmentInflicted?: string;
}

export interface PartyEnemyHitResult {
  attackerIndex: number;
  targetUid: string;
  damage: number;
  missed: boolean;
  wasDefended: boolean;
  logLine: string;
  /** See PartyCombatHitResult.damageType. */
  damageType: DamageType;
  /** See PartyCombatHitResult.ailmentInflicted. */
  ailmentInflicted?: string;
}

/** PvP only ever has one possible target - singular where the party engine's own hit result
 *  carries a targetIndex. */
export interface PvpHitResult {
  damage: number;
  missed: boolean;
  defeated: boolean;
  /** See PartyCombatHitResult.damageType. */
  damageType: DamageType;
  /** See PartyCombatHitResult.ailmentInflicted. */
  ailmentInflicted?: string;
}

export interface PartyBattleTurnResult {
  round: number;
  log: string[];
  resolvedAt: number;
  /** Endless only: `hits` is the acting player's own offensive swing this turn; `enemyHits` is
   *  only present on the turn that also ran the enemy phase. */
  hits?: PartyCombatHitResult[];
  enemyHits?: PartyEnemyHitResult[];
  /** PvP only - null on a Defend/item/forfeit/stunned turn. */
  pvpHit?: PvpHitResult | null;
  /** Which Specialty Attack the acting player used this turn (type: 'skill' only, defaults to
   *  'keepers-strike') - look up Skill.sfxAssetId against this to play a per-skill hit cue. */
  skillId?: string;
  /** Same idea as skillId, for type: 'lanternAbility' - look up LanternAbility.sfxAssetId. */
  abilityId?: string;
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
  /** A registry.ts battle-background asset id, rolled once at battle start and fixed for the run. */
  battleBackgroundAssetId: string;
  wave: number;
  enemies: PartyBattleEnemyState[];
  round: number;
  status: PartyBattleStatus;
  /** Whose turn it is this round, alive participants only - turnOrder[currentTurnIndex] is the
   *  only participant the server currently accepts a submitted action from. */
  turnOrder: string[];
  currentTurnIndex: number;
  turnDeadlineAt: number;
  participantStats: Record<string, PartyBattleParticipantStats>;
  lastTurnResult: PartyBattleTurnResult | null;
  lastWaveRewards: Record<string, PartyBattleWaveRewards> | null;
  continueVotes: Record<string, boolean>;
  /** PvP-only - which participant won, once status is 'victory'/'defeated'. Always null for
   *  Endless Battle (a shared party-wide outcome, not per-uid). */
  winnerUid: string | null;
  /** PvP-only - what each participant was actually granted once the match ended (winner gets
   *  xp+gold, loser gets a reduced xp-only consolation). null until the match ends; stays null for
   *  Endless Battle (see lastWaveRewards instead). */
  pvpRewards: Record<string, { xp: number; gold: number }> | null;
  startedAt: number;
  updatedAt: number;
}
