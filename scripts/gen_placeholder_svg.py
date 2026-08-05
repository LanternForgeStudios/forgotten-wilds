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


if __name__ == "__main__":
    write_all()
    print(f"done: {len(SPECS)} placeholder(s)")
