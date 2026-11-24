"""Chakni and Jali: final logo sets.

Marks share one bar system (bars 5.54 wide on an 8.03 pitch, a 72-unit-wide silhouette). Chakni: a round strainer whose
finer lower bars taper into one stream and a single drop. Jali: an arched window, its frame holding three panes (one tall, two stacked) filled with a
finer lattice. Small versions (16-48px) use fewer, heavier bars on the same plan. Wordmarks: Atkinson Hyperlegible Next SemiBold, outlined, tracked -2.5%; the j's
descender is shortened. Jali's word stands on the arch's sill with its x-height at the spring line.

Run: python build_final.py <out_dir> <atkinson-600.woff>"""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.recordingPen import DecomposingRecordingPen

OUT, FONT_PATH = sys.argv[1], sys.argv[2]
INK, PAPER = "#111111", "#FFFFFF"
CX, CY, R = 50, 40, 36
VB = (12, 2, 76, 96)            # one box for both marks, so they size alike (room for Chakni's drop)
FONT = TTFont(FONT_PATH)
# Jali's lockup: the word's baseline on the arch's sill, the dots of its j and i level with the arch's crown (CY - R),
# so mark and word share a top and a baseline; the mark stands at about 88% of the word's ascender line.
SILL = 92.3
JALI_WORD = (SILL - (CY - R)) / 0.739   # about 119.5: the dots' tops are 739/1000 em above the baseline
JALI_GAP = 22.7                         # from the arch's right edge to the j's stem; its hook tucks under the corner
JALI_GAP_SMALL = 28                     # the same in the small lockup (16-32px), which needs more air
J_STEM = 0.069                          # the j's stem starts 69/1000 em right of its origin
J_DROP = 0.162 * 0.82                   # the j's shortened descender, in em

def rect(x, y, w, h): return f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{max(h, 0):.2f}"/>'

def chakni(c, uid, small=False):
    """A round strainer. Upper bars cut flat across the disc; below the cut, finer bars fill the lower disc, and the
    middle ones taper down into one stream that lets go of a single drop: pour in everything, keep what you came for.
    (The outline stays round: an earlier V-shaped lower edge read as a swimsuit.)"""
    cut = CY + (8.0 if small else 4.0)
    if small:
        W, P, fw, fp, n = 9.0, 14.0, 9.0, 14.0, 5
        # No stream when small: a thick bar over a dot reads as "!". The disc lets go of one drop instead.
        streams, dot_at, dot_r = {}, 10.0, 4.6
    else:
        W, P, fw, fp, n = 5.54, 8.03, 3.3, 8.03 * 0.66, 15
        streams, dot_at, dot_r = {0: 13.0, 1: 7.0, 2: 2.0}, 19.5, 2.1
    xs = [CX + (i - (9 if not small else 5) // 2) * P for i in range(9 if not small else 5)]
    edge = xs[0] + W / 2
    upper = rect(0, 0, edge, cut) + rect(100 - edge, 0, edge, cut) + "".join(rect(x - W / 2, 0, W, cut) for x in xs[1:-1])
    top = cut + (4.6 if small else 2.5)
    fx = [CX + (k - (n - 1) / 2) * fp for k in range(n)]
    rank = lambda x: round(abs(x - CX) / fp)
    lower = "".join(rect(x - fw / 2, top, fw, 60) for x in fx if rank(x) not in streams)
    if small:  # the disc's lower edges, so it stays round at 16px
        lower += rect(0, top, edge, 60) + rect(100 - edge, top, edge, 60)
    bottom = lambda x: CY + (R * R - (x - CX) ** 2) ** 0.5
    out = "".join(rect(x - fw / 2, top, fw, bottom(x) + streams[rank(x)] - top) for x in fx if rank(x) in streams)
    out += f'<circle cx="{CX}" cy="{CY + R + dot_at:.2f}" r="{dot_r}"/>'
    return (f'<defs><clipPath id="{uid}d"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath></defs>'
            f'<g fill="{c}"><g clip-path="url(#{uid}d)">{upper}{lower}</g>{out}</g>')

def n(v): return f"{v:.2f}".rstrip("0").rstrip(".")

def jali_path(small=False):
    """Jali: an arched window. A frame (the arch, its sill, a mullion and, on the right, a transom) holds three panes:
    one tall on the left, two stacked on the right, the layout Jali makes. A lattice fills the panes: upright bars in
    the upper panes, flat bars in the lower one, finer than the frame. Small (16-48px): a heavier frame, one bar in
    the tall pane and one flat bar below the transom. One path, even-odd: the arch, the openings cut from it, the bars
    filled back in."""
    sill, mx, ty = 92.3, 55.5, 48.0             # the mullion's and transom's centres: the panes split about 58:42
    if small:
        f, bw, lattice = 10.0, 8.0, {"left": ("v", 1), "rb": ("h", 1)}
        bw_flat = 7.0
    else:
        f, bw, lattice = 8.0, 3.5, {"left": ("v", 3), "rt": ("v", 2), "rb": ("h", 2)}
        bw_flat = bw
    r = R - f
    top = lambda x: CY - max(r * r - (x - CX) ** 2, 0) ** 0.5     # the inner arch's height at x
    def under_arch(x0, x1, y1):                                     # a shape whose top follows the inner arch
        return f"M{n(x0)} {n(y1)}V{n(top(x0))}A{n(r)} {n(r)} 0 0 1 {n(x1)} {n(top(x1))}V{n(y1)}Z"
    def box(x0, y0, x1, y1): return f"M{n(x0)} {n(y0)}H{n(x1)}V{n(y1)}H{n(x0)}Z"
    panes = {"left": (CX - R + f, mx - f / 2, None, sill - f),
             "rt": (mx + f / 2, CX + R - f, None, ty - f / 2),
             "rb": (mx + f / 2, CX + R - f, ty + f / 2, sill - f)}
    d = [f"M{CX - R} {sill}V{CY}A{R} {R} 0 0 1 {CX + R} {CY}V{sill}Z"]
    for name, (x0, x1, y0, y1) in panes.items():
        d.append(under_arch(x0, x1, y1) if y0 is None else box(x0, y0, x1, y1))
        if name not in lattice: continue
        way, k = lattice[name]
        if way == "v":                                              # upright bars, evenly spaced, tops on the arch
            gap = (x1 - x0 - k * bw) / (k + 1)
            for i in range(k):
                bx = x0 + gap + i * (bw + gap)
                d.append(under_arch(bx, bx + bw, y1))
        else:                                                       # flat bars, evenly spaced
            gap = (y1 - y0 - k * bw_flat) / (k + 1)
            for i in range(k):
                by = y0 + gap + i * (bw_flat + gap)
                d.append(box(x0, by, x1, by + bw_flat))
    return "".join(d)

def jali(c, uid, small=False):
    return f'<g fill="{c}"><path fill-rule="evenodd" d="{jali_path(small)}"/></g>'

MARKS = {"chakni": chakni, "jali": jali}

def wordmark(text, size, x0, baseline, c, tracking=-0.025):
    gs, cmap, upm = FONT.getGlyphSet(), FONT.getBestCmap(), FONT["head"].unitsPerEm
    s, x, out = size / upm, x0, []
    for ch in text:
        name = cmap[ord(ch)]
        rec = DecomposingRecordingPen(gs); gs[name].draw(rec)
        pen = SVGPathPen(None)
        def tf(pt):
            px, py = pt
            if ch == "j" and py < 0: py *= 0.82          # a shorter descender: "jali" sits level
            return (x + px * s, baseline - py * s)
        for op, args in rec.value:
            getattr(pen, op)(*[tf(a) for a in args]) if op != "closePath" and op != "endPath" else getattr(pen, op)()
        out.append(pen.getCommands())
        x += gs[name].width * s + tracking * size
    return f'<path d="{" ".join(out)}" fill="{c}"/>', x - tracking * size

def svg(vb, body, w=None, h=None, extra=""):
    x, y, vw, vh = vb
    size = f' width="{w}" height="{h}"' if w else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {vw} {vh}"{size}>{extra}{body}</svg>\n'

def save(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)

for name, mark in MARKS.items():
    d = os.path.join(OUT, name)
    for theme, c in (("", INK), ("-white", PAPER)):
        save(f"{d}/{name}-mark{theme}.svg", svg(VB, mark(c, f"m{theme}")))
        save(f"{d}/{name}-mark-small{theme}.svg", svg(VB, mark(c, f"s{theme}", small=True)))
        if name == "jali":
            # Horizontal lockup: the word stands on the sill and its dots reach the crown, so mark and word share a top
            # and a baseline. The j's descender hangs below the sill, its hook under the arch's corner.
            size, base = JALI_WORD, SILL
            word, end = wordmark(name, size, CX + R + JALI_GAP - J_STEM * size, base, c)
            box = (VB[0], VB[1], round(end + 2 - VB[0], 1), round(base + J_DROP * size + 2 - VB[1], 1))
            # Small: a looser gap, since small sizes need more air to read as apart.
            word_s, end_s = wordmark(name, size, CX + R + JALI_GAP_SMALL - J_STEM * size, base, c)
            box_s = (box[0], box[1], round(end_s + 2 - VB[0], 1), box[3])
        else:
            # Horizontal lockup: mark height 92; wordmark x-height ~ 0.45 of the mark, baseline at the mark's 80%.
            word, end = wordmark(name, 64, VB[0] + VB[2] + 20, VB[1] + 78, c)
            box = (VB[0], VB[1], round(end + 4 - VB[0], 1), VB[3])
            word_s, box_s = word, box
        save(f"{d}/{name}-lockup{theme}.svg", svg(box, mark(c, f"l{theme}") + word))
        # Small lockup, for nav bars 16-32px tall: the small mark beside the same wordmark.
        save(f"{d}/{name}-lockup-small{theme}.svg", svg(box_s, mark(c, f"k{theme}", small=True) + word_s))
        # Stacked lockup: mark above, wordmark centred below.
        if name == "jali":   # the word a little wider than the arch, its dots a gutter and a half below the sill
            size2 = 64
            base2, h2 = SILL - VB[1] + 20 + 0.739 * size2, SILL - VB[1] + 20 + 0.739 * size2 + J_DROP * size2 + 4
        else:
            size2, base2, h2 = 46, VB[3] + 44, VB[3] + 60
        word2, end2 = wordmark(name, size2, 0, 0, c)
        cw = max(VB[2], end2) + 16
        mx = (cw - VB[2]) / 2 - VB[0]
        stacked = f'<g transform="translate({mx:.2f} {-VB[1]})">{mark(c, f"t{theme}")}</g><g transform="translate({(cw - end2) / 2:.2f} {round(base2, 2)})">{word2}</g>'
        save(f"{d}/{name}-stacked{theme}.svg", svg((0, 0, round(cw, 1), round(h2, 1)), stacked))
    # Favicon: the small mark, ink in light mode, white in dark mode.
    fav = svg((4, 2, 92, 92), f'<style>g{{fill:{INK}}}@media (prefers-color-scheme:dark){{g{{fill:{PAPER}}}}}</style>' + mark("currentColor", "f", small=True).replace('fill="currentColor"', ""))
    save(f"{d}/favicon.svg", fav)
    # App icon tile (for PNG export: apple-touch, 512).
    k = 70 / VB[3]                                       # the mark box, 70 tall, centred on the tile
    tile = svg((0, 0, 100, 100), f'<rect width="100" height="100" rx="22" fill="{INK}"/><g transform="translate({(100 - VB[2] * k) / 2:.2f} 15) scale({k:.4f})">'
               f'<g transform="translate({-VB[0]} {-VB[1]})">{mark(PAPER, "a", small=True)}</g></g>')
    save(f"{d}/{name}-app-icon.svg", tile)
    # Social preview (GitHub 1280x640): the lockup, centred on ink.
    mh = 300; scale = mh / VB[3]
    if name == "jali":   # the lockup's proportions, scaled up
        size3, gap3, base3 = JALI_WORD * scale, (CX + R - VB[0] - VB[2] + JALI_GAP - J_STEM * JALI_WORD) * scale, (SILL - VB[1]) * scale
    else:
        size3, gap3, base3 = 150, 60, mh * 0.82
    word3, end3 = wordmark(name, size3, 0, 0, PAPER)
    total = VB[2] * scale + gap3 + end3
    x0 = (1280 - total) / 2
    social = (f'<rect width="1280" height="640" fill="{INK}"/>'
              f'<g transform="translate({x0:.1f} {(640 - mh) / 2:.1f}) scale({scale:.4f}) translate({-VB[0]} {-VB[1]})">{mark(PAPER, "g")}</g>'
              f'<g transform="translate({x0 + VB[2] * scale + gap3:.1f} {(640 - mh) / 2 + base3:.1f})">{word3}</g>')
    save(f"{d}/{name}-social.svg", svg((0, 0, 1280, 640), social, 1280, 640))
print("ok")
