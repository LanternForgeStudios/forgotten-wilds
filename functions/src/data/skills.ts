// Authoritative — the client's src/data/skills.ts is a display copy only.

export type SkillKind = 'skill' | 'spiritArt';
/** 'lantern' only ever appears as the damageType passed into resolveOffensiveHits for an offensive
 *  lanternAbility call (see combatEngine.ts) - no Skill entry in this table itself uses 'lantern',
 *  since lantern abilities are entirely data-driven from data/lanternAbilities.ts instead. */
export type DamageType = 'physical' | 'spirit' | 'lantern';

export interface Skill {
  id: string;
  kind: SkillKind;
  damageType: DamageType;
  power: number;
  spiritCost: number;
  effectiveAgainstFamilies?: string[];
  /** Ailment id (see data/ailments.ts) this move has a chance to inflict on its target - an
   *  enemy's signature move targets the player (always applies); a player skill targets the
   *  enemy and is gated by that enemy's EnemyDefinition.vulnerableAilments (see enemies.ts's doc
   *  comment on that field - a non-vulnerable enemy just no-ops the roll). */
  inflictsAilmentId?: string;
  /** Rolled independently of the attack's own hit/miss - a missed or defeating hit never rolls
   *  this at all, so this is the chance *given* the hit landed and didn't finish the target. */
  inflictAilmentChance?: number;
}

export const SKILLS: Record<string, Skill> = {
  attack: { id: 'attack', kind: 'skill', damageType: 'physical', power: 10, spiritCost: 0 },
  // A Specialty Attack, gated by Spirit rather than a cooldown - see data/specialAttacks.ts for
  // the roster/unlock metadata; this entry is just its combat math.
  'keepers-strike': { id: 'keepers-strike', kind: 'skill', damageType: 'spirit', power: 18, spiritCost: 10 },
  // Lantern Flame moved to data/lanternAbilities.ts - it's tied to whichever lantern is equipped
  // (fueled by Lantern Oil), not a generally-learned skill like the ones in this file.
  //
  // Every enemy family's signature move below carries a themed chance to inflict an ailment -
  // dust kicked up by a Mothling's wings blinds, a Restless Miner's pickaxe swing stuns, a Coal
  // Spirit's ember burst burns, a Ridge predator's ambush unsettles focus (silence), a Water
  // Spirit's chill freezes, and Briar Spirits' thorns poison. See ENEMIES' moves arrays -
  // regular/elite pairs within a family share the same signature move (just at different
  // weight), so tagging it once here covers both tiers.
  'mothling-dustwing': {
    id: 'mothling-dustwing',
    kind: 'skill',
    damageType: 'physical',
    power: 10,
    spiritCost: 0,
    inflictsAilmentId: 'blind',
    inflictAilmentChance: 0.3,
  },
  'miner-pickaxe-swing': {
    id: 'miner-pickaxe-swing',
    kind: 'skill',
    damageType: 'physical',
    power: 14,
    spiritCost: 0,
    inflictsAilmentId: 'stun',
    inflictAilmentChance: 0.2,
  },
  'coalspirit-cinderburst': {
    id: 'coalspirit-cinderburst',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 16,
    spiritCost: 0,
    inflictsAilmentId: 'burn',
    inflictAilmentChance: 0.3,
  },
  'warden-coal-slam': { id: 'warden-coal-slam', kind: 'skill', damageType: 'physical', power: 20, spiritCost: 0 },
  'warden-warden-wrath': {
    id: 'warden-warden-wrath',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 30,
    spiritCost: 0,
    inflictsAilmentId: 'burn',
    inflictAilmentChance: 0.4,
  },
  'ridge-ambush': {
    id: 'ridge-ambush',
    kind: 'skill',
    damageType: 'physical',
    power: 12,
    spiritCost: 0,
    inflictsAilmentId: 'silence',
    inflictAilmentChance: 0.3,
  },
  'wisp-chill': {
    id: 'wisp-chill',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 14,
    spiritCost: 0,
    inflictsAilmentId: 'freeze',
    inflictAilmentChance: 0.3,
  },
  'briar-thorn-lash': {
    id: 'briar-thorn-lash',
    kind: 'skill',
    damageType: 'physical',
    power: 13,
    spiritCost: 0,
    inflictsAilmentId: 'poison',
    inflictAilmentChance: 0.3,
  },

  // Quest-taught Specialty Attacks (docs/Mytherra-SQ_breakdown.md, The Forgotten Treatises).
  // Themed around Freeze/Burn via name/description, the effectiveAgainstFamilies bonus below, and
  // (now that enemies can be afflicted) an ailment matching that theme - both land only on a
  // vulnerable target (coalSpirits/waterSpirits/briarSpirits are all vulnerable to their
  // respective ailment here, see enemies.ts's vulnerableAilments).
  'frost-lance': {
    id: 'frost-lance',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 20,
    spiritCost: 12,
    effectiveAgainstFamilies: ['coalSpirits'],
    inflictsAilmentId: 'freeze',
    inflictAilmentChance: 0.3,
  },
  'ember-burst': {
    id: 'ember-burst',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 20,
    spiritCost: 12,
    effectiveAgainstFamilies: ['waterSpirits', 'briarSpirits'],
    inflictsAilmentId: 'burn',
    inflictAilmentChance: 0.3,
  },
};
