# PixelLab Asset IDs

Tracks the pixellab.ai account's own `character_id`/`object_id` UUIDs for every character/object
that exists in the linked pixellab account, so a later update (regenerate an animation, add a
direction, tweak a pose) can target the existing asset instead of starting over. Not the same as
`src/assets/registry.ts`'s asset ids (e.g. `sprite.npc.nell-ashby`) - this maps a registry id to
the *pixellab-side* id that produced it.

These ids live only in pixellab's own account (see `list_characters`/`list_objects`/
`get_character`/`get_object`) - this file is a local index into that, not a copy of the art itself.
Covers **every** character in the account, not just ones generated via the MCP server directly -
several predate MCP access (created through the pixellab.ai website UI during this project's
manual-workflow phase) but are the same account and just as targetable for a future update.

## Characters (NPCs, player skins)

| Registry id | Name | pixellab character_id | Generated via |
|---|---|---|---|
| `sprite.npc.elias-rowan` | Elias Rowan | `f9dfff58-943e-4e7c-95b4-879b1c0154cc` (regenerated via MCP, same reason as Finn Rowan below; original `9c51e8c3...` was website pre-MCP) | MCP |
| `sprite.npc.finn-rowan` | Finn Rowan | `e8bd959b-4c16-473c-92a8-01474ffae07f` (regenerated via MCP - the original `19a7f47e...` didn't match the newer MCP-generated NPCs' consistent style; first regen attempt `a0458c7f...` failed - server load) | MCP |
| `sprite.npc.mara-ash` | Mara Ash | `934b31c4-319a-4fd1-b946-22fae72bd7b1` (regenerated via MCP, same reason as Finn Rowan; original `4e7b01ac...` was website pre-MCP) | MCP |
| `sprite.npc.silas-flint` | Silas Flint | `6645aace-bba8-40e4-8f29-a4ad6dd1cd35` (regenerated via MCP, same reason as Finn Rowan; original `2e105e5b...` was website pre-MCP) | MCP |
| `sprite.npc.juniper-reed` | Juniper Reed | `f64ce8c3-11de-494e-ac88-36dfdc532edd` | MCP |
| `sprite.npc.nell-ashby` | Nell Ashby | `b5355df5-33f9-4889-8ac1-e8cf0b33f190` | MCP |
| `sprite.npc.aldren-stone` | Aldren Stone | `9a684c31-804b-4bbf-a6a1-3a9a070e642e` | MCP |
| `sprite.npc.hunter-garrick` | Hunter Garrick | `f5177b41-96fa-4c47-892a-27d52fe92d4e` | MCP |
| `sprite.npc.tessa-ironhand` | Tessa Ironhand | `9489cfe1-f029-4da8-8442-4ef018904add` | MCP |
| `sprite.npc.spirit-child` | Spirit Child | `5a3e5664-a810-43f1-aa9f-533a42a21801` (chibi proportions, regenerated after `fa3701f7...` read as a generic adult rather than a glowing child-spirit) | MCP |
| `sprite.npc.willow-briar` | Willow Briar | `f75d44e5-e42d-4d49-9a9a-43c6bb8f627a` | MCP |
| `sprite.player.male` | Male player skin | `97fdbc5d-841b-483e-9fa8-0f287dc630a8` | website (pre-MCP) |
| `sprite.player.female` | Female player skin | `ec7ecd8c-2ec8-4fb7-a16c-62924606dcc5` | website (pre-MCP) |
| `sprite.npc.ranger-caleb` | Ranger Caleb | `00229b8e-3874-4aed-a190-533ce692e267` (regenerated - original `78831885...` was generated without race specified in the prompt and came back white; Ranger Caleb is Black) | MCP |
| `sprite.npc.historian-miriam` | Historian Miriam | `808a6c9f-b361-4cf1-8ade-a1b7db0c05b6` (first attempt `e36323eb...` failed - server load) | MCP |
| `sprite.npc.mayor-eleanor-ashcroft` | Mayor Eleanor Ashcroft | `821b4aef-10e6-4cbc-8f83-5f974861bd54` (first attempt `931c7421...` failed - server load) | MCP |
| `sprite.player.base.male.white-dark` | Player Base Male (white, dark hair) | `80f01fd7-0635-4b92-9844-f366f3f05027` (first attempt `aa9fbbe8...` failed - server load). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |
| `sprite.player.base.female.white-dark` | Player Base Female (white, dark hair) | `9bb1dce8-9193-4f4b-b0ab-d2e971fd3468` (first attempt `7d3be856...` failed - server load). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |
| `sprite.player.base.male.black-dark` | Player Base Male (Black, dark hair) | `af58c383-1d6f-402e-bb48-764907ce0bb0` (first attempt `c8001319...` failed - server load). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |
| `sprite.player.base.female.black-dark` | Player Base Female (Black, dark hair) | `892ba84d-cbf4-4e59-8768-93975053d1b7` (first attempt `4f387151...` failed - server load). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |
| `sprite.player.base.male.white-blonde` | Player Base Male (white, blonde hair) | `9c59fc25-82e5-43ad-b29a-4d513f46a00e` (first attempt `32a6d2f3...` failed - server load). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |
| `sprite.player.base.female.white-blonde` | Player Base Female (white, blonde hair) | `809133bd-241a-46c9-b6d8-1d96dba316e0` (2 earlier attempts `aaead5a7...`/`d01bfdd4...` both failed - server load). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |
| `sprite.player.base.male.asian-dark` | Player Base Male (Asian, dark hair) | `bdcacd02-06b7-494b-895e-2d9cd5cbef43` (first attempt `19f1f5eb...` failed - server load). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |
| `sprite.player.base.female.asian-dark` | Player Base Female (Asian, dark hair) | `e0c9946d-9e1c-44a9-8ca1-ac63711e152d` (first attempt `162490ca...` failed - server load; walking's east direction also needed one retry after a transient worker-connection failure). walking-4-frames + running-4-frames both complete. Registered and built - see registry.ts. | MCP |

## Characters (enemies)

| Registry id | Name | pixellab character_id | Generated via |
|---|---|---|---|
| `battle.enemy.mothling` | Mothling | `bf67b946-0052-4d1f-b6d9-9d382df68dcb` | website (pre-MCP) |
| `battle.enemy.greater-mothling` | Greater Mothling | `e9f9b334-e835-4f19-9e44-d2ae43375976` | website (pre-MCP) |
| `battle.enemy.restless-miner` | Restless Miner | `0992614c-af8c-4feb-96ad-ea86d95e38a9` | website (pre-MCP) |
| `battle.enemy.foreman-wraith` | Foreman Wraith | `1789b4e5-563c-4e28-be1f-aa9551f3ea7d` | website (pre-MCP) |
| `battle.enemy.coal-spirit` | Coal Spirit | `c8d441e3-ab56-4c8d-b3ed-0b6cce5ea224` | website (pre-MCP) |
| `battle.enemy.coal-wraith` | Coal Wraith | `95e2a3ec-f0a6-4df1-a73c-b7821d16dc93` | website (pre-MCP) |
| `battle.enemy.cliff-wolf` | Cliff Wolf | `18609137-d0cc-4e92-9f5a-5f6e0d4cf92c` | website (pre-MCP) |
| `battle.enemy.ridge-hawk` | Ridge Hawk | `d6f6a5fb-0391-4fac-97c9-642884a20f70` | website (pre-MCP) |
| `battle.enemy.pool-wisp` | Pool Wisp | `cf2f4bfd-1d1e-48dc-ab5e-4f1bdea958c5` | website (pre-MCP) |
| `battle.enemy.falls-siren` | Falls Siren | `d6ca3aa8-dd0b-4913-a09c-f3e2fb73db2c` | website (pre-MCP) |
| `battle.enemy.briar-wraith` | Briar Wraith | `20a21f2d-2abd-4267-8ee2-cd96de8422ca` | website (pre-MCP) |
| `battle.enemy.cemetery-shade` | Cemetery Shade | `0852bdf2-4c6d-4978-b639-2252b017eab2` | website (pre-MCP) |
| `battle.enemy.coalbound-warden` | The Coalbound Warden (boss) | `1660ee75-d976-4bc0-8d93-697fc08ea799` | website (pre-MCP) |

## Characters (Crimson Bayou NPCs, Volume II)

Regenerated once during Phase 4.5's aspect-ratio/resolution remediation - ids below are the
CURRENT (larger, correctly-proportioned) generation, not the original half-size ones. This table
was missing entirely until that regeneration pass required looking every one of these back up by
name via `list_characters` paging (no name filter exists), so recording them now for next time.

| Registry id | Name | pixellab character_id | Generated via |
|---|---|---|---|
| `sprite.npc.mayor-celeste-broussard` | Mayor Celeste Broussard | `5b3dc498-cf96-4c19-b715-5c56d57cba76` | MCP |
| `sprite.npc.lucien-boudreaux` | Lucien Boudreaux | `ba1d5096-e42d-4d95-9d46-f5798a380691` | MCP |
| `sprite.npc.marsh-spirit` | Marsh Spirit | `4011989f-be9f-4196-bba7-8fc2ec0066d8` | MCP - roams (wanderRadius), so also has a walking-4-frames animation (4 directions) on top of the idle loop, same as the Iron Mountains NPC_WALK_ASSET_IDS set. |
| `sprite.npc.sabine-thorne` | Warden Sabine Thorne | `9508284c-9d66-469f-9b3b-a02b5642069a` | MCP - roams, same walking-4-frames addition as Marsh Spirit above. |
| `sprite.npc.armorer-delphine` | Armorer Delphine | `6a8d2f46-343f-4fff-bd6d-53ce91474fa9` | MCP |
| `sprite.npc.herbalist-noelle` | Herbalist Noelle | `90c1caf5-1d20-40a9-97e8-85fd5d9f5e3a` | MCP |
| `sprite.npc.innkeep-odette` | Innkeep Odette | `0f35bd3e-62b2-4552-8c5d-e65673ddcfb2` | MCP |
| `sprite.npc.merchant-remy` | Merchant Remy | `286eca70-8734-415b-b665-40683f38517f` | MCP |
| `sprite.npc.blacksmith-toussaint` | Blacksmith Toussaint | `49217e7a-2a65-4f12-9e89-f51c2da6a9a1` | MCP |

## Characters (Crimson Bayou enemies, Volume II)

| Registry id | Name | pixellab character_id | Generated via |
|---|---|---|---|
| `battle.enemy.marsh-crocodile` | Marsh Crocodile | `0a031680-e9d8-4f64-890a-f3ca3ec54f23` | MCP |
| `battle.enemy.bog-ravager` | Bog Ravager | `833f257e-cc40-4b11-99f7-6a8bd9594151` | MCP |
| `battle.enemy.bog-hag` | Bog Hag | `4a2d7920-9964-4d67-b7fc-0e024fc48719` | MCP |
| `battle.enemy.cypress-witch` | Cypress Witch | `4eecc112-e63c-40a8-bb3f-887d41260a1f` | MCP |
| `battle.enemy.rougarou-stalker` | Rougarou Stalker | `8edf2706-d3b8-488f-b3f0-3ec1bf6fef71` | MCP |
| `battle.enemy.alpha-rougarou` | Alpha Rougarou | `615544d4-e571-49b4-964b-cc2c9f22f3c1` | MCP |
| `battle.enemy.ancient-serpent-guardian` | Ancient Serpent Guardian (boss) | `a51adeef-e467-45a8-83f6-2ea48a11b37b` | MCP |

## Discarded/failed generations (not used by any registry entry)

| pixellab character_id | Note |
|---|---|
| `55c837d3-1f95-41f0-ae49-5c9ab4bedf7c` | Failed duplicate Silas Flint attempt (96x128) - superseded by `2e105e5b...` above |
| `8425810e-dc38-4594-8617-895e5b7c2e23` | Failed duplicate player-skin attempt (48x64) - superseded by the male/female entries above |

## Objects (icons/equipment/items)

`create_map_object` outputs (currency/ailment/item icons) are NOT tracked here - they're
single-shot static images with no further-editable identity on pixellab's side, so there's nothing
meaningful to look back up (unlike a `create_character`/`create_1_direction_object` "object",
which persists and can be re-animated/state-varied later). See each icon's own registry.ts note
for its generation settings instead.

`create_1_direction_object`/`create_8_direction_object` outputs (real animated/stateful objects):

| Registry id | Name | pixellab object_id | Notes |
|---|---|---|---|
| `structure.chest` | Chest (closed) | `c369b6ce-e9c7-4fcf-9912-8273dae52025` | Has a pulsing-glow animation (group `a32ecdb0-1f2c-42ae-8785-b5fb7a45c9ba`) - see `animate_object`. Source review batch (4 candidates) was `85bfcb60-38e1-4b55-83df-62a6c59cd294`. |
| `structure.chest-open` | Chest (open) | `1825b0b9-bc88-4772-86cb-d02ad42a68a6` | A `create_object_state` variant of the closed chest above - same body/palette, lid open, no glow. |
Equipment icons are planned to eventually become directional walk/run sheets layered on the player
sprite (visible equipment) - when that starts, the player base sprite will need regenerating as an
"underwear" base body first, and equipment objects generated from *that* base's actual frames
(v3 mode's reference_image_base64 rotate, not independent generation) so every layer stays
pixel-aligned to the body across all 8 walk/run frames.

## Notes

- Every character generated this way is also documented per-asset in `src/assets/registry.ts`'s own
  `notes` field (generation method, source frame size, build script) - this file exists for the one
  thing those notes don't carry: the actual id needed to call back into pixellab for that specific
  character.
- `list_characters`/`get_character` is the live source of truth - if this file and pixellab's own
  account ever disagree (a character renamed/deleted directly in pixellab), trust pixellab and
  update this file, not the other way around.
