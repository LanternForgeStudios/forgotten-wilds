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

## The `objects` layer (unchanged)

Still an **Object Layer** named `objects`, with each object's Class/Type field set to one of:
`npc`, `transition`, `interactable`, `encounterZone`, `spawnPoint`. Any other value here will fail
to load (this layer is validated strictly, unlike `collisions`).

## Custom properties

- **Map Properties → Custom Properties**: `tilesetAssetId` (string) — must be set to the game's
  asset-registry id for the tileset (e.g. `tileset.tiny-dungeon`), not a filename.
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

- `scripts/genMap.mjs` + `scripts/map-specs/*.json` is a separate, older helper that only ever
  generates a `ground` + `objects` map (a bordered rectangular room). It has no concept of
  decorations/collisions/overhang. Use it only for a quick simple-room stub; author anything
  richer directly in Tiled instead.
- Object visuals (which sprite an `npc`/`interactable` renders as) are still resolved by each
  scene's own lookup tables (`src/scenes/TownScene.tsx`, `OverworldScene.tsx`, `DungeonScene.tsx`),
  not by map data. Adding a new NPC or interactable to a map still requires wiring its sprite in
  the relevant scene, same as before this change.
