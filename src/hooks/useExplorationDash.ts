import { useDash } from './useDash';
import { useDashKeybind } from './useDashKeybind';

/** Wires Dash into an exploration scene - the `useDash` + `useDashKeybind` pair Town/Overworld/
 *  Dungeon each set up identically. `startDash`/`stopDash` are still returned directly since
 *  MobileHud's touch dash button needs them too, alongside the keyboard binding this hook wires up
 *  on its own. */
export function useExplorationDash(setDashHeld: (held: boolean) => void, enabled: boolean) {
  const { startDash, stopDash } = useDash({ setDashHeld });
  useDashKeybind(startDash, stopDash, enabled);

  return { startDash, stopDash };
}
