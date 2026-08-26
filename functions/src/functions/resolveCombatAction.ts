import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import {
  resolveRound,
  computeRewards,
  aggregateItemCounts,
  hasSufficientQuantity,
  rollVictoryRestore,
  type VictoryRestore,
} from '../engine/combatEngine';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import { grantItem, itemWouldHaveEffect, removeItem } from '../engine/inventoryEngine';
import { applyLevelUp } from '../engine/levelingEngine';
import { backfillPlayerEquipment, computeAilmentResistances, resolveWeaponAttackAilment } from '../engine/equipmentEngine';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { EQUIPMENT } from '../data/equipment';
import { LANTERN_ABILITIES } from '../data/lanternAbilities';
import { LANTERN_OIL_UPGRADE_GATES } from '../data/lanternOilUpgrades';
import { AILMENTS } from '../data/ailments';
import { homeTownFor } from '../data/locationHomeTown';
import type { CombatAction, CombatSession, PlayerSave } from '../shared-types';

interface ResolveCombatActionRequest {
  sessionId: string;
  action: CombatAction;
}

export const resolveCombatAction = onCall<ResolveCombatActionRequest>({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to fight.');
  }

  const sessionId = request.data?.sessionId;
  const action = request.data?.action;
  if (!sessionId || !action?.type) {
    throw new HttpsError('invalid-argument', 'sessionId and action are required.');
  }

  const db = getFirestore();
  const sessionRef = db.collection('combatSessions').doc(uid);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const [sessionSnap, userSnap] = await Promise.all([tx.get(sessionRef), tx.get(userRef)]);

    if (!sessionSnap.exists) {
      throw new HttpsError('failed-precondition', 'No active combat session.');
    }
    const session = sessionSnap.data() as CombatSession;
    if (session.sessionId !== sessionId || session.status !== 'active') {
      throw new HttpsError('failed-precondition', 'That combat session is no longer active.');
    }
    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'No character found for this account.');
    }
    const save = userSnap.data() as PlayerSave;

    if (session.enemies.some((e) => !ENEMIES[e.enemyId])) {
      throw new HttpsError('internal', 'Unknown enemy in this session.');
    }

    // Backfill for sessions created before playerAilments existed - see startEncounter.ts's
    // matching comment.
    const playerAilments = session.playerAilments ?? [];
    // Backfill for a save written before knownSkillIds existed - see journal.itemsDiscovered's
    // matching pattern in inventoryEngine.ts. Persisted below via the unconditional tx.set(userRef,
    // save), so this only ever needs to run once per player.
    if (!save.player.knownSkillIds) save.player.knownSkillIds = ['keepers-strike'];
    // Backfill for a save written before the equipment system existed, and migrate a save that
    // predates the 'armor'->'chest' rename/'legs' slot (see backfillPlayerEquipment's own doc).
    // Every action type now reads save.player.equipment unconditionally below
    // (computeAilmentResistances/resolveWeaponAttackAilment), where before this stub feature only
    // 'lanternAbility' ever touched it - an account missing this field entirely crashed with a
    // bare INTERNAL error on every action, not just lanternAbility.
    backfillPlayerEquipment(save);

    // Data-driven rather than hardcoding "if silence"/"if freeze" - any current or future ailment
    // whose effect sets blocksSkill/disablesLanternAbility gates the matching action, keyed off
    // AILMENTS (see data/ailments.ts) rather than a specific ailment id.
    if (action.type === 'skill') {
      const blocker = playerAilments.find((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
      if (blocker) {
        throw new HttpsError('failed-precondition', `You are ${AILMENTS[blocker.ailmentId].name} and cannot use Specialty Attacks.`);
      }
    }
    if (action.type === 'lanternAbility') {
      const blocker = playerAilments.find((a) => AILMENTS[a.ailmentId]?.effect.disablesLanternAbility);
      if (blocker) {
        throw new HttpsError('failed-precondition', `You are ${AILMENTS[blocker.ailmentId].name} and cannot use the Lantern specialty.`);
      }
    }

    const itemIds = action.itemIds ?? [];
    if (itemIds.length > 3) {
      throw new HttpsError('invalid-argument', 'You can use at most 3 items per turn.');
    }
    if (action.type === 'item' && itemIds.length === 0) {
      throw new HttpsError('failed-precondition', 'You cannot use that item right now.');
    }
    for (const [itemId] of aggregateItemCounts(itemIds)) {
      const def = ITEMS[itemId];
      if (!def?.usableInCombat) {
        throw new HttpsError('failed-precondition', 'You cannot use that item right now.');
      }
      const effect = def.effect;
      if (!effect || !itemWouldHaveEffect(effect, save.player.stats, playerAilments)) {
        throw new HttpsError('failed-precondition', 'That would have no effect right now.');
      }
    }
    if (itemIds.length > 0 && !hasSufficientQuantity(itemIds, save.inventory)) {
      throw new HttpsError('failed-precondition', 'You do not have enough of that item.');
    }
    if (action.type === 'skill') {
      const skillId = action.skillId ?? 'keepers-strike';
      const skill = SKILLS[skillId];
      if (!skill) throw new HttpsError('invalid-argument', 'Unknown Specialty Attack.');
      // SKILLS also holds every enemy's own signature move in the same flat dictionary (see
      // data/skills.ts) - without this check, a crafted client call could request any of those by
      // id. Real ownership, not just "does this id exist somewhere."
      if (!save.player.knownSkillIds.includes(skillId)) {
        throw new HttpsError('failed-precondition', 'You have not learned that Specialty Attack.');
      }
      if (save.player.stats.spirit < skill.spiritCost) {
        throw new HttpsError('failed-precondition', 'Not enough Spirit for that.');
      }
    }
    let usedAbility: (typeof LANTERN_ABILITIES)[string] | undefined;
    if (action.type === 'lanternAbility') {
      // Non-offensive Lantern Abilities don't end the turn (see resolveRound's early-return
      // branch), but the "one Lantern Ability per round" cap still applies - without this check a
      // player could chain unlimited heals/wards in a single round since the round never advances.
      if (session.lanternUsedThisRound) {
        throw new HttpsError('failed-precondition', 'You have already used your Lantern this round.');
      }
      const lanternId = save.player.equipment.lantern;
      const lanternDef = lanternId ? EQUIPMENT[lanternId] : undefined;
      const abilityId = action.abilityId;
      const ability = abilityId ? LANTERN_ABILITIES[abilityId] : undefined;
      if (!ability || !lanternDef?.lanternAbilityIds?.includes(abilityId!)) {
        throw new HttpsError('failed-precondition', 'Your equipped lantern cannot do that.');
      }
      if (save.player.stats.lanternOil < ability.oilCost) {
        throw new HttpsError('failed-precondition', 'Not enough Lantern Oil for that.');
      }
      usedAbility = ability;
    }

    const result = resolveRound({
      action,
      playerStats: save.player.stats,
      inventory: save.inventory,
      enemies: session.enemies.map((e) => ({ enemyId: e.enemyId, level: e.level, hp: e.hp, ailments: e.ailments ?? [] })),
      playerAilments,
      attackAilment: resolveWeaponAttackAilment(save.player.equipment.weapon),
      ailmentResistances: computeAilmentResistances(save.player.equipment),
      carriedPlayerDefending: !!session.defendingBonusPending,
      lanternOilTier: save.player.equipment.lantern
        ? (save.player.lanternOilUpgrades?.[save.player.equipment.lantern] ?? 0)
        : 0,
      // Self-heals any save that predates this field, same "?? fallback at the one read site"
      // idiom as lanternOilUpgrades/knownSkillIds above - solo combat only, see the Difficulty
      // type's own doc comment for why party/PvP never read this.
      difficulty: save.player.difficulty ?? 'medium',
    });

    save.player.stats.hp = result.playerHp;
    save.player.stats.spirit = result.playerSpirit;
    save.player.stats.lanternOil = result.playerLanternOil;

    for (const [itemId, count] of aggregateItemCounts(result.itemConsumedIds)) {
      removeItem(save, itemId, count);
    }

    let rewards: {
      xp: number;
      gold: number;
      /** Spirit Essence from a quest (e.g. "defeat 3 mothlings") that completed as a side effect
       *  of this victory - same "pays out in the same victory screen" reasoning as xp/gold below,
       *  just for the currency that drives Spirit Rank instead. 0 when no such quest completed. */
      spiritEssence: number;
      itemIds: string[];
      grantedSkillIds: string[];
      /** Lore entry ids unlocked by a quest (e.g. "defeat 3 mothlings") that completed as a side
       *  effect of this victory. [] when nothing was unlocked. */
      grantedLoreIds: string[];
      leveledUp: boolean;
      restore: VictoryRestore | null;
      /** Region names whose Lantern Oil upgrade just unlocked (a boss gating one was defeated for
       *  the first time this fight) - [] on every other victory. See data/lanternOilUpgrades.ts. */
      lanternOilUpgradeRegions: string[];
    } | null =
      null;

    if (result.phase === 'victory') {
      // A boss already in save.journal.bossesDefeated (before the journal-update loop below
      // mutates it) is being refought - its own lootTable roll is skipped so a repeat kill pays
      // out like a regular fight (xp/gold still awarded normally, see computeRewards).
      const defeated = session.enemies.map((e) => ({
        enemyId: e.enemyId,
        skipLoot: !!ENEMIES[e.enemyId]?.isBoss && save.journal.bossesDefeated.includes(e.enemyId),
      }));
      const enemyIds = defeated.map((e) => e.enemyId);
      const levelBefore = save.player.level;
      const reward = computeRewards(defeated, save.player.xp, save.player.level);
      save.player.xp += reward.xp;
      save.player.gold += reward.gold;
      applyLevelUp(save);
      const grantedItemIds: string[] = [];
      for (const itemId of reward.lootItemIds) {
        // A unique drop (e.g. a boss trophy) never grants a second copy, even if the same boss
        // is challenged and defeated again later - skip it from the reported loot too, so the
        // victory screen doesn't claim an item was found when nothing was actually added.
        if (grantItem(save, itemId)) grantedItemIds.push(itemId);
      }

      // Group defeated enemies by id so a quest like "defeat 3 mothlings" advances by the actual
      // count killed in this one fight, not just +1, and each unique species is only journaled once.
      const countByEnemyId = new Map<string, number>();
      for (const id of enemyIds) countByEnemyId.set(id, (countByEnemyId.get(id) ?? 0) + 1);

      const questEvents: { type: 'defeatEnemies' | 'defeatBoss'; targetId: string; amount?: number }[] = [];
      // Region names to notify the player about (via rewards.lanternOilUpgradeRegions below) -
      // populated only for a boss defeated for the VERY FIRST time this fight, and only when that
      // boss actually gates a Lantern Oil upgrade (see data/lanternOilUpgrades.ts). Iron Mountains'
      // two lanterns share one boss/region, so this is deduped by region name, not by lanternId.
      const newlyUnlockedLanternRegions = new Set<string>();
      for (const [enemyId, count] of countByEnemyId) {
        const enemy = ENEMIES[enemyId];
        if (!save.journal.creaturesDiscovered.includes(enemyId)) {
          save.journal.creaturesDiscovered.push(enemyId);
        }
        if (enemy.isBoss && !save.journal.bossesDefeated.includes(enemyId)) {
          save.journal.bossesDefeated.push(enemyId);
          for (const gate of Object.values(LANTERN_OIL_UPGRADE_GATES)) {
            if (gate.bossId === enemyId) newlyUnlockedLanternRegions.add(gate.regionName);
          }
        }
        questEvents.push({ type: 'defeatEnemies', targetId: enemyId, amount: count });
        if (enemy.isBoss) questEvents.push({ type: 'defeatBoss', targetId: enemyId });
      }
      const completions = questEvents.flatMap((event) => advanceQuests(save.quests, event));
      const questRewards = applyQuestRewards(save, completions);

      // Rolled after applyLevelUp so a fresh level's higher maxHp/maxSpirit is what a restore (if
      // any) is a percentage of, and after the level-up's own stat growth is already applied.
      const restore = rollVictoryRestore(save.player.stats);
      if (restore) {
        const max = { hp: save.player.stats.maxHp, spirit: save.player.stats.maxSpirit, lanternOil: save.player.stats.maxLanternOil }[
          restore.stat
        ];
        save.player.stats[restore.stat] = Math.min(max, save.player.stats[restore.stat] + restore.amount);
        const label = { hp: 'HP', spirit: 'Spirit', lanternOil: 'Lantern Oil' }[restore.stat];
        result.log.push(`A quiet moment lets you recover ${restore.amount} ${label}.`);
      }

      rewards = {
        // A quest completed by this very fight (e.g. "defeat 3 mothlings") pays out in the same
        // victory screen rather than a second, separately-timed popup - see questRewards above.
        xp: reward.xp + questRewards.xp,
        gold: reward.gold + questRewards.gold,
        spiritEssence: questRewards.spiritEssence,
        itemIds: [...grantedItemIds, ...questRewards.itemIds],
        grantedSkillIds: questRewards.grantedSkillIds,
        grantedLoreIds: questRewards.grantedLoreIds,
        leveledUp: save.player.level > levelBefore,
        restore,
        lanternOilUpgradeRegions: [...newlyUnlockedLanternRegions],
      };
    } else if (result.phase === 'defeat') {
      // Soft respawn at the inn - no punishing penalty, per design decision in the plan. Sent back
      // to the town nearest wherever the fight actually happened (homeTownFor), not always Ash
      // Hallow - a Crimson Bayou defeat should land the player in Mirehaven.
      save.player.stats.hp = Math.round(save.player.stats.maxHp * 0.5);
      save.player.stats.spirit = Math.round(save.player.stats.maxSpirit * 0.5);
      save.player.currentLocationId = homeTownFor(save.player.currentLocationId);
    }

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    const updatedEnemies = session.enemies.map((e, i) => ({ ...e, hp: result.enemyHp[i], ailments: result.enemyAilments[i] }));
    if (result.phase === 'continue' && !result.turnConsumed) {
      // The non-turn-ending sub-action path (see resolveRound's own doc) - the round does NOT
      // advance, enemies never acted, and the "one Lantern Ability per round" cap latches on so a
      // second lanternAbility call this same round is rejected above. defendingBonusPending carries
      // the Defend-style damage halving forward to whatever action actually ends the round.
      tx.update(sessionRef, {
        enemies: updatedEnemies,
        playerAilments: result.playerAilments,
        lanternUsedThisRound: true,
        defendingBonusPending: usedAbility?.category === 'defensive',
      });
    } else if (result.phase === 'continue') {
      tx.update(sessionRef, {
        enemies: updatedEnemies,
        round: session.round + 1,
        playerAilments: result.playerAilments,
        lanternUsedThisRound: false,
        defendingBonusPending: false,
      });
    } else {
      // All active ailments are dropped once combat ends (see ActiveAilment's doc comment) -
      // nothing carries over to exploration, regardless of what result.playerAilments says.
      tx.update(sessionRef, { enemies: updatedEnemies, status: 'resolved', playerAilments: [] });
    }

    return {
      log: result.log,
      phase: result.phase,
      // False only for the non-turn-ending Lantern Ability sub-action - tells the client to keep
      // showing the action menu (Attack/Skill/Items/Defend/Flee, minus Lantern Ability) instead of
      // playing out an enemy-turn animation, since no enemy actually acted this call.
      turnConsumed: result.turnConsumed,
      playerHp: save.player.stats.hp,
      playerMaxHp: save.player.stats.maxHp,
      playerSpirit: save.player.stats.spirit,
      playerMaxSpirit: save.player.stats.maxSpirit,
      playerLanternOil: save.player.stats.lanternOil,
      playerMaxLanternOil: save.player.stats.maxLanternOil,
      enemies: updatedEnemies.map((e, index) => ({ index, hp: e.hp, maxHp: e.maxHp, ailments: e.ailments })),
      damageTakenByPlayer: result.damageTakenByPlayer,
      hits: result.hits,
      enemyHits: result.enemyHits,
      rewards,
      playerLevel: save.player.level,
      playerGold: save.player.gold,
      currentLocationId: save.player.currentLocationId,
      // Empty on any terminal phase (victory/defeat/fled) - see the tx.update branch above.
      playerAilments: result.phase === 'continue' ? result.playerAilments : [],
    };
  });
});
