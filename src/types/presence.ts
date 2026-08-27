import type { PlayerEquipment } from './player';

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
  /** Which of the 4 base-body skin/hair variants - combined with `gender` via
   *  resolvePlayerBaseSpriteAssetId the same way the local player's own base body is resolved
   *  (see TownScene.tsx's otherPlayerEntities). Falls back to 'white-dark' for any presence doc
   *  written before this field existed. */
  appearance?: 'white-dark' | 'black-dark' | 'white-blonde' | 'asian-dark';
  /** Which items are equipped, layered on the base body the same way resolveEquipmentLayers
   *  renders the local player's own gear - so another online player looks the same to everyone
   *  else as they do to themselves. Undefined for any presence doc written before this field
   *  existed (renders as a bare base body, same as an empty PlayerEquipment would). */
  equipment?: PlayerEquipment;
  /** Live tile position - broadcast throttled (not on every single step), so movement rendered
   *  from other players' presence looks a bit stepped rather than perfectly smooth. Only rendered
   *  as a visible moving avatar in town-kind locations; Overworld/Dungeon only show a headcount. */
  x: number;
  y: number;
  /** Which way this player is currently facing (mirrors useGridMovement.ts's Facing, inlined here
   *  rather than imported - src/types/ doesn't otherwise depend on src/hooks/). Falls back to
   *  'down' for any presence doc written before this field existed. */
  facing?: 'up' | 'down' | 'left' | 'right';
}
