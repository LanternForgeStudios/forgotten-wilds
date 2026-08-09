import { useEffect, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { RewardPopup } from './RewardPopup';
import { getAssetUrl } from '@/assets/assetManager';
import { useAuthStore } from '@/state/useAuthStore';
import { useInventoryStore } from '@/state/useInventoryStore';
import { useWorldStateStore } from '@/state/useWorldStateStore';
import { callRequestApothecaryQuest, callTurnInApothecaryQuest } from '@/firebase/functionsClient';
import { resyncSave } from '@/state/hydrate';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { itemDisplayName, itemIconAssetId } from '@/utils/itemName';
import { buildRewardLines } from '@/utils/rewardLines';
import { SHOP_TITLES } from '@/data';
import { playSound } from '@/audio/audioService';
import styles from './CharacterMenu.module.css';

interface ApothecaryRestockPanelProps {
  shopId: string;
  onClose: () => void;
}

/** Dynamically-generated, repeatable "collect N materials" grind quest, offered by an Apothecary/
 *  Herbalist NPC via the same dialogue-branch pattern General Stores use for Lantern Oil upgrades
 *  (see TownScene.tsx's shopActionChoice). One active request per shop at a time - requested on
 *  first open if none exists yet, turned in here for a randomized reward via the shared
 *  RewardPopup, then a new one can be requested on the next visit. */
export function ApothecaryRestockPanel({ shopId, onClose }: ApothecaryRestockPanelProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const inventory = useInventoryStore((s) => s.items);
  const quest = useWorldStateStore((s) => s.apothecaryQuests[shopId]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<{ gold: number; itemIds: string[] } | null>(null);
  useOverlayClose(onClose);

  useEffect(() => {
    if (quest || loading) return;
    setLoading(true);
    setError(null);
    callRequestApothecaryQuest(shopId)
      .then(async () => {
        if (uid) await resyncSave(uid);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not request a restock job.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId, quest]);

  const owned = quest ? (inventory.find((i) => i.itemId === quest.materialId)?.quantity ?? 0) : 0;
  const canTurnIn = !!quest && owned >= quest.requiredCount;

  async function turnIn() {
    if (!quest || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callTurnInApothecaryQuest(shopId);
      if (uid) await resyncSave(uid);
      void playSound('sfx.quest-completed');
      setReward({ gold: res.gold, itemIds: res.itemIds });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn in the materials.');
      void playSound('sfx.ui-error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <Panel style={{ width: 'min(380px, 90vw)' }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <OverlayCloseButton onClick={onClose} />
          <h2 style={{ color: 'var(--fw-accent)', margin: '0 0 12px' }}>{SHOP_TITLES[shopId] ?? 'Restock Supplies'}</h2>
          {loading && <p style={{ fontSize: 13, opacity: 0.7 }}>Looking over the shelves...</p>}
          {!loading && quest && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 13, margin: 0 }}>
                &ldquo;Running low on supplies - bring me what you can find, and I&rsquo;ll make it worth your while.&rdquo;
              </p>
              {itemIconAssetId(quest.materialId) && (
                <img
                  src={getAssetUrl(itemIconAssetId(quest.materialId)!)}
                  alt=""
                  style={{ width: 40, height: 40, imageRendering: 'pixelated' }}
                />
              )}
              <p style={{ fontSize: 14, margin: 0 }}>
                <strong>{itemDisplayName(quest.materialId)}</strong>
                <br />
                {owned} / {quest.requiredCount}
              </p>
              <button className={styles.smallButton} disabled={busy || !canTurnIn} onClick={turnIn}>
                {busy ? 'Turning in…' : canTurnIn ? 'Turn In' : 'Not enough yet'}
              </button>
            </div>
          )}
          {error && <p style={{ color: 'var(--fw-danger)', fontSize: 13, marginTop: 10 }}>{error}</p>}
          <p className={styles.closeHint}>Click outside or press Esc to close</p>
        </Panel>
      </div>
      {reward && (
        <RewardPopup
          title="Restocked!"
          lines={buildRewardLines({ gold: reward.gold, itemIds: reward.itemIds })}
          onClose={() => {
            setReward(null);
            onClose();
          }}
        />
      )}
    </>
  );
}
