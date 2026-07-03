import { useEffect, useState } from 'react';
import { Panel } from '@/components/common/Panel';
import { getAssetUrl } from '@/assets/assetManager';
import {
  callResolveCombatAction,
  callStartEncounter,
  type ResolveCombatActionResponse,
} from '@/firebase/functionsClient';
import { fetchPlayerSave } from '@/firebase/saveService';
import { hydrateAllStores } from '@/state/hydrate';
import { useAuthStore } from '@/state/useAuthStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useSceneStore, type SceneName } from '@/state/useSceneStore';
import { ENEMIES, ITEMS, LOCATIONS } from '@/data';
import styles from './CombatScene.module.css';

const LOCATION_KIND_TO_SCENE: Record<string, SceneName> = {
  town: 'town',
  overworld: 'overworld',
  dungeon: 'dungeon',
};

type Phase = 'starting' | 'playerTurn' | 'resolving' | 'itemMenu' | 'victory' | 'defeat' | 'fled' | 'error';

export function CombatScene() {
  const params = useSceneStore((s) => s.params);
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);
  const inventory = useInventoryStore((s) => s.items);

  const [phase, setPhase] = useState<Phase>('starting');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [enemyId, setEnemyId] = useState<string | null>(null);
  const [enemyName, setEnemyName] = useState('');
  const [enemyHp, setEnemyHp] = useState(0);
  const [enemyMaxHp, setEnemyMaxHp] = useState(1);
  const [playerHp, setPlayerHp] = useState(0);
  const [playerMaxHp, setPlayerMaxHp] = useState(1);
  const [playerSpirit, setPlayerSpirit] = useState(0);
  const [playerMaxSpirit, setPlayerMaxSpirit] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [rewards, setRewards] = useState<ResolveCombatActionResponse['rewards']>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const locationId = params.locationId ?? 'ironwood-trail';
  const location = LOCATIONS.find((l) => l.id === locationId);
  const enemy = enemyId ? ENEMIES.find((e) => e.id === enemyId) : undefined;

  useEffect(() => {
    let cancelled = false;
    callStartEncounter(locationId, params.bossId)
      .then((res) => {
        if (cancelled) return;
        setSessionId(res.sessionId);
        setEnemyId(res.enemyId);
        setEnemyName(res.enemyName);
        setEnemyHp(res.enemyHp);
        setEnemyMaxHp(res.enemyMaxHp);
        setPlayerHp(res.playerHp);
        setPlayerMaxHp(res.playerMaxHp);
        setPlayerSpirit(res.playerSpirit);
        setPlayerMaxSpirit(res.playerMaxSpirit);
        setLog([`A ${res.enemyName} blocks your path!`]);
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

  async function act(type: 'attack' | 'skill' | 'spiritArt' | 'defend' | 'flee' | 'item', itemId?: string) {
    if (!sessionId || phase === 'resolving') return;
    setPhase('resolving');
    try {
      const res = await callResolveCombatAction(sessionId, { type, itemId });
      setLog((prev) => [...prev, ...res.log]);
      setEnemyHp(res.enemyHp);
      setPlayerHp(res.playerHp);
      setPlayerSpirit(res.playerSpirit);

      if (res.phase === 'continue') {
        setPhase('playerTurn');
        return;
      }

      if (res.phase === 'victory') {
        setRewards(res.rewards);
      }

      if (uid) {
        const save = await fetchPlayerSave(uid);
        if (save) hydrateAllStores(save);
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
    goTo(scene, { locationId: targetLocationId });
  }

  const combatItems = inventory.filter((i) => ITEMS.find((def) => def.id === i.itemId)?.category === 'consumable');

  const backgroundUrl = location ? getAssetUrl(location.battleBackgroundAssetId) : undefined;
  const hpPct = enemyMaxHp > 0 ? Math.max(0, (enemyHp / enemyMaxHp) * 100) : 0;
  const playerHpPct = playerMaxHp > 0 ? Math.max(0, (playerHp / playerMaxHp) * 100) : 0;
  const playerSpiritPct = playerMaxSpirit > 0 ? Math.max(0, (playerSpirit / playerMaxSpirit) * 100) : 0;

  return (
    <div className={styles.wrap} style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined }}>
      <div className={styles.enemyArea}>
        {enemy && phase !== 'starting' && (
          <img
            src={getAssetUrl(enemy.battleSpriteAssetId)}
            alt={enemyName}
            className={styles.enemySprite}
            width={enemy.isBoss ? 256 : 128}
            height={enemy.isBoss ? 256 : 128}
          />
        )}
      </div>

      <div className={styles.enemyBar}>
        <p className={styles.enemyName}>{enemyName}</p>
        <div className={styles.hpTrack}>
          <div className={styles.hpFill} style={{ width: `${hpPct}%` }} />
        </div>
      </div>

      <div className={styles.bottomPanel}>
        <Panel className={styles.playerPanel}>
          <p className={styles.playerName}>Your HP / Spirit</p>
          <div className={styles.hpTrack} style={{ marginBottom: 6 }}>
            <div className={styles.hpFill} style={{ width: `${playerHpPct}%` }} />
          </div>
          <div className={styles.hpTrack}>
            <div className={styles.hpFill} style={{ width: `${playerSpiritPct}%`, background: 'var(--fw-spirit)' }} />
          </div>
          <p style={{ fontSize: 12, marginTop: 8 }}>
            {playerHp}/{playerMaxHp} HP · {playerSpirit}/{playerMaxSpirit} SP
          </p>
        </Panel>

        <Panel className={styles.logPanel}>
          {log.slice(-6).map((line, i) => (
            <p key={i} style={{ margin: 0 }}>
              {line}
            </p>
          ))}
        </Panel>

        <Panel className={styles.actionsPanel}>
          {phase === 'itemMenu' ? (
            <>
              {combatItems.length === 0 && <p style={{ fontSize: 12, gridColumn: '1 / -1' }}>No usable items.</p>}
              {combatItems.map((i) => (
                <button
                  key={i.itemId}
                  className={styles.actionButton}
                  onClick={() => act('item', i.itemId)}
                >
                  {i.itemId.replace(/-/g, ' ')} x{i.quantity}
                </button>
              ))}
              <button className={styles.actionButton} onClick={() => setPhase('playerTurn')}>
                Back
              </button>
            </>
          ) : (
            <>
              <button className={styles.actionButton} disabled={phase !== 'playerTurn'} onClick={() => act('attack')}>
                Attack
              </button>
              <button className={styles.actionButton} disabled={phase !== 'playerTurn'} onClick={() => act('skill')}>
                Keeper's Strike
              </button>
              <button
                className={styles.actionButton}
                disabled={phase !== 'playerTurn' || playerSpirit < 12}
                onClick={() => act('spiritArt')}
              >
                Lantern Flame
              </button>
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
