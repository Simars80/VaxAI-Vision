"""Synthetic warehouse shelf image generator for AR stock counter training.

Produces YOLO-format annotated images of vaccine products arranged on
warehouse shelves. Five target classes:
  0 - vaccine_vial
  1 - syringe
  2 - cold_box
  3 - diluent
  4 - ancillary_product
"""

from __future__ import annotations

import json
import logging
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

logger = logging.getLogger(__name__)

CLASSES = ["vaccine_vial", "syringe", "cold_box", "diluent", "ancillary_product"]
IMG_SIZE = 640

_PRODUCT_PROFILES = {
    "vaccine_vial": {
        "aspect_range": (2.5, 4.0),
        "width_range": (20, 45),
        "colors": [
            (200, 210, 220), (180, 190, 200), (220, 225, 230),
            (170, 200, 210), (190, 180, 200),
        ],
        "cap_colors": [(100, 50, 50), (50, 50, 120), (60, 100, 60), (180, 140, 40)],
        "has_cap": True,
        "has_label": True,
    },
    "syringe": {
        "aspect_range": (4.0, 7.0),
        "width_range": (12, 28),
        "colors": [
            (230, 235, 240), (240, 240, 245), (220, 225, 230),
        ],
        "plunger_colors": [(80, 80, 80), (60, 60, 60), (100, 100, 100)],
        "has_cap": False,
        "has_label": False,
    },
    "cold_box": {
        "aspect_range": (0.8, 1.4),
        "width_range": (60, 120),
        "colors": [
            (30, 80, 160), (40, 100, 180), (60, 60, 140),
            (20, 120, 80), (180, 50, 50),
        ],
        "has_cap": False,
        "has_label": True,
    },
    "diluent": {
        "aspect_range": (1.5, 2.5),
        "width_range": (18, 35),
        "colors": [
            (220, 230, 240), (200, 210, 220), (230, 230, 235),
            (210, 220, 210),
        ],
        "has_cap": True,
        "has_label": True,
    },
    "ancillary_product": {
        "aspect_range": (0.9, 2.0),
        "width_range": (25, 55),
        "colors": [
            (240, 240, 230), (200, 180, 160), (180, 200, 180),
            (220, 200, 180), (160, 180, 200),
        ],
        "has_cap": False,
        "has_label": True,
    },
}


def _jitter(rgb: tuple[int, ...], spread: int = 15) -> tuple[int, ...]:
    return tuple(max(0, min(255, c + random.randint(-spread, spread))) for c in rgb)


def _draw_shelf_background(size: int = IMG_SIZE) -> Image.Image:
    bg_type = random.choice(["wood", "metal", "white", "gray"])
    if bg_type == "wood":
        base = random.choice([(180, 150, 110), (160, 130, 90), (200, 170, 130)])
    elif bg_type == "metal":
        g = random.randint(160, 200)
        base = (g, g + 5, g + 10)
    elif bg_type == "white":
        base = (235, 235, 235)
    else:
        g = random.randint(120, 180)
        base = (g, g, g)

    arr = np.full((size, size, 3), base, dtype=np.uint8)
    noise = np.random.randint(-8, 8, arr.shape, dtype=np.int16)
    arr = np.clip(arr.astype(np.int16) + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr)

    draw = ImageDraw.Draw(img)
    n_shelves = random.randint(2, 5)
    shelf_color = _jitter((120, 90, 60) if bg_type == "wood" else (100, 100, 110))
    for i in range(n_shelves):
        y = int(size * (i + 1) / (n_shelves + 1))
        y += random.randint(-15, 15)
        h = random.randint(3, 8)
        draw.rectangle([0, y, size, y + h], fill=shelf_color)

    return img


def _draw_vaccine_vial(
    draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, profile: dict
) -> None:
    body_color = _jitter(random.choice(profile["colors"]))
    draw.rounded_rectangle([x, y, x + w, y + h], radius=min(w // 4, 6), fill=body_color)
    cap_h = max(3, h // 8)
    cap_color = _jitter(random.choice(profile["cap_colors"]))
    draw.rectangle([x + 1, y, x + w - 1, y + cap_h], fill=cap_color)
    if profile.get("has_label"):
        label_y = y + h // 3
        label_h = max(4, h // 5)
        label_color = _jitter((240, 240, 240), 10)
        draw.rectangle([x + 2, label_y, x + w - 2, label_y + label_h], fill=label_color)


def _draw_syringe(
    draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, profile: dict
) -> None:
    body_color = _jitter(random.choice(profile["colors"]))
    barrel_w = max(w // 2, 6)
    bx = x + (w - barrel_w) // 2
    draw.rectangle([bx, y, bx + barrel_w, y + int(h * 0.75)], fill=body_color)
    plunger_color = _jitter(random.choice(profile["plunger_colors"]))
    pw = max(barrel_w // 3, 2)
    px = x + (w - pw) // 2
    draw.rectangle([px, y + int(h * 0.7), px + pw, y + h], fill=plunger_color)
    needle_w = max(1, pw // 2)
    nx = x + (w - needle_w) // 2
    draw.rectangle([nx, y - max(3, h // 10), nx + needle_w, y], fill=(160, 160, 170))


def _draw_cold_box(
    draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, profile: dict
) -> None:
    body_color = _jitter(random.choice(profile["colors"]))
    draw.rounded_rectangle([x, y, x + w, y + h], radius=min(w // 8, 5), fill=body_color)
    lid_h = max(4, h // 6)
    lid_color = tuple(max(0, c - 30) for c in body_color)
    draw.rectangle([x, y, x + w, y + lid_h], fill=lid_color)
    handle_y = y + lid_h // 2
    handle_w = w // 3
    hx = x + (w - handle_w) // 2
    draw.rounded_rectangle(
        [hx, handle_y - 2, hx + handle_w, handle_y + 3],
        radius=2,
        fill=(80, 80, 80),
    )
    if profile.get("has_label"):
        lx = x + w // 6
        ly = y + h // 3
        lw = w * 2 // 3
        lh = h // 4
        draw.rectangle([lx, ly, lx + lw, ly + lh], fill=(240, 240, 240))


def _draw_diluent(
    draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, profile: dict
) -> None:
    body_color = _jitter(random.choice(profile["colors"]))
    draw.rounded_rectangle([x, y, x + w, y + h], radius=min(w // 3, 5), fill=body_color)
    cap_h = max(2, h // 10)
    cap_color = _jitter((200, 60, 60))
    draw.rectangle([x + 1, y, x + w - 1, y + cap_h], fill=cap_color)
    liquid_y = y + h // 3
    liquid_h = h // 2
    liquid_color = _jitter((180, 200, 220), 10)
    draw.rounded_rectangle(
        [x + 2, liquid_y, x + w - 2, liquid_y + liquid_h],
        radius=3,
        fill=liquid_color,
    )


def _draw_ancillary(
    draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, profile: dict
) -> None:
    body_color = _jitter(random.choice(profile["colors"]))
    draw.rounded_rectangle([x, y, x + w, y + h], radius=min(w // 5, 6), fill=body_color)
    if profile.get("has_label"):
        lx = x + 3
        ly = y + h // 4
        lw = w - 6
        lh = h // 3
        if lw > 4 and lh > 4:
            draw.rectangle([lx, ly, lx + lw, ly + lh], fill=_jitter((245, 245, 240)))


_DRAWERS = {
    "vaccine_vial": _draw_vaccine_vial,
    "syringe": _draw_syringe,
    "cold_box": _draw_cold_box,
    "diluent": _draw_diluent,
    "ancillary_product": _draw_ancillary,
}


def _place_products(img: Image.Image, min_objects: int = 3, max_objects: int = 15):
    draw = ImageDraw.Draw(img)
    size = img.width
    n_objects = random.randint(min_objects, max_objects)
    annotations = []
    placed_boxes = []

    for _ in range(n_objects):
        cls_name = random.choice(CLASSES)
        cls_id = CLASSES.index(cls_name)
        profile = _PRODUCT_PROFILES[cls_name]

        w = random.randint(*profile["width_range"])
        aspect = random.uniform(*profile["aspect_range"])
        h = int(w * aspect)

        for _attempt in range(30):
            x = random.randint(5, size - w - 5)
            y = random.randint(5, size - h - 5)

            overlap = False
            for bx, by, bw, bh in placed_boxes:
                if (
                    x < bx + bw
                    and x + w > bx
                    and y < by + bh
                    and y + h > by
                ):
                    iou_x1 = max(x, bx)
                    iou_y1 = max(y, by)
                    iou_x2 = min(x + w, bx + bw)
                    iou_y2 = min(y + h, by + bh)
                    inter = max(0, iou_x2 - iou_x1) * max(0, iou_y2 - iou_y1)
                    area_a = w * h
                    area_b = bw * bh
                    iou = inter / (area_a + area_b - inter + 1e-6)
                    if iou > 0.15:
                        overlap = True
                        break
            if not overlap:
                break
        else:
            continue

        _DRAWERS[cls_name](draw, x, y, w, h, profile)
        placed_boxes.append((x, y, w, h))

        cx = (x + w / 2) / size
        cy = (y + h / 2) / size
        nw = w / size
        nh = h / size
        annotations.append((cls_id, cx, cy, nw, nh))

    return annotations


def _apply_augmentation(img: Image.Image) -> Image.Image:
    if random.random() < 0.3:
        factor = random.uniform(0.7, 1.3)
        arr = np.clip(np.asarray(img, dtype=np.float32) * factor, 0, 255)
        img = Image.fromarray(arr.astype(np.uint8))

    if random.random() < 0.25:
        img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 1.5)))

    if random.random() < 0.2:
        arr = np.asarray(img, dtype=np.int16)
        noise = np.random.randint(-12, 12, arr.shape, dtype=np.int16)
        img = Image.fromarray(np.clip(arr + noise, 0, 255).astype(np.uint8))

    if random.random() < 0.15:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)

    return img


def generate_stock_image(
    min_objects: int = 3,
    max_objects: int = 15,
    size: int = IMG_SIZE,
) -> tuple[Image.Image, list[tuple[int, float, float, float, float]]]:
    img = _draw_shelf_background(size)
    annotations = _place_products(img, min_objects, max_objects)
    img = _apply_augmentation(img)
    return img, annotations


def generate_dataset(
    output_dir: str | Path,
    num_images: int = 600,
    holdout_fraction: float = 0.2,
    seed: int = 42,
    size: int = IMG_SIZE,
) -> dict:
    random.seed(seed)
    np.random.seed(seed)

    output_dir = Path(output_dir)
    n_val = max(1, int(num_images * holdout_fraction))
    n_train = num_images - n_val

    for split in ("train", "val"):
        (output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    stats = {"train": 0, "val": 0, "objects": {c: 0 for c in CLASSES}}

    for split, count in [("train", n_train), ("val", n_val)]:
        for i in range(count):
            img, annotations = generate_stock_image(size=size)
            fname = f"shelf_{split}_{i:04d}"
            img.save(output_dir / "images" / split / f"{fname}.jpg", quality=92)

            label_lines = []
            for cls_id, cx, cy, w, h in annotations:
                label_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
                stats["objects"][CLASSES[cls_id]] += 1

            (output_dir / "labels" / split / f"{fname}.txt").write_text(
                "\n".join(label_lines)
            )
            stats[split] += 1

    dataset_yaml = {
        "path": str(output_dir.resolve()),
        "train": "images/train",
        "val": "images/val",
        "nc": len(CLASSES),
        "names": CLASSES,
    }
    yaml_path = output_dir / "dataset.yaml"
    yaml_lines = [
        f"path: {dataset_yaml['path']}",
        f"train: {dataset_yaml['train']}",
        f"val: {dataset_yaml['val']}",
        f"nc: {dataset_yaml['nc']}",
        f"names: {dataset_yaml['names']}",
    ]
    yaml_path.write_text("\n".join(yaml_lines) + "\n")

    manifest = {
        "dataset_yaml": str(yaml_path),
        "classes": CLASSES,
        "num_classes": len(CLASSES),
        "train_images": stats["train"],
        "val_images": stats["val"],
        "object_counts": stats["objects"],
        "image_size": size,
    }
    (output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))

    logger.info(
        "Generated %d train + %d val images (%d total objects) in %s",
        stats["train"],
        stats["val"],
        sum(stats["objects"].values()),
        output_dir,
    )
    return manifest


if __name__ == "__main__":
    import sys

    dest = sys.argv[1] if len(sys.argv) > 1 else "data/stock_synthetic"
    m = generate_dataset(dest, num_images=600)
    print(f"Train: {m['train_images']}, Val: {m['val_images']}")
    print(f"Objects: {m['object_counts']}")
