import { useEffect, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { Panel } from '@/components/common/Panel';
import { CharacterMenu } from '@/components/CharacterMenu';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { usePendingAction } from '@/hooks/usePendingAction';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useExplorationViewport, HUD_BAR_HEIGHT } from '@/hooks/useExplorationViewport';
import { useDragMovement } from '@/hooks/useDragMovement';
import { useDash } from '@/hooks/useDash';
import { useDashKeybind } from '@/hooks/useDashKeybind';
import { useSceneStore } from '@/state/useSceneStore';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { useQuestStore } from '@/state/useQuestStore';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { isTypingTarget } from '@/utils/keyboard';
import { callCollectWorldItem, callOpenChest, callInteractWithShrine } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { ITEMS, EQUIPMENT } from '@/data';
import styles from './TownScene.module.css';

const LOCATION_ID = 'hollow-rail-mine';

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  if (refId === 'coalbound-warden') return 'something vast, ember-lit';
  if (refId === 'miners-lost-lantern') return 'Lantern Relic';
  if (refId === 'mine-shrine') return 'Shrine';
  return 'something';
}

export function DungeonScene() {
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const questProgress = useQuestStore((s) => s.progress);
  const openedChests = useWorldStateStore((s) => s.openedChests);
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const isMobile = useIsMobile();
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const suspended = message !== null || menuOpen || journalOpen;
  const { map, position, positionRef, facingDelta, attemptMove } = useLocationExploration({
    locationId: LOCATION_ID,
    suspended,
    onEncounterZoneStep: (chance, pos) => {
      if (Math.random() < chance) {
        goTo('combat', { locationId: LOCATION_ID, spawnX: pos.x, spawnY: pos.y });
      }
    },
    onBlockedTransition: setMessage,
  });

  const { pending, run } = usePendingAction();

  useHeartbeat(uid, displayName, LOCATION_ID, position);
  useDragMovement(gridWrapperRef, attemptMove, isMobile && !suspended);
  const dash = useDash({ attemptMove, positionRef });
  useDashKeybind(dash, staminaUnlocked && !suspended);

  function attemptInteract() {
    if (suspended || !map) return;
    const { dx, dy } = facingDelta(position.facing);
    const target = { x: position.x + dx, y: position.y + dy };
    const obj = map.objects.find(
      (o) => o.type === 'interactable' && o.x === target.x && o.y === target.y,
    );
    if (obj?.refId === 'miners-lost-lantern') {
      run(callCollectWorldItem(LOCATION_ID, 'miners-lost-lantern'))
        .then(async (res) => {
          if (uid) await resyncSave(uid);
          setMessage(
            res.alreadyCollected
              ? "There's nothing left here — you already recovered the lantern."
              : "You pry the battered lantern free of the rubble. It's warm to the touch, as if never truly abandoned.",
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The lantern will not budge.'));
    } else if (obj?.refId === 'coalbound-warden') {
      const ready = questProgress['the-shrine-below']?.status === 'completed';
      if (ready) {
        goTo('combat', {
          locationId: LOCATION_ID,
          bossId: 'coalbound-warden',
          spawnX: position.x,
          spawnY: position.y,
        });
      } else {
        setMessage('Something vast and ember-lit stirs in the dark ahead — but the way feels barred to you, for now.');
      }
    } else if (obj?.refId === 'mine-shrine') {
      run(callInteractWithShrine(LOCATION_ID, 'mine-shrine'))
        .then(async () => {
          if (uid) await resyncSave(uid);
          setMessage('A shrine carved into the rock, coated in soot. Something in it still resists the corruption around it.');
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
    } else if (obj?.refId?.startsWith('chest-')) {
      const chestId = obj.refId;
      run(callOpenChest(LOCATION_ID, chestId))
        .then(async (res) => {
          if (uid) await resyncSave(uid);
          const name =
            EQUIPMENT.find((e) => e.id === res.itemId)?.name ??
            ITEMS.find((i) => i.id === res.itemId)?.name ??
            res.itemId;
          setMessage(
            res.alreadyOpened
              ? 'You already emptied this chest.'
              : `You open the chest and find ${name}!`,
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The chest will not open.'));
    } else if (obj?.refId) {
      const label = labelForInteractable(obj.refId, openedChests);
      const article = label.startsWith('Empty') ? 'an ' : 'a ';
      setMessage(`You find ${article}${label.toLowerCase()}. Perhaps it will mean something, in time.`);
    }
  }

  useEffect(() => {
    function handleInteract(e: KeyboardEvent) {
      if (isTypingTarget(e)) return;
      if (e.key === 'Escape') {
        if (message) setMessage(null);
        else if (menuOpen) setMenuOpen(false);
        else if (journalOpen) setJournalOpen(false);
        return;
      }
      if (e.key === 'i' || e.key === 'I') {
        setMenuOpen((open) => !open);
        return;
      }
      if (e.key === 'j' || e.key === 'J') {
        setJournalOpen((open) => !open);
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      attemptInteract();
    }
    window.addEventListener('keydown', handleInteract);
    return () => window.removeEventListener('keydown', handleInteract);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, menuOpen, journalOpen, map, position, facingDelta, uid, questProgress, goTo]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Descending into Hollow Rail Mine...</p>
      </div>
    );
  }

  const entities: GridEntity[] = map.objects
    .filter((o) => o.type === 'interactable' && o.refId)
    .map((o) => {
      if (o.refId === 'coalbound-warden') {
        return { id: o.refId, x: o.x, y: o.y, spriteAssetId: 'battle.enemy.coalbound-warden', label: '???' };
      }
      if (o.refId === 'mine-shrine') {
        return { id: o.refId, x: o.x, y: o.y, spriteAssetId: 'structure.shrine', label: 'Shrine' };
      }
      return {
        id: o.refId!,
        x: o.x,
        y: o.y,
        spriteAssetId: o.refId!.startsWith('chest-') ? 'structure.chest' : 'icon.item.miners-lost-lantern',
        label: labelForInteractable(o.refId!, openedChests),
      };
    });

  return (
    <div className={styles.wrap} style={{ paddingTop: isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop }}>
      <PlayerHUD locationId={LOCATION_ID} />
      {pending && <div className={styles.pendingIndicator}>...</div>}
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          tilesetAssetId="tileset.tiny-dungeon"
          tilesetColumns={map.columns}
          player={position}
          playerSpriteAssetId="sprite.player"
          entities={entities}
          scale={scale}
          viewportSize={viewportSize}
        />
      </div>
      {isMobile ? (
        <>
          <DirectionPad attemptMove={attemptMove} />
          <MobileHud
            onInteract={attemptInteract}
            onDash={staminaUnlocked ? dash : undefined}
            onInventory={() => setMenuOpen((open) => !open)}
            onJournal={() => setJournalOpen((open) => !open)}
          />
        </>
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Interact: Enter / Space
          {staminaUnlocked && <>&nbsp;·&nbsp; Dash: Shift + direction</>}
          &nbsp;·&nbsp; Inventory: I &nbsp;·&nbsp; Journal: J
        </p>
      )}
      {message && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: 24,
            zIndex: 20,
          }}
          onClick={() => setMessage(null)}
        >
          <Panel style={{ width: 'min(600px, 90vw)' }}>
            <p style={{ margin: 0 }}>{message}</p>
            <p style={{ fontSize: 12, opacity: 0.7, textAlign: 'right', margin: '8px 0 0' }}>
              Click or Esc to close
            </p>
          </Panel>
        </div>
      )}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
