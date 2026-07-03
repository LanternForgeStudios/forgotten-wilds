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
- **Existing real art to match**: `public/assets/tilesets/tiny-dungeon.png` and
  `public/assets/ui/panel-border-*.png` (Kenney, CC0) are already final — use them as a palette/
  pixel-density reference. Everything else listed below is currently a generated placeholder
  (a colored box with a text label) and is what needs replacing.
- **Format**: PNG with transparency where the shape isn't a full rectangle (portraits, icons,
  battle/enemy sprites, character sprites). Battle backgrounds are full-bleed, no transparency
  needed.

## Priority order (highest visual impact first)

1. **Battle backgrounds** (3) — full-screen, on camera during every single fight.
2. **Character sprites & portraits** (11) — on camera constantly; currently just colored boxes
   with two-letter labels, the single biggest "placeholder" tell in the game.
3. **Enemy battle sprites** (7) — on camera during every fight.
4. **Icons** (25) — smaller/lower-impact individually, but there are a lot of them; fine to batch
   in a consistent icon style once the above are done.

Tilesets and UI panels are already real CC0 art — only redo those if you want a different overall
look, it's not required.

## Shot list

### `art-staging/backgrounds/` — 1280×720, full-screen static

| Asset id | Description |
|---|---|
| `battle-bg.forest` | Ironwood Trail encounters — haunted ridge forest |
| `battle-bg.dungeon` | Hollow Rail Mine encounters — abandoned mine interior |
| `battle-bg.shrine` | Reserved for future content — forgotten shrine |

### `art-staging/characters/` — 32×32 per frame, sprite sheet

Ideally a 4-direction (up/down/left/right) walk cycle + idle, but even a single idle frame per
character is a real upgrade over the current placeholder — full animation can follow later.

| Asset id | Character |
|---|---|
| `sprite.player` | The player character (customizable appearance not required for MVP - one look is fine) |
| `sprite.npc.elias-rowan` | Elias Rowan, Lantern Keeper mentor (older, weathered, keeper's coat) |
| `sprite.npc.mara-vale` | Mara Vale, general store owner |
| `sprite.npc.silas-flint` | Silas Flint, retired miner |
| `sprite.npc.juniper-reed` | Juniper Reed, innkeeper |
| `sprite.npc.nell-ashby` | Nell Ashby, young folklore collector |

### `art-staging/portraits/` — 512×512, dialogue portraits

Semi-painted JRPG style, consistent lighting/framing across all five so they read as one cast.

| Asset id | Character |
|---|---|
| `portrait.elias-rowan` | Elias Rowan |
| `portrait.mara-vale` | Mara Vale |
| `portrait.silas-flint` | Silas Flint |
| `portrait.juniper-reed` | Juniper Reed |
| `portrait.nell-ashby` | Nell Ashby |

### `art-staging/enemies/` — 128×128 standard, 256×256 boss

Battle sprite only (these enemies don't appear on the overworld map, only in combat).

| Asset id | Size | Enemy |
|---|---|---|
| `battle.enemy.mothling` | 128 | Mothling — pale, moon-winged |
| `battle.enemy.greater-mothling` | 128 | Greater Mothling — elder, faintly glowing wingscales |
| `battle.enemy.restless-miner` | 128 | Restless Miner — a shade in coveralls |
| `battle.enemy.foreman-wraith` | 128 | Foreman Wraith — the mine foreman, still counting shifts |
| `battle.enemy.coal-spirit` | 128 | Coal Spirit — smoldering ember given shape |
| `battle.enemy.coal-wraith` | 128 | Coal Wraith — hardened, angrier coal spirit |
| `battle.enemy.coalbound-warden` | 256 | **Boss.** Vast, ember-lit, bound to the mine by grief |

### `art-staging/icons/` — 64×64 (32×32 for the four currencies)

| Asset id | Size | Item |
|---|---|---|
| `icon.item.healing-poultice` | 64 | Healing Poultice |
| `icon.item.spirit-draught` | 64 | Spirit Draught |
| `icon.item.lantern-oil` | 64 | Lantern Oil |
| `icon.item.moth-dust` | 64 | Moth Dust (creature drop) |
| `icon.item.rusted-token` | 64 | Rusted Token (creature drop) |
| `icon.item.ember-shard` | 64 | Ember Shard (creature drop) |
| `icon.item.miners-lost-lantern` | 64 | The Miner's Lost Lantern (quest key item) |
| `icon.item.wardens-ember-heart` | 64 | Warden's Ember Heart (boss drop) |
| `icon.equipment.miners-pick` | 64 | Miner's Pick (weapon) |
| `icon.equipment.keepers-lantern-staff` | 64 | Keeper's Lantern-Staff (weapon) |
| `icon.equipment.travelers-coat` | 64 | Traveler's Coat (armor) |
| `icon.equipment.ironwood-vest` | 64 | Ironwood Vest (armor) |
| `icon.equipment.worn-trail-boots` | 64 | Worn Trail Boots |
| `icon.equipment.ridge-runner-boots` | 64 | Ridge-Runner Boots |
| `icon.equipment.frayed-gloves` | 64 | Frayed Gloves |
| `icon.equipment.miners-leather-gloves` | 64 | Miner's Leather Gloves |
| `icon.equipment.ash-hallow-token` | 64 | Ash Hallow Token (charm) |
| `icon.equipment.moonlit-charm` | 64 | Moonlit Charm |
| `icon.equipment.keepers-lantern` | 64 | Keeper's Lantern (starting lantern) |
| `icon.equipment.miners-lost-lantern-equipped` | 64 | The Miner's Lantern (equipped relic) |
| `icon.equipment.carved-totem` | 64 | Carved Totem (spirit totem) |
| `icon.currency.gold` | 32 | Gold |
| `icon.currency.spirit-essence` | 32 | Spirit Essence |
| `icon.currency.festival-tokens` | 32 | Festival Tokens (placeholder currency, unused) |
| `icon.currency.premium-currency` | 32 | Premium Currency (placeholder, unused) |

### `art-staging/tilesets/` and `art-staging/ui/` — optional

Already real CC0 art (Kenney). Only replace if you want a different overall look:

- `tileset.tiny-dungeon` — 192×176, 12×11 grid of 16×16 tiles
- `ui.panel-border-default` / `ui.panel-border-accent` — 48×48, 9-slice panel borders
