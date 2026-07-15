import { useEffect } from 'react';
import { playSound } from '@/audio/audioService';

/** Lets any overlay/modal close via Escape, in addition to whatever click-outside handling it already has. */
export function useOverlayClose(onClose: () => void) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void playSound('sfx.ui-close');
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
}
