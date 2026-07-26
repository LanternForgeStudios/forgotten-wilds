import { getAssetUrl, getAssetDefinition } from '@/assets/assetManager';

interface SpritePreviewFrameProps {
  assetId: string;
  alt: string;
  /** Display size, if different from the sheet's own native frameSize (e.g. shrinking a 128x128
   *  enemy idle-sheet frame down to a 56x56 detail-card thumbnail) - the crop stays proportionally
   *  correct since backgroundSize scales by the same ratio. Defaults to the frame's native size. */
  size?: { width: number; height: number };
}

/** Renders a single frame (row 0, col 0 - south-facing idle for characters, first fight-stance
 *  frame for enemies) of a sprite sheet instead of squashing the whole sheet into a small preview
 *  box - a bare <img> would otherwise show the entire sheet shrunk down. Shared by every gender/
 *  appearance picker (CharacterCreationScene, UserProfile's Skin tab) and the Journal of Legends'
 *  Echoes/Bosses detail card. Falls back to a plain <img> for a non-animated sprite (no frameSize
 *  on its registry entry). */
export function SpritePreviewFrame({ assetId, alt, size }: SpritePreviewFrameProps) {
  const def = getAssetDefinition(assetId);
  if (!def.frameSize) {
    const fallbackSize = size ?? { width: 72, height: 96 };
    return <img src={getAssetUrl(assetId)} alt={alt} style={{ ...fallbackSize, imageRendering: 'pixelated' }} />;
  }
  const displayWidth = size?.width ?? def.frameSize.width;
  const displayHeight = size?.height ?? def.frameSize.height;
  const scaleX = displayWidth / def.frameSize.width;
  const scaleY = displayHeight / def.frameSize.height;
  const sheetWidth = def.dimensions?.width ?? def.frameSize.width;
  const sheetHeight = def.dimensions?.height ?? def.frameSize.height;
  return (
    <div
      role="img"
      aria-label={alt}
      style={{
        width: displayWidth,
        height: displayHeight,
        backgroundImage: `url(${getAssetUrl(assetId)})`,
        backgroundPosition: '0 0',
        backgroundSize: `${sheetWidth * scaleX}px ${sheetHeight * scaleY}px`,
        imageRendering: 'pixelated',
      }}
    />
  );
}
