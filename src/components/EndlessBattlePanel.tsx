import { useEffect, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useAuthStore } from '@/state/useAuthStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useNow } from '@/hooks/useNow';
import { subscribeToPartyBattle } from '@/firebase/partyBattleService';
import { callSubmitPartyBattleAction, callVoteContinueEndlessBattle } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { ENEMIES } from '@/data';
import { itemDisplayName } from '@/utils/itemName';
import type { PartyBattleSession } from '@/types';
import styles from './EndlessBattlePanel.module.css';

interface EndlessBattlePanelProps {
  battleId: string;
  onClose: () => void;
}

/** A functional-but-plain UI for Endless Battle - Panel/list/button chrome shared with the rest of
 *  the app's overlays, not a Phaser battle scene. Solo combat's animated canvas
 *  (BattleScene.ts/CombatScene.tsx) represents a lot of accumulated polish; matching that for a
 *  brand-new multiplayer mode in one pass wasn't a realistic bar to clear here, so this trades
 *  presentation for actually being playable end-to-end. A production-quality battle scene for this
 *  mode is a reasonable follow-up once the mechanic itself has been played and tuned. */
export function EndlessBattlePanel({ battleId, onClose }: EndlessBattlePanelProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const [battle, setBattle] = useState<PartyBattleSession | null>(null);
  const [selectedTarget, setSelectedTarget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(1000);
  useOverlayClose(onClose);

  useEffect(() => subscribeToPartyBattle(battleId, setBattle), [battleId]);

  // Any client can nudge a round/timeout check even without a new action - covers the case where
  // this player already submitted and is just waiting on the others or the 20s deadline.
  const lastPollRef = useRef(0);
  useEffect(() => {
    if (!battle || battle.status !== 'active') return;
    const id = setInterval(() => {
      if (Date.now() - lastPollRef.current < 2500) return;
      lastPollRef.current = Date.now();
      void callSubmitPartyBattleAction(battleId).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, [battle, battleId]);

  // Rewards/restores land on real saves server-side - resync whenever the battle transitions to
  // a state that implies a real-save write just happened (wave cleared, run ended).
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!battle || !uid) return;
    if (prevStatusRef.current !== battle.status && ['awaitingContinueVote', 'defeated', 'withdrawn'].includes(battle.status)) {
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
  const iSubmitted = !!battle.pendingActions[uid];
  const aliveEnemies = battle.enemies.filter((e) => e.hp > 0);
  const secondsLeft = Math.max(0, Math.ceil((battle.turnDeadlineAt - now) / 1000));

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

  async function vote(wantsToContinue: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await callVoteContinueEndlessBattle(battleId, wantsToContinue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cast that vote.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <Panel className={styles.panel}>
        <OverlayCloseButton onClick={onClose} />
        <h2 className={styles.title}>Endless Battle - Wave {battle.wave}</h2>

        <h3 className={styles.sectionTitle}>Enemies</h3>
        <div className={styles.list}>
          {battle.enemies.map((e, i) => (
            <div key={i} className={styles.row} style={{ opacity: e.hp <= 0 ? 0.4 : 1 }}>
              <button
                className={i === selectedTarget ? styles.targetSelected : styles.targetButton}
                disabled={e.hp <= 0}
                onClick={() => setSelectedTarget(i)}
              >
                {ENEMIES.find((def) => def.id === e.enemyId)?.name ?? e.enemyId} (Lv.{e.level})
              </button>
              <div className={styles.barTrack}>
                <div className={styles.barFillEnemy} style={{ width: `${(e.hp / e.maxHp) * 100}%` }} />
                <span className={styles.barValue}>
                  {e.hp}/{e.maxHp}
                </span>
              </div>
            </div>
          ))}
        </div>

        <h3 className={styles.sectionTitle}>Party</h3>
        <div className={styles.list}>
          {battle.participants.map((p) => {
            const stats = battle.participantStats[p];
            return (
              <div key={p} className={styles.row} style={{ opacity: stats.hp <= 0 ? 0.4 : 1 }}>
                <span className={styles.rowName}>
                  {p === uid ? 'You' : p}
                  {battle.status === 'active' && battle.pendingActions[p] ? ' ✓' : ''}
                </span>
                <div className={styles.barTrack}>
                  <div className={styles.barFillHp} style={{ width: `${(stats.hp / stats.maxHp) * 100}%` }} />
                  <span className={styles.barValue}>
                    {stats.hp}/{stats.maxHp}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {battle.lastRoundResult && (
          <div className={styles.log}>
            {battle.lastRoundResult.log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {battle.status === 'active' && me && me.hp > 0 && (
          <>
            <p className={styles.countdown}>{iSubmitted ? 'Waiting for your party...' : `${secondsLeft}s to act`}</p>
            {!iSubmitted && (
              <div className={styles.actionRow}>
                <button
                  className={styles.smallButton}
                  disabled={busy || aliveEnemies.length === 0}
                  onClick={() => submit({ type: 'attack', targetIndex: selectedTarget })}
                >
                  Attack
                </button>
                <button className={styles.smallButton} disabled={busy} onClick={() => submit({ type: 'defend' })}>
                  Defend
                </button>
              </div>
            )}
          </>
        )}

        {battle.status === 'active' && me && me.hp <= 0 && <p className={styles.empty}>You are down - waiting for the party.</p>}

        {battle.status === 'awaitingContinueVote' && (
          <>
            <p className={styles.countdown}>Wave {battle.wave} cleared!</p>
            {battle.lastWaveRewards?.[uid] && (
              <p className={styles.rewardLine}>
                +{battle.lastWaveRewards[uid].xp} XP, +{battle.lastWaveRewards[uid].gold}g
                {battle.lastWaveRewards[uid].itemIds.length > 0 &&
                  `, ${battle.lastWaveRewards[uid].itemIds.map(itemDisplayName).join(', ')}`}
              </p>
            )}
            {battle.continueVotes[uid] ? (
              <p className={styles.empty}>Waiting for the rest of the party to vote...</p>
            ) : (
              <div className={styles.actionRow}>
                <button className={styles.smallButton} disabled={busy} onClick={() => vote(true)}>
                  Continue to Wave {battle.wave + 1}
                </button>
                <button className={styles.dangerButton} disabled={busy} onClick={() => vote(false)}>
                  Withdraw
                </button>
              </div>
            )}
          </>
        )}

        {(battle.status === 'defeated' || battle.status === 'withdrawn') && (
          <>
            <p className={styles.countdown}>
              {battle.status === 'defeated' ? 'The party was defeated.' : 'The party withdrew.'} Reached Wave {battle.wave}.
              Everyone has been restored to full health.
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
