"""Auto-generates a new equipment-layer sheet by RECOLORING an already-finished sheet, for a new
item that shares its family's silhouette but not its color/material (e.g. Ironwood Walking Staff
vs. the already-hand-positioned Weathered Walking Staff - same cane shape per their icon art,
just a different wood/metal tone). This reuses 100% of the reference item's hand-positioning,
rotation, and grip-trim work - only the surface colors change - so it's high-confidence ONLY when
the two items' icon art shows a genuinely matching silhouette (check by eye first; a differently-
shaped item needs the anchor/rotation-estimate approach instead, not this script).

Technique: a per-material GRADIENT MAP (the same idea as Photoshop's Gradient Map adjustment,
applied per detected material rather than globally). Real pixel-art props usually mix 2 distinct
materials with different hues (e.g. a lantern's warm glass glow vs. its dark metal frame) - a
single global brightness->color ramp would wrongly blend a bright metal highlight into the glow
material's palette. So:
  1. Sample both icons' (source reference item, target new item) dominant opaque colors.
  2. Cluster each icon's colors into `n_materials` groups via standard k-means in RGB space
     (Euclidean distance, not hue) - separates visually distinct materials without needing manual
     per-item tuning. RGB-space (not hue-only) matters here: an early hue-only version produced a
     visible pink/magenta wash on a desaturated near-gray palette (ironwood's tones), since hue is
     numerically unstable for low-saturation colors - full RGB clustering doesn't have that failure
     mode.
  3. Pair each source material cluster with the target cluster of the closest mean brightness
     RANK (both sorted brightest-to-darkest) - assumes the two items keep materials in roughly the
     same visual role (the brighter/more saturated cluster is usually the "accent" material in
     both), which held for both cases actually used so far (lantern glow, staff wood grain).
  4. For each pixel in the reference sheet: classify it into whichever material cluster it's
     nearest (in RGB) to, then find that pixel's normalized brightness position within ITS
     cluster's own value range, and look up the target cluster's color at that same normalized
     position - i.e. a value-sorted ramp per material, preserving every bit of the reference
     sheet's existing shading/highlight work while only substituting the base hue/saturation.
  5. Alpha channel (and therefore the exact silhouette/position/rotation/trim) is untouched.

Usage: python scripts/palette_swap_equipment_layer.py <source_item> <target_item> [n_materials] [gender]
  source_item: an item with an already-built public/assets/sprites/equipment/<item>-<gender>-animated.png
  target_item: the new item id - must have an icon at public/assets/icons/original/<item>.png
  n_materials: how many distinct hue-clusters to detect (default 2 - most props are "body + accent")
  gender: 'male' or 'female' (default 'male') - runs the identical recolor against the female base
    sheet when generating a female counterpart, so a same-family item's male and female sheets
    are each recolored from their own gendered source rather than derived from one another.
Writes: public/assets/sprites/equipment/<target_item>-<gender>-animated.png (full 8-row sheet,
        walking AND running - inherits whatever rows the source sheet has, so a source with real
        running art produces a target with real running art too, no extra work needed).
        docs/equipment-layer-anchors.json - copies the source item's anchor entries under the
        target item's own id too (the geometry is identical, only color changed; anchor entries
        aren't gender-specific, so this only needs to happen once per target item).
"""

import json
import os
import sys
from collections import Counter
from PIL import Image

ICON_DIR = os.path.join("public", "assets", "icons", "original")
SHEET_DIR = os.path.join("public", "assets", "sprites", "equipment")
ANCHOR_TABLE_PATH = os.path.join("docs", "equipment-layer-anchors.json")


def sample_colors(icon_path, max_colors=400):
    im = Image.open(icon_path).convert("RGBA")
    counts = Counter()
    for px in im.getdata():
        if px[3] > 30:
            counts[px[:3]] += 1
    return counts.most_common(max_colors)


def kmeans_rgb(colors_with_counts, k, iters=25, seed=0):
    """Weighted k-means in RGB space (standard Euclidean, k-means++-ish seeding).
    colors_with_counts: [(rgb, count), ...]."""
    import random
    rng = random.Random(seed)
    colors = [c for c, _ in colors_with_counts]
    weights = [n for _, n in colors_with_counts]

    def dist2(a, b):
        return sum((a[i] - b[i]) ** 2 for i in range(3))

    # k-means++ seeding: spreads initial centroids apart instead of picking arbitrary points,
    # so a small/skewed palette doesn't collapse two materials into the same starting cluster.
    centroids = [colors[rng.randrange(len(colors))]]
    while len(centroids) < k:
        d2 = [min(dist2(c, cen) for cen in centroids) for c in colors]
        total = sum(d2) or 1
        r = rng.random() * total
        acc = 0
        for i, w in enumerate(d2):
            acc += w
            if acc >= r:
                centroids.append(colors[i])
                break
        else:
            centroids.append(colors[-1])

    assign = [0] * len(colors)
    for _ in range(iters):
        for i, c in enumerate(colors):
            assign[i] = min(range(k), key=lambda ci: dist2(c, centroids[ci]))
        for ci in range(k):
            members = [(colors[i], weights[i]) for i in range(len(colors)) if assign[i] == ci]
            if not members:
                continue
            total_w = sum(w for _, w in members)
            centroids[ci] = tuple(sum(c[j] * w for c, w in members) / total_w for j in range(3))

    clusters = [[] for _ in range(k)]
    for i, (rgb, cnt) in enumerate(colors_with_counts):
        clusters[assign[i]].append((rgb, cnt))
    return clusters


def cluster_ramp(cluster):
    """Sorted (value, rgb) ramp for one material cluster, value = perceptual brightness 0..1."""
    def value_of(rgb):
        r, g, b = rgb
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    ramp = sorted(((value_of(rgb), rgb) for rgb, _ in cluster), key=lambda t: t[0])
    return ramp


def ramp_lookup(ramp, v):
    """Interpolated color at brightness v (0..1) along a sorted (value, rgb) ramp."""
    if not ramp:
        return (128, 128, 128)
    if v <= ramp[0][0]:
        return ramp[0][1]
    if v >= ramp[-1][0]:
        return ramp[-1][1]
    for i in range(len(ramp) - 1):
        v0, c0 = ramp[i]
        v1, c1 = ramp[i + 1]
        if v0 <= v <= v1:
            t = 0 if v1 == v0 else (v - v0) / (v1 - v0)
            return tuple(round(c0[j] + (c1[j] - c0[j]) * t) for j in range(3))
    return ramp[-1][1]


def cluster_mean_value(cluster):
    def value_of(rgb):
        r, g, b = rgb
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    total_w = sum(cnt for _, cnt in cluster) or 1
    return sum(value_of(rgb) * cnt for rgb, cnt in cluster) / total_w


def nearest_cluster_rgb(rgb, cluster_centroid_rgbs):
    def dist(a, b):
        return sum((a[i] - b[i]) ** 2 for i in range(3))
    return min(range(len(cluster_centroid_rgbs)), key=lambda i: dist(rgb, cluster_centroid_rgbs[i]))


def cluster_centroid_rgb(cluster):
    total_w = sum(cnt for _, cnt in cluster) or 1
    return tuple(sum(rgb[i] * cnt for rgb, cnt in cluster) / total_w for i in range(3))


def build_recolor(source_item, target_item, n_materials=2, gender="male"):
    source_sheet_path = os.path.join(SHEET_DIR, f"{source_item}-{gender}-animated.png")
    source_icon_path = os.path.join(ICON_DIR, f"{source_item}.png")
    target_icon_path = os.path.join(ICON_DIR, f"{target_item}.png")
    for p in (source_sheet_path, source_icon_path, target_icon_path):
        if not os.path.exists(p):
            print(f"aborting: {p} not found")
            return False

    source_colors = sample_colors(source_icon_path)
    target_colors = sample_colors(target_icon_path)

    source_clusters = kmeans_rgb(source_colors, n_materials)
    target_clusters = kmeans_rgb(target_colors, n_materials)
    # Drop any empty clusters (can happen with a low-color-variety icon and n_materials too high).
    source_clusters = [c for c in source_clusters if c]
    target_clusters = [c for c in target_clusters if c]
    n = min(len(source_clusters), len(target_clusters))

    # Pair by POPULATION rank (largest source cluster -> largest target cluster, etc.), not
    # brightness rank. Brightness-rank pairing broke on veteran-keeper-coat: k-means splits a
    # low-contrast icon into "the true dominant material" (huge cluster) and "a handful of stray
    # near-white rim-light/anti-aliasing pixels" (tiny cluster) - if the tiny highlight cluster
    # happens to be brighter than the source's own dominant-material cluster, brightness pairing
    # maps the source's whole visible body color onto that minority highlight, washing the result
    # out. Population rank instead directly captures "the material that covers most of the
    # surface should map to the material that covers most of the surface," regardless of which
    # one happens to be lighter or darker overall.
    def cluster_population(cluster):
        return sum(cnt for _, cnt in cluster)

    source_clusters.sort(key=cluster_population, reverse=True)
    target_clusters.sort(key=cluster_population, reverse=True)
    source_ramps = [cluster_ramp(source_clusters[i]) for i in range(n)]
    target_ramps = [cluster_ramp(target_clusters[i]) for i in range(n)]
    source_centroids = [cluster_centroid_rgb(source_clusters[i]) for i in range(n)]

    def value_of(rgb):
        r, g, b = rgb
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255.0

    sheet = Image.open(source_sheet_path).convert("RGBA")
    px = sheet.load()
    w, h = sheet.size
    cache = {}
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            key = (r, g, b)
            if key not in cache:
                ci = nearest_cluster_rgb(key, source_centroids)
                # Normalize this pixel's value within its own cluster's ramp span before
                # re-expressing it at the same relative position on the target's ramp.
                ramp = source_ramps[ci]
                v = value_of(key)
                lo, hi = ramp[0][0], ramp[-1][0]
                t = 0.5 if hi <= lo else max(0.0, min(1.0, (v - lo) / (hi - lo)))
                target_ramp = target_ramps[ci]
                tv = target_ramp[0][0] + t * (target_ramp[-1][0] - target_ramp[0][0])
                cache[key] = ramp_lookup(target_ramp, tv)
            new_rgb = cache[key]
            px[x, y] = (int(new_rgb[0]), int(new_rgb[1]), int(new_rgb[2]), a)

    out_path = os.path.join(SHEET_DIR, f"{target_item}-{gender}-animated.png")
    sheet.save(out_path, format="PNG", optimize=True)
    print(f"{target_item} ({gender}): recolored from {source_item} ({n} material cluster(s)) -> {out_path}")
    return True


def copy_anchor_entries(source_item, target_item):
    if not os.path.exists(ANCHOR_TABLE_PATH):
        return
    with open(ANCHOR_TABLE_PATH, "r", encoding="utf-8") as f:
        table = json.load(f)
    copied = []
    for key, buckets in table.items():
        if key == "_readme":
            continue
        if key == "running":
            for category, items in buckets.items():
                if source_item in items:
                    table["running"].setdefault(category, {})[target_item] = items[source_item]
                    copied.append(f"running/{category}")
            continue
        if source_item in buckets:
            table[key][target_item] = buckets[source_item]
            copied.append(key)
    with open(ANCHOR_TABLE_PATH, "w", encoding="utf-8") as f:
        json.dump(table, f, indent=2)
        f.write("\n")
    print(f"  anchor entries copied for buckets: {copied}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: python scripts/palette_swap_equipment_layer.py <source_item> <target_item> [n_materials] [gender]")
        sys.exit(1)
    source_item, target_item = sys.argv[1], sys.argv[2]
    n_materials = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    gender = sys.argv[4] if len(sys.argv) > 4 else "male"
    if build_recolor(source_item, target_item, n_materials, gender):
        copy_anchor_entries(source_item, target_item)
    print("done")
