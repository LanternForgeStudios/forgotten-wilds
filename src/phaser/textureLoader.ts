import Phaser from 'phaser';
import { getAssetDefinition, getAssetUrl } from '@/assets/assetManager';

/** Loads (if not already cached) a plain image or spritesheet texture for any Phaser Scene and
 *  resolves once ready - shared by ExplorationScene/BattleScene/CutsceneScene rather than each
 *  keeping its own private copy, which had let CutsceneScene's drift from the other two (it
 *  never checked `frameSize` and always loaded as a plain image, silently unable to load a future
 *  animated sprite sheet asset). Safe to call for a texture that's already loaded (resolves
 *  immediately, no re-fetch).
 *
 *  Retries once on a failed load (a transient CDN/network hiccup - e.g. a bare 503 - confirmed live
 *  against Graveyard_Set.png) before rejecting for real.
 *
 *  Listens for the per-file `filecomplete`/`loaderror` events (filtered by this call's own
 *  assetId) rather than the queue-wide `COMPLETE` event, and only calls `load.start()` when the
 *  loader isn't already running. A caller that kicks off many of these concurrently (e.g.
 *  `Promise.all(map.tilesets.map(t => loadSceneTexture(...)))` for a map with dozens of embedded
 *  tilesets) previously raced: each call independently added a `once(COMPLETE)` listener and
 *  called `start()`, but Phaser's loader queues new files onto whatever batch is already running -
 *  a file added after the first batch's own COMPLETE had already fired (and been consumed by that
 *  batch's `once` listener) had no COMPLETE event left to resolve its promise, hanging forever.
 *  This bit for real once a location's tileset count grew past a handful (confirmed hang on a
 *  42-tileset map) - small maps happened to avoid it by luck of batch timing, not correctness. */
export function loadSceneTexture(scene: Phaser.Scene, assetId: string): Promise<void> {
  if (scene.textures.exists(assetId)) return Promise.resolve();
  return loadSceneTextureOnce(scene, assetId).catch(() => loadSceneTextureOnce(scene, assetId));
}

function loadSceneTextureOnce(scene: Phaser.Scene, assetId: string): Promise<void> {
  const def = getAssetDefinition(assetId);
  const url = getAssetUrl(assetId);
  return new Promise((resolve, reject) => {
    const onFileComplete = (key: string) => {
      if (key !== assetId) return;
      cleanup();
      resolve();
    };
    const onFileError = (file: Phaser.Loader.File) => {
      if (file.key !== assetId) return;
      cleanup();
      reject(new Error(`Failed to load texture "${assetId}" from ${url}`));
    };
    const cleanup = () => {
      scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);
    };
    scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
    scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onFileError);

    if (def.frameSize) {
      scene.load.spritesheet(assetId, url, { frameWidth: def.frameSize.width, frameHeight: def.frameSize.height });
    } else {
      scene.load.image(assetId, url);
    }
    if (!scene.load.isLoading()) scene.load.start();
  });
}
