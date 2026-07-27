#!/usr/bin/env python3
"""Generate the social link-preview (Open Graph) card(s) for the site.

Link previews in Facebook/Messenger, X, LinkedIn, Slack and iMessage use the
og:image declared in app/layout.tsx. Without one, Facebook falls back to
scraping the page and lands on the globe favicon, which it upscales into an
unreadable blur — the bug this card fixes.

Three designs are generated so one can be chosen; the chosen file is wired up
as og:image in app/layout.tsx.

    a  woodcut-panel  Herschel telescope woodcut right, title panel left
    b  logo           Globe logo + title, centered on a deep teal field
    c  starfield      Full-bleed star-chart woodcut with a title scrim

Usage:
    python3 scripts/build_og_card.py                 # all three variants
    python3 scripts/build_og_card.py --variant a     # just one
    python3 scripts/build_og_card.py --out og-card.png --variant a   # final name

Outputs public/assets/og-card-<variant>.png at 1200x630 (the size Facebook
and X expect for a large summary card).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "public" / "assets"

W, H = 1200, 630

# Site palette, converted from the HSL tokens in app/globals.css.
FG = (29, 37, 48)          # --foreground  215 25% 15%
PRIMARY = (13, 127, 165)   # --primary     195 85% 35%
MUTED = (98, 112, 132)     # --muted-foreground 215 15% 45%
CREAM = (250, 248, 243)    # warm off-white, matches the woodcut paper
DEEP = (10, 42, 58)        # deep teal-navy field for the logo variant

TITLE_1 = "The Metascience"
TITLE_2 = "Observatory"
TAGLINE = "Analyzing scientific reproducibility, rigor,\nand fraud across all fields of science"
DOMAIN = "metascienceobservatory.org"

SLAB_DIR = Path("/usr/share/fonts/opentype/roboto/slab")
FALLBACK_DIR = Path("/usr/share/fonts/truetype/dejavu")


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    """Roboto Slab (the site's brand face) at the given weight, falling back
    to DejaVu Serif when the font package isn't installed."""
    candidates = [
        SLAB_DIR / f"RobotoSlab-{weight}.otf",
        FALLBACK_DIR / ("DejaVuSerif-Bold.ttf" if weight == "Bold" else "DejaVuSerif.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def cover_crop(img: Image.Image, box_w: int, box_h: int, focus_y: float = 0.45) -> Image.Image:
    """Scale to cover box_w x box_h and center-crop, biased vertically by
    focus_y (0 = top, 1 = bottom) so the subject stays in frame."""
    scale = max(box_w / img.width, box_h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left = (resized.width - box_w) // 2
    top = int((resized.height - box_h) * focus_y)
    top = max(0, min(top, resized.height - box_h))
    return resized.crop((left, top, left + box_w, top + box_h))


def draw_wrapped(
    draw: ImageDraw.ImageDraw, xy, text: str, fnt, fill, line_spacing: float = 1.35
) -> int:
    """Draw newline-separated text; returns the y just past the last line."""
    x, y = xy
    ascent, descent = fnt.getmetrics()
    step = int((ascent + descent) * line_spacing)
    for line in text.split("\n"):
        draw.text((x, y), line, font=fnt, fill=fill)
        y += step
    return y


# ---------------------------------------------------------------------------
# Variant A — woodcut panel
# ---------------------------------------------------------------------------

def variant_woodcut() -> Image.Image:
    card = Image.new("RGB", (W, H), CREAM)
    art_w = 470
    art = Image.open(ASSETS / "herschel-observatory-cropped.png").convert("RGB")
    art = cover_crop(art, art_w, H, focus_y=0.38)
    card.paste(art, (W - art_w, 0))

    # Soften the seam: fade the artwork's inner edge into the cream panel.
    fade_w = 90
    mask = Image.new("L", (fade_w, H), 0)
    md = ImageDraw.Draw(mask)
    for i in range(fade_w):
        md.line([(i, 0), (i, H)], fill=int(255 * (1 - i / fade_w)))
    card.paste(Image.new("RGB", (fade_w, H), CREAM), (W - art_w, 0), mask)

    d = ImageDraw.Draw(card)
    x = 72
    d.text((x, 150), TITLE_1, font=font("Bold", 62), fill=FG)
    d.text((x, 226), TITLE_2, font=font("Bold", 62), fill=FG)
    d.rectangle([x, 330, x + 108, 336], fill=PRIMARY)
    draw_wrapped(d, (x, 372), TAGLINE, font("Regular", 25), MUTED)
    d.text((x, 522), DOMAIN, font=font("Regular", 22), fill=PRIMARY)
    return card


# ---------------------------------------------------------------------------
# Variant B — globe logo on a deep field
# ---------------------------------------------------------------------------

def variant_logo() -> Image.Image:
    card = Image.new("RGB", (W, H), DEEP)

    # Faint star-chart woodcut as texture behind everything.
    stars = Image.open(ASSETS / "looking_at_stars_cropped.png").convert("L")
    stars = cover_crop(stars.convert("RGB"), W, H, focus_y=0.5).convert("L")
    stars = stars.point(lambda v: 255 - v)  # ink becomes light on the dark field
    tint = Image.new("RGB", (W, H), (120, 190, 220))
    card.paste(tint, (0, 0), stars.point(lambda v: int(v * 0.16)))

    # Globe logo, recolored to a light tint so it reads on the dark field.
    logo_px = 190
    logo = Image.open(ASSETS / "globe.png").convert("RGBA").resize((logo_px, logo_px), Image.LANCZOS)
    alpha = logo.split()[3]
    ink = logo.convert("L").point(lambda v: 255 - v)  # dark strokes -> high value
    shape = Image.eval(ink, lambda v: v).point(lambda v: v)
    shape = Image.composite(shape, Image.new("L", logo.size, 0), alpha)
    card.paste(Image.new("RGB", logo.size, (233, 246, 251)), (86, 128), shape)

    d = ImageDraw.Draw(card)
    x = 320
    d.text((x, 148), TITLE_1, font=font("Bold", 64), fill=(240, 249, 252))
    d.text((x, 226), TITLE_2, font=font("Bold", 64), fill=(240, 249, 252))
    d.rectangle([x, 332, x + 108, 338], fill=(19, 182, 236))
    draw_wrapped(d, (x, 376), TAGLINE, font("Light", 26), (176, 202, 216))
    d.text((x, 524), DOMAIN, font=font("Regular", 22), fill=(19, 182, 236))
    return card


# ---------------------------------------------------------------------------
# Variant C — full-bleed starfield with a scrim
# ---------------------------------------------------------------------------

def variant_starfield() -> Image.Image:
    art = Image.open(ASSETS / "looking_at_stars_cropped.png").convert("RGB")
    card = cover_crop(art, W, H, focus_y=0.5)
    card = Image.blend(card, Image.new("RGB", (W, H), CREAM), 0.25)  # calm the contrast

    # Horizontal scrim band behind the type so it stays legible over the stars.
    band_top, band_h = 208, 232
    band = Image.new("RGB", (W, band_h), CREAM)
    veil = Image.new("L", (W, band_h), 232)
    vd = ImageDraw.Draw(veil)
    for i in range(30):  # feather the band's top and bottom edges
        v = int(232 * (i / 30))
        vd.line([(0, i), (W, i)], fill=v)
        vd.line([(0, band_h - 1 - i), (W, band_h - 1 - i)], fill=v)
    card.paste(band, (0, band_top), veil)

    d = ImageDraw.Draw(card)
    title = f"{TITLE_1} {TITLE_2}"
    f_title = font("Bold", 60)
    tw = d.textlength(title, font=f_title)
    d.text(((W - tw) / 2, band_top + 34), title, font=f_title, fill=FG)
    d.rectangle([(W - 108) / 2, band_top + 122, (W + 108) / 2, band_top + 128], fill=PRIMARY)
    sub = "Analyzing scientific reproducibility, rigor, and fraud across all fields of science"
    f_sub = font("Regular", 24)
    sw = d.textlength(sub, font=f_sub)
    d.text(((W - sw) / 2, band_top + 156), sub, font=f_sub, fill=MUTED)

    # Domain on its own small scrim at the bottom.
    f_dom = font("Regular", 22)
    dw = d.textlength(DOMAIN, font=f_dom)
    pad = 14
    chip = (int((W - dw) / 2 - pad), 548, int((W + dw) / 2 + pad), 590)
    overlay = card.crop(chip)
    overlay = Image.blend(overlay, Image.new("RGB", overlay.size, CREAM), 0.88)
    card.paste(overlay, chip[:2])
    d.text(((W - dw) / 2, 556), DOMAIN, font=f_dom, fill=PRIMARY)
    return card


VARIANTS = {"a": ("woodcut-panel", variant_woodcut),
            "b": ("logo", variant_logo),
            "c": ("starfield", variant_starfield)}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--variant", choices=sorted(VARIANTS), help="build only this variant")
    p.add_argument("--out", help="output filename (default og-card-<variant>.png)")
    args = p.parse_args()

    if not (SLAB_DIR / "RobotoSlab-Bold.otf").exists():
        print("NOTE: Roboto Slab not found; falling back to DejaVu Serif.")

    picks = [args.variant] if args.variant else sorted(VARIANTS)
    for key in picks:
        name, builder = VARIANTS[key]
        card = builder()
        card = card.filter(ImageFilter.UnsharpMask(radius=1.1, percent=45, threshold=3))
        out = ASSETS / (args.out if args.out and args.variant else f"og-card-{key}-{name}.png")
        card.save(out, "PNG", optimize=True)
        print(f"wrote {out.relative_to(REPO_ROOT)}  ({out.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
