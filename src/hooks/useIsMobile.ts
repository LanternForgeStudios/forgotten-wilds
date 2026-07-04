import { useEffect, useState } from 'react';

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return coarsePointer || hasTouch;
}

/** True for touch/coarse-pointer devices (phones, tablets) - used to swap keyboard-only controls
 *  for on-screen touch controls. Re-checks on resize since a device can switch input modes
 *  (e.g. a 2-in-1 laptop) though the touch-capability signal itself won't change mid-session. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(detectMobile);

  useEffect(() => {
    function handleResize() {
      setIsMobile(detectMobile());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
