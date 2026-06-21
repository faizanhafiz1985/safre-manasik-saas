"""Generate on-brand app icon + splash PNGs for the Safre Manasik mobile app.
Run:  python assets/generate_assets.py   (from the mobile/ folder)
Produces: icon.png, adaptive-icon.png, splash-icon.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

GREEN_DARK = (13, 43, 26)      # #0D2B1A
GREEN = (27, 75, 53)           # #1B4B35
GOLD = (201, 162, 39)          # #C9A227
CREAM = (247, 242, 232)        # #F7F2E8
NEAR_BLACK = (17, 20, 18)

HERE = os.path.dirname(os.path.abspath(__file__))


def _font(size):
    for name in ("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()


def draw_logo(d, cx, cy, scale, carve):
    """Crescent + Kaaba motif centered at (cx, cy). `carve` = background colour
    used to cut the crescent (GREEN_DARK on the solid icon, transparent elsewhere)."""
    # Crescent (gold) above the cube
    r = int(150 * scale)
    moon_cx, moon_cy = cx, cy - int(255 * scale)
    d.ellipse([moon_cx - r, moon_cy - r, moon_cx + r, moon_cy + r], fill=GOLD)
    off = int(r * 0.55)
    # carve the inner circle with the background colour to leave a clean crescent
    d.ellipse([moon_cx - r + off, moon_cy - r - int(r*0.15),
               moon_cx + r + off, moon_cy + r - int(r*0.15)], fill=carve)

    # Kaaba cube
    w = int(360 * scale)
    x0, y0 = cx - w // 2, cy - w // 2 + int(60 * scale)
    x1, y1 = cx + w // 2, cy + w // 2 + int(60 * scale)
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(14 * scale), fill=NEAR_BLACK,
                        outline=GOLD, width=max(3, int(10 * scale)))
    # Kiswa band (gold horizontal stripe near the top)
    band_y = y0 + int(w * 0.30)
    d.rectangle([x0, band_y, x1, band_y + int(w * 0.13)], fill=GOLD)
    # Door (small gold rectangle, bottom centre)
    dw = int(w * 0.18)
    dh = int(w * 0.30)
    d.rounded_rectangle([cx - dw // 2, y1 - dh - int(8*scale), cx + dw // 2, y1 - int(8*scale)],
                        radius=int(6 * scale), fill=GOLD)


def make_icon(path, size=1024, bg=True, text=None):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if bg:
        d.rounded_rectangle([0, 0, size, size], radius=int(size * 0.22), fill=GREEN_DARK)
        # subtle inner ring
        m = int(size * 0.06)
        d.rounded_rectangle([m, m, size - m, size - m], radius=int(size * 0.18),
                            outline=(255, 255, 255, 18), width=4)
    scale = size / 1024.0
    cy = int(size * 0.46) if not text else int(size * 0.40)
    carve = GREEN_DARK if bg else (0, 0, 0, 0)
    draw_logo(d, size // 2, cy, scale, carve)
    if text:
        f = _font(int(96 * scale))
        tw = d.textlength(text, font=f)
        d.text(((size - tw) / 2, int(size * 0.74)), text, font=f, fill=CREAM)
    img.save(path)
    print("wrote", path)


if __name__ == "__main__":
    make_icon(os.path.join(HERE, "icon.png"), 1024, bg=True)
    # Android adaptive foreground: logo only, transparent, kept inside the safe zone
    make_icon(os.path.join(HERE, "adaptive-icon.png"), 1024, bg=False)
    # Splash: logo + wordmark on transparent (bg colour comes from app.json)
    make_icon(os.path.join(HERE, "splash-icon.png"), 1024, bg=False, text="SAFRE MANASIK")
    print("done")
