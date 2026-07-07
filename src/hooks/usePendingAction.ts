import { useCallback, useState } from 'react';

/** Tracks whether an interaction's Cloud Function round-trip is still in flight, purely so the
 *  scene can show an instant "something is happening" indicator instead of a click that appears
 *  to do nothing until the network call resolves. Wrap the call itself with `run(...)`, passing a
 *  label describing the action underway (e.g. "Talking...") - `pending` is that label while the
 *  call is in flight, or `null` when idle. */
export function usePendingAction() {
  const [pending, setPending] = useState<string | null>(null);

  const run = useCallback(<T,>(promise: Promise<T>, label: string): Promise<T> => {
    setPending(label);
    return promise.finally(() => setPending(null));
  }, []);

  return { pending, run };
}
