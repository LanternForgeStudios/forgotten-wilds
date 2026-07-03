// TODO(multiplayer): trading placeholder. Like every authoritative mutation in this game, a real
// implementation must resolve trades via a Cloud Function (an escrow-style transaction swapping
// inventory entries atomically) — never a direct client Firestore write — to keep the same
// anti-cheat guarantee the rest of the economy relies on.
import type { TradeOffer } from '@/types';

export function proposeTrade(
  _toUid: string,
  _offeredItemIds: string[],
  _requestedItemIds: string[],
): Promise<TradeOffer> {
  throw new Error('Trading is not implemented yet.');
}

export function respondToTrade(_tradeId: string, _accept: boolean): Promise<void> {
  throw new Error('Trading is not implemented yet.');
}
