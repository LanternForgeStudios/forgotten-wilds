# Asset Credits

Most of the game's art, audio, and tilesets are now real, final assets - the vast majority of what
was originally MVP placeholder art (see `status` in `src/assets/registry.ts`) has since been
generated or commissioned and swapped in. This file tracks attribution for third-party assets and
notes which categories still carry a real license caveat worth resolving before treating them as
permanent.

## AI-generated character/creature/icon/tileset art (pixellab.ai)

Generated via a pixellab.ai subscription (project use, not resale) through the pixellab MCP server
(`create_character`, `animate_character`, `create_map_object`, `create_tiles_pro`,
`create_topdown_tileset`, `create_building_kit`, `create_1_direction_object`/`create_8_direction_object`,
etc.). This is the source for the large majority of the game's final art:

- All 55 NPC dialogue portraits and all 55 NPC overworld sprites (idle/walk-cycle animated where
  applicable), across every region.
- All 42 enemy battle sprites (regular/elite/boss), each with a real idle "fight stance" animation.
- The player character's own base bodies (8: 4 appearances x 2 genders) and walk+run sprite sheets.
- Every equipment layer sprite (123 of 123 layerable weapon/chest/legs/boots/gloves/lantern items,
  male + female) and every equipment/item/currency/ailment UI icon (56 total).
- The chest object (closed/open, animated glow), most terrain/decoration/overhang tilesets for
  Town/Overworld/Dungeon locations across every region, and the dungeon building-kit architecture
  set.

See `docs/Asset-Production-Checklist.md` for the full per-category breakdown, generation prompts,
and the `scripts/build_*.py` pipelines that process a raw pixellab export into the final in-game
asset. Full raw exports are archived alongside each processed asset's own `original/` folder.

## Externally-commissioned painterly art

Produced outside pixellab (a different, higher-fidelity painterly illustration style pixellab's
own tools can't reproduce - see `docs/Asset-Production-Checklist.md`'s "Things Claude can't
generate itself" section), commissioned specifically for this project with no external license
concerns:

- **Title screen hero art** - `public/assets/backgrounds/title-screen.png`
  (`background.title-screen`) - has the game's own logo and tagline painted in.
- **Battle backgrounds (7)** - `ironwood-trail.png`, `raven-ridge.png`, `whisper-falls.png`,
  `black-briar-forest.png`, `hollow-rail-mine.png` (one per Iron Mountains region/dungeon with real
  encounters), plus generic `forest.png`/`shrine.png` used as the fallback for every location that
  doesn't have its own dedicated background yet. **Outstanding gap**: every region past Iron
  Mountains (43 major locations across Crimson Bayou/Endless Prairie/Whispering Pines/Shattered
  Desert/Frozen Frontier) still falls back to the generic `forest`/`hollow-rail-mine` backgrounds -
  see the Battle Backgrounds section of `docs/Asset-Production-Checklist.md` for the full list and
  ready-to-use generation prompts.
- **Cutscene backgrounds (3)** - `quest-rekindling-spirit-grove.png`, `quest-the-mountain-remembers.png`,
  `defeat-cutscene.png`.
- **Ash Hallow building facades (9) + shrine marker** - the original painterly building-entrance
  art for Ash Hallow's 9 buildings and the shrine landmark, in `public/assets/sprites/structures/`.
  **Note**: later regions' own building facades (e.g. Mirehaven's 7 buildings) were generated via
  pixellab instead as a stopgap so those towns aren't missing entrances entirely - they're real,
  final, licensed art, just in a visibly flatter style than this original painterly set. Revisit
  with the same external process as this set if visual consistency across regions matters later.

## Music & sound effects - FarBeyond Studio, "Freebies Vol. 1" (CC-BY 4.0)

All 7 music tracks and all 21 sound effects are picked from this one CC-BY-licensed library,
staged in full at `public/assets/audio/library/{music,sfx}/` (not just the picks actually wired
in - browse there for alternates). **CC-BY 4.0 requires attribution to the creator, FarBeyond
Studio** - this file is that attribution; keep it here (or somewhere equally visible, e.g. an
in-game credits screen) for as long as any of this library's files ship with the game. See
`docs/Asset-Production-Checklist.md`'s Audio section for exactly which track/file was picked for
each music/sfx id, and which picks are flagged as weak fits worth reconsidering.

## Kenney.nl (CC0 1.0 Universal)

CC0 - no attribution legally required, but Kenney's work is excellent and worth crediting and
supporting (kenney.nl):

- **Tiny Dungeon** - `public/assets/tilesets/tiny-dungeon.png` (`tileset.tiny-dungeon`) -
  https://kenney.nl/assets/tiny-dungeon - the generic interior tileset used by the large majority
  of this game's dungeon/building-interior rooms across every region.
- **Fantasy UI Borders** - `public/assets/ui/panel-border-000.png`, `panel-border-004.png`
  (`ui.panel-border-*`) - https://kenney.nl/assets/fantasy-ui-borders - the 9-slice panel chrome
  used throughout every menu/overlay.

## Pixel Crawler series (Anokolisa) - 2026-08 tileset migration

11 tileset packs (Castle, Cave, Cemetery, Desert, Fairy Forest, Forge, General - formerly "Free
Pack", Garden, Hideout, Library, Sewer) migrated from `art-staging/tilesets/` into
`public/assets/tilesets/` (terrain/prop sheets, `tileset.<pack>-*` ids) and
`public/assets/sprites/structures/` (animated station props and standalone trees, `structure.
general-*` ids) - see `docs/Map-Object-Catalog.md` for the placeable refId list. Created by
Anokolisa (Patreon: patreon.com/Anokolisa, Twitter: @Anokolisa) - per each pack's own bundled
`Terms.txt`: free for commercial use regardless of how the assets were acquired, credit
appreciated but not legally required, and the assets themselves may not be resold/redistributed as
a standalone asset pack. Original `Terms.txt` files are preserved under each pack's own
`art-staging/tilesets/` folder.

## Uploaded tileset packs with unconfirmed provenance - action needed

A number of OTHER tileset packs (not the Pixel Crawler/Anokolisa set above, which has a clear,
confirmed license) were uploaded early in the project without a recorded source, and their own
registry `notes` field says so explicitly ("provenance unconfirmed, verify license before shipping
as final"). Most of these were never wired into a map and were retired to
`public/assets/tilesets/old/` (unregistered) during the same 2026-08 pass that brought the Pixel
Crawler set in - see `docs/Asset-Production-Checklist.md`'s "Already-uploaded packs" note for what
else is still sitting there unused (Time Fantasy-style, Velmora-branded, grassland, etc.).

**The following ARE STILL actively used in live, shipped maps today** (the ones with a currently
non-empty "Used in" column below), which makes clearing their actual license a real, outstanding
task, not just housekeeping. Several of these are expected to become fully unused - and safe to
retire the same way - as the 2026-08 Pixel Crawler migration works through redrawing every
non-interior map's `ground` layer (in progress; each map's old tilesets get retired at the same
time that map is redrawn, not all at once up front, so a still-live map is never left broken):

| Tileset | Used in |
|---|---|
| `tileset.retro-interior-floors-walls`, `-doors-windows`, `-furniture-1`, `-furniture-2` (the "TopDownHouse" pack) | ~40 references each across most building-interior maps (protected - interior maps are out of scope for the tileset migration) |
| `tileset.ground-tiles-16` | Ash Hallow, Black Briar Forest, Ironwood Trail, Raven Ridge, Whisper Falls - pending redraw |
| `tileset.trees-signs-rocks-bridge-16` | same 5 maps as above - pending redraw |
| `tileset.graveyard-set-16` | Black Briar Forest - pending redraw |
| `tileset.rpg-icons-2` | Ash Hallow Armory, Ash Hallow Blacksmith |

If the original source of any of these can't be identified and confirmed as freely licensed, treat
replacing it with a pixellab-generated, Pixel Crawler, or otherwise-licensed equivalent as a real
priority - the game is live and public (GitHub Pages) with these assets shipping today.
