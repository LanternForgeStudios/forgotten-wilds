---
name: deploy_backend
description: Deploy Firebase Cloud Functions and Firestore rules to the live production forgotten-wilds Firebase project. Use when the user says "deploy the backend", "push functions live", "deploy to firebase", or similar.
---

# Deploy Backend

Ships `functions/` and `firestore.rules` to the real, live Firebase project — this affects
production, is visible to any real player, and (on the Blaze plan) has a small cost surface.
**Confirm with the user before running this** unless they've already explicitly asked for a
deploy in the current conversation turn.

## Steps

1. Build first, locally, to catch errors before they hit the deploy pipeline:
   ```
   cd functions && npm run build
   ```
   If this fails, stop and fix the TypeScript errors — do not deploy broken code.
2. From the project root, deploy functions and rules together (rules first prevents a window
   where new function behavior exists without the security rules that constrain it):
   ```
   npx --yes firebase-tools deploy --only functions,firestore:rules
   ```
   If this environment's network stack needs a CA cert workaround (Windows + a TLS-inspecting
   antivirus can cause `UNABLE_TO_VERIFY_LEAF_SIGNATURE` errors from Node), set
   `NODE_EXTRA_CA_CERTS` to a PEM export of the intercepting root cert before running — see
   `run_local` skill's troubleshooting note for how that cert was obtained previously; don't
   silently fall back to disabling TLS verification.
3. Watch for each function's "Successful create/update operation" line. Don't check this against a
   hardcoded list or count in this file — the function roster grows over time and a stale count
   here would go unnoticed. Instead, get the current expected list fresh each time from the
   `export` lines in `functions/src/index.ts` (one export statement per function, some lines export
   more than one), and confirm every one of them appears with a successful create/update line in
   the deploy output.
4. A warning about "No cleanup policy detected for repositories" after a successful deploy is
   non-fatal (container images from Cloud Build will just accumulate slightly over time) — don't
   try to fix it automatically; that's a separate, explicit ask (`firebase
   functions:artifacts:setpolicy`), not part of this skill.
5. Report which functions deployed, and remind the user that the client (GitHub Pages) may need
   a rebuild/redeploy too if the client-side function-calling code changed — that's the `push`
   skill's job (the Pages workflow), not this one.

## Notes

- Never add `--force` to work around a prompt without understanding what it's skipping.
- If functions fail to deploy due to a missing/disabled Google Cloud API, the CLI usually enables
  it automatically and retries — that's expected on first-ever deploy, not an error to "fix."
