# Art Staging

Drop finished art here. When you're ready, tell Claude (or run `/swap_assets`) and it'll verify
each file, move it into `public/assets/`, update `src/assets/registry.ts` (path + `status:
'final'`), and rebuild to confirm it actually renders. You don't need to use the exact final
filenames below — just drop files into the matching subfolder and leave any note that helps map
"this file" → "this asset" if it isn't obvious from the filename.

## Style guide

- **Mood**: mysterious, folkloric, adventurous, cozy. Appalachian-inspired Iron Mountains — mining
  towns, abandoned railways, haunted forests, waterfalls, caves, forgotten shrines.
- **Look**: painterly SNES/PS1-era pixel art, warm lantern lighting, muted earth tones.
- **Existing real art to match**: `public/assets/tilesets/tiny-dungeon.png`,
  `public/assets/ui/panel-border-*.png` (Kenney, CC0), the 7 battle backgrounds + 4 cutscene/title
  backgrounds under `public/assets/backgrounds/`, the 15-effect FX pack under
  `public/assets/tilesets/fx_pack/`, and the two player skin images (`player-male.png`/
  `player-female.png`) are all already final — use them as a palette/pixel-density/lighting
  reference. Everything else listed below is currently a generated placeholder (a colored box with
  a text label) and is what needs replacing.
- **Format**: PNG with transparency where the shape isn't a full rectangle (portraits, icons,
  battle/enemy sprites, character sprites). Battle backgrounds are full-bleed, no transparency
  needed.

## Priority order (highest visual impact first)

Battle backgrounds are already done (see above) — the biggest remaining "placeholder" tells are:

1. **Character sprites & NPC portraits** (14 NPCs + the base player walk sheet) — on camera
   constantly; currently just colored boxes with two-letter labels.
2. **Enemy battle sprites** (13) — on camera during every fight.
3. **Icons** (50: items/equipment/ailments/currency) — smaller/lower-impact individually, but
   there are a lot of them; fine to batch in a consistent icon style once the above are done.
4. **Structures & tilesets** — optional/lower priority. Most tilesets are already real (if
   unconfirmed-license) uploaded packs, several not yet wired into any map; see "Lower priority"
   below for what's actually worth spending time on here.

## Shot list

### `art-staging/backgrounds/` — DONE, no action needed

7 battle backgrounds (`battle-bg.forest`, `.shrine`, `.ironwood-trail`, `.raven-ridge`,
`.whisper-falls`, `.black-briar-forest`, `.hollow-rail-mine`) plus 4 cutscene/title backgrounds
(`background.title-screen`, `.defeat-cutscene`, `.quest-rekindling-spirit-grove`,
`.quest-the-mountain-remembers`) are all real, final art. Only revisit if a *new* location or
cutscene needs a background that doesn't exist yet.

### `art-staging/characters/` — 32×32 per frame, sprite sheet (NPCs); see note below for the player

Ideally a 4-direction (up/down/left/right) walk cycle + idle, but even a single idle frame per
character is a real upgrade over the current placeholder — full animation can follow later.

| Asset id | Character |
|---|---|
| `sprite.npc.elias-rowan` | Elias Rowan, Lantern Keeper mentor |
| `sprite.npc.mara-ash` | Mara Ash, general store owner |
| `sprite.npc.finn-rowan` | Finn Rowan |
| `sprite.npc.silas-flint` | Silas Flint, retired miner |
| `sprite.npc.juniper-reed` | Juniper Reed, innkeeper |
| `sprite.npc.nell-ashby` | Nell Ashby, young folklore collector |
| `sprite.npc.aldren-stone` | Aldren Stone |
| `sprite.npc.tessa-ironhand` | Tessa Ironhand |
| `sprite.npc.willow-briar` | Willow Briar |
| `sprite.npc.historian-miriam` | Historian Miriam |
| `sprite.npc.mayor-eleanor-ashcroft` | Mayor Eleanor Ashcroft |
| `sprite.npc.hunter-garrick` | Hunter Garrick |
| `sprite.npc.spirit-child` | Spirit Child |
| `sprite.npc.ranger-caleb` | Ranger Caleb |

**Player character** — already partly done: `sprite.player.male`/`sprite.player.female` (single
static 48×64 frames, real user art, already live in the skin picker at character creation and
Profile → Skin) replaced the old generic placeholder. The remaining gap is `sprite.player` itself
— a 4-direction walk **animation** sheet (8 rows × 4 frames of 32×32) to replace the current
single-frame look with real walk-cycle motion for both skins. You mentioned doing this one
yourself with real animation frames when ready; no rush on it.

### `art-staging/portraits/` — 512×512, dialogue portraits

Semi-painted JRPG style, consistent lighting/framing across all so they read as one cast. One
portrait per NPC above, same character list, same ids (`portrait.<npc-id>` — e.g.
`portrait.elias-rowan`).

### `art-staging/enemies/` — 128×128 standard, 256×256 boss

Battle sprite only (these enemies don't appear on the overworld map, only in combat). This is the
close-up battle-stage size convention (`BattleScene.ts`'s own 128/192/256 regular/elite/boss
scaling) — not the smaller tile-grid-scaled sizes that would apply to a walking map sprite.

| Asset id | Size | Enemy |
|---|---|---|
| `battle.enemy.mothling` | 128 | Mothling — pale, moon-winged |
| `battle.enemy.greater-mothling` | 128 | Greater Mothling — elder, faintly glowing wingscales |
| `battle.enemy.restless-miner` | 128 | Restless Miner — a shade in coveralls |
| `battle.enemy.foreman-wraith` | 128 | Foreman Wraith — the mine foreman, still counting shifts |
| `battle.enemy.coal-spirit` | 128 | Coal Spirit — smoldering ember given shape |
| `battle.enemy.coal-wraith` | 128 | Coal Wraith — hardened, angrier coal spirit |
| `battle.enemy.cliff-wolf` | 128 | Cliff Wolf — lean, sure-footed ridge predator |
| `battle.enemy.ridge-hawk` | 128 | Ridge Hawk — sharp-eyed cliff raptor |
| `battle.enemy.pool-wisp` | 128 | Pool Wisp — a light that lingers over still water |
| `battle.enemy.falls-siren` | 128 | Falls Siren — a voice under the waterfall's roar |
| `battle.enemy.briar-wraith` | 128 | Briar Wraith — thorned, tangled shade |
| `battle.enemy.cemetery-shade` | 128 | Cemetery Shade — a grief given form |
| `battle.enemy.coalbound-warden` | 256 | **Boss.** Vast, ember-lit, bound to the mine by grief |

### `art-staging/icons/` — 64×64 (32×32 for the four currencies)

**Items (20)**: `icon.item.healing-poultice`, `.spirit-draught`, `.lantern-oil`, `.moth-dust`,
`.rusted-token`, `.ember-shard`, `.wolf-fang`, `.silver-droplet`, `.withered-bramble`,
`.stone-fragment`, `.water-fragment`, `.wind-fragment`, `.miners-lost-lantern`,
`.wardens-ember-heart`, `.antidote` (cures Poison), `.burn-salve` (cures Burn), `.thaw-crystal`
(cures Freeze), `.eye-drops` (cures Blind), `.echo-herb` (cures Silence),
`.guardian-memory-fragment-1`. Note: the tiered potion upgrades (Superior/Pristine Healing
Poultice, Greater/Superior/Pristine Spirit Draught, etc.) reuse their base item's icon rather than
getting a unique one each — only redo those 3 base icons if you want the tier upgrade to look
visually distinct too (not required).

**Equipment (20)**: `icon.equipment.weathered-walking-staff`, `.ironwood-walking-staff`,
`.spiritwood-walking-staff`, `.worn-keeper-coat`, `.reinforced-keeper-coat`,
`.veteran-keeper-coat`, `.traveler-boots`, `.trail-boots`, `.ranger-boots`, `.work-gloves`,
`.leather-gauntlets`, `.keepers-gauntlets`, `.river-stone-charm`, `.mountain-knot`,
`.ghost-miners-coin`, `.keepers-lantern`, `.miners-lost-lantern-equipped`, `.stone-wolf-totem`,
`.mountain-guardian-totem`, `.travelers-cloak`.

**Ailment status icons (6)**: `icon.ailment.poison`, `.burn`, `.freeze`, `.stun`, `.blind`,
`.silence` — small badges shown on the combat ailment strip.

**Currency (4)**: `icon.currency.gold` (32×32), `.spirit-essence` (32×32),
`.festival-tokens`/`.premium-currency` (32×32, both unused placeholders reserved for future
systems — low priority).

### Lower priority / optional

- **`art-staging/tilesets/`** — `tileset.tiny-dungeon` is already real CC0 art and in active use.
  Everything else under `public/assets/tilesets/` (the 8-piece numbered dungeon interior set, the
  Velmora packs, beach/cliff/farmland/graveyard/grassland sets, the 12 uploaded NPC sheets, etc.)
  is uploaded but **not yet wired into any map** — provenance/license unconfirmed on most of it.
  Only worth revisiting once a specific map actually needs one of these, since redoing unused art
  is wasted effort.
- **Waypoint & well structures** — `structure.waypoint-1-dark`/`-1-white`/`-2-dark`/`-2-white` and
  `structure.well-1-dark`/`-1-white`/`-2-dark`/`-2-white` are real uploaded art (not generated
  placeholders), cataloged in the registry, but not wired into any gameplay system yet — no
  fast-travel or rest-point feature exists to use them. Each waypoint/well folder also has 6-frame
  idle/activation (or health/mana fill) animation sequences on disk, one PNG per frame rather than
  a spritesheet; those get cataloged once that feature is actually built and an animation-loading
  approach is picked.
- **`art-staging/ui/`** — `ui.panel-border-default`/`ui.panel-border-accent` are already real CC0
  art (Kenney). Only replace if you want a different overall UI look.
