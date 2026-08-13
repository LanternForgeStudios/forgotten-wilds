# Map tileset tracker

Tracks the 2026-08 Pixel Crawler tileset migration across every map in the game (see
`docs/Map-Object-Catalog.md` for the tileset/structure catalog this draws from). Two categories,
covered in their own sections below - **non-interior maps** (54 - towns/fields/dungeons, fully
redrawn: new tileset family, new blank `decorations-1`/`overhang-1`/`collisions`, flood-filled
`ground`) and **interior maps** (40 - building interiors, wiring-only: no layer/ground changes,
just additional tilesets appended for hand-painting from).

Updated as each pass completes - this file should always reflect the current, real state of the
maps, not a plan. If a map ever gets manually re-edited past what's recorded here (different
family added, ground re-picked), update its row rather than leaving this stale.

## Status

**All 54 non-interior maps done** (Iron Mountains batch + all 48 remaining maps across the other 5
regions, done in one pass once the pipeline was proven on Iron Mountains). Verified via an
automated structural check (correct 5-layer shape, every tileset image resolves, ground gid valid/
uniform, `decorations-1`/`overhang-1` blank, `collisions` empty) across all 54 - 0 problems. Live-
rendered and confirmed in-browser for Ash Hallow specifically; the other maps share the exact same
redraw mechanism and passed the same automated structural check, but a fresh test account can't
freely walk to most other regions (they're quest-gated behind main-story progress, same as always -
see `functions/src/functions/enterLocation.ts`'s `LOCATION_GATES`), so they weren't individually
walked-to and eyeballed live this session.

**Root-cause bug found and fixed along the way**: `src/phaser/textureLoader.ts`'s `loadSceneTexture`
had a latent race condition (multiple concurrent texture loads each calling `load.start()` and
listening for the generic queue-`COMPLETE` event) that only manifested once a map had more than a
handful of tilesets - confirmed as a permanent "Loading..." hang on Ash Hallow's first 42-tileset
redraw. Fixed to listen for the per-file `filecomplete`/`loaderror` events instead, which is what
makes wiring 40+ tilesets into a single map (as this whole pass does) actually work.

**Follow-up variation pass**: the first pass leaned on a handful of families (general/castle/
fairy-forest) for most maps and left `forge`, `garden`, `hideout`, `library`, `sewer` wired into
only 1-2 maps each (cemetery and cave were also thin). Went back through and added each of those to
2-3 more well-matched maps as a *secondary* family (existing ground fill untouched, just more
tilesets available to hand-paint from) - noted inline below wherever a map picked up an addition.
Both `forge` and `sewer` turned out, on inspection, to be dungeon-interior tilesets (fire/lava/
molten stone; grimy underground passage) rather than general-purpose outdoor sets - placed
accordingly (dungeon rooms with a fitting angle - Coal Spirit/ember lore, an underground cavern),
kept only as a secondary bonus option (not the primary ground fill) on the handful of outdoor/town
maps that already had them from the first pass.

## How a "ground fill" entry works

Format: `<tileset id> col=<C> row=<R>` - the exact 16×16 tile cell (0-indexed from the sheet's
top-left) used to flood-fill the entire `ground` layer as a single repeated tile. Picked via an
automated fully-opaque + low-color-variance scan of each candidate sheet, then visually confirmed
before use - not eyeballed. It's a deliberately plain, uniform base (per the project's own "ready
to hand-polish" framing), not a finished hand-painted terrain.

---

## Iron Mountains

| Map | Family/families (tileset count) | Ground fill |
|---|---|---|
| Ash Hallow | general + forge | `tileset.general-floors-tiles` col=5 row=25 (tan packed dirt/path); `forge` added as a bonus fire/ember variety option, not otherwise thematically load-bearing here |
| Ironwood Trail | fairy-forest | `tileset.fairy-forest-tiles` col=6 row=15 (mossy forest floor) |
| Raven Ridge | cave | `tileset.cave-tiles` col=7 row=13 (rocky brown ground) |
| Whisper Falls | fairy-forest + general | `tileset.fairy-forest-tiles` col=6 row=15 (mossy forest floor); `general-water-tiles` available for the falls/pools |
| Black Briar Forest | fairy-forest + cemetery | `tileset.fairy-forest-tiles` col=6 row=15 (dark forest floor); full cemetery set available for graves/crypts |
| Hollow Rail Mine | general + cave + forge | `tileset.general-floors-tiles` col=3 row=0 (grey stone/brick floor); `forge`'s molten/ember tiles fit the region's Coal Spirit lore well |

**Ash Hallow** (town) - *"A small mountain town at the foot of the Iron Mountains, and home to the
Lantern Keepers' waystation."* The game's home base - Inn, Archive, Mine Office, Town Hall, a
shrine. Cozy, lived-in, lantern-lit.

**Ironwood Trail** (overworld) - *"A winding ridge trail through haunted forest, said to be favored
by Mothling swarms after dusk."* A forest trail, moody at the edges, safe enough by day.

**Raven Ridge** (overworld) - *"Rocky mountain paths above Ironwood Trail - Cliff Pass, the
Abandoned Rail Line, Eagle Overlook, and the old Moon Witch Circle all lie along its length."*
Exposed, rocky, higher-altitude - old rail infrastructure and a witch-circle landmark.

**Whisper Falls** (overworld) - *"A waterfall region past Raven Ridge - the Lower Falls, a Hidden
Cave, the Lantern Pools, and the Ancient Stair wind through the spray."* Wet, mist-heavy, a mix of
falling water and old carved stairs.

**Black Briar Forest** (overworld) - *"Dense haunted woods on the far side of Whisper Falls - the
Forgotten Cemetery, the Hollow Tree, Spirit Clearing, and the Fog Marsh lie within."* The darkest
of Iron Mountains' woods - genuinely haunted, a real cemetery landmark inside it.

**Hollow Rail Mine** (dungeon) - *"An abandoned mine and its collapsed rail line, haunted by the
miners who never left and the coal spirits that grew from their grief."* Claustrophobic, coal-dark,
grief-haunted rather than monstrous.

---

## Crimson Bayou

No swamp/bayou-specific Pixel Crawler pack exists, so this region leans on **general** throughout -
`general-water-tiles` for the water-heavy locations (a reasonable stand-in for murky bayou water)
and the same tan `general-floors-tiles` path used for Ash Hallow for the one dry town. `sewer` is
also wired into every field/town here as a secondary bonus for that grimy/murky feel, even though
(per a closer look) it reads more as a dungeon-interior tileset than an overworld one - its
primary, best-fit home is Temple of the Deep Current's flooded dungeon.

| Map | Family/families | Ground fill |
|---|---|---|
| Mirehaven | general + sewer | `general-floors-tiles` col=5 row=25 (tan dirt/boardwalk-adjacent) |
| Cypress Marsh | general + sewer | `general-water-tiles` col=2 row=7 (blue water) |
| Murkwater Trails | general + sewer + cemetery | `general-water-tiles` col=2 row=7; `cemetery` added - the location's own flavor text says "the Old Cemetery lies somewhere among the reeds" |
| Hidden River Landing | general + sewer | `general-water-tiles` col=2 row=7 |
| Temple of the Deep Current | general + castle + sewer | `general-water-tiles` col=2 row=7 (flooded temple); `sewer`'s best-fit home in this region |

**Mirehaven** (town) - *"A bustling river settlement built on stilts above the Crimson Bayou, its
boardwalks creaking underfoot."*

**Cypress Marsh** (overworld) - *"A hushed water-logged marsh of ancient cypress trees, their roots
knotted deep into the bayou."*

**Murkwater Trails** (overworld) - *"Winding waterlogged paths through the deep bayou - the Old
Cemetery lies somewhere among the reeds."* Has the real `cemetery` family wired in now to match.

**Hidden River Landing** (overworld) - *"A weathered dock hidden among the reeds, where Warden
Sabine Thorne keeps watch over the rising waters."*

**Temple of the Deep Current** (dungeon) - *"A flooded ancient temple beneath Hidden River Landing,
once tended by Lantern Keepers alongside the Ancient Serpent Guardian."* Also got `castle` embedded
for real stone-architecture tiles alongside the water base.

## Endless Prairie

Open grassland fields + town use **general**'s tan path tile (reads as sun-baked prairie dirt); all
5 dungeon/temple rooms use **castle** for real stone-dungeon architecture.

| Map | Family/families | Ground fill |
|---|---|---|
| Highwind Crossing | general | `general-floors-tiles` col=5 row=25 (tan) |
| Golden Prairie | general | `general-floors-tiles` col=5 row=25 |
| Spirit Herd Plains | general | `general-floors-tiles` col=5 row=25 |
| Sacred Hills | general + garden | `general-floors-tiles` col=5 row=25; `garden` added for a tended/mystical-grounds feel |
| Stone Circle Valley | general | `general-floors-tiles` col=5 row=25 |
| Thunderbird Mesa Approach | general | `general-floors-tiles` col=5 row=25 |
| Summit Temple | castle | `castle-tiles` col=19 row=18 (brick-red stone floor) |
| Sky Bridge | castle | `castle-tiles` col=19 row=18 |
| Storm Galleries | castle | `castle-tiles` col=19 row=18 |
| Lantern Sanctuary | castle | `castle-tiles` col=19 row=18 |
| Guardian Peak | castle | `castle-tiles` col=19 row=18 |

**Highwind Crossing** (town) - *"A frontier town on the edge of the grasslands, canvas and timber
braced against the endless prairie wind."*

**Golden Prairie** (overworld) - *"Rolling grassland stretching to the horizon, gold-tipped grass
bending in a wind that never quite stops."*

**Spirit Herd Plains** (overworld) - *"Open plains where a great buffalo herd still runs, wardens
against wolves that shadow its edges."*

**Sacred Hills** (overworld) - a ring of low grassy hills, wind moving through the grass as if
carrying something unseen (per the region's own established lore).

**Stone Circle Valley** (overworld) - *"Weathered stone rings stand in careful arrangement here,
carved with figures too worn to read at a glance."*

**Thunderbird Mesa Approach** (overworld) - *"The grassland gives way to bare rock here, rising
toward a mesa lost in cloud - the wind grows sharper with every step."*

**Summit Temple** (dungeon) - *"A wind-scoured stone temple at the foot of Thunderbird Mesa, its
halls still humming with old, half-forgotten mechanisms."*

**Sky Bridge** (dungeon) - *"A narrow stone span arcing over open cloud, the wind strong enough
here to lean into."*

**Storm Galleries** (dungeon) - *"Open-air chambers where lightning gathers instead of dispersing,
crackling between carved stone pillars."*

**Lantern Sanctuary** (dungeon) - *"A quiet round chamber where a single lantern has burned,
untended, since long before Highwind Crossing had a name."*

**Guardian Peak** (dungeon) - the mesa's true summit, open to the sky, the Great Thunderbird's own
domain.

## Whispering Pines

A genuine forest region - **fairy-forest** (its dark, mossy floor tile) covers the town and every
field location. Dungeon rooms split by theme: **cave** for the literal Root Caverns, **castle**
(+ **library** pre-wired specifically for its shelving) for the sanctuary/archive/grove rooms.

| Map | Family/families | Ground fill |
|---|---|---|
| Cedarwatch | fairy-forest | `fairy-forest-tiles` col=6 row=15 (mossy forest floor) |
| Mistwood Path | fairy-forest | `fairy-forest-tiles` col=6 row=15 |
| Elder Forest | fairy-forest | `fairy-forest-tiles` col=6 row=15 |
| Silver River | fairy-forest + general | `general-water-tiles` col=2 row=7 (river) |
| Ancient Cedar Shrine | fairy-forest + garden | `fairy-forest-tiles` col=6 row=15; `garden` added for the shrine's own tended grounds |
| Heartwood Approach | fairy-forest | `fairy-forest-tiles` col=6 row=15 |
| Root Caverns | cave + hideout + sewer | `cave-tiles` col=7 row=13 (rocky brown); `hideout` and `sewer` added for extra dark-underground variety |
| Inner Archive | castle + library | `castle-tiles` col=19 row=18 (brick-red stone floor) |
| Lantern Sanctuary (Heartwood) | castle | `castle-tiles` col=19 row=18 |
| Guardian Grove | castle | `castle-tiles` col=19 row=18 |

**Cedarwatch** (town) - *"A logging and spiritual community among giant trees, timber halls built
into the roots of cedars older than any record."*

**Mistwood Path** (overworld) - *"A narrow trail winding between fog-wrapped trunks, the mist here
thick enough to swallow sound."*

**Elder Forest** (overworld) - *"The oldest stand of trees in Mytherra, canopy so dense the ground
below has forgotten what direct sun feels like."*

**Silver River** (overworld) - *"A cold, clear river cutting through the forest, its far bank lined
with old fishing camps long since abandoned."*

**Ancient Cedar Shrine** (overworld) - *"A shrine grown into the trunk of the Ancient Cedar itself,
its Spirit Seed long since withered."*

**Heartwood Approach** (overworld) - *"The forest thins here, ancient roots breaking the surface
like the ribs of something buried - Heartwood Sanctuary waits below."*

**Root Caverns** (dungeon) - *"A cavern of interlocking roots thick as tree trunks, descending
below the forest floor into the dark."*

**Inner Archive** (dungeon) - *"Shelves grown from living root, most of them bare - what survives
here is only a fragment of what once filled this chamber."*

**Lantern Sanctuary** (dungeon, Heartwood) - *"A round root-walled chamber at the heart of the
sanctuary, where a single lantern has waited, unlit, since long before Cedarwatch had a name."*

**Guardian Grove** (dungeon) - *"A vast open cavern lit by pale root-light, where a shape too large
and too still to be a tree keeps watch."*

## Shattered Desert

The one region with an exact-match pack: **desert** covers the town and every field location.
Dungeon/observatory rooms use **castle** again, matching the "ancient stone architecture" thread
running through every region's dungeons.

| Map | Family/families | Ground fill |
|---|---|---|
| Red Mesa | desert | `desert-ground` col=8 row=12 (brown canyon dirt) |
| Sunfire Dunes | desert | `desert-ground` col=8 row=12 |
| Crimson Canyons | desert + hideout + cave | `desert-ground` col=8 row=12; `hideout` for a bandit-canyon feel, `cave` for extra rock variety |
| Painted Mesas | desert | `desert-ground` col=8 row=12 |
| Celestial Oasis | desert + general | `general-water-tiles` col=2 row=7 (oasis water) |
| Forgotten Observatory Approach | desert | `desert-ground` col=8 row=12 |
| Inner Observatory | castle + library | `castle-tiles` col=19 row=18 (brick-red stone floor); `library` fits its dusty brass-instrument/record-keeping feel |
| Star Chamber | castle + library | `castle-tiles` col=19 row=18; `library` for its faded star-map records |
| Lantern Sanctuary (Observatory) | castle | `castle-tiles` col=19 row=18 |
| Canyon Depths | desert + castle + forge + hideout | `desert-ground` col=8 row=12; `forge` for a molten-rock accent, `hideout` for a bandit-canyon feel |
| Guardian Summit | castle | `castle-tiles` col=19 row=18 |

**Red Mesa** (town) - *"A town built directly into the canyon cliffs, its buildings carved as much
as constructed."*

**Sunfire Dunes** (overworld) - *"Endless rolling dunes, heat shimmering off the sand in waves
visible from a mile off."*

**Crimson Canyons** (overworld) - *"Deep red-rock canyons, narrow enough in places to touch both
walls at once."*

**Painted Mesas** (overworld) - *"Banded cliffs in a dozen colors, layered like the desert itself
kept a written record no one can read anymore."*

**Celestial Oasis** (overworld) - *"A pocket of green and open water, ringed with stones angled
toward the night sky."*

**Forgotten Observatory Approach** (overworld) - *"The dunes thin here, and the ground rises toward
a shape too regular to be a natural formation."*

**Inner Observatory** (dungeon) - *"A vast circular chamber ringed with dead brass instruments,
dust-caked dials still pointed at a sky no one has read in centuries."*

**Star Chamber** (dungeon) - *"A domed room whose ceiling still holds a faint painted map of a sky
that no longer quite matches the one outside."*

**Lantern Sanctuary** (dungeon, Observatory) - *"A round chamber at the heart of the Observatory,
where a single lantern has waited, unlit, since before Red Mesa had a name."*

**Canyon Depths** (dungeon) - *"A crevice deep enough that the sky above narrows to a thin bright
line, the air cool and still."*

**Guardian Summit** (dungeon) - a wide stone platform open to the sky, the Canyon Giant's own watch.

## Frozen Frontier

No standalone snow-specific pack among the 11, but `general-floors-tiles` covers all 4 seasons
(green/summer, tan/spring, brown/fall, and the pale-white tile used here - snow) in one sheet, so
**general** genuinely is the right family for this region, not a substitute. Fields and town use
its snow tile (col=0 row=23). Dungeon rooms use **castle** (a frost-hall reads fine as grand stone
architecture either way).

| Map | Family/families | Ground fill |
|---|---|---|
| Frosthaven | general | `general-floors-tiles` col=0 row=23 (snow - general's 4-seasons ground set) |
| Snowveil Forest | general | `general-floors-tiles` col=0 row=23 |
| Frozen River | general | `general-floors-tiles` col=0 row=23 |
| Glacier Pass | general + cave | `general-floors-tiles` col=0 row=23; `cave` added for the icy rock-wall variety |
| Aurora Basin | general | `general-floors-tiles` col=0 row=23 |
| Hall of Eternal Winter Approach | general | `general-floors-tiles` col=0 row=23 |
| Hall of Eternal Winter | castle | `castle-tiles` col=19 row=18 (brick-red stone floor) |
| Lantern Sanctuary (Hall) | castle | `castle-tiles` col=19 row=18 |
| Guardian Chamber | castle + forge | `castle-tiles` col=19 row=18; `forge` for a dramatic ember/molten accent in the boss room |
| Summit of Winter | castle | `castle-tiles` col=19 row=18 |
| Hall of Memories | castle | `castle-tiles` col=19 row=18 |

**Frosthaven** (town) - *"A fortified settlement beneath the aurora, its walls packed with snow and
its windows warm against the endless winter outside."*

**Snowveil Forest** (overworld) - *"Pines bent white under snow so thick the trail beneath them is
more memory than path."*

**Frozen River** (overworld) - *"A river caught mid-current and held there, its surface a frozen
record of a current that never finished passing."*

**Glacier Pass** (overworld) - *"A narrow cut between walls of blue-white ice, cold enough that
breath hangs in the air like fog that refuses to clear."*

**Aurora Basin** (overworld) - *"A wide snowfield open to the sky, ringed with standing stones
angled toward where the aurora used to burn brightest."*

**Hall of Eternal Winter Approach** (overworld) - *"The snow thins here, scoured off a stone stair
leading up toward a doorway too old for this to be its first winter."*

**Hall of Eternal Winter** (dungeon) - *"A vast frozen hall, its columns rimed thick with frost
that has never once thawed."*

**Lantern Sanctuary** (dungeon, Hall) - *"A round chamber deep in the Hall, where a single lantern
has waited, unlit, since before Frosthaven had a name."*

**Guardian Chamber** (dungeon) - *"A wide chamber lined with carved likenesses of every Guardian
that came before this one, all facing the same direction."*

**Summit of Winter** (dungeon) - an open platform at the Hall's summit, the Winter Stag's own
domain.

**Hall of Memories** (dungeon) - *"A quiet chamber past the Summit, its walls lined with six empty
alcoves, each shaped to hold something that was never returned - until now."* Book One's finale
location.

---

# Interior maps

40 building-interior maps (Ash Hallow, Cedarwatch, Frosthaven, Highwind Crossing, Mirehaven, Red
Mesa - 8-9 buildings each: Inn, Blacksmith, Armory, General Store, and a settlement-specific
building or two). Unlike the non-interior pass above, **these were never redrawn** - `ground`/
`decorations-1`/`overhang-1`/`objects`/`collisions` are all untouched, exactly as originally
built. The only change is additive: 17 more `general-*` tilesets appended to every one of them
(per an explicit ask, not a judgment call), on top of whatever they already had (the shared
`interior-decor`/`retro-interior-*` TopDownHouse base, plus `rpg-icons-2` on Ash Hallow's Armory
and Blacksmith specifically).

## The 17 added tilesets (every interior map, identical set)

`general-anvil`, `general-building-props`, `general-building-walls`, `general-cooking-equipment`,
`general-cooking-station`, `general-esoteric`, `general-farm`, `general-furnace`,
`general-furniture`, `general-interior-props`, `general-interior-walls`, `general-meat`,
`general-props-pan`, `general-props-shadows`, `general-resources`, `general-tools`,
`general-workbench` - static multi-item reference sheets (not the animated station-prop
`structure.*` versions), hand-sliceable in Tiled like any tileset. Covers a lot of interior-prop
ground: forge/anvil work, cooking stations, farm goods, general clutter/tools/furniture - a good
match for exactly the kind of buildings these are (blacksmiths, inns, general stores).

(One correction from the original ask: `general-furnance` doesn't exist - `general-furnace` does,
used instead.)

## Ash Hallow (9)

| Map | Notes |
|---|---|
| The Ash Hallow Inn | Warm beds and a hot meal for ridge-worn travelers. |
| The Ash Hallow Forge | A working forge, its owner past caring whether business is good so long as the fire stays lit. |
| The Ash Hallow Armory | Racks of fitted coats, boots, and gloves - built to outlast the mountain. Also has `rpg-icons-2` from the original build. |
| Ash Hallow Apothecary | Willow's shop. |
| Ash Hallow Archive | Historian Miriam's records. |
| Elias Rowan's House | The mentor's home. |
| Mara's General Store | Ash Hallow's shop. |
| The Mine Office | A cramped office of shift ledgers, all of them for Hollow Rail Mine. |
| Ash Hallow Town Hall | Mayor Eleanor Ashcroft's seat. |

## Cedarwatch (6)

| Map | Notes |
|---|---|
| The Cedarwatch Inn | A timber inn built around a living cedar trunk, its hearth never seems to smoke. |
| The Cedarwatch Forge | Built low and open-walled among the trees. |
| The Cedarwatch Armory | Bark-plated armor and root-woven leggings, built for silent movement. |
| Cedarwatch Elders' Lodge | |
| Cedarwatch General Store | |
| Cedarwatch Great Tree Library | Grown into the roots of an ancient cedar - matches `library`'s own placement in this region's Inner Archive dungeon. |

## Frosthaven (6)

| Map | Notes |
|---|---|
| The Frosthaven Inn | Common room smelling of woodsmoke and melted snow. |
| The Frosthaven Forge | Kept burning around the clock - letting it go cold this far north is its own kind of risk. |
| The Frosthaven Armory | Fur-lined plate and frost-worn leathers. |
| Frosthaven Explorer Headquarters | |
| Frosthaven General Store | |
| Frosthaven Ice Chapel | |

## Highwind Crossing (6)

| Map | Notes |
|---|---|
| The Highwind Inn | Porch facing west to catch the sunset over the grass. |
| The Highwind Forge | Tempering steel against the cold prairie nights. |
| The Highwind Armory | Buffalo-hide coats and windproofed boots, built for the open trail. |
| Highwind Crossing Chief's Lodge | |
| Highwind Crossing General Store | |
| Highwind Crossing Spirit Lodge | |

## Mirehaven (7)

| Map | Notes |
|---|---|
| The Mirehaven Inn | A stilted inn above the water, rooms swaying gently with the current. |
| The Mirehaven Forge | Coals kept hot despite the damp bayou air. |
| The Mirehaven Armory | Moss-treated coats and mire-proofed boots, built to weather the bayou. |
| Mirehaven Archive | |
| Mirehaven General Store | |
| Mirehaven Herbalist | |
| Mirehaven Town Hall | |

## Red Mesa (6)

| Map | Notes |
|---|---|
| The Red Mesa Inn | A cliffside inn carved cool against the desert heat. |
| The Red Mesa Forge | Cut into the canyon rock, tempering steel against desert extremes. |
| The Red Mesa Armory | Sun-worn leathers and sand-scarred plate. |
| Red Mesa Elders' Hall | |
| Red Mesa General Store | |
| Red Mesa Relic Museum | |
