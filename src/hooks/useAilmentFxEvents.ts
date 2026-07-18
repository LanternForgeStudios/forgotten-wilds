import { useEffect, useRef, useState } from 'react';

type AilmentFxEvent = { ailmentIds: string[]; key: number };

/** Drives PhaserBattleCanvas's FX-pack ailment bursts (poison/burn/freeze) for the *viewer's own*
 *  ailments - shared by EndlessBattlePanel.tsx and PvpBattlePanel.tsx, which both track this the
 *  same way (a ref of the previous round's ailment ids, diffed against the current round on every
 *  `resolvedAt` change). Mirrors CombatScene.tsx's own ailmentFxEvent/ailmentTakesHoldEvent
 *  wiring (same key-changes-every-round convention, same before/after diff for "newly inflicted
 *  this round"), which isn't extracted into this same hook since it diffs against closure-captured
 *  call-response state rather than a Firestore snapshot ref - a different enough shape that
 *  sharing it would cost more than the duplication it removes.
 *
 *  Returns `{ ailmentIds: [], key: 0 }` (PhaserBattleCanvas's pre-first-round sentinel) whenever
 *  `resolvedAt` is undefined, e.g. before the battle doc's first snapshot arrives. */
export function useAilmentFxEvents(currentAilmentIds: string[], resolvedAt: number | undefined) {
  const prevAilmentIdsRef = useRef<Set<string>>(new Set());
  const [ailmentFxEvent, setAilmentFxEvent] = useState<AilmentFxEvent>({ ailmentIds: [], key: 0 });
  const [ailmentTakesHoldEvent, setAilmentTakesHoldEvent] = useState<AilmentFxEvent>({ ailmentIds: [], key: 0 });

  useEffect(() => {
    if (!resolvedAt) return;
    const newlyInflicted = currentAilmentIds.filter((id) => !prevAilmentIdsRef.current.has(id));
    prevAilmentIdsRef.current = new Set(currentAilmentIds);
    setAilmentFxEvent({ ailmentIds: currentAilmentIds, key: resolvedAt });
    if (newlyInflicted.length > 0) setAilmentTakesHoldEvent({ ailmentIds: newlyInflicted, key: resolvedAt });
    // currentAilmentIds is intentionally omitted - it's a fresh array every render (derived from
    // the battle doc), so keying off it directly would refire this diff every render instead of
    // once per resolved round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedAt]);

  return { ailmentFxEvent, ailmentTakesHoldEvent };
}
