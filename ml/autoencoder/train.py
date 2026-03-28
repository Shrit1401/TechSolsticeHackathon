"""
CLI: train the autoencoder on ``sequences.npz`` using only ``X``.

Labels are ``X`` reshaped to (batch, seq_len * features): each sample must match
its own input after flattening — classic autoencoder reconstruction loss.
"""

from __future__ import annotations

import argparse

import numpy as np

from ml.autoencoder.model import build_autoencoder
from ml.paths import DEFAULT_AE_H5, DEFAULT_SEQUENCES_NPZ, ensure_parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Train LSTM autoencoder.")
    parser.add_argument(
        "--data",
        default=str(DEFAULT_SEQUENCES_NPZ),
        help=f"sequences.npz path (default: {DEFAULT_SEQUENCES_NPZ}).",
    )
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lstm-units", type=int, default=16)
    parser.add_argument(
        "-o",
        "--output",
        default=str(DEFAULT_AE_H5),
        help=f"Keras .h5 path (default: {DEFAULT_AE_H5}).",
    )
    args = parser.parse_args()

    bundle = np.load(args.data)
    # Only X is required; y from preprocess is ignored for this model.
    X = np.asarray(bundle["X"], dtype=np.float32)
    if X.size == 0:
        raise SystemExit("empty X")

    seq_len, feat = X.shape[1], X.shape[2]
    # Must match training in train.py: (N, seq_len * feat) row-major flatten.
    flat = X.reshape(X.shape[0], seq_len * feat)

    autoencoder = build_autoencoder(seq_len, feat, lstm_units=args.lstm_units)
    # X is 3-D input; flat is 2-D target matching Dense output shape.
    autoencoder.fit(X, flat, epochs=args.epochs, batch_size=args.batch_size, verbose=1)
    ensure_parent(args.output)
    autoencoder.save(args.output)


if __name__ == "__main__":
    main()
