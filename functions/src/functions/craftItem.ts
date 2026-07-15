import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { RECIPES } from '../data/recipes';
import { grantItem } from '../engine/inventoryEngine';
import type { PlayerSave } from '../shared-types';

interface CraftItemRequest {
  recipeId: string;
}

/** Consumes a recipe's required materials and grants its output item, in one transaction - the
 *  recipeId is always the same as the output item's own id (see data/recipes.ts), one recipe per
 *  craftable item. Mirrors sellItem.ts's shape (validate ownership/quantity, mutate
 *  save.inventory, single tx.set), reusing grantItem (inventoryEngine.ts) for the output the same
 *  way every other item-granting path already does. */
export const craftItem = onCall<CraftItemRequest>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'You must be signed in.');

  const recipeId = request.data?.recipeId;
  const recipe = recipeId ? RECIPES[recipeId] : undefined;
  if (!recipe) throw new HttpsError('invalid-argument', 'Unknown recipe.');

  const db = getFirestore();
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw new HttpsError('failed-precondition', 'No character found.');
    const save = snap.data() as PlayerSave;

    // One find per material, not two: each material's inventory entry is looked up once here and
    // the same reference reused below, rather than re-finding it in a second loop.
    const materialEntries = recipe.materials.map((material) => ({
      material,
      entry: save.inventory.find((i) => i.itemId === material.itemId),
    }));
    for (const { material, entry } of materialEntries) {
      if ((entry?.quantity ?? 0) < material.quantity) {
        throw new HttpsError('failed-precondition', 'You do not have the materials for that recipe.');
      }
    }

    for (const { material, entry } of materialEntries) {
      entry!.quantity -= material.quantity;
    }
    save.inventory = save.inventory.filter((i) => i.quantity > 0);

    grantItem(save, recipe.outputItemId);

    save.updatedAt = Date.now();
    tx.set(userRef, save);

    return { inventory: save.inventory };
  });
});
