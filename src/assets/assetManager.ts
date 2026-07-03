import { ASSET_REGISTRY, findAsset, type AssetDefinition } from './registry';

const ASSET_BASE_URL = `${import.meta.env.BASE_URL}assets/`;

const imageCache = new Map<string, HTMLImageElement>();

export class UnknownAssetError extends Error {
  constructor(id: string) {
    super(`No asset registered with id "${id}". Check src/assets/registry.ts.`);
    this.name = 'UnknownAssetError';
  }
}

/** Resolves a registered asset's definition. Throws if the id isn't registered — a missing id is a bug, not a runtime fallback case. */
export function getAssetDefinition(id: string): AssetDefinition {
  const def = findAsset(id);
  if (!def) throw new UnknownAssetError(id);
  return def;
}

/** Resolves a registered asset's on-disk URL, for use in <img src>, CSS background-image, or Tiled tileset loading. */
export function getAssetUrl(id: string): string {
  return `${ASSET_BASE_URL}${getAssetDefinition(id).filePath}`;
}

/** Loads (and caches) an image asset, returning the decoded HTMLImageElement. */
export function loadImage(id: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(id);
  if (cached) return Promise.resolve(cached);

  const url = getAssetUrl(id);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(id, img);
      resolve(img);
    };
    img.onerror = () => reject(new Error(`Failed to load asset "${id}" from ${url}`));
    img.src = url;
  });
}

export function preload(ids: string[]): Promise<HTMLImageElement[]> {
  return Promise.all(ids.map(loadImage));
}

export function listPlaceholderAssets() {
  return ASSET_REGISTRY.filter((a) => a.status === 'placeholder');
}
