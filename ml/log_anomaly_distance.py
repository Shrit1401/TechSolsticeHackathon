"""
Embedding-space distance scoring for log anomaly detection.

Idea: embed each line with the same model, compare each line's vector to a
**baseline centroid** (mean of embeddings of a few "normal" template strings,
or caller-supplied ``baseline_logs``). Euclidean distance measures how far a
line drifts semantically from that centroid.

For a batch of new lines, per-line distances get a global threshold
``mean(distances) + z * std(distances)``. The API exposed to HTTP returns whether
the **maximum** distance in the batch exceeds that threshold (aggressive: one
bad line flags the window) and reports that max as ``score``.

This is unsupervised and sensitive to baseline choice; tune ``z`` and baseline
strings for your deployment.
"""

from __future__ import annotations

from typing import Sequence

import numpy as np

from ml.log_embeddings import get_embeddings

# Default "happy path" phrases if the caller does not pass ``baseline_logs`` (sucess)
BASELINE_LOGS = [
    "request success",
    "user login success",
    "payment completed",
]

# this function is used to get the baseline mean, we're doing this because we want to get the average embedding vector representing nominal log semantics.
def baseline_mean(baseline_logs: Sequence[str] | None = None) -> np.ndarray:
    """Average embedding vector representing nominal log semantics."""
    logs = list(baseline_logs) if baseline_logs is not None else BASELINE_LOGS
    baseline_vecs = get_embeddings(logs)
    return np.asarray(baseline_vecs, dtype=float).mean(axis=0) # return the average embedding vector representing nominal log semantics.

# this function is used to compute the score, we're doing this by computing the Euclidean distance between one embedding row and the baseline centroid.
def compute_score(log_vec: np.ndarray, mean_vec: np.ndarray) -> float:
    a = np.asarray(log_vec, dtype=float).ravel() # return the embedding vector as a 1-D array
    b = np.asarray(mean_vec, dtype=float).ravel() # return the baseline embedding vector as a 1-D array
    return float(np.linalg.norm(a - b)) # return the Euclidean distance between the two vectors

# this function is used to score and detect, we're doing this by computing the per-line distances, global z-score threshold, and per-line anomaly flags.
def score_and_detect(
    embeddings: np.ndarray,
    mean_vec: np.ndarray,
    z: float = 2.0,
) -> tuple[list[float], float, list[bool]]:
    """Per-line distances, global z-score threshold, per-line anomaly flags."""
    e = np.asarray(embeddings, dtype=float)
    if e.ndim == 1:
        e = e.reshape(1, -1)
    if e.shape[0] == 0:
        return [], float("nan"), []
    scores = [compute_score(e[i], mean_vec) for i in range(e.shape[0])]
    std = float(np.std(scores))
    # Relative to *this batch* only — not a fixed training distribution.
    threshold = float(np.mean(scores) + z * std)
    anomaly_flags = [s > threshold for s in scores]
    return scores, threshold, anomaly_flags


def run_pipeline(
    new_logs: Sequence[str],
    baseline_logs: Sequence[str] | None = None,
    z: float = 2.0,
) -> tuple[list[float], float, list[bool], np.ndarray]:
    """End-to-end: centroid, embeddings for ``new_logs``, scores, flags, ``mu``."""
    mu = baseline_mean(baseline_logs)
    emb = get_embeddings(list(new_logs))
    scores, threshold, flags = score_and_detect(emb, mu, z=z)
    return scores, threshold, flags, mu


def finalize_log_score(scores: Sequence[float], threshold: float) -> dict[str, bool | float]:
    """Collapse per-line scores to one boolean + max distance for HTTP JSON."""
    if not scores:
        return {"log_anomaly": False, "score": 0.0}
    final_score = max(float(s) for s in scores)
    anomaly = final_score > threshold
    return {"log_anomaly": anomaly, "score": float(final_score)}


def detect_logs_json(
    new_logs: Sequence[str],
    baseline_logs: Sequence[str] | None = None,
    z: float = 2.0,
) -> dict[str, bool | float]:
    """Public entry: same contract as ``loki_logs_anomaly`` expects downstream."""
    scores, threshold, _, _ = run_pipeline(
        new_logs, baseline_logs=baseline_logs, z=z
    )
    return finalize_log_score(scores, threshold)
