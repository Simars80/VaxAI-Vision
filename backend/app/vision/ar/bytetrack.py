"""ByteTrack multi-object tracker for frame-to-frame deduplication.

Lightweight implementation of ByteTrack (Zhang et al., 2022) using a
Kalman filter for motion prediction and IoU-based matching. Designed
for the AR stock counter to track vaccine products across video frames
and avoid double-counting.
"""

from __future__ import annotations

import dataclasses
from collections.abc import Sequence

import numpy as np


@dataclasses.dataclass
class Detection:
    bbox: np.ndarray  # [x1, y1, x2, y2]
    score: float
    class_id: int
    class_name: str = ""


@dataclasses.dataclass
class Track:
    track_id: int
    bbox: np.ndarray
    score: float
    class_id: int
    class_name: str
    age: int = 0
    hits: int = 1
    time_since_update: int = 0
    _kf: object = dataclasses.field(default=None, repr=False)


def _iou_batch(boxes_a: np.ndarray, boxes_b: np.ndarray) -> np.ndarray:
    if len(boxes_a) == 0 or len(boxes_b) == 0:
        return np.empty((len(boxes_a), len(boxes_b)), dtype=np.float32)

    x1 = np.maximum(boxes_a[:, 0:1], boxes_b[:, 0].T)
    y1 = np.maximum(boxes_a[:, 1:2], boxes_b[:, 1].T)
    x2 = np.minimum(boxes_a[:, 2:3], boxes_b[:, 2].T)
    y2 = np.minimum(boxes_a[:, 3:4], boxes_b[:, 3].T)

    inter = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
    area_a = (boxes_a[:, 2] - boxes_a[:, 0]) * (boxes_a[:, 3] - boxes_a[:, 1])
    area_b = (boxes_b[:, 2] - boxes_b[:, 0]) * (boxes_b[:, 3] - boxes_b[:, 1])

    union = area_a[:, None] + area_b[None, :] - inter
    return inter / (union + 1e-6)


def _linear_assignment(cost_matrix: np.ndarray, threshold: float):
    if cost_matrix.size == 0:
        return (
            np.empty((0, 2), dtype=int),
            np.arange(cost_matrix.shape[0]),
            np.arange(cost_matrix.shape[1]),
        )

    try:
        from scipy.optimize import linear_sum_assignment
        row_idx, col_idx = linear_sum_assignment(cost_matrix)
    except ImportError:
        row_idx, col_idx = _greedy_assignment(cost_matrix)

    matches = []
    unmatched_a = set(range(cost_matrix.shape[0]))
    unmatched_b = set(range(cost_matrix.shape[1]))

    for r, c in zip(row_idx, col_idx):
        if cost_matrix[r, c] > threshold:
            continue
        matches.append([r, c])
        unmatched_a.discard(r)
        unmatched_b.discard(c)

    matches_arr = np.array(matches, dtype=int).reshape(-1, 2) if matches else np.empty((0, 2), dtype=int)
    return matches_arr, np.array(sorted(unmatched_a)), np.array(sorted(unmatched_b))


def _greedy_assignment(cost_matrix: np.ndarray):
    rows, cols = [], []
    n_rows, n_cols = cost_matrix.shape
    used_rows, used_cols = set(), set()
    flat_idx = np.argsort(cost_matrix.ravel())

    for idx in flat_idx:
        r = idx // n_cols
        c = idx % n_cols
        if r in used_rows or c in used_cols:
            continue
        rows.append(r)
        cols.append(c)
        used_rows.add(r)
        used_cols.add(c)
        if len(rows) == min(n_rows, n_cols):
            break

    return np.array(rows), np.array(cols)


class _KalmanFilter:
    """Minimal constant-velocity Kalman filter for bbox center+size."""

    def __init__(self, bbox: np.ndarray) -> None:
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        self.state = np.array([cx, cy, w, h, 0, 0, 0, 0], dtype=np.float64)
        self.P = np.eye(8, dtype=np.float64) * 10.0
        self.P[4:, 4:] *= 100.0
        self.F = np.eye(8, dtype=np.float64)
        self.F[:4, 4:] = np.eye(4)
        self.H = np.eye(4, 8, dtype=np.float64)
        self.Q = np.eye(8, dtype=np.float64) * 1.0
        self.Q[4:, 4:] *= 10.0
        self.R = np.eye(4, dtype=np.float64) * 1.0

    def predict(self) -> np.ndarray:
        self.state = self.F @ self.state
        self.P = self.F @ self.P @ self.F.T + self.Q
        return self._to_bbox()

    def update(self, bbox: np.ndarray) -> np.ndarray:
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        z = np.array([cx, cy, w, h], dtype=np.float64)
        y = z - self.H @ self.state
        S = self.H @ self.P @ self.H.T + self.R
        K = self.P @ self.H.T @ np.linalg.inv(S)
        self.state = self.state + K @ y
        self.P = (np.eye(8) - K @ self.H) @ self.P
        return self._to_bbox()

    def _to_bbox(self) -> np.ndarray:
        cx, cy, w, h = self.state[:4]
        w, h = max(w, 1), max(h, 1)
        return np.array([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2])


class ByteTracker:
    """ByteTrack multi-object tracker.

    Two-stage association: high-confidence detections matched first via IoU,
    then remaining low-confidence detections matched to unmatched tracks.
    """

    def __init__(
        self,
        high_thresh: float = 0.5,
        low_thresh: float = 0.1,
        iou_thresh: float = 0.3,
        max_age: int = 30,
        min_hits: int = 3,
    ) -> None:
        self.high_thresh = high_thresh
        self.low_thresh = low_thresh
        self.iou_thresh = iou_thresh
        self.max_age = max_age
        self.min_hits = min_hits
        self._tracks: list[Track] = []
        self._next_id = 1
        self._frame_count = 0

    def reset(self) -> None:
        self._tracks.clear()
        self._next_id = 1
        self._frame_count = 0

    def update(self, detections: Sequence[Detection]) -> list[Track]:
        self._frame_count += 1

        # Age all tracks before matching
        for track in self._tracks:
            track.age += 1
            track.time_since_update += 1

        # Predict new positions
        for track in self._tracks:
            if track._kf is not None:
                track.bbox = track._kf.predict()

        high_dets = [d for d in detections if d.score >= self.high_thresh]
        low_dets = [
            d for d in detections
            if self.low_thresh <= d.score < self.high_thresh
        ]

        # Stage 1: high-confidence detections → existing tracks
        matched, unmatched_t_idx, unmatched_d_idx = self._associate(
            self._tracks, high_dets
        )

        for t_idx, d_idx in matched:
            t = self._tracks[t_idx]
            d = high_dets[d_idx]
            t.bbox = d.bbox.copy()
            t.score = d.score
            t.class_id = d.class_id
            t.class_name = d.class_name
            t.hits += 1
            t.time_since_update = 0
            if t._kf is not None:
                t._kf.update(d.bbox)

        remaining_tracks = [self._tracks[i] for i in unmatched_t_idx]

        # Stage 2: low-confidence detections → remaining tracks
        matched_low, _, _ = self._associate(remaining_tracks, low_dets)

        for t_idx, d_idx in matched_low:
            t = remaining_tracks[t_idx]
            d = low_dets[d_idx]
            t.bbox = d.bbox.copy()
            t.score = d.score
            t.hits += 1
            t.time_since_update = 0
            if t._kf is not None:
                t._kf.update(d.bbox)

        # Create new tracks from unmatched high-confidence detections
        for d_idx in unmatched_d_idx:
            d = high_dets[d_idx]
            new_track = Track(
                track_id=self._next_id,
                bbox=d.bbox.copy(),
                score=d.score,
                class_id=d.class_id,
                class_name=d.class_name,
                time_since_update=0,
                _kf=_KalmanFilter(d.bbox),
            )
            self._next_id += 1
            self._tracks.append(new_track)

        # Prune dead tracks
        self._tracks = [
            t for t in self._tracks if t.time_since_update <= self.max_age
        ]

        return [
            t for t in self._tracks
            if t.hits >= self.min_hits and t.time_since_update == 0
        ]

    def _associate(
        self,
        tracks: list[Track],
        detections: list[Detection],
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        if not tracks or not detections:
            return (
                np.empty((0, 2), dtype=int),
                np.arange(len(tracks)),
                np.arange(len(detections)),
            )

        track_boxes = np.array([t.bbox for t in tracks])
        det_boxes = np.array([d.bbox for d in detections])
        iou_matrix = _iou_batch(track_boxes, det_boxes)
        cost_matrix = 1.0 - iou_matrix

        return _linear_assignment(cost_matrix, 1.0 - self.iou_thresh)

    def get_unique_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for track in self._tracks:
            if track.hits >= self.min_hits:
                counts[track.class_name] = counts.get(track.class_name, 0) + 1
        return counts
