# Authoring maps in Tiled

This game's map loader (`src/assets/tiledLoader.ts`) reads a subset of the real Tiled JSON export
format. Maps can be authored directly in the [Tiled editor](https://www.mapeditor.org/) and
exported straight into `public/assets/maps/<location-id>.json`, as long as the conventions below
are followed.

## Layer model

Rendering order (bottom to top): `ground` → `decorations-1` → `decorations-2` → ... → entities
(player/NPCs) → `overhang` (or `overhang-1` → `overhang-2` → ... if more than one is needed).

| Layer name | Tiled layer type | Purpose |
|---|---|---|
| `ground` | Tile Layer | Base terrain. Any populated tile is walkable *by default* - see "Walkability" below. Required. |
| `decorations-1`, `decorations-2`, ... | Tile Layer | Optional cosmetic layers, rendered above ground and below entities, in ascending numeric order. Never affect collision. |
| `collisions` | Object Layer | Discrete, non-interactive obstacles (fences, rocks, ledges, barriers). Rectangle or point objects. Block movement but never trigger interaction/dialogue. |
| `objects` | Object Layer | Spawns, transitions, NPCs, interactables, walk-in zones. |
| `overhang`, or `overhang-1`, `overhang-2`, ... | Tile Layer | Optional cosmetic layer(s) rendered above the player/NPCs (roofs, bridges, tree canopies). A single unsuffixed `overhang` is fine for one layer; use numbered `overhang-N` (ascending stacking order, same convention as `decorations-N`) only once a map actually needs more than one - e.g. a tree canopy above a lower roof overhang. Never affects collision. |

Layer names are case-sensitive and must match exactly. Anything else is ignored for rendering
purposes and logged as a warning in the browser dev console (visible when running `npm run dev`),
to catch typos early.

There is intentionally no true multi-level elevation or separate collision planes — `overhang` is
purely a visual trick (it renders above the player in the DOM, nothing more) and `collisions` is
purely geometric (it blocks movement, nothing more).

## The `collisions` layer

Add an **Object Layer** named `collisions`. Place rectangle objects (or point objects, for a
single-tile obstacle) over anything that should block movement without being interactable — a
fence, a rock, a ledge. The object's Class/Type field is ignored entirely, so it can be left blank.
This is a different mechanism from `objects`' `interactable` type: an `interactable` object is both
a collision blocker *and* something the player can walk up to and interact with (a chest, a
shrine); a `collisions` object is scenery only. It's also a separate mechanism from `walkable:
false` on a `ground` tile (see "Walkability" above) - `collisions` is the right tool when you want
to block an area *without* it being tied to a specific ground tile (an irregular fence line cutting
across otherwise-walkable grass, for example), and `walkable: false` is the right tool when the
ground tile itself inherently shouldn't be stood on everywhere it's placed (water, a chasm). Use
whichever is more convenient for a given obstacle - they compose freely.

**Draw rectangles at whatever exact pixel size/position the obstacle needs - no grid-snapping
required.** Player movement is continuous, velocity-based Arcade Physics (not tile-stepped), and
every `collisions` rectangle becomes a real Arcade static body at its exact native-pixel
coordinates (see `src/assets/tiledLoader.ts`'s own top-of-file comment and
`src/phaser/ExplorationScene.ts`) - a rectangle 6px wide only blocks those 6px, not a whole tile.
Tiled's **Snap to Grid** is still fine to leave on for convenient placement, it's just no longer
required for correctness the way it used to be under the old tile-stepped movement. Toggle the F9
debug overlay in-game (desktop only) to see every collision rectangle drawn in red against the
live map, exactly where it'll actually block - the fastest way to confirm a rectangle you drew
lines up with the art.

## The `objects` layer

Still an **Object Layer** named `objects`, with each object's Class/Type field set to one of:
`npc`, `transition`, `interactable`, `zone`, `spawnPoint`. Any other value here will fail to load
(this layer is validated strictly, unlike `collisions`).

For a purely decorative `interactable` (a fireplace, a glowing mushroom, a campfire prop - no
gameplay effect, just an ambient/animated prop), see `docs/Map-Object-Catalog.md` for the full list
of ready-to-use `refId`s and how to register a new one.

`zone` is a **rectangle** object (unlike the others, which are points) - a walk-in sub-area that
fires the moment the player's physics body overlaps it at all (no explicit Interact needed), e.g. a
named clearing or camp within a larger overworld map. Drawn at whatever exact pixel size/position
the area needs, same pixel-precise convention as `collisions` above - it triggers on real overlap
with its drawn rectangle, not a tile-rounded approximation. Give it a `refId` custom property the
same way a `transition`/`interactable` would; each scene decides what actually happens on entry
(see `ExplorationScene.ts`'s `onZoneEnter` callback, wired from `PhaserExplorationCanvas.tsx`, and
`OverworldScene.tsx`'s dispatch for a real example). A `zone` and a same-refId point `interactable`
can coexist (e.g. a walk-in clearing that also contains a separate shrine you still approach and
Interact with) - they're independent objects. `transition` objects work the same overlap-triggered
way (see `ExplorationScene.ts`'s `onTransitionEnter` callback).

## Multiple tilesets per map

A map isn't limited to one embedded tileset - add as many **Tileset → New Tileset** entries as you
need (e.g. a grass ground pack plus a separate tree/prop pack), same as any real multi-tileset Tiled
map. Each tile placement just references whichever tileset's gid range it falls into; `ground`,
`decorations-N`, and `overhang(-N)` layers can all freely mix tiles from any of the map's tilesets.

The one thing Tiled itself doesn't know about is which game asset-registry id each tileset image
corresponds to - set that with a **Tileset → Properties** custom property named `tilesetAssetId`
(string) on *every* embedded tileset. (The very first tileset can instead rely on the map-level
`tilesetAssetId` property below, for backward compatibility with maps authored before multi-tileset
support existed - but any additional tileset must set its own.)

## Walkability

Any populated `ground` tile (a real tile, not an empty cell) is walkable **by default**. Set a
per-tile custom property `walkable` (bool) to `false`, in the Tileset Editor, only on the
exceptions — walls, water, chasms, anything the player shouldn't be able to stand on. This is
deliberately an opt-*out* list, not an opt-in one: most of a hand-authored map's ground genuinely
is walkable, so a newly-painted floor variant works immediately without also having to remember to
flag it walkable somewhere else — you only ever need to think about this for the (usually much
smaller) set of tiles that should block movement.

## Tile animation

Tiled's native per-tile animation (Tileset Editor → select a tile → Tile Animation Editor) is
supported — a water, sewer, or forge tile animated this way plays back in-game automatically, no
game code changes needed. Every placement of that same source tile across the whole map cycles in
lockstep, using each frame's own duration exactly as set in the editor.

This only takes effect on a tile actually placed on a layer — animating a tile in the Tileset
Editor doesn't do anything on its own, same as `walkable` above.

If more than one map shares the same tileset (see "Multiple tilesets per map") and you animate a
tile in one map's copy of it, that animation only applies to that one map — each map embeds its own
copy of the tileset's data, so the same tile in another map stays static until you either repeat the
animation there too or ask for it to be copied over.

## Custom properties

- **Map Properties → Custom Properties**: `tilesetAssetId` (string) — the game asset-registry id for
  the map's first/primary tileset (e.g. `tileset.tiny-dungeon`), not a filename. See "Multiple
  tilesets per map" above for maps with more than one.
- **Tileset editor, per tile**: `walkable` (bool) — see "Walkability" above. Omit entirely for any
  tile that should just be walkable.
- **Tileset editor, per tile**: Tile Animation Editor — see "Tile animation" above. Omit entirely
  for any tile that should just be static.

## Export settings — hard constraints

These aren't stylistic preferences; maps that don't follow them will fail to load or silently load
wrong.

- **Tile Layer Format**: Map Properties → set to **CSV**. Do not use "Base64 (uncompressed)" or
  "Base64 (zlib/gzip compressed)" — the loader expects each tile layer's `data` as a plain JSON
  array of numbers. Compressed/encoded tile data isn't supported.
- **Tileset embedding**: the tileset must be **embedded** in the map JSON (inline `tiles`/
  `tilecount`/`columns`), not referenced as an external `.tsx` file. When creating the tileset in
  Tiled, make sure "Embed in map" is used (or export with `--embed-tilesets` if scripting the
  export). An externally-referenced tileset silently loses its `walkable: false` exceptions and
  column count - since walkability now defaults to true, that makes walls/water/etc. silently
  *walkable* instead of the reverse. The dev-console (`npm run dev`) warns loudly if a loaded
  tileset looks externally-referenced, specifically so this doesn't fail silently.

## Where the file goes

Export straight into `public/assets/maps/<location-id>.json` — same as every existing map. No
build step or pipeline runs on it; it's fetched directly by the client at runtime via the asset
registry (`src/assets/registry.ts`).

## What this doesn't cover

- `scripts/genMap.mjs` is a separate, older helper that only ever generates a `ground` + `objects`
  map (a single-tileset, bordered rectangular room) from a small JSON spec. It has no concept of
  decorations/collisions/overhang/multiple tilesets/zones. Use it only for a quick simple-room stub.
- `scripts/genMapRicher.mjs` is the richer sibling - it emits this full richer format (multiple
  tilesets, ground regions, decoration/overhang scatter, collisions, zones) from a spec (see
  `scripts/map-specs-richer/*.json` for real examples), still producing genuinely Tiled-compliant
  JSON you can open and re-export from Tiled directly. Prefer authoring straight in Tiled once a map
  needs anything the spec format can't express cleanly (irregular hand-painted terrain, etc.).
- Object visuals (which sprite an `npc`/`interactable` renders as) are still resolved by each
  scene's own lookup tables (`src/scenes/TownScene.tsx`, `OverworldScene.tsx`, `DungeonScene.tsx`),
  not by map data. Adding a new NPC or interactable to a map still requires wiring its sprite in
  the relevant scene, same as before this change.
