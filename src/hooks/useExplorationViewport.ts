import { useIsMobile } from './useIsMobile';

/** Shared tile-render scale + visible camera window (in tiles) for Town/Overworld/Dungeon scenes.
 *  Smaller on mobile so the viewport fits typical phone screen widths without horizontal overflow. */
export function useExplorationViewport() {
  const isMobile = useIsMobile();
  return isMobile
    ? { scale: 2, viewportTiles: { width: 9, height: 7 } }
    : { scale: 3, viewportTiles: { width: 12, height: 8 } };
}
