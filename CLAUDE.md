# Forgotten Wilds

Browser JRPG (React + TypeScript + Vite client, Firebase backend). Full design brief:
`Forgotten-Wilds_Requirements.txt`. Setup/run/deploy instructions: `README.md`. This file is about
*how to work on this codebase*, not how to run it.

## The one rule that shapes everything else

**The cloud is the source of truth. The client never mutates game state directly.** Every action
that changes `users/{uid}` or `combatSessions/{uid}` — combat, quests, shop, inn, equip — goes
through a Cloud Function in `functions/src/functions/`. `firestore.rules` enforces this at the
database level (`allow write: if false` on both collections), so even a compromised or modified
client can't cheat; the client SDK physically cannot write there. `presence/{uid}` is the one
exception — clients write it directly, because the worst case is a fake nameplate, not an economy
exploit, and real-time responsiveness matters more than server validation there.

When adding a new gameplay action, ask "does this change persisted state?" If yes, it's a new
Cloud Function, not a client-side store mutation.

## The client/server data split

`src/data/*.ts` (items, equipment, enemies, npcs, quests, locations, lore) and
`functions/src/data/*.ts` describe the *same* content but are **separate files, kept in sync by
hand**. This isn't accidental duplication — `firebase deploy --only functions` zips only the
`functions/` directory, so a relative import reaching into `src/` would resolve locally but 404 in
the deployed bundle. The client's copies are for *display only* (names, descriptions, icons); the
server's copies are what combat math, prices, and quest gating actually use. If you change a
number that affects gameplay (damage, price, drop rate, xp), it has to change in
`functions/src/data/`, and the client copy should usually match for consistent display.

## Where things live

- `src/scenes/` — Title (auth gate), CharacterCreation, Town, Overworld, Dungeon, Combat. Scene
  switching is a Zustand state machine (`src/state/useSceneStore.ts`), not react-router.
- `src/hooks/useLocationExploration.ts` — shared map-load + spawn + movement + transition logic
  used by Town/Overworld/Dungeon. Extend here, not by copy-pasting into each scene.
- `src/assets/registry.ts` — every sprite/tileset/icon/map/background is looked up by id here.
  Code never imports an image path directly. Swapping a placeholder for final art is a one-line
  registry edit. See `public/CREDITS.md` for what's real CC0 art vs. generated placeholder.
- `functions/src/engine/` — pure functions (`combatEngine.ts`, `questEngine.ts`,
  `equipmentEngine.ts`), unit tested (`cd functions && npm test`, Vitest). No Firestore access in
  here — that's the Cloud Function's job, so this layer stays fast to test and easy to reason
  about.
- `functions/src/functions/` — the callable Cloud Functions themselves: read/validate/mutate in a
  Firestore transaction, delegating the actual math to `engine/`.
- `src/multiplayer/` — typed stub interfaces (party, chat, trade, lodges, world events). Every
  function throws "not implemented" on purpose — these are placeholders for systems not built
  yet, not dead code to clean up.

## Conventions

- State management: Zustand. One store per concern (`usePlayerStore`, `useInventoryStore`,
  `useQuestStore`, `useJournalStore`, `useSaveStore`, `useAuthStore`, `useSceneStore`). All of
  them (except scene/auth) are populated *only* from Cloud Function responses or a
  `fetchPlayerSave` read — see `src/state/hydrate.ts`'s `hydrateAllStores`/`resyncSave`. Never add
  a store setter that computes a new value client-side; hydrate from the server response instead.
- Styling: CSS modules, one per component. `src/components/common/Panel.tsx` is the shared 9-slice
  UI chrome — reuse it for any new overlay/menu rather than styling a `<div>` from scratch.
- Overlay pattern: Town/Overworld/Dungeon scenes each track a handful of `useState<boolean>` open
  flags (quest log, inventory, journal, shop, inn) and a matching keybinding. It's repetitive by
  design for now — if a fourth or fifth overlay gets added, consider factoring the
  open/close/suspend wiring into a shared hook rather than copy-pasting a sixth time.
- Tests: only `functions/src/engine/*.ts` has Vitest coverage. The Cloud Functions themselves
  (Firestore transactions) and all client code are untested — verified by hand via the emulator
  suite instead. If you add meaningful pure logic anywhere, test it the same way.

## Local dev environment gotchas (this machine)

- The Firestore emulator runs as a separate `java` process, not `node` — cleaning up stray
  processes between sessions needs to check for both, or `emulators:start` fails with "port
  taken."
- This Windows machine has an antivirus (Norton) doing local TLS inspection, which breaks Node's
  and curl's certificate verification for outbound HTTPS (`UNABLE_TO_VERIFY_LEAF_SIGNATURE` /
  schannel revocation errors) even though ordinary apps trust it fine via the Windows cert store.
  Fix: export Norton's root cert from `Cert:\LocalMachine\Root` (`Subject -match 'Norton Web/Mail
  Shield'`) to a PEM file and set `NODE_EXTRA_CA_CERTS` to it before running `npm install` or
  `firebase deploy`. Do **not** work around this by disabling TLS revocation checking or
  certificate verification — that's a real security downgrade, not a fix.

## Project skills

`/push`, `/deploy_backend`, `/run_local start|stop`, `/clean_up`, `/add_content` — see
`.claude/skills/*/SKILL.md` for what each does.
