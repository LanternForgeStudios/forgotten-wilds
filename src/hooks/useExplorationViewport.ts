import { useEffect, useState } from 'react';
import { useIsMobile } from './useIsMobile';

/** Height of the horizontal top HUD bar (PlayerHUD) - shared with the viewport calc below so the
 *  map fills exactly the space left under it, instead of guessing at a fixed tile count. `narrow`
 *  is the taller, two-row height PlayerHUD switches to below NARROW_HUD_BREAKPOINT_PX (see
 *  useHudBarHeight) so its stat bars wrap onto a second line instead of squeezing unreadably thin
 *  on very narrow viewports. */
export const HUD_BAR_HEIGHT = { desktop: 52, mobile: 44, narrow: 84 };

/** Below this viewport width, PlayerHUD wraps onto two rows (see its own matching CSS breakpoint)
 *  regardless of touch-capability - a narrow desktop window gets the same treatment as a narrow
 *  phone screen, since the problem is available horizontal space, not input method. */
const NARROW_HUD_BREAKPOINT_PX = 480;

function computeHudBarHeight(isMobile: boolean): number {
  if (typeof window !== 'undefined' && window.innerWidth <= NARROW_HUD_BREAKPOINT_PX) return HUD_BAR_HEIGHT.narrow;
  return isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop;
}

/** Live pixel height of the top HUD bar - every scene that pads its content below the
 *  fixed-position PlayerHUD must use this (not a bare isMobile ternary) or the map/content will
 *  render partially behind the bar once it wraps to two rows on a narrow viewport. */
export function useHudBarHeight(): number {
  const isMobile = useIsMobile();
  const [height, setHeight] = useState(() => computeHudBarHeight(isMobile));

  useEffect(() => {
    function handleResize() {
      setHeight(computeHudBarHeight(isMobile));
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  return height;
}

function computeViewport(isMobile: boolean) {
  const scale = isMobile ? 2 : 3;
  const hudHeight = computeHudBarHeight(isMobile);
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
