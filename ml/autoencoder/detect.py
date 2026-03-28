"""
Offline reconstruction anomaly check: load ``ae_model.h5`` and ``sequences.npz``,
compute per-cell absolute errors, flag if the **last window's** mean error is
above a global threshold (mean + sigma * std over **all** cells in the matrix).

Used in production from ``detector-service/ml_detect.py`` when LSTM inference fails.
"""

from __future__ import annotations

import argparse

import numpy as np
from tensorflow.keras.models import load_model

from ml.paths import DEFAULT_AE_H5, DEFAULT_SEQUENCES_NPZ


def reconstruction_error_matrix(X: np.ndarray, model) -> np.ndarray:
    """
    For each window row ``X[i]``, compare model output to ``X[i]`` flattened.

    Returns shape (num_windows, seq_len * features): one row of errors per window.
    """
    # recon shape matches flat: (batch, seq_len * features).
    recon = model.predict(X, verbose=0)
    # -1 infers seq_len * features from X's size; must match training flatten order.
    flat = X.reshape(X.shape[0], -1)
    # Elementwise absolute difference; sum/mean over axis=1 would give per-window scalars.
    return np.abs(recon - flat)


def last_window_anomaly(
    recon_error: np.ndarray, sigma: float = 2.0
) -> tuple[bool, float]:
    """
    Threshold uses **every** entry in recon_error (all windows, all positions),
    so it is a single global statistic for the batch. Then compare the **mean**
    of the **last row** only to that threshold.
    """
    threshold = float(recon_error.mean() + sigma * recon_error.std())
    # Mean across all features in the last window → one scalar severity.
    flag = bool(recon_error[-1].mean() > threshold)
    return flag, threshold


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Autoencoder reconstruction anomaly check (last window)."
    )
    parser.add_argument(
        "--model",
        default=str(DEFAULT_AE_H5),
        help=f"Trained .h5 (default: {DEFAULT_AE_H5}).",
    )
    parser.add_argument(
        "--data",
        default=str(DEFAULT_SEQUENCES_NPZ),
        help=f"sequences.npz (default: {DEFAULT_SEQUENCES_NPZ}).",
    )
    parser.add_argument("--sigma", type=float, default=2.0)
    args = parser.parse_args()

    bundle = np.load(args.data)
    X = np.asarray(bundle["X"], dtype=np.float32)
    if X.size == 0:
        raise SystemExit("empty X")

    autoencoder = load_model(args.model, compile=False)
    recon_error = reconstruction_error_matrix(X, autoencoder)
    flag, _ = last_window_anomaly(recon_error, sigma=args.sigma)

    if flag:
        print("ANOMALY (AUTOENCODER)")


if __name__ == "__main__":
    main()
