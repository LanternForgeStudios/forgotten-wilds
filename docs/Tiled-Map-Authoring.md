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
| `ground` | Tile Layer | Base terrain. Drives walkability via each tile's `walkable` custom property. Required. |
| `decorations-1`, `decorations-2`, ... | Tile Layer | Optional cosmetic layers, rendered above ground and below entities, in ascending numeric order. Never affect collision. |
| `collisions` | Object Layer | Discrete, non-interactive obstacles (fences, rocks, ledges, barriers). Rectangle or point objects. Block movement but never trigger interaction/dialogue. |
| `objects` | Object Layer | Spawns, transitions, NPCs, interactables, encounter zones. Existing convention, unchanged. |
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
shrine); a `collisions` object is scenery only.

## The `objects` layer

Still an **Object Layer** named `objects`, with each object's Class/Type field set to one of:
`npc`, `transition`, `interactable`, `zone`, `spawnPoint`. Any other value here will fail to load
(this layer is validated strictly, unlike `collisions`).

`zone` is a **rectangle** object (unlike the others, which are points) - a walk-in sub-area that
fires once the player's tile steps into it (no explicit Interact needed), e.g. a named clearing or
camp within a larger overworld map. Give it a `refId` custom property the same way a `transition`/
`interactable` would; each scene decides what actually happens on entry (see
`useLocationExploration.ts`'s `onZoneEnter` option and `OverworldScene.tsx`'s dispatch for a real
example). A `zone` and a same-refId point `interactable` can coexist (e.g. a walk-in clearing that
also contains a separate shrine you still approach and Interact with) - they're independent objects.

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

## Custom properties

- **Map Properties → Custom Properties**: `tilesetAssetId` (string) — the game asset-registry id for
  the map's first/primary tileset (e.g. `tileset.tiny-dungeon`), not a filename. See "Multiple
  tilesets per map" above for maps with more than one.
- **Tileset editor, per tile**: `walkable` (bool) — set `true` on any `ground`-layer tile the
  player can stand on.

## Export settings — hard constraints

These aren't stylistic preferences; maps that don't follow them will fail to load or silently load
wrong.

- **Tile Layer Format**: Map Properties → set to **CSV**. Do not use "Base64 (uncompressed)" or
  "Base64 (zlib/gzip compressed)" — the loader expects each tile layer's `data` as a plain JSON
  array of numbers. Compressed/encoded tile data isn't supported.
- **Tileset embedding**: the tileset must be **embedded** in the map JSON (inline `tiles`/
  `tilecount`/`columns`), not referenced as an external `.tsx` file. When creating the tileset in
  Tiled, make sure "Embed in map" is used (or export with `--embed-tilesets` if scripting the
  export). An externally-referenced tileset will silently lose its `walkable` tile properties and
  column count.

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
