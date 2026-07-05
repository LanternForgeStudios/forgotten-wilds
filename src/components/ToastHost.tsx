import { useEffect } from 'react';
import { Panel } from './common/Panel';
import { useToastStore } from '@/state/useToastStore';
import styles from './ToastHost.module.css';

const AUTO_DISMISS_MS = 4000;

function ToastItem({ id, message }: { id: string; message: string }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timeoutId);
  }, [id, dismiss]);

  return (
    <Panel variant="accent" className={styles.toast} onClick={() => dismiss(id)}>
      <p className={styles.message}>{message}</p>
      <span className={styles.closeHint}>✕</span>
    </Panel>
  );
}

/** Mounted once at the app root so quest/progress notifications show up over any scene, including
 *  combat. Purely presentational - see useToastStore for what pushes messages here. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} />
      ))}
    </div>
  );
}
