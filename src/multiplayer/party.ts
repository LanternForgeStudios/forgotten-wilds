// TODO(multiplayer): party system placeholder. When built, this will let 2-6 players form a
// party for co-op expeditions. CombatState.party (src/types/combat.ts) already reserves a slot
// for this, and the turn queue in the (future) combat engine should generalize from
// "1 player vs enemies" to "N party members vs enemies" without a rewrite, since it already
// iterates combatants generically by speed.
import type { Party } from '@/types';

export function createParty(_leaderUid: string): Promise<Party> {
  throw new Error('Party system not implemented yet.');
}

export function inviteToParty(_partyId: string, _uid: string): Promise<void> {
  throw new Error('Party system not implemented yet.');
}

export function leaveParty(_partyId: string, _uid: string): Promise<void> {
  throw new Error('Party system not implemented yet.');
}
