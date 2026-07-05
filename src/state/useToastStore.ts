import { create } from 'zustand';

export interface ToastEntry {
  id: string;
  message: string;
}

interface ToastState {
  toasts: ToastEntry[];
  push: (message: string) => void;
  dismiss: (id: string) => void;
}

let nextId = 0;

/** Transient on-screen notifications (quest started/progressed/completed, etc.) - purely a
 *  client-side UI concern, not persisted, not part of PlayerSave. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message) =>
    set((state) => ({ toasts: [...state.toasts, { id: `toast-${nextId++}`, message }] })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
