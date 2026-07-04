import { useEffect, useRef, useState } from 'react';
import { PlayerHUD } from '@/components/PlayerHUD';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { MobileHud } from '@/components/exploration/MobileHud';
import { DirectionPad } from '@/components/exploration/DirectionPad';
import { Panel } from '@/components/common/Panel';
import { QuestLog } from '@/components/QuestLog';
import { CharacterMenu } from '@/components/CharacterMenu';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useHeartbeat } from '@/hooks/useHeartbeat';
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
import { callInteractWithShrine, callOpenChest } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { ITEMS, EQUIPMENT } from '@/data';
import styles from './TownScene.module.css';

const LOCATION_ID = 'ironwood-trail';
const TILESET_COLUMNS = 12;

/** Flavor text for the Guardian of Ironwood shrine, chosen client-side from the current quest
 *  progress rather than invented server-side - the server only reports what advanced/unlocked. */
function guardianMessage(
  questsCompleted: string[],
  unlockedStamina: boolean,
  guardiansTrialStatus: string | undefined,
  guardiansProofStatus: string | undefined,
  guardiansBlessingStatus: string | undefined,
): string {
  if (unlockedStamina) {
    return 'The Guardian of Ironwood inclines its head. "You have proven your resolve. Draw on the trail\'s strength when you need to move swiftly - Stamina is yours to command now."';
  }
  if (questsCompleted.includes('guardians-trial')) {
    return 'The Guardian of Ironwood regards you in silence, then speaks: "Prove your resolve against what stalks this trail, and return to me."';
  }
  if (guardiansBlessingStatus === 'active') {
    return 'The Guardian of Ironwood watches you, waiting. It has nothing more to say until you are ready to leave once more.';
  }
  if (guardiansProofStatus === 'active') {
    return 'The Guardian of Ironwood is silent. It is waiting to see whether you can prove yourself first.';
  }
  if (guardiansTrialStatus === 'active') {
    return 'You have found it: a shrine half-swallowed by root and moss, and within it, something ancient stirs.';
  }
  return 'The shrine is quiet. Whatever watches over it does not stir for you - not yet.';
}

/** Display name for any interactable on this map, shared between the entity labels and the
 *  "nothing to do here yet" fallback message so they never drift out of sync. */
function labelForInteractable(refId: string, openedChests: string[]): string {
  if (refId.startsWith('chest-')) return openedChests.includes(refId) ? 'Empty Chest' : 'Chest';
  if (refId === 'guardian-of-ironwood') return 'Shrine';
  return 'something';
}

export function OverworldScene() {
  const goTo = useSceneStore((s) => s.goTo);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const questProgress = useQuestStore((s) => s.progress);
  const openedChests = useWorldStateStore((s) => s.openedChests);
  const staminaUnlocked = (usePlayerStore((s) => s.player?.stats.maxStamina) ?? 0) > 0;
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { scale, viewportSize } = useExplorationViewport();
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const suspended = questLogOpen || menuOpen || journalOpen || message !== null;
  const { map, position, positionRef, facingDelta, attemptMove } = useLocationExploration({
    locationId: LOCATION_ID,
    suspended,
    onEncounterZoneStep: (chance, pos) => {
      if (Math.random() < chance) {
        goTo('combat', { locationId: LOCATION_ID, spawnX: pos.x, spawnY: pos.y });
      }
    },
  });

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
    if (obj?.refId === 'guardian-of-ironwood') {
      callInteractWithShrine(LOCATION_ID, 'guardian-of-ironwood')
        .then(async (res) => {
          if (uid) await resyncSave(uid);
          const progress = useQuestStore.getState().progress;
          setMessage(
            guardianMessage(
              res.questsCompleted,
              res.unlockedStamina,
              progress['guardians-trial']?.status,
              progress['guardians-proof']?.status,
              progress['guardians-blessing']?.status,
            ),
          );
        })
        .catch((err) => setMessage(err instanceof Error ? err.message : 'The shrine does not respond.'));
      return;
    }
    if (obj?.refId?.startsWith('chest-')) {
      const chestId = obj.refId;
      callOpenChest(LOCATION_ID, chestId)
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
      return;
    }
    if (obj?.refId) {
      const label = labelForInteractable(obj.refId, openedChests);
      setMessage(`You find ${label.startsWith('Empty') ? 'an ' + label.toLowerCase() : 'a ' + label.toLowerCase()}. Perhaps it will mean something, in time.`);
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (message) setMessage(null);
        else if (questLogOpen) setQuestLogOpen(false);
        else if (menuOpen) setMenuOpen(false);
        else if (journalOpen) setJournalOpen(false);
        return;
      }
      if (e.key === 'l' || e.key === 'L') setQuestLogOpen((open) => !open);
      if (e.key === 'i' || e.key === 'I') setMenuOpen((open) => !open);
      if (e.key === 'j' || e.key === 'J') setJournalOpen((open) => !open);
      if (e.key === 'Enter' || e.key === ' ') attemptInteract();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, questLogOpen, menuOpen, journalOpen, map, position, facingDelta, uid, questProgress]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Setting out onto Ironwood Trail...</p>
      </div>
    );
  }

  const entities: GridEntity[] = map.objects
    .filter((o) => o.type === 'interactable' && o.refId)
    .map((o) => ({
      id: o.refId!,
      x: o.x,
      y: o.y,
      spriteAssetId: o.refId!.startsWith('chest-') ? 'structure.chest' : 'structure.shrine',
      label: labelForInteractable(o.refId!, openedChests),
    }));

  return (
    <div className={styles.wrap} style={{ paddingTop: isMobile ? HUD_BAR_HEIGHT.mobile : HUD_BAR_HEIGHT.desktop }}>
      <PlayerHUD locationId={LOCATION_ID} />
      <div ref={gridWrapperRef} style={{ touchAction: 'none' }}>
        <TileGrid
          map={map}
          tilesetAssetId="tileset.tiny-dungeon"
          tilesetColumns={TILESET_COLUMNS}
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
            onQuestLog={() => setQuestLogOpen((open) => !open)}
            onInventory={() => setMenuOpen((open) => !open)}
            onJournal={() => setJournalOpen((open) => !open)}
          />
        </>
      ) : (
        <p className={styles.hint}>
          Move: arrow keys / WASD &nbsp;·&nbsp; Interact: Enter / Space
          {staminaUnlocked && <>&nbsp;·&nbsp; Dash: Shift + direction</>}
          &nbsp;·&nbsp; Watch for Mothlings in the deep grass &nbsp;·&nbsp; Quest Log: L &nbsp;·&nbsp; Inventory: I
          &nbsp;·&nbsp; Journal: J
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
      {questLogOpen && <QuestLog onClose={() => setQuestLogOpen(false)} />}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
