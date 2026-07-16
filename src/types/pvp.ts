// Mirrors the PvP challenge/queue types in functions/src/shared-types/index.ts (kept in sync by
// hand, same reason as every other server-authored document shape - see CLAUDE.md). Clients only
// ever read these via onSnapshot; every write goes through a Cloud Function in
// functions/src/functions/pvpBattle.ts.

export type PvpChallengeStatus = 'pending' | 'accepted' | 'declined';

export interface PvpChallengeDoc {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  status: PvpChallengeStatus;
  createdAt: number;
}

export interface PvpQueueEntry {
  uid: string;
  level: number;
  joinedAt: number;
}
