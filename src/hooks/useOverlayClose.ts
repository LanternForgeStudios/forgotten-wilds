import { useEffect } from 'react';

/** Lets any overlay/modal close via Escape, in addition to whatever click-outside handling it already has. */
export function useOverlayClose(onClose: () => void) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
}
