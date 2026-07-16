// Display copy only — functions/src/data/dailyChest.ts is authoritative. Used purely for the
// HUD's own "ready vs. countdown" prediction (see staminaRegen.ts's predictedStamina for the same
// pattern) - the actual claim is always re-validated server-side in claimDailyChest.ts.

export const CHEST_CLAIM_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const ELITE_CHEST_LEVEL_THRESHOLD = 40;
