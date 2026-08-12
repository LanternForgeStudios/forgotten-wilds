import { useEffect, useState } from 'react';
import type { DialogueLine } from '@/types';
import { getAssetUrl } from '@/assets/assetManager';
import { Panel } from './common/Panel';
import styles from './DialogueBox.module.css';

interface DialogueBoxProps {
  lines: DialogueLine[];
  portraitAssetId: string;
  onClose: () => void;
  /** Rendered after the last line, e.g. a "Browse wares" / "Rest" action button. */
  footer?: React.ReactNode;
}

export function DialogueBox({ lines, portraitAssetId, onClose, footer }: DialogueBoxProps) {
  const [index, setIndex] = useState(0);
  // `lines` is recomputed from live quest state on every render (resolveNpcDialogue reads the
  // Zustand store directly, not a snapshot frozen at open-time - see talkToNpc.ts's own comment on
  // why the *shown* variant is captured server-side instead), so a resync landing mid-read (e.g.
  // this exact conversation completing an objective) can swap in a shorter lines array while
  // `index` still points past its new end. Clamping here turns that into "show the last available
  // line of the new variant" instead of `line` becoming undefined - which made the whole box
  // silently render nothing, with no way to close it since the click/Space handlers live on the
  // now-unrendered box (activeNpc stayed set, soft-locking the scene until a page refresh).
  const clampedIndex = Math.min(index, lines.length - 1);
  const line = lines[clampedIndex];
  const isLast = clampedIndex === lines.length - 1;

  function advance() {
    if (isLast) {
      onClose();
    } else {
      setIndex(clampedIndex + 1);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isLast, onClose]);

  if (!line) return null;

  return (
    <div className={styles.overlay} onClick={advance}>
      <Panel className={styles.box} style={{ maxWidth: 680 }}>
        <img src={getAssetUrl(portraitAssetId)} alt="" className={styles.portrait} />
        <div className={styles.body}>
          <p className={styles.speaker}>{line.speaker}</p>
          <p className={styles.text}>{line.text}</p>
          {isLast && footer}
          <p className={styles.hint}>{isLast ? 'Click or Space to close' : 'Click or Space to continue'}</p>
        </div>
      </Panel>
    </div>
  );
}
