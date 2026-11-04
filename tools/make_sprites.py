#!/usr/bin/env python3
"""
Pocket Farm sprite-sheet generator.
Run:  python3 tools/make_sprites.py      (needs: pip install pillow)
Outputs (in assets/):
  crops.png    17 rows x 8 cols, 128px cells  (cols 0-3 growth stages, cols 4-7 idle bounce of the harvested item)
  items.png    11 rows x 8 cols, 128px cells  (coin, star, sprinklers, fertilizer, crate, soil, burst, icons)
  sprites.json frame map used by src/sprites.js
Edit the CROPS / ITEM_ROWS tables below to restyle or add art, then re-run.
"""
import json, math, os
from PIL import Image, ImageDraw, ImageFilter, ImageChops, ImageFont

CELL, SS, COLS = 128, 4, 8
W = CELL * SS
OUT = (58, 36, 28, 255)          # thick outline colour (warm dark brown)
OW = 5                           # outline width in 128-space px
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')

def S(v): return v * SS
def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
def lighten(c, t): return tuple(int(c[i] + (255 - c[i]) * t) for i in range(3)) + (255,)
def darken(c, t): return tuple(int(c[i] * (1 - t)) for i in range(3)) + (255,)

def new(): return Image.new('RGBA', (W, W), (0, 0, 0, 0))

# ---------- shape helpers: each returns a mask-painter  f(draw, grow) ----------
def ell(cx, cy, rx, ry):
    def f(d, g=0):
        d.ellipse([S(cx - rx) - g * SS, S(cy - ry) - g * SS, S(cx + rx) + g * SS, S(cy + ry) + g * SS], fill=255)
    return f

def poly(pts):
    P = [(S(x), S(y)) for x, y in pts]
    def f(d, g=0):
        d.polygon(P, fill=255)
        if g: d.line(P + [P[0]], fill=255, width=int(g * SS * 2), joint='curve')
    return f

def egg(cx, cy, rx, ry, ang=0, taper=0.0, n=64):
    """rotated egg/teardrop: taper>0 narrows the +x end."""
    pts = []
    ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    for i in range(n):
        t = 2 * math.pi * i / n
        x = rx * math.cos(t)
        y = ry * math.sin(t) * (1 - taper * (x / rx + 1) / 2)
        pts.append((cx + x * ca - y * sa, cy + x * sa + y * ca))
    return poly(pts)

def leaf(cx, cy, length, width, ang):
    """pointed leaf with base at (cx,cy) pointing along ang (deg, 0 = up)."""
    pts = []
    a = math.radians(ang)
    for i in range(0, 21):
        t = i / 20
        w = math.sin(math.pi * t) ** 0.8 * width / 2
        pts.append((t * length, w))
    for i in range(20, -1, -1):
        t = i / 20
        w = math.sin(math.pi * t) ** 0.8 * width / 2
        pts.append((t * length, -w))
    out = []
    for x, y in pts:   # x runs along leaf, rotate so x axis points to angle
        rx = x * math.sin(a) + y * math.cos(a)
        ry = -x * math.cos(a) + y * math.sin(a)
        out.append((cx + rx, cy + ry))
    return poly(out)

def star_pts(cx, cy, ro, ri, n=5, rot=-90):
    pts = []
    for i in range(n * 2):
        r = ro if i % 2 == 0 else ri
        t = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(t), cy + r * math.sin(t)))
    return pts

def rrect(x0, y0, x1, y1, r):
    def f(d, g=0):
        d.rounded_rectangle([S(x0) - g * SS, S(y0) - g * SS, S(x1) + g * SS, S(y1) + g * SS], radius=S(r) + g * SS, fill=255)
    return f

def line_shape(pts, width):
    P = [(S(x), S(y)) for x, y in pts]
    def f(d, g=0):
        d.line(P, fill=255, width=int(S(width) + 2 * g * SS), joint='curve')
        for p in (P[0], P[-1]):
            r = S(width) / 2 + g * SS
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)
    return f

def mask_of(painter, grow=0):
    m = Image.new('L', (W, W), 0)
    painter(ImageDraw.Draw(m), grow)
    return m

def part(img, painter, c1, c2=None, ow=OW, gloss=True, outline=OUT):
    """thick outline + vertical glossy gradient + highlight."""
    c2 = c2 or darken(c1, 0.22)
    if ow:
        img.paste(outline, mask=mask_of(painter, ow))
    m = mask_of(painter, 0)
    bb = m.getbbox()
    if not bb: return
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    g = Image.linear_gradient('L').resize((w, h))
    layer = Image.composite(Image.new('RGBA', (w, h), c2), Image.new('RGBA', (w, h), c1), g)
    img.paste(layer, bb[:2], m.crop(bb))
    if gloss and w > S(14) and h > S(14):
        hl = Image.new('L', (W, W), 0)
        ImageDraw.Draw(hl).ellipse([bb[0] + w * 0.14, bb[1] + h * 0.10, bb[0] + w * 0.52, bb[1] + h * 0.40], fill=255)
        hl = ImageChops.multiply(hl, m).point(lambda v: int(v * 0.55))
        img.paste((255, 255, 255, 255), mask=hl)
    return bb

def dots(img, pts, r, color):
    d = ImageDraw.Draw(img)
    for x, y in pts:
        d.ellipse([S(x - r), S(y - r), S(x + r), S(y + r)], fill=color)

def strokes(img, pts_list, width, color):
    d = ImageDraw.Draw(img)
    for pts in pts_list:
        d.line([(S(x), S(y)) for x, y in pts], fill=color, width=int(S(width)), joint='curve')

def shadow(img, cx, cy, rx, ry, a=70):
    sh = Image.new('L', (W, W), 0)
    ImageDraw.Draw(sh).ellipse([S(cx - rx), S(cy - ry), S(cx + rx), S(cy + ry)], fill=a)
    img.paste((40, 25, 15, 255), mask=sh.filter(ImageFilter.GaussianBlur(S(1.5))))

def to_cell(img):
    return img.resize((CELL, CELL), Image.LANCZOS)

G1, G2 = hexc('#9be564'), hexc('#3fae3a')   # leaf greens
SOIL1, SOIL2 = hexc('#b9824f'), hexc('#7a4a2a')

# ================== PRODUCE (the harvested item), drawn bottom-anchored ==================
def produce(kind):
    im = new()
    B = 108  # baseline y
    if kind == 'kangkong':
        for ang, L in ((-28, 56), (28, 56), (0, 66)):
            part(im, leaf(64, B - 4, L, 26, ang), G1, G2)
    elif kind == 'pechay':
        part(im, egg(50, B - 28, 11, 30, 8), hexc('#f3fbd4'), hexc('#c5de8d'))
        part(im, egg(78, B - 28, 11, 30, -8), hexc('#f3fbd4'), hexc('#c5de8d'))
        part(im, egg(64, B - 30, 12, 34, 0), hexc('#fbffe6'), hexc('#cfe596'))
        for ang in (-35, 35, 0):
            part(im, leaf(64, B - 46, 38, 30, ang), hexc('#6fd35a'), hexc('#2f9a3d'))
    elif kind == 'mustasa':
        for ang, L in ((-50, 48), (-22, 58), (0, 64), (22, 58), (50, 48)):
            part(im, leaf(64, B - 2, L, 22, ang), hexc('#b5e35a'), hexc('#4f9a2a'))
    elif kind == 'strawberry':
        pts = []
        for i in range(48):
            t = 2 * math.pi * i / 48
            x = 30 * math.sin(t) * (1 - 0.25 * math.cos(t) * 0)
            y = -30 * math.cos(t) * 0.95 + (8 * math.cos(t) * math.cos(t) if math.cos(t) < 0 else 0)
            pts.append((64 + x * (0.82 + 0.18 * (1 + math.cos(t)) / 2), B - 36 + y * 1.0 + (24 if math.cos(t) < 0 else 0) * (1 - abs(math.sin(t)) ** 2) * 0.6))
        part(im, poly(pts), hexc('#ff6b6b'), hexc('#d6203c'))
        dots(im, [(54, 70), (70, 66), (60, 84), (76, 80), (50, 86), (64, 96)], 1.8, hexc('#ffe48a'))
        part(im, poly(star_pts(64, B - 66, 20, 8, 5)), hexc('#7be04e'), hexc('#2f9a3d'), ow=3, gloss=False)
    elif kind == 'talong':
        part(im, egg(64, B - 36, 42, 20, -62, 0.55), hexc('#a06bff'), hexc('#4a2a9a'))
        part(im, poly(star_pts(86, B - 70, 17, 8, 5, -30)), hexc('#7be04e'), hexc('#2f9a3d'), ow=3, gloss=False)
    elif kind == 'kamatis':
        part(im, ell(64, B - 30, 36, 31), hexc('#ff7a6b'), hexc('#d6202e'))
        part(im, poly(star_pts(64, B - 58, 20, 8, 6)), hexc('#7be04e'), hexc('#2f9a3d'), ow=3, gloss=False)
    elif kind == 'kalabasa':
        part(im, ell(38, B - 28, 24, 30), hexc('#ffae3d'), hexc('#d9701a'))
        part(im, ell(90, B - 28, 24, 30), hexc('#ffae3d'), hexc('#d9701a'))
        part(im, ell(64, B - 30, 28, 34), hexc('#ffc060'), hexc('#e0801f'))
        part(im, rrect(58, B - 74, 70, B - 56, 4), hexc('#9a6a3a'), hexc('#5a3a1a'), gloss=False)
    elif kind == 'mais':
        part(im, leaf(64, B, 64, 38, -34), hexc('#9be564'), hexc('#3fae3a'))
        part(im, leaf(64, B, 64, 38, 34), hexc('#9be564'), hexc('#3fae3a'))
        part(im, egg(64, B - 44, 36, 20, -90, 0.35), hexc('#ffe14d'), hexc('#f0a81c'))
        dots(im, [(64 + dx, B - 44 + dy) for dx in (-8, 0, 8) for dy in (-16, -6, 6, 16, 26)], 2.0, hexc('#fff3a0'))
    elif kind == 'palay':
        strokes(im, [[(64, B), (64, 50), (78, 30)]], 7, OUT)
        strokes(im, [[(64, B), (64, 50), (78, 30)]], 3.2, hexc('#8fcf4a'))
        for i, (x, y, a) in enumerate([(80, 32, 20), (74, 44, 40), (86, 44, 10), (66, 58, 60), (80, 58, 30), (60, 72, 70), (72, 72, 40)]):
            part(im, egg(x, y, 9, 5, a), hexc('#ffe27a'), hexc('#e0a72a'), ow=3)
    elif kind == 'ampalaya':
        part(im, egg(64, B - 36, 46, 17, -70, 0.5), hexc('#6fdc6a'), hexc('#2a8f3a'))
        dots(im, [(52, 70), (62, 56), (70, 76), (78, 46), (66, 90)], 3.0, hexc('#2a8f3a'))
    elif kind == 'sibuyas':
        part(im, leaf(64, B - 50, 34, 14, -12), G1, G2, ow=3)
        part(im, egg(64, B - 30, 33, 29, 0, 0), hexc('#d86bff'), hexc('#8a2db0'))
        part(im, poly([(54, B - 52), (64, B - 76), (74, B - 52)]), hexc('#e8a0ff'), hexc('#a040c8'), ow=4)
        strokes(im, [[(50, B - 30), (48, B - 14)], [(64, B - 24), (64, B - 8)], [(78, B - 30), (80, B - 14)]], 2, OUT)
    elif kind == 'bawang':
        part(im, egg(64, B - 28, 34, 28, 0, 0), hexc('#fffbe9'), hexc('#d9d0b0'))
        part(im, poly([(54, B - 48), (64, B - 80), (74, B - 48)]), hexc('#fffbe9'), hexc('#d9d0b0'), ow=4)
        strokes(im, [[(52, B - 44), (46, B - 12)], [(64, B - 52), (64, B - 8)], [(76, B - 44), (82, B - 12)]], 2, hexc('#b8ad88'))
    elif kind == 'kamote':
        part(im, egg(64, B - 30, 46, 19, -22, 0.55), hexc('#d27bd0'), hexc('#7a2d78'))
        strokes(im, [[(42, B - 22), (56, B - 28)], [(62, B - 18), (76, B - 26)]], 2, hexc('#f0b0ee'))
    elif kind == 'gabi':
        part(im, ell(64, B - 28, 34, 28), hexc('#c99a6a'), hexc('#7a5230'))
        strokes(im, [[(36, B - 34), (92, B - 34)], [(40, B - 20), (88, B - 20)]], 2.5, hexc('#7a5230'))
        part(im, leaf(64, B - 50, 34, 30, 0), hexc('#6fd35a'), hexc('#2f9a3d'), ow=3)
    elif kind == 'mangga':
        part(im, egg(60, B - 36, 38, 30, -35, 0.15), hexc('#ffd24d'), hexc('#ff8a2a'))
        part(im, leaf(80, B - 66, 30, 16, 50), G1, G2, ow=3)
    elif kind == 'calamansi':
        part(im, ell(46, B - 24, 22, 20), hexc('#f4ef5a'), hexc('#8fc22a'))
        part(im, ell(80, B - 28, 24, 22), hexc('#f4ef5a'), hexc('#8fc22a'))
        part(im, leaf(62, B - 50, 30, 16, 20), G1, G2, ow=3)
    elif kind == 'grapes':
        rows = [(64, 36, 4), (52, 52, 3), (76, 52, 3), (40, 68, 2), (64, 68, 3), (88, 68, 2), (52, 84, 2), (76, 84, 2), (64, 98, 1)]
        for x, y, _ in rows:
            part(im, ell(x, y, 15, 15), hexc('#b57bff'), hexc('#5a2aa8'), ow=3.5)
        part(im, line_shape([(64, 30), (66, 14)], 5), hexc('#9a6a3a'), hexc('#5a3a1a'), gloss=False, ow=3)
        part(im, leaf(68, 22, 28, 16, 60), G1, G2, ow=3)
    elif kind == 'avocado':
        part(im, egg(64, B - 36, 36, 31, -90, 0.5), hexc('#6fbf4a'), hexc('#2a5a22'))
        part(im, egg(64, B - 34, 22, 19, -90, 0.5), hexc('#e8f58a'), hexc('#a8cf4a'), ow=0, gloss=False)
        part(im, ell(64, B - 30, 10, 10), hexc('#b9824f'), hexc('#6a3e1e'), ow=3)
    elif kind == 'pineapple':
        for ang, L in ((-40, 40), (-18, 52), (0, 58), (18, 52), (40, 40)):
            part(im, leaf(64, B - 56, L, 16, ang), hexc('#7be04e'), hexc('#2f9a3d'), ow=3.5)
        part(im, egg(64, B - 32, 32, 28, -90, 0), hexc('#ffd24d'), hexc('#e08a1a'))
        strokes(im, [[(46, B - 52), (82, B - 12)], [(82, B - 52), (46, B - 12)], [(40, B - 32), (88, B - 32)]], 2, hexc('#a85a10'))
    return im

# crop table: id -> (produce kind, leaf tint for the growing plant)
CROPS = [
    ('kangkong', 'kangkong'), ('pechay', 'pechay'), ('mustasa', 'mustasa'), ('sitaw', 'strawberry'), ('talong', 'talong'),
    ('kamatis', 'kamatis'), ('kalabasa', 'kalabasa'), ('mais', 'mais'), ('palay', 'palay'), ('ampalaya', 'ampalaya'),
    ('sibuyas', 'sibuyas'), ('bawang', 'bawang'), ('kamote', 'kamote'), ('gabi', 'gabi'),
    ('mangga', 'mangga'), ('calamansi', 'calamansi'), ('dragonfruit', 'grapes'), ('durian', 'avocado'), ('mangosteen', 'pineapple'),
]

def fit(img, scale, sx=1.0, sy=1.0, anchor_y=112):
    """scale & squash a transparent layer, keep bottom centred on anchor_y."""
    bb = img.getbbox()
    if not bb: return img
    c = img.crop(bb)
    w, h = int(c.width * scale * sx), int(c.height * scale * sy)
    c = c.resize((max(1, w), max(1, h)), Image.LANCZOS)
    out = new()
    out.paste(c, (W // 2 - w // 2, S(anchor_y) - h), c)
    return out

def soil_mound():
    im = new()
    shadow(im, 64, 106, 40, 8, 80)
    part(im, ell(64, 98, 38, 18), SOIL1, SOIL2)
    dots(im, [(46, 96), (58, 90), (74, 94), (84, 100), (66, 102)], 2, darken(SOIL2, 0.2))
    return im

def plant_frame(kind, stage):
    im = soil_mound()
    if stage == 0:
        part(im, egg(64, 88, 9, 6, -20), hexc('#fff0c0'), hexc('#d9b873'), ow=3)
    elif stage == 1:
        strokes(im, [[(64, 90), (64, 62)]], 6, OUT); strokes(im, [[(64, 90), (64, 62)]], 2.6, hexc('#7be04e'))
        part(im, leaf(64, 66, 22, 14, -55), G1, G2, ow=3.5); part(im, leaf(64, 66, 22, 14, 55), G1, G2, ow=3.5)
    else:
        strokes(im, [[(64, 92), (64, 48)]], 7, OUT); strokes(im, [[(64, 92), (64, 48)]], 3.2, hexc('#7be04e'))
        for a, y, L in ((-60, 74, 26), (60, 74, 26), (-35, 58, 30), (35, 58, 30), (0, 48, 28)):
            part(im, leaf(64, y, L, 17, a), G1, G2, ow=3.5)
        if stage == 3:
            p = fit(produce(kind), 0.58, anchor_y=102)
            im.alpha_composite(p)
            dots(im, [(30, 40), (98, 36), (22, 66), (106, 62)], 3, hexc('#fff6a0'))
    return im

def crops_sheet():
    sheet = Image.new('RGBA', (COLS * CELL, len(CROPS) * CELL), (0, 0, 0, 0))
    for r, (cid, kind) in enumerate(CROPS):
        frames = [plant_frame(kind, s) for s in range(4)]
        base = produce(kind)
        squash = [(1.0, 1.0), (1.10, 0.90), (0.94, 1.08), (1.03, 0.98)]
        for sx, sy in squash:
            f = new(); shadow(f, 64, 114, 34 * sx, 7); f.alpha_composite(fit(base, 0.9, sx, sy, anchor_y=112)); frames.append(f)
        for c, f in enumerate(frames):
            sheet.paste(to_cell(f), (c * CELL, r * CELL))
        print('crop', cid)
    sheet.save(os.path.join(OUT_DIR, 'crops.png'))

# ================== ITEMS ==================
def coin(i):
    im = new(); w = max(0.14, abs(math.cos(2 * math.pi * i / 8)))
    shadow(im, 64, 112, 28 * w + 6, 6)
    part(im, ell(64, 62, 36 * w, 36), hexc('#ffe45c'), hexc('#f0a017'))
    if w > 0.3:
        part(im, ell(64, 62, 26 * w, 26), hexc('#ffd23a'), hexc('#e08a10'), ow=2.5, gloss=False)
        strokes(im, [[(64 - 7 * w, 50), (64 - 7 * w, 76)], [(64 + 5 * w, 50), (64 + 5 * w, 76)]], 4 * w, hexc('#b5650a'))
        strokes(im, [[(64 - 14 * w, 56), (64 + 14 * w, 56)], [(64 - 14 * w, 62), (64 + 14 * w, 62)]], 3.2, hexc('#b5650a'))
    return im

def star(i):
    im = new(); s = 1 + 0.12 * math.sin(2 * math.pi * i / 8)
    part(im, poly(star_pts(64, 66, 50 * s, 24 * s)), hexc('#fff06a'), hexc('#ffb320'))
    return im

def sprinkler(i, tier):
    cols = {1: ('#6ec6ff', '#2a7fd6'), 2: ('#4fe3d0', '#16988e'), 3: ('#ffe45c', '#f0a017')}[tier]
    im = new()
    shadow(im, 64, 116, 26, 5)
    part(im, rrect(48, 86, 80, 112, 8), hexc(cols[0]), hexc(cols[1]))
    part(im, rrect(56, 62, 72, 90, 5), hexc('#c9d3dc'), hexc('#8795a3'))
    part(im, ell(64, 58, 16, 10), hexc(cols[0]), hexc(cols[1]), ow=4)
    for k in range(3 + tier):
        ph = ((i / 8) + k / (3 + tier)) % 1.0
        ang = -60 + k * (120 / (2 + tier))
        vx, vy = math.sin(math.radians(ang)) * 46, -math.cos(math.radians(ang)) * 46
        x = 64 + vx * ph; y = 56 + vy * ph + 90 * ph * ph
        r = 5 * (1 - 0.4 * ph) if tier < 3 else 5.5
        if y < 120:
            part(im, ell(x, y, r, r * 1.3), hexc('#bfe8ff') if tier < 3 else hexc('#fff3a0'), hexc('#4aa8ff') if tier < 3 else hexc('#ffb320'), ow=2, gloss=False)
    return im

def fertilizer(i):
    im = new(); bounce = [0, -5, -8, -5, 0, 2, 0, 0][i]; sy = [1, 1.02, 1.04, 1.02, 1, .95, 1, 1][i]
    base = new()
    shadow(base, 64, 116, 32, 6)
    part(base, egg(64, 82, 36, 34, 0, 0), hexc('#d9a066'), hexc('#8a5a2a'))
    part(base, poly([(44, 56), (52, 40), (76, 40), (84, 56)]), hexc('#e6b57a'), hexc('#a3703a'), ow=4)
    part(base, rrect(48, 46, 80, 54, 3), hexc('#ff6b6b'), hexc('#c4202e'), ow=3, gloss=False)
    part(base, leaf(64, 100, 30, 24, -20), G1, G2, ow=3)
    part(base, leaf(64, 100, 30, 24, 20), G1, G2, ow=3)
    c = fit(base, 1.0, 1.0, sy, anchor_y=122 + bounce)
    return c

def crate(i):
    im = new(); a = [0, -7, 7, -6, 6, -3, 3, 0][i]
    b = new(); shadow(b, 64, 116, 38, 6)
    part(b, rrect(24, 62, 104, 112, 8), hexc('#d99a52'), hexc('#8a5a2a'))
    part(b, rrect(18, 46, 110, 68, 8), hexc('#ecb36a'), hexc('#a3703a'))
    part(b, rrect(56, 46, 72, 112, 3), hexc('#ff6b8b'), hexc('#c4203e'), ow=3)
    part(b, ell(54, 36, 14, 10), hexc('#ff6b8b'), hexc('#c4203e'), ow=3.5); part(b, ell(74, 36, 14, 10), hexc('#ff6b8b'), hexc('#c4203e'), ow=3.5)
    part(b, ell(64, 42, 7, 7), hexc('#ff8fa8'), hexc('#c4203e'), ow=3)
    return b.rotate(a, resample=Image.BICUBIC, center=(W // 2, S(112)))

def soil(i):
    im = new()
    shadow(im, 64, 108, 52, 9, 90)
    wet = i == 2
    top, bot = (hexc('#9c6a3f'), hexc('#5e3a1f')) if wet else (hexc('#c48e57'), hexc('#8a5a2e'))
    part(im, rrect(12, 36, 116, 104, 22), top, bot)
    if i >= 1:
        for y in (54, 68, 82):
            strokes(im, [[(26, y), (102, y)]], 5, darken(bot, 0.3) if not wet else hexc('#3e2412'))
            strokes(im, [[(26, y - 3), (102, y - 3)]], 2, lighten(top, 0.25))
    if i == 3:
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([S(10), S(34), S(118), S(106)], radius=S(24), outline=hexc('#ffe45c'), width=S(5))
    if i >= 4:
        k = i - 4
        for j, (x, y) in enumerate([(30, 50), (92, 46), (60, 86), (100, 84), (24, 82)]):
            s = 7 * abs(math.sin(math.pi * ((k / 4) + j * 0.23) % math.pi))
            if s > 1:
                part(im, poly(star_pts(x, y, s + 3, (s + 3) * 0.4, 4, -90)), hexc('#fffbd0'), hexc('#ffe45c'), ow=1.5, gloss=False)
    return im

def burst(i):
    im = new(); t = (i + 1) / 8
    for k in range(10):
        a = math.radians(k * 36 + 10)
        r = 14 + 46 * t
        x, y = 64 + r * math.cos(a), 64 + r * math.sin(a)
        s = 9 * (1 - t) + 2
        col = [hexc('#ffe45c'), hexc('#ff9bd0'), hexc('#8be8ff'), hexc('#a6f06a')][k % 4]
        part(im, poly(star_pts(x, y, s + 3, (s + 3) * 0.42, 4, -90)), col, darken(col, 0.15), ow=2, gloss=False)
    return im

# --- UI tab icons (static, 8 in a row) ---
def ic_farm():
    im = new(); shadow(im, 64, 114, 40, 6)
    part(im, rrect(24, 58, 104, 108, 6), hexc('#ff6b6b'), hexc('#c4202e'))
    part(im, poly([(14, 62), (64, 20), (114, 62)]), hexc('#c98a52'), hexc('#8a5a2a'))
    part(im, rrect(50, 74, 78, 108, 4), hexc('#fff1c8'), hexc('#d9b873'), ow=4, gloss=False)
    return im
def ic_shop():
    im = new(); shadow(im, 64, 114, 40, 6)
    part(im, rrect(26, 62, 102, 108, 6), hexc('#ffe1a0'), hexc('#d9a850'))
    for k, c in enumerate(['#ff6b6b', '#fff6e0'] * 3):
        x0 = 18 + k * 15.3
        part(im, poly([(x0, 28), (x0 + 15.3, 28), (x0 + 15.3 + 2, 62), (x0 - 2, 62)]), hexc(c), darken(hexc(c), 0.18), ow=3, gloss=False)
    part(im, rrect(50, 76, 78, 108, 4), hexc('#9ad3ff'), hexc('#4a8fd6'), ow=4)
    return im
def ic_market():
    im = new(); shadow(im, 64, 114, 36, 6)
    part(im, egg(64, 78, 36, 32, 0, 0), hexc('#e6b57a'), hexc('#a3703a'))
    part(im, rrect(50, 36, 78, 52, 5), hexc('#e6b57a'), hexc('#a3703a'), ow=4)
    part(im, ell(64, 80, 17, 17), hexc('#ffe45c'), hexc('#f0a017'), ow=3.5)
    return im
def ic_bag():
    im = new(); shadow(im, 64, 114, 36, 6)
    part(im, rrect(24, 56, 104, 108, 12), hexc('#6fd35a'), hexc('#2f9a3d'))
    part(im, line_shape([(40, 56), (46, 32), (82, 32), (88, 56)], 7), hexc('#c98a52'), hexc('#8a5a2a'), ow=3, gloss=False)
    part(im, rrect(44, 78, 84, 96, 6), hexc('#fff1c8'), hexc('#d9b873'), ow=3.5)
    return im
def ic_quest():
    im = new(); shadow(im, 64, 114, 36, 6)
    part(im, rrect(30, 22, 98, 106, 8), hexc('#fff3cf'), hexc('#e6cf98'))
    part(im, ell(30, 22, 10, 10), hexc('#e6b57a'), hexc('#a3703a'), ow=4); part(im, ell(98, 106, 10, 10), hexc('#e6b57a'), hexc('#a3703a'), ow=4)
    strokes(im, [[(44, 46), (84, 46)], [(44, 62), (84, 62)], [(44, 78), (72, 78)]], 4, hexc('#a3703a'))
    return im
def ic_trophy():
    im = new(); shadow(im, 64, 114, 34, 6)
    part(im, line_shape([(34, 36), (24, 52), (44, 62)], 7), hexc('#ffd23a'), hexc('#d9941a'), ow=3, gloss=False)
    part(im, line_shape([(94, 36), (104, 52), (84, 62)], 7), hexc('#ffd23a'), hexc('#d9941a'), ow=3, gloss=False)
    part(im, poly([(34, 20), (94, 20), (86, 64), (64, 78), (42, 64)]), hexc('#ffe45c'), hexc('#f0a017'))
    part(im, rrect(56, 76, 72, 94, 3), hexc('#ffd23a'), hexc('#d9941a'), ow=3, gloss=False)
    part(im, rrect(38, 92, 90, 108, 6), hexc('#ff8a3d'), hexc('#c4501a'), ow=4)
    return im
def ic_lab():
    im = new(); shadow(im, 64, 114, 34, 6)
    part(im, poly([(52, 20), (76, 20), (76, 54), (104, 100), (96, 110), (32, 110), (24, 100), (52, 54)]), hexc('#e6fbff'), hexc('#a8d8e8'))
    part(im, poly([(44, 76), (84, 76), (102, 100), (96, 110), (32, 110), (26, 100)]), hexc('#b57bff'), hexc('#6a2fc8'), ow=3.5)
    part(im, rrect(48, 14, 80, 26, 5), hexc('#e6b57a'), hexc('#a3703a'), ow=4)
    dots(im, [(60, 92), (74, 88), (68, 100)], 3.5, hexc('#e9d4ff'))
    return im

ITEM_ROWS = [
    ('coin', [lambda i=i: coin(i) for i in range(8)]),
    ('star', [lambda i=i: star(i) for i in range(8)]),
    ('sprinkler1', [lambda i=i: sprinkler(i, 1) for i in range(8)]),
    ('sprinkler2', [lambda i=i: sprinkler(i, 2) for i in range(8)]),
    ('sprinkler3', [lambda i=i: sprinkler(i, 3) for i in range(8)]),
    ('fertilizer', [lambda i=i: fertilizer(i) for i in range(8)]),
    ('crate', [lambda i=i: crate(i) for i in range(8)]),
    ('soil', [lambda i=i: soil(i) for i in range(8)]),
    ('burst', [lambda i=i: burst(i) for i in range(8)]),
    ('icons', [ic_farm, ic_shop, ic_market, ic_bag, ic_quest, ic_trophy, ic_lab, lambda: new()]),
]

def items_sheet():
    sheet = Image.new('RGBA', (COLS * CELL, len(ITEM_ROWS) * CELL), (0, 0, 0, 0))
    for r, (name, fns) in enumerate(ITEM_ROWS):
        for c, fn in enumerate(fns):
            sheet.paste(to_cell(fn()), (c * CELL, r * CELL))
        print('items', name)
    sheet.save(os.path.join(OUT_DIR, 'items.png'))

def manifest():
    m = {
        'cell': CELL, 'cols': COLS,
        'crops': {'sheet': 'assets/crops.png', 'rows': len(CROPS), 'order': [c[0] for c in CROPS],
                  'frames': {'seed': 0, 'sprout': 1, 'growing': 2, 'ripe': 3, 'idle': [4, 7]}},
        'items': {'sheet': 'assets/items.png', 'rows': {n: i for i, (n, _) in enumerate(ITEM_ROWS)},
                  'icons': ['farm', 'shop', 'market', 'bag', 'quest', 'trophy', 'lab'],
                  'soil': {'empty': 0, 'tilled': 1, 'wet': 2, 'selected': 3, 'sparkle': [4, 7]}},
    }
    json.dump(m, open(os.path.join(OUT_DIR, 'sprites.json'), 'w'), indent=2)

if __name__ == '__main__':
    os.makedirs(OUT_DIR, exist_ok=True)
    crops_sheet(); items_sheet(); manifest()
    print('done')
