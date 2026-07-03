# Forgotten Wilds

A browser-based JRPG set in Mytherra's Iron Mountains. Single-player exploration, turn-based
combat, and quests today; live town presence now, with clean seams for future party/chat/trade/
lodge/world-event systems. See `Forgotten-Wilds_Requirements.txt` for the full design brief.

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
- `src/components/` — DialogueBox, QuestLog, CharacterMenu (Inventory/Equipment), Shop, Inn,
  JournalOfLegends, PlayerHUD, TownPresencePanel, and shared UI (`common/Panel` — the 9-slice
  panel used everywhere)
- `src/data/` — display-only seed data (items, equipment, enemies, NPCs, quests, locations, lore)
- `src/assets/` — the Asset Manager and registry (`registry.ts`); every sprite/tileset/icon/map
  is looked up by id here, never imported by file path directly. See `public/CREDITS.md` for
  what's real CC0 art (Kenney.nl) vs. generated placeholder.
- `functions/src/data/` — the **authoritative** copies of the same content (prices, stats, loot,
  quest definitions) that the client's copies must stay in sync with by hand; the client copies
  are for display only and are never trusted for anything that persists.
- `functions/src/engine/` — pure combat/quest/equipment logic, unit-tested independent of
  Firestore (`cd functions && npm test`, Vitest).
- `functions/src/functions/` — the callable Cloud Functions: `createCharacter`, `startEncounter`,
  `resolveCombatAction`, `talkToNpc`, `enterLocation`, `collectWorldItem`, `equipItem`/
  `unequipItem`, `purchaseItem`, `restAtInn`.
- `src/multiplayer/` — typed stub interfaces (party, chat, trade, lodges, world events) for
  systems not built yet; every function throws "not implemented," ready to be filled in.

## In-game controls

Arrow keys / WASD to move, Enter/Space to interact, **L** for Quest Log, **I** for Inventory/
Equipment, **J** for Journal of Legends.

## Known limitations (MVP scope)

- Quest prerequisite-gated objectives (`reachLocation`, `collectItem`) only advance if the
  triggering action happens *after* the prerequisite quest is already completed. A player who
  sequence-breaks (e.g. rushes into Hollow Rail Mine before finishing the Ironwood Trail quest)
  can still collect the lantern relic, but that specific quest step won't retroactively credit
  once earlier quests catch up. Normal linear play is unaffected.
- Vitest covers the pure combat/quest/equipment engine functions (`functions/src/engine/*.test.ts`)
  but not the Cloud Functions themselves (Firestore transactions) or any client code yet.
- Character sprites are single-frame placeholders (see `public/CREDITS.md`) rather than full
  4-direction walk-cycle sheets — swap via `src/assets/registry.ts`, no code changes needed.
