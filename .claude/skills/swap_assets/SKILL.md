---
name: swap_assets
description: Process finished art dropped in art-staging/ into the live game - verify, move into public/assets/, update the registry, and confirm it renders. Use when the user says "swap in the new art", "process the staged assets", "I've added files to art-staging", or similar.
---

# Swap Assets

Turns files sitting in `art-staging/<category>/` into live, registered game assets. See
`art-staging/README.md` for the full shot list (asset ids, categories, dimensions) this pulls from.

## Steps

1. List what's actually present in each `art-staging/` subfolder (ignore `.gitkeep`).
2. For each staged file, figure out which registry entry it's meant to replace:
   - If the filename already matches or closely resembles an asset id or character/enemy/item
     name from `art-staging/README.md`'s shot list, that's the match.
   - If it's ambiguous, ask the user rather than guessing - a wrongly-matched sprite is worse than
     a pending question.
3. For each matched file:
   - **Verify dimensions** against the spec in `src/assets/registry.ts` (e.g. 128×128 for a
     standard enemy, 256×256 for the boss, 512×512 for portraits). If it doesn't match, ask
     whether to resize or get a corrected file - don't silently stretch/crop art without asking,
     that can visibly distort it.
   - Move it into the correct path under `public/assets/` (mirror the existing folder structure:
     `sprites/characters/`, `sprites/enemies/`, `portraits/`, `icons/`, `backgrounds/`,
     `tilesets/`, `ui/`), using the filename the registry already expects for that id (check the
     entry's current `filePath`).
   - Update that entry in `src/assets/registry.ts`: point `filePath` at the new file, set `status:
     'final'`, and update `notes` to describe the real source (who/what made it, any license).
4. If any of the swapped-in art has a license requiring attribution (a purchased/CC-BY pack, a
   named artist, etc.), add a line to `public/CREDITS.md`. Assets the user made themselves or
   generated for this project specifically don't need an entry.
5. Rebuild (`npm run build`) to catch any broken references, then use `/run_local start` and
   actually look at the result in a browser - a dialogue box with the new portrait, the new
   battle background in a real fight, etc. - before calling it done. Screenshot anything you're
   unsure looks right and ask rather than assuming it's correct.
6. Report what got swapped in, what's still pending (unmatched or missing files from the shot
   list), and leave `art-staging/` empty of whatever was just processed (moved, not copied).

## Notes

- Never mark an entry `status: 'final'` without actually having moved the real file into
  `public/assets/` and confirmed it loads - a status flip with a missing file is worse than
  leaving it as a placeholder, since nothing will flag the gap later.
- This only touches `src/assets/registry.ts` and `public/assets/` - it never needs to touch
  `functions/`, since asset ids are display-layer only and never persisted or validated
  server-side.
