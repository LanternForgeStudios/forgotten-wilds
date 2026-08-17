"one map per region," but as a hierarchy of Region → Town → Overworld → Points of Interest → Interior Maps → Dungeons. This creates a world that feels much larger while keeping development manageable.

For an MVP, I'd aim for 6 major regions, 6 towns, 15–20 overworld maps, and roughly 40–50 explorable maps (including interiors). That gives you a complete world that can easily grow over time.

Forgotten Wilds - World Structure v1
Continent: Mytherra
Mytherra
│
├── Iron Mountains
├── Crimson Bayou
├── Endless Prairie
├── Whispering Pines
├── Shattered Desert
└── Frozen Frontier

Each region contains:

1 Primary Town
2–4 Overworld Areas
1 Main Dungeon
Several smaller locations
Interior maps

This mirrors the structure of classic JRPG world design.

1. Iron Mountains (Starting Region)

Theme
Appalachian folklore, abandoned mining communities, haunted forests.

Primary Town
Ash Hallow

The first Lantern Keeper settlement.

Contains (implemented names, as shipped):

Elias Rowan's House (was "Lantern Keeper Hall" in the original brief)
The Ash Hallow Inn (Juniper Reed, innkeeper)
Mara Ash's General Store
The Ash Hallow Forge (was "Blacksmith" - Aldren Stone, blacksmith)
The Ash Hallow Armory (Tessa Ironhand, armorer)
Willow's Apothecary (was "Apothecary")
Ash Hallow Town Hall (was "Mayor's House" - Mayor Eleanor Ashcroft)
The Ash Hallow Archive (was "Historian's Cabin" - Historian Miriam)
The Mine Office (Silas Flint, foreman)
Town Shrine (implemented as an interactable within the main Ash Hallow map itself, not a
  separate location/map - was "Lantern Shrine" in the original brief)
Player Housing District (future) - not yet implemented, kept for later side-quest content
Town Square - not yet implemented as its own location, kept for later side-quest content

Other Ash Hallow NPCs not yet tied to a shop/quest hook above: Finn Rowan (Elias's nephew, lore)
and Nell Ashby (folklore collector, side-quest giver for the-lost-expedition/embers-that-never-faded).

Interior Maps (implemented names)
The Ash Hallow Inn
The Ash Hallow Forge
Mara Ash's General Store
The Ash Hallow Armory
Elias Rowan's House
Ash Hallow Town Hall
The Ash Hallow Archive
The Mine Office
Overworld Areas
Ironwood Trail

Starter forest.

Subareas:

Mossy Creek
Hunter's Camp
Fallen Watchtower
Spirit Grove
Old Stone Bridge
Raven Ridge

Rocky mountain paths.

Subareas:

Cliff Pass
Abandoned Rail Line
Eagle Overlook
Moon Witch Circle
Whisper Falls

Waterfall region.

Subareas:

Lower Falls
Hidden Cave
Lantern Pools
Ancient Stair
Black Briar Forest

Dense haunted woods.

Subareas:

Forgotten Cemetery
Hollow Tree
Spirit Clearing
Fog Marsh
Main Dungeon
Hollow Rail Mine

Sections:

Mine Entrance
Upper Shafts
Flooded Tunnels
Crystal Caverns
Coal Spirit Nest
Forgotten Shrine
Boss Chamber

Boss:

Coalbound Warden

2. Crimson Bayou
Primary Town
Mirehaven

A bustling river settlement built on stilts.

Buildings:

Inn
Blacksmith
General Store
Armory
River Market
Herbalist
Fisherman's Guild
Spirit Chapel
Overworld Areas
Cypress Marsh
Fishing Docks
Moss Islands
Crocodile Nest
Witch Tree
Murkwater Trails
Broken Ferry
Spirit Pools
Sunken Cabin
Serpent Fen
Giant Cypress
Ruined Village
Fog Crossing
Main Dungeon

Temple of the Deep Current

Sections:

Flood Gate
Ancient Chambers
Serpent Sanctuary
Spirit Vault

Boss:

Ancient Serpent Guardian

3. Endless Prairie
Primary Town
Highwind Crossing

A frontier town surrounded by endless grasslands.

Buildings:

Inn
Blacksmith
General Store
Armory
Trading Post
Stable
Spirit Lodge
Overworld Areas
Golden Plains
Buffalo Herd
Prairie Flowers
Old Windmill
Sacred Hills
Stone Rings
Vision Hill
Spirit Fire
Rolling Grasslands
Nomad Camp
Ancient Totems
Prairie Lake
Main Dungeon

Thunderbird Mesa

Sections:

Canyon Path
Sky Bridge
Storm Cavern
Summit Temple

Boss:

Thunderbird

Implementation Notes (Chapter 5, shipped): this section's granular "Overworld Areas" list disagreed
with `Mytherra-MSQ_breakdown.md`'s own "Primary Maps" for Chapter 5 ("Where the Sky Meets the
Earth") - this doc named 12 separate areas for the whole region, the MSQ doc named 5 maps for
Chapter 5 alone. Resolved the same way Iron Mountains' Mossy Creek/Fallen Watchtower are landmarks
*within* Ironwood Trail rather than separate maps: the MSQ doc's 5 Primary Maps became the actual
shipped `Location` entries (Highwind Crossing town + Golden Prairie, Spirit Herd Plains, Sacred
Hills, Stone Circle Valley field maps), and this list's extra names became landmarks/interactables
within them - `Buffalo Herd` and `Stone Rings` in particular are the literal in-game interactable
refIds now (`spirit-herd-plains`/`stone-circle-valley` respectively), not separate locations.
`Thunderbird Mesa Approach` is a 6th field map, added beyond this doc's own list, serving as
Chapter 5's closing destination (MSF-EP-005) and the physical hand-off point to Chapter 6's
Thunderbird Mesa dungeon. Town building list: `Trading Post`/`Stable` weren't built as their own
interiors for Chapter 5 (no NPC/mechanic needed one yet) - `Spirit Lodge` and a `Chief's Lodge`
(this doc didn't name a leader's building; added to house Chief Aiyana Whitefeather, matching every
other region's leader-gets-a-hall convention) cover the recurring cast instead.

Implementation Notes (Chapter 6, shipped): Thunderbird Mesa is now built - 5 chained `Location`
entries (`kind: 'dungeon'`), one per `Mytherra-MSQ_breakdown.md`'s own Chapter 6 "Primary Maps"
(Summit Temple, Sky Bridge, Storm Galleries, Lantern Sanctuary, Guardian Peak), linked by
transition/spawnPoint pairs the same way field maps already chain. This doc's own "Sections" list
above (Canyon Path, Sky Bridge, Storm Cavern, Summit Temple) disagreed with the MSQ doc's 5-room
list the same way Chapter 5's Location doc/MSQ doc disagreed - resolved the same way: the MSQ doc's
Primary Maps became the real shipped rooms. "Canyon Path" is effectively covered by
Thunderbird Mesa Approach (Chapter 5's own field map, already serving as the approach); "Storm
Cavern" became "Storm Galleries." No precedent existed anywhere in this codebase for a
multi-room dungeon before this (both Iron Mountains' Hollow Rail Mine and Crimson Bayou's Temple of
the Deep Current are a single map/Location each) - the chaining machinery itself is fully generic,
just applied to a dungeon interior for the first time. Reuses `tileset.tiny-dungeon` (same generic
interior tileset as both prior dungeons) rather than commissioning new "sky temple" art.

4. Whispering Pines
Primary Town
Cedarwatch

A logging and spiritual community among giant trees.

Buildings:

Inn
General Store
Blacksmith
Armory
Woodworker
Ranger Lodge
Great Tree Library
Overworld Areas
Elder Forest
Fallen Giant
Moss Valley
Hidden Grove
Mistwood
Mist Bridge
Ancient Cedar
Spirit Pools
Silver River
Rapids
Fishing Camp
Water Shrine
Main Dungeon

Heartwood Sanctuary

Sections:

Root Tunnels
Spirit Garden
Ancient Canopy
Sacred Core

Boss:

Ancient Cedar Guardian

Implementation Notes (Chapter 7, shipped): same doc-drift pattern as every prior region - this
section's "Overworld Areas" (Elder Forest with Fallen Giant/Moss Valley/Hidden Grove; Mistwood with
Mist Bridge/Ancient Cedar/Spirit Pools; Silver River with Rapids/Fishing Camp/Water Shrine) disagreed
with `Mytherra-MSQ_breakdown.md`'s own 6 Chapter 7 Primary Maps (Cedarwatch, Mistwood Path, Elder
Forest, Silver River, Ancient Cedar Shrine, Heartwood Approach). Resolved the same way: the MSQ doc's
Primary Maps became the real shipped `Location` entries; this doc's sub-area names (Mist Bridge,
Fallen Giant, Water Shrine, etc.) were not built as separate landmarks this pass - none of Chapter
7's own quests needed one individually. Town building list: `Woodworker`/`Ranger Lodge` weren't built
as their own interiors (Forest Warden Corwin Hart wanders Cedarwatch's town square instead, matching
Scout Niska's own precedent in Highwind Crossing) - `Elder's Lodge`/`Great Tree Library` cover the
recurring cast, matching every other region's leader/historian-gets-a-hall convention.

Implementation Notes (Chapter 8, shipped): Heartwood Sanctuary is now built - 4 chained `Location`
entries (`kind: 'dungeon'`), one per `Mytherra-MSQ_breakdown.md`'s own Chapter 8 Primary Maps (Root
Caverns, Inner Archive, Lantern Sanctuary, Guardian Grove), linked the same way Thunderbird Mesa's 5
rooms chain. This doc's own "Sections" (Root Tunnels, Spirit Garden, Ancient Canopy, Sacred Core) and
boss name ("Ancient Cedar Guardian") disagreed with the MSQ doc the same way Chapter 6's Location
doc/MSQ doc disagreed - resolved the same way: the MSQ doc's Primary Maps and its own boss name
("Cedar Giant") won. The Lantern Sanctuary room is `heartwood-lantern-sanctuary` in code (not the
plain `lantern-sanctuary` id), since Thunderbird Mesa's own Chapter 6 room already owns that id.
Reuses `tileset.tiny-dungeon`, same as every dungeon before it.

5. Shattered Desert
Primary Town
Red Mesa

Built into canyon cliffs.

Buildings:

Inn
Blacksmith
General Store
Armory
Observatory
Caravan Office
Relic Museum
Overworld Areas
Sunfire Dunes
Oasis
Buried Ruins
Sandstorm Pass
Crimson Canyons
Rope Bridges
Cliff Trails
Hidden Tomb
Painted Mesas
Spirit Stones
Ancient Road
Crystal Cavern
Main Dungeon

Forgotten Observatory

Sections:

Astral Library
Star Chamber
Celestial Engine
Summit

Boss:

The Canyon Giant

Implementation Notes (Chapter 9, shipped): same doc-drift pattern as every prior region - this
section's "Overworld Areas" (Sunfire Dunes with Oasis/Buried Ruins/Sandstorm Pass; Crimson Canyons
with Rope Bridges/Cliff Trails/Hidden Tomb; Painted Mesas with Spirit Stones/Ancient Road/Crystal
Cavern) disagreed with `Mytherra-MSQ_breakdown.md`'s own 6 Chapter 9 Primary Maps (Red Mesa, Sunfire
Dunes, Crimson Canyons, Painted Mesas, Celestial Oasis, Forgotten Observatory Approach) - notably
this doc's "Oasis" (a sub-area of Sunfire Dunes) became the MSQ doc's own standalone "Celestial
Oasis" Primary Map instead, the same way Sacred Hills/Ancient Cedar Shrine became their own Primary
Maps in earlier regions rather than staying landmarks. Resolved the same way as always: the MSQ
doc's Primary Maps became the real shipped `Location` entries; this doc's sub-area names weren't
built as separate landmarks this pass. Town building list: `Observatory` and `Caravan Office`
weren't built as their own interiors (Desert Ranger Tomas Vega wanders Red Mesa's town square
instead, matching Scout Niska/Forest Warden Corwin Hart's own precedent; the "Observatory" building
name refers to the Forgotten Observatory dungeon itself, not a separate Red Mesa structure) -
`The Elder's Hall`/`Relic Museum` cover the recurring cast, matching every other region's leader/
historian-gets-a-hall convention.

Implementation Notes (Chapter 10, shipped): the dungeon's 4 "Sections" listed above (Astral
Library, Star Chamber, Celestial Engine, Summit) don't map one-to-one onto the 5 rooms actually
built - this doc's own list is a summary, not a room-by-room spec, the same gap found in every
prior dungeon chapter (Root Caverns, Guardian Grove, etc.). Shipped as 5 rooms mirroring Chapter
6's own Great Thunderbird dungeon shape: Inner Observatory (entry, roughly this doc's "Astral
Library"), Star Chamber (name matches directly), Star Lantern Sanctuary (the Keeper's lantern
room - this doc doesn't call one out separately, but every prior dungeon has one), Canyon Depths
(roughly this doc's "Celestial Engine"), and Guardian Summit (boss room, this doc's "Summit").
Boss name matches exactly ("The Canyon Giant" here, `canyon-giant` as the shipped id/display name
"Canyon Giant").

6. Frozen Frontier
Primary Town
Frosthaven

A fortified settlement beneath the aurora.

Buildings:

Inn
Blacksmith
General Store
Armory
Hunter Lodge
Ice Chapel
Explorer Headquarters
Overworld Areas
Snowveil Forest
Frozen Creek
Wolf Den
Aurora Clearing
Glacier Pass
Ice Bridge
Frozen Falls
Avalanche Trail
White Tundra
Mammoth Graveyard
Spirit Stones
Northern Lights Plateau
Main Dungeon

Hall of Eternal Winter

Sections:

Ice Caves
Frozen Cathedral
Crystal Hall
Frozen Throne

Boss:

The Wendigo King

Implementation Notes (Chapter 11, shipped): same doc-drift pattern as every prior region - this
section's "Overworld Areas" (12 named sub-areas: Snowveil Forest, Frozen Creek, Wolf Den, Aurora
Clearing, Glacier Pass, Ice Bridge, Frozen Falls, Avalanche Trail, White Tundra, Mammoth Graveyard,
Spirit Stones, Northern Lights Plateau) disagreed with `Mytherra-MSQ_breakdown.md`'s own 6 Chapter 11
Primary Maps (Frosthaven, Snowveil Forest, Frozen River, Glacier Pass, Aurora Basin, Hall of Eternal
Winter Approach) - notably this doc's "Frozen Creek" became the MSQ doc's own "Frozen River" and
this doc's "Aurora Clearing" became the MSQ doc's own "Aurora Basin," the same rename pattern seen
in every prior region. Resolved the same way as always: the MSQ doc's Primary Maps became the real
shipped `Location` entries; this doc's other 9 sub-area names (Wolf Den, Ice Bridge, Frozen Falls,
Avalanche Trail, White Tundra, Mammoth Graveyard, Spirit Stones, Northern Lights Plateau) weren't
built as separate landmarks this pass, though "Wolf Den" informed the Frost Wolves enemy family's
own flavor. Town building list: `Hunter Lodge` wasn't built as its own interior - Captain Astrid
Frost wanders Frosthaven's town square instead, matching Scout Niska/Forest Warden Corwin Hart/Desert
Ranger Tomas Vega's own precedent. `Explorer Headquarters`/`Ice Chapel` cover the recurring cast,
matching every other region's leader/historian-gets-a-hall convention. This doc's own boss name
("The Wendigo King") differs from the MSQ doc's ("Winter Stag") - the MSQ doc's name wins per the
standing rule, and it carries real narrative weight there (the only Guardian holding the complete,
unbroken memory of the Great Silence) that "Wendigo King" doesn't reflect, so this is treated as a
straightforward stale-name fix rather than a deliberate rename requiring its own note. Chapter 11's
own MSF-FF-004 ends at the Hall of Eternal Winter's own approach map, not inside the dungeon itself -
the dungeon interior (Ice Caves/Frozen Cathedral/Crystal Hall/Frozen Throne per this doc, plus the
Winter Stag boss fight) is Chapter 12's own build, matching the exact chapter-pair split already used
3 times (Chapters 5/6, 7/8, 9/10).

Implementation Notes (Chapter 12, shipped): the dungeon's 4 "Sections" listed above (Ice Caves,
Frozen Cathedral, Crystal Hall, Frozen Throne) don't map one-to-one onto the 5 rooms actually built,
the same summary-not-spec gap found in every prior dungeon chapter. Shipped as 5 rooms mirroring the
established multi-room dungeon shape: Hall of Eternal Winter (entrance, roughly this doc's "Ice
Caves"), Lantern Sanctuary (the Keeper's lantern room - MSF-FF-005, this doc doesn't call one out
separately, but every prior dungeon has one), Guardian Chamber (roughly this doc's "Frozen
Cathedral"), Summit of Winter (boss room, roughly this doc's "Frozen Throne"), and Hall of Memories
(the Complete Memory beat, MSF-FF-007 - this doc's own "Crystal Hall" is the closest analog, though
the MSQ doc's own Chapter 12 Primary Maps list this room by its actual narrative name instead). Boss
name matches exactly per the Chapter 11 note above ("Winter Stag" everywhere it's shipped). MSF-FF-008
"A New Dawn" (Book One's own finale) takes place entirely at Ash Hallow, not in this dungeon - no
new location needed there, `ash-hallow` has existed since Volume I.

World Progression
Ash Hallow
    │
Ironwood Trail
    │
Raven Ridge
    │
Whisper Falls
    │
Black Briar Forest
    │
Hollow Rail Mine
    │
═══════════════════════
Crimson Bayou
═══════════════════════
Mirehaven
    │
Cypress Marsh
    │
Murkwater Trails
    │
Serpent Fen
    │
Temple of the Deep Current
═══════════════════════
Endless Prairie
═══════════════════════
Highwind Crossing
    │
Golden Plains
    │
Sacred Hills
    │
Rolling Grasslands
    │
Thunderbird Mesa
═══════════════════════
Whispering Pines
═══════════════════════
Cedarwatch
    │
Elder Forest
    │
Mistwood
    │
Silver River
    │
Heartwood Sanctuary
═══════════════════════
Shattered Desert
═══════════════════════
Red Mesa
    │
Sunfire Dunes
    │
Crimson Canyons
    │
Painted Mesas
    │
Forgotten Observatory
═══════════════════════
Frozen Frontier
═══════════════════════
Frosthaven
    │
Snowveil Forest
    │
Glacier Pass
    │
White Tundra
    │
Hall of Eternal Winter