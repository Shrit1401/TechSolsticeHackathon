"""
Prometheus latency → scaled windows → LSTM score (autoencoder on failure).

When ENABLE_ML_ANOMALY is set, a background loop calls run_realtime_ml_cycle;
GET /detect reads the latest snapshot.
"""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)

_lstm_model = None
_ae_model = None

EMPTY_SNAPSHOT = {
    "metric_anomaly": False,
    "score": 0.0,
    "source": "NONE",
}

# Check if ML anomaly detection is enabled
def ml_anomaly_enabled() -> bool:
    v = os.environ.get("ENABLE_ML_ANOMALY", "").strip().lower()
    return v in ("1", "true", "yes")


# Load the LSTM model
def _get_lstm_model():
    global _lstm_model
    if _lstm_model is None:
        path = os.environ.get("ML_MODEL_PATH", "").strip()
        if not path or not Path(path).is_file():
            raise FileNotFoundError("ML_MODEL_PATH missing or not found")
        from tensorflow.keras.models import load_model

        _lstm_model = load_model(path, compile=False)
    return _lstm_model


# Load the autoencoder model
def _get_ae_model():
    global _ae_model
    if _ae_model is None:
        path = os.environ.get("ML_AE_MODEL_PATH", "").strip()
        if not path or not Path(path).is_file():
            raise FileNotFoundError("ML_AE_MODEL_PATH missing or not found")
        from tensorflow.keras.models import load_model

        _ae_model = load_model(path, compile=False)
    return _ae_model

# Fetch and prepare the data for the LSTM model
def _fetch_and_prepare(prometheus_url: str) -> tuple[np.ndarray, np.ndarray] | None:
    import joblib
    from ml.fetch import PRESETS, fetch_metric
    from ml.preprocess import create_sequences

    scaler_path = os.environ.get("ML_SCALER_PATH", "").strip()
    if not scaler_path or not Path(scaler_path).is_file():
        logger.info("ml: ML_SCALER_PATH missing or not found")
        return None

    lookback = float(os.environ.get("ML_PROMETHEUS_LOOKBACK_S", "3600"))
    step = os.environ.get("ML_PROMETHEUS_STEP", "5s")
    end = time.time()
    start = end - lookback

    df = fetch_metric(
        PRESETS["latency"],
        start,
        end,
        step=step,
        prom_url=prometheus_url,
    )
    df = df.dropna(subset=["value"])
    if len(df) < 32:
        logger.info("ml: insufficient prometheus samples (%s)", len(df))
        return None

    # Load the scaler
    scaler = joblib.load(scaler_path)
    values = df["value"].astype(float).values.reshape(-1, 1)
    scaled = scaler.transform(values).astype(np.float32)

    # Create the sequences
    lstm = _get_lstm_model()
    seq_len = int(lstm.input_shape[1])
    X, y = create_sequences(scaled, seq_len=seq_len)
    if X.shape[0] < 3:
        logger.info("ml: not enough sequences after windowing")
        return None
    return X, y


def _lstm_scores(X: np.ndarray, y: np.ndarray) -> tuple[bool, float]:
    model = _get_lstm_model()
    pred = model.predict(X, verbose=0)
    error = np.abs(pred - y).reshape(-1)
    threshold_m = float(np.percentile(error, 95))
    last_e = float(error[-1])
    if threshold_m <= 0:
        metric_score = 1.0 if last_e > 0 else 0.0
        anom = last_e > 0
    else:
        metric_score = min(1.0, last_e / threshold_m)
        anom = last_e > threshold_m
    return anom, metric_score


def _ae_scores(X: np.ndarray) -> tuple[bool, float]:
    from ml.autoencoder.detect import reconstruction_error_matrix

    model = _get_ae_model()
    recon_err = reconstruction_error_matrix(X, model)
    flat = np.asarray(recon_err, dtype=float).ravel()
    threshold_m = float(np.percentile(flat, 95))
    last_mean = float(recon_err[-1].mean())
    if threshold_m <= 0:
        metric_score = 1.0 if last_mean > 0 else 0.0
        anom = last_mean > 0
    else:
        metric_score = min(1.0, last_mean / threshold_m)
        anom = last_mean > threshold_m
    return anom, metric_score


# Run the realtime ML cycle
def run_realtime_ml_cycle(prometheus_url: str) -> dict:
    if not ml_anomaly_enabled():
        return dict(EMPTY_SNAPSHOT)

    try:
        # Fetch and prepare the data for the LSTM model
        xy = _fetch_and_prepare(prometheus_url)
        # If the data is not available, return an empty snapshot
        if xy is None:
            return dict(EMPTY_SNAPSHOT)
        X, y = xy
        # If the data is available, calculate the scores for the LSTM model
    except Exception:
        logger.exception("ml: fetch/prepare failed")
        return dict(EMPTY_SNAPSHOT)

    try:
        # Calculate the scores for the LSTM model
        anom, sc = _lstm_scores(X, y)
        # If the anomaly is detected, return the snapshot
        if anom:
            return {"metric_anomaly": True, "score": sc, "source": "LSTM"}
        # If the anomaly is not detected, return an empty snapshot
        return {"metric_anomaly": False, "score": sc, "source": "NONE"}
    except Exception as e:
        logger.warning("ml: LSTM failed (%s)", e)
        # If the LSTM model fails, try the autoencoder model
        ae_path = os.environ.get("ML_AE_MODEL_PATH", "").strip()
        if not ae_path or not Path(ae_path).is_file():
            logger.info(
                "ml: skip autoencoder fallback (set ML_AE_MODEL_PATH to a trained .h5)"
            )
            return dict(EMPTY_SNAPSHOT)
        try:
            # Calculate the scores for the autoencoder model
            anom, sc = _ae_scores(X)
            if anom:
                # If the anomaly is detected, return the snapshot
                return {
                    "metric_anomaly": True,
                    "score": sc,
                    "source": "AUTOENCODER",
                }
            # If the anomaly is not detected, return an empty snapshot
            return {"metric_anomaly": False, "score": sc, "source": "NONE"}
        except Exception:
            logger.exception("ml: autoencoder inference failed")
            return dict(EMPTY_SNAPSHOT)


