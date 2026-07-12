// Authoritative — the client's src/data/ailments.ts is a display copy only.

/** What an ailment actually does mechanically - a flags object rather than a single enum since
 *  some ailments combine more than one effect (Burn is both a damage-over-time and an attack
 *  debuff). Every field is optional and additive; an ailment definition sets only the ones it
 *  needs. All percentages are fractions (0-1) of the relevant max stat, same convention as
 *  ItemEffect's healHpPercent, so damage-over-time scales with the player the same way healing
 *  does instead of going stale as a flat number. */
export interface AilmentEffect {
  /** Dealt at the end of the afflicted character's own turn, each turn this ailment is active. */
  damagePercentPerTurn?: number;
  /** Multiplies outgoing Attack while active (e.g. 0.75 for Burn - "reduced Attack"). */
  attackMultiplier?: number;
  /** Multiplies the hit chance of physical-damageType actions while active (Blind). */
  physicalAccuracyMultiplier?: number;
  /** Skips the afflicted character's entire turn (Stun) - action, items, everything. */
  skipsTurn?: boolean;
  /** Blocks the 'lanternAbility' action while active (Freeze - "disables the Lantern specialty"). */
  disablesLanternAbility?: boolean;
  /** Blocks the 'skill' action while active (Silence - "prevents Spirit attacks and abilities"). */
  blocksSkill?: boolean;
}

export interface AilmentDefinition {
  id: string;
  name: string;
  description: string;
  iconAssetId: string;
  effect: AilmentEffect;
  /** If set, wears off on its own after this many of the afflicted character's own turns,
   *  regardless of whether a cure item exists for it - e.g. Stun always clears after 1 turn.
   *  Omitted for ailments that only ever end via cure or the battle itself ending. */
  autoExpireAfterTurns?: number;
  /** Item id (see ITEMS' cureAilmentId) that clears this ailment on use - omitted for an ailment
   *  that can only ever be waited out (none currently, but the shape supports it). */
  cureItemId?: string;
}

export const AILMENTS: Record<string, AilmentDefinition> = {
  poison: {
    id: 'poison',
    name: 'Poison',
    description: 'Takes HP damage at the end of each turn. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.poison',
    effect: { damagePercentPerTurn: 0.05 },
    cureItemId: 'antidote',
  },
  burn: {
    id: 'burn',
    name: 'Burn',
    description: 'Takes HP damage each turn and deals reduced Attack. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.burn',
    effect: { damagePercentPerTurn: 0.045, attackMultiplier: 0.75 },
    cureItemId: 'burn-salve',
  },
  freeze: {
    id: 'freeze',
    name: 'Freeze',
    description:
      "Takes minor HP damage each turn and disables the Lantern specialty while active. Remains until cured or the battle ends.",
    iconAssetId: 'icon.ailment.freeze',
    effect: { damagePercentPerTurn: 0.025, disablesLanternAbility: true },
    cureItemId: 'thaw-crystal',
  },
  stun: {
    id: 'stun',
    name: 'Stun',
    description: 'Skips your next turn. Wears off after 1 turn.',
    iconAssetId: 'icon.ailment.stun',
    effect: { skipsTurn: true },
    autoExpireAfterTurns: 1,
  },
  blind: {
    id: 'blind',
    name: 'Blind',
    description: 'Physical attacks have reduced accuracy. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.blind',
    effect: { physicalAccuracyMultiplier: 0.65 },
    cureItemId: 'eye-drops',
  },
  silence: {
    id: 'silence',
    name: 'Silence',
    description: 'Prevents the use of Specialty Attacks. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.silence',
    effect: { blocksSkill: true },
    cureItemId: 'echo-herb',
  },
};
