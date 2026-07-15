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

/** Device preference, not game state - deliberately persisted to localStorage directly (via
 *  zustand's own `persist` middleware) rather than through a Cloud Function/users/{uid}, since
 *  volume/mute has no gameplay-integrity stake and shouldn't need a signed-in round-trip to take
 *  effect. Read directly by src/audio/audioService.ts on every playSound/playMusic call. */
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
