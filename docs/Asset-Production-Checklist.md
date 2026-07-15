# Asset Production Checklist

Every entry below is `status: 'placeholder'` in `src/assets/registry.ts` (or, for audio, a newly
added placeholder category - see "Audio"). Each section describes a *pattern* once rather than
repeating an identical spec per id - look up the exact id list in the registry when you're ready to
swap a specific file in. Swapping a placeholder for final art is always a one-line edit to that
file (`filePath`, `dimensions`, and `status: 'final'`) - no code changes needed anywhere else.

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

## Portraits (14 - dialogue box headshots)

**Spec**: 512×512 PNG, painted background (not transparent - fills the dialogue portrait frame),
head-and-shoulders framing, 3/4 or front-facing.

| Character | Role | Generation prompt |
|---|---|---|
| Elias Rowan | Lantern Keeper Mentor | Weathered older man, greying beard, worn leather Keeper's coat, holding a lit lantern close to his chest, stern but kind eyes, mountain-town mentor. |
| Finn Rowan | Elias's Nephew | Younger man in his twenties, relaxed posture, lighter/more casual clothing than his uncle, half-smile, holds a lantern oil flask loosely. |
| Mara Ash | General Store Owner | Middle-aged woman, warm practical expression, apron over simple clothes, sleeves rolled up, standing in front of shelves of goods. |
| Silas Flint | Mine Office Foreman | Stocky older man, soot-smudged face, hard hat or miner's cap, thick beard, tired but determined eyes. |
| Juniper Reed | Innkeeper | Cheerful middle-aged woman, apron, warm smile, hair tied back, holding a mug or cloth. |
| Nell Ashby | Folklore Collector | Bookish young woman, spectacles, satchel of notes, curious/intense expression, ink-stained fingers. |
| Aldren Stone | Blacksmith | Broad-shouldered man, forge-scarred forearms, leather apron, soot and sparks nearby, confident stance. |
| Tessa Ironhand | Armorer | Sturdy woman, practical braided hair, inspecting a piece of armor, calloused hands, focused expression. |
| Willow Briar | Apothecary | Slender woman surrounded by dried herbs and small bottles, calm knowing expression, earth-toned clothing. |
| Historian Miriam | Town Historian | Elderly woman, spectacles, surrounded by old books/scrolls, thoughtful and patient expression. |
| Hunter Garrick | Tracker | Rugged outdoorsman, fur-lined cloak, bow or knife at hip, alert eyes, weathered from the trail. |
| Spirit Child | Voice of the Grove | Ethereal pale child-like spirit, faint glow, forest-green and silver tones, slightly translucent, ancient sad eyes. |
| Ranger Caleb | Ridge Scout | Lean scout in mountain gear, cloak, watchful expression, sharp-eyed, cliffside backdrop hint. |
| Mayor Eleanor Ashcroft | Mayor of Ash Hallow | Dignified older woman, formal but weathered town-official attire, a small mayoral pin/sash, composed authoritative expression. |

## NPC overworld sprites (14, 1:1 with portraits above)

**Spec**: **72×96 PNG, transparent background - the same size as the player character**, full-body,
standing idle pose, 3/4-view (not top-down). Single frame for now (per your staged plan - swap this
in first); a 4-direction idle+walk sheet (still 72×96 per frame, laid out the same 4-column ×
8-row grid `sprite.player`'s frameSize already uses) is the later "phase 2" version once more of the
MSQ is built out.

Generation prompt: reuse the matching portrait's prompt above, but as a **full-body figure**, same
outfit/props, standing pose, transparent background, sized/cropped to read clearly at 72×96 (avoid
overly fine detail that would disappear at that resolution).

`sprite.npc.large` (the one deliberately-bigger NPC tier, for anyone who should read as more
imposing than a regular human) becomes **96×120** proportionally - not used by any location yet.

## Player sprite (in progress - you're doing this one yourself)

Already at 72×96 (single frame). The later target, once you're ready for animation, is a 4-direction
idle+walk sheet at 72×96 per frame, same row order as the existing `sprite.player` fallback sheet
(walk-down, walk-left, walk-up, walk-right, run-down, run-left, run-up, run-right - 8 rows × 4
columns). No rush on this one.

## Enemies (12 regular + 1 boss - battle sprites)

**Spec, regular tier (12)**: 128×128 PNG, transparent background, front-facing "battle stance" pose
(this is what's shown in the combat screen, not an overworld sprite). **Boss tier (1)**: 256×256,
same conventions, more detailed/imposing.

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

**Building facades** (10: house/shop/inn/blacksmith/apothecary/armory/archive/mine-office/town-hall,
plus the generic shrine marker): **72×72 PNG**, transparent background, a painted building-entrance
facade (door + surrounding wall texture) sized to its footprint - matches the rustic mountain-town
look of Ash Hallow (weathered wood, stone foundations, lantern-lit windows).

Generation prompt (shared, vary the door/sign per building): "Small rustic mountain-town building
facade with a wooden door, weathered plank and stone construction, warm lantern-lit window, autumn
Appalachian fantasy town." Add per-building flavor: General Store (goods crates by the door),
Inn (a hanging sign, warm glow), Blacksmith (an anvil visible, chimney smoke), Apothecary (dried
herbs hanging in the window), Armory (a shield/weapon emblem on the door), Archive (an old stone
facade with a carved sigil), Mine Office (a lantern-post and mining-cart rail nearby), Town Hall
(slightly grander, a small bell tower or flag).

**Shrine marker**: 72×72, same conventions - a small weathered stone shrine, moss-covered, with a
faint spiritual glow (matches "a small stone shrine, half-forgotten" from its in-game flavor text).

**Chest**: **48×48 PNG**, transparent background, two states needed - `structure.chest` (closed,
wooden treasure chest, iron banding) and `structure.chest-open` (same chest, lid open, empty dark
interior) - these are now genuinely separate sprites, not the same image reused with a different
label.

**Door**: **48×96 PNG**, transparent background - a standalone wooden door (not currently placed on
any map, but stubbed for future building-entrance use). Rustic plank door, iron hinges.

## Icons (54 - inventory/equipment/currency)

**64×64 tier (50 items)**: consumables, ailment-cure items, the 6 battlefield ailment status icons,
all named equipment (21 pieces across 7 rarity families - Walking Staff, Keeper Coat, Traveler
Boots, Work Gloves, Mountain Charm, Mountain Spirits totems, and 2 unique lanterns), and the two
Iron Mountains Side Quest key items (`icon.item.frostbound-treatise`, `icon.item.ember-codex` -
docs/Mytherra-SQ_breakdown.md).
**Spec**: 64×64 PNG, transparent background, single centered object, simple flat lighting (these are
small UI icons, not illustrations - avoid busy detail that won't read at 64px).

Generation prompt template: "Simple flat-shaded fantasy game icon of a [item], centered, transparent
background, warm muted color palette, readable at small size." Fill in `[item]` per id - e.g.
"a glass vial of glowing green healing poultice," "a small lit brass lantern," "a pair of worn
leather traveler's boots," "a carved wolf-totem charm," "a weathered leather-bound manuscript rimed
with frost" (frostbound-treatise), "a scorched, ember-warm leather codex" (ember-codex).

**32×32 tier (4 currency icons)**: `icon.currency.gold`, `spirit-essence`, `festival-tokens`,
`premium-currency`. Same flat-icon spec, smaller. Generation prompt: "Simple flat fantasy currency
icon - [a gold coin / a glowing spirit-essence orb / a festival token / a premium gem], centered,
transparent background."

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

## Audio

Every id below was just added to `src/assets/registry.ts` with a **procedurally generated
placeholder** (simple synthesized tones - see `scripts/genPlaceholderAudio.mjs`, the audio
equivalent of the SVG placeholder convention used for visual assets). They're already wired into
real gameplay moments (see each entry's `intendedUse` in the registry for exactly where), so
dropping in final files is the only step left - no new code required, same one-line registry swap
as any visual asset.

### Music (7 - looping background beds)

**Spec**: mp3 or ogg (much smaller than this placeholder pass's wav files), ~60-120s loop that
returns cleanly to its start (a DAW/generator with seamless-loop export is worth using). Style
baseline: warm, folk-adjacent Appalachian-mountain fantasy instrumentation (acoustic guitar,
fiddle, low strings, occasional soft percussion) - understated, not bombastic, this is a quiet game
about lantern-keepers and small-town life more than grand heroics.

| Track | Generation prompt |
|---|---|
| `music.title` | Hopeful, mysterious mountain-folk main theme, slow build, acoustic guitar and fiddle, a sense of quiet adventure beginning. |
| `music.town` | Warm, cozy small-town theme, gentle acoustic guitar, relaxed tempo, evokes lantern-lit evenings in a mountain village. |
| `music.overworld` | Adventurous but understated exploration theme, walking tempo, acoustic strings, open-air mountain-trail feeling. |
| `music.dungeon` | Tense, echoing mine-tunnel theme, sparse low drones, distant metallic percussion, claustrophobic but not horror-styled. |
| `music.combat` | Energetic but restrained battle theme, driving rhythm, string ostinato, urgency without bombast. |
| `music.combat-boss` | Heavier, more dramatic boss theme - lower register, percussive weight, higher stakes than the regular combat theme. |
| `music.defeat` | Quiet, melancholy recovery theme - soft strings, slow tempo, comforting rather than punishing. |

### Sound effects (20 - short one-shots)

**Spec**: mp3, ogg, or wav all fine at this length (~0.15-1s each). Style baseline: soft, tactile,
non-electronic (wood, cloth, metal, water, breath) - matches the game's grounded folk-fantasy tone
rather than a synth-heavy arcade feel.

| Cue | Fires when | Generation prompt |
|---|---|---|
| `sfx.ui-close` | Any overlay/modal closes | Soft, short UI dismiss click - a gentle downward pitch, unobtrusive. |
| `sfx.ui-error` | A rejected action (can't afford, missing materials, etc.) | Low, brief "denied" buzz - clear but not harsh or alarming. |
| `sfx.purchase` | Successful shop purchase | Satisfying coin-purse jingle, bright and quick. |
| `sfx.sell` | Successful shop sale | A distinct "gold received" chime, slightly different pitch/character from purchase. |
| `sfx.rest` | Successful Inn rest | Gentle, warm ascending chime - restful, comforting. |
| `sfx.equip` | Equip/unequip an item | Soft metallic/leather click - armor or gear settling into place. |
| `sfx.item-use` | Using a consumable | Soft pop/fizz - a potion or poultice being used. |
| `sfx.craft-success` | Successful crafting | Bright ascending 3-note flourish - a small triumphant "made it" cue. |
| `sfx.chest-open` | Opening a new chest | Wooden creak followed by a soft treasure chime. |
| `sfx.shrine` | Interacting with a shrine | Soft resonant bell/chime swell - mystical, reverent. |
| `sfx.npc-talk` | Opening NPC dialogue | Gentle notification blip - inviting, conversational. |
| `sfx.transition` | Crossing a location transition | Soft whoosh - a brief sense of movement/passage. |
| `sfx.combat-hit` | A combat round lands a hit | Sharp, grounded impact thud - weapon or fist contact. |
| `sfx.enemy-defeated` | An enemy is defeated | A short descending "dissipating" burst - a spirit/creature fading out. |
| `sfx.victory` | Winning a battle | Bright ascending fanfare arpeggio - a short victory flourish. |
| `sfx.level-up` | Leveling up after victory | A distinct, more triumphant ascending chime than the victory cue. |
| `sfx.defeat` | Losing a battle | A soft descending minor cue - somber, not harsh. |
| `sfx.quest-started` | A quest becomes active | A single soft notification tone - the lightest of the three quest-chime tiers. |
| `sfx.quest-progress` | A quest's objective advances | A two-note rising blip - the middle quest-chime tier. |
| `sfx.quest-completed` | A quest is fully completed | A fuller, more resolved 3-note chime - the most celebratory quest-chime tier. |
| `sfx.social-ping` | A friend request/message/trade update arrives | A gentle notification ping, distinct from the quest chimes. |
