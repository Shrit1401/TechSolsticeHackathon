"""
Keras **Sequential** LSTM that forecasts **one scalar**: the value at time t+1
given a window of the previous ``seq_len`` timesteps.

Data flow (after ``ml.preprocess``):
  - Each training row ``X[i]`` has shape ``(seq_len, features)`` — e.g. past 10
    latency readings scaled to [0,1].
  - Matching ``y[i]`` has shape ``(features,)`` — the **single next** timestep
    after that window (supervised target).

So the network output is ``Dense(1)`` when ``features == 1`` (one metric).
"""

from tensorflow.keras.layers import Dense, Input, LSTM
from tensorflow.keras.models import Sequential


def build_lstm(seq_len: int, features: int, units: int = 50) -> Sequential:
    """
    Construct an untrained model. Parameters must match the arrays in
    ``sequences.npz``: ``seq_len`` and ``features`` come from ``X.shape[1:]``.

    ``units`` is the LSTM hidden state size (capacity vs speed / overfitting).
    """
    # Sequential stacks layers in order: first layer = input, last = output.
    model = Sequential(
        [
            # Explicit Input(shape=...) is the Keras 3-friendly way to declare
            # input dimensions (avoids input_shape-only on LSTM deprecation noise).
            # One sample is (seq_len, features): a matrix per batch row.
            Input(shape=(seq_len, features)),
            # LSTM reads the time dimension; return_sequences=False means we only
            # keep the **last** output vector of shape (units,) per sample.
            LSTM(units),
            # Map LSTM output to a single number = predicted next timestep
            # (per feature if you ever used features>1; here typically 1).
            Dense(1),
        ]
    )
    # Mean squared error: penalize large gaps between prediction and y.
    # Adam is a default adaptive learning rate optimizer.
    model.compile(optimizer="adam", loss="mse")
    return model
