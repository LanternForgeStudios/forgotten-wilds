# Tiled map templates

Four starter maps, one per map type this game has, meant to be opened directly in the
[Tiled editor](https://www.mapeditor.org/) and edited/exported from there rather than hand-typed.
Full authoring rules (layer names, required custom properties, export settings) live in
`docs/Tiled-Map-Authoring.md` — this file only covers what's specific to these four templates.

| Template | Loosely based on | Dimensions |
|---|---|---|
| `building-interior.json` | `ash-hallow-elias-house.json` | 7×6 |
| `town.json` | `ash-hallow.json` | 22×14 |
| `overworld-region.json` | `ironwood-trail.json` | 32×20 |
| `dungeon-floor.json` | `hollow-rail-mine.json` | 30×18 |

Each demonstrates the full layer model documented in `docs/Tiled-Map-Authoring.md`:
`ground` → `decorations-1` → `decorations-2` → `collisions` (object layer) → `objects` (object
layer) → `overhang`. Every shipped map today only uses `ground` + `objects` — these templates are
the first files in the repo to actually show the fuller model in practice.

Each template uses a single, unsuffixed `overhang` layer, which stays valid indefinitely (there's
no need to rename it). If a map needs more than one overhang layer stacked (e.g. a tree canopy
above a lower roof), the loader also supports numbered `overhang-1`, `overhang-2`, ... — same
convention as `decorations-N` — see `docs/Tiled-Map-Authoring.md`'s layer table.

## What's a faithful copy vs. a trimmed sample

- **Layout and object types** (doors, NPCs, shrines, chests, spawn points, transitions) are close
  to their source map, so each template still reads as "a real town/dungeon/etc.", not a generic
  box.
- **Encounter zones** are trimmed. `ironwood-trail.json` and `hollow-rail-mine.json` each tile an
  `encounterZone` object every few tiles across their *entire* walkable area (dozens of them) — the
  templates instead show a representative sample (a 3×3 or 3×2 grid) at the same spacing, with a
  comment in the generator noting where the pattern continues. Tile the same `{x: x+4, y}` /
  `{x, y: y+4}` pattern across the rest of your map's walkable interior for a real encounter zone
  grid.
- **`decorations-1`/`decorations-2`/`overhang` tile ids are placeholders.** Each template sprinkles
  in a handful of tiles from `tiny-dungeon.png` (ids 6, 42, and 18 respectively) purely so the
  layers aren't empty and you can see where they render in relation to `ground`/entities. They
  carry no gameplay meaning — repaint them in Tiled with whatever decorative/roof tiles you
  actually want.
- **The `collisions` rectangle** in each file is a single placeholder obstacle (a table, market
  stall, boulder, or cave-in) sized 1-2 tiles, just to show the mechanism. Add as many as your real
  map needs.

## Map-level metadata

Beyond the tileset block below, each file also carries the top-level fields a real Tiled install
needs just to recognize and open the file at all: `type: "map"`, `orientation`, `renderorder`,
`infinite`, `compressionlevel`, `tiledversion`, `version`, `nextlayerid`, `nextobjectid`, plus a
unique `id`/`x`/`y` on every layer and `draworder` on every object layer. The game's own loader
(`src/assets/tiledLoader.ts`) ignores all of these too - they're required by Tiled, not by this
game. (An earlier pass at these templates omitted them entirely and Tiled refused to open the
files - confirmed by diffing against a real blank map exported from Tiled.)

## The tileset block

Unlike the game's own maps — where the loader only reads `firstgid`/`tilecount`/`columns`/
`tiles[].properties` — each template's embedded tileset also includes `name`, `image`,
`imagewidth`, `imageheight`, `tilewidth`, `tileheight`, `margin`, and `spacing`. These extra fields
are what a real Tiled install needs to actually open the file and render the tileset preview; the
game's loader ignores all of them.

**The `image` path (`../../../public/assets/tilesets/tiny-dungeon.png`) is for Tiled's own local
preview only.** The game never reads it — asset resolution happens entirely through the map's
`tilesetAssetId` custom property (already set to `tileset.tiny-dungeon` in every template). If
Tiled can't find the PNG at that relative path on your machine, either move/symlink the file to
match, or just repoint the tileset's image path inside Tiled — it has no effect on how the map
loads in-game.

## Where to put a real map made from one of these

Once you've edited a template into an actual location, export/save it as
`public/assets/maps/<location-id>.json` and add a matching entry to `src/assets/registry.ts` (see
any existing `map.*` entry for the shape) — same as every other map in this repo.
