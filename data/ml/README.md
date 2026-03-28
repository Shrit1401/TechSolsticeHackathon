# ML data directory

| Subfolder | Contents |
|-----------|----------|
| `raw/` | Prometheus CSV exports (`time`, `value`). Default CLI output: `export.csv`. You can keep several series here (e.g. `latency.csv`, `errors.csv`) and pass `--input` / `-o` explicitly. |
| `sequences/` | `sequences.npz` plus matching `sequences_scaler.joblib` from preprocess (both required for ML inference in detector-service). Ignored by git except `.gitkeep`. |
| `models/` | Keras `.h5` weights. Defaults: `lstm_model.h5`, `ae_model.h5`. Ignored by git. |

Paths are defined in `ml/paths.py`. Set **`ML_DATA_ROOT`** to use a different root directory with the same `raw/` / `sequences/` / `models/` subfolders.
