"""
CLI entry: load ``sequences.npz`` (from ``python -m ml.preprocess``), build the
LSTM, fit weights, write ``lstm_model.h5`` (or ``-o`` path).

The file ``sequences.npz`` must contain:
  - ``X``: float array, shape (N, seq_len, features)
  - ``y``: float array, shape (N, features) — next step after each window

Nothing here validates against a hold-out set; it is a minimal training script.
"""

from __future__ import annotations

import argparse

import numpy as np

from ml.lstm.model import build_lstm
from ml.paths import DEFAULT_LSTM_H5, DEFAULT_SEQUENCES_NPZ, ensure_parent


def main() -> None:
    # argparse builds ``--help`` and parses command-line strings into typed values.
    parser = argparse.ArgumentParser(description="Train LSTM forecaster.")
    parser.add_argument(
        "--data",
        default=str(DEFAULT_SEQUENCES_NPZ),
        help=f"sequences.npz path (default: {DEFAULT_SEQUENCES_NPZ}).",
    )
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--units", type=int, default=50)
    parser.add_argument(
        "-o",
        "--output",
        default=str(DEFAULT_LSTM_H5),
        help=f"Keras .h5 path (default: {DEFAULT_LSTM_H5}).",
    )
    args = parser.parse_args()

    # np.load reads .npz as an archive; keys "X" and "y" must exist (from preprocess).
    bundle = np.load(args.data)
    # float32 matches typical GPU training and matches inference dtype elsewhere.
    X = np.asarray(bundle["X"], dtype=np.float32)
    y = np.asarray(bundle["y"], dtype=np.float32)
    if X.size == 0 or y.size == 0:
        raise SystemExit("empty X or y; build sequences.npz with more rows")

    # Infer model topology from data: no hard-coded seq_len/features.
    seq_len, feat = X.shape[1], X.shape[2]
    model = build_lstm(seq_len, feat, units=args.units)
    # fit: for each epoch, shuffle minibatches of size batch_size and update weights.
    # verbose=1 prints a progress bar per epoch.
    model.fit(X, y, epochs=args.epochs, batch_size=args.batch_size, verbose=1)
    # Create parent directory of output file if missing (e.g. data/ml/models/).
    ensure_parent(args.output)
    # Saves architecture + weights in HDF5 format for load_model(..., compile=False).
    model.save(args.output)


if __name__ == "__main__":
    # Only runs when this file is executed directly, not when imported.
    main()
