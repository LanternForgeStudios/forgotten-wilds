import { create } from 'zustand';
import type { EquipmentSlot, Player, Stats } from '@/types';

interface PlayerState {
  player: Player | null;
  displayName: string | null;
  hydrate: (player: Player, displayName: string) => void;
  /** Optimistic-only: reflects an equip/unequip locally before the round-trip resolves, so the UI
   *  feels instant. The Cloud Function call this accompanies (and the resyncSave after it) is
   *  still what actually persists the change and remains the source of truth - this never writes
   *  anywhere itself, it just avoids a visible lag in a value the player already legitimately owns. */
  patchEquipment: (slot: EquipmentSlot, itemId: string | null) => void;
  /** Not optimistic - the values passed in are always the server's own round-result numbers
   *  (resolveCombatAction's response), just applied here instead of waiting for a full resync so
   *  the top HUD's HP/SP bars track combat live, turn by turn. */
  patchStats: (stats: Partial<Stats>) => void;
  /** Same non-optimistic pattern as patchStats, for Player-level fields outside `stats` (e.g.
   *  staminaUpdatedAt after a Dash) - always server round-result values, applied without waiting
   *  for a full resync. */
  patchPlayer: (patch: Partial<Player>) => void;
}

/** Populated only from Cloud Function responses or reads of users/{uid} — never mutated locally,
 *  except the deliberate, narrow optimistic-UI exception in patchEquipment above. */
export const usePlayerStore = create<PlayerState>((set, get) => ({
  player: null,
  displayName: null,
  hydrate: (player, displayName) => set({ player, displayName }),
  patchEquipment: (slot, itemId) => {
    const { player } = get();
    if (!player) return;
    set({ player: { ...player, equipment: { ...player.equipment, [slot]: itemId } } });
  },
  patchStats: (stats) => {
    const { player } = get();
    if (!player) return;
    set({ player: { ...player, stats: { ...player.stats, ...stats } } });
  },
  patchPlayer: (patch) => {
    const { player } = get();
    if (!player) return;
    set({ player: { ...player, ...patch } });
  },
}));
