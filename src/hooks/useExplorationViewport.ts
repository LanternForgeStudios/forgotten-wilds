import { useEffect, useState } from 'react';
import { useIsMobile } from './useIsMobile';

/** Height of the horizontal top HUD bar (PlayerHUD) - shared with the viewport calc below so the
 *  map fills exactly the space left under it, instead of guessing at a fixed tile count. */
export const HUD_BAR_HEIGHT = { desktop: 52, mobile: 44 };

function computeViewport(isMobile: boolean) {
  const scale = isMobile ? 2 : 3;
  const hudHeight = isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop;
  return {
    scale,
    // Exact window pixels, not a tile count multiplied back out - guarantees the viewport box
    // always matches the real available window area with no floor-to-tile rounding gap. Edge
    // tiles may render partially cropped, which is normal for a scrolling camera.
    viewportSize: {
      width: window.innerWidth,
      height: window.innerHeight - hudHeight,
    },
  };
}

/** Tile-render scale + camera window (in px) for Town/Overworld/Dungeon scenes, sized to fill the
 *  actual window under the top HUD bar rather than a fixed guess - recomputed on resize. */
export function useExplorationViewport() {
  const isMobile = useIsMobile();
  const [viewport, setViewport] = useState(() => computeViewport(isMobile));

  useEffect(() => {
    // Debounced (not recomputed on every event) + bails out via reference-equality when the
    // computed viewport hasn't actually changed. iOS Safari's dynamic URL-bar collapse fires a
    // rapid burst of native resize events (something a PC window resize never replicates), and
    // without this, each one forced a fresh re-render/repaint of the large, non-virtualized
    // TileGrid - compounding into the flash/fail pattern reported when an encounter triggered
    // mid-burst.
    let timeout: ReturnType<typeof setTimeout>;
    function handleResize() {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setViewport((prev) => {
          const next = computeViewport(isMobile);
          return prev.scale === next.scale &&
            prev.viewportSize.width === next.viewportSize.width &&
            prev.viewportSize.height === next.viewportSize.height
            ? prev
            : next;
        });
      }, 150);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  return viewport;
}
