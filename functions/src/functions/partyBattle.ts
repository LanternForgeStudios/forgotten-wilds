import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { resolvePartyPlayerTurn, resolvePartyEnemyPhase, resolvePvpTurn } from '../engine/partyCombatEngine';
import { isStunned } from '../engine/combatMath';
import { computeRewards, aggregateItemCounts, hasSufficientQuantity } from '../engine/combatEngine';
import { rollChestRewards } from '../engine/dailyChestEngine';
import { isMilestoneWave, milestoneChestTier } from '../engine/endlessBattleEngine';
import { grantItem, itemWouldHaveEffect, removeItem } from '../engine/inventoryEngine';
import { applyLevelUp } from '../engine/levelingEngine';
import { SKILLS } from '../data/skills';
import { AILMENTS } from '../data/ailments';
import { ITEMS } from '../data/items';
import { EQUIPMENT } from '../data/equipment';
import { LANTERN_ABILITIES } from '../data/lanternAbilities';
import type {
  ClanDoc,
  CombatAction,
  CombatActionType,
  PartyBattleParticipantStats,
  PartyBattleSession,
  PartyBattleStatus,
  PartyBattleWaveRewards,
  PlayerSave,
  Stats,
  UserDirectoryDoc,
} from '../shared-types';

/** A save already read (and possibly item-deducted) earlier in the same transaction, for whichever
 *  one uid a restore/reward helper below shouldn't re-`tx.get` - Firestore transactions require
 *  every read to happen before any write, so once a turn's item deduction has been applied
 *  in-memory to the active player's save, nothing later in the same transaction can independently
 *  re-fetch that same doc (see submitPartyBattleAction's own call sites for why this matters). */
interface PreFetchedSave {
  uid: string;
  save: PlayerSave;
}

async function getSaveForUid(tx: Transaction, db: Firestore, uid: string, preFetched?: PreFetchedSave): Promise<PlayerSave | null> {
  if (preFetched?.uid === uid) return preFetched.save;
  const snap = await tx.get(db.collection('users').doc(uid));
  return snap.exists ? (snap.data() as PlayerSave) : null;
}

/** Validates a submitted action's skill/lanternAbility/item ownership and sufficiency against the
 *  acting player's real save - mirrors resolveCombatAction.ts's own checks (~lines 73-131)
 *  practically verbatim, just sourced from PartyBattleParticipantStats (spirit/oil/ailments -
 *  already the battle's own live numbers, not the real save's, since those are intentionally not
 *  kept in sync mid-battle) plus the real save's inventory/knownSkillIds/equipment for ownership.
 *  Throws on any violation; callers run this before ever calling the engine, same as solo does. */
function validatePartyBattleAction(action: CombatAction, stats: PartyBattleParticipantStats, save: PlayerSave): void {
  if (action.type === 'skill') {
    // Data-driven rather than hardcoding "if silence" - mirrors resolveCombatAction.ts's own
    // check verbatim, just sourced from the battle's live participantStats.ailments instead of a
    // combat session's playerAilments. This was missing entirely here - a silenced player could
    // still submit a real 'skill' action in Endless Battle/PvP and have it resolve normally, unlike
    // solo combat which rejects it outright.
    const silencer = stats.ailments.find((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
    if (silencer) {
      throw new HttpsError('failed-precondition', `You are ${AILMENTS[silencer.ailmentId].name} and cannot use Specialty Attacks.`);
    }
    const skillId = action.skillId ?? 'keepers-strike';
    const skill = SKILLS[skillId];
    if (!skill) throw new HttpsError('invalid-argument', 'Unknown Specialty Attack.');
    // SKILLS also holds every enemy's own signature move in the same flat dictionary - without
    // this check, a crafted client call could request any of those by id.
    if (!stats.knownSkillIds.includes(skillId)) {
      throw new HttpsError('failed-precondition', 'You have not learned that Specialty Attack.');
    }
    if (stats.spirit < skill.spiritCost) {
      throw new HttpsError('failed-precondition', 'Not enough Spirit for that.');
    }
  }
  if (action.type === 'lanternAbility') {
    const disabler = stats.ailments.find((a) => AILMENTS[a.ailmentId]?.effect.disablesLanternAbility);
    if (disabler) {
      throw new HttpsError('failed-precondition', `You are ${AILMENTS[disabler.ailmentId].name} and cannot use the Lantern specialty.`);
    }
    const lanternDef = stats.lanternId ? EQUIPMENT[stats.lanternId] : undefined;
    const abilityId = action.abilityId;
    const ability = abilityId ? LANTERN_ABILITIES[abilityId] : undefined;
    if (!ability || !lanternDef?.lanternAbilityIds?.includes(abilityId!)) {
      throw new HttpsError('failed-precondition', 'Your equipped lantern cannot do that.');
    }
    if (stats.lanternOil < ability.oilCost) {
      throw new HttpsError('failed-precondition', 'Not enough Lantern Oil for that.');
    }
  }
  const itemIds = action.itemIds ?? [];
  if (itemIds.length > 0) {
    const playerStats: Stats = { ...stats, stamina: 0, maxStamina: 0 };
    for (const [itemId] of aggregateItemCounts(itemIds)) {
      const def = ITEMS[itemId];
      if (!def?.usableInCombat) throw new HttpsError('failed-precondition', 'You cannot use that item right now.');
      const effect = def.effect;
      if (!effect || !itemWouldHaveEffect(effect, playerStats, stats.ailments)) {
        throw new HttpsError('failed-precondition', 'That would have no effect right now.');
      }
    }
    if (!hasSufficientQuantity(itemIds, save.inventory)) {
      throw new HttpsError('failed-precondition', 'You do not have enough of that item.');
    }
  }
}

function deductConsumedItems(save: PlayerSave, itemConsumedIds: string[]): void {
  for (const [itemId, count] of aggregateItemCounts(itemConsumedIds)) {
    removeItem(save, itemId, count);
  }
}

interface UseItemInPartyBattleRequest {
  battleId: string;
  itemId: string;
}

/** Consuming a healing/spirit/ailment-cure item mid-battle without spending a turn - the party
 *  battle equivalent of useItem.ts, called from the Items menu's "Done" button so a Spirit Draught
 *  or Lantern Oil used here unlocks a Skill/Lantern Ability button on the very next screen, same as
 *  solo combat. Can't just reuse useItem.ts as-is: that function only ever touches users/{uid}
 *  because solo combat reads live save stats each turn, but a party battle's hp/spirit/oil/ailments
 *  live on partyBattles/{battleId}.participantStats[uid] instead (a separate in-fight snapshot,
 *  decoupled from the real save for the whole run) - useItem.ts alone would silently desync the
 *  battle from the real save. Deliberately not turn-gated (any participant, any time, matching
 *  solo's "costs no turn" behavior) - only requires the battle still be active and the caller
 *  still be alive in it. */
export const useItemInPartyBattle = onCall<UseItemInPartyBattleRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');
  const battleId = request.data?.battleId;
  const itemId = request.data?.itemId;
  const def = itemId ? ITEMS[itemId] : undefined;
  const effect = def?.effect;
  if (!battleId || !effect) throw new HttpsError('invalid-argument', 'That item cannot be used this way.');

  const db = getFirestore();
  const battleRef = db.collection('partyBattles').doc(battleId);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const [battleSnap, userSnap] = await Promise.all([tx.get(battleRef), tx.get(userRef)]);
    if (!battleSnap.exists) throw new HttpsError('not-found', 'That battle no longer exists.');
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const battle = battleSnap.data() as PartyBattleSession;
    const save = userSnap.data() as PlayerSave;
    if (!battle.participants.includes(uid)) throw new HttpsError('permission-denied', 'You are not part of this battle.');
    if (battle.status !== 'active') throw new HttpsError('failed-precondition', 'This battle has already ended.');

    const stats = { ...battle.participantStats[uid] };
    if (stats.hp <= 0) throw new HttpsError('failed-precondition', 'You are down and cannot use items.');

    const entry = save.inventory.find((i) => i.itemId === itemId);
    if (!entry || entry.quantity < 1) throw new HttpsError('failed-precondition', 'You do not have that item.');
    if (!itemWouldHaveEffect(effect, { ...stats, stamina: 0, maxStamina: 0 }, stats.ailments)) {
      throw new HttpsError('failed-precondition', 'That would have no effect right now.');
    }

    if (effect.healHpPercent) stats.hp = Math.min(stats.maxHp, stats.hp + Math.round(stats.maxHp * effect.healHpPercent));
    if (effect.healSpiritPercent) {
      stats.spirit = Math.min(stats.maxSpirit, stats.spirit + Math.round(stats.maxSpirit * effect.healSpiritPercent));
    }
    if (effect.restoreOilPercent) {
      stats.lanternOil = Math.min(stats.maxLanternOil, stats.lanternOil + Math.round(stats.maxLanternOil * effect.restoreOilPercent));
    }
    if (effect.cureAilmentId) {
      stats.ailments = stats.ailments.filter((a) => a.ailmentId !== effect.cureAilmentId);
    }

    removeItem(save, itemId);
    save.updatedAt = Date.now();
    tx.set(userRef, save);
    tx.update(battleRef, { [`participantStats.${uid}`]: stats, updatedAt: Date.now() });

    return { stats, inventory: save.inventory };
  });
});

/** partyBattles/{battleId}'s one participantStats entry for a save that's already been (or is
 *  about to be) restored to full - shared by startEndlessBattle and startPvpBattle so the two
 *  don't duplicate this shape twice. Reads only the save's max-value fields, so it's correct
 *  whether called before or after the save's own hp/spirit/oil are actually written back to max. */
export function fullyRestoredParticipantStats(save: PlayerSave): PartyBattleParticipantStats {
  // Backfill for a save written before knownSkillIds existed - same one-line pattern
  // resolveCombatAction.ts already uses for the exact same reason (see that file's own comment).
  if (!save.player.knownSkillIds) save.player.knownSkillIds = ['keepers-strike'];
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
    knownSkillIds: save.player.knownSkillIds,
    lanternId: save.player.equipment.lantern ?? null,
    skin: save.player.skin,
    name: save.player.name,
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
  // A "poll only" call (the client-triggered timeout model's periodic check-in) omits `action`
  // entirely client-side, but the Firebase callable-function wire format serializes an omitted/
  // undefined property to `null`, not to an absent key - `!== undefined` alone let a poll's
  // action arrive here as `null` and fall through to validateAction(null), which threw "Invalid
  // action." on *every single poll call*, forever. That silently broke the entire timeout/
  // auto-Defend mechanism (confirmed by hand: a battle left at 0s to act never resolved) since
  // this throw happened before any turn/deadline logic even ran. `!= null` (loose) catches both.
  const action = request.data?.action != null ? validateAction(request.data.action) : undefined;

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
      const fleeingName = battle.participantStats[uid]?.name ?? uid;
      if (battle.mode === 'pvp') {
        const opponentUid = battle.participants.find((p) => p !== uid)!;
        const pvpRewards = await restoreAndRewardPvpParticipants(tx, db, opponentUid, uid, battle.partyAverageLevel);
        for (const p of battle.participants) tx.delete(db.collection('partyBattleLocks').doc(p));
        tx.update(battleRef, {
          status: 'victory',
          winnerUid: opponentUid,
          pvpRewards,
          lastTurnResult: { round: battle.round, log: [`${fleeingName} forfeits the match.`], resolvedAt: now },
          updatedAt: now,
        });
        return { resolved: true, status: 'victory' as const, winnerUid: opponentUid };
      }
      const bumpClanWave = await prepareClanHighestWaveUpdate(tx, db, battle.clanId, battle.wave);
      const bumpSoloWave = await prepareSoloHighestWaveUpdate(tx, db, battle.clanId, battle.participants, battle.wave);
      await restoreParticipantsAndClearLocks(tx, db, battle.participants);
      tx.update(battleRef, {
        status: 'withdrawn',
        lastTurnResult: { round: battle.round, log: [`${fleeingName} flees - the party withdraws from the battle.`], resolvedAt: now },
        updatedAt: now,
      });
      bumpClanWave?.();
      bumpSoloWave?.();
      return { resolved: true, status: 'withdrawn' as const };
    }

    const activeUid = battle.turnOrder[battle.currentTurnIndex];
    const activeStats = battle.participantStats[activeUid];
    const now = Date.now();
    const deadlinePassed = now >= battle.turnDeadlineAt;
    // A stunned active player's turn is a guaranteed no-op regardless of what they submit (see
    // partyCombatEngine.ts's own resolvePartyPlayerTurn/resolvePvpTurn doc comments) - waiting out
    // the full 20s deadline (or requiring them to click something) before resolving it just stalls
    // every other participant for no reason. Any poll (including the one this panel fires
    // immediately on mount/every 3s) can force it through right away instead.
    const activeIsStunned = isStunned(activeStats.ailments);

    if (action && uid !== activeUid) {
      throw new HttpsError('failed-precondition', "It isn't your turn yet.");
    }
    if (!action && !deadlinePassed && !activeIsStunned) {
      // A poll with nothing to submit and no timeout yet - just report whose turn it is.
      return { resolved: false, status: 'active' as const, activeUid };
    }

    const resolvedAction: CombatAction = action ?? { type: 'defend' };

    // A live read of the acting player's real save - everything else about a turn is fully
    // described by the battle doc's own participantStats snapshot, but items are a shared
    // resource that could be spent elsewhere between turns, so (like solo combat's
    // resolveCombatAction.ts) this is read fresh every turn rather than snapshotted once at
    // battle start. Must happen before any tx.update/tx.set below (Firestore transactions
    // require every read before any write).
    const activeUserRef = db.collection('users').doc(activeUid);
    const activeUserSnap = await tx.get(activeUserRef);
    if (!activeUserSnap.exists) throw new HttpsError('failed-precondition', 'Character not found.');
    const activeSave = activeUserSnap.data() as PlayerSave;
    validatePartyBattleAction(resolvedAction, activeStats, activeSave);

    if (battle.mode === 'pvp') {
      return resolvePvpBattleTurn(tx, db, battleRef, battle, activeUid, activeStats, activeUserRef, activeSave, resolvedAction, now);
    }

    const turnResult = resolvePartyPlayerTurn(
      {
        uid: activeUid,
        name: activeStats.name,
        action: resolvedAction,
        // Party battles don't track Stamina (no Dash mid-fight) - 0/0 is the same "not applicable"
        // convention STARTING_STATS uses before Stamina is unlocked.
        stats: { ...activeStats, stamina: 0, maxStamina: 0 },
        inventory: activeSave.inventory,
        ailments: activeStats.ailments,
      },
      battle.enemies.map((e) => ({ enemyId: e.enemyId, level: e.level, hp: e.hp })),
    );
    // Applied in-memory now, written to Firestore at whichever exit branch below actually ends up
    // writing activeUserRef (a plain tx.set here, or threaded into grantWaveRewards/
    // restoreParticipantsAndClearLocks as a PreFetchedSave if this turn also ends the run).
    deductConsumedItems(activeSave, turnResult.itemConsumedIds);
    const activePreFetch: PreFetchedSave = { uid: activeUid, save: activeSave };

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
      if (turnResult.itemConsumedIds.length > 0) {
        activeSave.updatedAt = now;
        tx.set(activeUserRef, activeSave);
      }
      tx.update(battleRef, {
        participantStats: nextParticipantStats,
        enemies: nextEnemies,
        currentTurnIndex: nextTurnIndex,
        turnDeadlineAt: now + TURN_TIMEOUT_MS,
        lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now, hits: turnResult.hits },
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
        lastWaveRewards = await grantWaveRewards(tx, db, aliveUids, battle.wave, battle.enemies, activePreFetch);
      }
      tx.update(battleRef, {
        participantStats: nextParticipantStats,
        enemies: nextEnemies,
        status,
        lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now, hits: turnResult.hits },
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
        name: nextParticipantStats[p].name,
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
      const bumpClanWave =
        battle.mode === 'endless' ? await prepareClanHighestWaveUpdate(tx, db, battle.clanId, battle.wave) : null;
      const bumpSoloWave =
        battle.mode === 'endless' ? await prepareSoloHighestWaveUpdate(tx, db, battle.clanId, battle.participants, battle.wave) : null;
      if (battle.mode === 'endless') {
        await restoreParticipantsAndClearLocks(tx, db, battle.participants, activePreFetch);
      }
      tx.update(battleRef, {
        participantStats: nextParticipantStats,
        enemies: nextEnemies,
        status: 'defeated',
        lastTurnResult: { round: battle.round, log: combinedLog, resolvedAt: now, hits: turnResult.hits, enemyHits: enemyPhase.enemyHits },
        updatedAt: now,
      });
      bumpClanWave?.();
      bumpSoloWave?.();
      return { resolved: true, status: 'defeated' as const };
    }

    if (turnResult.itemConsumedIds.length > 0) {
      activeSave.updatedAt = now;
      tx.set(activeUserRef, activeSave);
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
      lastTurnResult: { round: battle.round, log: combinedLog, resolvedAt: now, hits: turnResult.hits, enemyHits: enemyPhase.enemyHits },
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
  activeUserRef: DocumentReference,
  activeSave: PlayerSave,
  resolvedAction: CombatAction,
  now: number,
) {
  const opponentUid = battle.participants.find((p) => p !== activeUid)!;
  const opponentStats = battle.participantStats[opponentUid];

  const turnResult = resolvePvpTurn(
    {
      uid: activeUid,
      name: activeStats.name,
      action: resolvedAction,
      stats: { ...activeStats, stamina: 0, maxStamina: 0 },
      inventory: activeSave.inventory,
      ailments: activeStats.ailments,
    },
    { hp: opponentStats.hp, maxHp: opponentStats.maxHp, defense: opponentStats.defense },
  );
  // Applied in-memory now, written out at whichever exit branch below actually writes
  // activeUserRef - see submitPartyBattleAction's own matching comment.
  deductConsumedItems(activeSave, turnResult.itemConsumedIds);
  const activePreFetch: PreFetchedSave = { uid: activeUid, save: activeSave };

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
    // snapshot and the later tx.set would silently clobber the earlier one's changes. Passing
    // activePreFetch means the active player's already-item-deducted save is reused here instead
    // of being independently re-read (which would violate Firestore's "every read before any
    // write" transaction rule, since deductConsumedItems' write hasn't landed yet at this point -
    // it's only ever actually written inside this same call).
    const pvpRewards = await restoreAndRewardPvpParticipants(tx, db, winnerUid, loserUid, battle.partyAverageLevel, activePreFetch);
    for (const p of battle.participants) tx.delete(db.collection('partyBattleLocks').doc(p));
    tx.update(battleRef, {
      participantStats: nextParticipantStats,
      status: 'victory',
      winnerUid,
      pvpRewards,
      lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now, pvpHit: turnResult.hit },
      updatedAt: now,
    });
    return { resolved: true, status: 'victory' as const, winnerUid };
  }

  if (turnResult.itemConsumedIds.length > 0) {
    activeSave.updatedAt = now;
    tx.set(activeUserRef, activeSave);
  }

  const nextTurnIndex = (battle.currentTurnIndex + 1) % battle.turnOrder.length;
  tx.update(battleRef, {
    participantStats: nextParticipantStats,
    currentTurnIndex: nextTurnIndex,
    round: nextTurnIndex === 0 ? battle.round + 1 : battle.round,
    turnDeadlineAt: now + TURN_TIMEOUT_MS,
    lastTurnResult: { round: battle.round, log: turnResult.log, resolvedAt: now, pvpHit: turnResult.hit },
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
 *  within the same transaction. Returns what was actually granted (per uid) so callers can persist
 *  it onto the battle doc as `pvpRewards` - otherwise a real reward is applied silently to the
 *  save with nothing in the response for the client's victory screen to show. */
async function restoreAndRewardPvpParticipants(
  tx: Transaction,
  db: Firestore,
  winnerUid: string,
  loserUid: string,
  level: number,
  preFetched?: PreFetchedSave,
): Promise<Record<string, { xp: number; gold: number }>> {
  const winnerXp = PVP_WINNER_BASE_XP + level * PVP_WINNER_XP_PER_LEVEL;
  const winnerGold = PVP_WINNER_BASE_GOLD + level * PVP_WINNER_GOLD_PER_LEVEL;
  const loserXp = Math.round(winnerXp * PVP_LOSER_XP_FRACTION);

  const [winnerSave, loserSave] = await Promise.all([
    getSaveForUid(tx, db, winnerUid, preFetched),
    getSaveForUid(tx, db, loserUid, preFetched),
  ]);
  const now = Date.now();

  function restore(save: PlayerSave): void {
    save.player.stats.hp = save.player.stats.maxHp;
    save.player.stats.spirit = save.player.stats.maxSpirit;
    if (save.player.equipment.lantern) save.player.stats.lanternOil = save.player.stats.maxLanternOil;
  }

  if (winnerSave) {
    restore(winnerSave);
    winnerSave.player.xp += winnerXp;
    winnerSave.player.gold += winnerGold;
    applyLevelUp(winnerSave);
    winnerSave.updatedAt = now;
    tx.set(db.collection('users').doc(winnerUid), winnerSave);
  }
  if (loserSave) {
    restore(loserSave);
    loserSave.player.xp += loserXp;
    applyLevelUp(loserSave);
    loserSave.updatedAt = now;
    tx.set(db.collection('users').doc(loserUid), loserSave);
  }

  return {
    [winnerUid]: { xp: winnerXp, gold: winnerGold },
    [loserUid]: { xp: loserXp, gold: 0 },
  };
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
  preFetched?: PreFetchedSave,
): Promise<Record<string, PartyBattleWaveRewards>> {
  const saves = await Promise.all(aliveUids.map((uid) => getSaveForUid(tx, db, uid, preFetched)));
  const defeated = waveEnemies.map((e) => ({ enemyId: e.enemyId }));
  const chestTier = isMilestoneWave(wave) ? milestoneChestTier(wave) : null;

  const summary: Record<string, PartyBattleWaveRewards> = {};
  saves.forEach((save, i) => {
    const uid = aliveUids[i];
    if (!save) return;

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
    tx.set(db.collection('users').doc(uid), save);
    summary[uid] = { xp: totalXp, gold: totalGold, itemIds: grantedItemIds };
  });

  return summary;
}

/** Reads clans/{clanId} (if this battle has one) and, if `wave` is a new high for that clan,
 *  returns a closure that bumps highestEndlessWave when called - deliberately split into a
 *  read-now/write-later pair rather than writing directly, since Firestore transactions require
 *  every read to happen before any write, and this needs to be called from several different
 *  places an Endless Battle run can end (voluntary withdraw, party wipe), each already partway
 *  through building up its own batch of writes by the time this fires. Returns null (a no-op) for
 *  PvP, a clan-less battle, an already-deleted clan, or a wave that isn't actually a new record -
 *  `clans/{clanId}.highestEndlessWave` was otherwise dead: initialized to 0 by createClan and never
 *  written by any real gameplay. */
export async function prepareClanHighestWaveUpdate(
  tx: Transaction,
  db: Firestore,
  clanId: string | null,
  wave: number,
): Promise<(() => void) | null> {
  if (!clanId) return null;
  const clanRef = db.collection('clans').doc(clanId);
  const clanSnap = await tx.get(clanRef);
  if (!clanSnap.exists) return null;
  const clan = clanSnap.data() as ClanDoc;
  if (wave <= clan.highestEndlessWave) return null;
  return () => tx.update(clanRef, { highestEndlessWave: wave, updatedAt: Date.now() });
}

/** The solo-battle mirror of prepareClanHighestWaveUpdate above - same read-now/write-later
 *  split, same reasoning, just reading/writing userDirectory/{uid} instead of clans/{clanId}.
 *  Only ever applies to a clanless ("solo") Endless Battle run - returns null immediately if
 *  `clanId` is set, so calling both this and prepareClanHighestWaveUpdate unconditionally at the
 *  same call site is safe (exactly one of the two can ever actually do anything for a given
 *  battle). `participants` is always a single uid for a solo run (startEndlessBattle enforces
 *  this), but takes the whole array rather than a bare uid so callers don't need their own
 *  clanId-implies-solo-implies-participants[0] logic duplicated at each call site. */
export async function prepareSoloHighestWaveUpdate(
  tx: Transaction,
  db: Firestore,
  clanId: string | null,
  participants: string[],
  wave: number,
): Promise<(() => void) | null> {
  if (clanId) return null;
  const uid = participants[0];
  if (!uid) return null;
  const dirRef = db.collection('userDirectory').doc(uid);
  const dirSnap = await tx.get(dirRef);
  if (!dirSnap.exists) return null;
  const dir = dirSnap.data() as UserDirectoryDoc;
  if (wave <= (dir.highestEndlessWave ?? 0)) return null;
  return () => tx.update(dirRef, { highestEndlessWave: wave });
}

/** Restores every participant's real save to full HP/Spirit/Oil - "after the run ends... every
 *  player is automatically restored... before returning to town" (applies to both a defeated run
 *  and a voluntary exit, see voteContinueEndlessBattle). Downed participants are included, not
 *  just currently-alive ones - the whole party gets the same clean slate regardless of who was
 *  still standing when the run ended. */
export async function restoreParticipantsAndClearLocks(
  tx: Transaction,
  db: Firestore,
  uids: string[],
  preFetched?: PreFetchedSave,
): Promise<void> {
  const saves = await Promise.all(uids.map((uid) => getSaveForUid(tx, db, uid, preFetched)));
  saves.forEach((save, i) => {
    if (!save) return;
    save.player.stats.hp = save.player.stats.maxHp;
    save.player.stats.spirit = save.player.stats.maxSpirit;
    if (save.player.equipment.lantern) save.player.stats.lanternOil = save.player.stats.maxLanternOil;
    save.updatedAt = Date.now();
    tx.set(db.collection('users').doc(uids[i]), save);
  });
  // Frees each participant to start (or be invited into) another battle - matches
  // endlessBattle.ts's own restoreParticipantsAndClearLocks on a voluntary exit.
  for (const uid of uids) tx.delete(db.collection('partyBattleLocks').doc(uid));
}
