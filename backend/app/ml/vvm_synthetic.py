"""Synthetic VVM (Vaccine Vial Monitor) image generator.

Generates training images for the 4 VVM stages by simulating the color-change
indicator: a circular outer region surrounding an inner square.  Stage
progression is encoded as the ratio of inner-to-outer darkness.
"""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

logger = logging.getLogger(__name__)

VVM_STAGES = ("stage_1", "stage_2", "stage_3", "stage_4")

# Color profiles per stage (inner_rgb, outer_rgb) â base values before jitter
_STAGE_PROFILES: dict[str, list[tuple[tuple[int, ...], tuple[int, ...]]]] = {
    "stage_1": [
        ((240, 240, 245), (120, 80, 140)),
        ((235, 235, 240), (130, 90, 150)),
        ((245, 242, 248), (110, 75, 135)),
    ],
    "stage_2": [
        ((160, 120, 170), (150, 110, 160)),
        ((155, 115, 165), (145, 105, 155)),
        ((165, 125, 175), (155, 115, 165)),
    ],
    "stage_3": [
        ((100, 60, 110), (150, 110, 160)),
        ((90, 55, 105), (145, 105, 155)),
        ((110, 65, 115), (155, 115, 165)),
    ],
    "stage_4": [
        ((50, 25, 55), (160, 130, 170)),
        ((45, 20, 50), (155, 125, 165)),
        ((55, 30, 60), (165, 135, 175)),
    ],
}


def _jitter_color(rgb: tuple[int, ...], spread: int = 15) -> tuple[int, ...]:
    return tuple(max(0, min(255, c + random.randint(-spread, spread))) for c in rgb)


def _random_background(size: int) -> Image.Image:
    base = random.randint(180, 240)
    arr = np.full((size, size, 3), base, dtype=np.uint8)
    noise = np.random.randint(-10, 10, arr.shape, dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def generate_vvm_image(
    stage: str,
    size: int = 224,
    jitter: int = 20,
    add_noise: bool = True,
    add_blur: bool = False,
) -> Image.Image:
    """Generate one synthetic VVM indicator image for the given stage."""
    assert stage in VVM_STAGES, f"Unknown stage: {stage}"

    inner_base, outer_base = random.choice(_STAGE_PROFILES[stage])
    inner_rgb = _jitter_color(inner_base, jitter)
    outer_rgb = _jitter_color(outer_base, jitter)

    img = _random_background(size)
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, size // 2
    radius = random.randint(size // 3, size // 2 - 10)
    draw.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=outer_rgb,
    )

    half_sq = random.randint(radius // 3, radius // 2)
    offset_x = random.randint(-5, 5)
    offset_y = random.randint(-5, 5)
    draw.rectangle(
        [
            cx - half_sq + offset_x,
            cy - half_sq + offset_y,
            cx + half_sq + offset_x,
            cy + half_sq + offset_y,
        ],
        fill=inner_rgb,
    )

    if add_noise:
        arr = np.asarray(img, dtype=np.int16)
        noise = np.random.randint(-8, 8, arr.shape, dtype=np.int16)
        img = Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8))

    if add_blur or random.random() < 0.3:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 1.2)))

    angle = random.choice([0, 90, 180, 270])
    if angle:
        img = img.rotate(angle)

    return img


def generate_dataset(
    output_dir: str | Path,
    samples_per_class: int = 75,
    size: int = 224,
    holdout_fraction: float = 0.2,
    seed: int = 42,
) -> dict:
    """Generate a full synthetic VVM dataset with train/val split.

    Returns a manifest dict with paths and labels.
    """
    random.seed(seed)
    np.random.seed(seed)

    output_dir = Path(output_dir)
    manifest: dict[str, list[dict]] = {"train": [], "val": []}

    for stage in VVM_STAGES:
        for split in ("train", "val"):
            (output_dir / split / stage).mkdir(parents=True, exist_ok=True)

        n_val = max(1, int(samples_per_class * holdout_fraction))
        n_train = samples_per_class - n_val

        for i in range(n_train):
            img = generate_vvm_image(stage, size=size)
            fname = f"{stage}_{i:04d}.png"
            path = output_dir / "train" / stage / fname
            img.save(path)
            manifest["train"].append({"path": str(path), "label": stage})

        for i in range(n_val):
            img = generate_vvm_image(stage, size=size, add_blur=True)
            fname = f"{stage}_{i:04d}.png"
            path = output_dir / "val" / stage / fname
            img.save(path)
            manifest["val"].append({"path": str(path), "label": stage})

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    total_train = len(manifest["train"])
    total_val = len(manifest["val"])
    logger.info(
        "Generated %d train + %d val images in %s", total_train, total_val, output_dir
    )
    return manifest


if __name__ == "__main__":
    import sys

    dest = sys.argv[1] if len(sys.argv) > 1 else "data/vvm_synthetic"
    m = generate_dataset(dest, samples_per_class=75)
    print(f"Train: {len(m['train'])}, Val: {len(m['val'])}")
