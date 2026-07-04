// TODO(multiplayer): chat placeholder. The presence popover in PlayerHUD
// (src/components/PlayerHUD.tsx) is the natural attachment point for a future "message" button
// per nameplate.
export interface ChatMessage {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  text: string;
  sentAt: number;
}

export function sendChatMessage(_locationId: string, _text: string): Promise<void> {
  throw new Error('Chat is not implemented yet.');
}

export function subscribeToChat(_locationId: string, _callback: (messages: ChatMessage[]) => void): () => void {
  throw new Error('Chat is not implemented yet.');
}
