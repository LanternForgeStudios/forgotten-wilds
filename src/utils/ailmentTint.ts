// Reinforces an ailment badge/strip with a low-opacity full-screen color wash while it's active -
// each stacks additively (rare, but a Burn+Poison round should read as visibly "worse" than either
// alone, not one silently overwriting the other). Blind gets a blur filter on the stage instead of
// a tint (per its own "reduced visibility" theme) rather than a color, since a color wash doesn't
// read as "hard to see." Stun has no tint - a "You are stunned" banner already covers it.
// Shared by CombatScene.tsx (solo) and EndlessBattlePanel.tsx/PvpBattlePanel.tsx (party battle) so
// the two presentations of the same ailments never silently drift on what they look like.
export const AILMENT_TINT_COLORS: Record<string, string> = {
  poison: 'rgba(76, 175, 80, 0.22)',
  burn: 'rgba(211, 47, 47, 0.22)',
  freeze: 'rgba(41, 121, 255, 0.22)',
  silence: 'rgba(156, 39, 176, 0.22)',
};

// Same hues as AILMENT_TINT_COLORS above, as opaque 0xRRGGBB ints - Phaser's Sprite.setTint wants
// a numeric tint, not a CSS rgba string, so this is the enemy-sprite-facing companion to the
// screen-wash colors rather than a second, independently-tuned palette (BattleScene.ts uses this
// for the enemy-ailment tint added alongside the badge text under each afflicted enemy).
export const AILMENT_TINT_HEX: Record<string, number> = {
  poison: 0x4caf50,
  burn: 0xd32f2f,
  freeze: 0x2979ff,
  silence: 0x9c27b0,
};
