import { useEffect, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useAuthStore } from '@/state/useAuthStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useNow } from '@/hooks/useNow';
import { subscribeToPartyBattle } from '@/firebase/partyBattleService';
import { resolveDisplayNames } from '@/firebase/socialService';
import { callSubmitPartyBattleAction } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { getAssetUrl } from '@/assets/assetManager';
import type { PartyBattleSession } from '@/types';
// Reuses Endless Battle's stylesheet - same Panel/list/bar chrome, no PvP-specific classes needed.
import styles from './EndlessBattlePanel.module.css';

interface PvpBattlePanelProps {
  battleId: string;
  onClose: () => void;
}

/** A 1-on-1 PvP duel, sharing EndlessBattlePanel's "looks like a normal encounter" presentation
 *  (full-screen battle background, whose-turn-is-it indicator) but with a single opponent standing
 *  in the enemy slot instead of a wave of monsters - see partyCombatEngine.ts's resolvePvpTurn for
 *  why PvP resolution is its own engine path rather than reusing the enemy-board one. */
export function PvpBattlePanel({ battleId, onClose }: PvpBattlePanelProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const [battle, setBattle] = useState<PartyBattleSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const now = useNow(1000);
  // While the duel is actively in progress, Escape/click-outside must NOT silently dismiss this
  // panel - closing it stops the poll below (its interval is torn down on unmount), which is
  // exactly what orphans a match server-side forever (nobody left to notice the deadline passed
  // or to see the Forfeit button). Only dismissable once the match has actually ended; a no-op
  // callback keeps this hook call unconditional (rules of hooks) without closing anything mid-duel.
  const canDismiss = battle?.status !== 'active';
  useOverlayClose(canDismiss ? onClose : () => {});

  useEffect(() => subscribeToPartyBattle(battleId, setBattle), [battleId]);

  useEffect(() => {
    if (!battle) return;
    const unresolved = battle.participants.filter((p) => !names[p]);
    if (unresolved.length === 0) return;
    resolveDisplayNames(unresolved).then((resolved) => setNames((prev) => ({ ...prev, ...resolved })));
  }, [battle, names]);

  // Same client-triggered timeout model as Endless Battle - any client's periodic poll can force
  // the active player's turn to resolve (with Defend substituted) once the 20s deadline passes.
  // Fires once immediately on mount (not just on the first 3s interval tick), so reconnecting/
  // reloading into a match whose deadline already passed a while ago resolves right away instead
  // of waiting up to 3 more seconds. Also fires on tab-visibility regain - a backgrounded browser
  // tab throttles setInterval (Chrome can drop to roughly once a minute after a tab's been hidden
  // a while), so alt-tabbing away and back would otherwise sit on a stale readout well past the
  // real deadline until the throttled interval happens to tick; visibilitychange fires immediately
  // regardless of throttling.
  const lastPollRef = useRef(0);
  useEffect(() => {
    if (!battle || battle.status !== 'active') return;
    const poll = () => {
      if (Date.now() - lastPollRef.current < 2500) return;
      lastPollRef.current = Date.now();
      void callSubmitPartyBattleAction(battleId).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [battle, battleId]);

  // The match's end (win or lose) restores both real saves and grants rewards server-side -
  // resync once that lands.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!battle || !uid) return;
    if (prevStatusRef.current !== battle.status && battle.status === 'victory') {
      void resyncSave(uid);
    }
    prevStatusRef.current = battle.status;
  }, [battle, uid]);

  if (!battle || !uid) {
    return (
      <div className={styles.overlay} onClick={onClose}>
        <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <OverlayCloseButton onClick={onClose} />
          <p className={styles.empty}>Loading battle...</p>
        </Panel>
      </div>
    );
  }

  const me = battle.participantStats[uid];
  const opponentUid = battle.participants.find((p) => p !== uid)!;
  const opponent = battle.participantStats[opponentUid];
  const opponentName = names[opponentUid] ?? '...';
  const activeUid = battle.turnOrder[battle.currentTurnIndex];
  const isMyTurn = activeUid === uid;
  const secondsLeft = Math.max(0, Math.ceil((battle.turnDeadlineAt - now) / 1000));
  const iWon = battle.winnerUid === uid;

  async function submit(action: Parameters<typeof callSubmitPartyBattleAction>[1]) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await callSubmitPartyBattleAction(battleId, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit that action.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7)), url(${getAssetUrl(battle.battleBackgroundAssetId)})` }}
    >
      <Panel className={styles.panel}>
        {canDismiss && <OverlayCloseButton onClick={onClose} />}
        <h2 className={styles.title}>PvP Duel</h2>

        <h3 className={styles.sectionTitle}>Opponent</h3>
        <div className={styles.list}>
          <div className={styles.row} style={{ opacity: opponent.hp <= 0 ? 0.4 : 1 }}>
            <span className={styles.rowName}>{opponentName}</span>
            <div className={styles.barTrack}>
              <div className={styles.barFillEnemy} style={{ width: `${(opponent.hp / opponent.maxHp) * 100}%` }} />
              <span className={styles.barValue}>
                {opponent.hp}/{opponent.maxHp}
              </span>
            </div>
          </div>
        </div>

        <h3 className={styles.sectionTitle}>You</h3>
        <div className={styles.list}>
          <div className={styles.row} style={{ opacity: me.hp <= 0 ? 0.4 : 1 }}>
            <span className={styles.rowName}>You</span>
            <div className={styles.barTrack}>
              <div className={styles.barFillHp} style={{ width: `${(me.hp / me.maxHp) * 100}%` }} />
              <span className={styles.barValue}>
                {me.hp}/{me.maxHp}
              </span>
            </div>
          </div>
        </div>

        {battle.lastTurnResult && (
          <div className={styles.log}>
            {battle.lastTurnResult.log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {battle.status === 'active' && (
          <>
            <p className={styles.countdown}>
              {isMyTurn ? `${secondsLeft}s to act` : `Waiting for ${opponentName} to act...`}
            </p>
            <div className={styles.actionRow}>
              {isMyTurn && (
                <>
                  <button className={styles.smallButton} disabled={busy} onClick={() => submit({ type: 'attack' })}>
                    Attack
                  </button>
                  <button className={styles.smallButton} disabled={busy} onClick={() => submit({ type: 'defend' })}>
                    Defend
                  </button>
                </>
              )}
              {/* Forfeiting works regardless of whose turn it is - see submitPartyBattleAction's
                  own doc comment on why flee bypasses the turn-order gate entirely. */}
              <button className={styles.dangerButton} disabled={busy} onClick={() => submit({ type: 'flee' })}>
                Forfeit
              </button>
            </div>
          </>
        )}

        {battle.status === 'victory' && (
          <>
            <p className={styles.countdown}>
              {iWon ? `You defeated ${opponentName}!` : `You were defeated by ${opponentName}.`} Both of you have been
              restored to full health.
            </p>
            <button className={styles.smallButton} onClick={onClose}>
              Close
            </button>
          </>
        )}
      </Panel>
    </div>
  );
}
