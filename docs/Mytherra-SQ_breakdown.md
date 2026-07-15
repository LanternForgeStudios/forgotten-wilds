Iron Mountains Side Quest Chain
The Forgotten Treatises

Availability

Begins after completing MSF-IM-012 – The Mountain Remembers (quest id: the-mountain-remembers)
Given by Elias Rowan
Sequential quest chain (Quest 2 unlocks only after Quest 1 is complete)
SQ-IM-01 (quest id: frostbound-pages)
The Frostbound Pages
Story Purpose

Recover an ancient Lantern Keeper treatise documenting Spirit techniques once used to calm winter spirits. Miriam translates the forgotten text, restoring the knowledge of the Frost Spirit Specialty.

Quest Giver

Elias Rowan

Starting Location

Elias Rowan's House – Ash Hallow (locationId: ash-hallow-elias-house)

Quest Summary

Following the restoration of Hollow Rail Mine, Elias recalls an old rumor recorded in the Lantern Keeper archives. Before the Great Silence, Keepers were said to leave behind journals describing ways to commune with specific Spirit energies. One such manuscript, believed lost, may still lie hidden in the mountains.

He asks you to recover it—not because he expects it to contain power, but because every recovered story strengthens the Order.

Major Quest Flow
Step 1

Speak with Elias Rowan.

Receive the investigation.

Step 2

Travel to Whisper Falls.

Search behind the restored waterfall.

Discover a hidden Lantern Keeper cache revealed only after the mine's corruption has been lifted.

Recover:

The Frostbound Treatise

Step 3

Return to Elias Rowan.

He recognizes the writing but cannot read its ancient dialect.

He directs you to Historian Miriam.

Step 4

Visit The Ash Hallow Archive (locationId: ash-hallow-archive).

Give the treatise to Miriam.

She spends time translating the manuscript.

Step 5

Miriam discovers the manuscript describes how Lantern Keepers once drew upon the essence of calm winter spirits—not to destroy enemies, but to still raging Echoes.

The knowledge is added to the Journal of Legends.

She teaches you the restored Spirit Specialty.

Rewards
Journal Unlock

Forgotten Treatise I

History of Early Spirit Disciplines

Spirit Specialty

Frost Lance

Spirit Attack
Ice Element
Medium Spirit Damage
Chance to inflict Freeze
Gameplay Purpose

Effective against:

Fire
Beasts
Burn-vulnerable enemies
Future Desert enemies

(Implemented as: skill id frost-lance, damageType: spirit, bonus damage vs. the coalSpirits enemy
family — the closest existing analogue to "Fire." Does NOT actually inflict Freeze on the enemy —
see Implementation Notes.)
Unlocks

SQ-IM-02 (quest id: embers-beneath-stone)

SQ-IM-02 (quest id: embers-beneath-stone)
Embers Beneath Stone
Story Purpose

Recover a second forgotten manuscript documenting Spirit techniques developed by Lantern Keepers working alongside mountain blacksmiths and forge spirits. Miriam reconstructs the technique, restoring the Flame Spirit Specialty.

Quest Giver

Elias Rowan

Starting Location

Elias Rowan's House – Ash Hallow (locationId: ash-hallow-elias-house)

Quest Summary

After translating the Frostbound Treatise, Miriam notices references to another volume once believed to be part of the same collection.

Unlike the first, this manuscript is thought to have belonged to Keepers who traveled with the miners of Hollow Rail.

Major Quest Flow
Step 1

Speak with Elias Rowan.

Learn of the second manuscript.

Step 2

Travel to Raven Ridge.

Explore the abandoned railway.

Locate an overlooked maintenance tunnel that became accessible after the Coalbound Warden's defeat.

Recover:

The Ember Codex

Step 3

Return to Elias Rowan.

Discuss the manuscript.

He again sends you to Miriam.

Step 4

Deliver the codex to Historian Miriam.

She translates another forgotten discipline.

Step 5

The codex describes Lantern Keepers learning to harness the warmth of forge spirits to burn away corruption rather than consume it.

The knowledge is preserved within the Journal.

Miriam teaches the restored Spirit Specialty.

Rewards
Journal Unlock

Forgotten Treatise II

Forge Spirits of the Iron Mountains

Spirit Specialty

Ember Burst

Spirit Attack
Fire Element
Medium Spirit Damage
Chance to inflict Burn
Gameplay Purpose

Effective against:

Ice
Plant
Frozen enemies
Future Bayou and Frozen Frontier encounters

(Implemented as: skill id ember-burst, damageType: spirit, bonus damage vs. the waterSpirits and
briarSpirits enemy families — the closest existing analogues to "Ice"/"Plant." Does NOT actually
inflict Burn on the enemy — see Implementation Notes.)

Narrative Benefits

These quests accomplish several things:

Give Elias Rowan an ongoing mentoring role after the main story.
Reinforce Historian Miriam as more than a lore NPC—she becomes the keeper and interpreter of forgotten knowledge.
Expand the Journal of Legends with meaningful historical discoveries.
Tie combat progression directly to exploration and world-building.
Naturally teach players about elemental weaknesses before they encounter later regions where Freeze and Burn become strategically important.

Implementation Notes

These decisions were made when cross-checking this doc against the current codebase, and are
recorded here so the doc stays the accurate source of truth:

There is no literal "Ice Element"/"Fire Element" damage-type system in the combat engine today —
only physical, spirit, and lantern damage types exist. Frost Lance and Ember Burst are implemented
as spirit-damage Spirit Arts that carry their elemental identity through their name, description,
and the Freeze/Burn ailment they inflict (both of which already exist and work exactly as
described), plus a bonus-damage relationship against the closest-fitting existing enemy families
(coalSpirits for Frost Lance; waterSpirits and briarSpirits for Ember Burst) rather than a new
elemental-typing mechanic. A true elemental system remains a real option for a future region (per
the "Future Desert enemies" / "Future Bayou and Frozen Frontier" notes above) but is out of scope
for this chain.

The "hidden cache behind the waterfall" and "overlooked maintenance tunnel" are narrative framing
only. Whisper Falls and Raven Ridge are implemented as single flat locations with no sub-areas, and
since this whole quest chain is only offered after the Iron Mountains main story (which already
gates access to both locations) has been completed, no additional mechanical gating is needed. Each
is a normal world-item pickup, the same pattern used by existing fragment quest items.

The ailment system in this game is one-directional today — only the player can be inflicted with
an ailment (by an enemy's attack), and there is no mechanism for a player skill to inflict an
ailment on an enemy. So while Frost Lance and Ember Burst are still themed around Freeze/Burn (via
their name, description, and the enemy-family effectiveness bonus above), they do **not** actually
inflict Freeze/Burn on the enemy in combat — they're pure damage. A real enemy-ailment system
(frozen enemy skips its turn, burned enemy takes damage-over-time, etc.) is a legitimate future
combat-engine project, but is out of scope for this quest chain.