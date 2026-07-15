import { useState } from 'react';
import type { RefObject } from 'react';
import { useDash } from './useDash';
import { useDashKeybind } from './useDashKeybind';
import type { Facing, GridPosition } from './useGridMovement';

/** Wires Dash into an exploration scene - the `useState(dashRampKey)` + `useDash` +
 *  `useDashKeybind` trio Town/Overworld/Dungeon each set up identically. `startDash`/`stopDash`
 *  are still returned directly since MobileHud's touch dash button needs them too, alongside the
 *  keyboard binding this hook wires up on its own. */
export function useExplorationDash(
  attemptMove: (facing: Facing, options?: { isDash?: boolean }) => void,
  positionRef: RefObject<GridPosition>,
  enabled: boolean,
) {
  const [dashRampKey, setDashRampKey] = useState(0);
  const { startDash, stopDash } = useDash({
    attemptMove,
    positionRef,
    onRampUp: () => setDashRampKey((k) => k + 1),
  });
  useDashKeybind(startDash, stopDash, enabled);

  return { startDash, stopDash, dashRampKey };
}
