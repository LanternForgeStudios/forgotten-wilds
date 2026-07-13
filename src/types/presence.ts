export interface OnlinePresence {
  uid: string;
  displayName: string;
  avatarSymbol: string;
  locationId: string;
  lastHeartbeat: number;
  joinedAt: number;
  /** Which sprite variant to render this player as (see registry.ts's sprite.player.male/female) -
   *  falls back to 'male' for any presence doc written before this field existed. */
  skin?: 'male' | 'female';
  /** Live tile position - broadcast throttled (not on every single step), so movement rendered
   *  from other players' presence looks a bit stepped rather than perfectly smooth. Only rendered
   *  as a visible moving avatar in town-kind locations; Overworld/Dungeon only show a headcount. */
  x: number;
  y: number;
}
