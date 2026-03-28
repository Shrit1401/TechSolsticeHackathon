"""
Time-series anomaly pipeline for this repository.

High-level flow:
  1. ``ml.fetch`` — HTTP ``query_range`` against Prometheus; CSV of [time, value].
  2. ``ml.preprocess`` — MinMax scale and sliding windows into ``sequences.npz``.
  3. ``ml.lstm`` / ``ml.autoencoder`` — train Keras models on those sequences;
     optional offline scoring CLIs mirror what ``detector-service`` does online.

Separate concerns (logs, traces) live in sibling modules and are imported by
``detector-service``, not re-exported here.

Lazy attribute loading (``__getattr__`` below):
  Importing ``import ml`` does not immediately load ``fetch`` or ``preprocess``.
  That keeps ``python -m ml.fetch`` from executing heavy imports during package
  initialization and avoids duplicate-import noise from ``runpy``.
"""

from __future__ import annotations

from typing import Any

__all__ = [
    "PRESETS",
    "fetch_metric",
    "normalize_values",
    "create_sequences",
    "prepare_ml_sequences",
]


def __getattr__(name: str) -> Any:
    # PEP 562: resolve ``ml.PRESETS`` etc. on first access only.
    if name in ("PRESETS", "fetch_metric"):
        from ml import fetch as _fetch

        return getattr(_fetch, name)
    if name in ("normalize_values", "create_sequences", "prepare_ml_sequences"):
        from ml import preprocess as _preprocess

        return getattr(_preprocess, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(__all__)
