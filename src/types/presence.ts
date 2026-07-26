export interface OnlinePresence {
  uid: string;
  displayName: string;
  avatarSymbol: string;
  locationId: string;
  lastHeartbeat: number;
  joinedAt: number;
  /** Body silhouette to render this player as (see registry.ts's sprite.player.male/female) -
   *  falls back to 'male' for any presence doc written before this field existed. */
  gender?: 'male' | 'female';
  /** Which of the 4 base-body skin/hair variants - not yet rendered, see `gender`'s comment on
   *  Player (src/types/player.ts). */
  appearance?: 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark';
  /** Live tile position - broadcast throttled (not on every single step), so movement rendered
   *  from other players' presence looks a bit stepped rather than perfectly smooth. Only rendered
   *  as a visible moving avatar in town-kind locations; Overworld/Dungeon only show a headcount. */
  x: number;
  y: number;
}
