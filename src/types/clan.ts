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

/** One row of getClanLeaderboard's response (functions/src/functions/clan.ts) - a stripped-down
 *  ClanDoc (no memberUids/leaderUid/xp) since this is returned for every clan on the board, not
 *  just ones the caller is a member of. */
export interface ClanLeaderboardEntry {
  id: string;
  name: string;
  tag: string;
  level: number;
  highestEndlessWave: number;
}

/** One row of getSoloEndlessLeaderboard's response (functions/src/functions/endlessBattle.ts) -
 *  not clan-related at all (ranks individual players by their own solo Endless Battle record,
 *  userDirectory/{uid}.highestEndlessWave) - kept here alongside ClanLeaderboardEntry since the
 *  two are always shown together in the same leaderboard UI (UserProfile.tsx's Clan tab). */
export interface SoloEndlessLeaderboardEntry {
  uid: string;
  displayName: string;
  highestEndlessWave: number;
}
