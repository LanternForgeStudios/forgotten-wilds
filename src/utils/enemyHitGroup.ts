/** Which shared hit-SFX/VFX group an enemy family belongs to, for an incoming (enemy -> player)
 *  attack - shared by CombatScene.tsx, EndlessBattlePanel.tsx, and PvpBattlePanel.tsx (every place
 *  a battle can happen) so all three read/sound consistently. 4 groups instead of one per family
 *  (18+ distinct families would be a lot of near-identical impact cues) - 'boss' always wins
 *  regardless of the attacker's own family (checked separately via isBoss, not this table). */
export type EnemyHitGroup = 'beast' | 'earthen' | 'spirit' | 'boss';

export const ENEMY_FAMILY_HIT_GROUP: Record<string, EnemyHitGroup> = {
  cliffDwellers: 'beast',
  swampCrocs: 'beast',
  rougarou: 'beast',
  prairieWolves: 'beast',
  frostWolves: 'beast',
  restlessMiners: 'earthen',
  coalSpirits: 'earthen',
  bogWitches: 'earthen',
  frozenWraiths: 'earthen',
  mothlings: 'spirit',
  briarSpirits: 'spirit',
  waterSpirits: 'spirit',
  windSpirits: 'spirit',
  stormAvians: 'spirit',
  silentEchoes: 'spirit',
  rootWraiths: 'spirit',
  dustDevils: 'spirit',
  celestialWisps: 'spirit',
};

/** registry.ts audio asset id per group - the SFX half; BattleScene.ts's own ENEMY_HIT_FX_ASSET is
 *  the matching VFX half (kept there since that file owns every other FX-asset-id constant). */
export const ENEMY_HIT_SFX: Record<EnemyHitGroup, string> = {
  beast: 'sfx.enemy-hit.beast',
  earthen: 'sfx.enemy-hit.earthen',
  spirit: 'sfx.enemy-hit.spirit',
  boss: 'sfx.enemy-hit.boss',
};

/** Resolves an attacker's hit group from its isBoss flag and Enemy.family - shared helper so
 *  CombatScene/EndlessBattlePanel/PvpBattlePanel don't each re-derive this slightly differently.
 *  Falls back to 'earthen' (a generic physical thud) if the family is somehow unrecognized rather
 *  than throwing - better a slightly-wrong sound than a crashed battle. */
export function enemyHitGroupFor(isBoss: boolean | undefined, family: string | undefined): EnemyHitGroup {
  if (isBoss) return 'boss';
  return ENEMY_FAMILY_HIT_GROUP[family ?? ''] ?? 'earthen';
}
