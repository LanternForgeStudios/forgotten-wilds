import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AudioSettingsState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  /** 0-1, applied per-call to Phaser's sound.play({ volume }) config - see src/audio/audioService.ts. */
  musicVolume: number;
  sfxVolume: number;
  setMusicEnabled: (enabled: boolean) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setMusicVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
}

/** Persisted to localStorage directly (via zustand's own `persist` middleware) as the live source
 *  of truth for actual playback - read directly by src/audio/audioService.ts on every
 *  playSound/playMusic call, and needs to work instantly (a slider drag can't wait on a network
 *  round-trip) and pre-sign-in (Title screen music has no account to read from yet). Also synced
 *  to the account (see AudioSettings' own doc comment in functions/src/shared-types/index.ts) so
 *  the chosen levels follow the player to a new device: UserProfile.tsx pushes every change here
 *  to setAudioSettings.ts (fire-and-forget, debounced for the volume sliders), and App.tsx/
 *  CharacterCreationScene.tsx seed this store from the account's saved values once on sign-in
 *  (see seedAudioSettingsFromSave in state/hydrate.ts) - deliberately NOT on every resyncSave,
 *  since that runs mid-session after almost every action and would otherwise clobber a change the
 *  player just made locally before it's finished being pushed to the server. */
export const useAudioSettingsStore = create<AudioSettingsState>()(
  persist(
    (set) => ({
      musicEnabled: true,
      sfxEnabled: true,
      musicVolume: 0.5,
      sfxVolume: 0.7,
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setSfxEnabled: (sfxEnabled) => set({ sfxEnabled }),
      setMusicVolume: (musicVolume) => set({ musicVolume }),
      setSfxVolume: (sfxVolume) => set({ sfxVolume }),
    }),
    { name: 'forgotten-wilds-audio-settings' },
  ),
);
