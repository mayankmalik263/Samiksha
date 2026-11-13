"""Re-render the web icon PNGs. Headless Chrome on Windows crops small windows, so we render each SVG at
1024 px inside a larger window, crop the top-left 1024 px, then downscale with Pillow."""
import base64, os, sys, tempfile
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".claude", "skills", "logo-design", "scripts"))
from render_png import screenshot_html

BIG = 1024
def render(svg_text, out_png, size, height=None):
    """size = output width; height defaults to square. Rendered at 2x the output (min 1024 wide), then downscaled."""
    height = height or size
    bw = max(BIG, size * 2); bh = round(bw * height / size)
    data = base64.b64encode(svg_text.encode()).decode()
    page = (f"<!doctype html><html><head><style>html,body{{margin:0;background:transparent}}img{{display:block;"
            f"width:{bw}px;height:{bh}px}}</style></head><body><img src='data:image/svg+xml;base64,{data}'></body></html>")
    with tempfile.TemporaryDirectory() as tmp:
        html, shot = os.path.join(tmp, "p.html"), os.path.join(tmp, "s.png")
        open(html, "w").write(page)
        screenshot_html(html, shot, bw + 200, bh + 200)
        Image.open(shot).convert("RGBA").crop((0, 0, bw, bh)).resize((size, height), Image.LANCZOS).save(out_png)

tile = open("logo/samiksha-symbol-app-icon.svg", encoding="utf-8").read()
fav = open("web/favicon.svg", encoding="utf-8").read()
small_body = open("logo/samiksha-symbol-small.svg", encoding="utf-8").read().split("</title>", 1)[1].replace("</svg>", "")
maskable = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#FBFAF6"/>'
            f'<g transform="translate(51.2 51.2) scale(0.6)">{small_body}</g></svg>')
import re
for f in ["samiksha-horizontal", "samiksha-horizontal-black", "samiksha-horizontal-white", "samiksha-horizontal-mono-4338ca",
          "samiksha-horizontal-reversed", "samiksha-stacked"]:
    src = open(f"logo/{f}.svg", encoding="utf-8").read()
    w, h = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', src).groups())
    render(src, f"logo/{f}-1200.png", 1200, round(1200 * h / w)); print("wrote", f + "-1200.png")
for name, src, size in [("apple-touch-icon.png", tile, 180), ("icon-192.png", tile, 192), ("icon-512.png", tile, 512),
                        ("maskable-512.png", maskable, 512), ("favicon-16.png", fav, 16), ("favicon-32.png", fav, 32),
                        ("favicon-48.png", fav, 48)]:
    render(src, os.path.join("web", name), size); print("wrote", name)
Image.open("web/favicon-48.png").save("web/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("wrote favicon.ico")
