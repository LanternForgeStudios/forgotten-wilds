import { create } from 'zustand';

export interface CutsceneConfig {
  /** Full-screen background asset (see registry.ts's 'background' category) - battle-bg.forest is
   *  the documented generic fallback for anything without dedicated art. */
  backgroundAssetId: string;
  /** Shown one at a time, advanced by click/Space, matching DialogueBox's existing UX. */
  lines: string[];
  /** Boss/high-stakes flourish: a camera shake + darker flash the instant the cutscene appears,
   *  instead of just fading the background in plainly. */
  dramatic?: boolean;
  /** Called once, when the player dismisses the final line (or skips). Not called on skip if the
   *  caller's own logic depends on every line having been shown - skip still counts as "done"
   *  either way, since nothing here blocks progress on a line actually being read. */
  onComplete?: () => void;
}

interface CutsceneStoreState {
  active: CutsceneConfig | null;
  play: (config: CutsceneConfig) => void;
  /** Called by the Cutscene component itself once dismissed - not meant to be called directly by
   *  trigger sites (they get their own callback via config.onComplete instead). */
  finish: () => void;
}

/** A single global overlay slot mounted once at the app root (see Cutscene.tsx), rather than
 *  wired into every individual scene - cutscenes are triggered from wildly different contexts
 *  (post-login, mid-combat, quest completion) and need to render above whichever scene is
 *  currently active regardless of which one triggered them. Only one cutscene can play at a time;
 *  a second play() call while one is active replaces it outright rather than queuing (no current
 *  trigger site can legitimately fire two cutscenes back to back). */
export const useCutsceneStore = create<CutsceneStoreState>((set, get) => ({
  active: null,
  play: (config) => set({ active: config }),
  finish: () => {
    const onComplete = get().active?.onComplete;
    set({ active: null });
    onComplete?.();
  },
}));
