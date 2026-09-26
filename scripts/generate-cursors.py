"""Generate the small, transparent PNG cursors used by the site."""

from pathlib import Path

from PIL import Image, ImageDraw


ASSETS = Path(__file__).resolve().parents[1] / "assets"
OUTLINE = [(5, 2), (28, 25), (15, 25), (5, 30)]
FILL = [(8, 8), (23, 23), (14, 23), (8, 26)]

for name, outline_color, fill_color in (
    ("tron", "#00131b", "#f8ffff"),
    ("sunset", "#301329", "#fff4e5"),
):
    image = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.polygon(OUTLINE, fill=outline_color)
    draw.polygon(FILL, fill=fill_color)
    image.save(ASSETS / f"cursor-{name}.png")
