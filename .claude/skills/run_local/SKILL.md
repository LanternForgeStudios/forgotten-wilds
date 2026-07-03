---
name: run_local
description: Start or stop the local dev environment (Vite dev server + Firebase Auth/Firestore/Functions emulators) for testing Forgotten Wilds locally, without touching production. Usage - "/run_local start" or "/run_local stop".
---

# Run Local

Args: `start` or `stop` (default to asking which if omitted and it's ambiguous from context).

Local dev always points at the Firebase emulator suite, never production — `.env.local` should
have `VITE_USE_FIREBASE_EMULATORS=true`. This is what makes it safe to create test characters,
grind combat, or intentionally break things without touching real player data.

## Start

1. **Clear stale state first.** The most common failure mode here is a leftover process holding
   a port from a previous session (the Firestore emulator runs as a separate `java` process, not
   `node`, so it's easy to miss when cleaning up). Check and free, if needed:
   - port 5173 (Vite)
   - port 9099 (Auth emulator)
   - port 8080 (Firestore emulator — often the `java` process)
   - port 5001 (Functions emulator)
   - port 4000 (Emulator UI)
   On Windows, `Get-NetTCPConnection -LocalPort <port>` → `OwningProcess` → `Stop-Process` for
   any of these still bound from a prior run.
2. Launch the emulator suite in the background from the project root:
   ```
   npx --yes firebase-tools emulators:start --only auth,firestore,functions
   ```
   Wait for `All emulators ready!` in its output before proceeding — don't assume it's up after a
   fixed sleep, poll the log/port instead.
3. Launch the dev server in the background:
   ```
   npm run dev
   ```
   Wait for it to respond on port 5173.
4. Report both URLs: `http://localhost:5173/forgotten-wilds/` (the game) and
   `http://127.0.0.1:4000` (Emulator UI, useful for inspecting Firestore data / auth users
   directly).

## Stop

1. Find and stop the Vite and Firebase CLI/emulator `node` processes, **and** the Firestore
   emulator's `java` process — killing only `node` processes leaves Firestore's port held open
   and causes the next `start` to fail with "port taken."
2. Confirm the five ports above are free afterward.
3. Report what was stopped.

## Notes

- Never point this at production — if `.env.local` doesn't have
  `VITE_USE_FIREBASE_EMULATORS=true`, fix that before starting rather than running local dev
  against real data.
- If `emulators:start` needs a CA cert workaround for outbound HTTPS in this environment (see
  `deploy_backend` skill's note), the emulators themselves are local-only and don't need it —
  only `npx firebase-tools` fetching itself the first time, or the client hitting the internet,
  would.
