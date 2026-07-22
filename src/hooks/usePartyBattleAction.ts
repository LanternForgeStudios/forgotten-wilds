import { useEffect, useRef, useState } from 'react';
import type { PartyBattleSession } from '@/types';

const STUCK_SAFETY_TIMEOUT_MS = 8000;

/** Wraps a party-battle callable (submitPartyBattleAction, voteContinueEndlessBattle, ...) so
 *  `busy` doesn't clear until the round's actual result has landed - not just until the callable's
 *  own network promise resolves. Those are two genuinely independent completions of the same
 *  write: the callable runs server-side via the Admin SDK, a completely separate path from this
 *  client's own `onSnapshot` listener, so there's no client-side optimistic echo the way there
 *  would be for a write this client made directly. On a slow or mobile connection the two can
 *  arrive noticeably apart - clearing `busy` on the callable alone let "Resolving..." disappear
 *  and the action buttons re-enable for a beat before the round's real outcome had rendered,
 *  reading as a dropped/delayed action. Keys off `battle.updatedAt` (bumped on every write to the
 *  battle doc) as a simple version marker: `busy` only clears once a battle update newer than the
 *  one seen right before the call actually arrives via the subscription. A safety-net timeout
 *  clears `busy` anyway if that update never shows up (a dropped listener, say), so a genuine
 *  failure can't lock the action row forever. */
export function usePartyBattleAction(battle: PartyBattleSession | null) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const pendingBaselineRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const battleRef = useRef(battle);
  battleRef.current = battle;

  function clearSafetyTimeout() {
    if (safetyTimeoutRef.current !== null) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    if (pendingBaselineRef.current !== null && battle && battle.updatedAt !== pendingBaselineRef.current) {
      pendingBaselineRef.current = null;
      clearSafetyTimeout();
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle]);

  useEffect(() => clearSafetyTimeout, []);

  async function run(call: () => Promise<unknown>, fallbackErrorMessage: string): Promise<void> {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    pendingBaselineRef.current = battleRef.current?.updatedAt ?? null;
    safetyTimeoutRef.current = window.setTimeout(() => {
      safetyTimeoutRef.current = null;
      if (pendingBaselineRef.current !== null) {
        pendingBaselineRef.current = null;
        setBusy(false);
      }
    }, STUCK_SAFETY_TIMEOUT_MS);
    try {
      await call();
    } catch (err) {
      pendingBaselineRef.current = null;
      clearSafetyTimeout();
      setError(err instanceof Error ? err.message : fallbackErrorMessage);
      setBusy(false);
    } finally {
      submittingRef.current = false;
    }
  }

  return { busy, error, setError, run };
}
