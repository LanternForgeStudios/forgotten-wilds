// Authoritative — the client's src/data/skills.ts is a display copy only.

export type SkillKind = 'skill' | 'spiritArt';
/** 'lantern' only ever appears as the damageType passed into resolveOffensiveHits for an offensive
 *  lanternAbility call (see combatEngine.ts) - no Skill entry in this table itself uses 'lantern',
 *  since lantern abilities are entirely data-driven from data/lanternAbilities.ts instead. */
export type DamageType = 'physical' | 'spirit' | 'lantern';

export interface Skill {
  id: string;
  /** Display name used in combat log lines (e.g. "Frost Lance hits") - mirrors src/data/skills.ts's
   *  own `name` field, which the client uses for UI display; this copy exists because the engine
   *  itself (not the client) generates the log text server-side. */
  name: string;
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
  attack: { id: 'attack', name: 'Attack', kind: 'skill', damageType: 'physical', power: 10, spiritCost: 0 },
  // A Specialty Attack, gated by Spirit rather than a cooldown - see data/specialAttacks.ts for
  // the roster/unlock metadata; this entry is just its combat math.
  'keepers-strike': {
    id: 'keepers-strike',
    name: "Keeper's Strike",
    kind: 'skill',
    damageType: 'spirit',
    power: 18,
    spiritCost: 10,
  },
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
    name: 'Dustwing Flurry',
    kind: 'skill',
    damageType: 'physical',
    power: 10,
    spiritCost: 0,
    inflictsAilmentId: 'blind',
    inflictAilmentChance: 0.3,
  },
  'miner-pickaxe-swing': {
    id: 'miner-pickaxe-swing',
    name: 'Rusted Pickaxe Swing',
    kind: 'skill',
    damageType: 'physical',
    power: 14,
    spiritCost: 0,
    inflictsAilmentId: 'stun',
    inflictAilmentChance: 0.2,
  },
  'coalspirit-cinderburst': {
    id: 'coalspirit-cinderburst',
    name: 'Cinder Burst',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 16,
    spiritCost: 0,
    inflictsAilmentId: 'burn',
    inflictAilmentChance: 0.3,
  },
  'warden-coal-slam': {
    id: 'warden-coal-slam',
    name: 'Coalbound Slam',
    kind: 'skill',
    damageType: 'physical',
    power: 20,
    spiritCost: 0,
  },
  'warden-warden-wrath': {
    id: 'warden-warden-wrath',
    name: "Warden's Wrath",
    kind: 'spiritArt',
    damageType: 'spirit',
    // Was 30 - at the level range this boss is actually first fought at, that reliably crossed
    // 75+ damage per hit (playtest feedback: "feels a bit too high"). Dialed back to still read as
    // the boss's hardest-hitting phase-2 move (well above warden-coal-slam's 20) without spiking
    // that hard.
    power: 24,
    spiritCost: 0,
    inflictsAilmentId: 'burn',
    inflictAilmentChance: 0.4,
  },
  'ridge-ambush': {
    id: 'ridge-ambush',
    name: 'Ridge Ambush',
    kind: 'skill',
    damageType: 'physical',
    power: 12,
    spiritCost: 0,
    inflictsAilmentId: 'silence',
    inflictAilmentChance: 0.3,
  },
  'wisp-chill': {
    id: 'wisp-chill',
    name: 'Wisp Chill',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 14,
    spiritCost: 0,
    inflictsAilmentId: 'freeze',
    inflictAilmentChance: 0.3,
  },
  'briar-thorn-lash': {
    id: 'briar-thorn-lash',
    name: 'Briar Thorn Lash',
    kind: 'skill',
    damageType: 'physical',
    power: 13,
    spiritCost: 0,
    inflictsAilmentId: 'poison',
    inflictAilmentChance: 0.3,
  },

  // Crimson Bayou (MSQ Volume II) enemy signature moves - same one-tag-covers-both-tiers
  // convention as the Iron Mountains set above: a Marsh Crocodile's death roll stuns, a Bog
  // Witch's hex poisons, a Rougarou's claw rakes blind the eyes, and the Ancient Serpent
  // Guardian's venom fang (its phase-2 unlock, mirroring warden-warden-wrath) poisons harder.
  'croc-death-roll': {
    id: 'croc-death-roll',
    name: 'Death Roll',
    kind: 'skill',
    damageType: 'physical',
    power: 13,
    spiritCost: 0,
    inflictsAilmentId: 'stun',
    inflictAilmentChance: 0.25,
  },
  'hag-withering-hex': {
    id: 'hag-withering-hex',
    name: 'Withering Hex',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 15,
    spiritCost: 0,
    inflictsAilmentId: 'poison',
    inflictAilmentChance: 0.3,
  },
  'rougarou-feral-rend': {
    id: 'rougarou-feral-rend',
    name: 'Feral Rend',
    kind: 'skill',
    damageType: 'physical',
    power: 13,
    spiritCost: 0,
    inflictsAilmentId: 'blind',
    inflictAilmentChance: 0.3,
  },
  'serpent-guardian-coil-crush': {
    id: 'serpent-guardian-coil-crush',
    name: 'Coil Crush',
    kind: 'skill',
    damageType: 'physical',
    power: 20,
    spiritCost: 0,
  },
  'serpent-guardian-venom-fang': {
    id: 'serpent-guardian-venom-fang',
    name: 'Venom Fang',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 24,
    spiritCost: 0,
    inflictsAilmentId: 'poison',
    inflictAilmentChance: 0.4,
  },

  // --- Endless Prairie (MSQ Volume III) enemy signature moves ---
  // windSpirits (wind-wisp/storm-wisp) - the region's own signature ailment, Silence, matching
  // Iron Mountains' Burn / Crimson Bayou's Poison as the ailment the region's Rare-tier equipment
  // resists (see equipment.ts). Regular and elite share the same move, weighted higher on elite -
  // same convention as bog-hag/cypress-witch sharing hag-withering-hex above.
  'wisp-hush-gale': {
    id: 'wisp-hush-gale',
    name: 'Hush Gale',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 13,
    spiritCost: 0,
    inflictsAilmentId: 'silence',
    inflictAilmentChance: 0.3,
  },
  // prairieWolves (prairie-wolf/dire-prairie-wolf) - a pack tackle that bowls the target over,
  // same Stun ailment/chance as croc-death-roll above (no cure item exists for Stun).
  'wolf-pack-takedown': {
    id: 'wolf-pack-takedown',
    name: 'Pack Takedown',
    kind: 'skill',
    damageType: 'physical',
    power: 13,
    spiritCost: 0,
    inflictsAilmentId: 'stun',
    inflictAilmentChance: 0.25,
  },

  // Quest-taught Specialty Attacks (docs/Mytherra-SQ_breakdown.md, The Forgotten Treatises).
  // Themed around Freeze/Burn via name/description and (now that enemies can be afflicted) an
  // ailment matching that theme, which only lands on a vulnerable target (coalSpirits/
  // waterSpirits/briarSpirits are all vulnerable to their respective ailment here, see
  // enemies.ts's vulnerableAilments). Note: effectiveAgainstFamilies below is set but NOT
  // currently read for a 'skill' action by either combat engine (only a 'lanternAbility' reads
  // it, see combatEngine.ts/partyCombatEngine.ts's effectiveAgainstFamilies handling) - these two
  // Skills' weakness bonus is inert today. Leaving that gap alone here since wiring it up would
  // be a real damage-balance change, not a doc-comment fix.
  'frost-lance': {
    id: 'frost-lance',
    name: 'Frost Lance',
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
    name: 'Ember Burst',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 20,
    spiritCost: 12,
    effectiveAgainstFamilies: ['waterSpirits', 'briarSpirits'],
    inflictsAilmentId: 'burn',
    inflictAilmentChance: 0.3,
  },

  // Quest-taught Specialty Attacks, Crimson Bayou's own side quest (docs/Mytherra-SQ_breakdown.md,
  // "The Drowned Ledgers"). Same shape/convention as frost-lance/ember-burst above - ailments
  // chosen to actually land on a real Bayou enemy family's vulnerableAilments (see enemies.ts),
  // not just flavor-matched like effectiveAgainstFamilies (still inert for a 'skill' action, same
  // gap noted above).
  'marsh-toxin': {
    id: 'marsh-toxin',
    name: 'Marsh Toxin',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 20,
    spiritCost: 12,
    effectiveAgainstFamilies: ['swampCrocs'],
    inflictsAilmentId: 'poison',
    inflictAilmentChance: 0.3,
  },
  'hush-of-reeds': {
    id: 'hush-of-reeds',
    name: 'Hush of the Reeds',
    kind: 'spiritArt',
    damageType: 'spirit',
    power: 20,
    spiritCost: 12,
    effectiveAgainstFamilies: ['rougarou'],
    inflictsAilmentId: 'silence',
    inflictAilmentChance: 0.3,
  },
};
