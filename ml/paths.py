"""
Filesystem layout for ML pipeline artifacts.

Default root: ``<repo>/data/ml``. Override with ``ML_DATA_ROOT``; relative paths
resolve from the **current working directory**, not necessarily the repo root.

Intended layout:
  - ``raw/`` — CSV from ``python -m ml.fetch``
  - ``sequences/`` — ``sequences.npz`` plus ``*_scaler.joblib`` from preprocess
  - ``models/`` — ``lstm_model.h5``, ``ae_model.h5`` from training CLIs

``detector-service`` mounts ``./data/ml`` read-only at ``/data/ml`` in Compose;
point ``ML_MODEL_PATH`` / ``ML_SCALER_PATH`` at those container paths.
"""

from __future__ import annotations

import os
from pathlib import Path

_PKG_DIR = Path(__file__).resolve().parent
# ``ml/`` package directory; parent is repository root for default ``data/ml``.
REPO_ROOT = _PKG_DIR.parent
_ml_root = os.environ.get("ML_DATA_ROOT")
ML_ROOT = (
    Path(_ml_root).expanduser().resolve()
    if _ml_root
    else (REPO_ROOT / "data" / "ml")
)
RAW_DIR = ML_ROOT / "raw"
SEQUENCES_DIR = ML_ROOT / "sequences"
MODELS_DIR = ML_ROOT / "models"

# Default filenames used by CLIs when flags are omitted.
DEFAULT_RAW_CSV = RAW_DIR / "export.csv"
DEFAULT_SEQUENCES_NPZ = SEQUENCES_DIR / "sequences.npz"
DEFAULT_SEQUENCES_SCALER = SEQUENCES_DIR / "sequences_scaler.joblib"
DEFAULT_LSTM_H5 = MODELS_DIR / "lstm_model.h5"
DEFAULT_AE_H5 = MODELS_DIR / "ae_model.h5"


def ensure_ml_dirs() -> None:
    """Create ``data/ml/{raw,sequences,models}`` if missing."""
    for directory in (RAW_DIR, SEQUENCES_DIR, MODELS_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def ensure_parent(path: str | Path) -> Path:
    """Create the parent directory for a file path."""
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    return p
