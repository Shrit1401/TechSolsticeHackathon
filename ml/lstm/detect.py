"""
Offline anomaly check using a **trained** LSTM and the same ``sequences.npz``.

For each window in ``X``, the model predicts the next value; we compare to ``y``
and take absolute error. We then ask: is the **last** window's error unusually
high compared to all errors in this file? (mean + sigma * std threshold.)

This mirrors ``detector-service/ml_detect.py`` logic so local experiments match prod.
"""

from __future__ import annotations

import argparse

import numpy as np
from tensorflow.keras.models import load_model

from ml.paths import DEFAULT_LSTM_H5, DEFAULT_SEQUENCES_NPZ


def prediction_errors(X: np.ndarray, y: np.ndarray, model) -> np.ndarray:
    """
    Run forward pass on all windows; return shape (N,) — one error per window.

    ``pred`` has shape like y (e.g. (N, 1)); subtract y, take abs, flatten so
    downstream code always sees a 1-D vector of length N.
    """
    # predict: batch inference, no gradient updates. verbose=0 silences Keras logs.
    pred = model.predict(X, verbose=0)
    # Elementwise |pred - y|; reshape(-1) collapses (N,1) to (N,).
    return np.abs(pred - y).reshape(-1)


def anomaly_flags(
    errors: np.ndarray, sigma: float = 2.0
) -> tuple[np.ndarray, float]:
    """
    Univariate threshold on the error vector: threshold = mean + sigma * std.
    Returns a boolean array (same length as errors) and the scalar threshold.
    """
    # float() ensures plain Python float, not numpy scalar, for JSON/logging if needed.
    threshold = float(errors.mean() + sigma * errors.std())
    # True wherever this window's error exceeded the global bar.
    anomalies = errors > threshold
    return anomalies, threshold


def main() -> None:
    parser = argparse.ArgumentParser(description="LSTM prediction-error anomaly check.")
    parser.add_argument(
        "--model",
        default=str(DEFAULT_LSTM_H5),
        help=f"Trained .h5 (default: {DEFAULT_LSTM_H5}).",
    )
    parser.add_argument(
        "--data",
        default=str(DEFAULT_SEQUENCES_NPZ),
        help=f"sequences.npz (default: {DEFAULT_SEQUENCES_NPZ}).",
    )
    parser.add_argument(
        "--sigma",
        type=float,
        default=2.0,
        help="Multiplier for std dev above mean error (default: 2).",
    )
    args = parser.parse_args()

    bundle = np.load(args.data)
    X = np.asarray(bundle["X"], dtype=np.float32)
    y = np.asarray(bundle["y"], dtype=np.float32)
    if X.size == 0:
        raise SystemExit("empty X")

    # compile=False skips restoring optimizer state; inference only needs weights.
    # Required for smooth loads under Keras 3 with older .h5 checkpoints.
    model = load_model(args.model, compile=False)
    error = prediction_errors(X, y, model)
    # We only care whether the **most recent** window (last index) is anomalous.
    anomalies, _ = anomaly_flags(error, sigma=args.sigma)

    if anomalies[-1]:
        print("ANOMALY DETECTED")


if __name__ == "__main__":
    main()
