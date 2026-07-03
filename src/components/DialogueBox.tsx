import { useState } from 'react';
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
  const line = lines[index];
  const isLast = index === lines.length - 1;

  function advance() {
    if (isLast) {
      onClose();
    } else {
      setIndex((i) => i + 1);
    }
  }

  if (!line) return null;

  return (
    <div className={styles.overlay} onClick={advance}>
      <Panel className={styles.box} style={{ maxWidth: 680 }}>
        <img src={getAssetUrl(portraitAssetId)} alt="" className={styles.portrait} />
        <div className={styles.body}>
          <p className={styles.speaker}>{line.speaker}</p>
          <p className={styles.text}>{line.text}</p>
          {isLast && footer}
          <p className={styles.hint}>{isLast ? 'Click to close' : 'Click to continue'}</p>
        </div>
      </Panel>
    </div>
  );
}
