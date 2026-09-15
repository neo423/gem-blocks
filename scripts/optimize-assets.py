"""Create runtime images from retained PNG originals. Requires Python + Pillow."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"
# Keep background resolution and atlas cell geometry; downsize only UI artwork.
IMAGES = {
    "gem-kingdom-game-bg.png": (None, 88),
    "gem-blocks-start-screen.png": (None, 88),
    "gem-blocks-logo.png": ((640, 640), 92),
    "gems/gem-atlas.png": (None, 92),
    "controls/control-dock-bg.png": ((1200, 400), 90),
    **{f"controls/{name}-button-base.png": ((256, 256), 92)
       for name in ("hint", "shuffle", "pause", "sound")},
}

before = after = 0
for name, (size, quality) in IMAGES.items():
    source = ROOT / name
    target = source.with_suffix(".webp")
    with Image.open(source) as image:
        if size:
            image.thumbnail(size, Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=quality, method=6)
    before += source.stat().st_size
    after += target.stat().st_size
    print(f"{name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes")

for size in (64, 180):
    with Image.open(ROOT / "gem-blocks-app-icon.png") as image:
        image.resize((size, size), Image.Resampling.LANCZOS).save(
            ROOT / f"gem-blocks-icon-{size}.png", optimize=True)
print(f"Runtime artwork: {before:,} -> {after:,} bytes ({1 - after / before:.1%} smaller)")
