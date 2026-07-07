import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { PlayerHUD } from '@/components/PlayerHUD';
import { getAssetUrl } from '@/assets/assetManager';
import {
  callResolveCombatAction,
  callStartEncounter,
  callUseItem,
  type CombatHitResult,
  type EncounterEnemy,
  type ResolveCombatActionResponse,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useAuthStore } from '@/state/useAuthStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useToastStore } from '@/state/useToastStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import { HUD_BAR_HEIGHT } from '@/hooks/useExplorationViewport';
import { useSceneStore, type SceneName } from '@/state/useSceneStore';
import { ENEMIES, EQUIPMENT, ITEMS, LANTERN_ABILITIES, LOCATIONS, SKILLS } from '@/data';
import { ENEMY_TIER_LABELS, ENEMY_TIER_COLORS } from '@/utils/enemyTier';
import { itemWouldHaveEffect } from '@/utils/itemEffect';
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

/** Front row holds up to 3; anything beyond that overflows to a staggered back row - mirrors how
 *  most JRPGs lay out a 1-6 enemy group rather than a single line. A boss fight is a special case:
 *  the boss always sits in the back row with its 0-3 "adds" (never more than 3, so they always fit
 *  the front row) in front, regardless of position in the array - not the same positional split a
 *  same-tier group of 4-6 regular/elite enemies uses. */
function splitFormation(items: EncounterEnemy[]): { front: EncounterEnemy[]; back: EncounterEnemy[] } {
  if (items.some((e) => e.isBoss)) {
    return { front: items.filter((e) => !e.isBoss), back: items.filter((e) => e.isBoss) };
  }
  const front = items.slice(0, 3);
  const back = items.slice(3);
  return { front, back };
}

export function CombatScene() {
  const params = useSceneStore((s) => s.params);
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);
  const inventory = useInventoryStore((s) => s.items);
  const isMobile = useIsMobile();
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
  // Per-enemy hit results from the most recent round, used to drive the bounce/floating damage-or-
  // -miss text; batched by id so a stale timeout can't clear a *newer* round's hits.
  const [activeHits, setActiveHits] = useState<(CombatHitResult & { key: number })[]>([]);
  const hitBatchRef = useRef(0);

  const locationId = params.locationId ?? 'ironwood-trail';
  const location = LOCATIONS.find((l) => l.id === locationId);

  useEffect(() => {
    let cancelled = false;
    callStartEncounter(locationId, params.bossId)
      .then((res) => {
        if (cancelled) return;
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
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Could not start the encounter.');
        setPhase('error');
      });
    return () => {
      cancelled = true;
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
      setLog((prev) => [...prev, ...res.log]);
      setEnemies((prev) => prev.map((e) => {
        const updated = res.enemies.find((u) => u.index === e.index);
        return updated ? { ...e, hp: updated.hp } : e;
      }));
      patchStats({ hp: res.playerHp, spirit: res.playerSpirit, lanternOil: res.playerLanternOil });
      setTray([]);

      if (res.damageTakenByPlayer > 0) {
        useToastStore.getState().push(`Took ${res.damageTakenByPlayer} damage this round.`);
      }

      hitBatchRef.current += 1;
      const batch = hitBatchRef.current;
      setActiveHits(res.hits.map((h) => ({ ...h, key: batch * 1000 + h.targetIndex })));
      setTimeout(() => {
        setActiveHits((prev) => prev.filter((h) => Math.floor(h.key / 1000) !== batch));
      }, 1500);

      // An item's inventory count only lives in Firestore, not in the combat response above, so
      // it must be resynced here too - otherwise the displayed quantity never decrements mid-fight
      // even though the server correctly consumed it, and using it again eventually fails once the
      // real (server-side) stock hits zero while the stale client count still shows some left.
      if (usedItems && uid) {
        await resyncSave(uid);
      }

      if (res.phase === 'continue') {
        setPhase('playerTurn');
        return;
      }

      if (res.phase === 'victory') {
        setRewards(res.rewards);
      }

      if (uid) {
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

  function returnToExploration() {
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
  const backgroundUrl = location ? getAssetUrl(location.battleBackgroundAssetId) : undefined;
  const { front, back } = useMemo(() => splitFormation(enemies), [enemies]);
  const canPickTarget = aliveEnemies.length > 1 && phase === 'playerTurn';

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

  function renderEnemy(enemy: EncounterEnemy) {
    const hit = activeHits.find((h) => h.targetIndex === enemy.index);
    // A killing blow keeps its slot rendered just long enough for the bounce/floating text to
    // finish, instead of vanishing the instant `enemies` state reflects 0 hp.
    if (enemy.hp <= 0 && !hit) return null;
    const def = ENEMIES.find((e) => e.id === enemy.enemyId);
    const hpPct = enemy.maxHp > 0 ? Math.max(0, (enemy.hp / enemy.maxHp) * 100) : 0;
    const isTarget = targetMode === 'all' ? true : enemy.index === targetIndex;
    const size = enemy.isBoss ? 256 : 128;
    return (
      <button
        key={enemy.index}
        type="button"
        className={`${styles.enemySlot} ${isTarget ? styles.enemySlotTargeted : ''}`}
        onClick={() => {
          setTargetMode('single');
          setTargetIndex(enemy.index);
        }}
        disabled={targetMode !== 'all' && !canPickTarget && enemy.index !== targetIndex}
      >
        {def && (
          <img
            src={getAssetUrl(def.battleSpriteAssetId)}
            alt={enemy.name}
            className={`${styles.enemySprite} ${hit ? styles.enemyBounce : ''}`}
            width={size}
            height={size}
          />
        )}
        {hit && (
          <span
            key={hit.key}
            className={`${styles.floatingText} ${hit.missed ? styles.floatingMiss : styles.floatingDamage}`}
          >
            {hit.missed ? 'MISS' : `-${hit.damage}`}
          </span>
        )}
        <div className={styles.enemyBar}>
          <p className={styles.enemyName}>{enemy.name}</p>
          <p className={styles.enemyTier} style={{ color: ENEMY_TIER_COLORS[enemy.tier] }}>
            {ENEMY_TIER_LABELS[enemy.tier]}
            {enemy.tier !== 'boss' && ` · Lv.${enemy.level}`}
          </p>
          <div className={styles.hpTrack}>
            <div className={styles.hpFill} style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        {isTarget && aliveEnemies.length > 1 && <span className={styles.targetMarker}>▼ target</span>}
      </button>
    );
  }

  return (
    <div
      className={styles.wrap}
      style={{
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
        paddingTop: isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop,
      }}
    >
      <PlayerHUD />

      <div className={styles.stage}>
        <div className={styles.enemyArea}>
          {phase !== 'starting' && (
            <>
              {back.length > 0 && <div className={styles.enemyRowBack}>{back.map(renderEnemy)}</div>}
              <div className={styles.enemyRowFront}>{front.map(renderEnemy)}</div>
            </>
          )}
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
