export interface OnlinePresence {
  uid: string;
  displayName: string;
  avatarSymbol: string;
  locationId: string;
  lastHeartbeat: number;
  joinedAt: number;
}
