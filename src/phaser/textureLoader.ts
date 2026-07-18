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
 *  against Graveyard_Set.png) before rejecting for real. Phaser's own Loader.Events.COMPLETE fires
 *  unconditionally once the queue finishes, whether or not individual files actually succeeded
 *  (it tracks failures as a separate counter, not a separate event this promise was listening
 *  for) - a naive "resolve on COMPLETE" left a failed load looking identical to a successful one,
 *  so a caller's later addTilesetImage silently got back null and crashed deep inside Phaser's own
 *  PutTileAt on the very next tile placement instead of failing where the actual problem was. */
export function loadSceneTexture(scene: Phaser.Scene, assetId: string): Promise<void> {
  if (scene.textures.exists(assetId)) return Promise.resolve();
  return loadSceneTextureOnce(scene, assetId).catch(() => loadSceneTextureOnce(scene, assetId));
}

function loadSceneTextureOnce(scene: Phaser.Scene, assetId: string): Promise<void> {
  const def = getAssetDefinition(assetId);
  const url = getAssetUrl(assetId);
  return new Promise((resolve, reject) => {
    if (def.frameSize) {
      scene.load.spritesheet(assetId, url, { frameWidth: def.frameSize.width, frameHeight: def.frameSize.height });
    } else {
      scene.load.image(assetId, url);
    }
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (scene.textures.exists(assetId)) resolve();
      else reject(new Error(`Failed to load texture "${assetId}" from ${url}`));
    });
    scene.load.start();
  });
}
