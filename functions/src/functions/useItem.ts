import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { ITEMS } from '../data/items';
import type { CombatSession, PlayerSave } from '../shared-types';

interface UseItemRequest {
  itemId: string;
}

/** Consuming a healing/spirit/ailment-cure item outside a combat *round* - reuses the same effect
 *  data combat's 'item' action applies, just without spending a turn. This is the CombatScene item
 *  menu's "Done" button path (use items for free, then still pick your real action) - distinct
 *  from queuing items to ride along with an actual attack/skill/defend/flee via
 *  resolveCombatAction. An ailment cure needs combatSessions/{uid} (playerAilments lives there,
 *  never on users/{uid}), so this reads it too when present - harmless no-op outside combat, where
 *  no combat session document exists at all and a cureAilmentId item simply can't apply here. */
export const useItem = onCall<UseItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const itemId = request.data?.itemId;
  const def = itemId ? ITEMS[itemId] : undefined;
  const effect = def?.effect;
  if (!effect) {
    throw new HttpsError('invalid-argument', 'That item cannot be used this way.');
  }

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);
  const sessionRef = db.collection('combatSessions').doc(uid);

  return db.runTransaction(async (tx) => {
    const [snap, sessionSnap] = await Promise.all([tx.get(userRef), tx.get(sessionRef)]);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;
    const session = sessionSnap.exists ? (sessionSnap.data() as CombatSession) : undefined;
    const playerAilments = session?.playerAilments ?? [];

    const entry = save.inventory.find((i) => i.itemId === itemId);
    if (!entry || entry.quantity < 1) {
      throw new HttpsError('failed-precondition', 'You do not have that item.');
    }

    const wouldHaveEffect =
      (!!effect.healHpPercent && save.player.stats.hp < save.player.stats.maxHp) ||
      (!!effect.healSpiritPercent && save.player.stats.spirit < save.player.stats.maxSpirit) ||
      (!!effect.restoreOilPercent && save.player.stats.lanternOil < save.player.stats.maxLanternOil) ||
      (!!effect.cureAilmentId && playerAilments.some((a) => a.ailmentId === effect.cureAilmentId));
    if (!wouldHaveEffect) {
      throw new HttpsError('failed-precondition', 'That would have no effect right now.');
    }

    if (effect.healHpPercent) {
      const amount = Math.round(save.player.stats.maxHp * effect.healHpPercent);
      save.player.stats.hp = Math.min(save.player.stats.maxHp, save.player.stats.hp + amount);
    }
    if (effect.healSpiritPercent) {
      const amount = Math.round(save.player.stats.maxSpirit * effect.healSpiritPercent);
      save.player.stats.spirit = Math.min(save.player.stats.maxSpirit, save.player.stats.spirit + amount);
    }
    if (effect.restoreOilPercent) {
      const amount = Math.round(save.player.stats.maxLanternOil * effect.restoreOilPercent);
      save.player.stats.lanternOil = Math.min(save.player.stats.maxLanternOil, save.player.stats.lanternOil + amount);
    }
    let updatedAilments = playerAilments;
    if (effect.cureAilmentId && session) {
      updatedAilments = playerAilments.filter((a) => a.ailmentId !== effect.cureAilmentId);
    }

    entry.quantity -= 1;
    save.inventory = save.inventory.filter((i) => i.quantity > 0);

    save.updatedAt = Date.now();
    tx.set(userRef, save);
    if (session && updatedAilments !== playerAilments) {
      tx.update(sessionRef, { playerAilments: updatedAilments });
    }

    return { stats: save.player.stats, inventory: save.inventory, playerAilments: updatedAilments };
  });
});
