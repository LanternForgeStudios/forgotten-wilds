import { useEffect, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useAuthStore } from '@/state/useAuthStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useNow } from '@/hooks/useNow';
import { subscribeToPartyBattle } from '@/firebase/partyBattleService';
import { resolveDisplayNames } from '@/firebase/socialService';
import { callSubmitPartyBattleAction, callVoteContinueEndlessBattle } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { getAssetUrl } from '@/assets/assetManager';
import { ENEMIES } from '@/data';
import { itemDisplayName } from '@/utils/itemName';
import type { PartyBattleSession } from '@/types';
import styles from './EndlessBattlePanel.module.css';

interface EndlessBattlePanelProps {
  battleId: string;
  onClose: () => void;
}

/** A Panel/list/button-chrome UI for Endless Battle, not a Phaser battle scene - solo combat's
 *  animated canvas (BattleScene.ts/CombatScene.tsx) represents a lot of accumulated polish that a
 *  brand-new multiplayer mode can't match in one pass. It borrows the one piece of that
 *  presentation that matters most for the "looks like a normal encounter" ask cheaply - a full-
 *  screen battle background image behind the panel, driven by the same battleBackgroundAssetId the
 *  server rolls once per run - plus a clear "whose turn is it" indicator matching the new
 *  sequential per-player turn order. A production-quality animated battle scene for this mode
 *  remains a reasonable larger follow-up. */
export function EndlessBattlePanel({ battleId, onClose }: EndlessBattlePanelProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const [battle, setBattle] = useState<PartyBattleSession | null>(null);
  const [selectedTarget, setSelectedTarget] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const now = useNow(1000);
  // While a fight is actively in progress, Escape/click-outside must NOT silently dismiss this
  // panel - closing it stops the poll below (its interval is torn down on unmount), which is
  // exactly what orphans a battle server-side forever (nobody left to ever notice the deadline
  // passed). Only dismissable between waves / at a real terminal state; a no-op callback keeps
  // this hook call unconditional (rules of hooks) without actually closing anything mid-fight.
  const canDismiss = battle?.status !== 'active';
  useOverlayClose(canDismiss ? onClose : () => {});

  useEffect(() => subscribeToPartyBattle(battleId, setBattle), [battleId]);

  useEffect(() => {
    if (!battle) return;
    const unresolved = battle.participants.filter((p) => !names[p]);
    if (unresolved.length === 0) return;
    resolveDisplayNames(unresolved).then((resolved) => setNames((prev) => ({ ...prev, ...resolved })));
  }, [battle, names]);

  // Any client can nudge a turn/timeout check even without a new action - covers the case where
  // it's not this player's turn yet and they're just waiting on the active player or the 20s
  // per-turn deadline. Fires once immediately on mount (not just on the first 3s interval tick),
  // so reconnecting/reloading into a battle whose deadline already passed a while ago (nobody was
  // around to poll it) resolves right away instead of waiting up to 3 more seconds.
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
  const activeUid = battle.turnOrder[battle.currentTurnIndex];
  const isMyTurn = activeUid === uid;
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
    <div
      className={styles.overlay}
      style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.7)), url(${getAssetUrl(battle.battleBackgroundAssetId)})` }}
    >
      <Panel className={styles.panel}>
        {canDismiss && <OverlayCloseButton onClick={onClose} />}
        <h2 className={styles.title}>Endless Battle - Wave {battle.wave}</h2>

        <h3 className={styles.sectionTitle}>Enemies</h3>
        <div className={styles.list}>
          {battle.enemies.map((e, i) => (
            <div key={i} className={styles.row} style={{ opacity: e.hp <= 0 ? 0.4 : 1 }}>
              <button
                className={i === selectedTarget ? styles.targetSelected : styles.targetButton}
                disabled={e.hp <= 0 || !isMyTurn}
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
            const displayName = p === uid ? 'You' : (names[p] ?? '...');
            const isActive = battle.status === 'active' && stats.hp > 0;
            const isTheirTurn = isActive && p === activeUid;
            return (
              <div key={p} className={styles.row} style={{ opacity: stats.hp <= 0 ? 0.4 : 1 }}>
                <span className={styles.rowName}>{displayName}</span>
                {isActive && (
                  <span className={isTheirTurn ? styles.playerActing : styles.playerReady}>
                    {isTheirTurn ? "Acting..." : 'Waiting'}
                  </span>
                )}
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

        {battle.lastTurnResult && (
          <div className={styles.log}>
            {battle.lastTurnResult.log.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {battle.status === 'active' && me && me.hp > 0 && (
          <>
            <p className={styles.countdown}>
              {isMyTurn ? `${secondsLeft}s to act` : `Waiting for ${names[activeUid] ?? '...'} to act...`}
            </p>
            {isMyTurn && (
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
                <button className={styles.dangerButton} disabled={busy} onClick={() => submit({ type: 'flee' })}>
                  Leave Battle
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
