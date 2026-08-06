"""Generates simple procedurally-drawn SVG placeholders (colored gradient panel + text label),
matching the exact style already documented in public/CREDITS.md ("Generated placeholders" section)
and used historically for early portraits/character sprites/icons before real art existed - see
public/assets/sprites/characters/npc-large.svg and public/assets/icons/weathered-walking-staff.svg
for the original hand-authored examples this script formalizes.

Use this whenever real PixelLab-generated art is blocked (e.g. out of generation quota) but a
registry entry needs *something* renderable now - register the SVG with status: 'placeholder' in
src/assets/registry.ts, then swap the filePath/status/dimensions to real art later. No AI
generation involved, so this never touches PixelLab's quota.

Usage: python scripts/gen_placeholder_svg.py
Edit the SPECS list below and re-run - each entry writes one SVG to public/assets/<rel_path>.
"""

import os

OUT_ROOT = os.path.join("public", "assets")

# (rel_path, width, height, label, top_color, bottom_color, text_color, font_size)
SPECS = []


def add(rel_path, width, height, label, top, bottom, text_color="#f4e9d8", font_size=None):
    SPECS.append((rel_path, width, height, label, top, bottom, text_color, font_size))


def write_all():
    for rel_path, width, height, label, top, bottom, text_color, font_size in SPECS:
        out_path = os.path.join(OUT_ROOT, rel_path)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        fs = font_size or max(10, min(width, height) // 6)
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{top}"/>
      <stop offset="1" stop-color="{bottom}"/>
    </linearGradient>
  </defs>
  <rect width="{width}" height="{height}" rx="{max(4, width // 16)}" fill="url(#g)" stroke="{bottom}" stroke-width="2"/>
  <text x="50%" y="54%" font-family="Georgia, serif" font-size="{fs}" fill="{text_color}" text-anchor="middle" dominant-baseline="middle">{label}</text>
</svg>
'''
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(svg)
        print(f"wrote {out_path} ({width}x{height})")


# --- Endless Prairie (MSQ Volume III, Chapter 5) - blocked on PixelLab quota, see
# feedback_region_build_workflow memory / docs/Mytherra-* Implementation Notes. ---

# NPC overworld sprites - the 4 shop NPCs with no character generated at all yet. Single static
# frame (idle-only style, matching every other placeholder), warm brown like npc-large.svg.
add("sprites/characters/innkeeper-hattie-idle.svg", 72, 96, "INN", "#6b4f2e", "#3a2c1a")
add("sprites/characters/storekeeper-wyatt-idle.svg", 72, 96, "SHOP", "#6b4f2e", "#3a2c1a")
add("sprites/characters/blacksmith-garrett-idle.svg", 72, 96, "SMITH", "#6b4f2e", "#3a2c1a")
add("sprites/characters/armorer-ruth-idle.svg", 72, 96, "ARMOR", "#6b4f2e", "#3a2c1a")

# NPC portraits - all 8 (none have real portraits yet; 4 have real overworld sprites already).
add("portraits/chief-aiyana-whitefeather.svg", 512, 512, "AIYANA", "#8a6a4a", "#4a3320")
add("portraits/elder-koda-running-elk.svg", 512, 512, "KODA", "#8a6a4a", "#4a3320")
add("portraits/scout-niska.svg", 512, 512, "NISKA", "#8a6a4a", "#4a3320")
add("portraits/prairie-spirit.svg", 512, 512, "SPIRIT", "#8a6a4a", "#4a3320")
add("portraits/innkeeper-hattie.svg", 512, 512, "HATTIE", "#8a6a4a", "#4a3320")
add("portraits/storekeeper-wyatt.svg", 512, 512, "WYATT", "#8a6a4a", "#4a3320")
add("portraits/blacksmith-garrett.svg", 512, 512, "GARRETT", "#8a6a4a", "#4a3320")
add("portraits/armorer-ruth.svg", 512, 512, "RUTH", "#8a6a4a", "#4a3320")

# Enemy battle sprites - single static frame (real art is a 8-9 frame animated sheet; placeholder
# simplifies to 1 frame, same "absent frameSize = static" convention used everywhere else).
add("sprites/enemies/wind-wisp-idle.svg", 128, 128, "WISP", "#c0e0e8", "#6098a8")
add("sprites/enemies/storm-wisp-idle.svg", 128, 128, "WISP", "#c0e0e8", "#6098a8")
add("sprites/enemies/prairie-wolf-idle.svg", 128, 128, "WOLF", "#8a7868", "#4a3c2c")
add("sprites/enemies/dire-prairie-wolf-idle.svg", 128, 128, "WOLF", "#8a7868", "#4a3c2c")

# Equipment icons - Prairie Spear (weapon), Buffalo Hide (chest), Rider's Chaps (legs), Wind Boots
# (boots), Rider Gloves (gloves), Sky Charm (charm). One hue per slot, matching the existing
# per-slot hue convention (worn-keeper-coat.svg etc.), tiers share a hue and vary only in label.
add("icons/weathered-prairie-spear.svg", 64, 64, "SPEAR", "#9a7a4a", "#5a4020")
add("icons/bound-prairie-spear.svg", 64, 64, "SPEAR", "#9a7a4a", "#5a4020")
add("icons/windriders-spear.svg", 64, 64, "SPEAR", "#9a7a4a", "#5a4020")
add("icons/worn-buffalo-hide.svg", 64, 64, "HIDE", "#7a4a30", "#4a2c18")
add("icons/banded-buffalo-hide.svg", 64, 64, "HIDE", "#7a4a30", "#4a2c18")
add("icons/chieftains-buffalo-hide.svg", 64, 64, "HIDE", "#7a4a30", "#4a2c18")
add("icons/worn-riders-chaps.svg", 64, 64, "CHAPS", "#6a5030", "#3a2c18")
add("icons/banded-riders-chaps.svg", 64, 64, "CHAPS", "#6a5030", "#3a2c18")
add("icons/windborn-riders-chaps.svg", 64, 64, "CHAPS", "#6a5030", "#3a2c18")
add("icons/worn-wind-boots.svg", 64, 64, "BOOTS", "#6a7a8a", "#3a4450")
add("icons/swift-wind-boots.svg", 64, 64, "BOOTS", "#6a7a8a", "#3a4450")
add("icons/windrunner-boots.svg", 64, 64, "BOOTS", "#6a7a8a", "#3a4450")
add("icons/worn-rider-gloves.svg", 64, 64, "GLOVE", "#8a6a50", "#4a3220")
add("icons/reinforced-rider-gloves.svg", 64, 64, "GLOVE", "#8a6a50", "#4a3220")
add("icons/warden-rider-gloves.svg", 64, 64, "GLOVE", "#8a6a50", "#4a3220")
add("icons/feather-sky-charm.svg", 64, 64, "CHARM", "#7a9ac0", "#3a5570")
add("icons/woven-sky-charm.svg", 64, 64, "CHARM", "#7a9ac0", "#3a5570")
add("icons/skywalkers-charm.svg", 64, 64, "CHARM", "#7a9ac0", "#3a5570")

# Material/key-item icons.
add("icons/wisp-feather.svg", 64, 64, "FTHR", "#c8d8e8", "#8098b0")
add("icons/prairie-wolf-pelt.svg", 64, 64, "PELT", "#8a7a68", "#4a3c30")
add("icons/winter-count-hide-i.svg", 64, 64, "HIDE I", "#c8a868", "#8a6838", font_size=10)
add("icons/winter-count-hide-ii.svg", 64, 64, "HIDE II", "#c8a868", "#8a6838", font_size=9)
add("icons/guardian-memory-fragment-3.svg", 64, 64, "FRAG 3", "#9a70c0", "#5a3880", font_size=10)

# --- Chapter 6: Wings of the First Promise (retroactive Phase 0 fix) ---
add("icons/white-buffalo-totem.svg", 64, 64, "TOTEM", "#d8d0c0", "#8a8070")

# --- Chapter 6: Wings of the First Promise (Phase 2 - new enemies) ---
add("sprites/enemies/storm-fledgling-idle.svg", 128, 128, "STORM", "#8a94a8", "#4a5468")
add("sprites/enemies/thunder-roc-idle.svg", 128, 128, "ROC", "#6a7898", "#3a4258")
add("sprites/enemies/great-thunderbird-idle.svg", 256, 256, "THUNDERBIRD", "#7a5aa0", "#3a2258", font_size=24)
add("icons/thunderbird-feather.svg", 64, 64, "FTHR", "#9a7cc0", "#5a3888")
add("icons/elder-buffalo-totem.svg", 64, 64, "TOTEM", "#c8c0b0", "#78705f")

# --- Chapter 6: Wings of the First Promise (Phase 4 - Lantern of Open Skies) ---
add("icons/lantern-of-open-skies.svg", 64, 64, "LANTERN", "#e8d888", "#a08830", font_size=9)
add("icons/lantern-of-open-skies-equipped.svg", 64, 64, "LANTERN", "#f0e0a0", "#b09840", font_size=9)

# --- Chapter 6: Wings of the First Promise (Phase 5 - Thunderbird Totem, Legendary) ---
add("icons/thunderbird-totem.svg", 64, 64, "TOTEM", "#a888d8", "#5a3888")

# --- Chapter 6: Wings of the First Promise (Phase 6 - finale) ---
add("icons/guardian-memory-fragment-4.svg", 64, 64, "FRAG 4", "#9a70c0", "#5a3880", font_size=10)

# --- Whispering Pines (MSQ Volume IV, Chapter 7): The Silent Forest - blocked on PixelLab quota,
# same placeholder-first workflow as Endless Prairie above. Forest-green palette (vs. Prairie's
# browns) to keep regions visually distinct even as flat placeholder panels. ---

# The 4 recurring NPCs (Phase 2) - no PixelLab character generated at all yet.
add("sprites/characters/elder-rowan-birch-idle.svg", 72, 96, "BIRCH", "#4a6a3a", "#243a1c")
add("sprites/characters/archivist-elowen-idle.svg", 72, 96, "ELOWEN", "#4a6a3a", "#243a1c", font_size=9)
add("sprites/characters/forest-warden-rowan-hart-idle.svg", 72, 96, "HART", "#4a6a3a", "#243a1c")
add("sprites/characters/cedar-spirit-idle.svg", 72, 96, "CEDAR", "#4a6a3a", "#243a1c")

# The 4 Cedarwatch shop NPCs (Phase 2).
add("sprites/characters/innkeeper-marge-idle.svg", 72, 96, "INN", "#4a6a3a", "#243a1c")
add("sprites/characters/storekeeper-byron-idle.svg", 72, 96, "SHOP", "#4a6a3a", "#243a1c")
add("sprites/characters/blacksmith-dara-idle.svg", 72, 96, "SMITH", "#4a6a3a", "#243a1c")
add("sprites/characters/armorer-fenn-idle.svg", 72, 96, "ARMOR", "#4a6a3a", "#243a1c")

# All 8 Chapter 7 NPC portraits (Phase 2).
add("portraits/elder-rowan-birch.svg", 512, 512, "BIRCH", "#5a7a4a", "#2c4020")
add("portraits/archivist-elowen.svg", 512, 512, "ELOWEN", "#5a7a4a", "#2c4020")
add("portraits/forest-warden-rowan-hart.svg", 512, 512, "HART", "#5a7a4a", "#2c4020")
add("portraits/cedar-spirit.svg", 512, 512, "SPIRIT", "#5a7a4a", "#2c4020")
add("portraits/innkeeper-marge.svg", 512, 512, "MARGE", "#5a7a4a", "#2c4020")
add("portraits/storekeeper-byron.svg", 512, 512, "BYRON", "#5a7a4a", "#2c4020")
add("portraits/blacksmith-dara.svg", 512, 512, "DARA", "#5a7a4a", "#2c4020")
add("portraits/armorer-fenn.svg", 512, 512, "FENN", "#5a7a4a", "#2c4020")

# Quest key-item icons (Phase 3) - one shared icon for all 3 Spirit Seeds, matching the
# wind-stone-* precedent (same collectible, 3 different field-map locations).
add("icons/spirit-seed.svg", 64, 64, "SEED", "#7ac888", "#2a5a30")
add("icons/lost-library-records.svg", 64, 64, "RECS", "#c8b888", "#8a7038")

# Enemy battle sprites + material icon (Phase 4 - silentEchoes family).
add("sprites/enemies/forest-echo-idle.svg", 128, 128, "ECHO", "#5a8a5a", "#284828")
add("sprites/enemies/corrupted-echo-idle.svg", 128, 128, "ECHO", "#6a5a8a", "#302848")
add("icons/withered-echo-moss.svg", 64, 64, "MOSS", "#7a9a5a", "#3a4c28")

# Equipment icons (Phase 5) - Cedar Staff (weapon), Bark Armor (chest), Root-Woven Leggings
# (legs), Root Boots (boots), Vine Gloves (gloves), Cedar Charm (charm), Young Cedar Totem
# (spiritTotem). One hue per slot, matching the existing per-slot hue convention.
add("icons/weathered-cedar-staff.svg", 64, 64, "STAFF", "#7a9a5a", "#3a4c28", font_size=9)
add("icons/bound-cedar-staff.svg", 64, 64, "STAFF", "#7a9a5a", "#3a4c28", font_size=9)
add("icons/ancient-cedar-staff.svg", 64, 64, "STAFF", "#7a9a5a", "#3a4c28", font_size=9)
add("icons/worn-bark-armor.svg", 64, 64, "BARK", "#8a6a4a", "#4a3220")
add("icons/banded-bark-armor.svg", 64, 64, "BARK", "#8a6a4a", "#4a3220")
add("icons/elderwood-bark-armor.svg", 64, 64, "BARK", "#8a6a4a", "#4a3220")
add("icons/worn-root-woven-leggings.svg", 64, 64, "LEGS", "#6a8a5a", "#345030")
add("icons/banded-root-woven-leggings.svg", 64, 64, "LEGS", "#6a8a5a", "#345030")
add("icons/deep-root-leggings.svg", 64, 64, "LEGS", "#6a8a5a", "#345030")
add("icons/worn-root-boots.svg", 64, 64, "BOOTS", "#5a8a6a", "#2c4c38")
add("icons/banded-root-boots.svg", 64, 64, "BOOTS", "#5a8a6a", "#2c4c38")
add("icons/ancient-root-boots.svg", 64, 64, "BOOTS", "#5a8a6a", "#2c4c38")
add("icons/worn-vine-gloves.svg", 64, 64, "GLOVE", "#6a9a6a", "#345c34")
add("icons/woven-vine-gloves.svg", 64, 64, "GLOVE", "#6a9a6a", "#345c34")
add("icons/warden-vine-gloves.svg", 64, 64, "GLOVE", "#6a9a6a", "#345c34")
add("icons/carved-cedar-charm.svg", 64, 64, "CHARM", "#5aa090", "#2c5048")
add("icons/woven-cedar-charm.svg", 64, 64, "CHARM", "#5aa090", "#2c5048")
add("icons/elders-cedar-charm.svg", 64, 64, "CHARM", "#5aa090", "#2c5048")
add("icons/young-cedar-totem.svg", 64, 64, "TOTEM", "#c8c0a0", "#78705a")

# Side quest key-item icon (Phase 3b) - shared for both Heartwood Recordings, matching the
# spirit-seed/wind-stone precedent (same collectible concept, 2 different hidden caches).
add("icons/heartwood-recording.svg", 64, 64, "ROOT", "#9a7c50", "#5a4020")

# --- Chapter 8: Echoes of the First Keepers (rootWraiths family + Cedar Giant boss) ---
add("sprites/enemies/root-wraith-idle.svg", 128, 128, "WRAITH", "#6a5438", "#382c1c", font_size=14)
add("sprites/enemies/elder-root-wraith-idle.svg", 128, 128, "WRAITH", "#7a6244", "#402c1c", font_size=14)
add("sprites/enemies/cedar-giant-idle.svg", 256, 256, "CEDAR GIANT", "#4a6a3a", "#243a1c", font_size=22)
add("icons/gnarled-root-fiber.svg", 64, 64, "FIBER", "#8a6a44", "#4a3220")
add("icons/ancient-heartwood-relic.svg", 64, 64, "RELIC", "#9a70c0", "#5a3880")
add("icons/archive-fragments.svg", 64, 64, "PAGES", "#c8b888", "#8a7038")

# Lantern of Ancient Roots (Phase 4) - found-item + equipped forms.
add("icons/lantern-of-ancient-roots.svg", 64, 64, "LANTERN", "#a8d888", "#4a7830", font_size=9)
add("icons/lantern-of-ancient-roots-equipped.svg", 64, 64, "LANTERN", "#b8e898", "#5a8840", font_size=9)

# Young Cedar Totem family's Mythic + Legendary tiers (Phase 5).
add("icons/elder-cedar-totem.svg", 64, 64, "TOTEM", "#c8c0a0", "#78705a")
add("icons/cedar-giant-totem.svg", 64, 64, "TOTEM", "#a8d888", "#4a7830")

# Chapter 8 finale (Phase 6).
add("icons/guardian-memory-fragment-5.svg", 64, 64, "FRAG 5", "#9a70c0", "#5a3880", font_size=10)
add("icons/celestial-star-map.svg", 64, 64, "MAP", "#7a8ac0", "#3a4470")
add("icons/guardian-memory-fragment-6.svg", 64, 64, "FRAG 6", "#9a70c0", "#5a3880", font_size=10)
add("icons/frostward-star-chart.svg", 64, 64, "CHART", "#7ab0d0", "#2a5070", font_size=9)

# --- Town structure (building-facade marker) placeholders ---
# BUILDING_MARKERS in TownScene.tsx only had Ash Hallow + Mirehaven entries - every Highwind
# Crossing and Cedarwatch building fell through to the generic pulsing structure.exit-marker
# instead of a facade. Same 144x144 dimension convention as every real/placeholder structure.*
# icon (see structure.mirehaven-town-hall's own note), colored per-region.
add("sprites/structures/highwind-crossing-chiefs-lodge.svg", 144, 144, "LODGE", "#6b4f2e", "#3a2c1a")
add("sprites/structures/highwind-crossing-spirit-lodge.svg", 144, 144, "SPIRIT", "#6b4f2e", "#3a2c1a")
add("sprites/structures/highwind-crossing-inn.svg", 144, 144, "INN", "#6b4f2e", "#3a2c1a")
add("sprites/structures/highwind-crossing-general-store.svg", 144, 144, "SHOP", "#6b4f2e", "#3a2c1a")
add("sprites/structures/highwind-crossing-blacksmith.svg", 144, 144, "FORGE", "#6b4f2e", "#3a2c1a")
add("sprites/structures/highwind-crossing-armory.svg", 144, 144, "ARMORY", "#6b4f2e", "#3a2c1a", font_size=18)
add("sprites/structures/cedarwatch-elders-lodge.svg", 144, 144, "LODGE", "#4a6a3a", "#243a1c")
add("sprites/structures/cedarwatch-great-tree-library.svg", 144, 144, "LIBRARY", "#4a6a3a", "#243a1c", font_size=18)
add("sprites/structures/cedarwatch-inn.svg", 144, 144, "INN", "#4a6a3a", "#243a1c")
add("sprites/structures/cedarwatch-general-store.svg", 144, 144, "SHOP", "#4a6a3a", "#243a1c")
add("sprites/structures/cedarwatch-blacksmith.svg", 144, 144, "FORGE", "#4a6a3a", "#243a1c")
add("sprites/structures/cedarwatch-armory.svg", 144, 144, "ARMORY", "#4a6a3a", "#243a1c", font_size=18)
add("sprites/structures/red-mesa-elders-hall.svg", 144, 144, "LODGE", "#a8623a", "#5a2c18")
add("sprites/structures/red-mesa-relic-museum.svg", 144, 144, "MUSEUM", "#a8623a", "#5a2c18", font_size=18)
add("sprites/structures/red-mesa-inn.svg", 144, 144, "INN", "#a8623a", "#5a2c18")
add("sprites/structures/red-mesa-general-store.svg", 144, 144, "SHOP", "#a8623a", "#5a2c18")
add("sprites/structures/red-mesa-blacksmith.svg", 144, 144, "FORGE", "#a8623a", "#5a2c18")
add("sprites/structures/red-mesa-armory.svg", 144, 144, "ARMORY", "#a8623a", "#5a2c18", font_size=18)
add("sprites/structures/frosthaven-explorer-headquarters.svg", 144, 144, "LODGE", "#5a7a9a", "#2a3a52")
add("sprites/structures/frosthaven-ice-chapel.svg", 144, 144, "CHAPEL", "#5a7a9a", "#2a3a52", font_size=18)
add("sprites/structures/frosthaven-inn.svg", 144, 144, "INN", "#5a7a9a", "#2a3a52")
add("sprites/structures/frosthaven-general-store.svg", 144, 144, "SHOP", "#5a7a9a", "#2a3a52")
add("sprites/structures/frosthaven-blacksmith.svg", 144, 144, "FORGE", "#5a7a9a", "#2a3a52")
add("sprites/structures/frosthaven-armory.svg", 144, 144, "ARMORY", "#5a7a9a", "#2a3a52", font_size=18)

# --- Shattered Desert (MSQ Volume V, Chapter 9) NPCs - blocked on PixelLab quota. ---
add("sprites/characters/elder-santiago-ortega-idle.svg", 72, 96, "SANTIAGO", "#a8623a", "#5a2c18", font_size=9)
add("sprites/characters/scholar-nia-solis-idle.svg", 72, 96, "NIA", "#a8623a", "#5a2c18")
add("sprites/characters/desert-ranger-tomas-vega-idle.svg", 72, 96, "TOMAS", "#a8623a", "#5a2c18")
add("sprites/characters/sand-spirit-idle.svg", 72, 96, "SPIRIT", "#a8623a", "#5a2c18")
add("sprites/characters/innkeeper-rosa-idle.svg", 72, 96, "INN", "#a8623a", "#5a2c18")
add("sprites/characters/storekeeper-mateo-idle.svg", 72, 96, "SHOP", "#a8623a", "#5a2c18")
add("sprites/characters/blacksmith-esteban-idle.svg", 72, 96, "SMITH", "#a8623a", "#5a2c18")
add("sprites/characters/armorer-carmen-idle.svg", 72, 96, "ARMOR", "#a8623a", "#5a2c18")

add("portraits/elder-santiago-ortega.svg", 512, 512, "SANTIAGO", "#b8794a", "#6a3a20")
add("portraits/scholar-nia-solis.svg", 512, 512, "NIA", "#b8794a", "#6a3a20")
add("portraits/desert-ranger-tomas-vega.svg", 512, 512, "TOMAS", "#b8794a", "#6a3a20")
add("portraits/sand-spirit.svg", 512, 512, "SPIRIT", "#b8794a", "#6a3a20")
add("portraits/innkeeper-rosa.svg", 512, 512, "ROSA", "#b8794a", "#6a3a20")
add("portraits/storekeeper-mateo.svg", 512, 512, "MATEO", "#b8794a", "#6a3a20")
add("portraits/blacksmith-esteban.svg", 512, 512, "ESTEBAN", "#b8794a", "#6a3a20")
add("portraits/armorer-carmen.svg", 512, 512, "CARMEN", "#b8794a", "#6a3a20")

# --- Frozen Frontier (MSQ Volume VI, Chapter 11) NPCs - blocked on PixelLab quota. ---
add("sprites/characters/elder-henrik-idle.svg", 72, 96, "HENRIK", "#5a7a9a", "#2a3a52", font_size=9)
add("sprites/characters/captain-astrid-frost-idle.svg", 72, 96, "ASTRID", "#5a7a9a", "#2a3a52", font_size=9)
add("sprites/characters/aurora-keeper-lyra-idle.svg", 72, 96, "LYRA", "#5a7a9a", "#2a3a52")
add("sprites/characters/winter-spirit-idle.svg", 72, 96, "SPIRIT", "#5a7a9a", "#2a3a52")
add("sprites/characters/innkeeper-greta-idle.svg", 72, 96, "INN", "#5a7a9a", "#2a3a52")
add("sprites/characters/storekeeper-bjorn-idle.svg", 72, 96, "SHOP", "#5a7a9a", "#2a3a52")
add("sprites/characters/blacksmith-sigrid-idle.svg", 72, 96, "SMITH", "#5a7a9a", "#2a3a52")
add("sprites/characters/armorer-magnus-idle.svg", 72, 96, "ARMOR", "#5a7a9a", "#2a3a52")

add("portraits/elder-henrik.svg", 512, 512, "HENRIK", "#6a8aaa", "#3a4a62")
add("portraits/captain-astrid-frost.svg", 512, 512, "ASTRID", "#6a8aaa", "#3a4a62")
add("portraits/aurora-keeper-lyra.svg", 512, 512, "LYRA", "#6a8aaa", "#3a4a62")
add("portraits/winter-spirit.svg", 512, 512, "SPIRIT", "#6a8aaa", "#3a4a62")
add("portraits/innkeeper-greta.svg", 512, 512, "GRETA", "#6a8aaa", "#3a4a62")
add("portraits/storekeeper-bjorn.svg", 512, 512, "BJORN", "#6a8aaa", "#3a4a62")
add("portraits/blacksmith-sigrid.svg", 512, 512, "SIGRID", "#6a8aaa", "#3a4a62")
add("portraits/armorer-magnus.svg", 512, 512, "MAGNUS", "#6a8aaa", "#3a4a62")

# Quest key-item icons (Phase 3) - shared icons for the 3 Star Fragments and 2 Desert Relics.
add("icons/star-fragment.svg", 64, 64, "STAR", "#7a8ac0", "#3a4470")
add("icons/aurora-crystal-fragment.svg", 64, 64, "AURORA", "#6ab0d0", "#2a5070", font_size=9)
add("icons/desert-relic.svg", 64, 64, "RELIC", "#c8a868", "#8a6838")

# Enemy battle sprites + material icon (Phase 4 - dustDevils family).
add("sprites/enemies/dust-devil-idle.svg", 128, 128, "DEVIL", "#c8a868", "#8a6838")
add("sprites/enemies/sandstorm-devil-idle.svg", 128, 128, "DEVIL", "#a8623a", "#5a2c18")
add("icons/sandglass-shard.svg", 64, 64, "GLASS", "#c8d8e8", "#8098b0")

# --- Chapter 10: The Sky Remembers (celestialWisps family + Canyon Giant boss) ---
add("sprites/enemies/celestial-wisp-idle.svg", 128, 128, "WISP", "#8a9cd0", "#3a4470")
add("sprites/enemies/star-phantom-idle.svg", 128, 128, "PHANTOM", "#6a7ab0", "#2a3450", font_size=13)
add("sprites/enemies/canyon-giant-idle.svg", 256, 256, "CANYON GIANT", "#a8623a", "#5a2c18", font_size=20)
add("icons/starlight-dust.svg", 64, 64, "DUST", "#8a9cd0", "#3a4470")
add("icons/canyon-giant-core.svg", 64, 64, "CORE", "#9a70c0", "#5a3880")

# Lantern of Forgotten Stars (Phase 4) - found-item + equipped forms.
add("icons/lantern-of-forgotten-stars.svg", 64, 64, "LANTERN", "#8a9cd0", "#3a4470", font_size=9)
add("icons/lantern-of-forgotten-stars-equipped.svg", 64, 64, "LANTERN", "#9aacd8", "#4a5480", font_size=9)

# Sunstone Totem family's Mythic + Legendary tiers (Phase 5).
add("icons/elder-sunstone-totem.svg", 64, 64, "TOTEM", "#c8c0a0", "#78705a")
add("icons/canyon-giant-totem.svg", 64, 64, "TOTEM", "#c8a848", "#8a6828")

# Equipment icons (Phase 5) - Sunblade (weapon), Nomad Robes (chest), Nomad Leggings (legs), Sand
# Boots (boots), Dune Wraps (gloves), Star Charm (charm), Sunstone Totem (spiritTotem). One hue
# per slot, matching the existing per-slot hue convention.
add("icons/weathered-sunblade.svg", 64, 64, "BLADE", "#c8a848", "#8a6828")
add("icons/bound-sunblade.svg", 64, 64, "BLADE", "#c8a848", "#8a6828")
add("icons/solaris-blade.svg", 64, 64, "BLADE", "#c8a848", "#8a6828")
add("icons/worn-nomad-robes.svg", 64, 64, "ROBES", "#b89060", "#6a5030")
add("icons/banded-nomad-robes.svg", 64, 64, "ROBES", "#b89060", "#6a5030")
add("icons/starwoven-nomad-robes.svg", 64, 64, "ROBES", "#b89060", "#6a5030")
add("icons/worn-nomad-leggings.svg", 64, 64, "LEGS", "#a8804c", "#5c4426")
add("icons/banded-nomad-leggings.svg", 64, 64, "LEGS", "#a8804c", "#5c4426")
add("icons/starwoven-nomad-leggings.svg", 64, 64, "LEGS", "#a8804c", "#5c4426")
add("icons/worn-sand-boots.svg", 64, 64, "BOOTS", "#9a7048", "#4c3218")
add("icons/swift-sand-boots.svg", 64, 64, "BOOTS", "#9a7048", "#4c3218")
add("icons/sunrunner-boots.svg", 64, 64, "BOOTS", "#9a7048", "#4c3218")
add("icons/worn-dune-wraps.svg", 64, 64, "GLOVE", "#b09068", "#5c4830")
add("icons/woven-dune-wraps.svg", 64, 64, "GLOVE", "#b09068", "#5c4830")
add("icons/rangers-dune-wraps.svg", 64, 64, "GLOVE", "#b09068", "#5c4830")
add("icons/sunworn-star-charm.svg", 64, 64, "CHARM", "#7a8ac0", "#3a4470")
add("icons/banded-star-charm.svg", 64, 64, "CHARM", "#7a8ac0", "#3a4470")
add("icons/astral-star-charm.svg", 64, 64, "CHARM", "#7a8ac0", "#3a4470")
add("icons/sunstone-totem.svg", 64, 64, "TOTEM", "#c8c0a0", "#78705a")


if __name__ == "__main__":
    write_all()
    print(f"done: {len(SPECS)} placeholder(s)")
