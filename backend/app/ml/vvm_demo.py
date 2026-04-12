"""Demo scan scenarios for VVM Scanner live demo.

Generates a curated set of VVM images that exercise all 4 stages, including
edge cases (stage 2→3 boundary) for a realistic demo flow.
"""

from __future__ import annotations

import io
import json
from pathlib import Path

from app.ml.vvm_synthetic import generate_vvm_image

DEMO_SCENARIOS = [
    {
        "id": "batch_check_1",
        "name": "Routine Batch Check",
        "description": "Field worker scanning a fresh vaccine shipment",
        "scans": [
            {"stage": "stage_1", "note": "Fresh vial from cold chain"},
            {"stage": "stage_1", "note": "Second vial, properly stored"},
            {"stage": "stage_2", "note": "Older vial, use soon"},
            {"stage": "stage_1", "note": "Third fresh vial"},
        ],
    },
    {
        "id": "cold_chain_break",
        "name": "Cold Chain Break Detection",
        "description": "Checking vaccines after suspected cold chain failure",
        "scans": [
            {"stage": "stage_3", "note": "Heat exposure — discard"},
            {"stage": "stage_4", "note": "Severely degraded — discard"},
            {"stage": "stage_2", "note": "Borderline — use immediately"},
            {"stage": "stage_3", "note": "Another compromised vial"},
        ],
    },
    {
        "id": "outreach_triage",
        "name": "Mobile Outreach Triage",
        "description": "Sorting vaccines for rural outreach campaign",
        "scans": [
            {"stage": "stage_1", "note": "Good — add to outreach kit"},
            {"stage": "stage_2", "note": "Use first, expiring soon"},
            {"stage": "stage_1", "note": "Good — add to outreach kit"},
            {"stage": "stage_4", "note": "Expired — remove from stock"},
            {"stage": "stage_1", "note": "Good — add to outreach kit"},
        ],
    },
    {
        "id": "mixed_inventory",
        "name": "Mixed Stage Inventory Audit",
        "description": "Full inventory check with all VVM stages represented",
        "scans": [
            {"stage": "stage_1", "note": "Excellent condition"},
            {"stage": "stage_2", "note": "Approaching limit — prioritize"},
            {"stage": "stage_3", "note": "Beyond use — quarantine"},
            {"stage": "stage_4", "note": "Expired — disposal"},
        ],
    },
]


def generate_demo_images(output_dir: str | Path, seed: int = 123) -> dict:
    """Generate demo scenario images and manifest."""
    import random
    import numpy as np

    random.seed(seed)
    np.random.seed(seed)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = {"scenarios": []}

    for scenario in DEMO_SCENARIOS:
        scenario_dir = output_dir / scenario["id"]
        scenario_dir.mkdir(exist_ok=True)

        scenario_entry = {
            "id": scenario["id"],
            "name": scenario["name"],
            "description": scenario["description"],
            "images": [],
        }

        for i, scan in enumerate(scenario["scans"]):
            img = generate_vvm_image(scan["stage"], size=224)
            fname = f"scan_{i:02d}_{scan['stage']}.png"
            img.save(scenario_dir / fname)

            scenario_entry["images"].append(
                {
                    "filename": fname,
                    "expected_stage": scan["stage"],
                    "note": scan["note"],
                    "usable": scan["stage"] in ("stage_1", "stage_2"),
                }
            )

        manifest["scenarios"].append(scenario_entry)

    (output_dir / "demo_manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


if __name__ == "__main__":
    import sys

    dest = sys.argv[1] if len(sys.argv) > 1 else "data/demo_scenarios"
    m = generate_demo_images(dest)
    total = sum(len(s["images"]) for s in m["scenarios"])
    print(f"Generated {total} demo images across {len(m['scenarios'])} scenarios")
