import Phaser from 'phaser';
import { getAssetUrl } from '@/assets/assetManager';
import { useAudioSettingsStore } from '@/state/useAudioSettingsStore';

/** The one Scene behind the whole app's audio - owns nothing but `this.sound` (Phaser's own Sound
 *  Manager, not reimplemented here). Same onReady-callback-in-constructor shape as
 *  BattleScene/ExplorationScene/CutsceneScene, for the same reason: Phaser boots a Scene
 *  asynchronously, so callers can't safely touch `this.sound`/`this.load` immediately after
 *  `new Phaser.Game(...)` returns. */
class AudioScene extends Phaser.Scene {
  private onReady?: () => void;

  constructor(onReady?: () => void) {
    super({ key: 'AudioScene' });
    this.onReady = onReady;
  }

  create() {
    this.onReady?.();
  }
}

/** Loads (if not already cached) an audio asset and resolves once ready - same pattern as
 *  src/phaser/textureLoader.ts's loadSceneTexture, just for the audio cache instead of textures. */
function loadSceneAudio(scene: Phaser.Scene, id: string): Promise<void> {
  if (scene.cache.audio.exists(id)) return Promise.resolve();
  const url = getAssetUrl(id);
  return new Promise((resolve) => {
    scene.load.audio(id, url);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}

let scenePromise: Promise<Phaser.Scene> | null = null;

/** Lazily creates one small, headless (`Phaser.HEADLESS` - no canvas/visual output at all) Phaser
 *  Game, persistent for the whole session and never destroyed, purely to host a Sound Manager.
 *
 * Why not just play audio directly with HTMLAudioElement: Phaser 4 already ships a full Sound
 * Manager (WebAudio, with automatic HTML5 Audio fallback, loop/volume config, and the standard
 * browser autoplay-unlock gesture handling all built in) - reimplementing that by hand would just
 * be worse duplicate of what the engine already does well.
 *
 * Why a separate headless Game rather than reusing whichever Phaser canvas happens to be mounted:
 * PhaserExplorationCanvas/PhaserBattleCanvas each own a `Phaser.Game` that's destroyed on unmount
 * (leaving Town for Combat, or leaving either for a pure-React screen like Shop/Title, tears the
 * whole Game down) - music playing inside one of those would die the instant the player left that
 * scene. A dedicated, never-destroyed Game sidesteps that entirely and gives every caller (React
 * components and other Phaser scenes alike) the exact same three functions below to import,
 * regardless of whether a visible Phaser canvas happens to exist at that moment. */
function ensureScene(): Promise<Phaser.Scene> {
  if (!scenePromise) {
    scenePromise = new Promise((resolve) => {
      const scene = new AudioScene(() => resolve(scene));
      new Phaser.Game({
        type: Phaser.HEADLESS,
        width: 1,
        height: 1,
        banner: false,
        scene,
      });
    });
  }
  return scenePromise;
}

let musicSound: Phaser.Sound.BaseSound | null = null;
/** The track `playMusic` most recently asked for - not necessarily already playing (loading is
 *  async), used to detect a newer `playMusic` call superseding an older one still in flight, same
 *  generation-guard pattern used elsewhere (ExplorationScene.ts, CombatScene.tsx). */
let currentMusicId: string | null = null;

/** Plays a one-shot sound effect, respecting the user's Settings-tab SFX toggle/volume. Fire-and-
 *  forget - Phaser automatically destroys the underlying Sound instance once playback ends, so
 *  overlapping calls (e.g. two quick UI clicks) never cut each other off. */
export async function playSound(id: string): Promise<void> {
  const { sfxEnabled, sfxVolume } = useAudioSettingsStore.getState();
  if (!sfxEnabled) return;
  const scene = await ensureScene();
  await loadSceneAudio(scene, id);
  scene.sound.play(id, { volume: sfxVolume });
}

/** Starts looping background music for `id` - a no-op if that same track is already the current
 *  (or currently loading) one, so a scene re-rendering doesn't restart its own theme. Respects the
 *  Settings tab's music toggle/volume, and stays live-reactive to both (see the store subscription
 *  below) without needing another playMusic call. */
export async function playMusic(id: string): Promise<void> {
  if (currentMusicId === id) return;
  currentMusicId = id;
  const scene = await ensureScene();
  if (currentMusicId !== id) return; // superseded while the scene was booting
  await loadSceneAudio(scene, id);
  if (currentMusicId !== id) return; // superseded while this track was loading

  musicSound?.stop();
  musicSound?.destroy();
  const { musicEnabled, musicVolume } = useAudioSettingsStore.getState();
  musicSound = scene.sound.add(id, { loop: true, volume: musicVolume });
  if (musicEnabled) musicSound.play();
}

export function stopMusic(): void {
  currentMusicId = null;
  musicSound?.stop();
}

/** The track currently playing (or loading) - lets an overlay that temporarily takes over music
 *  (Endless Battle/PvP's battle panels, which sit on top of Town/Overworld/Dungeon rather than
 *  replacing it via a scene transition, so nothing else naturally resumes the prior track once the
 *  overlay closes) snapshot it on open and restore it on close. */
export function getCurrentMusicId(): string | null {
  return currentMusicId;
}

// Keeps the currently-playing track reactive to the Settings tab without requiring every caller
// to re-invoke playMusic - toggling music off pauses in place (resume() picks back up from the
// same position, not a restart), and the volume slider applies live mid-track.
//
// `volume` is a real, live-settable property on both of Phaser's concrete Sound implementations
// (WebAudioSound/HTML5AudioSound), just not on the generic `BaseSound` type `sound.add()` returns
// (SoundConfig.volume only covers volume *at creation*) - this local type describes the property
// every sound actually has, without needing to import/union both concrete classes.
type SoundWithVolume = Phaser.Sound.BaseSound & { volume: number };

useAudioSettingsStore.subscribe((state, prevState) => {
  if (!musicSound) return;
  if (state.musicVolume !== prevState.musicVolume) {
    (musicSound as SoundWithVolume).volume = state.musicVolume;
  }
  if (state.musicEnabled !== prevState.musicEnabled) {
    if (state.musicEnabled) musicSound.resume();
    else musicSound.pause();
  }
});
