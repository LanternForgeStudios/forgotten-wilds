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