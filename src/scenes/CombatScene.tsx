import { useEffect, useRef, useState } from 'react';
import { Panel } from '@/components/common/Panel';
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
import { useSceneStore, type SceneName } from '@/state/useSceneStore';
import { ENEMIES, EQUIPMENT, ITEMS, LANTERN_ABILITIES, LOCATIONS, SKILLS } from '@/data';
import { ENEMY_TIER_LABELS, ENEMY_TIER_COLORS } from '@/utils/enemyTier';
import { itemWouldHaveEffect } from '@/utils/itemEffect';
import { markEncounterEnded } from '@/utils/encounterCooldown';
import { INCOMING_HIT_STAGGER_MS } from '@/phaser/battleEffects';
import styles from './CombatScene.module.css';

const LOCATION_KIND_TO_SCENE: Record<string, SceneName> = {
  town: 'town',
  overworld: 'overworld',
  dungeon: 'dungeon',
};

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
  const [rewards, setRewards] = useState<ResolveCombatActionResponse['rewards']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Up to 3 item ids queued to ride along with whatever primary action the player takes next
  // (duplicates allowed - e.g. 2x the same potion). Cleared only after a round actually resolves.
  const [tray, setTray] = useState<string[]>([]);
  // Per-enemy hit results from the most recent round, fed into PhaserBattleCanvas to drive its hit
  // effects; batched by id so a stale timeout can't clear a *newer* round's hits. Split into two
  // arrays (one per data direction) since the engine now reports outgoing (player -> enemy) and
  // incoming (enemy -> player) hits as separate, differently-shaped lists.
  const [activeOutgoingHits, setActiveOutgoingHits] = useState<(CombatHitResult & { key: number })[]>([]);
  const [activeIncomingHits, setActiveIncomingHits] = useState<(EnemyHitResult & { key: number })[]>([]);
  const hitBatchRef = useRef(0);
  const encounterGuardRef = useRef<{ locationId: string; cancelled: boolean } | null>(null);
  // True once a defeat round's response has arrived but its (already-respawned-at-Ash-Hallow)
  // hp/spirit haven't been applied to the store yet - see the comment in act() below for why.
  const pendingDefeatResyncRef = useRef(false);

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
        setTargetIndex(res.enemies[0]?.index ?? null);
        patchStats({ hp: res.playerHp, maxHp: res.playerMaxHp, spirit: res.playerSpirit });
        const intro =
          res.enemies.length > 1
            ? `${res.enemies.length} foes block your path!`
            : `A ${res.enemies[0]?.name ?? 'foe'} blocks your path!`;
        setLog([intro]);
        setPhase('playerTurn');
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
    options?: { abilityId?: string },
  ) {
    if (!sessionId || phase === 'resolving') return;
    setPhase('resolving');
    try {
      const needsTarget = type === 'attack' || type === 'skill' || type === 'lanternAbility';
      const usedItems = tray.length > 0;
      const res = await callResolveCombatAction(sessionId, {
        type,
        abilityId: options?.abilityId,
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
        setTimeout(() => {
          setLog((prev) => [...prev, hit.logLine]);
        }, i * INCOMING_HIT_STAGGER_MS);
      });
      setEnemies((prev) => prev.map((e) => {
        const updated = res.enemies.find((u) => u.index === e.index);
        return updated ? { ...e, hp: updated.hp } : e;
      }));
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

      if (res.damageTakenByPlayer > 0) {
        useToastStore.getState().push(`Took ${res.damageTakenByPlayer} damage this round.`);
      }

      hitBatchRef.current += 1;
      const batch = hitBatchRef.current;
      setActiveOutgoingHits(res.hits.map((h) => ({ ...h, key: batch * 1000 + h.targetIndex })));
      setActiveIncomingHits(res.enemyHits.map((h) => ({ ...h, key: batch * 1000 + h.attackerIndex })));
      setTimeout(() => {
        setActiveOutgoingHits((prev) => prev.filter((h) => Math.floor(h.key / 1000) !== batch));
        setActiveIncomingHits((prev) => prev.filter((h) => Math.floor(h.key / 1000) !== batch));
      }, 1500);

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
      }

      if (uid && res.phase !== 'defeat') {
        await resyncSave(uid);
      }
      setPhase(res.phase);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong resolving that action.');
      setPhase('error');
    }
  }

  const queuedCountFor = (itemId: string) => tray.filter((id) => id === itemId).length;
  const canQueueMore = tray.length < 3;

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
    let failed = false;
    for (const itemId of queued) {
      try {
        await callUseItem(itemId);
      } catch {
        // A later item can still be valid even if an earlier one turned out to be a no-op (e.g.
        // it would have had no effect because an earlier item in the same batch already maxed
        // that stat) - keep going rather than aborting the whole batch.
        failed = true;
      }
    }
    setTray([]);
    if (uid) await resyncSave(uid);
    if (failed) {
      useToastStore.getState().push("Some of those items wouldn't have done anything - skipped.");
    }
    setPhase('playerTurn');
  }

  async function returnToExploration() {
    markEncounterEnded();
    // The defeat round's real (already-respawned) hp/spirit were deliberately withheld from the
    // store back in act() so the HUD didn't show them healed while the defeat overlay was still
    // up - apply them now, right as the player actually leaves for Ash Hallow.
    if (pendingDefeatResyncRef.current && uid) {
      pendingDefeatResyncRef.current = false;
      await resyncSave(uid);
    }
    const targetLocationId = phase === 'defeat' ? 'ash-hallow' : locationId;
    const targetLocation = LOCATIONS.find((l) => l.id === targetLocationId);
    const scene = targetLocation ? LOCATION_KIND_TO_SCENE[targetLocation.kind] : 'town';
    // Restore the exact tile the fight was triggered from, rather than dumping the player back at
    // the map's default spawn - but only within the same location; a defeat sends the player to
    // Ash Hallow instead, where the original coordinates from a different map don't apply.
    const preserveSpawn = targetLocationId === locationId;
    goTo(scene, {
      locationId: targetLocationId,
      spawnX: preserveSpawn ? params.spawnX : undefined,
      spawnY: preserveSpawn ? params.spawnY : undefined,
    });
  }

  const combatItems = inventory.filter((i) => ITEMS.find((def) => def.id === i.itemId)?.category === 'consumable');
  const canPickTarget = aliveEnemies.length > 1 && phase === 'playerTurn';
  const combatEnded = phase === 'victory' || phase === 'defeat' || phase === 'fled' || phase === 'error';

  // Attack's identity follows whatever's in the weapon slot - "Fists" when nothing is equipped,
  // matching the same pattern lantern abilities use for the lantern slot.
  const weaponId = player?.equipment.weapon;
  const weaponName = weaponId ? EQUIPMENT.find((e) => e.id === weaponId)?.name ?? 'Attack' : 'Fists';
  const keepersStrikeCost = SKILLS.find((s) => s.id === 'keepers-strike')?.spiritCost ?? 0;

  // The equipped lantern determines which Lantern Ability button(s) show up - swap lanterns and
  // the options here change with it, same as any other equipment-driven capability.
  const lanternId = player?.equipment.lantern;
  const lanternDef = lanternId ? EQUIPMENT.find((e) => e.id === lanternId) : undefined;
  const lanternAbilities = (lanternDef?.lanternAbilityIds ?? [])
    .map((id) => LANTERN_ABILITIES.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <div className={styles.wrap} style={{ paddingTop: hudBarHeight }}>
      <PlayerHUD />

      <div className={styles.stage}>
        <div className={styles.enemyArea}>
          <div className={styles.battleCanvasWrap}>
            <PhaserBattleCanvas
              backgroundAssetId={location?.battleBackgroundAssetId ?? ''}
              enemies={enemies.map((e) => ({
                index: e.index,
                spriteAssetId: ENEMIES.find((d) => d.id === e.enemyId)?.battleSpriteAssetId ?? '',
                name: e.name,
                tierLabel: ENEMY_TIER_LABELS[e.tier],
                tierColor: ENEMY_TIER_COLORS[e.tier],
                level: e.level,
                hp: e.hp,
                maxHp: e.maxHp,
                isBoss: e.isBoss,
              }))}
              outgoingHits={activeOutgoingHits}
              incomingHits={activeIncomingHits}
              playerMaxHp={player?.stats.maxHp ?? 1}
              targetIndex={targetIndex}
              targetMode={targetMode}
              canPickTarget={canPickTarget}
              onTargetEnemy={(index) => {
                setTargetMode('single');
                setTargetIndex(index);
              }}
              combatEnded={combatEnded}
            />
          </div>
          {canPickTarget && (
            <p className={styles.targetHint}>
              {targetMode === 'all'
                ? 'Attacking all foes at once - reduced damage each, chance to miss.'
                : 'Tap an enemy to choose your target'}
            </p>
          )}
        </div>

        <div className={styles.bottomPanel}>
        <Panel className={styles.logPanel}>
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
                const wouldHelp = player ? itemWouldHaveEffect(def?.effect, player.stats) : false;
                const queued = queuedCountFor(i.itemId);
                const canAdd = wouldHelp && canQueueMore && queued < i.quantity;
                return (
                  <div key={i.itemId} className={styles.itemRow}>
                    <span>
                      {i.itemId.replace(/-/g, ' ')} x{i.quantity}
                      {queued > 0 && ` — queued: ${queued}`}
                      {!wouldHelp && ' (Full)'}
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
                        title={wouldHelp ? undefined : 'Already at maximum - using this would have no effect.'}
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
              {aliveEnemies.length > 1 && phase === 'playerTurn' && (
                <button
                  className={styles.actionButton}
                  style={{ gridColumn: '1 / -1' }}
                  onClick={() => setTargetMode((m) => (m === 'all' ? 'single' : 'all'))}
                >
                  Target: {targetMode === 'all' ? 'All Foes' : 'Single'}
                </button>
              )}
              <button className={styles.actionButton} disabled={phase !== 'playerTurn'} onClick={() => act('attack')}>
                {weaponName}
              </button>
              <button
                className={styles.actionButton}
                disabled={phase !== 'playerTurn' || (player?.stats.spirit ?? 0) < keepersStrikeCost}
                onClick={() => act('skill')}
              >
                Keeper's Strike ({keepersStrikeCost} SP)
              </button>
              {lanternAbilities.map((ability) => (
                <button
                  key={ability.id}
                  className={styles.actionButton}
                  disabled={phase !== 'playerTurn' || (player?.stats.lanternOil ?? 0) < ability.oilCost}
                  onClick={() => act('lanternAbility', { abilityId: ability.id })}
                >
                  {ability.name} ({ability.oilCost} Oil)
                </button>
              ))}
              <button
                className={styles.actionButton}
                disabled={phase !== 'playerTurn'}
                onClick={() => setPhase('itemMenu')}
              >
                Items{tray.length > 0 ? ` (${tray.length}/3)` : ''}
              </button>
              <button className={styles.actionButton} disabled={phase !== 'playerTurn'} onClick={() => act('defend')}>
                Defend
              </button>
              <button className={styles.actionButton} disabled={phase !== 'playerTurn'} onClick={() => act('flee')}>
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
                  {rewards?.itemIds.length ? ` · found: ${rewards.itemIds.join(', ')}` : ''}
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
