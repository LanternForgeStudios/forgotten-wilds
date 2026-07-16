// Authoritative — the client's src/data/dailyChest.ts is a display copy only (used for its own
// countdown math, per staminaRegen.ts's predictedStamina pattern - never the source of truth for
// whether a claim is actually allowed, which claimDailyChest.ts always re-checks server-side).

export const CHEST_CLAIM_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const ELITE_CHEST_LEVEL_THRESHOLD = 40;
