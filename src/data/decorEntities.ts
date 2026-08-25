/** Shared refId -> sprite resolution for purely decorative, non-gated map interactables (no Cloud
 *  Function call - just a flavor message, or nothing at all in Overworld/Dungeon's case where the
 *  caller supplies its own generic "you find X" fallback). Previously duplicated three ways -
 *  TownScene.tsx had its own `DECOR_ENTITIES` object, OverworldScene.tsx/DungeonScene.tsx each had
 *  their own separate inline `refId.startsWith('glowing-mushroom')` check - centralized here so a
 *  new decor prop (see the 2026-08 Pixel Crawler tileset migration, docs/Map-Object-Catalog.md)
 *  only needs one entry, not three hand-edits across scenes.
 *
 *  Animated via each sprite's own `frameSize` idle loop (same generic mechanism as
 *  structure.chest/structure.shrine-activated) or, for static props, no animation at all - either
 *  way no new rendering code is needed here, `ExplorationScene.ts`'s `upsertEntity` already handles
 *  both cases uniformly. */
export interface DecorEntity {
  label: string;
  spriteAssetId: string;
  /** Shown by TownScene's flavor-text-only interact path. Overworld/Dungeon supply their own
   *  generic "you find X" message keyed off `label` instead, so this is unused there. */
  flavorText: string;
}

/** Exact refId match - a single specific placeable prop. */
export const DECOR_ENTITIES: Record<string, DecorEntity> = {
  fireplace: {
    label: 'Fireplace',
    spriteAssetId: 'structure.decor-fireplace',
    flavorText: 'The fire crackles warmly, filling the room with a gentle heat.',
  },
  // --- 2026-08 Pixel Crawler migration (Anokolisa, "General" pack) - animated station props ---
  'general-bonfire-01': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-01', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-02': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-02', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-03': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-03', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-04': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-04', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-05': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-05', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-06': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-06', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-07': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-07', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-08': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-08', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-09': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-09', flavorText: 'A small fire pit, embers glowing.' },
  'general-bonfire-10': { label: 'Fire Pit', spriteAssetId: 'structure.general-bonfire-10', flavorText: 'A small fire pit, embers glowing.' },
  'general-fire-01': { label: 'Campfire', spriteAssetId: 'structure.general-fire-01', flavorText: 'A campfire crackles, flames dancing.' },
  'general-fire-02': { label: 'Campfire', spriteAssetId: 'structure.general-fire-02', flavorText: 'A campfire crackles, flames dancing.' },
  'general-smoke': { label: 'Smoke', spriteAssetId: 'structure.general-smoke', flavorText: 'A wisp of smoke curls upward.' },
  'general-grill-01': { label: 'Grill', spriteAssetId: 'structure.general-grill-01', flavorText: 'A grill, something sizzling over the coals.' },
  'general-grill-02': { label: 'Grill', spriteAssetId: 'structure.general-grill-02', flavorText: 'A grill, something sizzling over the coals.' },
  'general-grill-03': { label: 'Grill', spriteAssetId: 'structure.general-grill-03', flavorText: 'A grill, something sizzling over the coals.' },
  'general-grill-04': { label: 'Grill', spriteAssetId: 'structure.general-grill-04', flavorText: 'A grill, something sizzling over the coals.' },
  'general-cooker-03': { label: 'Cooking Cart', spriteAssetId: 'structure.general-cooker-03', flavorText: 'A small cooking cart, well-used.' },
  'general-cooker-04': { label: 'Cooking Cart', spriteAssetId: 'structure.general-cooker-04', flavorText: 'A small cooking cart, well-used.' },
  'general-cooker-01': { label: 'Tripod Stand', spriteAssetId: 'structure.general-cooker-01', flavorText: 'A cooking tripod, ready for a pot.' },
  'general-cooker-02': { label: 'Tripod Stand', spriteAssetId: 'structure.general-cooker-02', flavorText: 'A cooking tripod, ready for a pot.' },
  'general-butchery-02': { label: 'Butcher Pack', spriteAssetId: 'structure.general-butchery-02', flavorText: "A butcher's travel pack." },
  'general-butchery-03': { label: 'Butcher Stand', spriteAssetId: 'structure.general-butchery-03', flavorText: "A butcher's cutting stand." },
  'general-butchery-04': { label: 'Butcher Stand', spriteAssetId: 'structure.general-butchery-04', flavorText: "A butcher's cutting stand." },
  'general-sawmill-level-1': { label: 'Sawmill Tool', spriteAssetId: 'structure.general-sawmill-level-1', flavorText: 'A small sawmill hand tool.' },
  'general-pan-01': { label: 'Pan', spriteAssetId: 'structure.general-pan-01', flavorText: 'A pan over a low flame.' },
  'general-pan-02': { label: 'Pan', spriteAssetId: 'structure.general-pan-02', flavorText: 'A pan over a low flame.' },
  'general-pan-03': { label: 'Pan', spriteAssetId: 'structure.general-pan-03', flavorText: 'A pan over a low flame.' },
  'general-pan-04': { label: 'Pan', spriteAssetId: 'structure.general-pan-04', flavorText: 'A pan over a low flame.' },
  'general-pan-05': { label: 'Pan', spriteAssetId: 'structure.general-pan-05', flavorText: 'A pan over a low flame.' },
  // --- 2026-08 follow-up: source sheets exported as multi-row grids, reflowed into single-row
  // idle-loop animations via a one-off Python/PIL script (docs/Map-Object-Catalog.md) so they work
  // with the existing frameSize animation system unchanged ---
  'general-anvil-01': { label: 'Anvil', spriteAssetId: 'structure.general-anvil-01', flavorText: 'A well-used anvil, sparks scattered around it.' },
  'general-anvil-02': { label: 'Anvil', spriteAssetId: 'structure.general-anvil-02', flavorText: 'A well-used anvil, sparks scattered around it.' },
  'general-anvil-03': { label: 'Anvil', spriteAssetId: 'structure.general-anvil-03', flavorText: 'A well-used anvil, sparks scattered around it.' },
  'general-alchemy-table-01': { label: 'Alchemy Table', spriteAssetId: 'structure.general-alchemy-table-01', flavorText: 'A cluttered alchemy table, bottles bubbling softly.' },
  'general-alchemy-table-02': { label: 'Alchemy Table', spriteAssetId: 'structure.general-alchemy-table-02', flavorText: 'A cluttered alchemy table, bottles bubbling softly.' },
  'general-alchemy-table-03': { label: 'Alchemy Table', spriteAssetId: 'structure.general-alchemy-table-03', flavorText: 'A cluttered alchemy table, bottles bubbling softly.' },
  'general-furnace-bricks-01': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-bricks-01', flavorText: 'A brick furnace, glowing embers within.' },
  'general-furnace-bricks-02': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-bricks-02', flavorText: 'A brick furnace, glowing embers within.' },
  'general-furnace-bricks-03': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-bricks-03', flavorText: 'A brick furnace, glowing embers within.' },
  'general-furnace-iron-01': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-iron-01', flavorText: 'An iron furnace, glowing embers within.' },
  'general-furnace-iron-02': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-iron-02', flavorText: 'An iron furnace, glowing embers within.' },
  'general-furnace-iron-03': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-iron-03', flavorText: 'An iron furnace, glowing embers within.' },
  'general-furnace-stone-01': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-stone-01', flavorText: 'A stone furnace, glowing embers within.' },
  'general-furnace-stone-02': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-stone-02', flavorText: 'A stone furnace, glowing embers within.' },
  'general-furnace-stone-03': { label: 'Furnace', spriteAssetId: 'structure.general-furnace-stone-03', flavorText: 'A stone furnace, glowing embers within.' },
  'general-sawmill-level-2': { label: 'Sawmill', spriteAssetId: 'structure.general-sawmill-level-2', flavorText: 'A sawmill, blade turning steadily.' },
  'general-sawmill-level-3': { label: 'Sawmill', spriteAssetId: 'structure.general-sawmill-level-3', flavorText: 'A sawmill, blade turning steadily.' },
  // Note: the 12 standalone tree images from the same migration are NOT here - they're registered
  // as single-tile tilesets (tileset.general-tree-model*-size*) instead of refId structures, since
  // trees are meant to be scattered many times per map (a tileset stamp) rather than tracked
  // individually. See docs/Map-Object-Catalog.md's Tileset section.

  // Raven Ridge hand-crafted-map pass (2026-08) - previously-unused PixelLab mine-decor/
  // overworld-decor2 props, each placed once or twice, so DecorEntity fits better than a scatter
  // tileset (see the tree note above for the opposite case).
  'mine-rail-track': { label: 'Old Rail Track', spriteAssetId: 'structure.mine-rail-track', flavorText: 'A short stretch of rusted rail, half-swallowed by rubble. Whatever ran on it hasn\'t in a long time.' },
  'mine-cart': { label: 'Derelict Mine Cart', spriteAssetId: 'structure.mine-cart', flavorText: 'An overturned mine cart, wheels seized with rust.' },
  'mine-support-beam': { label: 'Collapsed Support Beam', spriteAssetId: 'structure.mine-support-beam', flavorText: 'A wooden support beam, snapped and leaning. Whatever it once held up has long since come down.' },
  'mine-rubble': { label: 'Rubble', spriteAssetId: 'structure.mine-rubble', flavorText: 'A pile of loose rock, spilled from some old collapse.' },
  'mine-crate': { label: 'Old Crate', spriteAssetId: 'structure.mine-crate', flavorText: 'A weathered supply crate, empty and forgotten.' },
  'overworld-boulder': { label: 'Boulder', spriteAssetId: 'structure.overworld-boulder', flavorText: 'A weathered boulder, worn smooth by mountain wind.' },
  'overworld-fallen-log': { label: 'Fallen Log', spriteAssetId: 'structure.overworld-fallen-log', flavorText: 'A fallen log, moss creeping along its underside.' },
  'overworld-tree-stump': { label: 'Tree Stump', spriteAssetId: 'structure.overworld-tree-stump', flavorText: 'An old stump - whatever tree it was has been gone a long time up here.' },
  'overworld-wildflower': { label: 'Wildflower', spriteAssetId: 'structure.overworld-wildflower', flavorText: 'A small patch of wildflowers, stubbornly blooming among the rocks.' },
};

/** Prefix match - multiple numbered instances of the same decor kind share one refId prefix (e.g.
 *  `glowing-mushroom-1`, `glowing-mushroom-2`, ... on a single map), same convention `chest-<location>-<n>`
 *  already uses for chests. */
const DECOR_ENTITY_PREFIXES: { prefix: string; label: string; spriteAssetId: string }[] = [
  { prefix: 'glowing-mushroom', label: 'Glowing Mushroom', spriteAssetId: 'structure.decor-glowing-mushroom' },
];

/** Resolves a map object's refId to its decor entity, checking exact matches first (cheap, and
 *  avoids a prefix accidentally shadowing an unrelated exact-match refId), then prefixes. Returns
 *  null for anything that isn't ambient decor (chests, shrines, NPCs, quest fragments, etc. all stay
 *  on their own existing resolution paths in each scene - this only covers the "purely decorative"
 *  category). */
export function resolveDecorEntity(refId: string): DecorEntity | null {
  if (DECOR_ENTITIES[refId]) return DECOR_ENTITIES[refId];
  for (const entry of DECOR_ENTITY_PREFIXES) {
    if (refId.startsWith(entry.prefix)) {
      return { label: entry.label, spriteAssetId: entry.spriteAssetId, flavorText: `You find a ${entry.label.toLowerCase()}.` };
    }
  }
  return null;
}
