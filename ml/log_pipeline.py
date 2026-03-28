"""
Loki log fetch, embedding-based anomaly scoring, and periodic snapshot for ``/detect``.

Pipeline:
  1. ``fetch_logs_recent`` — LogQL query over a time window (see ``ml.loki_fetch``).
  2. ``preprocess_for_embedding`` — strip digits, lowercase, whitespace token join.
  3. ``detect_logs_json`` — sentence embeddings vs a baseline centroid; z-score on
     per-line distances (see ``ml.log_anomaly_distance``).

``loki_logs_anomaly`` is the callable used by both the on-demand HTTP route and
``log_fusion_report`` (background worker). Environment variables prefix
``LOG_FUSION_*`` for the worker defaults; ``LOG_DETECTOR_LOKI_QUERY`` for the
standalone detector query when ``logql`` is omitted.
"""

from __future__ import annotations

import os
import time
from typing import Any, Sequence

from ml.log_preprocess import clean_log, tokenize
from ml.loki_fetch import fetch_logs_recent


def preprocess_for_embedding(line: str) -> str:
    """
    Turn a raw Loki line into a short string suitable for ``SentenceTransformer``.

    Removing digits reduces variance from timestamps and IDs; lowercase keeps the
    embedding space stable across casing differences.
    """
    return " ".join(tokenize(clean_log(line)))


def loki_logs_anomaly(
    logql: str | None = None,
    limit: int = 200,
    minutes: float = 15.0,
    z: float = 2.0,
    loki_url: str | None = None,
    baseline_logs: Sequence[str] | None = None,
) -> dict[str, bool | float]:
    from ml.log_anomaly_distance import detect_logs_json

    # Defer import so importing ``log_pipeline`` does not load torch/transformers
    # unless this path runs.

    q = (
        logql
        if logql is not None
        else os.environ.get("LOG_DETECTOR_LOKI_QUERY", '{job="docker"}')
    )
    resolved_loki = (
        loki_url if loki_url is not None else os.environ.get("LOKI_URL")
    )
    raw = fetch_logs_recent(
        query=q,
        limit=limit,
        minutes=minutes,
        loki_url=resolved_loki,
    )
    if not raw:
        # No lines in window: caller should treat as "no evidence", not failure.
        return {"log_anomaly": False, "score": 0.0}
    processed = [preprocess_for_embedding(line) for line in raw]
    return detect_logs_json(
        processed, baseline_logs=baseline_logs, z=z
    )


def log_fusion_report() -> dict[str, Any]:
    """Best-effort Loki pull + score; on failure returns log_fetch_ok False and zeros."""
    q = os.environ.get("LOG_FUSION_LOKI_QUERY", '{job="docker"}')
    lim = int(os.environ.get("LOG_FUSION_LIMIT", "200"))
    mins = float(os.environ.get("LOG_FUSION_MINUTES", "15"))
    z = float(os.environ.get("LOG_FUSION_Z", "2.0"))
    try:
        r = loki_logs_anomaly(logql=q, limit=lim, minutes=mins, z=z)
        now = time.time()
        return {
            "log_anomaly": bool(r.get("log_anomaly")),
            "log_score": float(r.get("score") or 0.0),
            "log_fetch_ok": True,
            "updated": now,
        }
    except Exception:
        now = time.time()
        return {
            "log_anomaly": False,
            "log_score": 0.0,
            "log_fetch_ok": False,
            "updated": now,
        }
