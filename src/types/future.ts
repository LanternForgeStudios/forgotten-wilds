// TODO(multiplayer): these types are unused placeholders reserved for future systems
// (see src/multiplayer/). Kept here per the data-design requirement so downstream
// code (e.g. CombatState.party) can reference stable shapes before the features exist.
// Clan (formerly here too) is no longer a placeholder - see types/clan.ts.

export interface PartyMember {
  uid: string;
  displayName: string;
  hp: number;
  maxHp: number;
}

export interface Party {
  id: string;
  leaderUid: string;
  members: PartyMember[];
}

export interface Lodge {
  id: string;
  name: string;
  memberUids: string[];
  foundedAt: number;
}
