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
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { useSceneStore } from '@/state/useSceneStore';
import { AILMENTS, ENEMIES, EQUIPMENT, ITEMS, LANTERN_ABILITIES, LOCATIONS, SKILLS } from '@/data';
import type { ActiveAilment, WeaponType } from '@/types';
import { ENEMY_TIER_LABELS, ENEMY_TIER_COLORS } from '@/utils/enemyTier';
import { AILMENT_TINT_COLORS } from '@/utils/ailmentTint';
import { itemWouldHaveEffect, sortCombatConsumables } from '@/utils/itemEffect';
import { enemyHitGroupFor, ENEMY_HIT_SFX } from '@/utils/enemyHitGroup';
import { describeSkill, describeLanternAbility } from '@/utils/moveDescription';
import { buildRewardLines } from '@/utils/rewardLines';
import { sceneForLocationKind } from '@/utils/sceneForLocationKind';
import { homeTownFor } from '@/utils/locationHomeTown';
import { INCOMING_HIT_STAGGER_MS, PRE_ENEMY_ATTACK_DELAY_MS } from '@/phaser/battleEffects';
import { useCutsceneStore } from '@/state/useCutsceneStore';
import { battleStartCutscene, buildDefeatCutscene } from '@/data/cutscenes';
import { getAssetUrl } from '@/assets/assetManager';
import { playMusic, playSound } from '@/audio/audioService';
import { LorePopup } from '@/components/LorePopup';
import { SkillSelectMenu } from '@/components/SkillSelectMenu';
import { ItemUseMenu } from '@/components/ItemUseMenu';
import { useLorePopupQueue } from '@/hooks/useLorePopupQueue';
import { useItemTray } from '@/hooks/useItemTray';
import { useCombatPreferencesStore } from '@/state/useCombatPreferencesStore';
import styles from './CombatScene.module.css';

const RESTORE_STAT_LABEL: Record<'hp' | 'spirit' | 'lanternOil', string> = {
  hp: 'HP',
  spirit: 'Spirit',
  lanternOil: 'Lantern Oil',
};

/** One hit cue per universal weapon type (docs/Mytherra-Equipment_breakdown.md), played for a
 *  plain 'attack' action (the one action mechanically tied to whatever's actually in the weapon
 *  slot) instead of the generic sfx.combat-hit. Every other skill still gets its own dedicated
 *  sfxAssetId (or falls back to sfx.combat-hit) - this only ever applies to 'attack' itself. */
const WEAPON_TYPE_SFX: Record<WeaponType, string> = {
  sword: 'sfx.weapon.sword',
  staff: 'sfx.weapon.staff',
  axe: 'sfx.weapon.axe',
  spear: 'sfx.weapon.spear',
  hammer: 'sfx.weapon.hammer',
};

/** Fallback hit cue for a spirit-damageType Skill whose own inflictsAilmentId names one of these -
 *  see WEAPON_TYPE_SFX's own doc comment for the sibling physical-damageType case, and
 *  sfx.skill.spirit-generic (act()'s own fallback-of-the-fallback) for a spirit skill that doesn't
 *  inflict any of these. Stun has no cure item (see data/items.ts) but is still a real inflicted
 *  ailment some skills can cause, so it's included here even though nothing in AILMENTS gates it. */
const AILMENT_SFX: Record<string, string> = {
  burn: 'sfx.ailment.burn',
  freeze: 'sfx.ailment.freeze',
  stun: 'sfx.ailment.stun',
  poison: 'sfx.ailment.poison',
  blind: 'sfx.ailment.blind',
  silence: 'sfx.ailment.silence',
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
  const [targetMode, setTargetMode] = useState<'single' | 'all'>(() =>
    useCombatPreferencesStore.getState().defaultTargetAll ? 'all' : 'single',
  );
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
  // Enemy-side equivalent of ailmentTakesHoldEvent above - one entry per enemy that had a new
  // ailment land on it this round (e.g. a Skill/weapon's inflictsAilmentId succeeding against a
  // vulnerable enemy), driving BattleScene's per-enemy-sprite FX burst instead of the whole-arena
  // scatter the player's own ailments use.
  const [enemyAilmentTakesHoldEvent, setEnemyAilmentTakesHoldEvent] = useState<{
    entries: { enemyIndex: number; ailmentIds: string[] }[];
    key: number;
  }>({ entries: [], key: 0 });
  // Mirrors CombatSession.lanternUsedThisRound - true once a non-offensive (defensive/healing)
  // Lantern Ability has been used as a non-turn-ending sub-action this round (see act() below),
  // disabling the Lantern Ability button(s) until a real round-ending action clears it back to
  // false, matching the "still only one Lantern Ability per round" server-side rule.
  const [lanternUsedThisRound, setLanternUsedThisRound] = useState(false);
  const [selectedAilmentId, setSelectedAilmentId] = useState<string | null>(null);
  const [showSkillMenu, setShowSkillMenu] = useState(false);
  // None of this scene's own overlays (ailment popup, skill menu, item menu) closed on Escape
  // before - every other overlay in the game (see useOverlayClose's other callers) does. Closes
  // whichever of these happens to be open; 'usingItems' is deliberately excluded, matching the
  // item menu's own click-outside/X-button guard - a batch actually in flight isn't dismissable.
  useOverlayClose(() => {
    if (selectedAilmentId) setSelectedAilmentId(null);
    if (showSkillMenu) setShowSkillMenu(false);
    if (phase === 'itemMenu') setPhase('playerTurn');
  });
  const [rewards, setRewards] = useState<ResolveCombatActionResponse['rewards']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Lore learned from a quest that completed as a side effect of this fight - shown AFTER the
  // victory panel's "Continue" is clicked (see handleContinueFromVictory below), never stacked on
  // top of it, matching how the exploration scenes sequence RewardPopup -> LorePopup.
  const { currentLorePopup, queueLorePopups, dismissCurrentLorePopup } = useLorePopupQueue();
  const [awaitingLoreBeforeExit, setAwaitingLoreBeforeExit] = useState(false);
  // Up to 3 item ids queued to ride along with whatever primary action the player takes next
  // (duplicates allowed - e.g. 2x the same potion), capped against how many of each the player
  // actually owns. Cleared only after a round actually resolves (see act()) - reset only when the
  // player actually commits that action, not when the item menu closes. combatItems is declared
  // later in this component, but the closure below isn't invoked until a caller queues an item
  // (always after this render has finished), so referencing it here is safe.
  const { tray, queuedCountFor, canQueueMore, queueItem, dequeueItem, clearTray, recordItemsUsed, resetItemsUsedThisTurn } =
    useItemTray((itemId) => combatItems.find((i) => i.itemId === itemId)?.quantity ?? 0);
  // Per-enemy hit results from the most recent round, fed into PhaserBattleCanvas to drive its hit
  // effects; batched by id so a stale timeout can't clear a *newer* round's hits. Split into two
  // arrays (one per data direction) since the engine now reports outgoing (player -> enemy) and
  // incoming (enemy -> player) hits as separate, differently-shaped lists.
  const [activeOutgoingHits, setActiveOutgoingHits] = useState<
    (CombatHitResult & { key: number; themedAilmentId?: string; targetMaxHp: number })[]
  >([]);
  const [activeIncomingHits, setActiveIncomingHits] = useState<
    (EnemyHitResult & { key: number; hitVfxGroup: 'beast' | 'earthen' | 'spirit' | 'boss' })[]
  >([]);
  // True for the full duration of a round's staggered hit playback (see the timeout below, sized
  // to actually match that duration) - phase itself returns to 'playerTurn' the instant the
  // server responds, well before a multi-enemy round's staggered incoming-hit animations finish,
  // so without this the player could queue up another action mid-animation (reported as "attacking
  // out of turn" - the enemies' own attacks were still visually resolving).
  const [playbackActive, setPlaybackActive] = useState(false);
  // Per-encounter - collapses the pause between multiple enemies' attacks (but not
  // PRE_ENEMY_ATTACK_DELAY_MS itself) so a player who'd rather not sit through a staggered 4-5
  // enemy round every time can speed through it. Seeded from the player's saved default (Settings
  // > Encounter Defaults) on a fresh encounter (new CombatScene mount); still resets to that
  // default rather than persisting mid-session toggles across fights.
  const [fastRounds, setFastRounds] = useState(() => useCombatPreferencesStore.getState().defaultFastRounds);
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
        setLanternUsedThisRound(false);
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
          enemies: res.enemies.map((e) => {
            const def = ENEMIES.find((d) => d.id === e.enemyId);
            return { spriteAssetId: def?.battleSpriteAssetId ?? '', isBoss: def?.isBoss ?? false };
          }),
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
    resetItemsUsedThisTurn();
    try {
      const needsTarget = type === 'attack' || type === 'skill' || type === 'lanternAbility';
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
        return updated ? { ...e, hp: updated.hp, ailments: updated.ailments } : e;
      }));
      // Diffed against `playerAilments` (the pre-this-round state, captured by closure before the
      // await above) rather than after setPlayerAilments below - an ailment already active last
      // round and still ticking should only get the quieter per-round burst (ailmentFxEvent), not
      // the big "just took hold" one every single round it continues.
      const newlyInflictedAilmentIds = res.playerAilments
        .filter((a) => !playerAilments.some((old) => old.ailmentId === a.ailmentId))
        .map((a) => a.ailmentId);
      setPlayerAilments(res.playerAilments);
      // Same before/after diff, per enemy - drives BattleScene's per-enemy-sprite FX burst (see
      // enemyAilmentTakesHoldEvent's own doc comment) rather than the whole-arena scatter above.
      const newlyInflictedEnemyAilments = res.enemies
        .map((updated) => {
          const before = enemies.find((e) => e.index === updated.index);
          const beforeIds = new Set((before?.ailments ?? []).map((a) => a.ailmentId));
          return { enemyIndex: updated.index, ailmentIds: updated.ailments.filter((a) => !beforeIds.has(a.ailmentId)).map((a) => a.ailmentId) };
        })
        .filter((e) => e.ailmentIds.length > 0);
      // On a defeat, the server's playerHp/playerSpirit here are already the post-respawn values
      // (Ash Hallow's soft-respawn restore, applied in the same transaction as the defeat itself -
      // see resolveCombatAction.ts) - patching them in immediately would show the HUD's HP/Spirit
      // bars already healed while the defeat overlay is still saying "you were overwhelmed,"
      // which reads as a contradiction. Leave spirit showing whatever the fight itself last
      // displayed, and only apply the real (respawned) numbers once the player actually clicks
      // Continue - see returnToExploration(). HP is the exception: `phase === 'defeat'` only ever
      // fires when the round's playerHp dropped to <=0 (see combatEngine.ts), so clamping the HUD
      // to 0 here is always accurate, unlike leaving it at the previous round's last-displayed
      // value - which is what showed a stale *positive* HP number next to the defeat message.
      if (res.phase === 'defeat') {
        pendingDefeatResyncRef.current = true;
        patchStats({ hp: 0, lanternOil: res.playerLanternOil });
      } else {
        patchStats({ hp: res.playerHp, spirit: res.playerSpirit, lanternOil: res.playerLanternOil });
      }
      clearTray();
      setLanternUsedThisRound(!res.turnConsumed);

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
      const playerHitLanded = res.hits.some((h) => !h.missed);
      // A skill/lantern ability with its own dedicated cue (sfxAssetId) plays that instead of the
      // generic hit sound - gated on an actual landed hit for an offensive action (skills are
      // always offensive; a lantern ability can be healing/defensive instead, in which case there
      // are no `hits` to check at all, so its own cue just plays whenever the action resolves).
      // A skill with no bespoke cue of its own falls back to a *weapon-type* sound (physical
      // damageType - it's still fundamentally "you hit them with your weapon, just skillfully")
      // or the generic sfx.combat-hit for everything else (a miss, or a spirit-damageType skill
      // with no dedicated cue).
      let dedicatedSoundId: string | undefined;
      // Set alongside dedicatedSoundId whenever the acting skill has its own elemental identity
      // (a spirit-damageType skill tied to a specific ailment, e.g. Marsh Toxin -> poison) - passed
      // through to BattleScene.playOutgoingHits so that skill's own themed FX (poison-cloud/ember/
      // ice-shard/dark-energy) always bursts on a landed hit, not only the round the ailment roll
      // actually succeeds. See PhaserBattleCanvas's outgoingHits prop and BattleScene's own
      // AILMENT_FX_ASSET lookup for the other half of this.
      let themedAilmentId: string | undefined;
      if (type === 'attack') {
        dedicatedSoundId = playerHitLanded && weaponDef?.weaponType ? WEAPON_TYPE_SFX[weaponDef.weaponType] : undefined;
      } else if (type === 'skill') {
        const skill = SKILLS.find((s) => s.id === (options?.skillId ?? 'keepers-strike'));
        if (playerHitLanded && skill?.sfxAssetId) {
          dedicatedSoundId = skill.sfxAssetId;
        } else if (playerHitLanded && skill?.damageType === 'physical') {
          dedicatedSoundId = weaponDef?.weaponType ? WEAPON_TYPE_SFX[weaponDef.weaponType] : undefined;
        } else if (playerHitLanded && skill?.damageType === 'spirit') {
          dedicatedSoundId = (skill.inflictsAilmentId && AILMENT_SFX[skill.inflictsAilmentId]) || 'sfx.skill.spirit-generic';
        }
        if (skill?.damageType === 'spirit' && skill.inflictsAilmentId) themedAilmentId = skill.inflictsAilmentId;
      } else if (type === 'lanternAbility') {
        const ability = LANTERN_ABILITIES.find((a) => a.id === options?.abilityId);
        if (ability?.sfxAssetId && (ability.category !== 'offensive' || playerHitLanded)) {
          dedicatedSoundId = ability.sfxAssetId;
        }
      }
      if (dedicatedSoundId) {
        void playSound(dedicatedSoundId);
      } else if (playerHitLanded) {
        void playSound('sfx.combat-hit');
      }
      if (res.hits.some((h) => h.defeated)) void playSound('sfx.enemy-defeated');
      setActiveOutgoingHits(
        res.hits.map((h) => ({
          ...h,
          themedAilmentId,
          targetMaxHp: enemies.find((e) => e.index === h.targetIndex)?.maxHp ?? 0,
          key: batch * 1000 + h.targetIndex,
        })),
      );
      // Each attacker's own hit SFX plays on the same stagger schedule as its lunge/log-line reveal
      // above (see INCOMING_HIT_STAGGER_MS) instead of every attacker's cue firing at once the
      // instant the round resolves - a 3-enemy round previously played one flat sfx.combat-hit
      // regardless of how many enemies attacked or what they were. With Fast Rounds on, every hit's
      // own stagger collapses to 0 (the visual animations all land together too - see
      // playIncomingHits), so playing one cue per attacker would fire N overlapping copies of a
      // short clip in the same instant instead of reading as N distinct hits - just the first
      // landed hit's own cue plays once, matching the pre-per-attacker-SFX behavior this mode
      // already had (a single sfx.combat-hit for the whole round).
      if (fastRounds) {
        const firstLanded = res.enemyHits.find((h) => !h.missed);
        if (firstLanded) {
          const attacker = enemies.find((e) => e.index === firstLanded.attackerIndex);
          const group = enemyHitGroupFor(attacker?.isBoss, ENEMIES.find((en) => en.id === attacker?.enemyId)?.family);
          trackedTimeout(() => void playSound(ENEMY_HIT_SFX[group]), PRE_ENEMY_ATTACK_DELAY_MS);
        }
      } else {
        res.enemyHits.forEach((hit, i) => {
          if (hit.missed) return;
          const attacker = enemies.find((e) => e.index === hit.attackerIndex);
          const group = enemyHitGroupFor(attacker?.isBoss, ENEMIES.find((en) => en.id === attacker?.enemyId)?.family);
          trackedTimeout(() => void playSound(ENEMY_HIT_SFX[group]), PRE_ENEMY_ATTACK_DELAY_MS + i * INCOMING_HIT_STAGGER_MS);
        });
      }
      setActiveIncomingHits(
        res.enemyHits.map((h) => {
          const attacker = enemies.find((e) => e.index === h.attackerIndex);
          const group = enemyHitGroupFor(attacker?.isBoss, ENEMIES.find((en) => en.id === attacker?.enemyId)?.family);
          return { ...h, hitVfxGroup: group, key: batch * 1000 + h.attackerIndex };
        }),
      );
      setAilmentFxEvent({ ailmentIds: res.playerAilments.map((a) => a.ailmentId), key: batch });
      if (newlyInflictedAilmentIds.length > 0) {
        setAilmentTakesHoldEvent({ ailmentIds: newlyInflictedAilmentIds, key: batch });
      }
      if (newlyInflictedEnemyAilments.length > 0) {
        setEnemyAilmentTakesHoldEvent({ entries: newlyInflictedEnemyAilments, key: batch });
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

      // Resolves the round's outcome immediately - the player should see their action's result
      // right away rather than wait on the background resync below. This function used to run
      // resyncSave *before* setPhase (gating on whether an item was used this round to avoid
      // double-resyncing), which meant a slow/stuck resync - a flaky mobile connection, a Cloud
      // Functions cold start - left the whole scene looking frozen on the previous phase, only
      // ever resolving once something unrelated happened to trigger its own resync (reported live
      // as "the fight doesn't know it's over," more often on mobile, and clicking into Profile
      // sometimes appearing to "unstick" it - both consistent with this exact race, not a
      // coincidence). combatEnded's phase check reads res.phase directly here, decoupled from
      // that entirely.
      if (res.phase === 'continue') {
        setPhase('playerTurn');
      } else {
        if (res.phase === 'victory') {
          setRewards(res.rewards);
          queueLorePopups(res.rewards?.grantedLoreIds);
          void playSound('sfx.victory');
          if (res.rewards?.leveledUp) void playSound('sfx.level-up');
        } else if (res.phase === 'defeat') {
          void playSound('sfx.defeat');
          void playMusic('music.defeat');
        }
        setPhase(res.phase);
      }

      // An item's inventory count (and any quest/journal progress from this round) only lives in
      // Firestore, not in the combat response above - refreshed here so it isn't stale the next
      // time the player opens a menu that reads it. Deliberately fire-and-forget (never awaited) -
      // see the comment above for why this must not be able to block the phase transition. Skipped
      // on defeat - a resync here would pull in the same already-respawned hp/spirit patchStats
      // just avoided above; that resync happens later instead, once the player clicks Continue
      // (see returnToExploration()).
      if (uid && res.phase !== 'defeat') {
        void resyncSave(uid);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong resolving that action.');
      setPhase('error');
    }
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
        // One cue per consumable *type*, not per item id - a fresh potion and a rare elixir both
        // just play sfx.item-use.hp. Priority order (restore-type effects before cure) matters for
        // a hybrid item (e.g. a salve that both heals a little and cures an ailment) - restoring a
        // resource is the more prominent felt effect. cureAilmentId alone falls back to the
        // existing generic sfx.item-use (already wired into CharacterMenu's own inventory tab) -
        // one shared cue across every ailment cure, no per-ailment variant requested.
        const effect = ITEMS.find((i) => i.id === itemId)?.effect;
        if (effect?.healHpPercent || effect?.reviveOnDefeat) void playSound('sfx.item-use.hp');
        else if (effect?.healSpiritPercent) void playSound('sfx.item-use.spirit');
        else if (effect?.restoreOilPercent) void playSound('sfx.item-use.oil');
        else if (effect?.cureAilmentId) void playSound('sfx.item-use');
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
    recordItemsUsed(usedCount);
    clearTray();
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
    const targetLocationId = wasDefeat ? homeTownFor(locationId) : locationId;
    const targetLocation = LOCATIONS.find((l) => l.id === targetLocationId);
    const scene = targetLocation ? sceneForLocationKind(targetLocation.kind) : 'town';
    // Restore the exact tile the fight was triggered from, rather than dumping the player back at
    // the map's default spawn - but only within the same location; a defeat sends the player to
    // their region's own home town instead (see homeTownFor), where the original coordinates from
    // a different map don't apply.
    const preserveSpawn = targetLocationId === locationId;
    const goToExploration = () =>
      goTo(scene, {
        locationId: targetLocationId,
        spawnX: preserveSpawn ? params.spawnX : undefined,
        spawnY: preserveSpawn ? params.spawnY : undefined,
      });
    if (wasDefeat) {
      useCutsceneStore.getState().play({ ...buildDefeatCutscene(targetLocation?.name ?? 'town'), entryEffect: 'wake-up', onComplete: goToExploration });
    } else {
      goToExploration();
    }
  }

  // Clicking "Continue" on a victory with queued lore shows the lore first (see render below)
  // instead of leaving immediately - once the last lore popup is dismissed, this effect fires the
  // actual scene transition that was deferred.
  useEffect(() => {
    if (awaitingLoreBeforeExit && !currentLorePopup) {
      setAwaitingLoreBeforeExit(false);
      void returnToExploration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingLoreBeforeExit, currentLorePopup]);

  function handleContinueFromVictory() {
    if (currentLorePopup) setAwaitingLoreBeforeExit(true);
    else void returnToExploration();
  }

  const combatItems = sortCombatConsumables(inventory);
  const canAct = phase === 'playerTurn' && !playbackActive;
  const canPickTarget = aliveEnemies.length > 1 && canAct;
  // Every full-screen modal that renders on top of the battle canvas - see
  // PhaserBattleCanvasProps.inputSuspended's own doc comment for why this has to be threaded all
  // the way into Phaser's own sprite interactivity, not just left to normal DOM stacking.
  const targetingSuspended = !!selectedAilmentId || showSkillMenu || phase === 'itemMenu' || phase === 'usingItems';
  const combatEnded = phase === 'victory' || phase === 'defeat' || phase === 'fled' || phase === 'error';
  const isSilenced = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.blocksSkill);
  const isLanternDisabled = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.disablesLanternAbility);
  const isStunned = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.skipsTurn);
  const isBlinded = playerAilments.some((a) => AILMENTS[a.ailmentId]?.effect.physicalAccuracyMultiplier);
  const activeTintColors = playerAilments.map((a) => AILMENT_TINT_COLORS[a.ailmentId]).filter((c): c is string => !!c);

  // Attack's identity follows whatever's in the weapon slot - "Fists" when nothing is equipped,
  // matching the same pattern lantern abilities use for the lantern slot.
  const weaponId = player?.equipment.weapon;
  const weaponDef = weaponId ? EQUIPMENT.find((e) => e.id === weaponId) : undefined;
  const weaponName = weaponId ? (weaponDef?.name ?? 'Attack') : 'Fists';

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
  const lanternOilTier = lanternId ? (player?.lanternOilUpgrades[lanternId] ?? 0) : 0;
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
        ailmentIds: e.ailments.map((a) => a.ailmentId),
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
        <SkillSelectMenu
          skills={knownSkills}
          playerSpirit={player?.stats.spirit ?? 0}
          onClose={() => setShowSkillMenu(false)}
          onSelect={(skillId) => {
            setShowSkillMenu(false);
            act('skill', { skillId });
          }}
        />
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
              inputSuspended={targetingSuspended}
              onTargetEnemy={(index) => {
                setTargetMode('single');
                setTargetIndex(index);
              }}
              combatEnded={combatEnded}
              ailmentFxEvent={ailmentFxEvent}
              ailmentTakesHoldEvent={ailmentTakesHoldEvent}
              enemyAilmentTakesHoldEvent={enemyAilmentTakesHoldEvent}
            />
            {canPickTarget && (
              <p className={styles.targetHint}>
                {targetMode === 'all'
                  ? 'Attacking all foes at once - reduced damage each, chance to miss.'
                  : 'Tap an enemy to choose your target'}
              </p>
            )}
            {/* Newest message first (reversed), keyed by each line's own index in the full `log`
                array (not its position in this slice) so React only mounts/animates genuinely new
                lines - older ones just shift down and get clipped once they overflow the
                container's full-height bottom edge. Sliced generously (20) since the container now
                spans the whole battlefield height - overflow:hidden on .messageOverlay clips
                whatever doesn't fit, so this is a cheap upper bound, not a tuned line count. */}
            <div className={styles.messageOverlay}>
              {log
                .map((line, i) => ({ line, i }))
                .slice(-20)
                .reverse()
                .map(({ line, i }) => (
                  <p key={i} className={styles.messageLine}>
                    {line}
                  </p>
                ))}
            </div>
          </div>
        </div>

        <div className={styles.bottomPanel}>
        <Panel className={styles.actionsPanel}>
          {/* Covers both the network round-trip (phase 'resolving', before any response has
           *  arrived) and the staggered hit-playback after it (playbackActive) - without this,
           *  a slow response left the action buttons disabled with no visible reason, reading
           *  as frozen rather than "still working on it" (worse on a slow/mobile connection,
           *  where that gap can stretch to several seconds). */}
          {(phase === 'resolving' || playbackActive) && <p className={styles.stunnedBanner}>Resolving...</p>}
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
            {weaponDef?.iconAssetId && (
              <img src={getAssetUrl(weaponDef.iconAssetId)} alt="" style={{ width: 20, height: 20, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 4 }} />
            )}
            {weaponName}
          </button>
          {knownSkills.length <= 1 ? (
            <button
              className={styles.actionButton}
              disabled={!canAct || (player?.stats.spirit ?? 0) < (knownSkills[0]?.spiritCost ?? 0) || isSilenced}
              title={isSilenced ? 'Silenced - Specialty Attacks are blocked.' : knownSkills[0] ? describeSkill(knownSkills[0]) : undefined}
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
              disabled={!canAct || (player?.stats.lanternOil ?? 0) < ability.oilCost || isLanternDisabled || lanternUsedThisRound}
              title={
                isLanternDisabled
                  ? 'Frozen - the Lantern specialty is disabled.'
                  : lanternUsedThisRound
                    ? 'Already used your Lantern this round.'
                    : describeLanternAbility(ability, lanternOilTier)
              }
              onClick={() => act('lanternAbility', { abilityId: ability.id })}
            >
              {lanternDef?.iconAssetId && (
                <img src={getAssetUrl(lanternDef.iconAssetId)} alt="" style={{ width: 20, height: 20, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 4 }} />
              )}
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
        </Panel>
        </div>
      </div>

      {(phase === 'itemMenu' || phase === 'usingItems') && (
        <ItemUseMenu
          items={combatItems.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            wouldHelp: player
              ? itemWouldHaveEffect(ITEMS.find((d) => d.id === i.itemId)?.effect, player.stats, playerAilments.map((a) => a.ailmentId))
              : false,
            queued: queuedCountFor(i.itemId),
          }))}
          canQueueMore={canQueueMore}
          busy={phase === 'usingItems'}
          onQueue={queueItem}
          onDequeue={dequeueItem}
          onDone={finishItemMenu}
          onClose={() => setPhase('playerTurn')}
        />
      )}

      {(phase === 'victory' || phase === 'defeat' || phase === 'fled') &&
        (awaitingLoreBeforeExit && currentLorePopup ? (
          <LorePopup title={currentLorePopup.title} body={currentLorePopup.body} onClose={dismissCurrentLorePopup} />
        ) : (
        <div className={styles.overlay}>
          <Panel style={{ width: 'min(420px, 90vw)', textAlign: 'center' }}>
            {phase === 'victory' && (
              <>
                <h2 style={{ color: 'var(--fw-accent)' }}>Victory!</h2>
                <div className={styles.rewardList}>
                  {buildRewardLines({
                    xp: rewards?.xp,
                    gold: rewards?.gold,
                    spiritEssence: rewards?.spiritEssence,
                    itemIds: rewards?.itemIds,
                    skillIds: rewards?.grantedSkillIds,
                    notices: rewards?.lanternOilUpgradeRegions.map(
                      (region) => `Lantern Oil Upgrades Unlocked - ${region} General Store`,
                    ),
                  }).map(
                    (line) => (
                      <div key={line.key} className={styles.rewardRow}>
                        {line.icon && <img src={getAssetUrl(line.icon)} alt="" className={styles.rewardIcon} />}
                        <span>{line.label}</span>
                      </div>
                    ),
                  )}
                </div>
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
                <p>You wake back in {LOCATIONS.find((l) => l.id === homeTownFor(locationId))?.name ?? 'town'}, shaken but alive.</p>
              </>
            )}
            {phase === 'fled' && <h2>You escaped.</h2>}
            <button className={styles.actionButton} onClick={handleContinueFromVictory} style={{ marginTop: 12 }}>
              Continue
            </button>
          </Panel>
        </div>
        ))}

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
