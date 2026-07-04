export interface OnlinePresence {
  uid: string;
  displayName: string;
  avatarSymbol: string;
  locationId: string;
  lastHeartbeat: number;
  joinedAt: number;
  /** Live tile position - broadcast throttled (not on every single step), so movement rendered
   *  from other players' presence looks a bit stepped rather than perfectly smooth. Only rendered
   *  as a visible moving avatar in town-kind locations; Overworld/Dungeon only show a headcount. */
  x: number;
  y: number;
}
