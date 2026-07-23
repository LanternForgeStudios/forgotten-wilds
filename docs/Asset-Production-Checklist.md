# Asset Production Checklist

Every entry below started as `status: 'placeholder'` in `src/assets/registry.ts` (or, for audio, a
newly added placeholder category - see "Audio"); each section now notes which ones have since been
swapped for real art (see each section's own status line/column). Each section describes a
*pattern* once rather than repeating an identical spec per id - look up the exact id list in the
registry when you're ready to swap a specific file in. Swapping a placeholder for final art is
always a one-line edit to that file (`filePath`, `dimensions`, and `status: 'final'`) - no code
changes needed anywhere else.

Every entry also includes a short **generation prompt** - a description written to be handed
directly to an AI image/audio generator, not just a spec. They lean on this game's own established
tone (Forgotten Wilds: a quiet, autumnal Appalachian-mountain fantasy - lantern-keepers, spirit
guardians, an old mining town called Ash Hallow) and each named character's actual in-game role, so
the output should already feel consistent with the world without you having to re-derive that
context yourself.

**Style baseline for all visual prompts**: painterly fantasy illustration, warm muted autumn
palette (rust, ochre, moss green, lantern-gold), soft rim lighting, no background (transparent PNG)
unless noted otherwise. Add this baseline to any prompt below that doesn't already restate it.

## Sizing convention (important - read this first)

Every character/structure sprite placed as a map **object** (NPCs, the player, buildings, the
shrine marker, chests, doors) renders at its own **native pixel size**, scaled only by the ratio
between the current viewport zoom and a fixed reference zoom (`REFERENCE_VIEWPORT_SCALE = 3` in
`src/phaser/ExplorationScene.ts`) - not force-fit to one tile. In practice: **author everything at
the exact pixel dimensions listed below**, and it will appear at that size on a desktop-zoom screen,
automatically scaled proportionally smaller on mobile. This is why every size below is a specific
number, not "about one tile" - get the pixel dimensions right and the proportions across the whole
game stay consistent.

Ground/decoration **tiles** (the Tiled tilesets - grass, dirt, stone floors, walls) are a completely
separate system, authored at a small native tile size (16×16) and blown up by the full viewport
zoom - unaffected by anything above.

---

## Portraits (14 - dialogue box headshots) - all 14 done

**Spec**: 512×512 PNG, painted background (not transparent - fills the dialogue portrait frame),
head-and-shoulders framing, 3/4 or front-facing.

| Character | Role | Generation prompt | Status |
|---|---|---|---|
| Elias Rowan | Lantern Keeper Mentor | Weathered older man, greying beard, worn leather Keeper's coat, holding a lit lantern close to his chest, stern but kind eyes, mountain-town mentor. | Done |
| Finn Rowan | Elias's Nephew | Younger man in his twenties, relaxed posture, lighter/more casual clothing than his uncle, half-smile, holds a lantern oil flask loosely. | Done |
| Mara Ash | General Store Owner | Middle-aged woman, warm practical expression, apron over simple clothes, sleeves rolled up, standing in front of shelves of goods. | Done |
| Silas Flint | Mine Office Foreman | Stocky older man, soot-smudged face, hard hat or miner's cap, thick beard, tired but determined eyes. | Done |
| Juniper Reed | Innkeeper | Cheerful middle-aged woman, apron, warm smile, hair tied back, holding a mug or cloth. | Done |
| Nell Ashby | Folklore Collector | Bookish young woman, spectacles, satchel of notes, curious/intense expression, ink-stained fingers. | Done |
| Aldren Stone | Blacksmith | Broad-shouldered man, forge-scarred forearms, leather apron, soot and sparks nearby, confident stance. | Done |
| Tessa Ironhand | Armorer | Sturdy woman, practical braided hair, inspecting a piece of armor, calloused hands, focused expression. | Done |
| Willow Briar | Apothecary | Slender woman surrounded by dried herbs and small bottles, calm knowing expression, earth-toned clothing. | Done |
| Historian Miriam | Town Historian | Elderly woman, spectacles, surrounded by old books/scrolls, thoughtful and patient expression. | Done |
| Hunter Garrick | Tracker | Rugged outdoorsman, fur-lined cloak, bow or knife at hip, alert eyes, weathered from the trail. | Done |
| Spirit Child | Voice of the Grove | Ethereal pale child-like spirit, faint glow, forest-green and silver tones, slightly translucent, ancient sad eyes. | Done |
| Ranger Caleb | Ridge Scout | Lean scout in mountain gear, cloak, watchful expression, sharp-eyed, cliffside backdrop hint. | Done |
| Mayor Eleanor Ashcroft | Mayor of Ash Hallow | Dignified older woman, formal but weathered town-official attire, a small mayoral pin/sash, composed authoritative expression. | Done |

Originals archived at `public/assets/portraits/original/`; resize/optimize pipeline is
`scripts/resize_portraits.py`.

## NPC overworld sprites (14, 1:1 with portraits above) - all 14 done

**Spec**: **72×96 PNG, transparent background - the same size as the player character**, full-body,
standing idle pose, 3/4-view (not top-down). Single frame for now (per your staged plan - swap this
in first); a 4-direction idle+walk sheet (still 72×96 per frame, laid out the same 4-column ×
8-row grid `sprite.player`'s frameSize already uses) is the later "phase 2" version once more of the
MSQ is built out.

Generation prompt: reuse the matching portrait's prompt above, but as a **full-body figure**, same
outfit/props, standing pose, transparent background, sized/cropped to read clearly at 72×96 (avoid
overly fine detail that would disappear at that resolution).

Originals archived at `public/assets/sprites/characters/original/`; resize/optimize pipeline is
`scripts/resize_npc_sprites.py`.

`sprite.npc.large` (the one deliberately-bigger NPC tier, for anyone who should read as more
imposing than a regular human) becomes **96×120** proportionally - not used by any location yet.

### NPC idle animations (new capability - 1 of 14 done)

Stationary NPCs can now have a real ambient idle loop instead of a single static frame -
`IDLE_ANIMATION_LAYOUT` in `src/animation/characterAnimations.ts` (a single row × 4 frames of
72×96), rendered by `ExplorationScene.ts`'s `upsertEntity`. **Not every NPC needs one** - an NPC
with no idle sheet just keeps showing its plain static frame exactly as before (the code checks
`anims.exists(...)` before ever trying to play one, so there's no risk of a broken animation call
for an NPC that doesn't have this). NPCs always render facing south/down today, so only a
south-facing idle loop is needed - no other directions.

**Done**: Elias Rowan - built from a pixellab.ai animation export (south-facing frames only), same
crop-then-upscale-to-72×96 treatment as the player sheets. Build/re-run pipeline:
`scripts/build_npc_idle_sheet.py`. Note pixellab's own export folder was named "Breathing_Idle" -
the game only ever calls this concept **idle** (`IDLE_ANIMATION_LAYOUT`/`MovementState`), so name
future idle-animation folders/exports however's convenient on the pixellab side; the script maps
whatever folder name to the game's "idle" concept. Original archived at
`public/assets/sprites/characters/original/elias-rowan/`.

**Remaining (13)**: every other NPC still shows a single static frame - add an idle loop for any of
them the same way, whenever art for it exists.

## Player sprite - both skins done (4-direction walk animation)

Both `sprite.player.male` and `sprite.player.female` are now real 8-row × 4-column sheets (72×96
per frame, same row order the old `sprite.player` fallback sheet used: walk-down/left/up/right,
run-down/left/up/right), built from a pixellab.ai export
(`art-staging/characters/{male-player,female-player}/animations/Walking/{south,west,north,east}/
frame_00{0-3}.png`). pixellab only exported a Walking cycle, not a separate Running one, so the
sheet's running rows duplicate the walking rows 1:1 - Dash moves faster but reuses the same
animation rather than a distinct run cycle. Build/re-run pipeline: `scripts/build_player_sheet.py`
(crops each skin's own fixed, hand-measured region before upscaling to 72×96 - see the script's own
comments for the exact numbers). Originals archived under
`public/assets/sprites/characters/original/{male-player,female-player}/`.

pixellab's export also included 8-directional "rotations" (NE/E/SE/S/SW/W/NW) for both skins - not
used, since this game's movement only supports 4 cardinal facings today.

## Enemies (12 regular + 1 boss - battle sprites) - 1 of 13 done

**Spec, regular tier (12)**: 128×128 PNG, transparent background, front-facing "battle stance" pose
(this is what's shown in the combat screen, not an overworld sprite - it's also reused directly as
the roaming overworld/field-encounter icon for that same enemy, see `useFieldEncounters.ts`).
**Boss tier (1)**: 256×256, same conventions, more detailed/imposing.

**Done**: Mothling - built from a pixellab.ai rotation export (only the south/front-facing pose is
used; enemies get no walk/idle animation today, just the one static battle image), cropped to just
the creature before upscaling to 128×128 (skipping the crop would have rendered it far smaller than
intended, since `BattleScene.ts` sizes enemies off the full image width). Build script:
`scripts/build_enemy_sprite.py`. Original archived at
`public/assets/sprites/enemies/original/mothling-south.png`.

Note: these are **not** scaled by the player-proportion rule above - they serve double duty (an
in-battle portrait, using its own separate scaling formula, *and* the overworld "something's
nearby" field-encounter icon, using the object formula). At 128×128 they may already look large
next to the new 72×96 player as a field icon - worth checking visually once you have real art in,
rather than assuming they need to grow to match the buildings/NPCs above.

| Enemy | Family | Generation prompt |
|---|---|---|
| Mothling | Mothlings | Small moth-like spirit creature, dusty grey-brown wings with faint pale glowing patterns, insectoid but not menacing, forest-dweller. |
| Greater Mothling | Mothlings | Larger, more vividly-patterned version of the Mothling, brighter wing-glow, more elaborate wing shape, still insectoid. |
| Restless Miner | Restless Miners | Translucent ghostly miner, tattered work clothes, faint coal-dust aura, hollow sorrowful eyes, holding a spectral pickaxe. |
| Foreman Wraith | Restless Miners | A more authoritative ghostly miner-foreman, sharper posture, faint lantern-glow eyes, tattered foreman's coat. |
| Coal Spirit | Coal Spirits | Small ember-orange spirit made of glowing coal/ash particles, flickering flame-like edges, drifting motion. |
| Coal Wraith | Coal Spirits | Larger, more menacing coal-spirit, deeper red-black coloring, trailing smoke, glowing cracks like embers. |
| Cliff Wolf | Cliff Dwellers | Lean grey mountain wolf, rocky/craggy fur texture, sharp alert stance, cliffside setting. |
| Ridge Hawk | Cliff Dwellers | Sharp mountain hawk, wings flared, sharp talons, wind-swept feathers, aggressive dive posture. |
| Pool Wisp | Water Spirits | Small blue-white water spirit, droplet/ripple form, gentle glow, semi-transparent watery body. |
| Falls Siren | Water Spirits | Ethereal water spirit with a flowing, waterfall-like lower body, pale blue-green skin, haunting beautiful expression. |
| Briar Wraith | Briar Spirits | Thorny, vine-wrapped spirit, dark bramble texture, faint purple-green glow, twisted branch-like limbs. |
| Cemetery Shade | Briar Spirits | Dark, cloaked spirit-shade, faint graveyard-mist texture, hollow glowing eyes, tattered ghostly form. |
| The Coalbound Warden (boss) | Boss | Massive armored coal-and-iron guardian, glowing ember cracks across its body, imposing molten-orange eyes, chains or coal-slag dripping from its form - a corrupted mine guardian. |

## Buildings, shrine, chest, door (1.5x-proportional to the new player size)

**Spec**: PNG, transparent background, painterly rustic mountain-town style matching Ash Hallow
(weathered wood, stone foundations, lantern-lit windows) - see per-row size and a fully-written
generation prompt below, no template filling-in needed.

### Building facades & shrine (10 - 72×72)

A painted building-entrance facade (door + surrounding wall texture) sized to its footprint, one
per building, plus the shrine landmark marker using the same size/conventions.

| Structure | Size | Generation prompt |
|---|---|---|
| House *(Elias Rowan's home)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a modest personal home, a single potted herb by the doorstep. |
| Shop *(Mara Ash's General Store)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - goods crates stacked by the door. |
| Inn *(Ash Hallow Inn)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a hanging inn sign, warm inviting glow from the windows. |
| Blacksmith *(the Ash Hallow Forge)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a visible anvil out front, a chimney with a wisp of smoke. |
| Apothecary *(Willow's Apothecary)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - bundles of dried herbs hanging in the window. |
| Armory *(the Ash Hallow Armory)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a shield-and-weapon emblem carved into the door. |
| Archive *(the Ash Hallow Archive)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - an old stone facade with a carved sigil above the door, deep-set narrow window. |
| Mine Office *(the Ash Hallow Mine Office)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a lantern-post out front and a mining-cart rail running past. |
| Town Hall *(Ash Hallow Town Hall)* | 72×72 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - slightly grander scale than the other buildings, a small bell tower or flag above the door. |
| Shrine *(landmark marker, e.g. Spirit Grove)* | 72×72 | Small weathered stone shrine, moss-covered, half-forgotten, faint spiritual glow, autumn Appalachian fantasy mountain setting - matches "a small stone shrine, half-forgotten" from its in-game flavor text. |

### Chest (2 - 48×48, two distinct states)

| Structure | Size | Generation prompt |
|---|---|---|
| Chest (closed) | 48×48 | Small wooden treasure chest, closed, iron banding and a metal clasp, weathered wood, transparent background, rustic Appalachian fantasy style. |
| Chest (open) | 48×48 | Small wooden treasure chest, lid open, empty dark interior, iron banding, weathered wood, transparent background, rustic Appalachian fantasy style - same chest body/palette as the closed version, not a different label on the same image. |

### Door (1 - 48×96)

| Structure | Size | Generation prompt |
|---|---|---|
| Door *(standalone, not yet placed on any map - stubbed for future use)* | 48×96 | Standalone rustic wooden plank door with iron hinges, weathered, transparent background, matches the Ash Hallow building-facade style above. |

## Icons (52 - inventory/equipment/currency)

**Spec (all tiers)**: PNG, transparent background, single centered object, simple flat-shaded
lighting - these are small UI icons, not illustrations, so avoid busy detail that won't read at
64px (or 32px for currency). Every prompt below already opens with "Simple flat-shaded fantasy
game icon of..." so it's ready to use as-is - no template filling-in needed.

### Items (22 - 64×64: consumables, materials, key items)

| Item | Size | Generation prompt |
|---|---|---|
| Healing Poultice *(shared by all 4 tiers)* | 64×64 | Simple flat-shaded fantasy game icon of a small clay jar of green herbal healing poultice, cloth tied over the top, centered, transparent background. |
| Spirit Draught *(shared by all 4 tiers)* | 64×64 | Simple flat-shaded fantasy game icon of a corked glass bottle of glowing pale starlight-blue liquid, centered, transparent background. |
| Lantern Oil *(shared by all 4 tiers)* | 64×64 | Simple flat-shaded fantasy game icon of a small tin oil flask with a narrow spout, amber lantern oil visible inside, centered, transparent background. |
| Antidote | 64×64 | Simple flat-shaded fantasy game icon of a small dark apothecary vial with a faint sickly-green tint and a cork stopper, centered, transparent background. |
| Burn Salve | 64×64 | Simple flat-shaded fantasy game icon of a small round tin of pale cooling herbal salve, lid slightly ajar, centered, transparent background. |
| Thaw Crystal | 64×64 | Simple flat-shaded fantasy game icon of a warm-glowing orange-red crystal shard with a faint heat shimmer, centered, transparent background. |
| Eye Drops | 64×64 | Simple flat-shaded fantasy game icon of a tiny glass dropper bottle with a clear pale-blue tint, centered, transparent background. |
| Echo Herb | 64×64 | Simple flat-shaded fantasy game icon of a small bundle of dried silver-green leaves tied with twine, centered, transparent background. |
| Moth Dust | 64×64 | Simple flat-shaded fantasy game icon of a small pinch of glittering silver-white dust with a faint sparkle, centered, transparent background. |
| Rusted Token | 64×64 | Simple flat-shaded fantasy game icon of a worn, rust-orange mine-shift coin stamped with a faded number, centered, transparent background. |
| Ember Shard | 64×64 | Simple flat-shaded fantasy game icon of a small jagged coal-black shard with a faintly glowing ember-orange core, centered, transparent background. |
| Wolf Fang | 64×64 | Simple flat-shaded fantasy game icon of a single curved, sharp ivory-white wolf fang, centered, transparent background. |
| Silver Droplet | 64×64 | Simple flat-shaded fantasy game icon of a single perfectly round silver-blue water droplet with a faint glimmer, centered, transparent background. |
| Withered Bramble | 64×64 | Simple flat-shaded fantasy game icon of a twisted knot of dark thorned bramble, faintly frost-touched, centered, transparent background. |
| Stone Fragment *(key item - Guardian Sigil piece)* | 64×64 | Simple flat-shaded fantasy game icon of a pale stone shard etched with a faint glowing sigil, centered, transparent background. |
| Water Fragment *(key item - Guardian Sigil piece)* | 64×64 | Simple flat-shaded fantasy game icon of a curved bead of ever-flowing blue water etched with a faint glowing sigil, centered, transparent background. |
| Wind Fragment *(key item - Guardian Sigil piece)* | 64×64 | Simple flat-shaded fantasy game icon of a wisp of pale-white captured wind swirling inside a small glass shape, faint glowing sigil, centered, transparent background. |
| The Miner's Lost Lantern *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of a battered, dented brass lantern relic with dark soot-stained glass, centered, transparent background. |
| Warden's Ember Heart *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of a molten-orange coal-and-ember heart-shaped core with a faint smoke wisp, centered, transparent background. |
| Guardian Memory Fragment I *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of a translucent pale-green shard holding a faint ghostly glowing memory-image, centered, transparent background. |
| Frostbound Treatise *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of an old leather-bound manuscript rimed with frost, tied shut with cord, centered, transparent background. |
| Ember Codex *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of a scorched, ember-warm leather-bound codex with singed edges, centered, transparent background. |

Note: the tiered potion upgrades (Greater/Superior/Pristine Healing Poultice, Greater/Superior/
Pristine Spirit Draught, Thin/Superior/Pristine Lantern Oil) all reuse their base item's icon
above rather than getting a unique one each - only make separate art for those if you want each
tier to look visually distinct too (not required).

### Ailment status icons (6 - 64×64, combat ailment strip badges)

| Ailment | Size | Generation prompt |
|---|---|---|
| Poison | 64×64 | Simple flat-shaded fantasy game icon badge of a sickly-green skull-and-droplet symbol, centered, transparent background. |
| Burn | 64×64 | Simple flat-shaded fantasy game icon badge of a small orange-red flame symbol, centered, transparent background. |
| Freeze | 64×64 | Simple flat-shaded fantasy game icon badge of a pale-blue snowflake/ice-shard symbol, centered, transparent background. |
| Stun | 64×64 | Simple flat-shaded fantasy game icon badge of small yellow spinning stars/dizzy-swirl symbol, centered, transparent background. |
| Blind | 64×64 | Simple flat-shaded fantasy game icon badge of a grey crossed-out eye symbol, centered, transparent background. |
| Silence | 64×64 | Simple flat-shaded fantasy game icon badge of a muted purple crossed-out sound-wave symbol, centered, transparent background. |

### Equipment (20 - 64×64, across 7 rarity families + 2 unique lanterns)

| Equipment | Size | Generation prompt |
|---|---|---|
| Weathered Walking Staff *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a plain wooden traveling staff worn smooth with age, centered, transparent background. |
| Ironwood Walking Staff *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a heavier dark-wood staff cut from a single length of ironwood, centered, transparent background. |
| Spiritwood Walking Staff *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a pale, faintly glowing living-wood staff with root-like grain, centered, transparent background. |
| Worn Keeper Coat *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a patched, hand-me-down long coat in the Lantern Keeper cut, centered, transparent background. |
| Reinforced Keeper Coat *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a sturdier Keeper coat lined with visible boiled-leather seams, centered, transparent background. |
| Veteran Keeper Coat *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a battle-worn but well-kept Keeper coat with a subtle insignia, centered, transparent background. |
| Traveler Boots *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a plain sturdy pair of leather traveling boots, centered, transparent background. |
| Trail Boots *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a broken-in pair of ridge-trail boots with reinforced soles, centered, transparent background. |
| Ranger Boots *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a light, sure-footed pair of scout's boots, centered, transparent background. |
| Work Gloves *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a plain pair of leather work gloves, centered, transparent background. |
| Leather Gauntlets *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a thicker pair of mine-crew leather gauntlets, centered, transparent background. |
| Keeper's Gauntlets *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of reinforced gauntlets bearing a small Lantern Keeper mark, centered, transparent background. |
| River Stone Charm *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a smooth grey river stone on a simple cord, centered, transparent background. |
| Mountain Knot *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a cord tied in an intricate mountain-traveler knot pattern, centered, transparent background. |
| Ghost Miner's Coin *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a pale, cold mine-shift coin with a faint ghostly glow, centered, transparent background. |
| Lantern of the First Promise *(legendary - standard Keeper lantern)* | 64×64 | Simple flat-shaded fantasy game icon of a warm, steady brass lantern with a small flame inside, centered, transparent background. |
| Lantern of Enduring Embers *(legendary, unique)* | 64×64 | Simple flat-shaded fantasy game icon of a weathered relic lantern with an unnervingly steady ember-orange flame, centered, transparent background. |
| Stone Wolf Totem *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a small wolf figure carved from grey mountain stone, centered, transparent background. |
| Mountain Guardian Totem *(legendary, unique)* | 64×64 | Simple flat-shaded fantasy game icon of a stone totem carved in the likeness of a great bear guardian, centered, transparent background. |
| Traveler's Cloak *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a plain folded wool traveling cloak, centered, transparent background. |

### Currency (4 - 32×32)

| Currency | Size | Generation prompt |
|---|---|---|
| Gold | 32×32 | Simple flat-shaded fantasy game icon of a single gold coin, centered, transparent background. |
| Spirit Essence | 32×32 | Simple flat-shaded fantasy game icon of a small glowing pale-blue spirit-essence orb, centered, transparent background. |
| Festival Tokens *(unused, reserved for future systems - low priority)* | 32×32 | Simple flat-shaded fantasy game icon of a small carved wooden festival token, centered, transparent background. |
| Premium Currency *(unused, reserved for future systems - low priority)* | 32×32 | Simple flat-shaded fantasy game icon of a small faceted gemstone, centered, transparent background. |

## UI (2 - low priority, already serviceable)

Two 48×48 9-slice panel borders (Kenney CC0 "Fantasy UI Borders," already real assets, not
generated placeholders) - fine to leave as-is; only revisit if you want a fully custom UI skin.

## Tilesets (already-uploaded packs - mostly a wiring decision, not new art to commission)

You already have a large library of real, uploaded tileset packs not yet used in any map
(grassland, a "Time Fantasy"-style pack, a Velmora-branded pack, a graveyard set, water/beach/cliff/
path sheets, and more - see the `tileset` category in `src/assets/registry.ts` for the full list
with dimensions). **Before generating new tileset art, look through these first** - most outdoor/
dungeon terrain needs are probably already covered.

(Done: the 14 mislabeled entries that used to live here - `tx-player`, `velmora-slime-animation`,
and the 12 uploaded `npc-N` sheets - have been moved to `sprites/characters/`/`sprites/enemies/`
and re-categorized as `character`/`enemy`. They're available to use directly as NPC/enemy art
whenever you want, under `sprite.tx-player`, `enemy.velmora-slime-animation`, and
`sprite.npc-1`...`sprite.npc-12`.)

---

## Audio - all 7 music + 21 sfx mapped to real files

Every id below now has a real file wired in (`status: 'final'` in `src/assets/registry.ts`),
picked from the audio library staged into `public/assets/audio/library/` (see "Source file"
columns below). **These picks were made by filename/category and duration alone - not personally
auditioned** (no audio playback available while doing this pass), so treat this as a strong
starting point to confirm by ear, not a final call. Swap any of them by pointing that id's
`filePath` at a different file already sitting in the library (or a new one) - same one-line
registry edit either way, no code changes.

The full staged library - everything that was NOT picked, too - is preserved at
`public/assets/audio/library/music/{OGG,WAV}/` and `public/assets/audio/library/sfx/<category>/`
for browsing more options or remapping later. The `Musical Effects` sfx category in particular is
a full 10-instrument-family chime pack (8_bit, brass, grand_piano, harpsichord, music_box,
sitar, steel_drums, synth_bass, vibraphone, xylophone × the same ~11 cue types each) - most picks
below use `grand_piano` as the default "chime" voice for its warm, non-electronic character, with
a few other families used deliberately for distinct-sounding cues (see each row's reasoning).
**Note on sfx filenames**: several came from a generic multi-genre sound pack (Card and Board,
Match Three, Retro, etc. - not touched here) where the filename describes what the sound was
*originally recorded for*, not necessarily this game's use - the picks below stuck to categories
whose names describe the actual sound (Musical Effects, Weapons, Environment, UI, Items, Other).

### Music (7 - looping background beds) - all 7 mapped

**Spec**: mp3 or ogg (much smaller than wav), ~60-120s loop that returns cleanly to its start.
Style baseline: warm, folk-adjacent Appalachian-mountain fantasy instrumentation (acoustic guitar,
fiddle, low strings, occasional soft percussion) - understated, not bombastic, this is a quiet game
about lantern-keepers and small-town life more than grand heroics. All from the same CC-BY 4.0 pack
(FarBeyond Studio - Freebies Vol. 1).

| Track | Generation prompt (original spec) | Mapped source file | Notes |
|---|---|---|---|
| `music.title` | Hopeful, mysterious mountain-folk main theme, slow build. | `Mystic Forest.ogg` | 60s, in-spec. Confident pick. |
| `music.town` | Warm, cozy small-town theme, gentle acoustic guitar, relaxed tempo. | `Enchanted Woods.ogg` | 85s, in-spec. Confident pick. |
| `music.overworld` | Adventurous but understated exploration theme, walking tempo. | `Tiefsee.ogg` | 155s (longest track - good for a bed heard continuously). Title means "deep sea" in German, doesn't literally match a mountain trail - **weakest thematic fit, picked mainly for its length; listen through first.** |
| `music.dungeon` | Tense, echoing mine-tunnel theme, claustrophobic not horror. | `Winter Ruins.ogg` | 63s, in-spec. "Ruins" fits well. Confident pick. |
| `music.combat` | Energetic but restrained battle theme. | `Suspense.wav` | 48s, a bit short. **No ogg was staged for this track - shipped as wav (8.1MB); ask for an ogg export if this stays the pick.** |
| `music.combat-boss` | Heavier, more dramatic boss theme. | `Fight The Devil.ogg` | 41s, short for a long fight but a strong thematic match. |
| `music.defeat` | Quiet, melancholy recovery theme, comforting not punishing. | `Sneaky.wav` | Only 19s - well short of the 60-120s spec, and "sneaky" doesn't obviously read as melancholy. Picked because the post-defeat screen is brief enough that a short loop matters less here. **Weakest pick overall - no ogg staged either (6.5MB wav); revisit both the track and the format.** |

### Sound effects (21 - short one-shots) - all 21 mapped

**Spec**: mp3, ogg, or wav all fine at this length (~0.15-1s each). Style baseline: soft, tactile,
non-electronic (wood, cloth, metal, water, breath) - matches the game's grounded folk-fantasy tone
rather than a synth-heavy arcade feel.

| Cue | Fires when | Generation prompt (original spec) | Mapped source file | Reasoning |
|---|---|---|---|---|
| `sfx.ui-close` | Any overlay/modal closes | Soft, short UI dismiss click. | `UI/click_double_off.wav` | Neutral close click, not a "reject" sound. |
| `sfx.ui-error` | A rejected action | Low, brief "denied" buzz. | `Musical Effects/grand_piano_negative_quick.wav` | Warm instrument stinger instead of the pack's synth/sci-fi error buzzes - fits the folk tone better. |
| `sfx.purchase` | Successful shop purchase | Coin-purse jingle, bright and quick. | `Items/coin_jingle_small.wav` | Literal match. |
| `sfx.sell` | Successful shop sale | Distinct "gold received" chime. | `Items/coin_collect.wav` | Different character from purchase's jingle, per spec. |
| `sfx.rest` | Successful Inn rest | Gentle, warm ascending chime. | `Musical Effects/grand_piano_inn.wav` | Literally named "inn." |
| `sfx.equip` | Equip/unequip an item | Soft metallic/leather click. | `Weapons/weapon_equip_short.wav` | Direct match. |
| `sfx.item-use` | Using a consumable | Soft pop/fizz. | `UI/pop_2.wav` | One of 4 near-identical takes staged (`pop_1`-`4`) - easy to swap. |
| `sfx.craft-success` | Successful crafting | Bright ascending 3-note flourish. | `Musical Effects/grand_piano_chime_positive.wav` | Same chime family as the other economy cues. |
| `sfx.chest-open` | Opening a new chest | Wooden creak + soft treasure chime. | `Environment/creaky_door_short.wav` | Took the literal "creak" half rather than another chime, so chests don't sound like every other reward cue. |
| `sfx.shrine` | Interacting with a shrine | Soft resonant bell/chime swell. | `Musical Effects/vibraphone_mystery.wav` | Vibraphone (not the piano default) for its bell-like resonance. |
| `sfx.npc-talk` | Opening NPC dialogue | Gentle notification blip. | `Musical Effects/xylophone_chime_quick.wav` | Bright, distinct from the other chime families used elsewhere. |
| `sfx.transition` | Crossing a location transition | Soft whoosh. | `Other/whoosh_1.wav` | Literal match; `whoosh_2.wav` is an untried alternate. |
| `sfx.combat-hit` | A combat round lands a hit | Sharp, grounded impact thud. | `Weapons/harsh_thud.wav` | Generic enough for any weapon type. |
| `sfx.enemy-defeated` | An enemy is defeated | Short descending "dissipating" burst. | `Other/ghost_long.wav` | A literal "ghost" cue fits this world's spirit-guardian theme better than the pack's retro power-down stingers. |
| `sfx.victory` | Winning a battle | Bright ascending fanfare arpeggio. | `Musical Effects/grand_piano_level_complete.wav` | "Level complete" maps directly onto winning. |
| `sfx.level-up` | Leveling up after victory | More triumphant than the victory cue. | `Musical Effects/grand_piano_positive_long.wav` | Bigger/longer than victory's chime, per spec. |
| `sfx.defeat` | Losing a battle | Soft descending minor cue. | `Musical Effects/grand_piano_defeated.wav` | Literally named "defeated." |
| `sfx.quest-started` | A quest becomes active | Lightest of the 3 quest-chime tiers. | `Musical Effects/music_box_chime_quick.wav` | Music box is the dedicated family for all 3 quest tiers - kept distinct from the economy (piano) and npc-talk (xylophone) families. |
| `sfx.quest-progress` | A quest's objective advances | Middle quest-chime tier. | `Musical Effects/music_box_chime_positive.wav` | Fuller than quest-started, same family. |
| `sfx.quest-completed` | A quest is fully completed | Most celebratory quest-chime tier. | `Musical Effects/music_box_level_complete.wav` | Fullest/most resolved of the 3, same family. |
| `sfx.social-ping` | Friend/message/trade update arrives | Notification ping, distinct from quest chimes. | `Musical Effects/harpsichord_chime_quick.wav` | Its own family so it's never mistaken for a quest/economy/dialogue chime. |
