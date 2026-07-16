import { useEffect, useState } from 'react';
import { subscribeToPartyBattle } from '@/firebase/partyBattleService';
import { EndlessBattlePanel } from './EndlessBattlePanel';
import { PvpBattlePanel } from './PvpBattlePanel';
import type { PartyBattleSession } from '@/types';

interface ActiveBattleOverlayProps {
  battleId: string;
  onClose: () => void;
}

/** PlayerHUD's subscribeToMyActivePartyBattle only reports *that* a battle is active, not which
 *  kind - this reads just enough of the doc (mode) to route to the right panel. Endless Battle and
 *  PvP share the same partyBattles/{id} collection and submitPartyBattleAction plumbing, but their
 *  UIs differ enough (wave/continue-vote vs. a single opponent + win/lose) to be separate
 *  components rather than one panel branching internally on mode. */
export function ActiveBattleOverlay({ battleId, onClose }: ActiveBattleOverlayProps) {
  const [mode, setMode] = useState<PartyBattleSession['mode'] | null>(null);

  useEffect(
    () =>
      subscribeToPartyBattle(battleId, (battle) => {
        setMode(battle?.mode ?? null);
      }),
    [battleId],
  );

  if (!mode) return null;
  return mode === 'pvp' ? (
    <PvpBattlePanel battleId={battleId} onClose={onClose} />
  ) : (
    <EndlessBattlePanel battleId={battleId} onClose={onClose} />
  );
}
