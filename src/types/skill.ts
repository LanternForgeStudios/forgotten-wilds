export type SkillKind = 'skill' | 'spiritArt';

export type DamageType = 'physical' | 'spirit';

export interface Skill {
  id: string;
  name: string;
  description: string;
  kind: SkillKind;
  damageType: DamageType;
  power: number;
  spiritCost: number;
  /** Enemy families this skill deals bonus damage to, per lore (e.g. Spirit Arts vs Coal Spirits). */
  effectiveAgainstFamilies?: string[];
}
