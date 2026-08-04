"""Build a single-object UI icon from a pixellab MCP `create_map_object` export
(art-staging/icons/{slug}.png, a raw downloaded PNG - unlike character exports, a map object's
download link is a plain PNG, not a zip) into its final in-game size.

Per docs/Asset-Production-Checklist.md's "Icons" section: every icon is generated at 128x128
regardless of its final in-game size, so a future re-resize (as already happened once with the
building facades) has a real high-res source to work from instead of needing to regenerate the
art. This script does the downscale (LANCZOS - these are painterly/flat-shaded icons, not pixel
art, so a smooth filter is correct here, matching the building-facade icon pipeline's own choice)
and archives the full 128x128 original before clearing it from staging.
"""

import os
import shutil
from PIL import Image

# filename (without extension) in art-staging/icons/ -> (output filename, final size)
ICONS = {
    "currency-gold": (32, 32),
    "currency-spirit-essence": (32, 32),
    "currency-festival-tokens": (32, 32),
    "currency-premium-currency": (32, 32),
    "ailment-poison": (64, 64),
    "ailment-burn": (64, 64),
    "ailment-freeze": (64, 64),
    "ailment-stun": (64, 64),
    "ailment-blind": (64, 64),
    "ailment-silence": (64, 64),
    "healing-poultice": (64, 64),
    "spirit-draught": (64, 64),
    "lantern-oil": (64, 64),
    "antidote": (64, 64),
    "burn-salve": (64, 64),
    "thaw-crystal": (64, 64),
    "eye-drops": (64, 64),
    "echo-herb": (64, 64),
    "moth-dust": (64, 64),
    "rusted-token": (64, 64),
    "ember-shard": (64, 64),
    "wolf-fang": (64, 64),
    "silver-droplet": (64, 64),
    "withered-bramble": (64, 64),
    "stone-fragment": (64, 64),
    "water-fragment": (64, 64),
    "wind-fragment": (64, 64),
    "miners-lost-lantern": (64, 64),
    "wardens-ember-heart": (64, 64),
    "guardian-memory-fragment-1": (64, 64),
    "frostbound-treatise": (64, 64),
    "ember-codex": (64, 64),
    "weathered-walking-staff": (64, 64),
    "ironwood-walking-staff": (64, 64),
    "spiritwood-walking-staff": (64, 64),
    "worn-keeper-coat": (64, 64),
    "reinforced-keeper-coat": (64, 64),
    "veteran-keeper-coat": (64, 64),
    "traveler-boots": (64, 64),
    "trail-boots": (64, 64),
    "ranger-boots": (64, 64),
    "work-gloves": (64, 64),
    "leather-gauntlets": (64, 64),
    "keepers-gauntlets": (64, 64),
    "river-stone-charm": (64, 64),
    "mountain-knot": (64, 64),
    "ghost-miners-coin": (64, 64),
    "keepers-lantern": (64, 64),
    "miners-lost-lantern-equipped": (64, 64),
    "stone-wolf-totem": (64, 64),
    "mountain-guardian-totem": (64, 64),
    "travelers-cloak": (64, 64),
    "traveler-pants": (64, 64),
    "worn-keeper-trousers": (64, 64),
    "reinforced-keeper-trousers": (64, 64),
    "veteran-keeper-trousers": (64, 64),
    "croc-hide": (64, 64),
    "bog-ash": (64, 64),
    "rougarou-claw": (64, 64),
    "ancient-serpent-scale": (64, 64),
    "heart-seed-cypress": (64, 64),
    "heart-seed-murkwater": (64, 64),
    "heart-seed-river": (64, 64),
    "temple-records": (64, 64),
    "lantern-of-still-waters": (64, 64),
    "lantern-of-still-waters-equipped": (64, 64),
    "mother-cypress-totem": (64, 64),
    "guardian-memory-fragment-2": (64, 64),
    "weathered-cypress-cane": (64, 64),
    "bound-cypress-cane": (64, 64),
    "rougarou-fang-blade": (64, 64),
    "tattered-bayou-vestments": (64, 64),
    "woven-bayou-vestments": (64, 64),
    "warden-bayou-vestments": (64, 64),
    "worn-bayou-leg-wraps": (64, 64),
    "woven-bayou-leg-wraps": (64, 64),
    "warden-bayou-leg-wraps": (64, 64),
    "worn-marsh-boots": (64, 64),
    "sturdy-marsh-boots": (64, 64),
    "mosswalker-boots": (64, 64),
    "worn-mire-gloves": (64, 64),
    "reinforced-mire-gloves": (64, 64),
    "warden-mire-gloves": (64, 64),
    "marsh-reed-charm": (64, 64),
    "swamp-talisman": (64, 64),
    "witch-warded-charm": (64, 64),
    "swamp-wisp-totem": (64, 64),
    "cypress-guardian-totem": (64, 64),
    "drowned-ledger": (64, 64),
    "bogwater-almanac": (64, 64),
    "weathered-iron-sword": (64, 64),
    "miners-pick": (64, 64),
    "ashwood-spear": (64, 64),
    "miners-mallet": (64, 64),
    # Iron Mountains Uncommon/Rare tiers of the 4 new weapon-type families.
    "ironbound-sword": (64, 64),
    "ironbound-axe": (64, 64),
    "ironbound-spear": (64, 64),
    "ironbound-war-maul": (64, 64),
    "wardens-broadsword": (64, 64),
    "ghost-miners-axe": (64, 64),
    "ridgehunters-spear": (64, 64),
    "ghostbreaker-warhammer": (64, 64),
    # Crimson Bayou's own 4 new weapon-type families, all 3 tiers each.
    "weathered-bog-cutlass": (64, 64),
    "weathered-bog-axe": (64, 64),
    "weathered-reed-spear": (64, 64),
    "weathered-bog-maul": (64, 64),
    "bound-bog-cutlass": (64, 64),
    "bound-bog-axe": (64, 64),
    "bound-reed-spear": (64, 64),
    "bound-bog-maul": (64, 64),
    "serpent-fang-sword": (64, 64),
    "rougarou-claw-axe": (64, 64),
    "serpent-guard-spear": (64, 64),
    "rougarou-warclub": (64, 64),
    "wind-stone": (64, 64),
}

SRC_DIR = os.path.join("art-staging", "icons")
OUT_DIR = os.path.join("public", "assets", "icons")
ORIGINALS_ROOT = os.path.join(OUT_DIR, "original")

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(ORIGINALS_ROOT, exist_ok=True)

for name, final_size in ICONS.items():
    src_path = os.path.join(SRC_DIR, f"{name}.png")
    if not os.path.exists(src_path):
        print(f"skipping {name}: no staged {name}.png found")
        continue

    im = Image.open(src_path).convert("RGBA")
    resized = im.resize(final_size, Image.LANCZOS)

    out_path = os.path.join(OUT_DIR, f"{name}.png")
    resized.save(out_path, format="PNG", optimize=True)
    print(f"{name}: {im.size} -> {final_size} -> {out_path} ({os.path.getsize(out_path) / 1024:.1f}KB)")

    archive_path = os.path.join(ORIGINALS_ROOT, f"{name}.png")
    if not os.path.exists(archive_path):
        shutil.copy2(src_path, archive_path)
    os.remove(src_path)
    print(f"  archived 128x128 source to {archive_path}, removed from staging")
