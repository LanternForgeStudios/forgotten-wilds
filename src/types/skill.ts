export type SkillKind = 'skill' | 'spiritArt';

/** 'lantern' only ever appears on an offensive lantern ability, which is rendered separately (see
 *  src/data/lanternAbilities.ts) - no entry in this file's SKILLS array uses it, but it's a real
 *  possible value for an enemy's weaknessDamageType (see src/types/enemy.ts). */
export type DamageType = 'physical' | 'spirit' | 'lantern';

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
  /** A registry.ts audio asset id (e.g. 'sfx.skill.ember-burst') to play instead of the generic
   *  sfx.combat-hit when this skill lands a hit - purely a client-side presentation choice (like
   *  everything else in this file), not gameplay data, so it has no server-side counterpart in
   *  functions/src/data/skills.ts. Optional - most skills have no dedicated cue and just use the
   *  generic hit sound (see CombatScene.tsx's own resolution of which sound to play). */
  sfxAssetId?: string;
}
