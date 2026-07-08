import { useEffect, useState } from 'react';
import type { TileMap } from '@/types';
import { loadTiledMap } from '@/assets/tiledLoader';

const cache = new Map<string, TileMap>();

export function useTileMap(locationId: string, mapAssetId: string) {
  const [renderedLocationId, setRenderedLocationId] = useState(locationId);
  const [map, setMap] = useState<TileMap | null>(cache.get(locationId) ?? null);
  const [error, setError] = useState<string | null>(null);

  // "Adjust state during render" (an officially-supported React pattern for resetting state when
  // a prop changes) rather than relying solely on the effect below. Town/Overworld/Dungeon don't
  // remount when transitioning between an interior and its outer map (goTo just updates
  // params.locationId on the same scene component), so this hook instance persists across
  // transitions - without this, a render can see the NEW locationId paired with the OLD
  // location's `map` for a full render/commit cycle (the effect that would fix it hasn't run
  // yet), and anything reading both together during that window - collision checks, transition
  // lookups, encounter rolls - operates on mismatched data. Confirmed responsible for an
  // intermittent "walking into a building re-enters a previously-visited one instead" bug on real
  // devices, where the async gap this window depends on is wide enough to matter.
  if (locationId !== renderedLocationId) {
    setRenderedLocationId(locationId);
    setMap(cache.get(locationId) ?? null);
    setError(null);
  }

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
