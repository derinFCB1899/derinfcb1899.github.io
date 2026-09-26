"""Generate the small, transparent PNG cursors used by the site."""

from pathlib import Path

from PIL import Image, ImageDraw


ASSETS = Path(__file__).resolve().parents[1] / "assets"
OUTLINE = [(2, 1), (12, 11), (6, 11), (2, 15)]
FILL = [(4, 4), (10, 10), (6, 10), (4, 13)]

for name, outline_color, fill_color, accent_color in (
    ("tron", "#167d91", "#f8ffff", "#91f5ff"),
    ("sunset", "#301329", "#fff4e5", "#ed509b"),
):
    pixels = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(pixels)
    draw.polygon(OUTLINE, fill=outline_color)
    draw.polygon(FILL, fill=fill_color)
    image = pixels.resize((32, 32), Image.Resampling.NEAREST)
    ImageDraw.Draw(image).rectangle((4, 2, 5, 3), fill=accent_color)
    image.save(ASSETS / f"cursor-{name}.png")
