import { create } from 'zustand';

interface BattleOverlayState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

/** Whether an Endless Battle/PvP panel (ActiveBattleOverlay) is currently showing - set by
 *  PlayerHUD, read by Town/Overworld/Dungeon scenes so their fixed keyboard-shortcut hint doesn't
 *  sit visible underneath the near-full-screen battle panel. */
export const useBattleOverlayStore = create<BattleOverlayState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
}));
