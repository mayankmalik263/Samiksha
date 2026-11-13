"""Samiksha logo kit — concept B "Cited" in the Neel & Haldi palette. Run: python build.py
Every shape is a filled primitive (no strokes, no live text), on a 256-unit grid."""
import math
INK, NEEL, HALDI, PAPER, LILAC = "#1B1835", "#4338CA", "#D97706", "#FBFAF6", "#C7C3F4"

def P(cx, cy, r, a):
    t = math.radians(a); return f"{round(cx + r*math.cos(t), 2)} {round(cy + r*math.sin(t), 2)}"
def sector(cx, cy, R, r, a0, a1):  # annular sector, clockwise a0 -> a1 (degrees, SVG y-down)
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return f"M{P(cx,cy,R,a0)} A{R} {R} 0 {large} 1 {P(cx,cy,R,a1)} L{P(cx,cy,r,a1)} A{r} {r} 0 {large} 0 {P(cx,cy,r,a0)} Z"
def rect(x, y, w, h, fill, rx=0):
    return f'<rect fill="{fill}" x="{x}" y="{y}" width="{w}" height="{h}"' + (f' rx="{rx}"' if rx else "") + "/>"
def path(d, fill): return f'<path fill="{fill}" d="{d}"/>'

# ---------- symbol: folded citation brackets around the quoted line ----------
def symbol(stem=INK, fold=NEEL, line=INK, quote=HALDI, small=False):
    s = [path("M32 36 H60 V220 H32 Z", stem), path("M224 36 H196 V220 H224 Z", stem),
         path("M60 36 H92 L76 60 H60 Z M60 196 H76 L92 220 H60 Z", fold),
         path("M196 36 H164 L180 60 H196 Z M196 196 H180 L164 220 H196 Z", fold)]
    if small:  # 16-32 px cut: one fat quote line, nothing that can clog
        s.append(rect(88, 104, 80, 48, quote, 24))
    else:      # three source lines; the middle (longest) one is the verified quote. Optical centre: block sits 2u high.
        s += [rect(92, 78, 64, 20, line, 10), rect(92, 116, 72, 20, quote, 10), rect(92, 154, 40, 20, line, 10)]
    return "".join(s)

# ---------- wordmark: custom geometric lowercase, stroke 18, x-height 96 (y 104-200), ascender 56 ----------
W = 18
def s_(x):  # two 180-degree bowls joined by a diagonal spine (geometric-sans construction)
    R, r, c1, c2 = 27, 9, 131, 173
    cx = x + R
    k = math.cos(math.radians(30)); h = 0.5
    to, ti = (cx - R*k, c1 + R*h), (cx - r*k, c1 + r*h)          # top bowl's lower-left end (150 deg)
    bo, bi = (cx + R*k, c2 - R*h), (cx + r*k, c2 - r*h)          # bottom bowl's upper-right end (330 deg)
    spine = f"M{to[0]:.2f} {to[1]:.2f} L{ti[0]:.2f} {ti[1]:.2f} L{bo[0]:.2f} {bo[1]:.2f} L{bi[0]:.2f} {bi[1]:.2f} Z"
    return (path(sector(cx, c1, R, r, 147, 330), INK) + path(sector(cx, c2, R, r, 327, 150), INK)
            + path(spine, INK)), 2 * R

def a_(x):
    return path(sector(x + 48, 152, 48, 30, 0, 359.99), INK) + rect(x + 78, 104, W, 96, INK), 96
def arch(x0):  # half ring between stems at x0 and x0+50
    return path(sector(x0 + 34, 138, 34, 16, 180, 360), INK)
def m_(x):
    return rect(x, 104, W, 96, INK) + arch(x) + rect(x + 50, 136, W, 64, INK) + arch(x + 50) + rect(x + 100, 136, W, 64, INK), 118
def i_(x):  # the tittle is a haldi quote line: the logo's highlight, inside the name
    return rect(x, 104, W, 96, INK) + rect(x - 6, 72, 30, 18, HALDI, 9), 18
def k_(x):  # exact 45-degree arm and leg
    arm = f"M{x+12} 151 L{x+59} 104 L{x+84} 104 L{x+12} 176 Z"  # starts inside the stem: no seam
    leg = f"M{x+23} 157 L{x+36} 144 L{x+92} 200 L{x+66} 200 Z"  # tucks into the arm
    return rect(x, 56, W, 144, INK) + path(arm, INK) + path(leg, INK), 92
def h_(x):
    return rect(x, 56, W, 144, INK) + arch(x) + rect(x + 50, 136, W, 64, INK), 68

def wordmark(ink=INK, accent=HALDI):
    out, x = [], 0
    for fn, gap in ((s_, 14), (a_, 14), (m_, 16), (i_, 14), (k_, 8), (s_, 14), (h_, 14), (a_, 0)):
        g, w = fn(x); out.append(g); x += w + gap
    return "".join(out).replace(INK, ink).replace(HALDI, accent), x   # width ~702

def svg(body, w, h, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" '
            f'aria-labelledby="t"><title id="t">{title}</title>{body}</svg>\n')

if __name__ == "__main__":
    import os; os.makedirs("logo", exist_ok=True)
    wm, ww = wordmark()
    files = {
        "samiksha-symbol.svg": svg(symbol(), 256, 256, "Samiksha"),
        "samiksha-symbol-small.svg": svg(symbol(small=True), 256, 256, "Samiksha"),
        "samiksha-symbol-reversed.svg": svg(symbol(stem="#FFFFFF", fold=LILAC, line="#FFFFFF", quote="#F59E0B"), 256, 256, "Samiksha"),
        "samiksha-wordmark.svg": svg(f'<g transform="translate(6 -40)">{wm}</g>', ww + 12, 170, "Samiksha"),
        "samiksha-horizontal.svg": svg(symbol() + f'<g transform="translate(300 -24)">{wm}</g>', 300 + ww + 20, 256, "Samiksha"),
        "samiksha-stacked.svg": svg(f'<g transform="translate({(ww + 40 - 256) / 2} 0)">{symbol()}</g>'
                                    f'<g transform="translate(20 236)">{wm}</g>', ww + 40, 450, "Samiksha"),
        "samiksha-horizontal-reversed.svg": svg(symbol(stem="#FFFFFF", fold=LILAC, line="#FFFFFF", quote="#F59E0B")
                                    + f'<g transform="translate(300 -24)">{wordmark("#FFFFFF", "#F59E0B")[0]}</g>', 300 + ww + 20, 256, "Samiksha"),
    }
    for name, body in files.items():
        open(os.path.join("logo", name), "w", encoding="utf-8").write(body)
    print("wordmark width", ww, "->", ", ".join(files))
