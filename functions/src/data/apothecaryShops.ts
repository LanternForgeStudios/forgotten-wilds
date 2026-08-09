/** Every Apothecary/Herbalist shop that offers the dynamically-generated "restock" side quest
 *  (see engine/apothecaryQuestEngine.ts) - only 2 exist in the game today (Ash Hallow, Mirehaven);
 *  Endless Prairie/Whispering Pines/Shattered Desert/Frozen Frontier have no Apothecary/Herbalist
 *  NPC at all yet, so this table simply has no entry for them rather than a placeholder one - a
 *  future region's own Apothecary NPC just needs a new entry here, no other code changes.
 *  `materialIds` is deliberately restricted to that shop's COMMON-tier materials only (see
 *  data/items.ts - a couple of regions also have one Uncommon-tier material) - this is a low-
 *  stakes, repeatable grind, not something that should ever demand a scarcer material. */
export const APOTHECARY_SHOPS: Record<string, { locationId: string; materialIds: string[] }> = {
  apothecary: {
    locationId: 'ash-hallow-apothecary',
    materialIds: ['moth-dust', 'rusted-token', 'wolf-fang', 'silver-droplet', 'withered-bramble'],
  },
  'noelle-herbalist': {
    locationId: 'mirehaven-herbalist',
    materialIds: ['croc-hide', 'bog-ash'],
  },
};
