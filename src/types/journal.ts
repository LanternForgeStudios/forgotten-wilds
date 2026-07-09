export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  unlockedAt: number;
}

export interface JournalState {
  creaturesDiscovered: string[];
  locationsVisited: string[];
  loreUnlocked: string[];
  bossesDefeated: string[];
  /** Every item id ever granted to the player (shop, chest, combat loot, quest reward, trade) -
   *  monotonic, like the other Journal lists: once acquired, an item stays in this compendium
   *  even after being consumed/sold/traded away. Distinct from the live inventory (useInventoryStore),
   *  which only reflects current holdings. */
  itemsDiscovered: string[];
}
