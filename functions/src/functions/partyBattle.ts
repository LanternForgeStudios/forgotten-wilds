import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { resolvePartyPlayerTurn, resolvePartyEnemyPhase, resolvePvpTurn } from '../engine/partyCombatEngine';
import { computeRewards } from '../engine/combatEngine';
import { rollChestRewards } from '../engine/dailyChestEngine';
import { isMilestoneWave, milestoneChestTier } from '../engine/endlessBattleEngine';
import { grantItem } from '../engine/inventoryEngine';
import { applyLevelUp } from '../engine/levelingEngine';
import type {
  CombatAction,
  CombatActionType,
  PartyBattleParticipantStats,
  PartyBattleSession,
  PartyBattleStatus,
  PartyBattleWaveRewards,
  PlayerSave,
} from '../shared-types';

/** partyBattles/{battleId}'s one participantStats entry for a save that's already been (or is
 *  about to be) restored to full - shared by startEndlessBattle and startPvpBattle so the two
 *  don't duplicate this shape twice. Reads only the save's max-value fields, so it's correct
 *  whether called before or after the save's own hp/spirit/oil are actually written back to max. */
export function fullyRestoredParticipantStats(save: PlayerSave): PartyBattleParticipantStats {
  return {
    hp: save.player.stats.maxHp,
    maxHp: save.player.stats.maxHp,
    spirit: save.player.stats.maxSpirit,
    maxSpirit: save.player.stats.maxSpirit,
    lanternOil: save.player.stats.maxLanternOil,
    maxLanternOil: save.player.stats.maxLanternOil,
    attack: save.player.stats.attack,
    defense: save.player.stats.defense,
    speed: save.player.stats.speed,
    ailments: [],
    defending: false,
  };
}

/** Per the design doc: "if no action is selected within 20 seconds, the character automatically
 *  performs Defend, and combat immediately proceeds to the next turn." Now applies per-player-turn
 *  (not per round) since resolution is sequential - see partyCombatEngine.ts's own top comment.
 *  Exported for endlessBattle.ts/pvpBattle.ts to reuse when they set a battle doc's first
 *  turnDeadlineAt, rather than each redeclaring the same constant. */
export const TURN_TIMEOUT_MS = 20_000;

/** Mirrors registry.ts's overworld battle-background asset ids (functions/ can't import from
 *  src/ - see CLAUDE.md's client/server data-split convention). Deliberately excludes
 *  battle-bg.hollow-rail-mine (a dungeon backdrop) and battle-bg.shrine (story/boss-specific) so
 *  both Endless Battle and PvP always roll a generic "random overworld" scene per the "looks like
 *  a normal encounter" design ask. Shared here (not endlessBattle.ts-only) since PvP needs the
 *  exact same pool. */
const PARTY_BATTLE_BACKGROUND_ASSET_IDS = [
  'battle-bg.forest',
  'battle-bg.ironwood-trail',
  'battle-bg.raven-ridge',
  'battle-bg.whisper-falls',
  'battle-bg.black-briar-forest',
];

export function rollBattleBackgroundAssetId(): string {
  return PARTY_BATTLE_BACKGROUND_ASSET_IDS[Math.floor(Math.random() * PARTY_BATTLE_BACKGROUND_ASSET_IDS.length)];
}

const VALID_ACTION_TYPES: CombatActionType[] = ['attack', 'skill', 'lanternAbility', 'item', 'defend', 'flee'];

function validateAction(raw: unknown): CombatAction {
  const type = (raw as { type?: unknown } | null)?.type;
  if (typeof type !== 'string' || !VALID_ACTION_TYPES.includes(type as CombatActionType)) {
    throw new HttpsError('invalid-argument', 'Invalid action.');
  }
  const data = raw as CombatAction;
  return {
    type: data.type,
    skillId: typeof data.skillId === 'string' ? data.skillId : undefined,
    abilityId: typeof data.abilityId === 'string' ? data.abilityId : undefined,
    itemIds: Array.isArray(data.itemIds) ? data.itemIds.slice(0, 3) : undefined,
    targetIndex: typeof data.targetIndex === 'number' ? data.targetIndex : undefined,
    targetAll: !!data.targetAll,
  };
}

interface SubmitPartyBattleActionRequest {
  battleId: string;
  /** Omittable - a client can call this purely to check/force-resolve a turn it didn't have a new
   *  action for (the "any client's periodic poll" half of the client-triggered timeout model, see
   *  the plan's Phase B notes), without that counting as "I chose to Defend" on its own. */
  action?: unknown;
}

/**
 * Resolves exactly one player's turn - whoever `turnOrder[currentTurnIndex]` is - against the
 * LIVE enemy board, then advances to the next player. Only that active player's own submitted
 * action is accepted; once the 20s deadline passes, any client's poll (with no action of its own)
 * can force that turn to resolve with Defend substituted. Once every player in `turnOrder` has
 * gone this round, the enemy phase resolves once and a new round begins - see
 * partyCombatEngine.ts's own top comment for why resolution is sequential rather than
 * collect-everyone-then-resolve-at-once (two players could otherwise both target an enemy the
 * first one's hit had already defeated). Whichever client's call happens to satisfy the "it's my
 * turn" or "the deadline passed" condition is the one that triggers the actual resolution, guarded
 * by this being a single Firestore transaction so it can only ever fire once.
 */
export const submitPartyBattleAction = onCall<SubmitPartyBattleActionRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const battleId = request.data?.battleId;
  if (!battleId) throw new HttpsError('invalid-argument', 'No battle specified.');
  const action = request.data?.action !== undefined ? validateAction(request.data.action) : undefined;

  const db = getFirestore();
  const battleRef = db.collection('partyBattles').doc(battleId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(battleRef);
    if (!snap.exists) throw new HttpsError('not-found', 'That battle no longer exists.');
    const battle = snap.data() as PartyBattleSession;
    if (!battle.participants.includes(uid)) {
      throw new HttpsError('permission-denied', 'You are not part of this battle.');
    }
    if (battle.status !== 'active') {
      return { resolved: false, status: battle.status };
    }

    // Fleeing/leaving is the one action any participant can take regardless of whose turn it is -
    // bypasses the turn-order gate entirely, deliberately. A player wanting out of a stalled fight
    // (the other participant unresponsive, say) shouldn't have to wait for a turn that may never
    // come around to them - that was exactly the live bug this replaces (Leave Battle only ever
    // rendered/worked for the currently-active player, leaving a waiting participant with zero
    // recourse). Ends the battle immediately for everyone: an Endless Battle run withdraws (restore
    // + clear locks, same as voteContinueEndlessBattle's decline path); a PvP duel is forfeited in
    // the other player's favor (the normal win/restore/reward path, just triggered by a forfeit
    // instead of a landed knockout hit).
    if (action?.type === 'flee') {
      const now = Date.now();
      if (battle.mode === 'pvp') {
        const opponentUid = battle.participants.find((p) => p !== uid)!;
        await restoreAndRewardPvpParticipants(tx, db, opponentUid, uid, battle.partyAverageLevel);
        for (const p of battle.participants) tx.delete(db.collection('partyBattleLocks').doc(p));
        tx.update(battleRef, {
          status: 'victory',
          winnerUid: opponentUid,
          lastTurnResult: { round: battle.round, log: [`${uid} forfeits the match.`], resolvedAt: now },
          updatedAt: now,
        });
        return { resolved: true, status: 'victory' as const, winnerUid: opponentUid };
      }
      await restoreParticipantsAndClearLocks(tx, db, battle.participants);
      tx.update(battleRef, {
        status: 'withdrawn',
        lastTurnResult: { round: battle.round, log: [`${uid} flees - the party withdraws from the battle.`], resolvedAt: now },
        updatedAt: now,
      });
      return { resolved: true, status: 'withdrawn' as const };
    }

    const activeUid = battle.turnOrder[battle.currentTurnIndex];
    const now = Date.now();
    const deadlinePassed = now >= battle.turnDeadlineAt;

    if (action && uid !== activeUid) {
      throw new HttpsError('failed-precondition', "It isn't your turn yet.");
    }
    if (!action && !deadlinePassed) {
      // A poll with nothing to submit and no timeout yet - just report whose turn it is.
      return { resolved: false, status: 'active' as const, activeUid };
    }

    const resolvedAction: CombatAction = action ?? { type: 'defend' };
    const activeStats = battle.participantStats[activeUid];

    if (battle.mode === 'pvp') {
      return resolvePvpBattleTurn(tx, db, battleRef, battle, activeUid, activeStats, resolvedAction, now);
    }

    const turnResult = resolvePartyPlayerTurn(
      {
        uid: activeUid,
        action: resolvedAction,
        // Party battles don't track Stamina (no Dash mid-fight) - 0/0 is the same "not applicable"
        // convention STARTING_STATS uses before Stamina is unlocked.
        stats: { ...activeStats, stamina: 0, maxStamina: 0 },
        // Real inventory-backed item usage is Phase C/D's job (see the original design note) -
        // the engine already accepts itemIds and simulates their effect, just not yet wired to a
        // real per-participant inventory here.
        inventory: [],
        ailments: activeStats.ailments,
      },
      battle.enemies.map((e) => ({ enemyId: e.enemyId, level: e.level, hp: e.hp })),
    );

    const nextParticipantStats: Record<string, PartyBattleParticipantStats> = { ...battle.participantStats };
    nextParticipantStats[activeUid] = {
      ...activeStats,
      hp: turnResult.hp,
      spirit: turnResult.spirit,
      lanternOil: turnResult.lanternOil,
      ailments: turnResult.ailments,
      defending: turnResult.defending,
    };
    const nextEnemies = battle.enemies.map((e, i) => ({ ...e, hp: turnResult.enemyHp[i] }));
    const nextTurnIndex = battle.currentTurnIndex + 1;
    const roundComplete = nextTurnIndex >= battle.turnOrder.length;

    if (!roundComplete) {
      tx.update(battleRef, {
        participantStats: nextParticipantStats,
        enemies: nextEnemies,
        currentTurnIndex: nextTurnIndex,
        turnDeadlineAt: now + TURN_TIMEOUT_MS,
        lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now },
        updatedAt: now,
      });
      return { resolved: true, status: 'active' as const, phase: 'playerTurn' as const };
    }

    // Every alive participant this round has now gone - check for victory before running the
    // enemy phase (no point letting an already-cleared board "attack back" after the last blow).
    const enemiesDefeated = nextEnemies.every((e) => e.hp <= 0);
    if (enemiesDefeated) {
      const isEndless = battle.mode === 'endless';
      const status: PartyBattleStatus = isEndless ? 'awaitingContinueVote' : 'victory';
      let lastWaveRewards = battle.lastWaveRewards;
      if (isEndless) {
        const aliveUids = battle.participants.filter((p) => nextParticipantStats[p].hp > 0);
        lastWaveRewards = await grantWaveRewards(tx, db, aliveUids, battle.wave, battle.enemies);
      }
      tx.update(battleRef, {
        participantStats: nextParticipantStats,
        enemies: nextEnemies,
        status,
        lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now },
        lastWaveRewards,
        continueVotes: status === 'awaitingContinueVote' ? {} : battle.continueVotes,
        updatedAt: now,
      });
      return { resolved: true, status, phase: 'victory' as const };
    }

    // Enemy phase: every currently-alive participant takes a hit, once, now that everyone's gone.
    const alivePlayersForEnemyPhase = battle.participants
      .filter((p) => nextParticipantStats[p].hp > 0)
      .map((p) => ({
        uid: p,
        hp: nextParticipantStats[p].hp,
        maxHp: nextParticipantStats[p].maxHp,
        defense: nextParticipantStats[p].defense,
        ailments: nextParticipantStats[p].ailments,
        defending: nextParticipantStats[p].defending,
      }));
    const enemyPhase = resolvePartyEnemyPhase(
      alivePlayersForEnemyPhase,
      nextEnemies.map((e) => ({ enemyId: e.enemyId, level: e.level, hp: e.hp })),
    );
    for (const p of enemyPhase.players) {
      nextParticipantStats[p.uid] = { ...nextParticipantStats[p.uid], hp: p.hp, ailments: p.ailments, defending: false };
    }
    // Anyone excluded above (already down before the enemy phase ran) also clears defending, same
    // as everyone else once a round fully resolves.
    for (const p of battle.participants) {
      if (!alivePlayersForEnemyPhase.some((ap) => ap.uid === p)) {
        nextParticipantStats[p] = { ...nextParticipantStats[p], defending: false };
      }
    }

    const combinedLog = [...turnResult.log, ...enemyPhase.log];
    const partyDefeated = battle.participants.every((p) => nextParticipantStats[p].hp <= 0);

    if (partyDefeated) {
      if (battle.mode === 'endless') {
        await restoreParticipantsAndClearLocks(tx, db, battle.participants);
      }
      tx.update(battleRef, {
        participantStats: nextParticipantStats,
        enemies: nextEnemies,
        status: 'defeated',
        lastTurnResult: { round: battle.round, log: combinedLog, resolvedAt: now },
        updatedAt: now,
      });
      return { resolved: true, status: 'defeated' as const };
    }

    // New round: recompute turn order from currently-alive participants (see PartyBattleSession's
    // own doc comment on turnOrder).
    const newTurnOrder = battle.participants.filter((p) => nextParticipantStats[p].hp > 0);
    tx.update(battleRef, {
      participantStats: nextParticipantStats,
      enemies: nextEnemies,
      round: battle.round + 1,
      turnOrder: newTurnOrder,
      currentTurnIndex: 0,
      turnDeadlineAt: now + TURN_TIMEOUT_MS,
      lastTurnResult: { round: battle.round, log: combinedLog, resolvedAt: now },
      updatedAt: now,
    });
    return { resolved: true, status: 'active' as const, phase: 'enemyPhase' as const };
  });
});

/** PvP has no enemy board and no wave/enemy-phase structure - it's exactly two participants taking
 *  turns attacking each other directly (see resolvePvpTurn's own doc comment for why that's a
 *  separate engine function rather than a reuse of resolvePartyPlayerTurn). Turns simply alternate
 *  between the two participants until one is defeated or forfeits (flee) - no round-level enemy
 *  phase to run afterward, unlike Endless Battle. */
async function resolvePvpBattleTurn(
  tx: Transaction,
  db: Firestore,
  battleRef: DocumentReference,
  battle: PartyBattleSession,
  activeUid: string,
  activeStats: PartyBattleParticipantStats,
  resolvedAction: CombatAction,
  now: number,
) {
  const opponentUid = battle.participants.find((p) => p !== activeUid)!;
  const opponentStats = battle.participantStats[opponentUid];

  const turnResult = resolvePvpTurn(
    {
      uid: activeUid,
      action: resolvedAction,
      stats: { ...activeStats, stamina: 0, maxStamina: 0 },
      inventory: [],
      ailments: activeStats.ailments,
    },
    { hp: opponentStats.hp, maxHp: opponentStats.maxHp, defense: opponentStats.defense },
  );

  const nextParticipantStats: Record<string, PartyBattleParticipantStats> = {
    ...battle.participantStats,
    [activeUid]: {
      ...activeStats,
      hp: turnResult.hp,
      spirit: turnResult.spirit,
      lanternOil: turnResult.lanternOil,
      ailments: turnResult.ailments,
      defending: turnResult.defending,
    },
    [opponentUid]: { ...opponentStats, hp: turnResult.defenderHp },
  };

  const matchOver = turnResult.forfeited || turnResult.defenderHp <= 0;
  if (matchOver) {
    const winnerUid = turnResult.forfeited ? opponentUid : activeUid;
    const loserUid = turnResult.forfeited ? activeUid : opponentUid;
    // Restore-to-full and reward-grant both write the same two user docs, so they're combined
    // into one function/one tx.set per user rather than called separately - two independent
    // writes to the same doc in one transaction would each read the same pre-transaction
    // snapshot and the later tx.set would silently clobber the earlier one's changes.
    await restoreAndRewardPvpParticipants(tx, db, winnerUid, loserUid, battle.partyAverageLevel);
    for (const p of battle.participants) tx.delete(db.collection('partyBattleLocks').doc(p));
    tx.update(battleRef, {
      participantStats: nextParticipantStats,
      status: 'victory',
      winnerUid,
      lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now },
      updatedAt: now,
    });
    return { resolved: true, status: 'victory' as const, winnerUid };
  }

  const nextTurnIndex = (battle.currentTurnIndex + 1) % battle.turnOrder.length;
  tx.update(battleRef, {
    participantStats: nextParticipantStats,
    currentTurnIndex: nextTurnIndex,
    round: nextTurnIndex === 0 ? battle.round + 1 : battle.round,
    turnDeadlineAt: now + TURN_TIMEOUT_MS,
    lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now },
    updatedAt: now,
  });
  return { resolved: true, status: 'active' as const, phase: 'playerTurn' as const };
}

/** Casual PvP has no enemy to loot - "winner takes normal rewards, loser gets a small
 *  participation reward, no gold/materials ever lost" per the design doc. Deliberately a simple
 *  level-scaled flat award rather than reusing computeRewards (that function's whole shape is
 *  keyed on ENEMIES' authored xpReward/goldReward/lootTable, which doesn't apply to a defeated
 *  player). Tuning these two constants is a balance call for later playtesting, not a correctness
 *  concern. */
const PVP_WINNER_BASE_XP = 40;
const PVP_WINNER_XP_PER_LEVEL = 4;
const PVP_WINNER_BASE_GOLD = 15;
const PVP_WINNER_GOLD_PER_LEVEL = 2;
const PVP_LOSER_XP_FRACTION = 0.25;

/** Restores both real saves to full HP/Spirit/Oil ("full restore before and after" per the design
 *  doc) and grants the winner/loser their end-of-match rewards, in one read-modify-write per user
 *  doc - see this function's one call site for why restore and reward can't be two separate writes
 *  within the same transaction. */
async function restoreAndRewardPvpParticipants(
  tx: Transaction,
  db: Firestore,
  winnerUid: string,
  loserUid: string,
  level: number,
): Promise<void> {
  const winnerXp = PVP_WINNER_BASE_XP + level * PVP_WINNER_XP_PER_LEVEL;
  const winnerGold = PVP_WINNER_BASE_GOLD + level * PVP_WINNER_GOLD_PER_LEVEL;
  const loserXp = Math.round(winnerXp * PVP_LOSER_XP_FRACTION);

  const winnerRef = db.collection('users').doc(winnerUid);
  const loserRef = db.collection('users').doc(loserUid);
  const [winnerSnap, loserSnap] = await Promise.all([tx.get(winnerRef), tx.get(loserRef)]);
  const now = Date.now();

  function restore(save: PlayerSave): void {
    save.player.stats.hp = save.player.stats.maxHp;
    save.player.stats.spirit = save.player.stats.maxSpirit;
    if (save.player.equipment.lantern) save.player.stats.lanternOil = save.player.stats.maxLanternOil;
  }

  if (winnerSnap.exists) {
    const save = winnerSnap.data() as PlayerSave;
    restore(save);
    save.player.xp += winnerXp;
    save.player.gold += winnerGold;
    applyLevelUp(save);
    save.updatedAt = now;
    tx.set(winnerRef, save);
  }
  if (loserSnap.exists) {
    const save = loserSnap.data() as PlayerSave;
    restore(save);
    save.player.xp += loserXp;
    applyLevelUp(save);
    save.updatedAt = now;
    tx.set(loserRef, save);
  }
}

/** Grants independent xp/gold/loot to every alive participant for the wave just won, plus a bonus
 *  chest roll on milestone waves (5, 10, 15, 20...) - see endlessBattleEngine.ts. Every enemy on
 *  the wave roster counts as "defeated" for reward purposes (skipLoot is never set - Endless
 *  Battle enemies are never a real named boss with a bossesDefeated-tracked unique drop the way
 *  solo combat's are). Returns the per-uid summary for the battle doc's lastWaveRewards field. */
async function grantWaveRewards(
  tx: Transaction,
  db: Firestore,
  aliveUids: string[],
  wave: number,
  waveEnemies: { enemyId: string }[],
): Promise<Record<string, PartyBattleWaveRewards>> {
  const userRefs = aliveUids.map((uid) => db.collection('users').doc(uid));
  const snaps = await Promise.all(userRefs.map((ref) => tx.get(ref)));
  const defeated = waveEnemies.map((e) => ({ enemyId: e.enemyId }));
  const chestTier = isMilestoneWave(wave) ? milestoneChestTier(wave) : null;

  const summary: Record<string, PartyBattleWaveRewards> = {};
  snaps.forEach((snap, i) => {
    const uid = aliveUids[i];
    if (!snap.exists) return;
    const save = snap.data() as PlayerSave;

    const reward = computeRewards(defeated, save.player.xp, save.player.level);
    let totalXp = reward.xp;
    let totalGold = reward.gold;
    save.player.xp += reward.xp;
    save.player.gold += reward.gold;
    const grantedItemIds: string[] = [];
    for (const itemId of reward.lootItemIds) {
      if (grantItem(save, itemId)) grantedItemIds.push(itemId);
    }

    // Bonus chest roll on milestone waves (5, 10, 15, 20...) - reuses the Daily Chest reward
    // tables rather than a third parallel loot system (see endlessBattleEngine.ts).
    if (chestTier) {
      const chest = rollChestRewards(chestTier);
      totalGold += chest.gold;
      save.player.gold += chest.gold;
      save.player.premiumCurrency += chest.premiumCurrency;
      for (const itemId of chest.itemIds) {
        if (grantItem(save, itemId)) grantedItemIds.push(itemId);
      }
    }

    applyLevelUp(save);
    save.updatedAt = Date.now();
    tx.set(userRefs[i], save);
    summary[uid] = { xp: totalXp, gold: totalGold, itemIds: grantedItemIds };
  });

  return summary;
}

/** Restores every participant's real save to full HP/Spirit/Oil - "after the run ends... every
 *  player is automatically restored... before returning to town" (applies to both a defeated run
 *  and a voluntary exit, see voteContinueEndlessBattle). Downed participants are included, not
 *  just currently-alive ones - the whole party gets the same clean slate regardless of who was
 *  still standing when the run ended. */
export async function restoreParticipantsAndClearLocks(tx: Transaction, db: Firestore, uids: string[]): Promise<void> {
  const userRefs = uids.map((uid) => db.collection('users').doc(uid));
  const snaps = await Promise.all(userRefs.map((ref) => tx.get(ref)));
  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const save = snap.data() as PlayerSave;
    save.player.stats.hp = save.player.stats.maxHp;
    save.player.stats.spirit = save.player.stats.maxSpirit;
    if (save.player.equipment.lantern) save.player.stats.lanternOil = save.player.stats.maxLanternOil;
    save.updatedAt = Date.now();
    tx.set(userRefs[i], save);
  });
  // Frees each participant to start (or be invited into) another battle - matches
  // endlessBattle.ts's own restoreParticipantsAndClearLocks on a voluntary exit.
  for (const uid of uids) tx.delete(db.collection('partyBattleLocks').doc(uid));
}
