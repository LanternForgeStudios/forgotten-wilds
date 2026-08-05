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
| Ranger Caleb | Ridge Scout | Lean Black man, dark brown skin, mountain gear, cloak, watchful expression, sharp-eyed, cliffside backdrop hint. | Done |
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

### NPC idle animations (new capability - all 14 done)

Stationary NPCs can now have a real ambient idle loop instead of a single static frame -
`animationLayoutForSprite` in `src/animation/characterAnimations.ts` (a single row, 72×96 per
frame), rendered by `ExplorationScene.ts`'s `upsertEntity`. **Not every NPC needs one** - an NPC
with no idle sheet just keeps showing its plain static frame exactly as before (the code checks
`anims.exists(...)` before ever trying to play one, so there's no risk of a broken animation call
for an NPC that doesn't have this). NPCs always render facing south/down today when stationary, so
only a south-facing idle loop is needed for them - no other directions. Frame count is derived from
the sheet's own `dimensions.width / frameSize.width` rather than assumed - NPC idle loops staged so
far have all been 4 frames, but this isn't hardcoded (the enemy battle-idle sheets below turned out
to be 8, and frame count "just working" either way is why).

**Done, all 14**: Elias Rowan, Finn Rowan, Mara Ash, Silas Flint, Juniper Reed, Aldren Stone, Tessa
Ironhand, Willow Briar, Historian Miriam, Mayor Eleanor Ashcroft (idle-only), plus Nell Ashby,
Hunter Garrick, Spirit Child, Ranger Caleb (idle **and** walking - see below). The first four were
originally built via the manual pixellab.ai website export workflow, before pixellab MCP access
was added mid-project - all four were later regenerated through the MCP server (`create_character`
+ `animate_character`) as well, since the website-workflow art didn't visually match the
consistent style the MCP-generated NPCs share. Every superseded website-workflow source is kept,
not deleted, at `public/assets/sprites/characters/original/{slug}-website-v1/`. Every NPC from
here on is MCP-generated - same visual pipeline as the website workflow either way (south-facing
frames only for idle-only NPCs, cropped-then-upscaled-to-72×96). Build/re-run pipeline:
`scripts/build_npc_idle_sheet.py` (idle-only NPCs) / `scripts/build_npc_walk_sheet.py` (wandering
NPCs, see below). Note pixellab's own export folder name for the idle animation varies
("Breathing_Idle" for the website workflow, "animating" - or "animating-<group-id>" when a
character has two animation groups - for the MCP) - the game only
ever calls this concept **idle** (`MovementState`/`animationLayoutForSprite`), so the scripts map
whatever folder name/shape to that concept rather than assuming one. Every NPC's originals are
archived at `public/assets/sprites/characters/original/{slug}/`.

**Wandering NPCs (new capability)**: Nell Ashby, Hunter Garrick, Spirit Child, and Ranger Caleb
actually move around their map area (`wanderRadius` on their map object, driven by
`useWanderingNpcs.ts`'s random-step timer - see `public/assets/maps/{ash-hallow,ironwood-trail,
raven-ridge}.json`), and so need a real walk-cycle animation in addition to idle, not just idle
alone. Sprite sheet shape: `NPC_WALK_ANIMATION_LAYOUT` in `characterAnimations.ts`, a fixed 5-row ×
4-frame sheet (row 0 idle-down, rows 1-4 walking down/left/up/right), built by
`scripts/build_npc_walk_sheet.py` - a single shared crop box per NPC across all 5 pose sets (a
walking sideways silhouette differs from standing still facing down, so the box has to
accommodate both). `GridEntity` gained a `facing` field and `upsertEntity` a corresponding fix
(previously hardcoded to always face 'down' when playing a walking animation - dead code until a
wandering NPC actually exercised it) so a wandering NPC's walk-cycle faces the direction it's
actually moving. Spirit Child's first generation attempt used default proportions and read as a
generic adult rather than a "child spirit" - regenerated with the `chibi` proportions preset and a
description leaning harder into the glow/translucence, which fixed it.

## Player sprite - both skins done (4-direction walk + run animation)

Both `sprite.player.male` and `sprite.player.female` are now real 8-row × 4-column sheets (72×96
per frame, same row order the old `sprite.player` fallback sheet used: walk-down/left/up/right,
run-down/left/up/right), built from a pixellab.ai export - a Walking cycle first
(`art-staging/characters/{male-player,female-player}/animations/Walking/{south,west,north,east}/
frame_00{0-3}.png`), then a real Running cycle added in a follow-up batch
(`animations/Running/...`, same shape) so Dash now has its own distinct run animation instead of
reusing the walk cycle. Build/re-run pipeline: `scripts/build_player_sheet.py` (crops each skin's
own fixed, hand-measured region before upscaling to 72×96 - see the script's own comments for the
exact numbers; also handles a Running-only follow-up batch by updating just rows 4-7 of an
already-built sheet). Originals archived under
`public/assets/sprites/characters/original/{male-player,female-player}/`.

pixellab's export also included 8-directional "rotations" (NE/E/SE/S/SW/W/NW) for both skins - not
used, since this game's movement only supports 4 cardinal facings today.

## Enemies (12 regular + 1 boss - battle sprites) - all 13 done

**Spec, regular tier (12)**: 128×128 PNG, transparent background, front-facing "battle stance" pose
(this is what's shown in the combat screen, not an overworld sprite - it's also reused directly as
the roaming overworld/field-encounter icon for that same enemy, see `useFieldEncounters.ts`).
**Boss tier (1)**: 256×256, same conventions, more detailed/imposing.

**New: enemies can have a real "fight stance" idle animation now** (single row × N frames of
128×128 - frame count varies per enemy, pixellab gave these four 8 frames each; the code derives
frame count from the sheet's own dimensions rather than assuming a fixed number). One and the same
sheet is used both as the battle sprite (`BattleScene.ts`) and the overworld field-encounter icon
(`ExplorationScene.ts`'s `upsertEntity`) - both play it via the same shared
`animationLayoutForSprite` machinery, no per-scene wiring needed. An enemy with no idle sheet just
shows a single static frame exactly as before - this is opt-in per enemy, not a requirement. Stage
a new enemy's pixellab export under `art-staging/enemies/{slug}/` (the four done so far were
staged under `art-staging/characters/` before enemies got their own folder - the build script
checks both locations). Build script: `scripts/build_enemy_idle_sheet.py`.

**Done**: all 13 - Mothling, Greater Mothling, Restless Miner, Foreman Wraith, Coal Spirit, Coal
Wraith, Cliff Wolf, Ridge Hawk, Pool Wisp, Falls Siren, Briar Wraith, Cemetery Shade, The
Coalbound Warden (boss, 256×256) - all built from a pixellab.ai idle animation export (only the
south/front-facing set is used, cropped to just the creature/figure per-enemy before upscaling to
128×128/256×256 - skipping the crop would have rendered them far smaller than intended, since
`BattleScene.ts` sizes an animated sprite off its own frame size). Cliff Wolf's export used a plain
`Idle` folder rather than `Fight_Stance_Idle` like every other enemy - the build script
auto-detects the animation folder name rather than assuming it, since pixellab's own naming isn't
consistent. Full pixellab exports (including the unused 8-directional rotations) archived at
`public/assets/sprites/enemies/original/{slug}/`.

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

### Building facades & shrine (10 - 144×144) - all 10 done

A painted building-entrance facade (door + surrounding wall texture) sized to its footprint, one
per building, plus the shrine landmark marker using the same size/conventions.

| Structure | Size | Generation prompt |
|---|---|---|
| House *(Elias Rowan's home)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a modest personal home, a single potted herb by the doorstep. |
| Shop *(Mara Ash's General Store)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - goods crates stacked by the door. |
| Inn *(Ash Hallow Inn)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a hanging inn sign, warm inviting glow from the windows. |
| Blacksmith *(the Ash Hallow Forge)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a visible anvil out front, a chimney with a wisp of smoke. |
| Apothecary *(Willow's Apothecary)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - bundles of dried herbs hanging in the window. |
| Armory *(the Ash Hallow Armory)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a shield-and-weapon emblem carved into the door. |
| Archive *(the Ash Hallow Archive)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - an old stone facade with a carved sigil above the door, deep-set narrow window. |
| Mine Office *(the Ash Hallow Mine Office)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - a lantern-post out front and a mining-cart rail running past. |
| Town Hall *(Ash Hallow Town Hall)* | 144×144 | Small rustic mountain-town building facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn Appalachian fantasy town - slightly grander scale than the other buildings, a small bell tower or flag above the door. |
| Shrine *(landmark marker, e.g. Spirit Grove)* | 144×144 | Small weathered stone shrine, moss-covered, half-forgotten, faint spiritual glow, autumn Appalachian fantasy mountain setting - matches "a small stone shrine, half-forgotten" from its in-game flavor text. |

### Chest (2 - 48×48, two distinct states) - both done

Built via the pixellab MCP's character-style "object" pipeline (`create_1_direction_object` +
`animate_object` + `create_object_state`) rather than `create_map_object` (used for every icon
above) - only `create_1_direction_object`/`create_8_direction_object` outputs are real, persistent
"objects" that `animate_object` can act on; `create_map_object` outputs are single-shot static
images with no animation capability. Closed: `create_1_direction_object` at 128×128 (a cheap
4-candidate review batch - picked the one with the most visible glowing seams), then
`animate_object` (v3 mode, "gently pulsing warm golden magical glow" description, 9 frames) so the
chest is visibly glowing/discoverable on the map - the same generic single-row idle-animation
mechanism every enemy/wandering-NPC sheet already uses, so **no new game code was needed**, just a
registry entry with `frameSize` set. Open: a `create_object_state` variant of the *same* closed-
chest object (not an independent generation) so both states share the same body/palette. Build
script: `scripts/build_chest.py`. 128×128 originals archived at
`public/assets/sprites/structures/original/{chest-closed,chest-open}`.

| Structure | Size | Generation prompt |
|---|---|---|
| Chest (closed) | 48×48 | Small wooden treasure chest, closed, iron banding and a metal clasp, weathered wood, transparent background, rustic Appalachian fantasy style. |
| Chest (open) | 48×48 | Small wooden treasure chest, lid open, empty dark interior, iron banding, weathered wood, transparent background, rustic Appalachian fantasy style - same chest body/palette as the closed version, not a different label on the same image. |

### Door (1 - 48×96)

| Structure | Size | Generation prompt |
|---|---|---|
| Door *(standalone, not yet placed on any map - stubbed for future use)* | 48×96 | Standalone rustic wooden plank door with iron hinges, weathered, transparent background, matches the Ash Hallow building-facade style above. |

## Icons (56 - inventory/equipment/currency)

**Spec (all tiers)**: PNG, transparent background, single centered object, simple flat-shaded
lighting - these are small UI icons, not illustrations, so avoid busy detail that won't read at
64px (or 32px for currency). Every prompt below already opens with "Simple flat-shaded fantasy
game icon of..." so it's ready to use as-is - no template filling-in needed.

**Generate at 128×128, not the in-game size** - every icon table below lists a "Final" size (64×64,
or 32×32 for currency) that's what actually ends up in the registry/in-game, but the source
generation prompt should target 128×128 regardless. The build/processing step downscales
128×128 → the Final size for the live asset, and archives the full 128×128 original alongside it
(same "keep the source, archive it, build the final from it" pattern every other asset category
in this doc already follows - see e.g. the building-facade pipeline's `original/` folder). The
point: if the in-game size ever needs to change again later (as already happened once with the
building facades, 72×72 → 144×144), there's a real 128×128 source to re-resize from instead of
needing to regenerate the art from scratch. All 56 are now built (`status: 'final'` in the
registry) - see each subsection below for generation notes.

### Items (22 - generate 128×128, final 64×64: consumables, materials, key items) - all 22 done

Same pixellab MCP `create_map_object` pipeline as Currency/Ailments above. Two needed a re-prompt:
**Spirit Essence-style droplet-vs-sphere confusion did not repeat here** - Silver Droplet's own
prompt asks for a droplet shape and correctly got one on the first try, unlike Currency's Spirit
Essence (which needed to explicitly avoid a droplet). **Guardian Memory Fragment I** first came
back as a cute rounded ghost/blob character rather than a "shard" - re-prompted with an explicit
"angular crystal shard (faceted gem shape, not round)" fixed it. Everything else matched its
prompt cleanly on the first attempt.

| Item | Final Size | Generation prompt |
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

### Ailment status icons (6 - generate 128×128, final 64×64, combat ailment strip badges) - all 6 done

Same pixellab MCP `create_map_object` pipeline as Currency above. Two needed a re-prompt: **Blind**
first came back as just a crossed-out grey circle with no eye at all (ambiguous with a generic
"disabled" badge) - explicitly asking for a "clearly visible eye shape (eyelid and iris)" fixed it.
**Silence** first came back as an active, uncrossed sound-wave/equalizer symbol - reading as the
opposite of what was wanted - re-prompted with an explicit "bold diagonal red slash line crossing
directly over it" fixed it. **Stun** came back as a single star rather than the requested "spinning
stars" (plural) - accepted as-is, since a single star still reads clearly as a dazed/stun symbol on
its own.

| Ailment | Final Size | Generation prompt |
|---|---|---|
| Poison | 64×64 | Simple flat-shaded fantasy game icon badge of a sickly-green skull-and-droplet symbol, centered, transparent background. |
| Burn | 64×64 | Simple flat-shaded fantasy game icon badge of a small orange-red flame symbol, centered, transparent background. |
| Freeze | 64×64 | Simple flat-shaded fantasy game icon badge of a pale-blue snowflake/ice-shard symbol, centered, transparent background. |
| Stun | 64×64 | Simple flat-shaded fantasy game icon badge of small yellow spinning stars/dizzy-swirl symbol, centered, transparent background. |
| Blind | 64×64 | Simple flat-shaded fantasy game icon badge of a grey crossed-out eye symbol, centered, transparent background. |
| Silence | 64×64 | Simple flat-shaded fantasy game icon badge of a muted purple crossed-out sound-wave symbol, centered, transparent background. |

### Equipment (24 - generate 128×128, final 64×64, across 8 rarity families + 2 unique lanterns) - all 24 done

Same pixellab MCP `create_map_object` pipeline as the sections above. All 20 of the original batch
matched their prompts cleanly on the first attempt except **Ghost Miner's Coin**, which came back
as a generic old coin/medallion (human-profile bust, stars) rather than anything distinctly
"ghost"-themed or glowing - accepted as-is since it still reads clearly as an old coin/token, the
core concept. The 4 Legs items added alongside the Armor→Chest rename/Legs-slot addition (Traveler's
Pants, Worn/Reinforced/Veteran Keeper Trousers) also matched cleanly on the first attempt.

| Equipment | Final Size | Generation prompt |
|---|---|---|
| Weathered Walking Staff *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a plain wooden traveling staff worn smooth with age, centered, transparent background. |
| Ironwood Walking Staff *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a heavier dark-wood staff cut from a single length of ironwood, centered, transparent background. |
| Spiritwood Walking Staff *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a pale, faintly glowing living-wood staff with root-like grain, centered, transparent background. |
| Worn Keeper Coat *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a patched, hand-me-down long coat in the Lantern Keeper cut, centered, transparent background. |
| Reinforced Keeper Coat *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a sturdier Keeper coat lined with visible boiled-leather seams, centered, transparent background. |
| Veteran Keeper Coat *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a battle-worn but well-kept Keeper coat with a subtle insignia, centered, transparent background. |
| Worn Keeper Trousers *(common, legs)* | 64×64 | Simple flat-shaded fantasy game icon of patched, hand-me-down trousers in the Lantern Keeper cut, centered, transparent background. |
| Reinforced Keeper Trousers *(uncommon, legs)* | 64×64 | Simple flat-shaded fantasy game icon of sturdier Keeper trousers lined with visible boiled-leather seams at the knee, centered, transparent background. |
| Veteran Keeper Trousers *(rare, legs)* | 64×64 | Simple flat-shaded fantasy game icon of battle-worn but well-kept Keeper trousers with a subtle insignia patch, centered, transparent background. |
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
| Traveler's Pants *(common, legs)* | 64×64 | Simple flat-shaded fantasy game icon of a plain folded wool traveling trousers, centered, transparent background. |

### Currency (4 - generate 128×128, final 32×32) - all 4 done

Built via the pixellab MCP's `create_map_object` (not `create_character`/`create_1_direction_object`
- see the top-level icon spec note above for why: cheap, single-image, no rotation needed).
Settings that worked well: `view="high top-down"`, `shading="basic shading"`,
`outline="single color outline"` - `view="side"` (tried first, on Gold) produced an unrecognizable
abstract shape, not a coin. Build script: `scripts/build_icon.py` (downscales 128×128 → final size
with LANCZOS, archives the 128×128 original to `public/assets/icons/original/`).

Two prompts needed real iteration beyond the table below to get a usable result - worth knowing
for the remaining icon categories: **Gold** first came back as a literal Bitcoin-style coin (a "B"
symbol) when the prompt just said "gold coin" - re-prompted as an explicit "medieval fantasy gold
coin with a sun emblem, no letters or text" to avoid the association. **Spirit Essence** asked for
a "glowing orb" and got a water-droplet shape twice in a row (which would have read as near-
identical to the separate Silver Droplet item icon planned below) - only reprompting as an
explicitly non-liquid "solid marble sphere...no water, no droplet, round like a ball bearing"
finally produced an actual round ball.

| Currency | Final Size | Generation prompt |
|---|---|---|
| Gold | 32×32 | Simple flat-shaded fantasy game icon of a single gold coin, centered, transparent background. |
| Spirit Essence | 32×32 | Simple flat-shaded fantasy game icon of a small glowing pale-blue spirit-essence orb, centered, transparent background. |
| Festival Tokens *(unused, reserved for future systems - low priority)* | 32×32 | Simple flat-shaded fantasy game icon of a small carved wooden festival token, centered, transparent background. |
| Premium Currency *(unused, reserved for future systems - low priority)* | 32×32 | Simple flat-shaded fantasy game icon of a small faceted gemstone, centered, transparent background. |

## Equipment weapon-layer sprites (done - founders hand-corrected, siblings palette-swapped)

The 4 new universal weapon-type founders (docs/Mytherra-Equipment_breakdown.md's "Weapon Types"
section) got a first-pass equipment-layer sheet via `scripts/estimate_transform_equipment_layer.py`
(reference: `ironwood-walking-staff`), then the user hand-touched-up/corrected all 4 items' sheets
directly (walking + running rows) - see git history around 2026-08-03 for the full pipeline
(estimate-transform → user correction → anchor re-recording → palette-swap rollout).

**Status: all 24 weapon items (4 founders + 20 region-flavored siblings, both genders) now have
real layer art and are wired into `src/data/equipment.ts` via `layerSpriteAssetId`.**

- **4 founders** (`weathered-iron-sword`, `miners-pick`, `ashwood-spear`, `miners-mallet`):
  hand-corrected by the user as full 8-row sheets (both genders). Anchor data re-recorded from the
  corrected sheets via `scripts/record_anchor_from_sheet.py`.
- **20 region-flavored siblings** (Iron Mountains' Uncommon/Rare tiers + all 3 of Crimson Bayou's
  own tiers, across all 4 types): auto-derived via `scripts/palette_swap_equipment_layer.py`
  (recolored from their type's corrected founder, both genders) - inherits the founder's
  hand-positioning and full running coverage, only the surface color differs. **Not individually
  hand-verified** - the palette-swap technique has a solid track record in this project
  (weathered-walking-staff family, cypress-cane family) but spot-check a few in-game if anything
  looks visually off, especially higher-saturation Rare-tier recolors (e.g. `ghostbreaker-
  warhammer`'s glowing pale-blue rune effect, `serpent-fang-sword`'s bone-white hilt).

(`ashwood-spear-female-animated.png`'s file timestamp didn't change alongside the other 7 founder
sheets in the same hand-edit batch - flagged and checked with the user, who confirmed the original
estimate-transform output already looked good as-is and didn't need a hand-correction pass. Not an
issue.)

## UI (2 - low priority, already serviceable)

Two 48×48 9-slice panel borders (Kenney CC0 "Fantasy UI Borders," already real assets, not
generated placeholders) - fine to leave as-is; only revisit if you want a fully custom UI skin.

## Tilesets

### pixellab-generated terrain/decoration/overhang sets (10 - all done, wired into maps)

Real, license-clean tilesets generated via pixellab MCP for the game's 3 location kinds, replacing
the need to lean on the uploaded packs below (most of which carry a "provenance unconfirmed"
caveat - not safe to ship as final without clearing that up first). Each location kind gets a
terrain autotile set (`create_topdown_tileset`, a 4x4 Wang set - grass/dirt/water transitions with
clean hand-paintable edges), a decorations set (`create_tiles_pro`, 16 independent prop-tile
variations), and an overhang set (same tool, tree canopy/roof/ceiling pieces rendered above the
player). Dungeon additionally gets a full `create_building_kit` floor+wall+door+pillar+stairs
architecture set instead of a plain terrain autotile, since an interior needs real walls, not a
ground transition.

| Tileset | Tiles | Generation |
|---|---|---|
| `tileset.town-terrain` | 16 (4x4 Wang) | `create_topdown_tileset`: packed dirt path → mowed grass |
| `tileset.town-decor` | 16 | `create_tiles_pro`: wildflowers, fallen leaves, path pebbles, cracked dirt, tall grass, plank fragment |
| `tileset.town-overhang` | 16 | `create_tiles_pro`: autumn tree canopy (center/edge/corner), weathered roof eave |
| `tileset.overworld-terrain` | 16 (4x4 Wang) | `create_topdown_tileset`: rocky dirt trail → wild mountain grass |
| `tileset.overworld-water` | 16 (4x4 Wang) | `create_topdown_tileset`: stream water → grass, wet mossy rock transition |
| `tileset.overworld-decor` | 16 | `create_tiles_pro`: mossy boulders, fallen log, mushrooms, ferns, wildflowers, rocks |
| `tileset.overworld-overhang` | 16 | `create_tiles_pro`: dense forest canopy (center/edge/corner), hanging moss/vine |
| `tileset.dungeon-building-kit` | 56 | `create_building_kit`: rough stone mine wall + timber beams, packed dirt/stone floor with rail marks - floor/walls/doorways/corners/pillar/stairs/partitions (legend: `public/assets/tilesets/original/dungeon-building-kit/placement-rules.json`) |
| `tileset.dungeon-decor` | 16 | `create_tiles_pro`: rubble, rusted rail segment, puddle, cracked floor, pickaxe fragment, crate |
| `tileset.dungeon-overhang` | 16 | `create_tiles_pro`: wooden support beams, hanging chain/lantern hook, rocky ceiling outcrop/arch |

Wired as additional embedded tilesets (own `tilesetAssetId` property, per "Multiple tilesets per
map" in `docs/Tiled-Map-Authoring.md`) onto: `ash-hallow` (town set), `ironwood-trail`/
`raven-ridge`/`black-briar-forest` (overworld set), `whisper-falls` (overworld set + water), and
`hollow-rail-mine` + all 9 Ash Hallow building interiors (dungeon set). Available to pick from
immediately when any of those maps is opened in Tiled - not pre-painted onto any layer, since
that's a hand-authoring step. Build script: `scripts/build_tilesets.py` (tile-grid assembly from
the raw pixellab exports) + `scripts/wire_new_tilesets.py` (map-JSON wiring, safe to re-run).

### Already-uploaded packs (mostly a wiring decision if you ever need them, not new art to commission)

You also already have a large library of real, uploaded tileset packs not yet used in any map
(grassland, a "Time Fantasy"-style pack, a Velmora-branded pack, a graveyard set, water/beach/cliff/
path sheets, and more - see the `tileset` category in `src/assets/registry.ts` for the full list
with dimensions). Most carry a "provenance unconfirmed, verify license before shipping as final"
note - the pixellab-generated sets above sidestep that entirely, so treat this library as a
fallback for one-off needs (e.g. `tileset.graveyard-set`, already in use by `black-briar-forest`)
rather than the default.

(Done: the 14 mislabeled entries that used to live here - `tx-player`, `velmora-slime-animation`,
and the 12 uploaded `npc-N` sheets - have been moved to `sprites/characters/`/`sprites/enemies/`
and re-categorized as `character`/`enemy`. They're available to use directly as NPC/enemy art
whenever you want, under `sprite.tx-player`, `enemy.velmora-slime-animation`, and
`sprite.npc-1`...`sprite.npc-12`.)

---

## Endless Prairie (Volume III, Chapter 5) - outstanding placeholders

**Status (2026-08-04): PixelLab ran out of generation quota mid-build (23/2000 left, not even
enough for one portrait) and won't refresh for a few days.** Rather than block, every item below
shipped as a procedurally-generated SVG placeholder (`scripts/gen_placeholder_svg.py` - colored
gradient panel + short label, `status: 'placeholder'` in the registry, zero PixelLab cost) so
content buildout could keep moving. This section is the backlog: swap each placeholder for real art
whenever quota is available again, using the generation prompts below (same "Simple flat-shaded
fantasy game icon of..." / character-description conventions as every other section in this doc).
None of this content is player-reachable yet (Highwind Crossing has no incoming transition from the
rest of the world), so there's no urgency - do it whenever convenient.

4 NPCs (Chief Aiyana, Elder Koda, Niska, Prairie Spirit) already have **real** PixelLab overworld
sprites (idle-only; see `feedback_region_build_workflow` memory on Niska's walk-cycle frame-count
mismatch) - only their portraits are still placeholders. The other 4 (the shop NPCs) have no real
art at all yet, sprite or portrait.

### NPC portraits (8 - 512×512, painted background, head-and-shoulders)

| Character | Role | Generation prompt |
|---|---|---|
| Chief Aiyana Whitefeather | Chief of Highwind Crossing | Weathered woman with quiet authority, traditional feathered headdress, richly patterned leather regalia, composed confident expression, plains-chief bearing. |
| Elder Koda Running Elk | Keeper of the Prairie's Memory | Elderly figure, long grey hair, deerskin robes with woven geometric patterns, surrounded faintly by carved-stone motifs, thoughtful patient expression. |
| Niska | Prairie Scout | Young lean scout, practical leather riding gear, bow at her back, alert weather-worn eyes, windswept hair. |
| Prairie Spirit | Guardian spirit of Sacred Hills | Ethereal wind-woven spirit, pale golden-white flowing form like windblown grass given shape, faintly glowing, ancient watchful presence. |
| Innkeeper Hattie | The Highwind Inn | Warm middle-aged woman, apron over practical prairie clothing, welcoming tired smile, holding a cloth or mug. |
| Storekeeper Wyatt | Highwind Crossing's General Store | Practical older man, simple travel-worn vest, standing before shelves of trail goods, easy trader's smile. |
| Blacksmith Garrett | The Highwind Forge | Broad-shouldered forge-scarred man, leather apron, soot-streaked forearms, confident stance near an anvil. |
| Armorer Ruth | The Highwind Armory | Sturdy practical woman, inspecting a piece of buffalo-hide armor, calloused hands, focused expression. |

### NPC overworld sprites (4 shop NPCs only - 72×96, transparent background, full-body idle pose)

Same character description as the matching portrait above, full-body standing pose instead of
head-and-shoulders. Chief Aiyana/Elder Koda/Niska/Prairie Spirit don't need this - real idle sprites
already exist (`sprite.npc.chief-aiyana-whitefeather` etc.).

| Character | Generation prompt |
|---|---|
| Innkeeper Hattie | Full-body version of her portrait prompt above, standing idle pose, transparent background, sized/cropped to read clearly at 72×96. |
| Storekeeper Wyatt | Full-body version of his portrait prompt above, standing idle pose, transparent background, sized/cropped to read clearly at 72×96. |
| Blacksmith Garrett | Full-body version of his portrait prompt above, standing idle pose, transparent background, sized/cropped to read clearly at 72×96. |
| Armorer Ruth | Full-body version of her portrait prompt above, standing idle pose, transparent background, sized/cropped to read clearly at 72×96. |

### Enemy battle sprites (4 regular/elite pairs - 128×128, transparent background, front-facing battle stance)

Same `create_character` (quadruped/humanoid template as appropriate) + `animate_character`
fight-stance-idle pipeline as every other region's enemies - see the Enemies section above.

| Enemy | Family | Generation prompt |
|---|---|---|
| Wind Wisp | windSpirits | Small ethereal wind spirit, pale cyan-white swirling wispy form like a visible gust given shape, faint glow, drifting motion. |
| Storm Wisp | windSpirits | Larger, more turbulent wind spirit, deeper blue-grey coloring with faint crackling energy at its edges, more aggressive posture. |
| Prairie Wolf | prairieWolves | Lean tan-grey prairie wolf, alert pack-hunter stance, wind-blown fur, sharp eyes. |
| Dire Prairie Wolf | prairieWolves | Larger, more scarred prairie wolf, darker fur, imposing pack-leader stance. |

### Equipment icons (18 - generate 128×128, final 64×64, across 6 families x 3 tiers)

Prairie Spear is a straight palette-swap of the already-real `ashwood-spear` weapon-layer sheet
(see the "Equipment weapon-layer sprites" section above) - **once its icon exists**, no new
hand-positioning is needed at all, just `scripts/palette_swap_equipment_layer.py`. The other 5
families each need a new founder (icon + 8-direction prop sheet together, per the equipment-layer
workflow in `feedback_region_build_workflow` memory) before any layer art can start.

| Equipment | Final Size | Generation prompt |
|---|---|---|
| Weathered Prairie Spear *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a long ashwood spear, its shaft wrapped in sun-bleached prairie grass cord, centered, transparent background. |
| Bound Prairie Spear *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a rider-forged spear, fire-hardened head bound with braided rawhide, centered, transparent background. |
| Windrider's Spear *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a balanced throwing spear feathered like a hawk's wing near the grip, centered, transparent background. |
| Worn Buffalo Hide *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a well-worn buffalo hide coat, tanned soft, centered, transparent background. |
| Banded Buffalo Hide *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a buffalo hide coat reinforced with banded leather across the shoulders, centered, transparent background. |
| Chieftain's Buffalo Hide *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a ceremonial buffalo hide coat with fringed detail and a chief's mark, centered, transparent background. |
| Worn Rider's Chaps *(common)* | 64×64 | Simple flat-shaded fantasy game icon of weathered leather riding chaps, centered, transparent background. |
| Banded Rider's Chaps *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of rider's chaps reinforced with banded leather at the knee, centered, transparent background. |
| Windborn Rider's Chaps *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of light rider's chaps with wind-swept fringe trim, centered, transparent background. |
| Worn Wind Boots *(common)* | 64×64 | Simple flat-shaded fantasy game icon of soft-soled, broken-in prairie walking boots, centered, transparent background. |
| Swift Wind Boots *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of lightweight boots cut for speed with wind-swept lacing, centered, transparent background. |
| Windrunner Boots *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of sleek boots with a faint pale wind-motif etched into the leather, centered, transparent background. |
| Worn Rider Gloves *(common)* | 64×64 | Simple flat-shaded fantasy game icon of sturdy cracked leather riding gloves, centered, transparent background. |
| Reinforced Rider Gloves *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of riding gloves reinforced across the knuckles, centered, transparent background. |
| Warden Rider Gloves *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of ceremonial gloves marked with a chief's sigil, faint pale warding glow, centered, transparent background. |
| Feather Sky Charm *(common)* | 64×64 | Simple flat-shaded fantasy game icon of a single hawk feather bound with sinew on a cord, centered, transparent background. |
| Woven Sky Charm *(uncommon)* | 64×64 | Simple flat-shaded fantasy game icon of a small woven charm of feathers and prairie grass, centered, transparent background. |
| Skywalker's Charm *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of an ornate feather-and-bead charm with a faint pale-blue glow, centered, transparent background. |

### Item icons (5 - generate 128×128, final 64×64: materials, key items)

| Item | Final Size | Generation prompt |
|---|---|---|
| Wisp Feather *(material)* | 64×64 | Simple flat-shaded fantasy game icon of a single feather-shaped wisp of condensed pale-blue wind, faintly glowing, centered, transparent background. |
| Prairie Wolf Pelt *(material)* | 64×64 | Simple flat-shaded fantasy game icon of a folded grey-tan wolf pelt, centered, transparent background. |
| Winter Count Hide I *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of a rolled painted hide with faded pictographs, centered, transparent background. |
| Winter Count Hide II *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of a second rolled painted hide with faded pictographs, tied with a slightly different cord than the first, centered, transparent background. |
| Guardian Memory Fragment III *(key item)* | 64×64 | Simple flat-shaded fantasy game icon of an angular purple crystal shard (faceted gem shape, not round) holding a faint ghostly glowing memory-image, centered, transparent background. |

### Landmark markers (2 - generate ~128×128, final 144×144)

Currently reusing Bayou's `structure.landmark-drowned-ledger-cache`/`-bogwater-almanac-cache`
markers as a closer-fit temporary stand-in than the generic `structure.shrine-dormant` fallback -
swap for bespoke art rather than leaving the reuse permanent.

| Landmark | Generation prompt |
|---|---|
| Winter Count Hide I cache | A painted hide bundle half-buried in tall golden prairie grass, faint edge of pictograph visible, centered, transparent background. |
| Winter Count Hide II cache | A second painted hide bundle tucked into a low grassy hollow, tied with rawhide cord, centered, transparent background. |

## Endless Prairie, Chapter 6: Wings of the First Promise - outstanding placeholders

**Status (2026-08-04): same PixelLab quota outage as Chapter 5 above.** No new NPCs this chapter
(Chief Aiyana and Elder Koda reprise their Chapter 5 roles), so this list is shorter - 3 enemy
sprites, 5 equipment icons, 2 item icons, plus two art debts that aren't simple placeholders:

- **`ancient-wind-mechanism`** (Summit Temple's shrine-kind interactable, MSF-EP-006) has no
  `FRAGMENT_SPRITE_ASSET_ID`/bespoke marker at all - it falls back to the generic
  `structure.shrine-dormant`/`-activated` sprites via `shrineSpriteAssetId()`, which is actually
  fine long-term (every other shrine-kind interactable in this game reuses those same two generic
  sprites - `stone-circle-carvings`, `mother-cypress-shrine`, etc. - this isn't a gap, just noting
  it for completeness).
- **The whole Thunderbird Mesa dungeon (5 rooms) reuses `tileset.tiny-dungeon`** (a generic
  stone/timber interior set, same one Hollow Rail Mine and Temple of the Deep Current use) rather
  than a "sky temple" tileset suited to Summit Temple/Sky Bridge/Storm Galleries/Lantern
  Sanctuary/Guardian Peak's own open-air, cloud-level setting. A real generation pass here would be
  a `create_topdown_tileset` (terrain) + `create_tiles_pro` (decor: broken stone vane, lightning-
  scorched pillar, cloud-wisp ground fog) + `create_tiles_pro` (overhang: storm cloud canopy)
  triplet, matching the pattern already used for Endless Prairie's own field terrain - a bigger art
  investment than a single icon swap, worth planning as its own pass rather than squeezing into the
  per-icon backlog below.

### Enemy battle sprites (3 - 128×128 regular/elite, 256×256 boss)

| Enemy | Family | Generation prompt |
|---|---|---|
| Storm Fledgling | stormAvians | A young storm-touched bird, feathers crackling faintly with a charge it hasn't learned to hold, alert perched stance. |
| Thunder Roc | stormAvians | A fully-grown storm-touched raptor, wings spread, capable of grounding prey with a single wingbeat. |
| Great Thunderbird *(boss, 256×256)* | boss | A massive, ancient storm-spirit bird, wings wreathed in lightning, imposing watchful eyes, perched at the summit of a wind-scoured peak - a guardian, not a monster. |

### Equipment icons (5 - generate 128×128, final 64×64)

| Equipment | Final Size | Generation prompt |
|---|---|---|
| White Buffalo Totem *(rare)* | 64×64 | Simple flat-shaded fantasy game icon of a small carved totem in the likeness of a white buffalo, centered, transparent background. |
| Elder Buffalo Totem *(mythic)* | 64×64 | Simple flat-shaded fantasy game icon of a larger carved totem, an ancient buffalo herd elder weathered by storms, centered, transparent background. |
| Thunderbird Totem *(legendary, unique)* | 64×64 | Simple flat-shaded fantasy game icon of a totem carved in the Great Thunderbird's likeness, wings spread, centered, transparent background. |
| Lantern of Open Skies *(found-item form)* | 64×64 | Simple flat-shaded fantasy game icon of an unlit brass lantern etched with a spiral wind-pattern, centered, transparent background. |
| Lantern of Open Skies *(equipped, legendary)* | 64×64 | Simple flat-shaded fantasy game icon of a lit legendary lantern, glass etched with a spiral wind-pattern, faint pale glow, centered, transparent background. |

### Item icons (2 - generate 128×128, final 64×64)

| Item | Final Size | Generation prompt |
|---|---|---|
| Thunderbird Feather *(key item, legendary)* | 64×64 | Simple flat-shaded fantasy game icon of a single large feather crackling faintly with stormlight, centered, transparent background. |
| Guardian Memory Fragment IV *(key item, legendary)* | 64×64 | Simple flat-shaded fantasy game icon of an angular purple crystal shard (faceted gem shape, not round) holding a faint ghostly glowing memory-image, centered, transparent background. |

---

## Things Claude can't generate itself (need external production)

Everything above this line is producible in-house via the pixellab MCP server (characters, objects,
tilesets, icons, UI panels via `create_ui_asset`). The categories below are genuinely outside that
toolset's capability - flagging them here so they don't quietly stay unaddressed on the assumption
that "everything is pixellab-generatable, it just hasn't been asked for yet."

- **Cut-scenes / cinematics.** No video- or sequential-animation-generation tool exists in this
  toolset. Any story beat that wants a real cinematic (the Great Silence reveal, a Guardian's full
  memory playback, an ending) needs either external video production, or a scope change to
  something this codebase can actually build (e.g. a scripted in-engine sequence using existing
  sprites/dialogue boxes/camera pans - buildable, just not "generated art").
- **Voice acting / spoken dialogue audio.** `create_vocal_animation`/`create_talking_gif`/
  `get_lip_sync` exist, but they only produce *visual* mouth-shape animation timed to a line of
  text (visemes) for an animated talking-portrait feature - none of them synthesize actual spoken
  audio. This game doesn't use animated talking portraits today (dialogue is text + a static
  portrait), so this only matters if that UI style is ever adopted; either way, real voiced
  narration needs an external TTS pass or voice actor, not something generatable here.
- **Custom music composition.** No music-generation tool exists. The Audio section above was
  entirely sourced by picking existing tracks from an already-staged CC-BY licensed library
  (FarBeyond Studio - Freebies Vol. 1) - if a future region wants a genuinely new musical theme
  rather than reusing/re-picking from that library, that's an external composition need.
- **Painterly high-resolution art matching Ash Hallow's existing building facades.** Ash Hallow's
  10 building-facade/shrine sprites (`structure.house`, `.inn`, `.armory`, etc.) were NOT
  pixellab-generated - they're externally-produced painterly renders (~1024-1254px, staged directly
  into `art-staging/icons/` and processed by `scripts/build_structure_icon.py`). `create_map_object`
  (pixellab's own equivalent) caps at 400x400 and produces this project's usual flat-shaded pixel-art
  style, not that painterly look - so a pixellab-generated Mirehaven building (see below) is a
  genuine placeholder in a visibly different style, not a drop-in match. If Crimson Bayou's (or any
  future region's) buildings should match Ash Hallow's painterly quality exactly, that art needs to
  come from the same external source/process Ash Hallow's did, not pixellab.
  - **Concrete current instance**: Mirehaven's 7 building facades (`mirehaven-town-hall`, `-archive`,
    `-inn`, `-general-store`, `-blacksmith`, `-armory`, `-herbalist`) had no facade art at all until
    this pass - every entrance was rendering as the generic pulsing exit marker. Generated as
    pixellab placeholders (`create_map_object`, 300x300, cropped/resized to 144x144 via the same
    pipeline as the Ash Hallow set) so the town isn't missing entrances entirely, but flagged here as
    a stylistic mismatch worth a real painterly pass later if Mirehaven should visually match Ash
    Hallow's quality bar.

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
| `sfx.enemy-defeated` | An enemy is defeated | Short descending "dissipating" burst. | `Retro/lose.wav` | Manually swapped in by the user, replacing the earlier `Other/ghost_long.wav` pick. |
| `sfx.victory` | Winning a battle | Bright ascending fanfare arpeggio. | `Musical Effects/grand_piano_level_complete.wav` | "Level complete" maps directly onto winning. |
| `sfx.level-up` | Leveling up after victory | More triumphant than the victory cue. | `Musical Effects/grand_piano_positive_long.wav` | Bigger/longer than victory's chime, per spec. |
| `sfx.defeat` | Losing a battle | Soft descending minor cue. | `Musical Effects/grand_piano_defeated.wav` | Literally named "defeated." |
| `sfx.quest-started` | A quest becomes active | Lightest of the 3 quest-chime tiers. | `Musical Effects/music_box_chime_quick.wav` | Music box is the dedicated family for all 3 quest tiers - kept distinct from the economy (piano) and npc-talk (xylophone) families. |
| `sfx.quest-progress` | A quest's objective advances | Middle quest-chime tier. | `Musical Effects/music_box_chime_positive.wav` | Fuller than quest-started, same family. |
| `sfx.quest-completed` | A quest is fully completed | Most celebratory quest-chime tier. | `Musical Effects/music_box_level_complete.wav` | Fullest/most resolved of the 3, same family. |
| `sfx.social-ping` | Friend/message/trade update arrives | Notification ping, distinct from quest chimes. | `Musical Effects/harpsichord_chime_quick.wav` | Its own family so it's never mistaken for a quest/economy/dialogue chime. |
