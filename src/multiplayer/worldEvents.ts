// TODO(multiplayer): world events placeholder — server-scheduled, time-boxed events (e.g. a
// seasonal festival in Ash Hallow) that reward the Festival Tokens currency already tracked on
// Player (src/types/player.ts) but with no spend sink yet.
export interface WorldEvent {
  id: string;
  name: string;
  locationId: string;
  startsAt: number;
  endsAt: number;
}

export function getActiveWorldEvents(_locationId: string): Promise<WorldEvent[]> {
  throw new Error('World events are not implemented yet.');
}
