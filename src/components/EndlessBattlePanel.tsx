import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { PhaserBattleCanvas } from './combat/PhaserBattleCanvas';
import { useAuthStore } from '@/state/useAuthStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useNow } from '@/hooks/useNow';
import { useCombatMusic } from '@/hooks/useCombatMusic';
import { useAilmentFxEvents } from '@/hooks/useAilmentFxEvents';
import { usePartyBattlePoll } from '@/hooks/usePartyBattlePoll';
import { usePartyBattleAction } from '@/hooks/usePartyBattleAction';
import { subscribeToPartyBattle } from '@/firebase/partyBattleService';
import { resolveDisplayNames } from '@/firebase/socialService';
import { callSubmitPartyBattleAction, callUseItemInPartyBattle, callVoteContinueEndlessBattle } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { playMusic, playSound } from '@/audio/audioService';
import { getAssetUrl } from '@/assets/assetManager';
import { AILMENTS, ENEMIES, EQUIPMENT, ITEMS, LANTERN_ABILITIES, SKILLS } from '@/data';
import { ENEMY_TIER_LABELS, ENEMY_TIER_COLORS } from '@/utils/enemyTier';
import { AILMENT_TINT_COLORS } from '@/utils/ailmentTint';
import { itemDisplayName } from '@/utils/itemName';
import { itemWouldHaveEffect } from '@/utils/itemEffect';
import type { PartyBattleSession, PartyCombatHitResult, PartyEnemyHitResult } from '@/types';
import styles from './EndlessBattlePanel.module.css';

interface EndlessBattlePanelProps {
  battleId: string;
  onClose: () => void;
}

/** Endless Battle's real-sprite/full-action-menu presentation, matching solo quest combat's own
 *  (`CombatScene.tsx`) as closely as this mode's shared-turn-order structure allows - reuses
 *  `PhaserBattleCanvas`/`BattleScene.ts` as-is (no fork) for the enemy formation and hit
 *  animations, and the same Attack/Skill/Lantern Ability/Item/Defend action set, including ailment
 *  FX bursts and sound/music. Party HP/turn status for 2-6 players stays plain React/CSS below the
 *  canvas (BattleScene draws no non-enemy UI) rather than solo's single-player HUD. This panel is
 *  an overlay on top of whichever exploration scene is mounted (not a scene transition like solo
 *  combat), so it owns snapshotting/restoring the prior music track itself rather than relying on
 *  a scene remount to do it - see the music effects below. */
export function EndlessBattlePanel({ battleId, onClose }: EndlessBattlePanelProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const inventory = useInventoryStore((s) => s.items);
  const [battle, setBattle] = useState<PartyBattleSession | null>(null);
  const [selectedTarget, setSelectedTarget] = useState(0);
  const [targetMode, setTargetMode] = useState<'single' | 'all'>('single');
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const [showItemMenu, setShowItemMenu] = useState(false);
  // Up to 3 item ids queued in the item menu, applied IMMEDIATELY (via callUseItemInPartyBattle)
  // when the menu is closed - matches solo combat's own tray/finishItemMenu exactly (CombatScene.tsx):
  // items never consume a turn, so using a Spirit Draught unlocks a Skill button on the very next
  // screen instead of waiting for the primary action they'd otherwise ride along with.
  const [tray, setTray] = useState<string[]>([]);
  const [usingItems, setUsingItems] = useState(false);
  // Items already applied this turn via a *previous* trip through the item menu - finishItemMenu
  // clears `tray` back to [] the instant it uses a batch, so tray.length alone can't cap "3 items
  // per turn": without this, reopening Items after clicking Done resets canQueueMore and lets the
  // player use another 3, repeatedly, all before ever taking their turn's real action. Reset only
  // when the player actually commits their turn's real action (see submit()).
  const [itemsUsedThisTurn, setItemsUsedThisTurn] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Per-viewer, client-only preference (never sent to the server or synced to other
  // participants) - collapses the stagger between multiple enemies' attacks in *this player's own*
  // canvas so a round plays out all at once instead of one attacker at a time. Matches solo
  // combat's own fastRounds (CombatScene.tsx) exactly: purely a local animation-pacing choice, so
  // one player toggling it has zero effect on what anyone else in the same battle sees.
  const [fastRounds, setFastRounds] = useState(false);
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

  // See usePartyBattlePoll's own doc comment for what this covers and why.
  usePartyBattlePoll(battle, battleId);
  // See usePartyBattleAction's own doc comment for what this covers and why.
  const { busy, error, setError, run } = usePartyBattleAction(battle);

  // Rewards/restores land on real saves server-side - resync whenever the battle transitions to
  // a state that implies a real-save write just happened (wave cleared, run ended). Same
  // transition check also drives the wave-cleared/party-defeated sound cues (mirrors
  // CombatScene.tsx's own sfx.victory/sfx.defeat + music.defeat on those same two outcomes).
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!battle || !uid) return;
    const justChanged = prevStatusRef.current !== battle.status;
    if (justChanged && ['awaitingContinueVote', 'defeated', 'withdrawn'].includes(battle.status)) {
      void resyncSave(uid);
    }
    if (justChanged && battle.status === 'awaitingContinueVote') void playSound('sfx.victory');
    if (justChanged && battle.status === 'defeated') {
      void playSound('sfx.defeat');
      void playMusic('music.defeat');
    }
    prevStatusRef.current = battle.status;
  }, [battle, uid]);

  // See useCombatMusic's own doc comment for why this panel must snapshot/restore music itself.
  useCombatMusic(
    !!battle,
    battle?.enemies.some((e) => ENEMIES.find((d) => d.id === e.enemyId)?.isBoss) ? 'music.combat-boss' : 'music.combat',
  );

  // Structured per-turn hit data (Phase F1) drives the canvas's hit/defeat animations - a shared
  // spectacle everyone watching sees the same way, regardless of whose turn it was or who an
  // enemy's counter-attack actually targeted (party HP itself is the plain list below, not
  // per-player sprites in the canvas). Cleared after a fixed playback window so a later turn with
  // no hits (e.g. a pure Defend) doesn't leave a stale animation queued.
  const [activeOutgoingHits, setActiveOutgoingHits] = useState<(PartyCombatHitResult & { key: number })[]>([]);
  const [activeIncomingHits, setActiveIncomingHits] = useState<(PartyEnemyHitResult & { key: number })[]>([]);
  // True for the full duration of a round's hit playback (matches CombatScene.tsx's own
  // playbackActive) - gates the action buttons below so a fast-cycling battle (e.g. a solo Endless
  // Battle run, where the same player's turn can come right back around the instant the enemy
  // phase resolves in the same transaction) can't let the player attack again before they've even
  // seen the previous round's hits/enemy counter-attacks finish playing. Set unconditionally on
  // every new resolvedAt (even a hitless Defend round), same as solo's own fixed minimum pause.
  const [playbackActive, setPlaybackActive] = useState(false);
  useEffect(() => {
    const resolvedAt = battle?.lastTurnResult?.resolvedAt;
    if (!battle?.lastTurnResult || !resolvedAt) return;
    const hits = battle.lastTurnResult.hits ?? [];
    const enemyHits = battle.lastTurnResult.enemyHits ?? [];
    // Mirrors CombatScene.tsx's own sfx.combat-hit/sfx.enemy-defeated triggers exactly.
    if (hits.some((h) => !h.missed) || enemyHits.length > 0) void playSound('sfx.combat-hit');
    if (hits.some((h) => h.defeated)) void playSound('sfx.enemy-defeated');
    setActiveOutgoingHits(hits.map((h) => ({ ...h, key: resolvedAt })));
    setActiveIncomingHits(enemyHits.map((h) => ({ ...h, key: resolvedAt })));
    setPlaybackActive(true);
    const id = setTimeout(() => {
      setActiveOutgoingHits([]);
      setActiveIncomingHits([]);
      setPlaybackActive(false);
    }, 1400);
    return () => clearTimeout(id);
  }, [battle?.lastTurnResult?.resolvedAt]);

  // Drives PhaserBattleCanvas's FX-pack ailment bursts (poison/burn/freeze) for the *viewer's own*
  // ailments - see useAilmentFxEvents's own doc comment. This was hardcoded to
  // {ailmentIds:[], key:0} through Stage F3 - a real but explicitly scoped-out gap per the
  // Multiplayer Battle System plan, now wired up to match solo combat.
  const { ailmentFxEvent, ailmentTakesHoldEvent } = useAilmentFxEvents(
    uid ? (battle?.participantStats[uid]?.ailments ?? []).map((a) => a.ailmentId) : [],
    battle?.lastTurnResult?.resolvedAt,
  );

  // Enemy-side equivalent of the above - see PhaserBattleCanvas's enemyAilmentTakesHoldEvent doc
  // comment. Tracked per-enemy-index (a Map, not a single Set) since each enemy's ailments are
  // independent - same before/after-per-index diff CombatScene.tsx does against its own closure
  // state, just via a ref here since this panel gets updates through onSnapshot, not a call
  // response.
  const prevEnemyAilmentIdsRef = useRef<Map<number, Set<string>>>(new Map());
  const [enemyAilmentTakesHoldEvent, setEnemyAilmentTakesHoldEvent] = useState<{
    entries: { enemyIndex: number; ailmentIds: string[] }[];
    key: number;
  }>({ entries: [], key: 0 });
  useEffect(() => {
    const resolvedAt = battle?.lastTurnResult?.resolvedAt;
    if (!battle || !resolvedAt) return;
    const entries = battle.enemies
      .map((e, i) => {
        const currentIds = (e.ailments ?? []).map((a) => a.ailmentId);
        const prevIds = prevEnemyAilmentIdsRef.current.get(i) ?? new Set<string>();
        prevEnemyAilmentIdsRef.current.set(i, new Set(currentIds));
        return { enemyIndex: i, ailmentIds: currentIds.filter((id) => !prevIds.has(id)) };
      })
      .filter((e) => e.ailmentIds.length > 0);
    if (entries.length > 0) setEnemyAilmentTakesHoldEvent({ entries, key: resolvedAt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.lastTurnResult?.resolvedAt]);

  // Memoized so a re-render caused by unrelated state (menu toggles, error text, etc.) doesn't
  // hand PhaserBattleCanvas a brand-new array reference every time - see CombatScene.tsx's own
  // identical reasoning for battleEnemies.
  const battleEnemies = useMemo(
    () =>
      (battle?.enemies ?? []).map((e, i) => {
        const def = ENEMIES.find((d) => d.id === e.enemyId);
        return {
          index: i,
          spriteAssetId: def?.battleSpriteAssetId ?? '',
          name: def?.name ?? e.enemyId,
          tierLabel: def ? ENEMY_TIER_LABELS[def.tier] : '',
          tierColor: def ? ENEMY_TIER_COLORS[def.tier] : '#a8a8a0',
          tier: def?.tier ?? ('regular' as const),
          level: e.level,
          hp: e.hp,
          maxHp: e.maxHp,
          isBoss: def?.isBoss ?? false,
          ailmentIds: (e.ailments ?? []).map((a) => a.ailmentId),
        };
      }),
    [battle?.enemies],
  );

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
  const canAct = battle.status === 'active' && isMyTurn && me && me.hp > 0 && !playbackActive;
  // A stunned active player's turn always resolves as a no-op (server auto-forces it through on
  // the next poll rather than waiting out the deadline - see submitPartyBattleAction's own
  // comment) - shown so the countdown doesn't read as "pick an action" when nothing they click
  // would matter.
  const isStunned = (me?.ailments ?? []).some((a) => AILMENTS[a.ailmentId]?.effect.skipsTurn);
  // Mirrors solo combat's own isSilenced/isLanternDisabled (CombatScene.tsx) - disables just the
  // affected button rather than the whole action row, matching the server's own per-action
  // validatePartyBattleAction checks (which reject a silenced 'skill'/disabled 'lanternAbility'
  // submission outright) so the button doesn't invite a click the server would just reject.
  const isSilenced = (me?.ailments ?? []).some((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
  const isLanternDisabled = (me?.ailments ?? []).some((a) => AILMENTS[a.ailmentId]?.effect.disablesLanternAbility);
  // Same "reduced visibility" blur-the-stage / color-wash-the-screen treatment as solo combat's
  // own isBlinded/activeTintColors (CombatScene.tsx) - see AILMENT_TINT_COLORS' own doc comment
  // for why Blind gets a blur instead of a tint color. Gated on the battle still being active -
  // participantStats.ailments isn't cleared by the end-of-battle restore (that only ever touches
  // the real save's hp/spirit/oil), so without this a leftover ailment from the moment of defeat/
  // withdrawal would keep tinting/blurring the outcome screen after the fight is already over.
  const myAilments = battle.status === 'active' ? (me?.ailments ?? []) : [];
  const isBlinded = myAilments.some((a) => AILMENTS[a.ailmentId]?.effect.physicalAccuracyMultiplier);
  const activeTintColors = myAilments.map((a) => AILMENT_TINT_COLORS[a.ailmentId]).filter((c): c is string => !!c);

  const knownSkillIds = me?.knownSkillIds ?? ['keepers-strike'];
  const knownSkills = knownSkillIds.map((id) => SKILLS.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const lanternDef = me?.lanternId ? EQUIPMENT.find((e) => e.id === me.lanternId) : undefined;
  const lanternAbilities = (lanternDef?.lanternAbilityIds ?? [])
    .map((id) => LANTERN_ABILITIES.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  const combatItems = inventory.filter((i) => ITEMS.find((def) => def.id === i.itemId)?.category === 'consumable');

  async function submit(action: Parameters<typeof callSubmitPartyBattleAction>[1]) {
    setItemsUsedThisTurn(0);
    await run(() => callSubmitPartyBattleAction(battleId, action), 'Could not submit that action.');
  }

  function submitAttack() {
    void submit({ type: 'attack', targetIndex: selectedTarget, targetAll: targetMode === 'all' });
  }
  function submitSkill(skillId: string) {
    setShowSkillMenu(false);
    void submit({ type: 'skill', skillId, targetIndex: selectedTarget, targetAll: targetMode === 'all' });
  }
  function submitLanternAbility(abilityId: string) {
    void submit({ type: 'lanternAbility', abilityId, targetIndex: selectedTarget, targetAll: targetMode === 'all' });
  }
  function submitDefend() {
    void submit({ type: 'defend' });
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

  // "Done" on the item menu - queued items are used immediately (via callUseItemInPartyBattle,
  // which only ever touches the real save + this battle's own participantStats snapshot, never
  // turnOrder/currentTurnIndex/deadline - so it costs no turn). Mirrors CombatScene.tsx's own
  // finishItemMenu almost verbatim.
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
        // A later item can still be valid even if an earlier one in this batch turned out to be a
        // no-op (e.g. it would have had no effect because an earlier item already maxed that
        // stat) - keep going rather than aborting the whole batch. A failed call never actually
        // consumes the item server-side, so it shouldn't cost one of the player's 3 real uses.
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

  async function vote(wantsToContinue: boolean) {
    await run(() => callVoteContinueEndlessBattle(battleId, wantsToContinue), 'Could not cast that vote.');
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
        <h2 className={styles.title}>Endless Battle - Wave {battle.wave}</h2>

        <div className={isBlinded ? `${styles.battleCanvasWrap} ${styles.battleCanvasBlurred}` : styles.battleCanvasWrap}>
          {/* key={battle.wave} forces a fresh PhaserBattleCanvas/BattleScene mount every wave -
              loadEncounter only ever runs once per BattleScene instance's life (see that
              component's own doc comment), and this panel's canvas otherwise survives the whole
              run across every wave. Without this, wave 2+'s genuinely different enemy roster (more
              enemies, different sprites) never gets a real loadEncounter call, only syncEnemies
              (hp-only updates against wave 1's now-stale sprite slots) - confirmed by hand as the
              cause of a black arena from wave 2 onward. */}
          <PhaserBattleCanvas
            key={battle.wave}
            backgroundAssetId={battle.battleBackgroundAssetId}
            enemies={battleEnemies}
            outgoingHits={activeOutgoingHits}
            incomingHits={activeIncomingHits}
            playerMaxHp={me?.maxHp ?? 1}
            fastRounds={fastRounds}
            targetIndex={selectedTarget}
            targetMode={targetMode}
            canPickTarget={canAct && aliveEnemies.length > 1}
            onTargetEnemy={(index) => {
              setTargetMode('single');
              setSelectedTarget(index);
            }}
            combatEnded={battle.status !== 'active'}
            ailmentFxEvent={ailmentFxEvent}
            ailmentTakesHoldEvent={ailmentTakesHoldEvent}
            enemyAilmentTakesHoldEvent={enemyAilmentTakesHoldEvent}
          />
          {/* The canvas itself goes blank once combatEnded (BattleScene.clear()) - without this,
              that read as a bare black rectangle instead of a moment worth celebrating. Earnings
              get their own bigger, colored line so they jump out rather than blending into the
              same-size countdown text below. */}
          {battle.status === 'awaitingContinueVote' && (
            <div className={styles.canvasMessage}>
              <p className={styles.canvasMessageTitle}>Wave {battle.wave} cleared!</p>
              {battle.lastWaveRewards?.[uid] && (
                <p className={styles.canvasEarnings}>
                  +{battle.lastWaveRewards[uid].xp} XP &nbsp;·&nbsp; +{battle.lastWaveRewards[uid].gold}g
                  {battle.lastWaveRewards[uid].itemIds.length > 0 &&
                    ` · ${battle.lastWaveRewards[uid].itemIds.map(itemDisplayName).join(', ')}`}
                </p>
              )}
              <p className={styles.canvasMessageHint}>Act below to continue to the next wave, or withdraw.</p>
            </div>
          )}
          {(battle.status === 'defeated' || battle.status === 'withdrawn') && (
            <div className={styles.canvasMessage}>
              <p className={styles.canvasMessageTitle}>
                {battle.status === 'defeated' ? 'The party was defeated.' : 'The party withdrew.'}
              </p>
              <p className={styles.canvasMessageHint}>Reached Wave {battle.wave}. Everyone has been restored to full health.</p>
            </div>
          )}
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
                <div className={styles.rowHeader}>
                  <span className={styles.rowName}>{displayName}</span>
                  {isActive && (
                    <span className={isTheirTurn ? styles.playerActing : styles.playerReady}>
                      {isTheirTurn ? "Acting..." : 'Waiting'}
                    </span>
                  )}
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFillHp} style={{ width: `${(stats.hp / stats.maxHp) * 100}%` }} />
                  <span className={styles.barValue}>
                    {stats.hp}/{stats.maxHp}
                  </span>
                </div>
                <div className={styles.statBars}>
                  <div className={styles.barTrackSmall}>
                    <div className={styles.barFillSpirit} style={{ width: `${(stats.spirit / stats.maxSpirit) * 100}%` }} />
                    <span className={styles.barValueSmall}>
                      {stats.spirit}/{stats.maxSpirit} SP
                    </span>
                  </div>
                  <div className={styles.barTrackSmall}>
                    <div
                      className={styles.barFillOil}
                      style={{ width: `${stats.maxLanternOil > 0 ? (stats.lanternOil / stats.maxLanternOil) * 100 : 0}%` }}
                    />
                    <span className={styles.barValueSmall}>
                      {stats.lanternOil}/{stats.maxLanternOil} Oil
                    </span>
                  </div>
                </div>
                {battle.status === 'active' && stats.ailments.length > 0 && (
                  <div className={styles.ailmentBadgeRow}>
                    {stats.ailments.map((a) => {
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

        {battle.status === 'active' && (
          <button
            type="button"
            className={styles.smallButton}
            disabled={playbackActive}
            onClick={() => setFastRounds((f) => !f)}
            title="When multiple enemies attack in the same round, let their attacks land together instead of staggered one at a time. Only affects your own view - not synced to other players."
          >
            Fast Rounds: {fastRounds ? 'On' : 'Off'}
          </button>
        )}

        {battle.status === 'active' && me && me.hp > 0 && (
          <>
            <p className={styles.countdown}>
              {isMyTurn
                ? isStunned
                  ? 'You are stunned and cannot act - your turn will resolve automatically.'
                  : busy || playbackActive
                    ? 'Resolving...'
                    : `${secondsLeft}s to act`
                : `Waiting for ${names[activeUid] ?? '...'} to act...`}
            </p>
            <div className={styles.actionRow}>
              {isMyTurn && !isStunned && !playbackActive && (
                <>
                  {aliveEnemies.length > 1 && (
                    <button
                      className={styles.smallButton}
                      disabled={busy}
                      onClick={() => setTargetMode((m) => (m === 'all' ? 'single' : 'all'))}
                    >
                      Target: {targetMode === 'all' ? 'All Foes' : 'Single'}
                    </button>
                  )}
                  <button className={styles.smallButton} disabled={busy || aliveEnemies.length === 0} onClick={submitAttack}>
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
                      onClick={() => submitLanternAbility(ability.id)}
                    >
                      {ability.name} ({ability.oilCost} Oil)
                    </button>
                  ))}
                  <button className={styles.smallButton} disabled={busy} onClick={() => setShowItemMenu(true)}>
                    Items{tray.length > 0 ? ` (${tray.length}/3)` : ''}
                  </button>
                  <button className={styles.smallButton} disabled={busy} onClick={submitDefend}>
                    Defend
                  </button>
                </>
              )}
              {/* Leaving works regardless of whose turn it is - see submitPartyBattleAction's own
                  doc comment on why flee bypasses the turn-order gate entirely. A waiting player
                  stuck on an unresponsive partner needs a way out too, not just the active one. */}
              <button className={styles.dangerButton} disabled={busy} onClick={() => setConfirmLeave(true)}>
                Leave Battle
              </button>
            </div>
          </>
        )}

        {battle.status === 'active' && me && me.hp <= 0 && (
          <>
            <p className={styles.empty}>You are down - waiting for the party.</p>
            <button className={styles.dangerButton} disabled={busy} onClick={() => setConfirmLeave(true)}>
              Leave Battle
            </button>
          </>
        )}

        {battle.status === 'awaitingContinueVote' && (
          <>
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
                item immediately (costs no turn), matching solo combat's own item menu exactly. Only
                items that would currently do something are offered, and a ready ailment cure is
                highlighted, same as CombatScene.tsx's wouldHelp/itemRowCureReady. */}
            <div className={styles.list}>
              {combatItems.length === 0 && <p className={styles.empty}>No usable items.</p>}
              {combatItems.map((i) => {
                const def = ITEMS.find((d) => d.id === i.itemId);
                const cureAilmentId = def?.effect?.cureAilmentId;
                const wouldHelp = me
                  ? itemWouldHaveEffect(def?.effect, { ...me, stamina: 0, maxStamina: 0 }, me.ailments.map((a) => a.ailmentId))
                  : false;
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

      {confirmLeave && (
        <div className={styles.overlay} onClick={() => setConfirmLeave(false)}>
          <Panel style={{ width: 'min(360px, 90vw)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <OverlayCloseButton onClick={() => setConfirmLeave(false)} />
            <h3 className={styles.sectionTitle}>Leave Battle?</h3>
            <p className={styles.empty}>You'll forfeit this run and lose any rewards from waves not yet claimed.</p>
            <div className={styles.actionRow}>
              <button
                className={styles.dangerButton}
                disabled={busy}
                onClick={() => {
                  setConfirmLeave(false);
                  void submit({ type: 'flee' });
                }}
              >
                Leave Battle
              </button>
              <button className={styles.smallButton} onClick={() => setConfirmLeave(false)}>
                Cancel
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
