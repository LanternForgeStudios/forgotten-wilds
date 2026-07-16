import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { resolvePartyRound, type PartyPlayerInput } from '../engine/partyCombatEngine';
import { computeRewards } from '../engine/combatEngine';
import { rollChestRewards } from '../engine/dailyChestEngine';
import { isMilestoneWave, milestoneChestTier } from '../engine/endlessBattleEngine';
import { grantItem } from '../engine/inventoryEngine';
import { applyLevelUp } from '../engine/levelingEngine';
import type { CombatAction, CombatActionType, PartyBattleSession, PartyBattleWaveRewards, PlayerSave } from '../shared-types';

/** Per the design doc: "if no action is selected within 20 seconds, the character automatically
 *  performs Defend, and combat immediately proceeds to the next turn." */
const TURN_TIMEOUT_MS = 20_000;

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
  /** Omittable - a client can call this purely to check/force-resolve a round it didn't have a
   *  new action for (the "any client's periodic poll" half of the client-triggered timeout model,
   *  see the plan's Phase B notes), without that counting as "I chose to Defend" on its own. */
  action?: unknown;
}

/**
 * Records the caller's action for the current round, then resolves the round the instant either
 * every participant has one recorded or `turnDeadlineAt` has passed (whichever comes first) -
 * whichever client's call happens to satisfy that condition is the one that triggers the actual
 * resolution, guarded by this being a single Firestore transaction so it can only ever fire once.
 * No scheduled/background job enforces the 20s deadline - a client that never calls back in
 * (every participant's tab closed right at the deadline) simply leaves the round unresolved until
 * someone reconnects and calls this again. Accepted trade-off, decided with the user up front (see
 * the Phase B plan) rather than adding this project's first scheduled-compute infrastructure.
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

    const pendingActions = { ...battle.pendingActions };
    if (action) pendingActions[uid] = action;

    const now = Date.now();
    const alive = battle.participants.filter((p) => battle.participantStats[p].hp > 0);
    const everyAliveSubmitted = alive.every((p) => !!pendingActions[p]);
    const deadlinePassed = now >= battle.turnDeadlineAt;

    if (!everyAliveSubmitted && !deadlinePassed) {
      tx.update(battleRef, { [`pendingActions.${uid}`]: action ?? null, updatedAt: now });
      return { resolved: false, status: 'active' as const, waitingOn: alive.filter((p) => !pendingActions[p]) };
    }

    // Timeout auto-Defend: any alive participant who hasn't submitted gets Defend substituted,
    // per the design doc. A downed (hp <= 0) participant is excluded from resolvePartyRound
    // entirely - it already treats anyone not in `players` as simply absent from the round.
    const players: PartyPlayerInput[] = alive.map((p) => {
      const stats = battle.participantStats[p];
      return {
        uid: p,
        action: pendingActions[p] ?? { type: 'defend' },
        // Party battles don't track Stamina (no Dash mid-fight) - 0/0 is the same "not applicable"
        // convention STARTING_STATS uses before Stamina is unlocked.
        stats: { ...stats, stamina: 0, maxStamina: 0 },
        // Real inventory-backed item usage (reading/validating/debiting each participant's own
        // users/{uid} save) is Phase C/D's job, once there's an actual battle-start/reward flow to
        // wire it into - this phase's engine already accepts itemIds and simulates their effect,
        // it's just not yet connected to a real inventory here.
        inventory: [],
        ailments: stats.ailments,
      };
    });
    const result = resolvePartyRound({
      players,
      enemies: battle.enemies.map((e) => ({ enemyId: e.enemyId, level: e.level, hp: e.hp })),
    });

    const nextParticipantStats = { ...battle.participantStats };
    for (const p of result.players) {
      nextParticipantStats[p.uid] = {
        ...nextParticipantStats[p.uid],
        hp: p.hp,
        spirit: p.spirit,
        lanternOil: p.lanternOil,
        ailments: p.ailments,
      };
    }
    const nextEnemies = battle.enemies.map((e, i) => ({ ...e, hp: result.enemyHp[i] }));
    const nextRound = battle.round + 1;
    const nextPendingActions = Object.fromEntries(battle.participants.map((p) => [p, null]));

    const isEndless = battle.mode === 'endless';
    const status: PartyBattleSession['status'] =
      result.phase === 'victory'
        ? isEndless
          ? 'awaitingContinueVote'
          : 'victory'
        : result.phase === 'partyDefeated'
          ? 'defeated'
          : 'active';

    // Endless Battle grants per-wave rewards on every win (independent per player, per the design
    // doc) and fully restores every participant's real save once the run ends (victory doesn't
    // end the run - only 'defeated' does here; a voluntary exit is voteContinueEndlessBattle's own
    // job). PvP's reward/restore handling is Phase D's concern, not built yet.
    let lastWaveRewards: Record<string, PartyBattleWaveRewards> | null = battle.lastWaveRewards;
    if (isEndless && status === 'awaitingContinueVote') {
      lastWaveRewards = await grantWaveRewards(tx, db, alive, battle.wave, battle.enemies);
    } else if (isEndless && status === 'defeated') {
      await restoreAllParticipants(tx, db, battle.participants);
    }

    tx.update(battleRef, {
      participantStats: nextParticipantStats,
      enemies: nextEnemies,
      round: nextRound,
      status,
      pendingActions: status === 'active' ? nextPendingActions : battle.pendingActions,
      turnDeadlineAt: status === 'active' ? now + TURN_TIMEOUT_MS : battle.turnDeadlineAt,
      lastRoundResult: { round: battle.round, log: result.log, resolvedAt: now },
      lastWaveRewards,
      continueVotes: status === 'awaitingContinueVote' ? {} : battle.continueVotes,
      updatedAt: now,
    });

    return { resolved: true, status, phase: result.phase };
  });
});

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
async function restoreAllParticipants(tx: Transaction, db: Firestore, uids: string[]): Promise<void> {
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
  // endlessBattle.ts's own endRun on a voluntary exit.
  for (const uid of uids) tx.delete(db.collection('partyBattleLocks').doc(uid));
}
