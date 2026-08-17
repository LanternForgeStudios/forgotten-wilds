# Audio Usage Tracker

Tracks what got wired into the game during the 2026-08-16 audio overhaul, what's sitting in the
library still unused, and — specifically for the Helton Yan Pixel Combat pack — what's wired vs.
available vs. actually committed to git, since that pack is too large to commit in full (see
"Helton Yan reconciliation" below). Every asset id here is registered in `src/assets/registry.ts`;
this doc is the narrative/reconciliation layer on top, not a replacement for reading the registry's
own per-entry `notes`.

## Music

### Region / town / dungeon assignments

Every `Location` in `src/data/locations.ts` can carry a `musicAssetId` (client-only field — music
is presentation, not combat math, so it's deliberately not mirrored into `functions/src/data/`).
Omitted means "use the scene's kind-based default" (`music.town` / `music.overworld` /
`music.dungeon`, the three original placeholder tracks). `TownScene`/`OverworldScene`/
`DungeonScene` each look this up on `locationId` and re-run on location change.

Two patterns are shared **across every region on purpose**, not left unassigned by oversight:
- Every `*-lantern-sanctuary` dungeon → `music.holy-sanctuary` (same narrative beat each region:
  the Keeper's Lantern upgrade shrine).
- Every `guardian-*` dungeon → `music.calm-before-storm` (same beat each region: the pre-Guardian-
  boss gauntlet).

| Volume | Town | Overworld zones | Dungeons |
|---|---|---|---|
| I — Ash Hallow / Iron Mountains | *(left on `music.town` default — see note below)* | *(left on `music.overworld` default)* | Hollow Rail Mine → `music.dwarven-mine` |
| II — Crimson Bayou | Mirehaven → `music.port-town` | Cypress Marsh, Mother Cypress Shrine → `music.spirits-forest`; Murkwater Trails, Hidden River Landing → `music.silent-forest` | Temple of the Deep Current → `music.temple-of-the-deep` |
| III — Endless Prairie | Highwind Crossing → `music.mighty-kingdom` | Golden Prairie, Spirit Herd Plains, Stone Circle Valley/Carvings → `music.winds-roam`; Sacred Hills, Thunderbird Mesa Approach → `music.traveling-sky` | Summit Temple → `music.pyramid`; Sky Bridge, Storm Galleries → `music.calm-before-storm`; Lantern Sanctuary → `music.holy-sanctuary`; Guardian Peak → `music.calm-before-storm` |
| IV — Whispering Pines | Cedarwatch → `music.wood-forest-town` | Mistwood Path, Elder Forest → `music.the-journey`; Silver River, Ancient Cedar Shrine, Heartwood Approach → `music.unknown-island` | Root Caverns → `music.hidden-cavern`; Inner Archive → `music.ancient-library`; Heartwood Lantern Sanctuary → `music.holy-sanctuary`; Guardian Grove → `music.calm-before-storm` |
| V — Shattered Desert | Red Mesa → `music.east-town` | Sunfire Dunes, Crimson Canyons → `music.never-give-up`; Painted Mesas, Celestial Oasis, Forgotten Observatory Approach → `music.pyramid` | Inner Observatory → `music.old-magician`; Star Chamber → `music.temple-of-the-deep`; Star Lantern Sanctuary → `music.holy-sanctuary`; Canyon Depths → `music.dangerous-cave`; Guardian Summit → `music.calm-before-storm` |
| VI — Frozen Frontier | Frosthaven → `music.firelight-town` | Snowveil Forest, Frozen River → `music.peaceful-night`; Glacier Pass, Aurora Basin, Hall of Eternal Winter Approach → `music.the-journey` | Hall of Eternal Winter, Summit of Winter → `music.frozen-abyss`; Winter Lantern Sanctuary → `music.holy-sanctuary`; Guardian Chamber → `music.calm-before-storm`; Hall of Memories → `music.ancient-library` |

**Why Book One's town/overworld are untouched**: Ash Hallow and Ironwood Trail/Raven Ridge/Whisper
Falls/Black Briar Forest already had the very first, most-heard tracks in the game
(`music.town`/`music.overworld` — "Enchanted Woods"/"Tiefsee") and swapping the flagship town's
theme felt like the wrong call without the owner's sign-off. Hollow Rail Mine got upgraded anyway
(`music.dwarven-mine`) since it's a literal, high-confidence win over the generic dungeon default
and low-risk (Book One's dungeon track was never distinctive to begin with).

### Subarea music (landmarks within a shared map)

A few landmarks are walked into via a `zone` map object on the *same* map as their parent region,
not reached through a scene transition (`Location.parentLocationId` set, same `mapAssetId` as the
parent — see `src/types/location.ts`'s own doc comment). Only three of these are real walk-in
areas today (everywhere else, a "landmark" is a single-point shrine/pickup with no area to loiter
in, so ambient subarea music doesn't apply — see `ZONE_LANDMARK_KIND` in `OverworldScene.tsx`):

| Subarea | Parent | Track |
|---|---|---|
| Hunter's Camp | Ironwood Trail | `music.peaceful-village` |
| Spirit Grove | Ironwood Trail | `music.lost-shrine` |
| Mossy Creek | Ironwood Trail | `music.peaceful-night` |

**How it works**: `ExplorationScene.ts` tracks the live set of `zone` refIds the player's body is
currently overlapping (`activeZoneRefIds`, recomputed every `checkZoneAndTransitionOverlaps` call)
and fires `onActiveZonesChange` whenever that set changes — on both entry *and* exit, unlike the
pre-existing `onZoneEnter` (leading-edge only, used for one-shot pickup/shrine interactions).
`OverworldScene.handleActiveZonesChange` looks up whichever active refId matches a `Location` with
`parentLocationId` equal to the current location and a `musicAssetId`, and switches to it; leaving
the zone (empty set, or a zone with no `musicAssetId`) reverts to the parent region's own track.
The mechanism is generic and map-agnostic — adding a fourth subarea anywhere in the game is just a
`musicAssetId` on its `Location` entry, no scene code changes needed.

### Music available in the library but not yet wired

Both new packs have tracks left over — kept for future use (a boss-fight rotation, a title-screen
refresh, victory fanfares) rather than forced into a slot that doesn't fit:

- **`28 High Quality 16-bit RPG Music`** (12 of 26 unused): the 4 Battle Theme sets (I–IV, each
  full/intro/loop), Lively City, Royal Castle, Long Journey, Goofy Monster, Volcanic Crater,
  Military Base, Malicious Scheme, Dark Factory, Demon King Castle (full/intro/loop), The Evil One.
- **`xDeviruchi`** (11 of 22 unused): Falling Apart (Prologue), Title Theme, Battle 1, Victory!,
  Shop, Battle 2, Decisive Battle 1, Decisive Battle 2, Final Battle, The Final of The Fantasy.
  (Most of what's left is battle/victory/title-purposed — doesn't fit an exploration-bed slot,
  which is why it's unused rather than an oversight.)

Both packs are committed in full under `public/assets/audio/library/music/` (small enough not to
need the Helton-Yan-style local-only treatment — see below).

## SFX

### Wired this pass

| Category | Ids | Source pack |
|---|---|---|
| Weapon hit (5, one per `WeaponType`) | `sfx.weapon.{sword,staff,axe,spear,hammer}` | sword/staff → Free Fantasy SFX Pack; axe/spear/hammer → Helton Yan |
| Ailment hit (6) | `sfx.ailment.{burn,freeze,stun,poison,blind,silence}` | burn/freeze/stun → Free Fantasy; poison/blind/silence → Helton Yan |
| Generic spirit hit | `sfx.skill.spirit-generic` | Free Fantasy |
| Lantern ability (7, full coverage) | `sfx.lanternAbility.*` | mixed Free Fantasy / Helton Yan — see each entry's registry note |
| Footsteps (8: 4 surfaces × walk/run) | `sfx.footstep.{dirt,stone,water,wood}.{walk,run}` | Free Fantasy |

Surface-by-location mapping lives in `src/utils/footstepSurface.ts` (dungeons → stone, town
interiors → wood, Crimson Bayou → water, Shattered Desert/Frozen Frontier overworld → stone,
everything else → dirt). Playback throttling (350ms walk / 220ms dash) is in
`ExplorationScene.ts`'s `syncAfterPhysicsStep`.

### Combat SFX/VFX bug fixes and additions (2026-08-16, second pass)

Fixed a real bug: `CombatScene.tsx`'s `act()` had a doc comment describing weapon-type SFX for the
plain `'attack'` action, but the actual `if/else if` chain never checked `type === 'attack'` at
all - every basic attack played the generic `sfx.combat-hit` "thud" regardless of equipped weapon,
which is what a player would notice first. Added the missing branch.

| Category | Ids | Source pack |
|---|---|---|
| Enemy hit, incoming (4 shared groups) | `sfx.enemy-hit.{beast,earthen,spirit,boss}` | Helton Yan |
| Item-use, by consumable type (3; ailment cure reuses the existing `sfx.item-use`) | `sfx.item-use.{hp,spirit,oil}` | Helton Yan |

`src/utils/enemyHitGroup.ts` maps every `Enemy.family` to one of 4 shared hit-SFX/VFX groups
(`beast`/`earthen`/`spirit`, plus `boss` which always wins regardless of family) - used identically
by `CombatScene.tsx`, `EndlessBattlePanel.tsx`, and `PvpBattlePanel.tsx` (PvP has no `Enemy`/family
for a human opponent, so it always uses `earthen`, the plainest physical-hit group). Enemy attacks
now play their group's SFX **and** burst a matching VFX (`BattleScene.ts`'s `ENEMY_HIT_FX_ASSET`)
staggered per-attacker, in step with the existing per-attacker lunge animation - previously a
multi-enemy round played one flat `sfx.combat-hit` no matter how many enemies attacked or what
kind they were, with zero incoming-hit VFX burst at all.

Also fixed the "spirit specialty" visual complaint directly: a spirit-damageType Skill tied to a
specific ailment (Marsh Toxin → poison, Ember Burst → burn, Frost Lance → freeze, etc.) previously
only showed its themed color the round the ailment roll actually succeeded - every other landed hit
fell back to a single generic "purple" `fx.magic-spark` burst regardless of the skill's own
identity. `CombatScene.tsx` now computes a `themedAilmentId` for any such skill and passes it
through to `BattleScene.playOutgoingHits`, which always bursts that ailment's own FX
(`AILMENT_FX_ASSET`) for a landed hit - an actual ailment proc still layers the bigger, separate
`playEnemyAilmentTakesHold` burst on top, so the routine case reads as themed-but-normal and an
actual proc reads as themed-and-bigger, not "colorless until it procs."

Two more physical-hit/intensity changes, both in `src/phaser/battleEffects.ts`:
- `playSlashEffect`/`ensureSlashTexture`: a procedurally generated (no new art asset) diagonal
  slash streak that plays a beat before a physical hit's blood-splatter burst - "weapon makes
  contact" then "the payoff," instead of both firing in the same instant.
- `fxIntensityFor(damage, referenceMaxHp)`: scales every hit-FX burst's particle count/size by how
  big the hit was relative to the target's (or player's) own max HP - floored well above the old
  fixed defaults so even a weak hit still reads as a real hit, not just "more of the same small
  particles" for a strong one. Applied to both outgoing (`playOutgoingHits`) and incoming
  (`playIncomingHits`) bursts.

### Available in the library but not yet wired

The Free Fantasy SFX Pack (~400 files, fully committed) has entire untouched categories:
elemental spell variants beyond the ones picked (Fireball 2+, Ice Freeze 2+, etc.), bow attack
hits/blocks (no bow `WeaponType` exists in this game, so intentionally unused), ambient loops, UI
cues, and additional footstep numbered variants (only variant `1` of each surface/gait is wired;
2–5 are staged for whenever footstep audio wants more randomized variety instead of the same
sample every step).

## Helton Yan reconciliation

The Helton Yan Pixel Combat pack (1,854 files after dropping its Explosion category) is **not**
committed in full — at ~96kHz/24-bit WAV it would have added several GB to the repo for content
that's almost entirely unused. It's gitignored (`.gitignore` line for
`public/assets/audio/library/sfx/helton-yan-pixel-combat/`) and stays **local-only** on this
machine.

- **Committed**: 17 derived clips, each resampled to this project's usual 44.1kHz/16-bit and copied
  to `public/assets/audio/sfx/` under this game's own naming. Original 10: `weapon-axe.wav`,
  `weapon-spear.wav`, `weapon-hammer.wav`, `ailment-poison.wav`, `ailment-blind.wav`,
  `ailment-silence.wav`, `lantern-ability-still-waters-calm.wav`,
  `lantern-ability-open-skies-renewal.wav`, `lantern-ability-astral-ward.wav`,
  `lantern-ability-resolve-renewed.wav`. Added this pass: `enemy-hit-beast.wav`,
  `enemy-hit-earthen.wav`, `enemy-hit-spirit.wav`, `enemy-hit-boss.wav`, `item-use-hp.wav`,
  `item-use-spirit.wav`, `item-use-oil.wav`. Each one's registry `notes` field records the exact
  source filename inside the pack, so a future session can re-derive it even without the pack
  present.
- **Available, not committed**: the other ~1,837 files, still on disk locally for whenever a
  future SFX need comes up (more weapon variants, monster-specific hit cues, UI sounds). If this
  machine's local copy is ever lost, the pack would need to be re-downloaded/re-extracted before
  any of those "available but unused" files could be picked from again — only the 17 already-wired
  derivatives survive that.
- **Reconciling later**: search `src/assets/registry.ts` for `helton` (case-insensitive) to find
  every currently-wired id sourced from this pack — that grep is the authoritative "what's wired"
  list; this doc's table above is a snapshot of it as of 2026-08-16.
