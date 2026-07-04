// Mirrors the social types in functions/src/shared-types/index.ts (kept in sync by hand, same
// reason as every other server-authored document shape - see CLAUDE.md). Clients only ever read
// these via onSnapshot; every write goes through a Cloud Function.

export interface UserDirectoryEntry {
  uid: string;
  displayName: string;
  displayNameLower: string;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

export interface FriendRequest {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  status: FriendRequestStatus;
  createdAt: number;
}

export interface FriendshipDoc {
  friendUids: string[];
}

export interface BlockListDoc {
  blockedUids: string[];
}

export interface DirectMessage {
  id: string;
  participants: [string, string];
  fromUid: string;
  text: string;
  sentAt: number;
}
