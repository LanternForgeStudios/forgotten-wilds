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
  'keepers-strike': { id: 'keepers-strike', kind: 'skill', damageType: 'physical', power: 18, spiritCost: 0 },
  'lantern-flame': {
    id: 'lantern-flame',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 22,
    spiritCost: 12,
    effectiveAgainstFamilies: ['coalSpirits'],
  },
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
};
