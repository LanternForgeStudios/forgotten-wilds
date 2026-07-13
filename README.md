# Forgotten Wilds

**[Play it live](https://lanternforgestudios.github.io/forgotten-wilds/)**

A browser-based JRPG set in Mytherra's Iron Mountains. Single-player exploration, turn-based
combat, and quests today; live town presence, friends/messaging, and player-to-player trading
now, with clean seams for future party/chat/lodge/world-event systems. See
`Forgotten-Wilds_Requirements.txt` for the full design brief.

Frontend: React + TypeScript + Vite. Backend: Firebase (Auth, Firestore, Cloud Functions). The
cloud is the source of truth — the client never writes game state directly; every mutation
(combat, shop, inn, equipment, quests) goes through a Cloud Function, and Firestore security
rules deny direct client writes to `users/{uid}` and `combatSessions/{uid}` entirely.

## Prerequisites

- Node.js 20+
- A Firebase project (Firestore + Authentication + Functions, on the Blaze plan — Cloud Functions
  require it, though usage should stay within the free tier for development)
- Firebase CLI: `npx firebase-tools --version` (no global install needed, `npx` works)

## Setup

1. Install client dependencies:
   ```
   npm install
   ```
2. Install Cloud Functions dependencies:
   ```
   cd functions && npm install && cd ..
   ```
3. Copy `.env.example` to `.env.local` and fill in your Firebase web app config (Firebase console →
   Project settings → General → Your apps → SDK setup and configuration). `.env.local` is
   git-ignored — never commit real credentials.
4. In the Firebase console for your project:
   - Enable **Authentication** providers: Google and Email/Password.
   - Create a **Firestore** database (production mode is fine — `firestore.rules` locks it down).
   - Add your local dev domain and your eventual GitHub Pages domain under Authentication →
     Settings → Authorized domains.

## Local development

Run the Firebase Emulator Suite and the Vite dev server side by side — `VITE_USE_FIREBASE_EMULATORS=true`
in `.env.local` points the client at the emulators instead of production, so local development
never touches real data:

```
npx firebase-tools emulators:start --only auth,firestore,functions
npm run dev
```

Emulator UI: http://127.0.0.1:4000. Vite dev server: http://localhost:5173/forgotten-wilds/.

## Building & deploying

- Client build: `npm run build` (outputs to `dist/`, base path `/forgotten-wilds/` for GitHub
  Pages — see `vite.config.ts`).
- Deploy Cloud Functions + Firestore rules to production: `npx firebase-tools deploy --only
  functions,firestore:rules` (requires `firebase login` and billing enabled on the project).
- The client deploys to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.

## Project structure

- `src/scenes/` — Title, Character Creation, Town, Overworld, Dungeon, Combat
- `src/components/` — DialogueBox, CharacterMenu (Inventory/Equipment), Shop, Inn, JournalOfLegends
  (Quests/Locations/Creatures/Lore/Bosses tabs — the Quest Log was folded into its Quests tab),
  PlayerHUD, ToastHost (transient quest-progress notifications), MiniMap (player-invoked, M key or
  the mobile Map button — canvas-drawn player position/buildings/opened chests/exits/toggleable
  quest markers, see `src/hooks/useMapOverlay.ts` for its open/close/suspend wiring), and shared UI
  (`common/Panel` — the 9-slice panel used everywhere; `common/OverlayCloseButton` — the corner
  close button every top-level overlay panel uses)
- `src/data/` — display-only seed data (items, equipment, enemies, NPCs, quests, locations, lore)
- `src/assets/` — the Asset Manager and registry (`registry.ts`); every sprite/tileset/icon/map
  is looked up by id here, never imported by file path directly. See `public/CREDITS.md` for
  what's real CC0 art (Kenney.nl) vs. generated placeholder. Maps are authored in (a subset of)
  the Tiled editor's JSON export format — see `docs/Tiled-Map-Authoring.md` for the supported
  layer model and required export settings.
- `functions/src/data/` — the **authoritative** copies of the same content (prices, stats, loot,
  quest definitions) that the client's copies must stay in sync with by hand; the client copies
  are for display only and are never trusted for anything that persists.
- `functions/src/engine/` — pure combat/quest/equipment logic, unit-tested independent of
  Firestore (`cd functions && npm test`, Vitest).
- `functions/src/functions/` — the callable Cloud Functions (one file per function; see
  `functions/src/index.ts` for the current exported list, which grows over time).
- `src/multiplayer/` — typed stub interfaces (party, lodges, world events, clan) for systems not
  built yet; every function throws "not implemented," ready to be filled in. Trading and chat
  (formerly stubs here) are fully implemented - see `functions/src/functions/trade.ts` and
  `functions/src/functions/worldChat.ts`.
- `src/phaser/` — Phaser 4 owns the canvas-based rendering for exploration (`ExplorationScene.ts`,
  driven by `src/components/exploration/PhaserExplorationCanvas.tsx`, which `TileGrid.tsx`
  re-exports so Town/Overworld/Dungeon all get it via one import), combat (`BattleScene.ts`,
  driven by `src/components/combat/PhaserBattleCanvas.tsx`), and cutscenes (`CutsceneScene.ts`,
  driven by `src/components/cutscene/PhaserCutsceneCanvas.tsx`) — background, map tiles, sprites,
  camera, hit/defeat effects. Every menu/overlay (Journal, Shop, Inventory, the action-selection
  panels, the cutscene text box) stays ordinary React+CSS; these Scene classes own zero game
  logic, just imperative rendering called in response to React state changes.
- Cutscenes (`src/components/cutscene/Cutscene.tsx`, `src/state/useCutsceneStore.ts`,
  `src/data/cutscenes.ts`) are a single global overlay mounted once at the app root (`App.tsx`),
  triggered from anywhere via `useCutsceneStore.getState().play(config)` — a new character's
  one-time intro, a battle's opening beat (dramatic + camera shake for bosses), the defeat-recovery
  beat, and a couple of main-story quest completions currently use it.
- `src/animation/` — sprite-sheet animation layouts (row/facing → frame mapping) for characters;
  an asset's `frameSize` in the registry opts it into frame-based rendering in `ExplorationScene`,
  otherwise it renders as a plain static image.
- `src/state/` — one Zustand store per concern (`usePlayerStore`, `useInventoryStore`,
  `useQuestStore`, `useJournalStore`, `useWorldStateStore`, `useSceneStore`, `useAuthStore`,
  `useSaveStore`, `useToastStore`). All of them (except scene/auth) are populated only from Cloud
  Function responses or a save read via `hydrate.ts`'s `hydrateAllStores`/`resyncSave` — never
  computed client-side.
- `src/hooks/` — shared client logic, notably `useLocationExploration.ts` (the map-load +
  spawn/movement/transition logic Town/Overworld/Dungeon all extend rather than copy-paste) and
  `useGridMovement.ts` (tile-grid movement, dash, animation state).
- `src/utils/` — small stateless helpers (dialogue-variant resolution, item-effect checks, sell
  pricing, the browser right-click/copy-paste lockdown, etc.), one file per concern.
- `src/engine/` — a small client-side mirror of quest-status logic (`quests/questStatus.ts`) used
  for display-only checks (e.g. the Journal). Distinct from — and much smaller than —
  `functions/src/engine/` above; don't confuse the two.

## In-game controls

Arrow keys / WASD to move, Enter/Space to interact, **I** for Inventory/Equipment, **J** for
Journal of Legends (opens to its Quests tab by default), **C** for World Chat (town only). On
touch devices (auto-detected), drag anywhere on the map to move and use the on-screen HUD buttons
in place of the keyboard shortcuts.
Right-click, text selection, and copy/cut/paste are disabled everywhere except form fields (Title's
sign-in inputs, Character Creation's name field) — see `src/utils/browserLockdown.ts`.

## Known limitations (MVP scope)

- Region transitions along the main story path (Ironwood Trail, Raven Ridge, Whisper Falls,
  Hollow Rail Mine) are quest-gated - both client-side (a clear in-game message) and server-side
  (`functions/src/functions/enterLocation.ts` rejects the request outright), so sequence-breaking
  into those specific regions early isn't possible. Outside of those gates, quest objectives in
  general (`reachLocation`, `collectItem`, etc.) still only advance if the triggering action
  happens *after* the prerequisite quest is already completed - they don't retroactively credit.
  Normal linear play is unaffected either way.
- Vitest covers the pure combat/quest/equipment engine functions (`functions/src/engine/*.test.ts`)
  but not the Cloud Functions themselves (Firestore transactions) or any client code yet.
- The player has a real 4-direction walk/run sprite sheet (still a placeholder piece of art per
  `public/CREDITS.md`, but animated in-game). NPCs are still single-frame placeholders — swap via
  `src/assets/registry.ts`, no code changes needed for either.
