"""Chakni and Jali: final logo sets.

Marks share one bar system (bars 5.54 wide on an 8.03 pitch, a 72-unit-wide silhouette). Chakni: a disc whose bars
are cut and drip below in finer bars. Jali: an arch of three panels: five tall bars, and on the right four bars above
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
VB = (12, 2, 76, 92)            # one box for both marks, so they size alike
FONT = TTFont(FONT_PATH)

def rect(x, y, w, h): return f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{max(h, 0):.2f}"/>'

def chakni(c, uid, small=False):
    if small:
        # Five bars cut flat, three drips from the centre, nothing at the sides: at 16px the side steps of the full
        # mark read as eye sockets (a skull), so the small one keeps only the pour.
        W, P = 9.0, 14.0
        xs = [CX + (i - 2) * P for i in range(5)]
        edge = xs[0] + W / 2
        sides = rect(0, 0, edge, CY + 8) + rect(100 - edge, 0, edge, CY + 8)
        upper = "".join(rect(x - W / 2, 0, W, CY + 8) for x in xs[1:-1])
        # Below the cut: the disc's lower edges and two inner bars (inside the disc), and one drip from the centre.
        dt = CY + 13.0
        lower = rect(0, dt, edge, 60) + rect(100 - edge, dt, edge, 60) + "".join(rect(CX + s * P - W / 2, dt, W, 60) for s in (-1, 1))
        drip = rect(CX - W / 2, dt, W, CY + 50.6 - dt)
        return (f'<defs><clipPath id="{uid}d"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath></defs>'
                f'<g fill="{c}"><g clip-path="url(#{uid}d)">{sides}{upper}{lower}</g>{drip}</g>')
    else:
        W, P = 5.54, 8.03
        xs = [CX + (i - 4) * P for i in range(9)]
        upper_bottom = {1: 1.7, 2: 4.9, 3: 7.4, 4: 7.4}
        rows = [(24.6, 4.6, 5.2, 21.4), (18.2, 3.4, 8.4, 26.0), (12.9, 3.2, 11.5, 28.5), (7.8, 3.2, 15.2, 41.6), (2.6, 3.2, 20.5, 50.6)]
        side_bottom = 13.4
    n = len(xs)
    edge = xs[0] + W / 2
    sides = rect(0, 0, edge, CY + side_bottom) + rect(100 - edge, 0, edge, CY + side_bottom)
    upper = "".join(rect(x - W / 2, 0, W, CY + upper_bottom[min(i, n - 1 - i)]) for i, x in enumerate(xs) if 0 < i < n - 1)
    bars = lambda rs: "".join(rect(CX + s * dx - w / 2, CY + t, w, b - t) for dx, w, t, b in rs for s in (-1, 1))
    k = 1 if small else 3
    short, drips = [(dx, w, t, 60) for dx, w, t, b in rows[:k]], rows[k:]
    return (f'<defs><clipPath id="{uid}d"><circle cx="{CX}" cy="{CY}" r="{R}"/></clipPath>'
            f'<clipPath id="{uid}i"><circle cx="{CX}" cy="{CY}" r="{0.9 * R}"/></clipPath></defs>'
            f'<g fill="{c}"><g clip-path="url(#{uid}d)">{sides}{upper}</g><g clip-path="url(#{uid}i)">{bars(short)}</g>{bars(drips)}</g>')

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
    tile = svg((0, 0, 100, 100), f'<rect width="100" height="100" rx="22" fill="{INK}"/><g transform="translate(20 15) scale(0.92)">'
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
