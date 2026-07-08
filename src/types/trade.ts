// Mirrors the trade types in functions/src/shared-types/index.ts (kept in sync by hand, same
// reason as every other server-authored document shape - see CLAUDE.md). Clients only ever read
// these via onSnapshot; every write goes through a Cloud Function in functions/src/functions/trade.ts.

export type TradeStatus = 'awaiting_recipient' | 'awaiting_initiator' | 'accepted' | 'declined' | 'cancelled';

export interface TradeOfferSide {
  items: { itemId: string; quantity: number }[];
  gold: number;
}

export interface TradeDoc {
  id: string;
  participants: [string, string];
  initiatorUid: string;
  recipientUid: string;
  status: TradeStatus;
  initiatorOffer: TradeOfferSide;
  recipientOffer: TradeOfferSide | null;
  createdAt: number;
  updatedAt: number;
}
