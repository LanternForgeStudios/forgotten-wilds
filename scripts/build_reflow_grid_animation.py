"""Reflows a multi-row grid sprite sheet (rows x cols of frames) into a single-row strip, so it
works with this project's frameSize-driven animation system (which only plays a single row of
frames left to right - see src/animation/characterAnimations.ts / ExplorationScene.ts's
upsertEntity). Used for the 2026-08 Pixel Crawler "General" pack migration, whose Anvil/Alchemy
Table/Furnace/Sawmill station props were exported as grids rather than strips.

Grid shape (rows, cols, cell width, cell height) is NOT auto-detected by this script - determine it
first (see docs/Map-Object-Catalog.md's "Reflowed grid animations" note): transparent-gutter
detection between cells where a real gap exists, cross-checked with column-autocorrelation where
cells are packed edge-to-edge with no gap. Pass the confirmed values in via GRIDS below.

Usage: python scripts/build_reflow_grid_animation.py
Reads from the pack's own art-staging folder, writes directly into
public/assets/sprites/structures/.
"""

from PIL import Image

STATIONS = (
    r'art-staging\tilesets\Pixel Crawler - Free Pack 2.11\Pixel Crawler - Free Pack'
    r'\Environment\Structures\Stations'
)
DEST = r'public\assets\sprites\structures'

# (src relative to STATIONS, dest filename, rows, cols, cellWidth, cellHeight)
GRIDS = [
    (r'Anvil\Anvil_01-Sheet.png', 'general-anvil-01.png', 5, 8, 64, 80),
    (r'Anvil\Anvil_02-Sheet.png', 'general-anvil-02.png', 6, 6, 80, 80),
    (r'Anvil\Anvil_03-Sheet.png', 'general-anvil-03.png', 5, 8, 96, 112),
    (r'Alchemy\Alchemy_Table_01-Sheet.png', 'general-alchemy-table-01.png', 11, 6, 32, 64),
    (r'Alchemy\Alchemy_Table_02-Sheet.png', 'general-alchemy-table-02.png', 5, 11, 48, 64),
    (r'Alchemy\Alchemy_Table_03-Sheet.png', 'general-alchemy-table-03.png', 5, 5, 80, 80),
    (r'Furnace\Bricks_01-Sheet.png', 'general-furnace-bricks-01.png', 2, 2, 32, 48),
    (r'Furnace\Bricks_02-Sheet.png', 'general-furnace-bricks-02.png', 2, 2, 48, 64),
    (r'Furnace\Bricks_03-Sheet.png', 'general-furnace-bricks-03.png', 2, 2, 48, 64),
    (r'Furnace\Iron_01-Sheet.png', 'general-furnace-iron-01.png', 2, 2, 32, 48),
    (r'Furnace\Iron_02-Sheet.png', 'general-furnace-iron-02.png', 2, 2, 48, 64),
    (r'Furnace\Iron_03-Sheet.png', 'general-furnace-iron-03.png', 2, 2, 48, 64),
    (r'Furnace\Stone_01-Sheet.png', 'general-furnace-stone-01.png', 2, 2, 32, 48),
    (r'Furnace\Stone_02-Sheet.png', 'general-furnace-stone-02.png', 2, 2, 48, 64),
    (r'Furnace\Stone_03-Sheet.png', 'general-furnace-stone-03.png', 2, 2, 48, 64),
    (r'Sawmill\Level_2-Sheet.png', 'general-sawmill-level-2.png', 8, 8, 80, 64),
    (r'Sawmill\Level_3-Sheet.png', 'general-sawmill-level-3.png', 8, 8, 112, 80),
]


def reflow(src_path: str, dest_path: str, rows: int, cols: int, cw: int, ch: int) -> None:
    img = Image.open(src_path).convert('RGBA')
    expected_w, expected_h = cols * cw, rows * ch
    if img.width != expected_w or img.height != expected_h:
        print(f'WARNING size mismatch for {dest_path}: image={img.width}x{img.height} expected={expected_w}x{expected_h}')
    total_frames = rows * cols
    out = Image.new('RGBA', (cw * total_frames, ch), (0, 0, 0, 0))
    idx = 0
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c * cw, r * ch
            out.paste(img.crop((x0, y0, x0 + cw, y0 + ch)), (idx * cw, 0))
            idx += 1
    # A rows x cols grid is frequently padded to a rectangle by the source pack even when the real
    # animation has fewer frames (the last row(s) are blank filler) - if reflowed verbatim, this
    # project's frameCount = dimensions.width / frameSize.width (see characterAnimations.ts) plays
    # straight through those transparent cells, reading as a blank-frame flash before the loop
    # restarts (reported live against general-anvil-01). Trim any fully-transparent frames off the
    # end before saving - real content is never expected after a padding gap for these packs.
    real_frames = total_frames
    while real_frames > 0:
        frame = out.crop(((real_frames - 1) * cw, 0, real_frames * cw, ch))
        if frame.getchannel('A').getextrema()[1] == 0:
            real_frames -= 1
        else:
            break
    if real_frames != total_frames:
        out = out.crop((0, 0, real_frames * cw, ch))
        print(f'  trimmed {total_frames - real_frames} trailing blank frame(s)')
    out.save(dest_path)
    print(f'{dest_path}: {rows}x{cols} grid -> {real_frames} frames, strip {out.width}x{out.height}')


if __name__ == '__main__':
    for src_rel, dest_name, rows, cols, cw, ch in GRIDS:
        reflow(f'{STATIONS}\\{src_rel}', f'{DEST}\\{dest_name}', rows, cols, cw, ch)
