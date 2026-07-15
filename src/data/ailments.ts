import type { AilmentDefinition } from '@/types';

// Display copy only — functions/src/data/ailments.ts is the authoritative source used in combat
// resolution. Descriptions here are user-facing copy for the battle overlay/tooltips; `effect`
// mirrors the server's numbers so CombatScene can pre-gate UI (disable a blocked button, show a
// tint) without waiting on a round-trip, but the server always re-validates and is what actually
// applies these - see AilmentEffect's own doc comment.
export const AILMENTS: Record<string, AilmentDefinition> = {
  poison: {
    id: 'poison',
    name: 'Poison',
    description: 'Takes HP damage at the end of each turn. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.poison',
    effect: { damagePercentPerTurn: 0.05 },
  },
  burn: {
    id: 'burn',
    name: 'Burn',
    description: 'Takes HP damage each turn and deals reduced Attack. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.burn',
    effect: { damagePercentPerTurn: 0.045, attackMultiplier: 0.75 },
  },
  freeze: {
    id: 'freeze',
    name: 'Freeze',
    description:
      "Takes minor HP damage each turn and disables the Lantern specialty while active. Remains until cured or the battle ends.",
    iconAssetId: 'icon.ailment.freeze',
    effect: { damagePercentPerTurn: 0.025, disablesLanternAbility: true },
  },
  stun: {
    id: 'stun',
    name: 'Stun',
    description: 'Skips your next turn. Wears off after 1 turn.',
    iconAssetId: 'icon.ailment.stun',
    effect: { skipsTurn: true },
  },
  blind: {
    id: 'blind',
    name: 'Blind',
    description: 'Physical attacks have reduced accuracy. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.blind',
    effect: { physicalAccuracyMultiplier: 0.65 },
  },
  silence: {
    id: 'silence',
    name: 'Silence',
    description: 'Prevents the use of Specialty Attacks. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.silence',
    effect: { blocksSkill: true },
  },
};
