---
name: add_content
description: Add a new piece of game content (item, equipment, enemy, NPC, quest, or location) following the project's existing client/server data-split and asset-registry patterns. Use when the user says "add a new quest/enemy/item/NPC", "add a shop item", "add a location", or similar.
---

# Add Content

This project deliberately splits content into a **client display copy** (`src/data/*.ts`) and a
**server authoritative copy** (`functions/src/data/*.ts`) that must be kept in sync by hand (see
`CLAUDE.md` for why). Adding new content means touching both, plus the asset registry for any new
art. Missing one half is the most common way new content silently breaks — the game will *look*
right on the client but the server will reject or misprice/misbalance it.

## Steps, by content type

Ask which kind of content is being added if it's not obvious, then follow the matching checklist.
In every case, run `npm run build` (client) and `cd functions && npm run build` (functions)
afterward — both must compile clean before considering the task done.

### Item / equipment
1. Add the entry to `src/data/items.ts` or `src/data/equipment.ts` (display: name, description,
   icon asset id, stat bonuses / effect).
2. Add the matching entry to `functions/src/data/items.ts` or `functions/src/data/equipment.ts`
   (authoritative: same id, whatever fields combat/shop logic actually reads — effect for items,
   `slot` + `statBonuses` for equipment). If it's purchasable, add its price to `SHOP_PRICES` in
   `functions/src/data/items.ts` (and `src/data/items.ts`'s `SHOP_LISTINGS` for display).
3. Register its icon in `src/assets/registry.ts` (64×64, category `'icon'`). If no final art
   exists yet, generate a placeholder consistent with the existing ones (see
   `public/assets/icons/*.svg` for the pattern) and mark `status: 'placeholder'`.
4. If it should drop from an enemy, add it to that enemy's `lootTable` in
   `functions/src/data/enemies.ts` (and the display copy, for consistency, though the client copy
   isn't authoritative for drops).

### Enemy
1. Add to `functions/src/data/enemies.ts` (authoritative: stats, moves, xp/gold reward, loot
   table). If it uses a new skill, add that skill to `functions/src/data/skills.ts` first.
2. Add the matching display entry to `src/data/enemies.ts` (name, lore blurb, battle sprite asset
   id).
3. If it appears in a location's random encounters, add it to that location's `ENCOUNTER_TABLES`
   entry in `functions/src/data/enemies.ts` (and `src/data/locations.ts`'s `encounterTable` for
   display).
4. Register its battle sprite in `src/assets/registry.ts` (128×128 standard, 256×256 boss,
   category `'enemy'`).

### NPC
1. Add to `src/data/npcs.ts` — NPCs are client-only content (no server-authoritative counterpart)
   *except* for their gameplay hook: if `gameplayHook.type` is `'questGiver'`, the referenced
   quest ids must exist in both `src/data/quests.ts` and `functions/src/data/quests.ts`.
2. Register sprite + portrait in `src/assets/registry.ts`.
3. Place them on a map: add an `npc`-type object (with `refId` matching the NPC's id) to the
   relevant map JSON in `public/assets/maps/`.
4. If they're a shop or inn keeper, wire the actual shop/inn UI open in the owning scene (see how
   `TownScene.tsx` opens `Shop`/`Inn` off `gameplayHook.type` after dialogue closes).

### Quest
1. Add to `functions/src/data/quests.ts` (authoritative: objectives, `prerequisiteQuestId`,
   reward). Objective `type` must be one already handled by `advanceQuests`
   (`talkToNpc`/`defeatEnemies`/`reachLocation`/`collectItem`/`defeatBoss`) — if the quest needs a
   new trigger type, that's a bigger change (a new Cloud Function call site advancing quests, see
   `talkToNpc.ts`/`enterLocation.ts`/`collectWorldItem.ts`/`resolveCombatAction.ts` for the
   pattern), not just a data entry.
2. Add the matching display entry to `src/data/quests.ts` (name, description, per-objective
   description text).
3. If the quest gates something beyond normal objective completion (like the boss fight's
   `BOSS_PREREQUISITE_QUEST` check in `startEncounter.ts`), wire that check explicitly — quest
   completion alone doesn't automatically unlock anything except the *next* quest in the
   prerequisite chain.

### Location
1. Add to `src/data/locations.ts` and, if it needs one, `functions/src/data/enemies.ts`'s
   `ENCOUNTER_TABLES`.
2. Author a Tiled-schema JSON map in `public/assets/maps/` (see the existing three for the exact
   shape — hand-authored, not exported from the Tiled editor, but valid against the same schema
   `src/assets/tiledLoader.ts` parses). Needs at least one `spawnPoint` object and, to be reachable
   at all, a `transition` object on an existing map pointing to it.
3. Register the new scene if it's a new *kind* of location (town/overworld/dungeon already have
   scene components; a fourth kind would need a new scene component following the pattern of
   `TownScene.tsx`/`OverworldScene.tsx`/`DungeonScene.tsx`) plus a case in `src/App.tsx`'s switch
   and an entry in `LOCATION_KIND_TO_SCENE` (`useLocationExploration.ts`, `CombatScene.tsx`).

## Verification

After adding content, actually exercise it — don't just confirm both builds compile. Use
`/run_local start`, sign in, and reach the new content in play (or use the direct
Cloud-Function-over-HTTP pattern from prior sessions if faster: sign up via the Auth emulator's
REST API, then POST to the relevant callable function and inspect the Firestore emulator's
resulting document). Stop the local environment (`/run_local stop`) when done.
