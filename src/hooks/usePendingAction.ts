import { useCallback, useState } from 'react';

/** Tracks whether an interaction's Cloud Function round-trip is still in flight, purely so the
 *  scene can show an instant "something is happening" indicator instead of a click that appears
 *  to do nothing until the network call resolves. Wrap the call itself with `run(...)`. */
export function usePendingAction() {
  const [pending, setPending] = useState(false);

  const run = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    setPending(true);
    return promise.finally(() => setPending(false));
  }, []);

  return { pending, run };
}
