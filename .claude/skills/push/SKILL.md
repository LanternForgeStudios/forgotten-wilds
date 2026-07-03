---
name: push
description: Verify README.md reflects the current state of the project, then commit and push all pending changes to the repo's remote. Use when the user says "push this", "commit and push", "save progress to GitHub", or similar.
---

# Push

Ship the working tree to GitHub, keeping the README honest along the way.

## Steps

1. Run `git status` and `git diff` to see what changed (staged and unstaged). Never run this on
   an empty diff — if there's nothing to commit, say so and stop.
2. **Safety check before staging**: confirm `.env.local` and any other secret-bearing files are
   not about to be committed. Run `git status --porcelain | grep -i '\.env\.local'` — it must be
   empty. If it isn't, stop and tell the user; do not stage it.
3. Read `README.md` and compare it against the diff. Update it if the changes:
   - add/rename/remove an npm script, environment variable, or setup step
   - add a new top-level folder or major architectural piece (a new Cloud Function category, a
     new scene, a new system) that isn't reflected in the "Project structure" section
   - change a documented control/keybinding
   - resolve or introduce a "Known limitations" item
   Don't rewrite the README wholesale — targeted edits only, matching its existing tone.
4. Stage the relevant files (`git add <files>`, not a blind `git add -A` if anything looks
   sensitive) and commit. Use a message describing *why*, not just *what*, following this
   project's existing commit style (see `git log --oneline -10`). Every commit in this workspace
   must end with both trailers:
   ```
   Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
   Co-Authored-By: Bear0053 <bob0053@gmail.com>
   ```
5. Push: `git push origin <current-branch>` (almost always `main`).
6. Report what was committed/pushed and whether the README changed. If the push touches
   `.github/workflows/deploy.yml` or anything the GitHub Pages workflow depends on, mention that
   the workflow will run on this push.

## Notes

- If `git push` fails, diagnose (behind remote → suggest pull/rebase; auth issue → say so) rather
  than force-pushing. Never force-push without the user explicitly asking.
- If there are uncommitted changes unrelated to the current task sitting in the working tree,
  ask before including them rather than sweeping them into an unrelated commit.
