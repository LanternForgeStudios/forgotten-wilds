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
See `docs/pixellab-asset-ids.md` for each variant's pixellab character id. Not yet rendered
anywhere in-game (no render call site resolves `sprite.player.base.*` yet - that's Phase 2/3
below); the *existing* `sprite.player.male`/`.female` (fully-clothed) ids are still what actually
renders today and should NOT be swapped out until there's a rendering path plus at least
placeholder-free layer art for the starter loadout.

**Next up**: Phase 2 (rendering infrastructure - stack equipment-layer sprites on the base body,
verified with a placeholder layer) is the next real step; the 4-appearance picker UI
(CharacterCreationScene, UserProfile Skin tab) can also be built out now that real preview art
exists for all 8 combinations, ahead of or alongside Phase 2.

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

**Phase 1 (in progress)**: generate + build the two base bodies. No visual change yet - nothing
switches over to them until there's a rendering path and at least placeholder-free art for the
starter loadout (Phase 3/4).

**Phase 2**: build the rendering infrastructure above with zero real layer art - verify a player
renders identically to today (base body alone, no layers) and that the plumbing (equipment state →
resolved layer list → stacked sprites) works end-to-end with a single test placeholder layer
(even a solid-color rectangle sprite) before spending art-generation effort.

**Phase 3 (pilot)**: pick ONE full loadout (e.g. the Prologue starter kit - `travelers-cloak`,
`weathered-walking-staff`, `traveler-boots`, `work-gloves`, `keepers-lantern`) and take it all the
way through: generate, align via the offset-tuning workflow above, verify in-game on both skins.
This proves/refines the alignment workflow on a small, real slice before committing to all 19
existing equipment items (soon more, once Mythic/Legendary tiers get built out per
`functions/src/data/equipment.ts`'s own stubbed-for-later comment).

**Phase 4**: roll out the remaining equipment families (walking-staff, keeper-coat,
traveler-boots, work-gloves lines, the second unique lantern) using the now-proven pipeline. Each
item still needs its own flat `icon.equipment.*` UI icon too (deferred separately, per
`Asset-Production-Checklist.md`'s Equipment section) - the layer sprite and the icon are two
different assets for the same item, generated independently.

## Open questions for later phases (not blocking Phase 1)

- Exact z-order when a lantern is "held" vs. worn on a belt - depends on the actual generated pose,
  decide once real lantern layer art exists.
- Whether running-animation equipment layers need their own distinct art or can reuse the walking
  layer's frames scaled/retimed - likely needs its own art given the different limb positions,
  same as the base body's own real (not duplicated) run cycle.
- Female-skin equipment art is a full second set per item (proportions differ) - doubles Phase 4's
  actual generation+alignment work, not just a resize.
