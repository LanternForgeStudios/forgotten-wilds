# Map object catalog

Every placeable **refId-based decor/structure** a map author can drop onto a map's `objects`
layer, plus where to find the raw **tileset** art for hand-painting `ground`/`decorations-N`/
`overhang-N` tiles in Tiled. Two different mechanisms, covered separately below - see
`docs/Tiled-Map-Authoring.md` for the general layer/object model this catalog assumes, and
`docs/Map-Redraw-Tracker.md` for which specific tileset family (or families) is already pre-wired
into each of the 54 non-interior maps, ready to hand-paint from.

## Placeable decor/structure objects (refId-based)

Place a **point object** on the `objects` layer, `Type` set to `interactable`, with a `refId`
custom string property set to one of the ids below. No sprite id ever goes in the map JSON itself -
each refId is resolved to a sprite by `resolveDecorEntity()` in `src/data/decorEntities.ts`, the
single shared lookup `TownScene.tsx`/`OverworldScene.tsx`/`DungeonScene.tsx` all import (previously
three separate, hand-duplicated mechanisms - now one). Interacting with any of these is purely
flavor/decorative - no Cloud Function call, no gameplay effect.

Animated entries loop automatically (single-row idle animation, driven off the registry's own
`frameSize` field) - no per-item animation code is ever needed, adding a new entry to
`DECOR_ENTITIES` in `decorEntities.ts` is the whole job.

### Exact-refId entries

| refId | Label | Sprite asset | Animated? |
|---|---|---|---|
| `fireplace` | Fireplace | `structure.decor-fireplace` | Yes (9-frame flicker) |
| `general-bonfire-01` … `general-bonfire-10` | Fire Pit | `structure.general-bonfire-01` … `-10` | Yes |
| `general-fire-01`, `general-fire-02` | Campfire | `structure.general-fire-01`/`-02` | Yes |
| `general-smoke` | Smoke | `structure.general-smoke` | Yes |
| `general-grill-01` … `general-grill-04` | Grill | `structure.general-grill-01` … `-04` | Yes |
| `general-cooker-03`, `general-cooker-04` | Cooking Cart | `structure.general-cooker-03`/`-04` | Yes |
| `general-cooker-01`, `general-cooker-02` | Tripod Stand | `structure.general-cooker-01`/`-02` | No |
| `general-butchery-02` | Butcher Pack | `structure.general-butchery-02` | No |
| `general-butchery-03`, `general-butchery-04` | Butcher Stand | `structure.general-butchery-03`/`-04` | No |
| `general-sawmill-level-1` | Sawmill Tool | `structure.general-sawmill-level-1` | No |
| `general-pan-01` … `general-pan-05` | Pan | `structure.general-pan-01` … `-05` | Yes |
| `general-anvil-01` … `general-anvil-03` | Anvil | `structure.general-anvil-01` … `-03` | Yes (reflowed from a grid, see note below) |
| `general-alchemy-table-01` … `-03` | Alchemy Table | `structure.general-alchemy-table-01` … `-03` | Yes (reflowed from a grid) |
| `general-furnace-bricks-01` … `-03` | Furnace | `structure.general-furnace-bricks-01` … `-03` | Yes (reflowed from a grid) |
| `general-furnace-iron-01` … `-03` | Furnace | `structure.general-furnace-iron-01` … `-03` | Yes (reflowed from a grid) |
| `general-furnace-stone-01` … `-03` | Furnace | `structure.general-furnace-stone-01` … `-03` | Yes (reflowed from a grid) |
| `general-sawmill-level-2`, `general-sawmill-level-3` | Sawmill | `structure.general-sawmill-level-2`/`-3` | Yes (reflowed from a grid) |

Note: the 12 standalone tree images from the same Pixel Crawler migration are **not** here - unlike
the props above, a tree is meant to be scattered many times per map, so it's registered as a
single-tile tileset instead of a tracked refId object (see the Tileset section below).

### Prefix-match entries (multiple numbered instances per map)

Give each instance a unique numeric suffix, same convention as `chest-<location>-<n>` (which is
handled separately, outside this table - see each scene's own chest-prefix branch).

| refId prefix | Example | Label | Sprite asset | Animated? |
|---|---|---|---|---|
| `glowing-mushroom` | `glowing-mushroom-1` | Glowing Mushroom | `structure.decor-glowing-mushroom` | Yes |

### Adding a new one

1. Register the art in `src/assets/registry.ts` (`category: 'structure'`; set `frameSize` for an
   animated single-row sheet, omit it for a static prop).
2. Add one entry to `DECOR_ENTITIES` (or `DECOR_ENTITY_PREFIXES` for a multi-instance family) in
   `src/data/decorEntities.ts`.
3. Add a row to this table.
4. Place the object in Tiled with a matching `refId`. All three exploration scenes pick it up
   automatically - no scene-side code changes needed.

## Tileset art (hand-slice in Tiled)

Everything below is a raw multi-item contact sheet, not tied to a refId - add it as an embedded
tileset (`Tileset → New Tileset`, `tilesetAssetId` custom property set to the registry id) and
paint tiles from it directly, same as any tileset. See `src/assets/registry.ts`'s `category:
'tileset'` entries for the complete, current list (id → `filePath` → dimensions) - not duplicated
here since it changes independently of this catalog and the registry is the single source of
truth. As of the 2026-08 Pixel Crawler migration, the following pack families are available (ids
prefixed accordingly, e.g. `tileset.cave-props`, `tileset.cave-tiles`): `castle`, `cave`,
`cemetery`, `desert`, `fairy-forest`, `forge`, `garden`, `general` (formerly "Free Pack" - by far
the largest, covering dungeon props, buildings, craft-station reference sheets, AND its own
separate terrain-tile set - `general-dungeon-tiles`, `-floors-tiles`, `-wall-tiles`,
`-wall-variations`, `-water-tiles`, migrated in a third follow-up pass after the first two missed
the "Environment/Tilesets" folder entirely), `hideout`, `library`, `sewer` - plus every region's own
dedicated terrain/decor set built earlier in the project (`town-terrain`, `overworld-terrain`,
`endless-prairie-terrain`, `frosthaven-terrain`, etc.) and the `tx-*`/`retro-interior-*`
(TopDownHouse) families reserved for interior work.

**Migration completeness**: every one of the 117 in-scope PNGs across all 11 Pixel Crawler packs
(every `Assets/` or `Environment/{Props,Structures,TileSets|Tilesets}/` file, excluding
Enemies/Entities/Social/Weapons/Icons/MockUps content, which is deliberately out of scope) is now
migrated and registered - verified by an exact-path audit script cross-referencing every migration
manifest used this session against the full folder tree, not just spot-checked.

**Standalone tree tilesets** (`tileset.general-tree-model1-size2` … `general-tree-model3-size5`, 12
total): each is one whole tree image, registered as a real 16x16-grid tileset like every other
Pixel Crawler pack (confirmed 2026-08: initially embedded as a 1-tile whole-image stamp, which drew
the entire tree squashed into a single 16px map cell - fixed by re-slicing at the tree's native
16x16 grid). Since a tree spans many cells, place it in Tiled by selecting the *whole tree's tile
region* from the tileset picker (drag-select all of it, not just one cell) and stamping that
multi-tile block onto `decorations-1`/`overhang-1` - Tiled preserves the block's shape when you
stamp it, so the full tree reconstructs correctly across the cells it covers.

**Reflowed grid animations**: `general-anvil-01/-02/-03`, `general-alchemy-table-01/-02/-03`,
`general-furnace-bricks/-iron/-stone-01/-02/-03`, and `general-sawmill-level-2/-3` (17 items,
listed as `structure` entries in the table above, not here) were originally exported as multi-*row*
grids of frames rather than this project's usual single-*row* strip. Since the animation system
only plays a single row, each was reflowed row-major into a single-row strip via
`scripts/build_reflow_grid_animation.py` (grid shape determined by transparent-gutter detection
plus column autocorrelation, not guessed) before being registered as a normal animated `structure`. The
original grid-layout source files are preserved unchanged at `public/assets/tilesets/old/` under
their prior (superseded) tileset filenames, in case a future item needs the same treatment.

A source grid is often padded to a full rectangle even when the real animation has fewer frames
than rows×cols (the last row(s) are blank filler cells). The reflow script now trims any
fully-transparent frames off the *end* of the strip before saving - if it reflowed them verbatim,
this project's frameCount = `dimensions.width / frameSize.width` would loop straight through the
blank cells, showing as a blank-frame flash right before the animation restarts. 8 of the 17 items
above (`general-anvil-01/-02/-03`, `general-alchemy-table-01/-02/-03`, `general-sawmill-level-2/-3`)
shipped with this bug initially (reported live against `general-anvil-01`) and were re-trimmed by
hand; the `general-furnace-*` sheets were already blank-frame-free (their 2x2 grids have no padding).

**Two remaining static reference-only sheets** (`tileset.general-bonfire-catalog`,
`general-cooking-equipment`): unlike the grids above, these two are genuinely one-off catalog
images (several *different* unlit fire-pit/cooking-equipment styles shown side by side), not frames
of one animation - there's no single "correct" animation to reflow them into, so they're still
plain hand-sliceable tileset sheets.

Retired tilesets (superseded, no longer registered) live under `public/assets/tilesets/old/` for
reference - not usable in a map without re-registering them.
