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

Update (later session): an enemy-ailment system now exists. Frost Lance and Ember Burst each have a
30% chance to actually inflict their themed ailment (Freeze / Burn respectively) on an enemy, gated
by that enemy's own `vulnerableAilments` (enemies.ts) - coalSpirits are vulnerable to Freeze,
waterSpirits/briarSpirits to Burn, matching the family-effectiveness pairing above. Rolls against a
non-vulnerable enemy are a harmless no-op, not an error.

The `effectiveAgainstFamilies` bonus-damage relationship described above is still **not** wired up
for these two Skills specifically, though - only a Lantern Ability reads that field today (see
skills.ts's own comment on frost-lance/ember-burst). So the ailment-infliction half of "effective
against X" is real; the bonus-damage half isn't. Player-facing skill descriptions don't promise the
damage bonus, so this isn't a broken promise to players, but it's a real gap between this doc's
"Gameplay Purpose" bullets and actual combat math if the intent is ever revisited - either extend
weakness-bonus handling to Skill actions, or update those bullets to only claim the ailment effect.

Crimson Bayou Side Quest Chain
The Drowned Ledgers

Availability

Begins after completing MSF-CB-010 – The Waters Remember (quest id: the-waters-remember)
Given by Mayor Celeste Broussard
Sequential quest chain (Quest 2 unlocks only after Quest 1 is complete)

SQ-CB-01 (quest id: the-drowned-ledger)
The Drowned Ledger
Story Purpose

Recover a waterlogged ledger from Murkwater Trails, pieced back together page by page from the
silt. Lucien Boudreaux translates it, restoring a Lantern Keeper technique for turning the marsh's
own venom back on its creatures.

Quest Giver

Mayor Celeste Broussard

Starting Location

Mirehaven Town Hall (locationId: mirehaven-town-hall)

Quest Summary

With Mirehaven's memory restored, Mayor Celeste asks the Keeper to help recover pieces of the
town's own written history - not myth this time, but a mundane administrative record the Silence
nearly erased along with everyone's memory of it: the toll-keeper's ledger of who passed through
the marsh roads, and why.

Major Quest Flow
Step 1

Speak with Mayor Celeste Broussard.

Step 2

Travel to Murkwater Trails.

Recover the Drowned Ledger, salvaged from the silt.

Step 3

Return to Mayor Celeste Broussard.

She recognizes the handwriting but can't make out the water-damaged dialect, and sends the Keeper
to Lucien Boudreaux.

Step 4

Deliver the ledger to Lucien Boudreaux at the Mirehaven Archive.

He translates it: before the Great Silence, Lantern Keepers stationed in the marsh distilled a
toxin from bog-nettle and crocodile-bile, turning the swamp's own venom back on its creatures.

The knowledge is added to the Journal of Legends.

He teaches the restored technique.

Rewards
Journal Unlock

The Drowned Ledger: Marsh Rites

Spirit Specialty

Marsh Toxin

Spirit Attack
Poison Element
Medium Spirit Damage
Chance to inflict Poison

Gameplay Purpose

Effective against: swampCrocs (marsh-crocodile, bog-ravager) - genuinely vulnerable to Poison
(enemies.ts's vulnerableAilments), unlike the Iron Mountains Treatise skills' inert
effectiveAgainstFamilies bonus (see Implementation Notes below).

Unlocks

SQ-CB-02 (quest id: the-bogwater-almanac)

SQ-CB-02 (quest id: the-bogwater-almanac)
The Bogwater Almanac
Story Purpose

Recover a second lost volume mentioned in the Drowned Ledger's margins, half-buried in the silt of
Cypress Marsh. Lucien reconstructs a second technique: a reed-song hush that quiets a howl before
it turns into a claw.

Quest Giver

Mayor Celeste Broussard

Starting Location

Mirehaven Town Hall (locationId: mirehaven-town-hall)

Quest Summary

The Drowned Ledger's margins reference a second volume - the Bogwater Almanac - describing older
Lantern Keeper survival technique. Celeste and Lucien both want it recovered before the marsh takes
it back for good.

Major Quest Flow
Step 1

Speak with Mayor Celeste Broussard.

Step 2

Travel to Cypress Marsh.

Recover the Bogwater Almanac from a mossy cypress hollow.

Step 3

Return to Mayor Celeste Broussard.

Step 4

Deliver the almanac to Lucien Boudreaux at the Mirehaven Archive.

He translates a second restored technique: Keepers wove reed-song into a hush that could quiet a
rougarou's howl before it ever turned into a claw.

The knowledge is added to the Journal of Legends.

He teaches the restored technique.

Rewards
Journal Unlock

The Bogwater Almanac: Silence of the Reeds

Spirit Specialty

Hush of the Reeds

Spirit Attack
Medium Spirit Damage
Chance to inflict Silence

Gameplay Purpose

Effective against: rougarou (rougarou-stalker, alpha-rougarou) - genuinely vulnerable to Silence
(enemies.ts's vulnerableAilments).

Narrative Benefits

These quests accomplish several things:

Give Mayor Celeste an ongoing role beyond the MSQ's own dialogue-variant beats.
Reinforce Lucien Boudreaux as the Bayou's own translator/archivist, mirroring Historian Miriam's
role in Iron Mountains.
Expand the Journal of Legends with Bayou-specific historical discoveries.
Give the Bayou its own side-quest-taught Skill pair, matching Iron Mountains' Frost Lance/Ember
Burst precedent instead of leaving that region without one.

Implementation Notes

Mirrors the Forgotten Treatises chain exactly (same collect-item -> giver NPC -> translator NPC ->
grantSkillId + grantLoreId reward shape, zero new engine code). Item ids: drowned-ledger (from
Murkwater Trails, refId drowned-ledger-cache) and bogwater-almanac (from Cypress Marsh, refId
bogwater-almanac-cache) - both new key items, deliberately not reusing ancient-serpent-scale (an
existing boss-loot trophy with no quest tie-in).

Unlike Frost Lance/Ember Burst's effectiveAgainstFamilies (set but never actually read for a
'skill' action - see this doc's Iron Mountains Implementation Notes above), Marsh Toxin and Hush of
the Reeds were deliberately paired with ailments that land on a real vulnerability: swampCrocs are
vulnerable to Poison and rougarou to Silence (enemies.ts's vulnerableAilments). The
effectiveAgainstFamilies field is still set on both (for display/flavor consistency with the
existing Skill shape) but is equally inert for bonus damage - only the ailment-infliction half is
functional, same caveat as the Iron Mountains pair.

Mayor Celeste Broussard's gameplayHook changed from `{ type: 'lore' }` to `{ type: 'questGiver',
questIds: [...] }` to give her this role - not strictly required mechanically (no true "quest
start" gate reads giverNpcId or gameplayHook.type; talkToNpc objectives match on NPC id alone), but
kept for data-model consistency with every other quest-giving NPC in npcs.ts.

The Winter Counts

Availability

Begins after completing MSF-EP-005 – Climbing Thunderbird Mesa (quest id: climbing-thunderbird-mesa)
Given by Chief Aiyana Whitefeather
Sequential quest chain (Quest 2 unlocks only after Quest 1 is complete)

SQ-EP-01 (quest id: the-first-winter-count)
The First Winter Count
Story Purpose

Recover a painted hide, half-buried in the Golden Prairie grass, recording a winter long past.
Elder Koda Running Elk reads its pictographs, restoring a Lantern Keeper technique remembered from
the cold it describes.

Quest Giver

Chief Aiyana Whitefeather

Starting Location

The Chief's Lodge (locationId: highwind-crossing-chiefs-lodge)

Quest Summary

With Chapter 5 complete, Chief Aiyana mentions a painted hide her scouts have seen half-buried out
on the prairie for years, never recovered - plains peoples' own record of hard winters, migrations,
and the figures who stood with the herds through them.

Major Quest Flow
Step 1

Speak with Chief Aiyana Whitefeather.

Step 2

Travel to Golden Prairie.

Recover the Winter Count hide, half-buried in the grass.

Step 3

Return to Chief Aiyana Whitefeather.

She recognizes the pictographs as older than the town itself, and sends the Keeper to Elder Koda.

Step 4

Deliver the hide to Elder Koda Running Elk at the Spirit Lodge.

He reads it: a winter cold enough to freeze the wind itself, remembered by a single painted figure
standing between the herd and the storm - not a hunter, a Lantern Keeper.

The knowledge is added to the Journal of Legends.

He teaches the restored technique.

Rewards
Journal Unlock

The First Winter Count

Spirit Specialty

Winter's Memory

Spirit Attack
Medium Spirit Damage
Chance to inflict Freeze

Gameplay Purpose

Effective against: windSpirits (wind-wisp, storm-wisp) - genuinely vulnerable to Freeze
(enemies.ts's vulnerableAilments).

Unlocks

SQ-EP-02 (quest id: the-second-winter-count)

SQ-EP-02 (quest id: the-second-winter-count)
The Second Winter Count
Story Purpose

Recover a second painted hide, tucked away in Spirit Herd Plains, continuing the story the first
one began. Elder Koda reconstructs a second technique: a controlled burn turned against what
stalks the grass.

Quest Giver

Chief Aiyana Whitefeather

Starting Location

The Chief's Lodge (locationId: highwind-crossing-chiefs-lodge)

Quest Summary

The first hide ends mid-story. Chief Aiyana recalls a second one, seen further out in Spirit Herd
Plains, that scouts always meant to retrieve and never did.

Major Quest Flow
Step 1

Speak with Chief Aiyana Whitefeather.

Step 2

Travel to Spirit Herd Plains.

Recover the second Winter Count hide.

Step 3

Return to Chief Aiyana Whitefeather.

Step 4

Deliver the hide to Elder Koda Running Elk at the Spirit Lodge.

He reads the continuation: the same painted figure, years later, setting a controlled burn ahead of
a wolf pack to save a stranded herd. The hide names them Windwalker - Koda has no record of what
became of them after.

The knowledge is added to the Journal of Legends.

He teaches the restored technique.

Rewards
Journal Unlock

The Second Winter Count

Spirit Specialty

Prairie Wildfire

Spirit Attack
Medium Spirit Damage
Chance to inflict Burn

Gameplay Purpose

Effective against: prairieWolves (prairie-wolf, dire-prairie-wolf) - genuinely vulnerable to Burn
(enemies.ts's vulnerableAilments).

Narrative Benefits

These quests accomplish several things:

Give Chief Aiyana an ongoing role beyond the MSQ's own dialogue-variant beats.
Reinforce Elder Koda Running Elk as the Prairie's own translator/lore-keeper, mirroring Historian
Miriam and Lucien Boudreaux's roles in the prior two regions.
Expand the Journal of Legends with Prairie-specific historical discoveries, and seed a named
figure (Windwalker) who never appears elsewhere in Chapter 5's own content - left open rather than
explained, the same way the two Guardian Memory Fragments per chapter are left for a later payoff.
Give the Prairie its own side-quest-taught Skill pair, matching the Forgotten Treatises/Drowned
Ledgers precedent instead of leaving this region without one.

Implementation Notes

Mirrors the Forgotten Treatises/Drowned Ledgers chains exactly (same collect-item -> giver NPC ->
translator NPC -> grantSkillId + grantLoreId reward shape, zero new engine code). Item ids:
winter-count-hide-i (from Golden Prairie, refId winter-count-hide-i-cache) and winter-count-hide-ii
(from Spirit Herd Plains, refId winter-count-hide-ii-cache) - both new key items.

Winter's Memory and Prairie Wildfire were paired with ailments that land on a real vulnerability
the same way Marsh Toxin/Hush of the Reeds were: windSpirits are vulnerable to Freeze and
prairieWolves to Burn (enemies.ts's vulnerableAilments). effectiveAgainstFamilies is set on both
for display/flavor consistency but is inert for bonus damage, same caveat as every prior
quest-taught Skill.

Chief Aiyana Whitefeather's and Elder Koda Running Elk's gameplayHook.questIds were extended to
include both new quest ids (same data-model-consistency reasoning as Mayor Celeste Broussard's own
change above).