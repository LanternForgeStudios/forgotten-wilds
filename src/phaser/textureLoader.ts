import Phaser from 'phaser';
import { getAssetDefinition, getAssetUrl } from '@/assets/assetManager';

/** Loads (if not already cached) a plain image or spritesheet texture for any Phaser Scene and
 *  resolves once ready - shared by ExplorationScene/BattleScene/CutsceneScene rather than each
 *  keeping its own private copy, which had let CutsceneScene's drift from the other two (it
 *  never checked `frameSize` and always loaded as a plain image, silently unable to load a future
 *  animated sprite sheet asset). Safe to call for a texture that's already loaded (resolves
 *  immediately, no re-fetch). */
export function loadSceneTexture(scene: Phaser.Scene, assetId: string): Promise<void> {
  if (scene.textures.exists(assetId)) return Promise.resolve();
  const def = getAssetDefinition(assetId);
  const url = getAssetUrl(assetId);
  return new Promise((resolve) => {
    if (def.frameSize) {
      scene.load.spritesheet(assetId, url, { frameWidth: def.frameSize.width, frameHeight: def.frameSize.height });
    } else {
      scene.load.image(assetId, url);
    }
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.start();
  });
}
