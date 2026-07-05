import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveRound, computeRewards } from '../engine/combatEngine';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import { grantItem } from '../engine/inventoryEngine';
import { applyLevelUp } from '../engine/levelingEngine';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { EQUIPMENT } from '../data/equipment';
import { LANTERN_ABILITIES } from '../data/lanternAbilities';
import type { CombatAction, CombatSession, PlayerSave } from '../shared-types';

interface ResolveCombatActionRequest {
  sessionId: string;
  action: CombatAction;
}

export const resolveCombatAction = onCall<ResolveCombatActionRequest>(async (request) => {
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

    if (action.type === 'item') {
      const itemId = action.itemId;
      const invEntry = itemId ? save.inventory.find((i) => i.itemId === itemId) : undefined;
      const def = itemId ? ITEMS[itemId] : undefined;
      if (!itemId || !invEntry || invEntry.quantity < 1 || !def?.usableInCombat) {
        throw new HttpsError('failed-precondition', 'You cannot use that item right now.');
      }
      const effect = def.effect;
      const wouldHaveEffect =
        !!effect &&
        ((!!effect.healHp && save.player.stats.hp < save.player.stats.maxHp) ||
          (!!effect.healSpirit && save.player.stats.spirit < save.player.stats.maxSpirit) ||
          (!!effect.restoreOil && save.player.stats.lanternOil < save.player.stats.maxLanternOil));
      if (!wouldHaveEffect) {
        throw new HttpsError('failed-precondition', 'That would have no effect right now.');
      }
    }
    if (action.type === 'skill') {
      const skill = SKILLS[action.skillId ?? 'keepers-strike'];
      if (!skill) throw new HttpsError('invalid-argument', 'Unknown Specialty Attack.');
      if (save.player.stats.spirit < skill.spiritCost) {
        throw new HttpsError('failed-precondition', 'Not enough Spirit for that.');
      }
    }
    if (action.type === 'lanternAbility') {
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
    }

    const result = resolveRound({
      action,
      playerStats: save.player.stats,
      inventory: save.inventory,
      enemies: session.enemies.map((e) => ({ enemyId: e.enemyId, level: e.level, hp: e.hp })),
    });

    save.player.stats.hp = result.playerHp;
    save.player.stats.spirit = result.playerSpirit;
    save.player.stats.lanternOil = result.playerLanternOil;

    if (result.itemConsumedId) {
      const entry = save.inventory.find((i) => i.itemId === result.itemConsumedId);
      if (entry) {
        entry.quantity -= 1;
        save.inventory = save.inventory.filter((i) => i.quantity > 0);
      }
    }

    let rewards: { xp: number; gold: number; itemIds: string[]; leveledUp: boolean } | null = null;

    if (result.phase === 'victory') {
      const defeated = session.enemies.map((e) => ({ enemyId: e.enemyId, level: e.level }));
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
        if (grantItem(save.inventory, itemId)) grantedItemIds.push(itemId);
      }

      // Group defeated enemies by id so a quest like "defeat 3 mothlings" advances by the actual
      // count killed in this one fight, not just +1, and each unique species is only journaled once.
      const countByEnemyId = new Map<string, number>();
      for (const id of enemyIds) countByEnemyId.set(id, (countByEnemyId.get(id) ?? 0) + 1);

      const questEvents: { type: 'defeatEnemies' | 'defeatBoss'; targetId: string; amount?: number }[] = [];
      for (const [enemyId, count] of countByEnemyId) {
        const enemy = ENEMIES[enemyId];
        if (!save.journal.creaturesDiscovered.includes(enemyId)) {
          save.journal.creaturesDiscovered.push(enemyId);
        }
        if (enemy.isBoss && !save.journal.bossesDefeated.includes(enemyId)) {
          save.journal.bossesDefeated.push(enemyId);
        }
        questEvents.push({ type: 'defeatEnemies', targetId: enemyId, amount: count });
        if (enemy.isBoss) questEvents.push({ type: 'defeatBoss', targetId: enemyId });
      }
      const completions = questEvents.flatMap((event) => advanceQuests(save.quests, event));
      applyQuestRewards(save, completions);

      rewards = { xp: reward.xp, gold: reward.gold, itemIds: grantedItemIds, leveledUp: save.player.level > levelBefore };
    } else if (result.phase === 'defeat') {
      // Soft respawn at the inn - no punishing penalty, per design decision in the plan.
      save.player.stats.hp = Math.round(save.player.stats.maxHp * 0.5);
      save.player.stats.spirit = Math.round(save.player.stats.maxSpirit * 0.5);
      save.player.currentLocationId = 'ash-hallow';
    }

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    const updatedEnemies = session.enemies.map((e, i) => ({ ...e, hp: result.enemyHp[i] }));
    if (result.phase === 'continue') {
      tx.update(sessionRef, { enemies: updatedEnemies, round: session.round + 1 });
    } else {
      tx.update(sessionRef, { enemies: updatedEnemies, status: 'resolved' });
    }

    return {
      log: result.log,
      phase: result.phase,
      playerHp: save.player.stats.hp,
      playerMaxHp: save.player.stats.maxHp,
      playerSpirit: save.player.stats.spirit,
      playerMaxSpirit: save.player.stats.maxSpirit,
      playerLanternOil: save.player.stats.lanternOil,
      playerMaxLanternOil: save.player.stats.maxLanternOil,
      enemies: updatedEnemies.map((e, index) => ({ index, hp: e.hp, maxHp: e.maxHp })),
      rewards,
      playerLevel: save.player.level,
      playerGold: save.player.gold,
      currentLocationId: save.player.currentLocationId,
    };
  });
});
