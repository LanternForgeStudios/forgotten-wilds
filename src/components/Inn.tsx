import { useState } from 'react';
import { Panel } from './common/Panel';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useAuthStore } from '@/state/useAuthStore';
import { callRestAtInn } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { INN_REST_COST } from '@/data';
import styles from './CharacterMenu.module.css';

interface InnProps {
  onClose: () => void;
}

export function Inn({ onClose }: InnProps) {
  const player = usePlayerStore((s) => s.player);
  const uid = useAuthStore((s) => s.user?.uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rested, setRested] = useState(false);

  async function rest() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await callRestAtInn();
      if (uid) await resyncSave(uid);
      setRested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rest right now.');
    } finally {
      setBusy(false);
    }
  }

  const canAfford = (player?.gold ?? 0) >= INN_REST_COST;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} style={{ width: 'min(400px, 92vw)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <h2 style={{ color: 'var(--fw-accent)', margin: '0 0 8px' }}>Juniper Reed's Inn</h2>
        <p style={{ fontSize: 13 }}>Rest for {INN_REST_COST}g and restore your HP and Spirit fully.</p>
        <p style={{ fontSize: 13 }}>Your gold: {player?.gold ?? 0}g</p>
        {rested ? (
          <p style={{ color: 'var(--fw-spirit)' }}>You feel fully restored.</p>
        ) : (
          <button className={styles.smallButton} disabled={busy || !canAfford} onClick={rest}>
            Rest ({INN_REST_COST}g)
          </button>
        )}
        {error && <p style={{ color: 'var(--fw-danger)', fontSize: 13 }}>{error}</p>}
        <p className={styles.closeHint}>Click outside to close</p>
      </Panel>
    </div>
  );
}
