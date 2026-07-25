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

| `sprite.npc.ranger-caleb` | Ranger Caleb | `78831885-de76-447f-a776-79d2fc54fe7f` | MCP |
| `sprite.npc.historian-miriam` | Historian Miriam | `808a6c9f-b361-4cf1-8ade-a1b7db0c05b6` (first attempt `e36323eb...` failed - server load) | MCP |
| `sprite.npc.mayor-eleanor-ashcroft` | Mayor Eleanor Ashcroft | `821b4aef-10e6-4cbc-8f83-5f974861bd54` (first attempt `931c7421...` failed - server load) | MCP |

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

## Discarded/failed generations (not used by any registry entry)

| pixellab character_id | Note |
|---|---|
| `55c837d3-1f95-41f0-ae49-5c9ab4bedf7c` | Failed duplicate Silas Flint attempt (96x128) - superseded by `2e105e5b...` above |
| `8425810e-dc38-4594-8617-895e5b7c2e23` | Failed duplicate player-skin attempt (48x64) - superseded by the male/female entries above |

## Objects (icons/equipment/items) - none yet

Will list `create_map_object`/`create_object_state` ids here once icon generation starts (see the
Asset-Production-Checklist.md "Icons" section - generate at 128×128, resize to final in-game size).
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
