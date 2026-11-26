import argparse
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
SOURCE = HERE / 'source'
MINI_PACK = REPO / 'src/game/assets/preview-packs/mini'

# Exact Option C ("청은 기사") palette mapping from render-options.py
KNIGHT_PALETTE = {
    (141, 151, 127): (155, 181, 197),
    (95, 113, 96): (73, 102, 132),
    (59, 54, 67): (44, 58, 82),
    (78, 72, 74): (68, 81, 108),
    (224, 57, 76): (89, 171, 225),
    (209, 75, 52): (180, 115, 57),
    (239, 145, 79): (232, 170, 80),
    (45, 105, 123): (53, 100, 174),
    (84, 135, 137): (97, 153, 217),
}

OUTLINE = (20, 27, 27, 255)
SWORD_WHITE = (255, 255, 255, 255)
SWORD_ICE = (227, 241, 245, 255)
SWORD_LIGHT = (89, 171, 225, 255)
SWORD_MID = (97, 153, 217, 255)
SWORD_DEEP = (53, 100, 174, 255)
HILT_GOLD = (232, 170, 80, 255)
HILT_BRONZE = (180, 115, 57, 255)

SLASH_COLORS = {
    'o': OUTLINE,
    'w': SWORD_WHITE,
    'i': SWORD_ICE,
    'l': SWORD_LIGHT,
    'm': SWORD_MID,
    'd': SWORD_DEEP,
    'g': HILT_GOLD,
    'b': HILT_BRONZE,
}

# Crisp pixel sword poses matching Sword.png palette
SWORD_UP_RIGHT_TILT = [
    '......oo..',
    '.....oigo.',
    '....oiwlo.',
    '...oiwmo..',
    '..oiwmo...',
    '..olmdo...',
    '.olmo.....',
    '.ogo......',
    'obg.......',
    '.o........',
]

SWORD_UP_LEFT_TILT = [
    '..oo......',
    '.ogio.....',
    '.olwio....',
    '..omwio...',
    '...omwio..',
    '...odmlo..',
    '.....omlo.',
    '......ogo.',
    '.......gbo',
    '........o.',
]

SWORD_SLASH_DIAG_DOWN_RIGHT = [
    'oo........',
    'ogoo......',
    'obblo.....',
    '..olwmo...',
    '...omwlo..',
    '....omwio.',
    '.....odwio',
    '......odwo',
    '.......ooo',
]

SWORD_SLASH_DIAG_DOWN_LEFT = [
    '........oo',
    '......oogo',
    '.....olbbo',
    '...omwlo..',
    '..olwmo...',
    '.oiwmo....',
    'oiwdo.....',
    'owdo......',
    'ooo.......',
]


def recolor(image: Image.Image) -> Image.Image:
    out = image.copy()
    out.putdata([(*KNIGHT_PALETTE.get(p[:3], p[:3]), p[3]) for p in image.getdata()])
    return out


def knight_cell(sheet: Image.Image, col: int, row: int) -> Image.Image:
    return sheet.crop((col * 16, row * 16, (col + 1) * 16, (row + 1) * 16))


def draw_pixels(img: Image.Image, ox: int, oy: int, rows: list[str], colors: dict[str, tuple[int, int, int, int]]) -> None:
    for y, line in enumerate(rows):
        for x, ch in enumerate(line):
            color = colors.get(ch)
            if color is not None and 0 <= ox + x < img.width and 0 <= oy + y < img.height:
                img.putpixel((ox + x, oy + y), color)


def build_idle(sheet: Image.Image, sword: Image.Image) -> Image.Image:
    # Match warrior-option-C.png silhouette (17x18), centered horizontally on 20x18 so flipX stays steady.
    idle = Image.new('RGBA', (20, 18), (0, 0, 0, 0))
    idle.alpha_composite(knight_cell(sheet, 0, 0), (2, 2))
    idle.alpha_composite(sword, (14, 0))
    return idle


def build_motion_sheet(sheet: Image.Image, sword: Image.Image) -> Image.Image:
    motion = Image.new('RGBA', (280, 120), (0, 0, 0, 0))
    # Flip vertically first so blade curve aims upward-right when rotated to point right.
    sword_right = sword.transpose(Image.Transpose.FLIP_LEFT_RIGHT).transpose(Image.Transpose.ROTATE_270)

    def put_cell(row_idx: int, col_idx: int, cell: Image.Image) -> None:
        motion.alpha_composite(cell, (col_idx * 40, row_idx * 40))

    # Row 0: Side (facing right)
    # Cols 0..2 hold sword cleanly forward; Col 3 tilts blade back behind shoulder without poking through helmet.
    for col_idx in range(4):
        cell = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
        if col_idx == 3:
            draw_pixels(cell, 7, 29, SWORD_UP_LEFT_TILT, SLASH_COLORS)
            cell.alpha_composite(knight_cell(sheet, 3, col_idx), (12, 24))
        else:
            sx, sy = [(21, 21), (23, 21), (21, 21)][col_idx]
            cell.alpha_composite(knight_cell(sheet, 3, col_idx), (12, 24))
            cell.alpha_composite(sword, (sx, sy))
        put_cell(0, col_idx, cell)

    # Row 0 Attack 0 (col 4): raised windup clear of the visor
    c4 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    c4.alpha_composite(knight_cell(sheet, 3, 0), (11, 24))
    draw_pixels(c4, 21, 18, SWORD_UP_RIGHT_TILT, SLASH_COLORS)
    put_cell(0, 4, c4)

    # Row 0 Attack 1 (col 5): forward lunge + horizontal sword thrust fully inside 40x40 + slash arc
    c5 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    c5.alpha_composite(knight_cell(sheet, 3, 4), (8, 24))
    c5.alpha_composite(sword_right, (22, 32))
    draw_pixels(
        c5,
        22,
        24,
        [
            '..ww.......',
            '....ii.....',
            '.....wll...',
            '......wwl..',
            '.......iwl.',
            '........wwl',
            '........iwm',
            '.......wwm.',
            '......iid..',
            '.....lld...',
            '...ww......',
        ],
        SLASH_COLORS,
    )
    put_cell(0, 5, c5)

    # Row 0 Attack 2 (col 6): follow-through slash low-right from extended hand
    c6 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    c6.alpha_composite(knight_cell(sheet, 3, 4), (10, 24))
    draw_pixels(c6, 24, 31, SWORD_SLASH_DIAG_DOWN_RIGHT, SLASH_COLORS)
    draw_pixels(
        c6,
        30,
        28,
        [
            '.i...',
            '..l..',
            '...w.',
            '..l..',
        ],
        SLASH_COLORS,
    )
    put_cell(0, 6, c6)

    # Row 1: Front (facing down)
    down_walk_sword_offsets = [(24, 21), (22, 22), (24, 21), (25, 20)]
    for col_idx in range(4):
        cell = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
        cell.alpha_composite(knight_cell(sheet, 0, col_idx), (12, 24))
        cell.alpha_composite(sword, down_walk_sword_offsets[col_idx])
        put_cell(1, col_idx, cell)

    # Row 1 Attack 0 (col 4): raise sword high on right side
    d4 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    d4.alpha_composite(knight_cell(sheet, 0, 0), (12, 24))
    d4.alpha_composite(sword, (24, 16))
    put_cell(1, 4, d4)

    # Row 1 Attack 1 (col 5): crouch lunge + low forward sweep across front without hiding visor
    d5 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    d5.alpha_composite(knight_cell(sheet, 0, 4), (12, 24))
    draw_pixels(d5, 25, 31, SWORD_SLASH_DIAG_DOWN_RIGHT, SLASH_COLORS)
    draw_pixels(
        d5,
        9,
        35,
        [
            'ww...............',
            '.iiwl............',
            '...wwwwwlli......',
            '.......iiiiwwd...',
        ],
        SLASH_COLORS,
    )
    put_cell(1, 5, d5)

    # Row 1 Attack 2 (col 6): follow-through blade angled low-left clear of the visor
    d6 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    d6.alpha_composite(knight_cell(sheet, 0, 4), (12, 24))
    draw_pixels(d6, 6, 31, SWORD_SLASH_DIAG_DOWN_LEFT, SLASH_COLORS)
    put_cell(1, 6, d6)

    # Row 2: Back (facing up)
    up_walk_sword_offsets = [(24, 21), (24, 19), (24, 21), (23, 21)]
    for col_idx in range(4):
        cell = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
        cell.alpha_composite(sword, up_walk_sword_offsets[col_idx])
        cell.alpha_composite(knight_cell(sheet, 1, col_idx), (12, 24))
        put_cell(2, col_idx, cell)

    # Row 2 Attack 0 (col 4): windup sword raised out on right
    u4 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    u4.alpha_composite(sword, (24, 18))
    u4.alpha_composite(knight_cell(sheet, 1, 0), (12, 24))
    put_cell(2, 4, u4)

    # Row 2 Attack 1 (col 5): upward thrust aligned with raised left hand + overhead crescent arc
    u5 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    u5.alpha_composite(sword, (15, 9))
    u5.alpha_composite(knight_cell(sheet, 1, 4), (12, 24))
    draw_pixels(
        u5,
        10,
        7,
        [
            '.....wwwww.....',
            '...iilllllii...',
            '.wwd.......dww.',
            'oo...........oo',
        ],
        SLASH_COLORS,
    )
    put_cell(2, 5, u5)

    # Row 2 Attack 2 (col 6): follow-through blade raised
    u6 = Image.new('RGBA', (40, 40), (0, 0, 0, 0))
    u6.alpha_composite(sword, (15, 13))
    u6.alpha_composite(knight_cell(sheet, 1, 4), (12, 24))
    put_cell(2, 6, u6)

    return motion


def main() -> None:
    parser = argparse.ArgumentParser(description='Generate Mini World Option C (Blue-Silver Knight) warrior assets.')
    parser.add_argument('--output', type=Path, default=MINI_PACK)
    parser.add_argument('--preview', type=Path)
    args = parser.parse_args()

    sheet = recolor(Image.open(SOURCE / 'Knight-SpriteSheet.png').convert('RGBA'))
    sword = recolor(Image.open(SOURCE / 'Sword.png').convert('RGBA'))

    idle = build_idle(sheet, sword)
    motion = build_motion_sheet(sheet, sword)

    args.output.mkdir(parents=True, exist_ok=True)
    idle.save(args.output / 'warrior.png')
    motion.save(args.output / 'warrior-motion.png')

    if args.preview:
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        preview = Image.new('RGBA', (280 * 3, 120 * 3 + 72), (235, 242, 235, 255))
        scaled_idle = idle.resize((idle.width * 3, idle.height * 3), Image.Resampling.NEAREST)
        preview.alpha_composite(scaled_idle, (16, 10))
        scaled_motion = motion.resize((280 * 3, 120 * 3), Image.Resampling.NEAREST)
        preview.alpha_composite(scaled_motion, (0, 72))
        draw = ImageDraw.Draw(preview)
        for r in range(3):
            for c in range(7):
                draw.rectangle((c * 120, 72 + r * 120, (c + 1) * 120 - 1, 72 + (r + 1) * 120 - 1), outline=(190, 210, 190, 255))
        preview.save(args.preview)


if __name__ == '__main__':
    main()
