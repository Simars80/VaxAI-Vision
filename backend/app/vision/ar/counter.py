"""End-to-end stock counting pipeline: detection + tracking + aggregation.

Combines the StockDetector (YOLOv8) with ByteTrack for multi-frame
deduplication. Processes camera frames and produces per-product counts.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import numpy as np
from PIL import Image

from app.vision.ar.bytetrack import ByteTracker, Detection, Track
from app.vision.stock_detector import StockDetector, get_stock_detector

logger = logging.getLogger(__name__)


@dataclass
class FrameResult:
    frame_index: int
    detections: list[Detection]
    active_tracks: list[Track]
    inference_ms: float


@dataclass
class CountResult:
    product_counts: dict[str, int]
    total_items: int
    frames_processed: int
    unique_tracks: int


class StockCounter:
    """Stateful stock counter for a single counting session.

    Processes sequential frames from the camera, runs detection on each,
    tracks objects across frames, and produces deduplicated counts.
    """

    def __init__(
        self,
        detector: StockDetector | None = None,
        high_thresh: float = 0.5,
        low_thresh: float = 0.1,
        iou_thresh: float = 0.3,
        max_age: int = 30,
        min_hits: int = 3,
    ) -> None:
        self._detector = detector or get_stock_detector()
        self._tracker = ByteTracker(
            high_thresh=high_thresh,
            low_thresh=low_thresh,
            iou_thresh=iou_thresh,
            max_age=max_age,
            min_hits=min_hits,
        )
        self._frame_count = 0
        self._seen_track_ids: set[int] = set()
        self._track_classes: dict[int, str] = {}

    def reset(self) -> None:
        self._tracker.reset()
        self._frame_count = 0
        self._seen_track_ids.clear()
        self._track_classes.clear()

    def process_frame(
        self,
        image: Image.Image | bytes | np.ndarray,
    ) -> FrameResult:
        """Process a single camera frame and return detections + tracks."""
        detections, inference_ms = self._detector.detect_with_timing(image)
        active_tracks = self._tracker.update(detections)

        for track in active_tracks:
            self._seen_track_ids.add(track.track_id)
            self._track_classes[track.track_id] = track.class_name

        result = FrameResult(
            frame_index=self._frame_count,
            detections=detections,
            active_tracks=active_tracks,
            inference_ms=inference_ms,
        )
        self._frame_count += 1
        return result

    def get_counts(self) -> CountResult:
        """Get current deduplicated product counts across all processed frames."""
        counts: dict[str, int] = {}
        for track_id in self._seen_track_ids:
            cls_name = self._track_classes.get(track_id, "unknown")
            counts[cls_name] = counts.get(cls_name, 0) + 1

        return CountResult(
            product_counts=counts,
            total_items=sum(counts.values()),
            frames_processed=self._frame_count,
            unique_tracks=len(self._seen_track_ids),
        )

    def process_frame_to_api(
        self,
        image: Image.Image | bytes | np.ndarray,
    ) -> dict:
        """Process frame and return API-friendly dict for the AR stock endpoint."""
        result = self.process_frame(image)
        counts = self.get_counts()

        return {
            "frame_index": result.frame_index,
            "detections": [
                {
                    "class_id": d.class_id,
                    "class_name": d.class_name,
                    "confidence": round(d.score, 4),
                    "bbox": {
                        "x1": round(float(d.bbox[0]), 1),
                        "y1": round(float(d.bbox[1]), 1),
                        "x2": round(float(d.bbox[2]), 1),
                        "y2": round(float(d.bbox[3]), 1),
                    },
                }
                for d in result.detections
            ],
            "active_tracks": [
                {
                    "track_id": t.track_id,
                    "class_name": t.class_name,
                    "confidence": round(t.score, 4),
                    "bbox": {
                        "x1": round(float(t.bbox[0]), 1),
                        "y1": round(float(t.bbox[1]), 1),
                        "x2": round(float(t.bbox[2]), 1),
                        "y2": round(float(t.bbox[3]), 1),
                    },
                }
                for t in result.active_tracks
            ],
            "running_counts": counts.product_counts,
            "total_items": counts.total_items,
            "inference_ms": round(result.inference_ms, 1),
        }
