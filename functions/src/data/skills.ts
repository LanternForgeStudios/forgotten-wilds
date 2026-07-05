// Authoritative — the client's src/data/skills.ts is a display copy only.

export type SkillKind = 'skill' | 'spiritArt';
export type DamageType = 'physical' | 'spirit';

export interface Skill {
  id: string;
  kind: SkillKind;
  damageType: DamageType;
  power: number;
  spiritCost: number;
  effectiveAgainstFamilies?: string[];
}

export const SKILLS: Record<string, Skill> = {
  attack: { id: 'attack', kind: 'skill', damageType: 'physical', power: 10, spiritCost: 0 },
  // A Specialty Attack, gated by Spirit rather than a cooldown - see data/specialAttacks.ts for
  // the roster/unlock metadata; this entry is just its combat math.
  'keepers-strike': { id: 'keepers-strike', kind: 'skill', damageType: 'physical', power: 18, spiritCost: 10 },
  // Lantern Flame moved to data/lanternAbilities.ts - it's tied to whichever lantern is equipped
  // (fueled by Lantern Oil), not a generally-learned skill like the ones in this file.
  'mothling-dustwing': { id: 'mothling-dustwing', kind: 'skill', damageType: 'physical', power: 10, spiritCost: 0 },
  'miner-pickaxe-swing': { id: 'miner-pickaxe-swing', kind: 'skill', damageType: 'physical', power: 14, spiritCost: 0 },
  'coalspirit-cinderburst': {
    id: 'coalspirit-cinderburst',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 16,
    spiritCost: 0,
  },
  'warden-coal-slam': { id: 'warden-coal-slam', kind: 'skill', damageType: 'physical', power: 20, spiritCost: 0 },
  'warden-warden-wrath': {
    id: 'warden-warden-wrath',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 30,
    spiritCost: 0,
  },
  'ridge-ambush': { id: 'ridge-ambush', kind: 'skill', damageType: 'physical', power: 12, spiritCost: 0 },
  'wisp-chill': { id: 'wisp-chill', kind: 'spiritArt', damageType: 'spirit', power: 14, spiritCost: 0 },
  'briar-thorn-lash': { id: 'briar-thorn-lash', kind: 'skill', damageType: 'physical', power: 13, spiritCost: 0 },
};
