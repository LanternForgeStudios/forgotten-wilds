// TODO(multiplayer): clan placeholder. Distinct from Lodges (lodges.ts) - a Clan is meant to be a
// smaller, tighter-knit group (think: a standing party roster + shared identity) rather than the
// larger guild-equivalent Lodges represent. Surfaced as a tab in UserProfile.tsx already, showing
// this "not implemented yet" message rather than a working screen.
export interface Clan {
  id: string;
  name: string;
  leaderUid: string;
  memberUids: string[];
  foundedAt: number;
}

export function createClan(_name: string, _leaderUid: string): Promise<Clan> {
  throw new Error('Clans are not implemented yet.');
}

export function joinClan(_clanId: string, _uid: string): Promise<void> {
  throw new Error('Clans are not implemented yet.');
}
