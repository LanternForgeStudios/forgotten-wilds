// Mirrors the clan types in functions/src/shared-types/index.ts (kept in sync by hand, same
// reason as every other server-authored document shape - see CLAUDE.md). Clients only ever read
// these via onSnapshot; every write goes through a Cloud Function in functions/src/functions/clan.ts.

export const MAX_CLAN_SIZE = 6;

export interface ClanDoc {
  id: string;
  name: string;
  tag: string;
  leaderUid: string;
  memberUids: string[];
  level: number;
  xp: number;
  highestEndlessWave: number;
  createdAt: number;
  updatedAt: number;
}

export interface ClanMembershipDoc {
  clanId: string | null;
}

export type ClanInviteStatus = 'pending' | 'accepted' | 'declined';

export interface ClanInvite {
  id: string;
  clanId: string;
  clanName: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  status: ClanInviteStatus;
  createdAt: number;
}
