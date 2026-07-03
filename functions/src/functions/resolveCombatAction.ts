import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveRound, computeRewards } from '../engine/combatEngine';
import { advanceQuests, applyQuestRewards } from '../engine/questEngine';
import { ENEMIES } from '../data/enemies';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
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

    const enemy = ENEMIES[session.enemyId];
    if (!enemy) {
      throw new HttpsError('internal', 'Unknown enemy in this session.');
    }

    if (action.type === 'item') {
      const itemId = action.itemId;
      const invEntry = itemId ? save.inventory.find((i) => i.itemId === itemId) : undefined;
      const def = itemId ? ITEMS[itemId] : undefined;
      if (!itemId || !invEntry || invEntry.quantity < 1 || !def?.usableInCombat) {
        throw new HttpsError('failed-precondition', 'You cannot use that item right now.');
      }
    }
    if (action.type === 'spiritArt') {
      const cost = SKILLS['lantern-flame'].spiritCost;
      if (save.player.stats.spirit < cost) {
        throw new HttpsError('failed-precondition', 'Not enough Spirit for that.');
      }
    }

    const result = resolveRound({
      action,
      playerStats: save.player.stats,
      inventory: save.inventory,
      enemy,
      enemyHp: session.enemyHp,
      enemyName: enemy.name,
    });

    save.player.stats.hp = result.playerHp;
    save.player.stats.spirit = result.playerSpirit;

    if (result.itemConsumedId) {
      const entry = save.inventory.find((i) => i.itemId === result.itemConsumedId);
      if (entry) {
        entry.quantity -= 1;
        save.inventory = save.inventory.filter((i) => i.quantity > 0);
      }
    }

    let rewards: { xp: number; gold: number; itemIds: string[]; leveledUp: boolean } | null = null;

    if (result.phase === 'victory') {
      const reward = computeRewards(enemy, save.player.xp, save.player.level);
      save.player.xp += reward.xp;
      save.player.gold += reward.gold;
      if (reward.leveledUp) {
        save.player.level = reward.newLevel;
        save.player.stats.maxHp += reward.statGrowth.maxHp ?? 0;
        save.player.stats.maxSpirit += reward.statGrowth.maxSpirit ?? 0;
        save.player.stats.attack += reward.statGrowth.attack ?? 0;
        save.player.stats.defense += reward.statGrowth.defense ?? 0;
        save.player.stats.speed += reward.statGrowth.speed ?? 0;
        save.player.stats.hp = save.player.stats.maxHp;
        save.player.stats.spirit = save.player.stats.maxSpirit;
      }
      for (const itemId of reward.lootItemIds) {
        const entry = save.inventory.find((i) => i.itemId === itemId);
        if (entry) entry.quantity += 1;
        else save.inventory.push({ itemId, quantity: 1 });
      }
      if (!save.journal.creaturesDiscovered.includes(enemy.id)) {
        save.journal.creaturesDiscovered.push(enemy.id);
      }
      if (enemy.isBoss && !save.journal.bossesDefeated.includes(enemy.id)) {
        save.journal.bossesDefeated.push(enemy.id);
      }

      const questEvents: { type: 'defeatEnemies' | 'defeatBoss'; targetId: string }[] = [
        { type: 'defeatEnemies', targetId: enemy.id },
      ];
      if (enemy.isBoss) questEvents.push({ type: 'defeatBoss', targetId: enemy.id });
      const completions = questEvents.flatMap((event) => advanceQuests(save.quests, event));
      applyQuestRewards(save, completions);

      rewards = { xp: reward.xp, gold: reward.gold, itemIds: reward.lootItemIds, leveledUp: reward.leveledUp };
    } else if (result.phase === 'defeat') {
      // Soft respawn at the inn - no punishing penalty, per design decision in the plan.
      save.player.stats.hp = Math.round(save.player.stats.maxHp * 0.5);
      save.player.stats.spirit = Math.round(save.player.stats.maxSpirit * 0.5);
      save.player.currentLocationId = 'ash-hallow';
    }

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    if (result.phase === 'continue') {
      tx.update(sessionRef, { enemyHp: result.enemyHp, round: session.round + 1 });
    } else {
      tx.update(sessionRef, { enemyHp: result.enemyHp, status: 'resolved' });
    }

    return {
      log: result.log,
      phase: result.phase,
      playerHp: save.player.stats.hp,
      playerMaxHp: save.player.stats.maxHp,
      playerSpirit: save.player.stats.spirit,
      playerMaxSpirit: save.player.stats.maxSpirit,
      enemyHp: result.enemyHp,
      enemyMaxHp: session.enemyMaxHp,
      rewards,
      playerLevel: save.player.level,
      playerGold: save.player.gold,
      currentLocationId: save.player.currentLocationId,
    };
  });
});
