// Mirrors the world-chat message type in functions/src/shared-types/index.ts (kept in sync by
// hand, same reason as every other server-authored document shape - see CLAUDE.md). Clients only
// ever read this via onSnapshot; every write goes through sendWorldChatMessage.

export interface WorldChatMessage {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  sentAt: number;
}
