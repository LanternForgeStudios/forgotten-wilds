import { useEffect, useRef, useState } from 'react';
import { Panel } from './common/Panel';
import { OverlayCloseButton } from './common/OverlayCloseButton';
import { useAuthStore } from '@/state/useAuthStore';
import { useOverlayClose } from '@/hooks/useOverlayClose';
import { callSendWorldChatMessage } from '@/firebase/functionsClient';
import { getWorldChatSessionJoinedAt, subscribeToWorldChat } from '@/firebase/worldChatService';
import type { WorldChatMessage } from '@/types';
import styles from './WorldChat.module.css';

interface WorldChatProps {
  onClose: () => void;
}

/** Public, town-only chat room - only ever mounted from TownScene (see its own `worldChatOpen`
 *  toggle), which already means every render of this component happens while the player is
 *  standing in a town. sendWorldChatMessage re-checks that server-side regardless, same as every
 *  other Cloud Function trusting nothing the client merely implies. */
export function WorldChat({ onClose }: WorldChatProps) {
  const uid = useAuthStore((s) => s.user?.uid);
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  // Frozen once per page load (not per panel-open) - "only see messages from the point in time
  // you logged in" means a real session start, not whenever this overlay happens to be toggled.
  const joinedAtRef = useRef(getWorldChatSessionJoinedAt());
  useOverlayClose(onClose);

  useEffect(() => subscribeToWorldChat(setMessages), []);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const visibleMessages = messages.filter((m) => m.sentAt >= joinedAtRef.current);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await callSendWorldChatMessage(text);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that message.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Panel className={styles.panel} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <OverlayCloseButton onClick={onClose} />
        <h2 className={styles.title}>World Chat</h2>
        <div className={styles.messages} ref={messagesRef}>
          {visibleMessages.length === 0 && <p className={styles.empty}>No messages yet - say hello!</p>}
          {visibleMessages.map((m) => (
            <p key={m.id} className={styles.messageRow}>
              <span className={styles.messageName}>{m.uid === uid ? 'You' : m.displayName}:</span>
              {m.text}
            </p>
          ))}
        </div>
        <p className={styles.warning}>
          For your safety, don't share personal information (phone numbers, emails, or links) - messages
          containing them, or offensive language, won't send. Please be kind to fellow Keepers.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.inputRow}>
          <input
            className={styles.textInput}
            placeholder="Say something to everyone in town..."
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button className={styles.sendButton} disabled={busy || !draft.trim()} onClick={send}>
            Send
          </button>
        </div>
        <p className={styles.closeHint}>Click outside or press Esc to close</p>
      </Panel>
    </div>
  );
}
