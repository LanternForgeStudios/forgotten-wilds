import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { PhaserBattleCanvas } from './combat/PhaserBattleCanvas';
import { useAuthStore } from '@/state/useAuthStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useNow } from '@/hooks/useNow';
import { subscribeToPartyBattle } from '@/firebase/partyBattleService';
import { resolveDisplayNames } from '@/firebase/socialService';
import { callSubmitPartyBattleAction, callUseItemInPartyBattle } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { getCurrentMusicId, playMusic, playSound } from '@/audio/audioService';
import { getAssetUrl } from '@/assets/assetManager';
import { AILMENTS, EQUIPMENT, ITEMS, LANTERN_ABILITIES, SKILLS } from '@/data';
import { AILMENT_TINT_COLORS } from '@/utils/ailmentTint';
import { itemDisplayName } from '@/utils/itemName';
import { itemWouldHaveEffect } from '@/utils/itemEffect';
import type { PartyBattleSession } from '@/types';
// Reuses Endless Battle's stylesheet - same Panel/list/bar chrome, no PvP-specific classes needed.
import styles from './EndlessBattlePanel.module.css';

interface PvpBattlePanelProps {
  battleId: string;
  onClose: () => void;
}

/** A 1-on-1 PvP duel sharing Endless Battle's "looks like a normal encounter" presentation - the
 *  same `PhaserBattleCanvas`/`BattleScene.ts`, just with the opponent's own player sprite (their
 *  real skin) standing in the single enemy slot instead of a monster, and the same full action
 *  menu. See partyCombatEngine.ts's resolvePvpTurn for why PvP resolution is its own engine path
 *  rather than reusing the enemy-board one - `enemies` here is always a synthetic one-element
 *  array built from the opponent's own PartyBattleParticipantStats. */
export function PvpBattlePanel({ battleId, onClose }: PvpBattlePanelProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const inventory = useInventoryStore((s) => s.items);
  const [battle, setBattle] = useState<PartyBattleSession | null>(null);
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState(false);
  // Up to 3 item ids queued in the item menu, applied immediately on "Done" - matches solo
  // combat's own tray/finishItemMenu and EndlessBattlePanel's identical rework; items never
  // consume a turn. See EndlessBattlePanel.tsx's finishItemMenu for the full reasoning.
  const [tray, setTray] = useState<string[]>([]);
  const [usingItems, setUsingItems] = useState(false);
  const [itemsUsedThisTurn, setItemsUsedThisTurn] = useState(0);
  const [confirmForfeit, setConfirmForfeit] = useState(false);
  const [busy, setBusy] = useState(false);
  // Synchronous guard alongside `busy` (React state) - closes the same double-click race
  // EndlessBattlePanel.tsx guards against (see its own comment on submittingRef).
  const submittingRef = useRef(false);
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
  // resync once that lands. Same transition also drives the win/loss sound cue - status is a
  // single shared 'victory' for both participants, so which sound plays is decided per-viewer via
  // winnerUid (see this component's own iWon below), mirroring CombatScene.tsx's sfx.victory/
  // sfx.defeat + music.defeat.
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!battle || !uid) return;
    if (prevStatusRef.current !== battle.status && battle.status === 'victory') {
      void resyncSave(uid);
      if (battle.winnerUid === uid) {
        void playSound('sfx.victory');
      } else {
        void playSound('sfx.defeat');
        void playMusic('music.defeat');
      }
    }
    prevStatusRef.current = battle.status;
  }, [battle, uid]);

  // Switches to combat music once real battle data first arrives, and restores whatever was
  // playing before on unmount - see EndlessBattlePanel.tsx's identical wiring/reasoning (this
  // panel is likewise an overlay, not a scene transition). No boss variant here - a PvP opponent
  // is another player, not an enemy tier.
  const previousMusicIdRef = useRef<string | null>(null);
  const combatMusicStartedRef = useRef(false);
  useEffect(() => {
    if (!battle || combatMusicStartedRef.current) return;
    combatMusicStartedRef.current = true;
    previousMusicIdRef.current = getCurrentMusicId();
    void playMusic('music.combat');
  }, [battle]);
  useEffect(() => {
    return () => {
      if (previousMusicIdRef.current) void playMusic(previousMusicIdRef.current);
    };
  }, []);

  // Structured hit data (Phase F1) drives the canvas's hit animation - but unlike Endless Battle's
  // shared enemy board, PvP's single `pvpHit` doesn't say *who* it was dealt to, since turns
  // strictly alternate between exactly two participants. Tracking the previous snapshot's active
  // uid (captured right before it's overwritten below) tells us who just acted regardless of
  // whether this was an ordinary turn (currentTurnIndex already advanced to the *next* player) or
  // a match-ending one (currentTurnIndex deliberately left pointing at the player who just won/
  // forfeited) - both cases correctly resolve to "whoever was active in the previous snapshot".
  const prevActiveUidRef = useRef<string | null>(null);
  const [activeOutgoingHits, setActiveOutgoingHits] = useState<
    ({ targetIndex: number; damage: number; missed: boolean; defeated: boolean } & { key: number })[]
  >([]);
  const [activeIncomingHits, setActiveIncomingHits] = useState<
    ({ attackerIndex: number; damage: number; missed: boolean; wasDefended: boolean; logLine: string } & { key: number })[]
  >([]);
  useEffect(() => {
    if (!battle) return;
    const currentActiveUid = battle.turnOrder[battle.currentTurnIndex];
    const lastActorUid = prevActiveUidRef.current;
    prevActiveUidRef.current = currentActiveUid;

    const resolvedAt = battle.lastTurnResult?.resolvedAt;
    const pvpHit = battle.lastTurnResult?.pvpHit;
    if (!lastActorUid || !resolvedAt || !pvpHit) {
      setActiveOutgoingHits([]);
      setActiveIncomingHits([]);
      return;
    }
    // Mirrors CombatScene.tsx's own sfx.combat-hit/sfx.enemy-defeated triggers - defeating a human
    // opponent reuses the same "defeated" sting rather than a separate PvP-only asset.
    if (!pvpHit.missed) void playSound('sfx.combat-hit');
    if (pvpHit.defeated) void playSound('sfx.enemy-defeated');
    if (lastActorUid === uid) {
      setActiveOutgoingHits([{ targetIndex: 0, ...pvpHit, key: resolvedAt }]);
      setActiveIncomingHits([]);
    } else {
      setActiveIncomingHits([{ attackerIndex: 0, damage: pvpHit.damage, missed: pvpHit.missed, wasDefended: false, logLine: '', key: resolvedAt }]);
      setActiveOutgoingHits([]);
    }
    const id = setTimeout(() => {
      setActiveOutgoingHits([]);
      setActiveIncomingHits([]);
    }, 1400);
    return () => clearTimeout(id);
  }, [battle, uid]);

  // True for the full duration of a turn's hit playback - see EndlessBattlePanel.tsx's identical
  // playbackActive for the full reasoning (matches solo combat's own fixed minimum pause). A
  // separate effect from the hit-attribution one above since that one's dependency ([battle, uid])
  // is broader than "a turn just resolved" (e.g. also fires on a continueVotes-only change) and
  // would otherwise retrigger this pause for unrelated updates.
  const [playbackActive, setPlaybackActive] = useState(false);
  useEffect(() => {
    const resolvedAt = battle?.lastTurnResult?.resolvedAt;
    if (!resolvedAt) return;
    setPlaybackActive(true);
    const id = setTimeout(() => setPlaybackActive(false), 1400);
    return () => clearTimeout(id);
  }, [battle?.lastTurnResult?.resolvedAt]);

  // Drives PhaserBattleCanvas's FX-pack ailment bursts for the viewer's own ailments - see
  // EndlessBattlePanel.tsx's identical wiring for the full reasoning (mirrors CombatScene.tsx).
  const prevAilmentIdsRef = useRef<Set<string>>(new Set());
  const [ailmentFxEvent, setAilmentFxEvent] = useState<{ ailmentIds: string[]; key: number }>({ ailmentIds: [], key: 0 });
  const [ailmentTakesHoldEvent, setAilmentTakesHoldEvent] = useState<{ ailmentIds: string[]; key: number }>({
    ailmentIds: [],
    key: 0,
  });
  useEffect(() => {
    const resolvedAt = battle?.lastTurnResult?.resolvedAt;
    if (!battle || !uid || !resolvedAt) return;
    const currentIds = (battle.participantStats[uid]?.ailments ?? []).map((a) => a.ailmentId);
    const newlyInflicted = currentIds.filter((id) => !prevAilmentIdsRef.current.has(id));
    prevAilmentIdsRef.current = new Set(currentIds);
    setAilmentFxEvent({ ailmentIds: currentIds, key: resolvedAt });
    if (newlyInflicted.length > 0) setAilmentTakesHoldEvent({ ailmentIds: newlyInflicted, key: resolvedAt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.lastTurnResult?.resolvedAt]);

  // Enemy-side equivalent of the above, for the opponent's sprite - PvP's opponent renders as a
  // single-element enemy slot (index 0, see opponentVisuals below), so a Skill/weapon landing an
  // ailment on them bursts that ailment's FX on their sprite the same way EndlessBattlePanel.tsx
  // does for a real enemy. See BattleScene.playEnemyAilmentTakesHold's own doc comment.
  const prevOpponentAilmentIdsRef = useRef<Set<string>>(new Set());
  const [enemyAilmentTakesHoldEvent, setEnemyAilmentTakesHoldEvent] = useState<{
    entries: { enemyIndex: number; ailmentIds: string[] }[];
    key: number;
  }>({ entries: [], key: 0 });
  useEffect(() => {
    const resolvedAt = battle?.lastTurnResult?.resolvedAt;
    const opponent = battle?.participants.find((p) => p !== uid);
    if (!battle || !opponent || !resolvedAt) return;
    const currentIds = (battle.participantStats[opponent]?.ailments ?? []).map((a) => a.ailmentId);
    const newlyInflicted = currentIds.filter((id) => !prevOpponentAilmentIdsRef.current.has(id));
    prevOpponentAilmentIdsRef.current = new Set(currentIds);
    if (newlyInflicted.length > 0) {
      setEnemyAilmentTakesHoldEvent({ entries: [{ enemyIndex: 0, ailmentIds: newlyInflicted }], key: resolvedAt });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.lastTurnResult?.resolvedAt]);

  const opponentUid = battle?.participants.find((p) => p !== uid);
  const opponentName = opponentUid ? (names[opponentUid] ?? '...') : '...';
  const opponentVisuals = useMemo(() => {
    if (!battle || !opponentUid) return [];
    const opponent = battle.participantStats[opponentUid];
    return [
      {
        index: 0,
        spriteAssetId: `sprite.player.${opponent.skin}`,
        name: opponentName,
        tierLabel: '',
        tierColor: '#ece1cf',
        tier: 'regular' as const,
        level: 0,
        hp: opponent.hp,
        maxHp: opponent.maxHp,
        isBoss: false,
        // Gated on 'active' the same way myAilments is below - participantStats.ailments isn't
        // cleared by the end-of-match restore, so an ended duel would otherwise still show a
        // stale tint/badge on the opponent's sprite.
        ailmentIds: battle.status === 'active' ? (opponent.ailments ?? []).map((a) => a.ailmentId) : [],
      },
    ];
    // opponentName intentionally omitted - resolving it a moment after mount shouldn't force
    // PhaserBattleCanvas's own enemy-sync effect to re-run for a name-only change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle, opponentUid]);

  if (!battle || !uid || !opponentUid) {
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
  const secondsLeft = Math.max(0, Math.ceil((battle.turnDeadlineAt - now) / 1000));
  const iWon = battle.winnerUid === uid;
  // A stunned active player's turn always resolves as a no-op - see submitPartyBattleAction's own
  // comment on why the server auto-forces it through on the next poll instead of waiting out the
  // deadline. Shown so the countdown doesn't read as "pick an action" when nothing matters.
  const isStunned = (me.ailments ?? []).some((a) => AILMENTS[a.ailmentId]?.effect.skipsTurn);
  // See EndlessBattlePanel.tsx's identical comment on isSilenced/isLanternDisabled.
  const isSilenced = (me.ailments ?? []).some((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
  const isLanternDisabled = (me.ailments ?? []).some((a) => AILMENTS[a.ailmentId]?.effect.disablesLanternAbility);
  // Gated on the match still being active - see EndlessBattlePanel.tsx's identical comment on why
  // (participantStats.ailments isn't cleared by the end-of-match restore).
  const myAilments = battle.status === 'active' ? (me.ailments ?? []) : [];
  const isBlinded = myAilments.some((a) => AILMENTS[a.ailmentId]?.effect.physicalAccuracyMultiplier);
  const activeTintColors = myAilments.map((a) => AILMENT_TINT_COLORS[a.ailmentId]).filter((c): c is string => !!c);

  const knownSkillIds = me.knownSkillIds ?? ['keepers-strike'];
  const knownSkills = knownSkillIds.map((id) => SKILLS.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const lanternDef = me.lanternId ? EQUIPMENT.find((e) => e.id === me.lanternId) : undefined;
  const lanternAbilities = (lanternDef?.lanternAbilityIds ?? [])
    .map((id) => LANTERN_ABILITIES.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const combatItems = inventory.filter((i) => ITEMS.find((def) => def.id === i.itemId)?.category === 'consumable');

  async function submit(action: Parameters<typeof callSubmitPartyBattleAction>[1]) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    setItemsUsedThisTurn(0);
    try {
      await callSubmitPartyBattleAction(battleId, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit that action.');
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  function submitSkill(skillId: string) {
    setShowSkillMenu(false);
    void submit({ type: 'skill', skillId });
  }

  const queuedCountFor = (itemId: string) => tray.filter((id) => id === itemId).length;
  const canQueueMore = itemsUsedThisTurn + tray.length < 3;
  function queueItem(itemId: string) {
    const owned = combatItems.find((i) => i.itemId === itemId)?.quantity ?? 0;
    if (!canQueueMore || queuedCountFor(itemId) >= owned) return;
    setTray((prev) => [...prev, itemId]);
  }
  function dequeueItem(itemId: string) {
    setTray((prev) => {
      const i = prev.lastIndexOf(itemId);
      if (i === -1) return prev;
      return [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  }

  async function finishItemMenu() {
    if (tray.length === 0) {
      setShowItemMenu(false);
      return;
    }
    const queued = tray;
    setUsingItems(true);
    let usedCount = 0;
    let failed = false;
    for (const itemId of queued) {
      try {
        await callUseItemInPartyBattle(battleId, itemId);
        usedCount += 1;
      } catch {
        failed = true;
      }
    }
    setItemsUsedThisTurn((n) => n + usedCount);
    setTray([]);
    setUsingItems(false);
    if (uid) await resyncSave(uid);
    if (failed) setError("Some of those items wouldn't have done anything - skipped.");
    setShowItemMenu(false);
  }

  return (
    <div className={styles.overlay}>
      {activeTintColors.length > 0 && (
        <div className={styles.ailmentTintLayer}>
          {activeTintColors.map((color) => (
            <div key={color} className={styles.ailmentTint} style={{ background: color }} />
          ))}
        </div>
      )}
      <Panel className={styles.panel}>
        {canDismiss && <OverlayCloseButton onClick={onClose} />}
        <h2 className={styles.title}>PvP Duel</h2>

        <div className={isBlinded ? `${styles.battleCanvasWrap} ${styles.battleCanvasBlurred}` : styles.battleCanvasWrap}>
          <PhaserBattleCanvas
            backgroundAssetId={battle.battleBackgroundAssetId}
            enemies={opponentVisuals}
            outgoingHits={activeOutgoingHits}
            incomingHits={activeIncomingHits}
            playerMaxHp={me.maxHp}
            // PvP is strictly 1-on-1 (a single pvpHit per turn, never multiple simultaneous
            // attackers) so fastRounds' inter-enemy stagger has nothing to collapse here - unlike
            // Endless Battle, there's no toggle to expose for a setting with no visible effect.
            fastRounds={false}
            targetIndex={0}
            targetMode="single"
            canPickTarget={false}
            onTargetEnemy={() => {}}
            combatEnded={battle.status !== 'active'}
            ailmentFxEvent={ailmentFxEvent}
            ailmentTakesHoldEvent={ailmentTakesHoldEvent}
            enemyAilmentTakesHoldEvent={enemyAilmentTakesHoldEvent}
          />
          {battle.status === 'victory' && (
            <div className={styles.canvasMessage}>
              <p className={styles.canvasMessageTitle}>{iWon ? `You defeated ${opponentName}!` : `You were defeated by ${opponentName}.`}</p>
              {uid && battle.pvpRewards?.[uid] && (
                <p className={styles.canvasEarnings}>
                  +{battle.pvpRewards[uid].xp} XP{battle.pvpRewards[uid].gold > 0 && ` · +${battle.pvpRewards[uid].gold}g`}
                </p>
              )}
              <p className={styles.canvasMessageHint}>Both of you have been restored to full health.</p>
            </div>
          )}
        </div>

        <h3 className={styles.sectionTitle}>You</h3>
        <div className={styles.list}>
          <div className={styles.row} style={{ opacity: me.hp <= 0 ? 0.4 : 1 }}>
            <div className={styles.rowHeader}>
              <span className={styles.rowName}>You</span>
            </div>
            <div className={styles.barTrack}>
              <div className={styles.barFillHp} style={{ width: `${(me.hp / me.maxHp) * 100}%` }} />
              <span className={styles.barValue}>
                {me.hp}/{me.maxHp}
              </span>
            </div>
            <div className={styles.statBars}>
              <div className={styles.barTrackSmall}>
                <div className={styles.barFillSpirit} style={{ width: `${(me.spirit / me.maxSpirit) * 100}%` }} />
                <span className={styles.barValueSmall}>
                  {me.spirit}/{me.maxSpirit} SP
                </span>
              </div>
              <div className={styles.barTrackSmall}>
                <div
                  className={styles.barFillOil}
                  style={{ width: `${me.maxLanternOil > 0 ? (me.lanternOil / me.maxLanternOil) * 100 : 0}%` }}
                />
                <span className={styles.barValueSmall}>
                  {me.lanternOil}/{me.maxLanternOil} Oil
                </span>
              </div>
            </div>
            {battle.status === 'active' && me.ailments.length > 0 && (
              <div className={styles.ailmentBadgeRow}>
                {me.ailments.map((a) => {
                  const def = AILMENTS[a.ailmentId];
                  return (
                    <span key={a.ailmentId} className={styles.ailmentBadge} title={def?.description ?? a.ailmentId}>
                      {def?.iconAssetId && <img src={getAssetUrl(def.iconAssetId)} alt="" className={styles.ailmentIcon} />}
                      {def?.name ?? a.ailmentId}
                      {a.turnsRemaining !== undefined ? ` (${a.turnsRemaining})` : ''}
                    </span>
                  );
                })}
              </div>
            )}
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
              {isMyTurn
                ? isStunned
                  ? 'You are stunned and cannot act - your turn will resolve automatically.'
                  : playbackActive
                    ? 'Resolving...'
                    : `${secondsLeft}s to act`
                : `Waiting for ${opponentName} to act...`}
            </p>
            <div className={styles.actionRow}>
              {isMyTurn && !isStunned && !playbackActive && (
                <>
                  <button className={styles.smallButton} disabled={busy} onClick={() => submit({ type: 'attack' })}>
                    Attack
                  </button>
                  {knownSkills.length <= 1 ? (
                    <button
                      className={styles.smallButton}
                      disabled={busy || isSilenced || me.spirit < (knownSkills[0]?.spiritCost ?? 0)}
                      title={isSilenced ? 'Silenced - Specialty Attacks are blocked.' : undefined}
                      onClick={() => submitSkill(knownSkills[0]?.id ?? 'keepers-strike')}
                    >
                      {knownSkills[0]?.name ?? "Keeper's Strike"} ({knownSkills[0]?.spiritCost ?? 0} SP)
                    </button>
                  ) : (
                    <button
                      className={styles.smallButton}
                      disabled={busy || isSilenced}
                      title={isSilenced ? 'Silenced - Specialty Attacks are blocked.' : undefined}
                      onClick={() => setShowSkillMenu(true)}
                    >
                      Select Spirit Ability
                    </button>
                  )}
                  {lanternAbilities.map((ability) => (
                    <button
                      key={ability.id}
                      className={styles.smallButton}
                      disabled={busy || isLanternDisabled || me.lanternOil < ability.oilCost}
                      title={isLanternDisabled ? 'Frozen - the Lantern specialty is blocked.' : undefined}
                      onClick={() => submit({ type: 'lanternAbility', abilityId: ability.id })}
                    >
                      {ability.name} ({ability.oilCost} Oil)
                    </button>
                  ))}
                  <button className={styles.smallButton} disabled={busy} onClick={() => setShowItemMenu(true)}>
                    Items{tray.length > 0 ? ` (${tray.length}/3)` : ''}
                  </button>
                  <button className={styles.smallButton} disabled={busy} onClick={() => submit({ type: 'defend' })}>
                    Defend
                  </button>
                </>
              )}
              {/* Forfeiting works regardless of whose turn it is - see submitPartyBattleAction's
                  own doc comment on why flee bypasses the turn-order gate entirely. */}
              <button className={styles.dangerButton} disabled={busy} onClick={() => setConfirmForfeit(true)}>
                Forfeit
              </button>
            </div>
          </>
        )}

        {battle.status === 'victory' && (
          <button className={styles.smallButton} onClick={onClose}>
            Close
          </button>
        )}
      </Panel>

      {showSkillMenu && (
        <div className={styles.overlay} onClick={() => setShowSkillMenu(false)}>
          <Panel style={{ width: 'min(360px, 90vw)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <OverlayCloseButton onClick={() => setShowSkillMenu(false)} />
            <h3 className={styles.sectionTitle}>Select Spirit Ability</h3>
            <div className={styles.list}>
              {knownSkills.map((skill) => (
                <button
                  key={skill.id}
                  className={styles.smallButton}
                  disabled={me.spirit < skill.spiritCost}
                  onClick={() => submitSkill(skill.id)}
                >
                  {skill.name} ({skill.spiritCost} SP)
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {showItemMenu && (
        <div className={styles.overlay} onClick={() => !usingItems && setShowItemMenu(false)}>
          <Panel style={{ width: 'min(360px, 90vw)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <OverlayCloseButton onClick={() => setShowItemMenu(false)} />
            <h3 className={styles.sectionTitle}>Use Items</h3>
            {/* Queuing here doesn't submit anything by itself - "Done" below applies each queued
                item immediately (costs no turn), matching solo combat's own item menu exactly. */}
            <div className={styles.list}>
              {combatItems.length === 0 && <p className={styles.empty}>No usable items.</p>}
              {combatItems.map((i) => {
                const def = ITEMS.find((d) => d.id === i.itemId);
                const cureAilmentId = def?.effect?.cureAilmentId;
                const wouldHelp = itemWouldHaveEffect(def?.effect, { ...me, stamina: 0, maxStamina: 0 }, me.ailments.map((a) => a.ailmentId));
                const queued = queuedCountFor(i.itemId);
                const canAdd = wouldHelp && canQueueMore && queued < i.quantity;
                return (
                  <div
                    key={i.itemId}
                    className={cureAilmentId && wouldHelp ? `${styles.rowHeader} ${styles.itemRowCureReady}` : styles.rowHeader}
                  >
                    <span className={styles.rowName}>
                      {itemDisplayName(i.itemId)} x{i.quantity}
                      {queued > 0 ? ` (queued ${queued})` : ''}
                      {!wouldHelp && (cureAilmentId ? ' (not needed)' : ' (full)')}
                    </span>
                    <button
                      className={styles.smallButton}
                      disabled={usingItems || !canAdd}
                      title={wouldHelp ? undefined : cureAilmentId ? 'You do not have that ailment.' : 'Already at maximum.'}
                      onClick={() => queueItem(i.itemId)}
                    >
                      Add
                    </button>
                    <button className={styles.smallButton} disabled={usingItems || queued === 0} onClick={() => dequeueItem(i.itemId)}>
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <div className={styles.actionRow}>
              <button className={styles.smallButton} disabled={usingItems} onClick={() => void finishItemMenu()}>
                {usingItems ? 'Using items...' : 'Done'}
              </button>
            </div>
          </Panel>
        </div>
      )}

      {confirmForfeit && (
        <div className={styles.overlay} onClick={() => setConfirmForfeit(false)}>
          <Panel style={{ width: 'min(360px, 90vw)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <OverlayCloseButton onClick={() => setConfirmForfeit(false)} />
            <h3 className={styles.sectionTitle}>Forfeit the Duel?</h3>
            <p className={styles.empty}>{opponentName} will be credited with the win.</p>
            <div className={styles.actionRow}>
              <button
                className={styles.dangerButton}
                disabled={busy}
                onClick={() => {
                  setConfirmForfeit(false);
                  void submit({ type: 'flee' });
                }}
              >
                Forfeit
              </button>
              <button className={styles.smallButton} onClick={() => setConfirmForfeit(false)}>
                Cancel
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
