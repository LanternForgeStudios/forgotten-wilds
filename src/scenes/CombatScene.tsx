import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { OverlayCloseButton } from '@/components/common/OverlayCloseButton';
import { PlayerHUD } from '@/components/PlayerHUD';
import { PhaserBattleCanvas } from '@/components/combat/PhaserBattleCanvas';
import {
  callResolveCombatAction,
  callStartEncounter,
  callUseItem,
  type CombatHitResult,
  type EnemyHitResult,
  type EncounterEnemy,
  type ResolveCombatActionResponse,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useAuthStore } from '@/state/useAuthStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useToastStore } from '@/state/useToastStore';
import { useHudBarHeight } from '@/hooks/useExplorationViewport';
import { useSceneStore } from '@/state/useSceneStore';
import { AILMENTS, ENEMIES, EQUIPMENT, ITEMS, LANTERN_ABILITIES, LOCATIONS, SKILLS } from '@/data';
import type { ActiveAilment } from '@/types';
import { ENEMY_TIER_LABELS, ENEMY_TIER_COLORS } from '@/utils/enemyTier';
import { AILMENT_TINT_COLORS } from '@/utils/ailmentTint';
import { itemWouldHaveEffect } from '@/utils/itemEffect';
import { sceneForLocationKind } from '@/utils/sceneForLocationKind';
import { INCOMING_HIT_STAGGER_MS, PRE_ENEMY_ATTACK_DELAY_MS } from '@/phaser/battleEffects';
import { useCutsceneStore } from '@/state/useCutsceneStore';
import { battleStartCutscene, DEFEAT_CUTSCENE } from '@/data/cutscenes';
import { getAssetUrl } from '@/assets/assetManager';
import { playMusic, playSound } from '@/audio/audioService';
import styles from './CombatScene.module.css';

const RESTORE_STAT_LABEL: Record<'hp' | 'spirit' | 'lanternOil', string> = {
  hp: 'HP',
  spirit: 'Spirit',
  lanternOil: 'Lantern Oil',
};

type Phase = 'starting' | 'playerTurn' | 'resolving' | 'itemMenu' | 'usingItems' | 'victory' | 'defeat' | 'fled' | 'error';

export function CombatScene() {
  const params = useSceneStore((s) => s.params);
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);
  const inventory = useInventoryStore((s) => s.items);
  const hudBarHeight = useHudBarHeight();
  const player = usePlayerStore((s) => s.player);
  const patchStats = usePlayerStore((s) => s.patchStats);

  const [phase, setPhase] = useState<Phase>('starting');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [enemies, setEnemies] = useState<EncounterEnemy[]>([]);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [targetMode, setTargetMode] = useState<'single' | 'all'>('single');
  const [log, setLog] = useState<string[]>([]);
  const [playerAilments, setPlayerAilments] = useState<ActiveAilment[]>([]);
  // Drives PhaserBattleCanvas's FX-pack ailment bursts (poison/burn/freeze) - key increments every
  // resolved round (see act() below) so a still-active DoT ailment re-triggers its burst each
  // round even though playerAilments' own contents may be unchanged; key===0 is the pre-first-round
  // sentinel PhaserBattleCanvas skips.
  const [ailmentFxEvent, setAilmentFxEvent] = useState<{ ailmentIds: string[]; key: number }>({
    ailmentIds: [],
    key: 0,
  });
  // Same shape/key convention as ailmentFxEvent above, but only ever holds ailment ids that are
  // newly inflicted this round (see act() below's before/after diff) - drives
  // PhaserBattleCanvas's bigger multi-burst "this just took hold" moment instead of the quieter
  // per-round reapplication burst ailmentFxEvent triggers for an already-active ailment.
  const [ailmentTakesHoldEvent, setAilmentTakesHoldEvent] = useState<{ ailmentIds: string[]; key: number }>({
    ailmentIds: [],
    key: 0,
  });
  const [selectedAilmentId, setSelectedAilmentId] = useState<string | null>(null);
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  const [rewards, setRewards] = useState<ResolveCombatActionResponse['rewards']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Up to 3 item ids queued to ride along with whatever primary action the player takes next
  // (duplicates allowed - e.g. 2x the same potion). Cleared only after a round actually resolves.
  const [tray, setTray] = useState<string[]>([]);
  // Items already used this turn via a *previous* trip through the item menu - finishItemMenu
  // clears `tray` back to [] the instant it uses a batch, so tray.length alone can't cap "3 items
  // per turn": without this, reopening Items after clicking Done resets canQueueMore and lets the
  // player use another 3, repeatedly, all before ever taking their turn's real action. Reset only
  // when the player actually commits that action (see act()), not when the item menu closes.
  const [itemsUsedThisTurn, setItemsUsedThisTurn] = useState(0);
  // Per-enemy hit results from the most recent round, fed into PhaserBattleCanvas to drive its hit
  // effects; batched by id so a stale timeout can't clear a *newer* round's hits. Split into two
  // arrays (one per data direction) since the engine now reports outgoing (player -> enemy) and
  // incoming (enemy -> player) hits as separate, differently-shaped lists.
  const [activeOutgoingHits, setActiveOutgoingHits] = useState<(CombatHitResult & { key: number })[]>([]);
  const [activeIncomingHits, setActiveIncomingHits] = useState<(EnemyHitResult & { key: number })[]>([]);
  // True for the full duration of a round's staggered hit playback (see the timeout below, sized
  // to actually match that duration) - phase itself returns to 'playerTurn' the instant the
  // server responds, well before a multi-enemy round's staggered incoming-hit animations finish,
  // so without this the player could queue up another action mid-animation (reported as "attacking
  // out of turn" - the enemies' own attacks were still visually resolving).
  const [playbackActive, setPlaybackActive] = useState(false);
  // Per-encounter, defaults off - collapses the pause between multiple enemies' attacks (but not
  // PRE_ENEMY_ATTACK_DELAY_MS itself) so a player who'd rather not sit through a staggered 4-5
  // enemy round every time can speed through it. Resets to off on a fresh encounter (new
  // CombatScene mount), not persisted across fights.
  const [fastRounds, setFastRounds] = useState(false);
  const hitBatchRef = useRef(0);
  const encounterGuardRef = useRef<{ locationId: string; cancelled: boolean } | null>(null);
  // True once a defeat round's response has arrived but its (already-respawned-at-Ash-Hallow)
  // hp/spirit haven't been applied to the store yet - see the comment in act() below for why.
  const pendingDefeatResyncRef = useRef(false);
  // act() schedules several setTimeouts (staggered log-line reveals, the damage toast, clearing
  // hit-playback state) sized to a multi-enemy round's full ~1-2s animation - long enough that a
  // player can click "Continue" off the victory/defeat overlay and unmount this scene before they
  // fire. The two that only touch this component's own state degrade harmlessly (React ignores a
  // setState on an unmounted component), but the damage toast pushes to the global toast store,
  // which isn't scoped to this component - without this, it can visibly pop up on Town/Overworld
  // a second or two after the player has already left combat. Tracked here so every pending
  // timeout can be cancelled on unmount instead of letting only the toast one misbehave.
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const trackedTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimeoutsRef.current.delete(id);
      fn();
    }, ms);
    pendingTimeoutsRef.current.add(id);
  }, []);
  useEffect(() => {
    return () => {
      pendingTimeoutsRef.current.forEach((id) => clearTimeout(id));
      pendingTimeoutsRef.current.clear();
    };
  }, []);

  const locationId = params.locationId ?? 'ironwood-trail';
  const location = LOCATIONS.find((l) => l.id === locationId);

  // React StrictMode's dev-only mount->cleanup->mount double-invoke would otherwise fire
  // callStartEncounter twice, creating a second combatSessions/{uid} document server-side - and
  // since the client keeps whichever call's .then() wasn't marked cancelled, while the *server*
  // keeps whichever write landed last (an unrelated race), the two can end up disagreeing,
  // stranding the client with a sessionId the server has already superseded ("That combat
  // session is no longer active." - confirmed by hand, not theoretical). encounterGuardRef makes
  // this effect a no-op on the second same-locationId invocation instead of firing a duplicate
  // call, and un-cancels the first call's continuation (which the intervening cleanup marked
  // cancelled, same as it would for a real unmount) so its response is the one that actually
  // applies.
  useEffect(() => {
    const guard = encounterGuardRef.current;
    if (guard && guard.locationId === locationId) {
      guard.cancelled = false;
      return;
    }

    const entry = { locationId, cancelled: false };
    encounterGuardRef.current = entry;

    callStartEncounter(locationId, params.bossId)
      .then((res) => {
        if (entry.cancelled) return;
        setSessionId(res.sessionId);
        setEnemies(res.enemies);
        void playMusic(res.enemies.some((e) => e.isBoss) ? 'music.combat-boss' : 'music.combat');
        setTargetIndex(res.enemies[0]?.index ?? null);
        setPlayerAilments(res.playerAilments);
        patchStats({ hp: res.playerHp, maxHp: res.playerMaxHp, spirit: res.playerSpirit });
        const intro =
          res.enemies.length > 1
            ? `${res.enemies.length} foes block your path!`
            : `A ${res.enemies[0]?.name ?? 'foe'} blocks your path!`;
        setLog([intro]);
        // The battle arena (PhaserBattleCanvas) already starts loading behind the cutscene, since
        // enemies/session are set immediately above - only the actual playerTurn gate waits, so
        // there's no extra loading flicker once the cutscene dismisses.
        useCutsceneStore.getState().play({
          ...battleStartCutscene(res.enemies, location?.battleBackgroundAssetId ?? 'battle-bg.forest'),
          autoAdvanceMs: 5000,
          enemies: res.enemies.map((e) => ({ spriteAssetId: ENEMIES.find((d) => d.id === e.enemyId)?.battleSpriteAssetId ?? '' })),
          onComplete: () => setPhase('playerTurn'),
        });
      })
      .catch((err) => {
        if (entry.cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Could not start the encounter.');
        setPhase('error');
      });
    return () => {
      entry.cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const aliveEnemies = enemies.filter((e) => e.hp > 0);

  // If the currently-targeted enemy dies, fall back to whichever alive enemy comes next rather
  // than leaving the player stuck aimed at a corpse.
  useEffect(() => {
    if (targetIndex === null) return;
    const stillAlive = enemies.find((e) => e.index === targetIndex && e.hp > 0);
    if (!stillAlive && aliveEnemies.length > 0) setTargetIndex(aliveEnemies[0].index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemies]);

  async function act(
    type: 'attack' | 'skill' | 'lanternAbility' | 'defend' | 'flee' | 'item',
    options?: { abilityId?: string; skillId?: string },
  ) {
    if (!sessionId || phase === 'resolving' || playbackActive) return;
    setPhase('resolving');
    setItemsUsedThisTurn(0);
    try {
      const needsTarget = type === 'attack' || type === 'skill' || type === 'lanternAbility';
      const usedItems = tray.length > 0;
      const res = await callResolveCombatAction(sessionId, {
        type,
        abilityId: options?.abilityId,
        skillId: options?.skillId,
        itemIds: tray,
        targetIndex: needsTarget && targetMode === 'single' ? targetIndex ?? undefined : undefined,
        targetAll: needsTarget && targetMode === 'all',
      });
      // Each attacking enemy's own log line is revealed on its own stagger schedule below (in
      // step with BattleScene's staggered animation for that same attacker) instead of appearing
      // instantly here alongside the rest of the round's log - in a multi-enemy fight, seeing
      // every attacker's line dumped at once read as disconnected from watching them attack one
      // at a time. Everything else (the player's own action, damage-dealt-to-enemy, defeat/flee
      // lines) still appears immediately, unchanged.
      const enemyAttackLines = new Set(res.enemyHits.map((h) => h.logLine));
      setLog((prev) => [...prev, ...res.log.filter((line) => !enemyAttackLines.has(line))]);
      res.enemyHits.forEach((hit, i) => {
        const stagger = fastRounds ? 0 : i * INCOMING_HIT_STAGGER_MS;
        trackedTimeout(() => {
          setLog((prev) => [...prev, hit.logLine]);
        }, PRE_ENEMY_ATTACK_DELAY_MS + stagger);
      });
      setEnemies((prev) => prev.map((e) => {
        const updated = res.enemies.find((u) => u.index === e.index);
        return updated ? { ...e, hp: updated.hp } : e;
      }));
      // Diffed against `playerAilments` (the pre-this-round state, captured by closure before the
      // await above) rather than after setPlayerAilments below - an ailment already active last
      // round and still ticking should only get the quieter per-round burst (ailmentFxEvent), not
      // the big "just took hold" one every single round it continues.
      const newlyInflictedAilmentIds = res.playerAilments
        .filter((a) => !playerAilments.some((old) => old.ailmentId === a.ailmentId))
        .map((a) => a.ailmentId);
      setPlayerAilments(res.playerAilments);
      // On a defeat, the server's playerHp/playerSpirit here are already the post-respawn values
      // (Ash Hallow's soft-respawn restore, applied in the same transaction as the defeat itself -
      // see resolveCombatAction.ts) - patching them in immediately would show the HUD's HP/Spirit
      // bars already healed while the defeat overlay is still saying "you were overwhelmed,"
      // which reads as a contradiction. Leave the store showing whatever HP/Spirit the fight
      // itself last displayed, and only apply the real (respawned) numbers once the player
      // actually clicks Continue - see returnToExploration().
      if (res.phase === 'defeat') {
        pendingDefeatResyncRef.current = true;
        patchStats({ lanternOil: res.playerLanternOil });
      } else {
        patchStats({ hp: res.playerHp, spirit: res.playerSpirit, lanternOil: res.playerLanternOil });
      }
      setTray([]);

      // Matches BattleScene.playIncomingHits' own schedule (PRE_ENEMY_ATTACK_DELAY_MS before the
      // first attacker, then INCOMING_HIT_STAGGER_MS between each subsequent one unless Fast
      // Rounds collapses that gap to 0) - this is when the *last* enemy's attack actually starts.
      const lastAttackStartMs =
        res.enemyHits.length > 0
          ? PRE_ENEMY_ATTACK_DELAY_MS + (fastRounds ? 0 : (res.enemyHits.length - 1) * INCOMING_HIT_STAGGER_MS)
          : 0;

      if (res.damageTakenByPlayer > 0) {
        // Delayed until every enemy has attacked, rather than fired the instant the round
        // resolves - otherwise the "Took N damage" toast (a total across every attacker) showed
        // up before the player had even seen most of the hits it was summing.
        trackedTimeout(() => {
          useToastStore.getState().push(`Took ${res.damageTakenByPlayer} damage this round.`);
        }, lastAttackStartMs);
      }

      hitBatchRef.current += 1;
      const batch = hitBatchRef.current;
      if (res.hits.some((h) => !h.missed) || res.enemyHits.length > 0) void playSound('sfx.combat-hit');
      if (res.hits.some((h) => h.defeated)) void playSound('sfx.enemy-defeated');
      setActiveOutgoingHits(res.hits.map((h) => ({ ...h, key: batch * 1000 + h.targetIndex })));
      setActiveIncomingHits(res.enemyHits.map((h) => ({ ...h, key: batch * 1000 + h.attackerIndex })));
      setAilmentFxEvent({ ailmentIds: res.playerAilments.map((a) => a.ailmentId), key: batch });
      if (newlyInflictedAilmentIds.length > 0) {
        setAilmentTakesHoldEvent({ ailmentIds: newlyInflictedAilmentIds, key: batch });
      }
      // The last incoming hit doesn't even START playing until lastAttackStartMs, and then needs
      // its own ~1.4s (playFloatingText's tween duration) to actually finish - a fixed 1500ms here
      // would cut a 3+ enemy round's animation short and re-enable actions mid-playback.
      const playbackMs = lastAttackStartMs + 1500;
      setPlaybackActive(true);
      trackedTimeout(() => {
        setActiveOutgoingHits((prev) => prev.filter((h) => Math.floor(h.key / 1000) !== batch));
        setActiveIncomingHits((prev) => prev.filter((h) => Math.floor(h.key / 1000) !== batch));
        setPlaybackActive(false);
      }, playbackMs);

      // An item's inventory count only lives in Firestore, not in the combat response above, so
      // it must be resynced here too - otherwise the displayed quantity never decrements mid-fight
      // even though the server correctly consumed it, and using it again eventually fails once the
      // real (server-side) stock hits zero while the stale client count still shows some left.
      // Skipped on the round that ends in defeat - a full resync would pull in the same
      // already-respawned hp/spirit patchStats just avoided above (see returnToExploration()).
      if (usedItems && uid && res.phase !== 'defeat') {
        await resyncSave(uid);
      }

      if (res.phase === 'continue') {
        setPhase('playerTurn');
        return;
      }

      if (res.phase === 'victory') {
        setRewards(res.rewards);
        void playSound('sfx.victory');
        if (res.rewards?.leveledUp) void playSound('sfx.level-up');
      } else if (res.phase === 'defeat') {
        void playSound('sfx.defeat');
        void playMusic('music.defeat');
      }

      // Skipped if the usedItems resync above already ran this same round (only reachable here for
      // victory/fled, since 'continue' already returned) - that resync is a full save refetch, so
      // it already covers everything this one would; without this guard, a victory/fled round that
      // also used items paid for the same resync twice in a row.
      if (uid && res.phase !== 'defeat' && !usedItems) {
        await resyncSave(uid);
      }
      setPhase(res.phase);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong resolving that action.');
      setPhase('error');
    }
  }

  // Victory can award the same item multiple times (e.g. 3 separate Moth Dust drops) - shown as
  // "3 moth-dust" instead of "moth-dust, moth-dust, moth-dust". Preserves first-seen order rather
  // than sorting, so the reward text reads in the same order the drops actually resolved in.
  function summarizeRewardItems(itemIds: string[]): string {
    const counts = new Map<string, number>();
    for (const id of itemIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts.entries()].map(([id, count]) => (count > 1 ? `${count} ${id}` : id)).join(', ');
  }

  const queuedCountFor = (itemId: string) => tray.filter((id) => id === itemId).length;
  const canQueueMore = itemsUsedThisTurn + tray.length < 3;

  function queueItem(itemId: string) {
    if (!canQueueMore) return;
    setTray((prev) => [...prev, itemId]);
  }

  function dequeueItem(itemId: string) {
    setTray((prev) => {
      const i = prev.lastIndexOf(itemId);
      if (i === -1) return prev;
      return [...prev.slice(0, i), ...prev.slice(i + 1)];
    });
  }

  // "Done" on the item menu - queued items are used immediately (via the same out-of-combat
  // useItem Cloud Function the Inventory menu uses, not a combat round: it only ever touches
  // users/{uid}, never combatSessions/{uid}, so calling it mid-fight is safe and costs no turn).
  // This is what lets a Spirit Draught or Lantern Oil queued here actually unlock a Skill/Lantern
  // Ability button on the very next screen, instead of being stuck behind the same round's stale
  // pre-item stats.
  async function finishItemMenu() {
    if (tray.length === 0) {
      setPhase('playerTurn');
      return;
    }
    const queued = tray;
    setPhase('usingItems');
    let usedCount = 0;
    let failed = false;
    for (const itemId of queued) {
      try {
        const res = await callUseItem(itemId);
        setPlayerAilments(res.playerAilments);
        usedCount += 1;
      } catch {
        // A later item can still be valid even if an earlier one turned out to be a no-op (e.g.
        // it would have had no effect because an earlier item in the same batch already maxed
        // that stat) - keep going rather than aborting the whole batch. A failed call never
        // actually consumes the item server-side (useItem.ts throws before decrementing
        // inventory when the item would have no effect), so it shouldn't cost one of the
        // player's 3 real item-uses for the turn either.
        failed = true;
      }
    }
    setItemsUsedThisTurn((n) => n + usedCount);
    setTray([]);
    if (uid) await resyncSave(uid);
    if (failed) {
      useToastStore.getState().push("Some of those items wouldn't have done anything - skipped.");
    }
    setPhase('playerTurn');
  }

  async function returnToExploration() {
    const wasDefeat = phase === 'defeat';
    // The defeat round's real (already-respawned) hp/spirit were deliberately withheld from the
    // store back in act() so the HUD didn't show them healed while the defeat overlay was still
    // up - apply them now, right as the player actually leaves for Ash Hallow.
    if (pendingDefeatResyncRef.current && uid) {
      pendingDefeatResyncRef.current = false;
      await resyncSave(uid);
    }
    const targetLocationId = wasDefeat ? 'ash-hallow' : locationId;
    const targetLocation = LOCATIONS.find((l) => l.id === targetLocationId);
    const scene = targetLocation ? sceneForLocationKind(targetLocation.kind) : 'town';
    // Restore the exact tile the fight was triggered from, rather than dumping the player back at
    // the map's default spawn - but only within the same location; a defeat sends the player to
    // Ash Hallow instead, where the original coordinates from a different map don't apply.
    const preserveSpawn = targetLocationId === locationId;
    const goToExploration = () =>
      goTo(scene, {
        locationId: targetLocationId,
        spawnX: preserveSpawn ? params.spawnX : undefined,
        spawnY: preserveSpawn ? params.spawnY : undefined,
      });
    if (wasDefeat) {
      useCutsceneStore.getState().play({ ...DEFEAT_CUTSCENE, entryEffect: 'wake-up', onComplete: goToExploration });
    } else {
      goToExploration();
    }
  }

  const combatItems = inventory.filter((i) => ITEMS.find((def) => def.id === i.itemId)?.category === 'consumable');
  const canAct = phase === 'playerTurn' && !playbackActive;
  const canPickTarget = aliveEnemies.length > 1 && canAct;
  const combatEnded = phase === 'victory' || phase === 'defeat' || phase === 'fled' || phase === 'error';
  const isSilenced = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
  const isLanternDisabled = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.disablesLanternAbility);
  const isStunned = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.skipsTurn);
  const isBlinded = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.physicalAccuracyMultiplier);
  const activeTintColors = playerAilments.map((a) => AILMENT_TINT_COLORS[a.ailmentId]).filter((c): c is string => !!c);

  // Attack's identity follows whatever's in the weapon slot - "Fists" when nothing is equipped,
  // matching the same pattern lantern abilities use for the lantern slot.
  const weaponId = player?.equipment.weapon;
  const weaponName = weaponId ? EQUIPMENT.find((e) => e.id === weaponId)?.name ?? 'Attack' : 'Fists';

  // A fresh/pre-Phase-3 save might not have knownSkillIds hydrated yet (see the server's own
  // backfill in resolveCombatAction.ts) - default to the one Specialty Attack every player has
  // always had, same fallback value the server itself backfills to.
  const knownSkillIds = player?.knownSkillIds ?? ['keepers-strike'];
  const knownSkills = knownSkillIds
    .map((id) => SKILLS.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  // The equipped lantern determines which Lantern Ability button(s) show up - swap lanterns and
  // the options here change with it, same as any other equipment-driven capability.
  const lanternId = player?.equipment.lantern;
  const lanternDef = lanternId ? EQUIPMENT.find((e) => e.id === lanternId) : undefined;
  const lanternAbilities = (lanternDef?.lanternAbilityIds ?? [])
    .map((id) => LANTERN_ABILITIES.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);

  // Memoized so a re-render caused by unrelated state (menu selection, message text, etc.) doesn't
  // hand PhaserBattleCanvas a brand-new array reference every time - it re-runs its own enemy sync
  // effect whenever this reference changes, which is wasted work when the enemies themselves
  // haven't actually changed.
  const battleEnemies = useMemo(
    () =>
      enemies.map((e) => ({
        index: e.index,
        spriteAssetId: ENEMIES.find((d) => d.id === e.enemyId)?.battleSpriteAssetId ?? '',
        name: e.name,
        tierLabel: ENEMY_TIER_LABELS[e.tier],
        tierColor: ENEMY_TIER_COLORS[e.tier],
        tier: e.tier,
        level: e.level,
        hp: e.hp,
        maxHp: e.maxHp,
        isBoss: e.isBoss,
      })),
    [enemies],
  );

  return (
    <div className={styles.wrap} style={{ paddingTop: hudBarHeight }}>
      {activeTintColors.length > 0 && (
        <div className={styles.ailmentTintLayer}>
          {activeTintColors.map((color) => (
            // Keyed by the (stable, per-ailment-type) color itself rather than array index, so an
            // already-active ailment's tint div isn't unmounted/remounted (re-triggering its
            // mount-in fade animation) just because a different ailment was added or cleared
            // elsewhere in the list.
            <div key={color} className={styles.ailmentTint} style={{ background: color }} />
          ))}
        </div>
      )}
      <PlayerHUD />

      {playerAilments.length > 0 && (
        <div className={styles.ailmentStrip}>
          {playerAilments.map((a) => {
            const def = AILMENTS[a.ailmentId];
            return (
              <button
                key={a.ailmentId}
                type="button"
                className={styles.ailmentBadge}
                title={def?.description ?? a.ailmentId}
                onClick={() => setSelectedAilmentId((id) => (id === a.ailmentId ? null : a.ailmentId))}
              >
                {def?.iconAssetId && <img src={getAssetUrl(def.iconAssetId)} alt="" className={styles.ailmentIcon} />}
                {def?.name ?? a.ailmentId}
                {a.turnsRemaining !== undefined ? ` (${a.turnsRemaining})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {selectedAilmentId &&
        (() => {
          const def = AILMENTS[selectedAilmentId];
          // The cure item's own description already says "Cures X." (see items.ts) - just need to
          // find which item, if any, cures this ailment. Stun has none by design (it auto-expires
          // after 1 turn, see AILMENTS' own description text).
          const cureItem = ITEMS.find((i) => i.effect?.cureAilmentId === selectedAilmentId);
          return (
            <div className={styles.overlay} onClick={() => setSelectedAilmentId(null)}>
              <Panel
                style={{ width: 'min(360px, 90vw)' }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <OverlayCloseButton onClick={() => setSelectedAilmentId(null)} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  {def?.iconAssetId && <img src={getAssetUrl(def.iconAssetId)} alt="" className={styles.ailmentIcon} />}
                  <h3 style={{ margin: 0, color: 'var(--fw-accent)' }}>{def?.name ?? selectedAilmentId}</h3>
                </div>
                <p style={{ fontSize: 13, margin: '0 0 10px' }}>{def?.description ?? 'No further details known.'}</p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  <strong>Cure: </strong>
                  {cureItem ? cureItem.name : 'None - wears off on its own.'}
                </p>
              </Panel>
            </div>
          );
        })()}

      {showSkillMenu && (
        <div className={styles.overlay} onClick={() => setShowSkillMenu(false)}>
          <Panel style={{ width: 'min(360px, 90vw)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <OverlayCloseButton onClick={() => setShowSkillMenu(false)} />
            <h3 style={{ margin: '0 0 10px', color: 'var(--fw-accent)' }}>Select Spirit Ability</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {knownSkills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  className={styles.actionButton}
                  disabled={(player?.stats.spirit ?? 0) < skill.spiritCost}
                  onClick={() => {
                    setShowSkillMenu(false);
                    act('skill', { skillId: skill.id });
                  }}
                >
                  {skill.name} ({skill.spiritCost} SP)
                </button>
              ))}
            </div>
          </Panel>
        </div>
      )}

      <div className={isBlinded ? `${styles.stage} ${styles.stageBlurred}` : styles.stage}>
        <div className={styles.enemyArea}>
          <div className={styles.battleCanvasWrap}>
            <PhaserBattleCanvas
              backgroundAssetId={location?.battleBackgroundAssetId ?? ''}
              enemies={battleEnemies}
              outgoingHits={activeOutgoingHits}
              incomingHits={activeIncomingHits}
              playerMaxHp={player?.stats.maxHp ?? 1}
              fastRounds={fastRounds}
              targetIndex={targetIndex}
              targetMode={targetMode}
              canPickTarget={canPickTarget}
              onTargetEnemy={(index) => {
                setTargetMode('single');
                setTargetIndex(index);
              }}
              combatEnded={combatEnded}
              ailmentFxEvent={ailmentFxEvent}
              ailmentTakesHoldEvent={ailmentTakesHoldEvent}
            />
            {canPickTarget && (
              <p className={styles.targetHint}>
                {targetMode === 'all'
                  ? 'Attacking all foes at once - reduced damage each, chance to miss.'
                  : 'Tap an enemy to choose your target'}
              </p>
            )}
          </div>
        </div>

        <div className={styles.bottomPanel}>
        <Panel className={styles.logPanel}>
          <button
            type="button"
            className={styles.fastRoundsToggle}
            // Disabled for the same full window canAct already gates on (phase === 'resolving'
            // covers the network round-trip, playbackActive covers the staggered log-reveal/
            // toast/hit-playback timeouts that keep running for up to ~1-2s after phase has
            // already flipped back to 'playerTurn') - act()'s in-flight response handler captures
            // fastRounds by closure at call time to schedule those timeouts, while
            // PhaserBattleCanvas reads the live prop when its own effect fires after the response
            // lands, so toggling anywhere in that window would desync the log text from the
            // animation for that round.
            disabled={phase === 'resolving' || playbackActive}
            onClick={() => setFastRounds((f) => !f)}
            title="When multiple enemies attack in the same round, let their attacks land together instead of staggered one at a time."
          >
            Fast Rounds: {fastRounds ? 'On' : 'Off'}
          </button>
          {log.slice(-4).map((line, i) => (
            <p key={i} style={{ margin: 0 }}>
              {line}
            </p>
          ))}
        </Panel>

        <Panel className={styles.actionsPanel}>
          {phase === 'itemMenu' || phase === 'usingItems' ? (
            <>
              {combatItems.length === 0 && <p style={{ fontSize: 12, gridColumn: '1 / -1' }}>No usable items.</p>}
              {combatItems.map((i) => {
                const def = ITEMS.find((d) => d.id === i.itemId);
                const cureAilmentId = def?.effect?.cureAilmentId;
                const wouldHelp = player
                  ? itemWouldHaveEffect(
                      def?.effect,
                      player.stats,
                      playerAilments.map((a) => a.ailmentId),
                    )
                  : false;
                // A cure item with no matching active ailment isn't "Full" (that wording implies a
                // capped stat bar) - it's simply not needed right now. Conversely, when it DOES
                // match an active ailment, highlight the row so the right cure stands out among
                // the tray instead of making the player read every item's name to find it.
                const queued = queuedCountFor(i.itemId);
                const canAdd = wouldHelp && canQueueMore && queued < i.quantity;
                return (
                  <div
                    key={i.itemId}
                    className={cureAilmentId && wouldHelp ? `${styles.itemRow} ${styles.itemRowCureReady}` : styles.itemRow}
                  >
                    <span>
                      {i.itemId.replace(/-/g, ' ')} x{i.quantity}
                      {queued > 0 && ` — queued: ${queued}`}
                      {!wouldHelp && (cureAilmentId ? ' (Not needed)' : ' (Full)')}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className={styles.actionButton}
                        disabled={phase === 'usingItems' || queued === 0}
                        onClick={() => dequeueItem(i.itemId)}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className={styles.actionButton}
                        disabled={phase === 'usingItems' || !canAdd}
                        title={
                          wouldHelp
                            ? undefined
                            : cureAilmentId
                              ? 'Not needed right now - you do not have that ailment.'
                              : 'Already at maximum - using this would have no effect.'
                        }
                        onClick={() => queueItem(i.itemId)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              <button className={styles.actionButton} disabled={phase === 'usingItems'} onClick={finishItemMenu}>
                {phase === 'usingItems' ? 'Using items...' : 'Done'}
              </button>
            </>
          ) : (
            <>
              {isStunned && canAct && (
                <p className={styles.stunnedBanner}>You are stunned and cannot act this turn!</p>
              )}
              {aliveEnemies.length > 1 && canAct && (
                <button
                  className={styles.actionButton}
                  style={{ gridColumn: '1 / -1' }}
                  onClick={() => setTargetMode((m) => (m === 'all' ? 'single' : 'all'))}
                >
                  Target: {targetMode === 'all' ? 'All Foes' : 'Single'}
                </button>
              )}
              <button className={styles.actionButton} disabled={!canAct} onClick={() => act('attack')}>
                {weaponName}
              </button>
              {knownSkills.length <= 1 ? (
                <button
                  className={styles.actionButton}
                  disabled={!canAct || (player?.stats.spirit ?? 0) < (knownSkills[0]?.spiritCost ?? 0) || isSilenced}
                  title={isSilenced ? 'Silenced - Specialty Attacks are blocked.' : undefined}
                  onClick={() => act('skill', { skillId: knownSkills[0]?.id })}
                >
                  {knownSkills[0]?.name ?? "Keeper's Strike"} ({knownSkills[0]?.spiritCost ?? 0} SP)
                </button>
              ) : (
                <button
                  className={styles.actionButton}
                  disabled={!canAct || isSilenced}
                  title={isSilenced ? 'Silenced - Specialty Attacks are blocked.' : undefined}
                  onClick={() => setShowSkillMenu(true)}
                >
                  Select Spirit Ability
                </button>
              )}
              {lanternAbilities.map((ability) => (
                <button
                  key={ability.id}
                  className={styles.actionButton}
                  disabled={!canAct || (player?.stats.lanternOil ?? 0) < ability.oilCost || isLanternDisabled}
                  title={isLanternDisabled ? 'Frozen - the Lantern specialty is disabled.' : undefined}
                  onClick={() => act('lanternAbility', { abilityId: ability.id })}
                >
                  {ability.name} ({ability.oilCost} Oil)
                </button>
              ))}
              <button
                className={styles.actionButton}
                disabled={!canAct}
                onClick={() => setPhase('itemMenu')}
              >
                Items{tray.length > 0 ? ` (${tray.length}/3)` : ''}
              </button>
              <button className={styles.actionButton} disabled={!canAct} onClick={() => act('defend')}>
                Defend
              </button>
              <button className={styles.actionButton} disabled={!canAct} onClick={() => act('flee')}>
                Flee
              </button>
            </>
          )}
        </Panel>
        </div>
      </div>

      {(phase === 'victory' || phase === 'defeat' || phase === 'fled') && (
        <div className={styles.overlay}>
          <Panel style={{ width: 'min(420px, 90vw)', textAlign: 'center' }}>
            {phase === 'victory' && (
              <>
                <h2 style={{ color: 'var(--fw-accent)' }}>Victory!</h2>
                <p>
                  +{rewards?.xp ?? 0} XP · +{rewards?.gold ?? 0} gold
                  {rewards?.itemIds.length ? ` · found: ${summarizeRewardItems(rewards.itemIds)}` : ''}
                </p>
                {rewards?.leveledUp && <p style={{ color: 'var(--fw-accent)' }}>Level up!</p>}
                {rewards?.restore && (
                  <p>
                    A quiet moment restores {rewards.restore.amount} {RESTORE_STAT_LABEL[rewards.restore.stat]}.
                  </p>
                )}
              </>
            )}
            {phase === 'defeat' && (
              <>
                <h2 style={{ color: 'var(--fw-danger)' }}>You were overwhelmed...</h2>
                <p>You wake back in Ash Hallow, shaken but alive.</p>
              </>
            )}
            {phase === 'fled' && <h2>You escaped.</h2>}
            <button className={styles.actionButton} onClick={returnToExploration} style={{ marginTop: 12 }}>
              Continue
            </button>
          </Panel>
        </div>
      )}

      {phase === 'error' && (
        <div className={styles.overlay}>
          <Panel style={{ width: 'min(420px, 90vw)', textAlign: 'center' }}>
            <p>{errorMessage}</p>
            <button className={styles.actionButton} onClick={returnToExploration} style={{ marginTop: 12 }}>
              Return
            </button>
          </Panel>
        </div>
      )}
    </div>
  );
}
