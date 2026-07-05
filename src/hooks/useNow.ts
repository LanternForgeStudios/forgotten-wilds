import { useEffect, useState } from 'react';

/** Re-renders the calling component every `intervalMs`, returning the current timestamp - for
 *  purely cosmetic, client-side interpolation of a value that changes continuously in real time
 *  (e.g. Stamina regen) between server round-trips. Never used to derive anything persisted. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
