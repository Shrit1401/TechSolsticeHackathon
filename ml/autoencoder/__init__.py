"""
Public API for the **LSTM autoencoder** (reconstruction) package.

Unlike the forecaster in ``ml.lstm``, this model does **not** predict the next
timestep. It compresses each window through an LSTM bottleneck and tries to
**reproduce the same window** as a flat vector. Large reconstruction error on
the latest window can flag unusual shapes (used as fallback in
``detector-service`` when the forecaster path errors).

Exports:
  - ``build_autoencoder`` — Keras model (encoder + dense decoder).
  - ``reconstruction_error_matrix`` — |output − flattened input| per window.
  - ``last_window_anomaly`` — threshold last row's mean error vs global stats.
"""

from ml.autoencoder.detect import last_window_anomaly, reconstruction_error_matrix
from ml.autoencoder.model import build_autoencoder

__all__ = [
    "build_autoencoder",
    "reconstruction_error_matrix",
    "last_window_anomaly",
]
