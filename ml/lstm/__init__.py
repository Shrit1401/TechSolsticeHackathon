"""
Public API for the LSTM **next-step forecasting** package.

What this subpackage does:
  - ``build_lstm`` — builds the Keras model (architecture only, random weights).
  - ``prediction_errors`` — given trained model + batches ``X``, ``y``, returns
    one absolute error per sample (|predicted next step − true next step|).
  - ``anomaly_flags`` — turns a vector of errors into booleans + threshold
    (mean + sigma * std over that vector).

Training and saving weights is **not** done here; run ``python -m ml.lstm.train``.
Scoring live traffic uses the same math in ``detector-service/ml_detect.py``.
"""

# Re-export symbols so callers can write ``from ml.lstm import build_lstm`` etc.
from ml.lstm.detect import anomaly_flags, prediction_errors
from ml.lstm.model import build_lstm

# ``__all__`` limits ``from ml.lstm import *`` to these names (and documents intent).
__all__ = ["build_lstm", "prediction_errors", "anomaly_flags"]
