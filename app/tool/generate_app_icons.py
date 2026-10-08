#!/usr/bin/env python3
"""Regenerates every launcher icon from assets/hariharibol.png.

    python3 app/tool/generate_app_icons.py        (needs Pillow)

The master is a square on a plain white ground, which is what both stores want
from an icon: iOS rounds the corners itself and rejects an icon with any
transparency, and Android masks an adaptive icon to whatever shape the launcher
uses. Nothing is redrawn or recoloured — every file written here is the master
resized, and the adaptive foreground is also padded with white.

  iOS      AppIcon.appiconset/        one PNG per entry in its Contents.json,
                                      flattened (no alpha)
  Android  mipmap-*/ic_launcher.png            the whole master, for Android 7 and below
           mipmap-*/ic_launcher_foreground.png the master shrunk into the adaptive
                                               icon's safe area; the white behind it
                                               is `ic_launcher_background` in colors.xml

The Android XML (mipmap-anydpi-v26/ic_launcher.xml) is written by hand and stays
put — this only produces the images.
"""
import json
from pathlib import Path

from PIL import Image

APP = Path(__file__).resolve().parent.parent
MASTER = APP / "assets" / "hariharibol.png"

IOS_ICONS = APP / "ios" / "Runner" / "Assets.xcassets" / "AppIcon.appiconset"
ANDROID_RES = APP / "android" / "app" / "src" / "main" / "res"

# Pixels per Android density bucket: the plain launcher icon is 48dp, an
# adaptive icon's layers are 108dp.
LEGACY_PX = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
ADAPTIVE_PX = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

# Share of the adaptive canvas left empty on each side. A launcher shows only the
# middle of it — a circle 66/108 across is the part no mask ever cuts — and this
# logo's feather tip and wordmark reach almost to the master's edges. At 0.23 the
# farthest point of the artwork still lands inside that circle. If the logo
# changes shape, recheck it against a circular mask before touching this.
ADAPTIVE_INSET = 0.23

WHITE = (255, 255, 255)


def load_master():
    """The master as plain RGB, flattened onto white if it ever gains an alpha."""
    image = Image.open(MASTER)
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        ground = Image.new("RGBA", image.size, WHITE + (255,))
        image = Image.alpha_composite(ground, image)
    return image.convert("RGB")


def resized(master, px):
    return master.resize((px, px), Image.LANCZOS)


def save(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    print(f"  {path.relative_to(APP)}  {image.width}x{image.height}")


def ios(master):
    contents = json.loads((IOS_ICONS / "Contents.json").read_text())
    for entry in contents["images"]:
        points = float(entry["size"].split("x")[0])
        scale = int(entry["scale"].rstrip("x"))
        save(resized(master, round(points * scale)), IOS_ICONS / entry["filename"])


def android(master):
    for density, px in LEGACY_PX.items():
        save(resized(master, px), ANDROID_RES / f"mipmap-{density}" / "ic_launcher.png")

    for density, px in ADAPTIVE_PX.items():
        art = round(px * (1 - 2 * ADAPTIVE_INSET))
        canvas = Image.new("RGB", (px, px), WHITE)
        canvas.paste(resized(master, art), ((px - art) // 2, (px - art) // 2))
        save(canvas, ANDROID_RES / f"mipmap-{density}" / "ic_launcher_foreground.png")


if __name__ == "__main__":
    source = load_master()
    print(f"{MASTER.relative_to(APP)}  {source.width}x{source.height}")
    ios(source)
    android(source)
