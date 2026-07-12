import type { AilmentDefinition } from '@/types';

// Display copy only — functions/src/data/ailments.ts is the authoritative source used in combat
// resolution. Descriptions here are user-facing copy for the battle overlay/tooltips; the actual
// mechanical effect numbers live only server-side.
export const AILMENTS: Record<string, AilmentDefinition> = {
  poison: {
    id: 'poison',
    name: 'Poison',
    description: 'Takes HP damage at the end of each turn. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.poison',
  },
  burn: {
    id: 'burn',
    name: 'Burn',
    description: 'Takes HP damage each turn and deals reduced Attack. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.burn',
  },
  freeze: {
    id: 'freeze',
    name: 'Freeze',
    description:
      "Takes minor HP damage each turn and disables the Lantern specialty while active. Remains until cured or the battle ends.",
    iconAssetId: 'icon.ailment.freeze',
  },
  stun: {
    id: 'stun',
    name: 'Stun',
    description: 'Skips your next turn. Wears off after 1 turn.',
    iconAssetId: 'icon.ailment.stun',
  },
  blind: {
    id: 'blind',
    name: 'Blind',
    description: 'Physical attacks have reduced accuracy. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.blind',
  },
  silence: {
    id: 'silence',
    name: 'Silence',
    description: 'Prevents the use of Specialty Attacks. Remains until cured or the battle ends.',
    iconAssetId: 'icon.ailment.silence',
  },
};
