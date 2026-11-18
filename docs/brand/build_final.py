"""Chakni and Jali: final logo sets.

Marks share one bar system (bars 5.54 wide on an 8.03 pitch, a 72-unit-wide silhouette). Chakni: a round strainer whose
finer lower bars taper into one stream and a single drop. Jali: an arch of three panels: five tall bars, and on the right four bars above
a stack of flat bars; mullion and transom are gutters three times the bar gap. Small versions (16-32px) use fewer,
heavier bars on the same plan. Wordmarks: Atkinson Hyperlegible Next SemiBold, outlined, tracked -2.5%; the j's
descender is shortened so "jali" sits level beside the arch.

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

def jali(c, uid, small=False):
    sill = 92.3
    if small:
        W, GAP, nl, nr, flats = 9.0, 4.6, 3, 2, 3
    else:
        W, GAP, nl, nr, flats = 5.54, 2.49, 5, 4, 5
    P, G = W + GAP, 3 * GAP
    total = (nl + nr) * W + (nl + nr - 2) * GAP + G
    lefts = [CX - total / 2 + i * P for i in range(nl)]
    xr = lefts[-1] + W + G
    rights = [xr + i * P for i in range(nr)]
    stack_top = sill - flats * W - (flats - 1) * GAP
    cut = stack_top - G
    body = ("".join(rect(x, 0, W, sill) for x in lefts) + "".join(rect(x, 0, W, cut) for x in rights)
            + "".join(rect(xr, stack_top + k * P, 100, W) for k in range(flats)))
    arch = f'M{CX - R} {sill}V{CY}A{R} {R} 0 0 1 {CX + R} {CY}V{sill}Z'
    return f'<defs><clipPath id="{uid}a"><path d="{arch}"/></clipPath></defs><g fill="{c}" clip-path="url(#{uid}a)">{body}</g>'

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
        # Horizontal lockup: mark height 92; wordmark x-height ~ 0.45 of the mark, baseline at the mark's 80%.
        word, end = wordmark(name, 64, VB[0] + VB[2] + 20, VB[1] + 78, c)
        w = end + 4 - VB[0]
        save(f"{d}/{name}-lockup{theme}.svg", svg((VB[0], VB[1], round(w, 1), VB[3]), mark(c, f"l{theme}") + word))
        # Stacked lockup: mark above, wordmark centred below.
        word2, end2 = wordmark(name, 46, 0, 0, c)
        cw = max(VB[2], end2) + 16
        mx = (cw - VB[2]) / 2 - VB[0]
        stacked = f'<g transform="translate({mx:.2f} {-VB[1]})">{mark(c, f"t{theme}")}</g><g transform="translate({(cw - end2) / 2:.2f} {VB[3] + 44})">{word2}</g>'
        save(f"{d}/{name}-stacked{theme}.svg", svg((0, 0, round(cw, 1), VB[3] + 60), stacked))
    # Favicon: the small mark, ink in light mode, white in dark mode.
    fav = svg((4, 2, 92, 92), f'<style>g{{fill:{INK}}}@media (prefers-color-scheme:dark){{g{{fill:{PAPER}}}}}</style>' + mark("currentColor", "f", small=True).replace('fill="currentColor"', ""))
    save(f"{d}/favicon.svg", fav)
    # App icon tile (for PNG export: apple-touch, 512).
    k = 70 / VB[3]                                       # the mark box, 70 tall, centred on the tile
    tile = svg((0, 0, 100, 100), f'<rect width="100" height="100" rx="22" fill="{INK}"/><g transform="translate({(100 - VB[2] * k) / 2:.2f} 15) scale({k:.4f})">'
               f'<g transform="translate({-VB[0]} {-VB[1]})">{mark(PAPER, "a", small=True)}</g></g>')
    save(f"{d}/{name}-app-icon.svg", tile)
    # Social preview (GitHub 1280x640): the lockup, centred on ink.
    word3, end3 = wordmark(name, 150, 0, 0, PAPER)
    mh = 300; scale = mh / VB[3]
    total = VB[2] * scale + 60 + end3
    x0 = (1280 - total) / 2
    social = (f'<rect width="1280" height="640" fill="{INK}"/>'
              f'<g transform="translate({x0:.1f} {(640 - mh) / 2:.1f}) scale({scale:.4f}) translate({-VB[0]} {-VB[1]})">{mark(PAPER, "g")}</g>'
              f'<g transform="translate({x0 + VB[2] * scale + 60:.1f} {(640 - mh) / 2 + mh * 0.82:.1f})">{word3}</g>')
    save(f"{d}/{name}-social.svg", svg((0, 0, 1280, 640), social, 1280, 640))
print("ok")
