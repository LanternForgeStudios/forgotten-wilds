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
  /** Ailment id (see AILMENTS in data/ailments.ts) this move can inflict on the player - display
   *  only (e.g. the Journal's Echoes detail card), the actual chance/roll is server-only. */
  inflictsAilmentId?: string;
}
