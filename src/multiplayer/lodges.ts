// TODO(multiplayer): lodges (guild-equivalent) placeholder. Named "lodges" rather than "guilds"
// to match the game's Appalachian/Lantern Keeper voice per the requirements doc.
import type { Lodge } from '@/types';

export function createLodge(_name: string, _founderUid: string): Promise<Lodge> {
  throw new Error('Lodges are not implemented yet.');
}

export function joinLodge(_lodgeId: string, _uid: string): Promise<void> {
  throw new Error('Lodges are not implemented yet.');
}
