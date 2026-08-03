think this is the right time to define the canonical equipment database. One change I would make is to not tie equipment progression directly to regions. Instead, each region should introduce gear themed around its environment, while higher tiers from earlier regions remain relevant because of their unique perks. This prevents "Iron Mountains gear becomes trash when you reach the Bayou."

I'd also recommend that Legendary equipment should feel handcrafted and unique, not just larger stat numbers. Every Legendary should have a name, history, and connection to a Guardian, legendary creature, or historical Lantern Keeper.

Equipment Philosophy
Equipment Slots
Weapon
Chest
Legs
Boots
Gloves
Charm
Lantern
Spirit Totem
Core Stats

Every equippable item modifies one or more of:

Max Health (HP)
Max Spirit (SP)
Attack (ATK)
Defense (DEF)
Speed (SPD)

Higher rarity also introduces passive effects, but every item still provides basic stat bonuses.

Rarity Progression
Tier	Primary Source
Common	Merchants, enemy drops, common chests
Uncommon	Better merchants, hidden chests, stronger enemies
Rare	Quest rewards, elite enemies, expensive merchants after story progression
Mythic	Major side quests, shrine restoration, Guardian blessings, optional bosses
Legendary	Main story bosses, Guardian rewards, secret endgame content

Merchant Sourcing by Shop

Each town splits merchant-sold equipment across two services, with no overlap in what each one
stocks:

Blacksmith	Weapon, Charm, Spirit Totem (occasionally other equipables)
Armory	Chest, Legs, Boots, Gloves

Region 1 — Iron Mountains

Theme: Endurance • Memory • Stone

Weapons
Item	Tier	HP	SP	ATK	DEF	SPD
Iron Walking Staff	Common	0	+5	+4	0	0
Miner's Pick	Common	0	0	+5	+1	-1
Ashwood Spear	Uncommon	0	+3	+7	0	+1
Ghostbreaker Hammer	Rare	+10	0	+10	+2	-2
Warden's Maul	Mythic	+20	+5	+16	+5	-2
Memorykeeper's Staff	Legendary	+25	+25	+18	+4	+2
Chest
Item	Tier	HP	SP	ATK	DEF	SPD
Keeper's Coat	Common	+12	0	0	+3	0
Reinforced Vest	Uncommon	+18	0	0	+5	-1
Ghostwoven Cloak	Rare	+20	+8	0	+7	+1
Mountain Guardian Mail	Mythic	+35	+10	+2	+12	-1
Mantle of Enduring Stone	Legendary	+45	+15	+4	+16	+2
Legs
Item	Tier	HP	SP	ATK	DEF	SPD
Keeper's Trousers	Common	+8	0	0	+2	0
Reinforced Leggings	Uncommon	+12	0	0	+3	-1
Ghostwoven Leggings	Rare	+14	+4	0	+4	+1
Mountain Guardian Greaves	Mythic	+22	+6	+1	+7	-1
Greaves of Enduring Stone	Legendary	+28	+9	+2	+9	+2
Boots
Item	Tier	HP	SP	ATK	DEF	SPD
Leather Boots	Common	0	0	0	+1	+2
Trail Boots	Uncommon	0	0	0	+2	+4
Cliffrunner Boots	Rare	0	0	+1	+3	+6
Spiritwalker Boots	Mythic	+5	+5	+2	+4	+8
Echostep Boots	Legendary	+10	+10	+3	+5	+10
Gloves
Item	Tier	HP	SP	ATK	DEF	SPD
Work Gloves	Common	0	0	+1	+1	0
Iron Gloves	Uncommon	+5	0	+2	+2	0
Miner Gauntlets	Rare	+8	0	+4	+4	0
Warden's Grips	Mythic	+12	+4	+6	+5	+1
Hands of the First Keeper	Legendary	+15	+10	+8	+6	+2
Charms
Item	Tier	Primary Effect
River Stone	Common	+5 HP
Lucky Acorn	Uncommon	+2 SPD
Ghost Miner's Coin	Rare	+5 SP
Moon Witch Talisman	Mythic	+8 SP / +3 SPD
Heart of the Mountain	Legendary	+10 HP / +10 SP / +2 All Stats
Lanterns
Lantern	Rarity	Obtained
Lantern of the First Promise	Legendary	Prologue
Lantern of Enduring Embers	Legendary	Hollow Rail Mine
Spirit Totems
Totem	Tier	Effect
Stone Wolf Totem	Rare	+ATK
Coal Spirit Totem	Mythic	+DEF
Mountain Guardian Totem	Legendary	Balanced bonus
Region 2 — Crimson Bayou

Theme: Spirit • Water • Transformation

Equipment emphasizes:

Spirit
Speed
Status resistance

Examples:

Cypress Cane
Rougarou Fang Blade
Bayou Robes
Mosswalker Boots
Wisp Charm
Mother Cypress Totem
Lantern of Still Waters
Region 3 — Endless Prairie

Theme: Freedom • Wind • Travel

Equipment emphasizes:

Speed
Critical strikes
Balanced offense

Examples:

Prairie Spear
Thunderbird Bow
Buffalo Hide Coat
Windrunner Boots
Sky Charm
White Buffalo Totem
Lantern of Open Skies
Region 4 — Whispering Pines

Theme: Wisdom • Nature

Equipment emphasizes:

Spirit
Defense
Healing

Examples:

Cedar Staff
Ancient Bark Armor
Rootwalk Boots
Cedar Charm
Cedar Giant Totem
Lantern of Ancient Roots
Region 5 — Shattered Desert

Theme: Truth • Sun • Stars

Equipment emphasizes:

Attack
Spirit
High-risk offense

Examples:

Sunblade
Starcaller Staff
Sandwalker Boots
Astral Charm
Canyon Giant Totem
Lantern of Forgotten Stars
Region 6 — Frozen Frontier

Theme: Sacrifice • Ice • Endurance

Equipment emphasizes:

Health
Defense
Counterattacks

Examples:

Frost Pike
Winter Keeper Armor
Glacier Boots
Aurora Charm
Winter Stag Totem
Lantern of Winter's Resolve
One recommendation before we fully flesh this out

I think we should avoid designing hundreds of individual items manually. Instead, define equipment families that scale naturally across rarities. For example, in the Iron Mountains:

Walking Staff → Common → Uncommon → Rare → Mythic → Legendary
Keeper's Coat → Common → Uncommon → Rare → Mythic → Legendary
Trail Boots → Common → Uncommon → Rare → Mythic → Legendary

This creates a coherent progression where players recognize an item line evolving in quality and significance, while allowing truly unique Legendary artifacts—such as the Memorykeeper's Staff or Mantle of Enduring Stone—to stand apart as iconic rewards tied to the story. It also makes balancing and future content creation much easier because every new region can introduce its own themed equipment families rather than a disconnected assortment of gear.

I think that's the right decision. In fact, I would go one step further and define this as one of the core design principles of Forgotten Wilds.

**Update (implementation)**: the original single "Armor" slot was split into two — **Chest** (renamed from Armor, same role) and **Legs** (new). Legs carries the same kind of stat bonuses as Chest but at lower magnitude, per the "lower protection than Chest" design used below — every existing Chest family gets a matching Legs family at the same tiers, so region content always ships both together. This document has been updated throughout to reflect the split; treat every table below as canonical for both slots going forward.

Instead of thinking in terms of "items," think in terms of equipment families. This gives the world consistency and makes it much easier to expand for years.

For example, if Version 3.0 introduces a new mountain region, you simply add another equipment family rather than inventing dozens of unrelated items.

Forgotten Wilds Equipment Philosophy
Equipment Families

Equipment is organized into families.

Each family shares:

Visual style
Lore
Theme
Stat progression
Rarity progression

A family generally contains one item for every rarity.

Example:

Ashwood Staff

Common
Uncommon
Rare
Mythic
Legendary

The Legendary version is not simply stronger.

It becomes a named artifact.

Example Family
Walking Staff Family
Tier	Item Name
Common	Weathered Walking Staff
Uncommon	Ironwood Walking Staff
Rare	Spiritwood Walking Staff
Mythic	Elder Ironwood Staff
Legendary	Memorykeeper's Staff

The player immediately recognizes the family.

Chest Family
Keeper's Coat
Tier	Item
Common	Worn Keeper Coat
Uncommon	Reinforced Keeper Coat
Rare	Veteran Keeper Coat
Mythic	Guardian Keeper Coat
Legendary	Mantle of the First Keeper
Legs Family
Keeper's Trousers
Tier	Item
Common	Worn Keeper Trousers
Uncommon	Reinforced Keeper Trousers
Rare	Veteran Keeper Trousers
Mythic	Guardian Keeper Trousers
Legendary	Leggings of the First Keeper
Boots Family
Tier	Item
Common	Traveler Boots
Uncommon	Trail Boots
Rare	Ranger Boots
Mythic	Spiritwalker Boots
Legendary	Echostep Boots
Gloves Family
Tier	Item
Common	Work Gloves
Uncommon	Leather Gauntlets
Rare	Keeper's Gauntlets
Mythic	Spiritbound Gloves
Legendary	Hands of the First Keeper
Charm Family
Tier	Item
Common	River Stone Charm
Uncommon	Mountain Knot
Rare	Ghost Miner's Coin
Mythic	Moon Witch Talisman
Legendary	Heart of the Mountain

Charms are intentionally more unique and less linear than weapons or armor.

Region Themes

Each region introduces one new family per equipment slot.

So the Iron Mountains becomes:

Slot	Family
Weapon	Walking Staff
Chest	Keeper Coat
Legs	Keeper Trousers
Boots	Traveler Boots
Gloves	Work Gloves
Charm	Mountain Charms
Lantern	Mountain Lanterns
Spirit Totem	Mountain Spirits

Then the Crimson Bayou introduces completely different families.

Slot	Family
Weapon	Cypress Cane
Chest	Bayou Vestments
Legs	Bayou Leg-Wraps
Boots	Marsh Boots
Gloves	Mire Gloves
Charm	Swamp Talismans
Lantern	Bayou Lanterns
Totem	Cypress Spirits

Nothing overlaps.

Every region feels distinct.

Legendary Equipment Rule

Legendary items end a family.

They do not continue upgrading.

Example:

Weathered Walking Staff

↓

Ironwood Walking Staff

↓

Spiritwood Walking Staff

↓

Elder Ironwood Staff

↓

Memorykeeper's Staff

That family is now complete.

Future Regions

Every new region only needs to introduce:

One Weapon Family
One Chest Family
One Legs Family
One Boots Family
One Gloves Family
One Charm Family
One Lantern
One Spirit Totem

That's only eight new families per region, keeping content creation manageable while giving each area a distinct identity.

Suggested Master Equipment Catalog (Version 1)

If we use this approach, the base game would include:

Region	Weapon	Chest	Legs	Boots	Gloves	Charm	Lantern	Totem
Iron Mountains	Walking Staff	Keeper Coat	Keeper Trousers	Traveler Boots	Work Gloves	Mountain Charm	2 Lanterns	3 Totems
Crimson Bayou	Cypress Cane	Bayou Vestments	Bayou Leg-Wraps	Marsh Boots	Mire Gloves	Bayou Charm	1 Lantern	3 Totems
Endless Prairie	Prairie Spear	Buffalo Hide	Rider's Chaps	Wind Boots	Rider Gloves	Sky Charm	1 Lantern	3 Totems
Whispering Pines	Cedar Staff	Bark Armor	Root-Woven Leggings	Root Boots	Vine Gloves	Cedar Charm	1 Lantern	3 Totems
Shattered Desert	Sunblade	Nomad Robes	Nomad Leggings	Sand Boots	Dune Wraps	Star Charm	1 Lantern	3 Totems
Frozen Frontier	Frost Pike	Winter Coat	Winter Leggings	Glacier Boots	Fur Gloves	Aurora Charm	1 Lantern	3 Totems

Weapon Types (added later)

Every weapon family above (Walking Staff, Cypress Cane, Prairie Spear, Cedar Staff, Sunblade, Frost
Pike, ...) has always been, in effect, a themed instance of some underlying weapon *silhouette* -
this table's own future-region names already assumed that ("Prairie Spear" is a Spear, "Sunblade"
is a Sword, "Frost Pike" is a Spear/Pike, "Cedar Staff" is a Staff) without the game ever mechanizing
it. This section formalizes that into 5 universal weapon **types**:

Type	Grip
Staff	One-handed, `held-right-hand` anchor (the original type - Walking Staff/Cypress Cane)
Sword	One-handed, `held-right-hand` anchor
Axe	One-handed, `held-right-hand` anchor
Spear	One-handed, `held-right-hand` anchor
Hammer	One-handed (built as a mace/war-pick, not a two-handed maul - see note below), `held-right-hand` anchor

Each type gets exactly **one hand-positioned founder art pass** (male + female), built once and
shared across every region via `palette_swap_equipment_layer.py` - the same technique already used
for the entire Cypress Cane family (itself a palette-swap of the Walking Staff founder) and for
Ironwood Walking Staff. A region's own weapon **family** (the themed name in the catalog table
above) is still one specific type, reskinned with that region's own palette/flavor names and stat
progression - this doesn't change how regions work, it only means "which of the 5 founder
silhouettes does this region's weapon reskin from" is now a real, shared choice instead of every
region inventing (and hand-positioning) its own silhouette from scratch.

**"One new family per region" still holds for every future region** - Endless Prairie still only
gets one new weapon family (Prairie Spear, drawn from the Spear type), not five. The one exception
is a one-time retroactive grant: Iron Mountains and Crimson Bayou were both built before this system
existed and both only ever got a Staff-type family (Cypress Cane is a palette-swap of Walking
Staff's own silhouette) - so both regions retroactively gain their own Sword/Axe/Spear/Hammer
family too, instead of being permanently stuck with only one weapon type while every later region
gets to pick from five. This is called out explicitly as a one-time exception so it doesn't read as
an inconsistency in the "one family per region" rule later.

Future region -> weapon type mapping (so later region work doesn't have to re-derive this from the
catalog table's flavor names):

Region	Named Weapon	Type
Endless Prairie	Prairie Spear	Spear
Whispering Pines	Cedar Staff	Staff
Shattered Desert	Sunblade	Sword
Frozen Frontier	Frost Pike	Spear

Hammer note: a genuinely two-handed weapon has no supporting anchor category in
`docs/Equipment-Layering-Plan.md`'s equipment-layer system today (`held-right-hand`,
`held-left-hand`, `worn-torso`, `paired-feet`, `paired-hands`, `running` - no `held-two-hand`).
Rather than build new anchor-system plumbing for a single weapon type, Hammer is deliberately built
as a one-handed mace/war-pick, staying within the existing `held-right-hand` category like every
other type. A true two-handed weapon remains a real option for a future region if the anchor system
is ever extended to support one, but that's out of scope here.

No combat-engine changes come with this: weapon type has no mechanical footing today (Skills are
granted purely via quest reward and are fully decoupled from whatever weapon is equipped - see
`grantSkillId` in `functions/src/engine/questEngine.ts`), so this entire system is art + equipment-
data only. A "weapon type gates which Skills you can use" mechanic is a real option for later, not
part of this rollout.
