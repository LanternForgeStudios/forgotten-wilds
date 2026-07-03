import { useEffect, useState } from 'react';
import type { TileMap } from '@/types';
import { loadTiledMap } from '@/assets/tiledLoader';

const cache = new Map<string, TileMap>();

export function useTileMap(locationId: string, mapAssetId: string) {
  const [map, setMap] = useState<TileMap | null>(cache.get(locationId) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = cache.get(locationId);
    if (cached) {
      setMap(cached);
      return;
    }
    let cancelled = false;
    loadTiledMap(locationId, mapAssetId)
      .then((loaded) => {
        if (cancelled) return;
        cache.set(locationId, loaded);
        setMap(loaded);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load map.');
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, mapAssetId]);

  return { map, error };
}
