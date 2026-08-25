export interface LightSourceConfig {
  /** 0xRRGGBB, passed straight to Phaser's scene.lights.addLight. */
  color: number;
  /** World-space pixels - the light's radius, where Phaser's own quadratic falloff reaches zero. */
  radius: number;
  /** Phaser's own brightness multiplier - 1 is "normal," higher is brighter (not capped at 1;
   *  several of these are >1 on purpose, see the 2026-08 "1.5x as bright" pass). Ramped by the
   *  current TimePhase (see lightingEffects.ts) - this is the *peak* value during sunset/night/
   *  sunrise, not a fixed constant. */
  intensity: number;
}

/** Keyed by the *resolved sprite asset id actually being rendered*, not a static object refId -
 *  see src/utils/weather.ts's sibling design note in the day/night plan. This is what makes
 *  conditional-state props "just work": a shrine's refId resolves to structure.shrine-activated
 *  or structure.shrine-dormant depending on quest progress (shrineSpriteAssetId), and a chest's to
 *  structure.chest or structure.chest-open - only the lit/unopened variant is listed here, so only
 *  that state glows, with no extra conditional logic needed beyond this one lookup.
 *
 *  The general-bonfire/fire/furnace entries are registered but not placed on any map today - kept
 *  here anyway (per the owner's ask) so they light up automatically the moment any of them are
 *  hand-placed, without this file needing another pass. */
// 1.5x brighter across the board (2026-08 owner ask) - applied as a single multiplier rather than
// hand-editing every literal, so it can't drift between entries.
const INTENSITY_MULTIPLIER = 1.5;

export const LIGHT_SOURCES: Record<string, LightSourceConfig> = {
  // Every non-building-facade transition (cave mouths, map-edge crossings, an interior's door back
  // outside) already pulses its own glow animation - a real light here reads as "this is the way
  // out" at night, same instinct as a real exit sign.
  'structure.exit-marker': { color: 0x74e08a, radius: 70, intensity: 0.75 * INTENSITY_MULTIPLIER },
  'structure.decor-glowing-mushroom': { color: 0x9b5fe0, radius: 80, intensity: 0.65 * INTENSITY_MULTIPLIER },
  'structure.shrine-activated': { color: 0xffdd88, radius: 110, intensity: 0.9 * INTENSITY_MULTIPLIER },
  'structure.chest': { color: 0xffe9a8, radius: 50, intensity: 0.55 * INTENSITY_MULTIPLIER },
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => i + 1).map((n) => [
      `structure.general-bonfire-${String(n).padStart(2, '0')}`,
      { color: 0xff9640, radius: 95, intensity: 1 * INTENSITY_MULTIPLIER },
    ]),
  ),
  'structure.general-fire-01': { color: 0xff9640, radius: 95, intensity: 1 * INTENSITY_MULTIPLIER },
  'structure.general-fire-02': { color: 0xff9640, radius: 95, intensity: 1 * INTENSITY_MULTIPLIER },
  ...Object.fromEntries(
    ['bricks', 'iron', 'stone'].flatMap((material) =>
      [1, 2, 3].map((n) => [
        `structure.general-furnace-${material}-${String(n).padStart(2, '0')}`,
        { color: 0xff7a30, radius: 85, intensity: 0.85 * INTENSITY_MULTIPLIER },
      ]),
    ),
  ),
};
