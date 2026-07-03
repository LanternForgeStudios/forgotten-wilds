---
name: clean_up
description: Audit the codebase for dead code, inefficiencies, and bugs, then fix what's found, leaving the code clean, secure, and optimized. Use when the user says "clean up the code", "refactor and optimize", "audit for bugs", or similar.
---

# Clean Up

A codebase-wide health pass across both `src/` (client) and `functions/` (backend). This project
already has `/code-review` and `/simplify` available as general-purpose skills — use them as the
backbone of this pass rather than reinventing bug-hunting or simplification heuristics:

## Steps

1. Run `npm run build` (client) and `cd functions && npm run build` (functions) first. Fix any
   compile errors before doing anything else — a codebase that doesn't build can't be cleanly
   reviewed.
2. Invoke `/code-review` at high effort across the working tree (not just a diff — this is a
   full-codebase audit, so review broadly: `src/engine`, `functions/src/engine`,
   `functions/src/functions`, `src/state`, `src/scenes`). Apply fixes for confirmed findings.
3. Invoke `/simplify` the same way, for reuse/efficiency/altitude cleanup.
4. Beyond what those two catch generically, specifically check for the failure modes this
   project's architecture invites:
   - **Client/server data drift**: `src/data/*.ts` (display copies) and `functions/src/data/*.ts`
     (authoritative) must describe the same items/enemies/equipment/quests. A stat or price that
     drifted between the two won't cause a crash — it'll just show the player one number and
     charge them another. Diff them by eye when reviewing either.
   - **Anything that writes to `users/{uid}` or `combatSessions/{uid}` outside a Cloud Function.**
     If a new client-side write to either collection has crept in, that's a security regression,
     not a style nit — flag it as high severity. `firestore.rules` should still show `allow
     write: if false` for both.
   - **Dead multiplayer stub churn**: `src/multiplayer/*.ts` are intentionally unimplemented
     (`throw new Error(...)`) — don't "fix" these by deleting them or filling them with fake
     logic; they're placeholders by design (see the TODO comments explaining why).
   - **Unused registry entries**: an asset registered in `src/assets/registry.ts` that nothing
     references is usually a sign content was removed but its asset wasn't, not intentional dead
     weight to keep.
5. Report findings the same way `/code-review` does (most severe first), and note explicitly
   which fixes were applied vs. skipped and why.

## Notes

- Don't "clean up" by deleting the multiplayer stubs, the display/authoritative data split, or
  the emulator-first dev workflow — those are deliberate architectural choices from the project
  plan, not accidents.
- If a fix would change gameplay balance (damage numbers, prices, drop rates), call it out
  separately rather than folding it into a "cleanup" commit — balance changes are a judgment call
  for the user, not a code-quality fix.
