<!--
  Maintainer note: Python modules in this folder carry detailed docstrings;
  this file is the human-oriented overview and CLI cookbook.
-->

# Metrics → ML anomaly pipeline

Small toolkit that lives beside `detector-service`: pull Prometheus series, build training windows, train models, and flag the **latest** window.

## Repository layout

| Path | Role |
|------|------|
| `fetch.py` | Prometheus `query_range` → CSV `[time, value]` |
| `preprocess.py` | Scale + sliding windows → `sequences.npz` (`X`, `y`) |
| `lstm/model.py`, `lstm/train.py`, `lstm/detect.py` | Forecaster + prediction-error anomalies |
| `autoencoder/` | Backup reconstructor + reconstruction-error anomalies |
| `paths.py` | Defaults for `data/ml/...` (see below) |
| `requirements.txt` | Python dependencies for this package |

### Artifact folders (defaults)

| Directory | Files |
|-----------|--------|
| `data/ml/raw/` | CSV exports (default `export.csv`) |
| `data/ml/sequences/` | `sequences.npz` |
| `data/ml/models/` | `lstm_model.h5`, `ae_model.h5` |

Override the root with **`ML_DATA_ROOT`**; subpaths stay `raw/`, `sequences/`, `models/`.

Run commands from the **repository root** so `ml` resolves as a package.

## Setup

```bash
pip install -r ml/requirements.txt
```

## Typical flow

Defaults write under `data/ml/`; you only need extra flags for custom names.

```bash
python -m ml.fetch --preset latency
python -m ml.preprocess --seq-len 10
python -m ml.lstm.train
python -m ml.lstm.detect
```

Named CSV (e.g. latency vs errors side by side):

```bash
python -m ml.fetch --preset latency -o data/ml/raw/latency.csv
python -m ml.preprocess --input data/ml/raw/latency.csv -o data/ml/sequences/latency_seq.npz
python -m ml.lstm.train --data data/ml/sequences/latency_seq.npz -o data/ml/models/latency_lstm.h5
```

Autoencoder backup (writes `data/ml/models/ae_model.h5` by default):

```bash
python -m ml.preprocess --input data/ml/raw/latency.csv
python -m ml.autoencoder.train
python -m ml.autoencoder.detect
```

Rows with empty `value` cells are dropped during preprocess so training does not see NaNs.

## Environment

- `PROM_URL`: Prometheus base URL (default `http://localhost:9090` for Docker Compose on the host).
- `ML_DATA_ROOT`: Optional directory to use instead of `<repo>/data/ml`.

## Notes

- `.h5` saves are legacy Keras format; loaders use `compile=False` for reliable inference under Keras 3.
- For production splits, fit `MinMaxScaler` only on training rows before building sequences.
- **Preprocess** writes `*_scaler.joblib` next to each `.npz`; keep it with the model for `detector-service` ML mode (`ML_SCALER_PATH`).

## Detector service

Set `ENABLE_ML_ANOMALY=1` when `lstm_model.h5` and `sequences_scaler.joblib` exist under `data/ml` (mounted at `/data/ml` in Compose). Optionally place `ae_model.h5` as `ML_AE_MODEL_PATH` for backup if the LSTM forward pass throws.

A background loop (`REALTIME_ML_INTERVAL_S`, default 30) runs: fetch latency → scale → windows → LSTM; on LSTM failure, autoencoder reconstruction error. `GET /detect` returns `metric_anomaly`, `score`, `source` (`LSTM`, `AUTOENCODER`, `ERROR_RATE`, or `NONE`) merged with the live error-rate check.
