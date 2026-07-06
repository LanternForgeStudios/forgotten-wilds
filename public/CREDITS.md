# Asset Credits

Most game assets are still MVP **placeholders** (see `status` in `src/assets/registry.ts`) and are expected to
be replaced with final art in a later pass. This file tracks attribution for third-party placeholder assets
currently in use, and for final art already dropped in.

## Kenney.nl (CC0 1.0 Universal)

The following packs are CC0 — no attribution is legally required, but Kenney's work is excellent and worth
crediting and supporting (kenney.nl):

- **Tiny Dungeon** — `public/assets/tilesets/tiny-dungeon.png` — https://kenney.nl/assets/tiny-dungeon
- **Fantasy UI Borders** — `public/assets/ui/panel-border-000.png`, `panel-border-004.png` —
  https://kenney.nl/assets/fantasy-ui-borders

## Final art (AI-generated illustration)

Commissioned specifically for this project, no external license concerns:

- **Title screen hero art** — `public/assets/backgrounds/title-screen.png` (`background.title-screen`) — has the
  game's own logo and tagline painted in, so `TitleScene` doesn't render a separate text title over it.
- **Battle backgrounds** — `public/assets/backgrounds/ironwood-trail.png`, `raven-ridge.png`, `whisper-falls.png`,
  `black-briar-forest.png`, `hollow-rail-mine.png` — one per region/dungeon with real encounters, replacing the
  generic `battle-bg.forest`/`battle-bg.dungeon` placeholders those locations used before.

## Generated placeholders

All portraits, character/enemy sprites, item/equipment/currency icons, and the remaining generic battle
backgrounds (`battle-bg.forest`, still used by Ash Hallow/interiors; `battle-bg.shrine`, currently unused) are
simple procedurally-generated SVG placeholders (colored panel + label), created for this project. They carry no
external license and are freely replaceable — see the `notes` field on each entry in `src/assets/registry.ts`
for details on what final art should replace them with.
