"""Synthetic cold chain equipment image generator.

Generates training images representing five equipment types across four
condition states.  Images are built with PIL using geometric primitives,
color profiles, and noise to produce realistic-ish representations without
requiring real photos.

Equipment types:
  refrigerator | cold_box | vaccine_carrier | ice_pack | temperature_monitor

Condition states:
  operational | needs_maintenance | damaged | non_functional
"""

from __future__ import annotations

import json
import logging
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

logger = logging.getLogger(__name__)

EQUIPMENT_TYPES = (
    "refrigerator",
    "cold_box",
    "vaccine_carrier",
    "ice_pack",
    "temperature_monitor",
)

CONDITIONS = (
    "operational",
    "needs_maintenance",
    "damaged",
    "non_functional",
)

IMG_SIZE = 224

# ---------------------------------------------------------------------------
# Color profiles per equipment type
# (body_color, accent_color, handle_color)
# ---------------------------------------------------------------------------
_TYPE_PROFILES: dict[str, dict] = {
    "refrigerator": {
        "body_colors": [(230, 230, 235), (220, 220, 225), (240, 238, 242)],
        "accent_colors": [(180, 180, 190), (170, 170, 180), (190, 188, 195)],
        "handle_colors": [(140, 140, 145), (130, 130, 135), (150, 150, 155)],
        "shape": "tall_box",
        "has_display": False,
        "has_handle": True,
    },
    "cold_box": {
        "body_colors": [(60, 100, 160), (50, 90, 150), (70, 110, 170)],
        "accent_colors": [(220, 230, 245), (210, 220, 240), (230, 238, 248)],
        "handle_colors": [(40, 70, 120), (35, 65, 115), (45, 75, 125)],
        "shape": "squat_box",
        "has_display": False,
        "has_handle": True,
    },
    "vaccine_carrier": {
        "body_colors": [(220, 120, 40), (210, 115, 35), (230, 125, 45)],
        "accent_colors": [(240, 200, 150), (230, 190, 140), (248, 208, 160)],
        "handle_colors": [(150, 80, 20), (140, 75, 18), (160, 85, 22)],
        "shape": "compact_box",
        "has_display": False,
        "has_handle": True,
    },
    "ice_pack": {
        "body_colors": [(180, 215, 240), (170, 205, 235), (190, 225, 245)],
        "accent_colors": [(220, 235, 250), (210, 228, 248), (228, 240, 252)],
        "handle_colors": [(130, 170, 210), (120, 160, 200), (140, 180, 218)],
        "shape": "flat_pack",
        "has_display": False,
        "has_handle": False,
    },
    "temperature_monitor": {
        "body_colors": [(50, 50, 55), (45, 45, 50), (55, 55, 60)],
        "accent_colors": [(200, 200, 205), (190, 190, 198), (210, 210, 215)],
        "handle_colors": [(80, 80, 85), (75, 75, 80), (85, 85, 90)],
        "shape": "small_device",
        "has_display": True,
        "has_handle": False,
    },
}

# ---------------------------------------------------------------------------
# Condition modifiers
# ---------------------------------------------------------------------------
_CONDITION_MODS: dict[str, dict] = {
    "operational": {
        "rust_overlay": 0.0,
        "scratch_density": 0.0,
        "discoloration": 0.0,
        "noise_level": 5,
        "blur_prob": 0.1,
        "display_on": True,
    },
    "needs_maintenance": {
        "rust_overlay": 0.08,
        "scratch_density": 0.15,
        "discoloration": 0.10,
        "noise_level": 10,
        "blur_prob": 0.2,
        "display_on": True,
    },
    "damaged": {
        "rust_overlay": 0.25,
        "scratch_density": 0.35,
        "discoloration": 0.25,
        "noise_level": 18,
        "blur_prob": 0.3,
        "display_on": False,
    },
    "non_functional": {
        "rust_overlay": 0.45,
        "scratch_density": 0.55,
        "discoloration": 0.40,
        "noise_level": 25,
        "blur_prob": 0.4,
        "display_on": False,
    },
}


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _jitter(val: int, spread: int = 12) -> int:
    return int(max(0, min(255, val + random.randint(-spread, spread))))


def _jitter_color(rgb: tuple[int, int, int], spread: int = 12) -> tuple[int, int, int]:
    return (_jitter(rgb[0], spread), _jitter(rgb[1], spread), _jitter(rgb[2], spread))


def _random_background(size: int) -> Image.Image:
    """Off-white to light grey background with subtle grain."""
    base = random.randint(200, 240)
    arr = np.full((size, size, 3), base, dtype=np.uint8)
    noise = np.random.randint(-8, 8, arr.shape, dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)


def _apply_rust_overlay(img: Image.Image, strength: float) -> Image.Image:
    """Blend orange-brown rust patches over the image."""
    if strength <= 0:
        return img
    arr = np.asarray(img, dtype=np.float32)
    h, w = arr.shape[:2]
    n_patches = max(1, int(strength * 8))
    for _ in range(n_patches):
        px = random.randint(0, w - 1)
        py = random.randint(0, h - 1)
        radius = random.randint(4, int(20 * strength) + 4)
        rust_r = random.randint(140, 180)
        rust_g = random.randint(80, 110)
        rust_b = random.randint(30, 55)
        y_coords, x_coords = np.ogrid[-py:h - py, -px:w - px]
        mask = (x_coords**2 + y_coords**2) <= radius**2
        blend = min(0.9, strength * 1.5)
        arr[mask, 0] = np.clip(arr[mask, 0] * (1 - blend) + rust_r * blend, 0, 255)
        arr[mask, 1] = np.clip(arr[mask, 1] * (1 - blend) + rust_g * blend, 0, 255)
        arr[mask, 2] = np.clip(arr[mask, 2] * (1 - blend) + rust_b * blend, 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


def _apply_scratches(img: Image.Image, density: float) -> Image.Image:
    """Draw grey scratch lines across the equipment surface."""
    if density <= 0:
        return img
    draw = ImageDraw.Draw(img)
    n = max(1, int(density * 15))
    w, h = img.size
    for _ in range(n):
        x0 = random.randint(0, w)
        y0 = random.randint(0, h)
        length = random.randint(10, int(60 * density) + 10)
        angle_rad = random.uniform(0, 3.14)
        x1 = int(x0 + length * np.cos(angle_rad))
        y1 = int(y0 + length * np.sin(angle_rad))
        gray_val = random.randint(80, 160)
        draw.line([(x0, y0), (x1, y1)], fill=(gray_val, gray_val, gray_val), width=1)
    return img


def _apply_discoloration(img: Image.Image, strength: float) -> Image.Image:
    """Darken and add yellowish tint to simulate aging/discoloration."""
    if strength <= 0:
        return img
    arr = np.asarray(img, dtype=np.float32)
    dark_factor = 1.0 - strength * 0.35
    arr[:, :, 0] = np.clip(arr[:, :, 0] * dark_factor + strength * 15, 0, 255)
    arr[:, :, 1] = np.clip(arr[:, :, 1] * dark_factor + strength * 8, 0, 255)
    arr[:, :, 2] = np.clip(arr[:, :, 2] * dark_factor * 0.85, 0, 255)
    return Image.fromarray(arr.astype(np.uint8))


# ---------------------------------------------------------------------------
# Shape generators
# ---------------------------------------------------------------------------


def _draw_tall_box(draw: ImageDraw.Draw, size: int, body_color, accent_color, handle_color) -> None:
    """Refrigerator: tall rectangle with door seam and handle."""
    margin = size // 8
    body_l, body_t = margin, margin
    body_r, body_b = size - margin, size - margin
    draw.rectangle([body_l, body_t, body_r, body_b], fill=body_color, outline=accent_color, width=2)
    # Door seam (horizontal line 60% down)
    seam_y = body_t + int((body_b - body_t) * 0.6)
    draw.line([(body_l, seam_y), (body_r, seam_y)], fill=accent_color, width=2)
    # Handle (right side, vertical bar)
    hx = body_r - size // 16
    draw.rectangle([hx - 3, body_t + 15, hx + 3, seam_y - 15], fill=handle_color)
    draw.rectangle([hx - 3, seam_y + 10, hx + 3, body_b - 15], fill=handle_color)


def _draw_squat_box(draw: ImageDraw.Draw, size: int, body_color, accent_color, handle_color) -> None:
    """Cold box: squat rectangle with lid and carrying handles."""
    margin_h = size // 6
    margin_v = size // 4
    body_l, body_t = margin_h, margin_v
    body_r, body_b = size - margin_h, size - margin_v
    draw.rectangle([body_l, body_t, body_r, body_b], fill=body_color, outline=accent_color, width=3)
    # Lid (top 30% of box)
    lid_h = int((body_b - body_t) * 0.30)
    draw.rectangle([body_l, body_t, body_r, body_t + lid_h], fill=accent_color)
    # Latch
    latch_x = (body_l + body_r) // 2
    draw.rectangle([latch_x - 6, body_t + lid_h - 4, latch_x + 6, body_t + lid_h + 4],
                   fill=handle_color)
    # Side handles
    draw.rectangle([body_l - 10, body_t + lid_h + 5, body_l - 2, body_t + lid_h + 18],
                   fill=handle_color)
    draw.rectangle([body_r + 2, body_t + lid_h + 5, body_r + 10, body_t + lid_h + 18],
                   fill=handle_color)


def _draw_compact_box(draw: ImageDraw.Draw, size: int, body_color, accent_color, handle_color) -> None:
    """Vaccine carrier: compact box with shoulder strap loops."""
    margin = size // 5
    body_l, body_t = margin, margin + size // 12
    body_r, body_b = size - margin, size - margin
    draw.rectangle([body_l, body_t, body_r, body_b], fill=body_color, outline=accent_color, width=2)
    # Top strap loop
    strap_cx = (body_l + body_r) // 2
    draw.arc([strap_cx - 18, body_t - 20, strap_cx + 18, body_t + 5], start=0, end=180,
             fill=handle_color, width=4)
    # Front logo panel
    panel_w = int((body_r - body_l) * 0.55)
    panel_cx = (body_l + body_r) // 2
    draw.rectangle([panel_cx - panel_w // 2, body_t + 15, panel_cx + panel_w // 2, body_t + 38],
                   fill=accent_color)


def _draw_flat_pack(draw: ImageDraw.Draw, size: int, body_color, accent_color, handle_color) -> None:
    """Ice pack: flat thin rectangle, slightly translucent-looking."""
    margin_h = size // 8
    margin_v = size // 3
    body_l, body_t = margin_h, margin_v
    body_r, body_b = size - margin_h, size - margin_v
    draw.rounded_rectangle([body_l, body_t, body_r, body_b], radius=12,
                            fill=body_color, outline=accent_color, width=2)
    # Ice crystal pattern: small diamonds
    cx, cy = (body_l + body_r) // 2, (body_t + body_b) // 2
    for dx in range(-20, 21, 20):
        draw.polygon([(cx + dx, cy - 8), (cx + dx + 8, cy), (cx + dx, cy + 8),
                      (cx + dx - 8, cy)], fill=accent_color)


def _draw_small_device(draw: ImageDraw.Draw, size: int, body_color, accent_color,
                       handle_color, display_on: bool) -> None:
    """Temperature monitor: small handheld device with LCD display."""
    margin = size // 4
    body_l, body_t = margin, margin - size // 12
    body_r, body_b = size - margin, size - margin + size // 12
    draw.rounded_rectangle([body_l, body_t, body_r, body_b], radius=8,
                            fill=body_color, outline=accent_color, width=2)
    # Display screen
    disp_margin = size // 12
    disp_t = body_t + disp_margin
    disp_b = body_t + int((body_b - body_t) * 0.55)
    if display_on:
        screen_color = (40, 180, 100)   # green LCD glow
        text_color = (20, 220, 80)
    else:
        screen_color = (25, 28, 25)     # dead/dark screen
        text_color = (25, 28, 25)
    draw.rectangle([body_l + disp_margin, disp_t, body_r - disp_margin, disp_b],
                   fill=screen_color)
    # Temperature readout (simplified bars)
    for i, bar_x in enumerate(range(body_l + disp_margin + 6, body_r - disp_margin - 6, 10)):
        bar_h = random.randint(4, 14) if display_on else 0
        draw.rectangle([bar_x, disp_b - 4 - bar_h, bar_x + 6, disp_b - 4], fill=text_color)
    # Buttons
    btn_y = body_b - disp_margin - 6
    for btn_x in [body_l + 12, (body_l + body_r) // 2 - 6, body_r - 24]:
        draw.ellipse([btn_x, btn_y, btn_x + 12, btn_y + 12], fill=accent_color)
    # Power LED
    led_color = (0, 220, 80) if display_on else (80, 20, 20)
    draw.ellipse([body_r - 18, body_t + 8, body_r - 10, body_t + 16], fill=led_color)


# ---------------------------------------------------------------------------
# Main generator
# ---------------------------------------------------------------------------


def generate_equipment_image(
    equipment_type: str,
    condition: str,
    size: int = IMG_SIZE,
) -> Image.Image:
    """Generate one synthetic equipment image for the given type + condition."""
    assert equipment_type in EQUIPMENT_TYPES, f"Unknown type: {equipment_type}"
    assert condition in CONDITIONS, f"Unknown condition: {condition}"

    profile = _TYPE_PROFILES[equipment_type]
    mods = _CONDITION_MODS[condition]

    body_color = _jitter_color(random.choice(profile["body_colors"]))
    accent_color = _jitter_color(random.choice(profile["accent_colors"]))
    handle_color = _jitter_color(random.choice(profile["handle_colors"]))

    img = _random_background(size)
    draw = ImageDraw.Draw(img)

    shape = profile["shape"]
    if shape == "tall_box":
        _draw_tall_box(draw, size, body_color, accent_color, handle_color)
    elif shape == "squat_box":
        _draw_squat_box(draw, size, body_color, accent_color, handle_color)
    elif shape == "compact_box":
        _draw_compact_box(draw, size, body_color, accent_color, handle_color)
    elif shape == "flat_pack":
        _draw_flat_pack(draw, size, body_color, accent_color, handle_color)
    elif shape == "small_device":
        _draw_small_device(draw, size, body_color, accent_color, handle_color,
                           display_on=mods["display_on"])

    # Apply condition degradation layers
    img = _apply_rust_overlay(img, mods["rust_overlay"])
    img = _apply_scratches(img, mods["scratch_density"])
    img = _apply_discoloration(img, mods["discoloration"])

    # Pixel noise
    noise_level = mods["noise_level"]
    if noise_level > 0:
        arr = np.asarray(img, dtype=np.int16)
        noise = np.random.randint(-noise_level, noise_level, arr.shape, dtype=np.int16)
        img = Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8))

    # Optional blur
    if random.random() < mods["blur_prob"]:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.4, 1.5)))

    # Random rotation (±15 degrees) to add pose variation
    angle = random.uniform(-15, 15)
    if abs(angle) > 2:
        img = img.rotate(angle, fillcolor=(220, 220, 220))

    return img


# ---------------------------------------------------------------------------
# Dataset generator
# ---------------------------------------------------------------------------


def generate_dataset(
    output_dir: str | Path,
    samples_per_class: int = 80,
    size: int = IMG_SIZE,
    holdout_fraction: float = 0.2,
    seed: int = 42,
) -> dict:
    """Generate a full synthetic dataset with train/val split.

    Directory layout mirrors the VVM synthetic generator:
      output_dir/train/{type}_{condition}/XXXX.png
      output_dir/val/{type}_{condition}/XXXX.png

    Returns a manifest dict with paths and labels.
    """
    random.seed(seed)
    np.random.seed(seed)

    output_dir = Path(output_dir)
    manifest: dict[str, list[dict]] = {"train": [], "val": []}

    for eq_type in EQUIPMENT_TYPES:
        for condition in CONDITIONS:
            class_name = f"{eq_type}__{condition}"
            for split in ("train", "val"):
                (output_dir / split / class_name).mkdir(parents=True, exist_ok=True)

            n_val = max(1, int(samples_per_class * holdout_fraction))
            n_train = samples_per_class - n_val

            for i in range(n_train):
                img = generate_equipment_image(eq_type, condition, size=size)
                fname = f"{class_name}_{i:04d}.png"
                path = output_dir / "train" / class_name / fname
                img.save(path)
                manifest["train"].append({
                    "path": str(path),
                    "equipment_type": eq_type,
                    "condition": condition,
                })

            for i in range(n_val):
                img = generate_equipment_image(eq_type, condition, size=size)
                fname = f"{class_name}_{i:04d}.png"
                path = output_dir / "val" / class_name / fname
                img.save(path)
                manifest["val"].append({
                    "path": str(path),
                    "equipment_type": eq_type,
                    "condition": condition,
                })

    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2))

    logger.info(
        "Generated %d train + %d val images in %s",
        len(manifest["train"]),
        len(manifest["val"]),
        output_dir,
    )
    return manifest


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    dest = sys.argv[1] if len(sys.argv) > 1 else "data/equipment_synthetic"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    m = generate_dataset(dest, samples_per_class=n)
    print(f"Train: {len(m['train'])}, Val: {len(m['val'])}")
