import { create } from 'zustand';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveState {
  status: SaveStatus;
  lastSavedAt: number | null;
  setStatus: (status: SaveStatus) => void;
}

/**
 * There is no client-side autosave loop — every Cloud Function call IS the save, committed
 * server-side inside its own transaction. This store only reflects the status of the most
 * recent call for the SaveLoadStatus UI ("saving...", "saved", "error").
 */
export const useSaveStore = create<SaveState>((set, get) => ({
  status: 'idle',
  lastSavedAt: null,
  setStatus: (status) => set({ status, lastSavedAt: status === 'saved' ? Date.now() : get().lastSavedAt }),
}));
