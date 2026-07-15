import { Panel } from '@/components/common/Panel';

interface MessageOverlayProps {
  message: string | null;
  onClose: () => void;
}

/** The bottom-anchored "you find a thing" flash message shown by Town/Overworld/Dungeon after an
 *  interact/collect/shrine call resolves - identical markup in all three scenes, so it lives here
 *  once rather than being copy-pasted a fourth time. Dismissed by clicking anywhere on the overlay
 *  or Esc (each scene's own keydown handler still owns the Esc binding, since it also has to
 *  arbitrate against whichever other overlay is open). */
export function MessageOverlay({ message, onClose }: MessageOverlayProps) {
  if (!message) return null;
  return (
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
      onClick={onClose}
    >
      <Panel style={{ width: 'min(600px, 90vw)' }}>
        <p style={{ margin: 0 }}>{message}</p>
        <p style={{ fontSize: 12, opacity: 0.7, textAlign: 'right', margin: '8px 0 0' }}>Click or Esc to close</p>
      </Panel>
    </div>
  );
}
