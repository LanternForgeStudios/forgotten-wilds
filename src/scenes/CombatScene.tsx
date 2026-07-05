import { useEffect, useMemo, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { PlayerHUD } from '@/components/PlayerHUD';
import { getAssetUrl } from '@/assets/assetManager';
import {
  callResolveCombatAction,
  callStartEncounter,
  type EncounterEnemy,
  type ResolveCombatActionResponse,
} from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useAuthStore } from '@/state/useAuthStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { usePlayerStore } from '@/state/usePlayerStore';
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

type Phase = 'starting' | 'playerTurn' | 'resolving' | 'itemMenu' | 'victory' | 'defeat' | 'fled' | 'error';

/** Front row holds up to 3; anything beyond that overflows to a staggered back row - mirrors how
 *  most JRPGs lay out a 1-6 enemy group rather than a single line. */
function splitFormation<T>(items: T[]): { front: T[]; back: T[] } {
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
  const [log, setLog] = useState<string[]>([]);
  const [rewards, setRewards] = useState<ResolveCombatActionResponse['rewards']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    options?: { itemId?: string; abilityId?: string },
  ) {
    if (!sessionId || phase === 'resolving') return;
    setPhase('resolving');
    try {
      const needsTarget = type === 'attack' || type === 'skill' || type === 'lanternAbility';
      const res = await callResolveCombatAction(sessionId, {
        type,
        itemId: options?.itemId,
        abilityId: options?.abilityId,
        targetIndex: needsTarget ? targetIndex ?? undefined : undefined,
      });
      setLog((prev) => [...prev, ...res.log]);
      setEnemies((prev) => prev.map((e) => {
        const updated = res.enemies.find((u) => u.index === e.index);
        return updated ? { ...e, hp: updated.hp } : e;
      }));
      patchStats({ hp: res.playerHp, spirit: res.playerSpirit, lanternOil: res.playerLanternOil });

      // An item's inventory count only lives in Firestore, not in the combat response above, so
      // it must be resynced here too - otherwise the displayed quantity never decrements mid-fight
      // even though the server correctly consumed it, and using it again eventually fails once the
      // real (server-side) stock hits zero while the stale client count still shows some left.
      if (type === 'item' && uid) {
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
    if (enemy.hp <= 0) return null; // defeated - disappears from the battlefield
    const def = ENEMIES.find((e) => e.id === enemy.enemyId);
    const hpPct = enemy.maxHp > 0 ? Math.max(0, (enemy.hp / enemy.maxHp) * 100) : 0;
    const isTarget = enemy.index === targetIndex;
    const size = enemy.isBoss ? 256 : 128;
    return (
      <button
        key={enemy.index}
        type="button"
        className={`${styles.enemySlot} ${isTarget ? styles.enemySlotTargeted : ''}`}
        onClick={() => setTargetIndex(enemy.index)}
        disabled={!canPickTarget && enemy.index !== targetIndex}
      >
        {def && (
          <img
            src={getAssetUrl(def.battleSpriteAssetId)}
            alt={enemy.name}
            className={styles.enemySprite}
            width={size}
            height={size}
          />
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
          {canPickTarget && <p className={styles.targetHint}>Tap an enemy to choose your target</p>}
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
          {phase === 'itemMenu' ? (
            <>
              {combatItems.length === 0 && <p style={{ fontSize: 12, gridColumn: '1 / -1' }}>No usable items.</p>}
              {combatItems.map((i) => {
                const def = ITEMS.find((d) => d.id === i.itemId);
                const wouldHelp = player ? itemWouldHaveEffect(def?.effect, player.stats) : false;
                return (
                  <button
                    key={i.itemId}
                    className={styles.actionButton}
                    disabled={!wouldHelp}
                    title={wouldHelp ? undefined : 'Already at maximum - using this would have no effect.'}
                    onClick={() => act('item', { itemId: i.itemId })}
                  >
                    {i.itemId.replace(/-/g, ' ')} x{i.quantity}
                    {!wouldHelp && ' (Full)'}
                  </button>
                );
              })}
              <button className={styles.actionButton} onClick={() => setPhase('playerTurn')}>
                Back
              </button>
            </>
          ) : (
            <>
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
                Item
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
            <button className={styles.actionButton} onClick={() => goTo('town')} style={{ marginTop: 12 }}>
              Return to Ash Hallow
            </button>
          </Panel>
        </div>
      )}
    </div>
  );
}
