import { useCallback, useRef, useState } from 'react';

/** Tracks whether an interaction's Cloud Function round-trip is still in flight, purely so the
 *  scene can show an instant "something is happening" indicator instead of a click that appears
 *  to do nothing until the network call resolves. Wrap the call itself with `run(...)`, passing a
 *  label describing the action underway (e.g. "Talking...") - `pending` is that label while the
 *  call is in flight, or `null` when idle.
 *
 *  `run` takes a thunk (`() => somePromise`), not an already-started promise - a double-tap on an
 *  interactable (or any other rapid double-fire, e.g. a chest/shrine/NPC hit twice before the
 *  first response lands) would otherwise dispatch the underlying network call twice regardless of
 *  what run() does internally, since `run(someCall(...), label)` evaluates and starts someCall()
 *  as an argument *before* run() is ever invoked. A thunk lets run() check reentrancy before
 *  starting the call, so a second call while one is already in flight is silently ignored rather
 *  than double-dispatched. */
export function usePendingAction() {
  const [pending, setPending] = useState<string | null>(null);
  const pendingRef = useRef(false);

  const run = useCallback(<T,>(start: () => Promise<T>, label: string): Promise<T> | undefined => {
    if (pendingRef.current) return undefined;
    pendingRef.current = true;
    setPending(label);
    return start().finally(() => {
      pendingRef.current = false;
      setPending(null);
    });
  }, []);

  return { pending, run };
}
