import { useEffect, useState } from 'react';
import { TileGrid, type GridEntity } from '@/components/exploration/TileGrid';
import { DialogueBox } from '@/components/DialogueBox';
import { PlayerHUD } from '@/components/PlayerHUD';
import { QuestLog } from '@/components/QuestLog';
import { CharacterMenu } from '@/components/CharacterMenu';
import { Shop } from '@/components/Shop';
import { Inn } from '@/components/Inn';
import { JournalOfLegends } from '@/components/JournalOfLegends';
import { TownPresencePanel } from '@/components/TownPresencePanel';
import { useLocationExploration } from '@/hooks/useLocationExploration';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { useAuthStore } from '@/state/useAuthStore';
import { usePlayerStore } from '@/state/usePlayerStore';
import { callTalkToNpc } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { NPCS } from '@/data';
import type { Npc } from '@/types';
import styles from './TownScene.module.css';

const LOCATION_ID = 'ash-hallow';
const TILESET_COLUMNS = 12;

export function TownScene() {
  const [activeNpc, setActiveNpc] = useState<Npc | null>(null);
  const [questLogOpen, setQuestLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [innOpen, setInnOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const uid = useAuthStore((s) => s.user?.uid);
  const displayName = usePlayerStore((s) => s.displayName ?? undefined);
  const { map, position, facingDelta } = useLocationExploration({
    locationId: LOCATION_ID,
    suspended: activeNpc !== null || questLogOpen || menuOpen || shopOpen || innOpen || journalOpen,
  });

  useHeartbeat(uid, displayName, LOCATION_ID);

  function handleDialogueClose() {
    const hook = activeNpc?.gameplayHook;
    setActiveNpc(null);
    if (hook?.type === 'shop') setShopOpen(true);
    else if (hook?.type === 'inn') setInnOpen(true);
  }

  useEffect(() => {
    function handleInteract(e: KeyboardEvent) {
      if (e.key === 'l' || e.key === 'L') {
        setQuestLogOpen((open) => !open);
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
      if (activeNpc || questLogOpen || menuOpen || shopOpen || innOpen || journalOpen || !map) return;
      const { dx, dy } = facingDelta(position.facing);
      const target = { x: position.x + dx, y: position.y + dy };
      const npcObject = map.objects.find(
        (o) => o.type === 'npc' && o.x === target.x && o.y === target.y,
      );
      if (npcObject?.refId) {
        const npc = NPCS.find((n) => n.id === npcObject.refId);
        if (npc) {
          setActiveNpc(npc);
          callTalkToNpc(npc.id)
            .then(async () => {
              if (uid) await resyncSave(uid);
            })
            .catch((err) => console.error('talkToNpc failed', err));
        }
      }
    }
    window.addEventListener('keydown', handleInteract);
    return () => window.removeEventListener('keydown', handleInteract);
  }, [activeNpc, questLogOpen, menuOpen, shopOpen, innOpen, journalOpen, map, position, facingDelta, uid]);

  if (!map) {
    return (
      <div className={styles.wrap}>
        <p>Arriving in Ash Hallow...</p>
      </div>
    );
  }

  const entities: GridEntity[] = map.objects
    .filter((o) => o.type === 'npc' && o.refId)
    .map((o) => {
      const npc = NPCS.find((n) => n.id === o.refId);
      return {
        id: o.refId!,
        x: o.x,
        y: o.y,
        spriteAssetId: npc?.spriteAssetId ?? 'sprite.player',
        label: npc?.name,
      };
    });

  return (
    <div className={styles.wrap}>
      <PlayerHUD />
      <TownPresencePanel locationId={LOCATION_ID} />
      <TileGrid
        map={map}
        tilesetAssetId="tileset.tiny-dungeon"
        tilesetColumns={TILESET_COLUMNS}
        player={position}
        playerSpriteAssetId="sprite.player"
        entities={entities}
      />
      <p className={styles.hint}>
        Move: arrow keys / WASD &nbsp;·&nbsp; Talk: Enter / Space &nbsp;·&nbsp; Quest Log: L &nbsp;·&nbsp; Inventory: I
        &nbsp;·&nbsp; Journal: J
      </p>
      {activeNpc && (
        <DialogueBox
          lines={activeNpc.dialogue}
          portraitAssetId={activeNpc.portraitAssetId}
          onClose={handleDialogueClose}
        />
      )}
      {questLogOpen && <QuestLog onClose={() => setQuestLogOpen(false)} />}
      {menuOpen && <CharacterMenu onClose={() => setMenuOpen(false)} />}
      {shopOpen && <Shop onClose={() => setShopOpen(false)} />}
      {innOpen && <Inn onClose={() => setInnOpen(false)} />}
      {journalOpen && <JournalOfLegends onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
