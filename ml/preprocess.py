"""
Step 2 — Scale values to [0, 1] and build sliding windows for supervised learning.

Used after ``ml.fetch`` CSV export. The LSTM predicts the **next** timestep from
``seq_len`` past steps; the autoencoder reconstructs the **same** window (see
``ml.autoencoder.train``), which flattens ``X`` to a vector target.

Tensor shapes:
  - ``X``: ``(samples, seq_len, features)``
  - ``y``: ``(samples, features)`` — one row per window, next value for LSTM.

For a single Prometheus series, ``features`` is 1.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

from ml.paths import DEFAULT_RAW_CSV, DEFAULT_SEQUENCES_NPZ, ensure_parent


def normalize_values(
    values: np.ndarray | pd.Series,
    scaler: MinMaxScaler | None = None,
) -> tuple[np.ndarray, MinMaxScaler]:
    """
    Fit or apply MinMaxScaler on a 1-D series reshaped to (n, 1).

    Pass a fitted ``scaler`` at inference time to avoid leakage from test data.
    """
    arr = np.asarray(values, dtype=np.float64).reshape(-1, 1)
    if scaler is None:
        scaler = MinMaxScaler()
        out = scaler.fit_transform(arr)
    else:
        out = scaler.transform(arr)
    return out, scaler


def create_sequences(
    data: np.ndarray, seq_len: int = 10
) -> tuple[np.ndarray, np.ndarray]:
    """
    For each index i, X[i] is ``data[i : i + seq_len]`` and y[i] is the next step.
    """
    data = np.asarray(data, dtype=np.float64)
    if data.ndim == 1:
        data = data.reshape(-1, 1)

    X_list: list[np.ndarray] = []
    y_list: list[np.ndarray] = []
    # One sample per valid start index; last ``seq_len`` rows cannot predict a next step.
    for i in range(len(data) - seq_len):
        X_list.append(data[i : i + seq_len])
        y_list.append(data[i + seq_len])

    if not X_list:
        feat = data.shape[1] if data.ndim > 1 else 1
        return np.empty((0, seq_len, feat)), np.empty((0, feat))

    X = np.array(X_list)
    y = np.array(y_list)
    if y.ndim == 1:
        y = y.reshape(-1, 1)
    return X, y


def prepare_ml_sequences(
    df: pd.DataFrame,
    seq_len: int = 10,
    value_col: str = "value",
) -> tuple[np.ndarray, np.ndarray, MinMaxScaler]:
    """End-to-end: scale ``value_col`` then build X, y and return the scaler."""
    df = df.dropna(subset=[value_col])
    scaled, scaler = normalize_values(df[value_col].values)
    X, y = create_sequences(scaled, seq_len=seq_len)
    return X, y, scaler


def main() -> None:
    parser = argparse.ArgumentParser(
        description="CSV [time,value] → sequences.npz with keys X, y."
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_RAW_CSV),
        help=f"CSV from ml.fetch (default: {DEFAULT_RAW_CSV}).",
    )
    parser.add_argument("--seq-len", type=int, default=10)
    parser.add_argument(
        "-o",
        "--output",
        default=str(DEFAULT_SEQUENCES_NPZ),
        help=f"Output .npz path (default: {DEFAULT_SEQUENCES_NPZ}).",
    )
    args = parser.parse_args()

    df = pd.read_csv(args.input).dropna(subset=["value"])
    X, y, scaler = prepare_ml_sequences(df, seq_len=args.seq_len)
    ensure_parent(args.output)
    np.savez(args.output, X=X, y=y)
    scaler_path = Path(args.output).with_name(Path(args.output).stem + "_scaler.joblib")
    joblib.dump(scaler, ensure_parent(scaler_path))


if __name__ == "__main__":
    main()
