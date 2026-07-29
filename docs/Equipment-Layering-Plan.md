# Equipment Layering Plan

Goal: the player's visible overworld sprite reflects their currently-equipped weapon, armor,
gloves, boots, and lantern - not just the inventory/equip-menu icons that already exist. Charm and
spiritTotem (the two small accessory slots) are **not** in scope - they're worn under clothes or
held out of frame, nothing to visibly layer.

**Scope expanded per `NewClaudeAsk.txt`**: the player will select from **4 appearances** (White/
dark hair, Black/dark hair, White/blonde hair, Asian/dark hair) **× 2 genders = 8 total base
bodies**, not just the 2 (male/female) originally planned - confirmed with the user directly (see
below). The user's own stated requirement - "make sure they are identical to each other so when
the equipment layers are applied it is plug and play" - is the load-bearing constraint here.

## Skin selection data model (new decision, not yet implemented)

Today `Player.skin` is a flat `'male' | 'female'` union (`src/types/player.ts:32`,
`functions/src/shared-types/index.ts:83,430`), read via `skin === 'female' ? 'sprite.player.female'
: 'sprite.player.male'` at every render call site (OverworldScene/TownScene/DungeonScene's player
render, `PvpBattlePanel`'s opponent sprite resolution, etc. - a real, repeated pattern across
several files).

**Recommended**: split into two orthogonal fields rather than an 8-value flat union:

```ts
gender: 'male' | 'female';
appearance: 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark';
```

Rationale: the Profile "Skin" tab naturally becomes two independent choices (body type, then
appearance) rather than 8 flat radio buttons; sprite asset id resolution becomes
`sprite.player.base.${gender}.${appearance}`; and critically, **equipment layer art only depends on
`gender`** (body silhouette), not `appearance` (skin tone/hair) - since the whole point of "identical
proportions" is that a boot/coat/glove layer fits identically regardless of skin tone or hairstyle.
This keeps Phase 3/4's equipment-art scope at 2 layer-art sets (male/female), **not 8** - the
4x-appearance multiplier only applies to the base bodies themselves, not to every equipment item on
top of them. If that "identical proportions across all 4 appearances" requirement doesn't hold up
once real art is in hand, this assumption needs revisiting before Phase 3.

This is a genuine data-model migration (Cloud Function `setPlayerSkin.ts`, character creation flow,
every `skin === 'female' ? ... : ...` render call site, the Profile Skin tab's UI) - scoped as its
own step below, not assumed free.

## Status

**Data model migration: done.** `Player.gender`/`Player.appearance` (split from the old flat
`skin` field) are live end-to-end - shared-types (client+server), `createCharacter`/
`setPlayerSkin`/`resetPlayerProgress`/`partyBattle.ts`'s snapshot, presence plumbing, and every
render call site. The visible picker UI (CharacterCreationScene, UserProfile's Skin tab) is
deliberately still 2-option (gender only) - `appearance` defaults to `white-dark` and isn't
user-changeable yet, since exposing 4 buttons that all render identically until Phase 2/3/4 land
would be confusing. Wire up the 4-appearance picker once real art exists for all of them.

**Phase 1 (base body art): all 8 of 8 done.** All 4 appearances (`white-dark`, `black-dark`,
`white-blonde`, `asian-dark`) x 2 genders are fully generated, processed, and registered -
`sprite.player.base.{male,female}.{white-dark,black-dark,white-blonde,asian-dark}` in registry.ts,
all built via `scripts/build_player_sheet.py` from one shared `crop_box` (20,3,116,131) measured
against the white-dark pair's union content-bbox and reused identically for every variant (same
size/view/proportions/pose generation params across all 8), so every base body stays pixel-
consistent - the actual load-bearing requirement for equipment layers to be plug-and-play later.
See `docs/pixellab-asset-ids.md` for each variant's pixellab character id.

**Base sprite swap: done.** `sprite.player.base.{gender}.{appearance}` is now the actual player
sprite rendered in Town/Overworld/Dungeon (`resolvePlayerBaseSpriteAssetId`,
`src/utils/equipmentLayers.ts`), replacing the old fully-clothed `sprite.player.male`/`.female`.
Made once Phase 3's first 2 pilot items (below) had real layer art to composite on top of it,
rather than waiting for all 5 - a bare/underwear look in not-yet-covered slots is expected during
the pilot. `sprite.player.male`/`.female` are kept registered and unused (not deleted), so
reverting to the old fully-dressed sprite is a one-line change in `resolvePlayerBaseSpriteAssetId`
if the layering approach is ever abandoned. Only the LOCAL player's own sprite switched - other
players' presence entities (seen walking around by others) still render `sprite.player.male`/
`.female`, since presence data doesn't carry equipment and switching that too is a separate,
larger effort (broadcasting live equipment state, not just gender/appearance).

**4-appearance picker UI: done.** CharacterCreationScene and UserProfile's Skin tab both expose
gender + appearance as two independent choices with live preview art (`SpritePreviewFrame`, a
shared component that crops a sheet down to one frame instead of squashing the whole sheet into a
tiny box - also reused by the Journal of Legends' Echoes/Bosses detail card, which had the same
bug). `setPlayerSkin` now accepts and stores both fields.

**Phase 2 (rendering infrastructure): done.** `ExplorationScene.setPlayer` accepts an
`equipmentLayers: {slot, spriteAssetId}[]` param - each equipped slot with layer art gets its own
child sprite kept in lockstep with the base sprite's position/scale/animation every call (each
layer plays its own animation key against its own texture, but since every layer shares the same
row/frameCount/frameRate as the base, playing them in the same tick keeps them visually frame-
synced). Depth-ordered via `EQUIPMENT_LAYER_DEPTH_OFFSET` (boots < armor < gloves < weapon/
lantern). `PhaserExplorationCanvas`/`TownScene`/`OverworldScene`/`DungeonScene` all thread a
resolved layer list through via the new shared `resolveEquipmentLayers` util
(`src/utils/equipmentLayers.ts`), which reads `player.equipment` + each equipped item's
`layerSpriteAssetId[gender]` (new optional field on `EquipmentItem`). Verified end-to-end with a
temporary placeholder layer (a real base-body sheet standing in for "armor") before removal -
confirmed via live scene-graph inspection that position/scale/depth and all 4 walk directions'
animation frames stay perfectly synced between the base sprite and its layer. Now visibly live for
the 2 equipment items with real layer art (see Phase 3 below) - resolves to `[]` for every other
equipped item, same as before.

**Next up**: finish Phase 3 (pilot loadout - walking-only, male-only, see that section below).

## The hard problem: frame-perfect alignment

Every equipment layer must land on the exact same pixel position as the base body's corresponding
limb/torso in **every one of the 32 frames** (8 rows × 4 columns) - a boot has to sit on the exact
foot position in frame 2 of "walking down" as it does in frame 2 of "running left." There is no
pixellab capability that guarantees this by construction:

- `create_character(mode="v3", reference_image_base64=...)` rotates a *single* reference sprite
  into 8 *directions* - it doesn't derive a walk-cycle, and it's meant for full characters, not an
  isolated equipment piece worn by one.
- `create_8_direction_object`'s own reference-image note explicitly warns identity transfer is
  "unreliable for CHARACTER/humanoid sprites" - it's tuned for standalone props (barrels, chests),
  which is why the chest work above used it directly, but a worn item riding on a moving body isn't
  that.
- Nothing in the API takes "this base body's 32 frames" and "this equipment description" and
  returns 32 pre-aligned equipment frames.

**Chosen approach**: treat alignment as a deterministic post-processing problem, the same way this
project has solved every other AI-generation imprecision so far (every single character/enemy/NPC
sprite this session needed a hand-measured `crop_box` tuned by eye - see any entry in
`scripts/build_npc_idle_sheet.py`/`build_enemy_idle_sheet.py`). Concretely, per equipment piece:

1. Generate the piece as its own independent sheet (likely `create_character` in a similar pose/
   view to the base body, description-only, no reference image - simplest, most predictable path).
2. In the build script, for each of the 32 (row, frame) cells: crop/scale the equipment frame, then
   apply a **per-cell (dx, dy) pixel offset** so it lands correctly on that cell's base-body pose.
   Composite the equipped frame over the base frame in the scratchpad, inspect visually (the same
   "read the composited PNG" verification loop already used throughout this session), and adjust
   offsets until it looks right.
3. This is real per-item manual tuning work - not a one-time script, a repeated calibration pass
   per equipment piece. Expect it to be the slow part of Phase 4, not asset generation itself.

An alternative considered and rejected for now: generating full "already-equipped" character
variants (`create_character_state` on the *base* body's own completed character, edit="wearing X
armor", then a fresh `animate_character` walk/run pass on that variant). This sidesteps alignment
entirely - you get a fully-clothed matched character instead of separate layers - but it multiplies
combinatorially (one full sheet per weapon×armor×gloves×boots combination, instead of one sheet per
individual piece) and doesn't give truly independent layers a player could see change piece-by-
piece. Worth revisiting only if the offset-tuning approach proves too unreliable in practice.

## Data model changes needed

`EquipmentItem` (`src/types/item.ts:45-68`) has `iconAssetId` (inventory/equip-menu icon) but
**no field at all for a worn/layered sprite** today. Add:

```ts
interface EquipmentItem {
  // ...existing fields...
  layerSpriteAssetId?: { male: string; female: string }; // omitted = nothing rendered for this slot
}
```

Optional by design - an equipment item with no layer art (everything until Phase 4 actually ships
art) simply renders nothing extra, same "not every X needs one, check before playing" pattern this
project already uses for NPC idle animations and enemy fight-stance loops.

Server-authoritative `EquipmentDefinition` (`functions/src/data/equipment.ts:19-48`) needs **no
change** - the layer sprite is purely a client-side rendering concern (display only), matching this
project's existing client/server split (`CLAUDE.md`: server data is what combat math/prices/gating
actually use; client copies are for display). `PlayerEquipment`
(`Partial<Record<EquipmentSlot, string | null>>`, already exists) needs no change either - it's
already exactly the shape needed to look up which layer sprite (if any) to render per slot.

## Rendering architecture

Today: `ExplorationScene.setPlayer(pos, spriteAssetId, frameRow, movementState)` creates **one**
sprite (`src/phaser/ExplorationScene.ts:280`), called from a `useEffect` in
`PhaserExplorationCanvas.tsx:141` keyed on `[sceneReady, player, playerSpriteAssetId,
playerFrameRow, playerMovementState, tileSize]`.

Planned: extend to a small stack of sprites, one per equipped slot with layer art, all positioned/
scaled/animated identically to the base sprite:

- New method (or extend `setPlayer`) taking an additional `equipmentLayers: { slot: EquipmentSlot;
  spriteAssetId: string }[]` param, resolved by the caller from `player.equipment` + each equipped
  item's `layerSpriteAssetId[skin]`.
- Each layer gets its own child `Phaser.GameObjects.Sprite`, same `x`/`y`/`scale` as the base
  sprite every frame, same `animationKey(...)` played in lockstep (same row/state/facing) - since
  every layer sheet shares the base's exact 8×4×72×96 layout, playing the identical animation key
  on each sprite keeps them frame-synced automatically (Phaser's own update loop advances all
  playing animations together).
- Fixed relative depth per slot (base < boots < armor < gloves < weapon/lantern, tuned by eye once
  real art exists) via small fractional offsets from the base sprite's own `ENTITY_DEPTH`.
- `PhaserExplorationCanvas.tsx`'s `useEffect` deps gain the resolved equipment-layer list (derived
  from a Zustand equipment store this project already has for the equip-menu, not a new store).
- This is genuinely new code, but small and additive - no existing rendering path
  changes for a player with no equipped layer art (the common case until Phase 4 art lands).

## Phased delivery

**Phase 1 (done)**: generate + build all 8 base bodies. No visual change yet - nothing switches
over to them until there's a rendering path and at least placeholder-free art for the starter
loadout (Phase 3/4).

**Phase 2**: build the rendering infrastructure above with zero real layer art - verify a player
renders identically to today (base body alone, no layers) and that the plumbing (equipment state →
resolved layer list → stacked sprites) works end-to-end with a single test placeholder layer
(even a solid-color rectangle sprite) before spending art-generation effort.

**Phase 3 (pilot)**: pick ONE full loadout (the Prologue starter kit - `travelers-cloak`,
`weathered-walking-staff`, `traveler-boots`, `work-gloves`, `keepers-lantern`) and take it all the
way through: generate, align, verify in-game. Deliberately narrowed twice (confirmed with the
user) to keep the first pass through this workflow fast: **walking frames only** (16 cells - 4
directions × 4 frames - not the full 32; running frames get added once the workflow is proven) and
**male base body only** (female equipment art is a genuinely separate generation+alignment pass
given different proportions, not a resize - do it once the male pipeline is validated).

The original plan here was automated placement (per-item ANCHOR/grip/target_h math,
`scripts/build_equipment_layer.py`) - abandoned after the results looked unusable in practice
("looks like junk"; the automated boots/gloves/cloak/lantern all landed visibly wrong). Replaced
with hand-positioning: the user is given a working folder per item (`_reference/{direction}-
frame{N}.png` showing the bare base body to align against, `{item}/{direction}-frame{N}.png` with
the item's own art sitting at a neutral (0,0) starting point on an otherwise-empty 72x96 canvas)
and repositions the art directly, frame by frame, in their own image editor. `scripts/
build_equipment_layer_manual.py` then just directly composites each finished frame into the sheet
- no placement math at all, since the hand-positioned frames are already exactly where they need
to be.

That script also measures and records each finished item's actual bounding-box center per frame
into `docs/equipment-layer-anchors.json`, keyed by category (`held-left-hand`, `held-right-hand`,
`worn-torso`, `paired-feet`, `paired-hands`) rather than by item id - the idea being that a
**future** item in an already-covered category (e.g. a second lantern, another pair of boots) can
be auto-scaled/centered on that measured anchor as a strong starting point instead of requiring
full manual positioning again, with just a quick visual check/nudge rather than 16 frames of
from-scratch editing. Not yet exercised on a second item in any category - the pilot's own 5 items
are all first entries in their category so far.

**Gotcha, hit once already**: `build_equipment_layer_manual.py` rebuilds *every* item's output
sheet from its `art-staging/equipment-layers-manual/<item>/` source frames every time it runs, not
just the item that changed. If a finished output PNG (`public/assets/sprites/equipment/<item>-
male-animated.png`) is ever hand-touched-up directly (skipping the source-frame stage), re-running
the script for a *different* item silently overwrites that touch-up back to the un-touched-up
composite - happened once with `traveler-boots`/`travelers-cloak` right after the user hand-edited
those two output sheets directly, caught via `git diff --stat` before committing and restored with
`git checkout HEAD -- <path>`. Takeaway: either touch up the *source frames* (so a rebuild
reproduces the fix) or re-stage any output-level touch-up as new source frames before running the
script again for anything else.

Progress: **all 5 pilot items done for the male walking pass** - `keepers-lantern` (held-left-
hand), `traveler-boots` (paired-feet), `travelers-cloak` (worn-torso), `weathered-walking-staff`
(held-right-hand, all 4 directions including the west/left set added in a follow-up round),
`work-gloves` (paired-hands), all hand-positioned and verified in-game (base sprite swap above).

**Male running pass: `keepers-lantern` done** (down/left/up, matching its walking-pass direction
coverage) - verified the lantern tracks the running arm's pumping swing naturally across all 4
frames of each direction. Patched via `scripts/build_equipment_layer_running.py`, a deliberately
different script from the walking pass's `build_equipment_layer_manual.py`: it overwrites ONLY the
running-row (4-7) cell of an item's ALREADY-BUILT output sheet, for exactly the (direction, frame)
pairs that have a staged running-pose source frame, leaving every walking-row pixel and every
not-yet-updated running cell untouched. This is the fix for the clobbering gotcha noted above -
running this script for one item can never affect any other item's sheet, or even that same item's
own walking rows. Anchor data recorded under a new top-level `"running"` bucket in
`docs/equipment-layer-anchors.json` (same category->item->direction->frames shape as the walking
entries, nested one level deeper so the two poses never collide).

**Starting-frame regeneration, done for all 3 remaining working folders**: the running/female
working folders' item starting frames are now sourced by cropping directly from each item's LIVE,
already-built (and possibly hand-touched-up) male walking sheet - not from the original
`art-staging/equipment-layers-manual/` source frames, which go stale the moment a sheet gets a
direct touch-up after the fact (happened once already with `traveler-boots`/`travelers-cloak`) or
predate a later follow-up round (`weathered-walking-staff`'s original batch predated its own
west/left-frame round entirely). For paired items (boots/gloves), a real connected-component split
is used for down/up (both sides genuinely visible, confirmed by direct pixel inspection - not a
naive half-cut) with side assignment via the same anatomical anchor convention the original
`build_equipment_layer.py` ANCHORS table used; left/right facing frames duplicate the single
visible blob into both output files (matches those directions' own documented occlusion rule -
only one side is ever really there) rather than risk mis-slicing one glove into two garbage
pieces. One frame (`work-gloves` up-facing frame 3) didn't cleanly match the expected 2-segment
case and fell back to the safe duplicate-whole-cell behavior - flagged in each folder's own
README for the user to trim by hand.

**Male running pass: `keepers-lantern`, `travelers-cloak`, `weathered-walking-staff` done** (all
verified in-game via direct compositing - cloak billows naturally through the run cycle, staff
swings dynamically with the sprint). `keepers-lantern` also picked up a genuinely missing
direction along the way - it turned out the lantern is visible facing right/east too (not fully
occluded as originally assumed), so a real right-frame set was added for BOTH walking and running
via a new script, `build_equipment_layer_add_direction.py` (the walking-pose counterpart to
`build_equipment_layer_running.py`'s same clobber-safe patch-only-what-changed approach - see that
script's own header for why a full rebuild isn't safe once other items carry direct touch-ups).

Remaining: `traveler-boots`, `work-gloves` still need their male running-pose pass (working folder
`manual-edit-running/` ready for both). Then the female walking + running rounds - working folders
(`manual-edit-female-walking/`, `manual-edit-female-running/`) ready for all 5 items (including
keepers-lantern's right direction), waiting on the user's edits.

**Phase 4 (started)**: roll out the remaining equipment families using the now-proven pipeline -
but for same-family SIBLING items (a lower/higher tier of gear that's the same worn/held object,
just a different material - e.g. Ironwood Walking Staff vs. Weathered Walking Staff), full manual
hand-positioning turned out to be unnecessary duplicate effort. Two new scripts auto-derive a
sibling's sheet from whichever family member was already hand-positioned:

- `scripts/palette_swap_equipment_layer.py` - for a sibling with the SAME silhouette (confirmed by
  comparing icon art first), a per-material gradient-map recolor: k-means clusters each icon's
  colors in RGB space, clusters paired by POPULATION rank (largest-to-largest material - more
  robust than an earlier brightness-rank version, which broke on a high-contrast icon by pairing a
  tiny near-white highlight cluster against the source's whole dominant body color), each pixel
  remapped through a per-cluster value-sorted ramp so all existing shading/highlights survive
  unchanged - only the base color differs. Reuses 100% of the reference's hand-positioning and
  inherits its full running-pose coverage for free (operates on the whole 8-row sheet).
  Shipped: `ironwood-walking-staff` (from `weathered-walking-staff`), `miners-lost-lantern-equipped`
  (from `keepers-lantern`), `reinforced-keeper-coat` + `veteran-keeper-coat` (from
  `worn-keeper-coat`). Not perfect on every icon - `veteran-keeper-coat`'s true olive-green got
  averaged into a warm brown/gold blend since 2 clusters can't cleanly separate 3+ real materials
  from one icon; flagged as a known gap in that item's own registry note rather than hidden.

- `scripts/estimate_transform_equipment_layer.py` - EXPERIMENTAL, for a sibling with a genuinely
  DIFFERENT silhouette (not a recolor candidate). Per frame: PCA on the reference frame's alpha
  mask estimates its rotation angle (skip via `--no-rotation` for a worn torso garment, where PCA
  on a roughly body-shaped blob gives meaningless/erratic angles - confirmed by checking
  `travelers-cloak`'s own frame-to-frame angles before attempting `worn-keeper-coat`); the new
  item's own flat icon is rotated by the delta, scaled to the reference's recorded anchor height,
  centered on its recorded position, then clipped to the reference frame's own silhouette
  (reproduces its hand-tuned grip-trim notch for free, at the cost of constraining the new item's
  width to the reference's). Shipped: `spiritwood-walking-staff` (from `weathered-walking-staff`,
  rotation-estimated - reads convincingly as gripped and follows the arm swing) and
  `worn-keeper-coat` (from `travelers-cloak`, `--no-rotation` - reads as a genuinely fitted coat,
  collar/lapels/pockets all visible; a few running frames have minor edge artifacts worth an
  eventual manual touch-up pass). Always visually QA before trusting a result from this script -
  it's meaningfully less certain than a same-shape recolor or real hand-positioning.

Each item still needs its own flat `icon.equipment.*` UI icon too (deferred separately, per
`Asset-Production-Checklist.md`'s Equipment section) - the layer sprite and the icon are two
different assets for the same item, generated independently. (All 6 items above already had their
icons from an earlier session's equipment-icon batch - that's what made both scripts possible
without any new pixellab generation.)

## Open questions for later phases

- Exact z-order when a lantern is "held" vs. worn on a belt - depends on the actual generated pose,
  decide once real lantern layer art exists.
- Whether running-animation equipment layers need their own distinct art or can reuse the walking
  layer's frames scaled/retimed - deferred until after Phase 3's walking-only pilot proves the
  workflow; likely needs its own art given the different limb positions, same as the base body's
  own real (not duplicated) run cycle.
- Female equipment art (a genuinely separate generation+alignment pass, not a resize, given
  different proportions) is deferred until after the male-only Phase 3 pilot validates the
  workflow - see Phase 3's own note.
