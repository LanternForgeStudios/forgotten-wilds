import { useEffect, useRef } from 'react';
import { callSubmitPartyBattleAction } from '@/firebase/functionsClient';
import type { PartyBattleSession } from '@/types';

/** Any client can nudge a turn/timeout check even without a new action - covers the case where
 *  it's not this player's turn yet and they're just waiting on the active player or the 20s
 *  per-turn deadline. Shared by EndlessBattlePanel.tsx and PvpBattlePanel.tsx, which both used
 *  this same client-triggered polling model (see either file's own doc comment on why there's no
 *  server-scheduled resolution instead).
 *
 *  Fires once immediately on mount (not just on the first 3s interval tick), so reconnecting/
 *  reloading into a battle whose deadline already passed a while ago (nobody was around to poll
 *  it) resolves right away instead of waiting up to 3 more seconds. Also fires on tab-visibility
 *  regain (a backgrounded browser tab throttles setInterval - Chrome can drop to roughly once a
 *  minute after a tab's been hidden a while) and on the browser's `online` event (a mobile
 *  connection dropping and reconnecting mid-battle - common on cellular - previously just sat
 *  silently until the next untouched interval tick, which timer throttling on a backgrounded or
 *  power-saving mobile browser can push out far longer than 3s; reported live as party battles
 *  "sitting there" not noticing a turn/defeat had resolved, worse on mobile than desktop). */
export function usePartyBattlePoll(battle: PartyBattleSession | null, battleId: string): void {
  const lastPollRef = useRef(0);
  useEffect(() => {
    if (!battle || battle.status !== 'active') return;
    const poll = () => {
      if (Date.now() - lastPollRef.current < 2500) return;
      lastPollRef.current = Date.now();
      void callSubmitPartyBattleAction(battleId).catch(() => {});
    };
    poll();
    const id = setInterval(poll, 3000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', poll);
    window.addEventListener('focus', poll);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', poll);
      window.removeEventListener('focus', poll);
    };
  }, [battle, battleId]);
}
