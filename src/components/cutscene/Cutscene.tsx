import { useEffect, useState } from 'react';
import { useCutsceneStore } from '@/state/useCutsceneStore';
import { PhaserCutsceneCanvas } from './PhaserCutsceneCanvas';
import styles from './Cutscene.module.css';

/** Mounted once at the app root (see App.tsx), rendering above whichever scene is currently
 *  active whenever useCutsceneStore.active is set - trigger sites never render this themselves,
 *  they just call useCutsceneStore.getState().play(config) from wherever the moment happens
 *  (post-login, mid-combat, quest completion). Text advances one line at a time, same click/Space
 *  UX as DialogueBox; Escape (or the Skip button) jumps straight to the end. */
export function Cutscene() {
  const active = useCutsceneStore((s) => s.active);
  const finish = useCutsceneStore((s) => s.finish);
  const [index, setIndex] = useState(0);

  // Reset to the first line whenever a *new* cutscene starts (active reference changes) - without
  // this, a second cutscene fired later in the same session would resume at whatever line index
  // the previous one ended the render cycle on.
  useEffect(() => {
    setIndex(0);
  }, [active]);

  const isLast = active ? index === active.lines.length - 1 : true;

  function advance() {
    if (!active) return;
    if (isLast) finish();
    else setIndex((i) => i + 1);
  }

  useEffect(() => {
    if (!active) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        finish();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, isLast]);

  if (!active) return null;

  return (
    <>
      <PhaserCutsceneCanvas backgroundAssetId={active.backgroundAssetId} dramatic={active.dramatic} />
      <div className={styles.textOverlay} onClick={advance}>
        <div className={styles.box}>
          <p className={styles.text}>{active.lines[index]}</p>
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.skipButton}
              onClick={(e) => {
                e.stopPropagation();
                finish();
              }}
            >
              Skip
            </button>
            <p className={styles.hint}>{isLast ? 'Click or Space to continue' : 'Click or Space for more'}</p>
          </div>
        </div>
      </div>
    </>
  );
}
