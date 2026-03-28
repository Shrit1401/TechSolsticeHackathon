"""
Functional (non-Sequential) Keras **autoencoder**: encode a window → vector →
decode back to a vector of length ``seq_len * features``.

Training target is the **flattened input window** (identity), not ``y`` from
``sequences.npz``. So the same ``X`` tensor is both input and label (after
reshape to match the Dense output).
"""

from tensorflow.keras.layers import Dense, Input, LSTM
from tensorflow.keras.models import Model


def build_autoencoder(seq_len: int, features: int, lstm_units: int = 16) -> Model:
    """
    ``lstm_units`` is the size of the compressed code vector (bottleneck).
    Smaller than ``ml.lstm`` defaults because reconstruction is a different task.
    """
    # Total outputs of the decoder: one scalar per timestep per feature, row-major.
    flat_dim = seq_len * features
    # Same input tensor shape as the forecaster: (batch, seq_len, features).
    input_layer = Input(shape=(seq_len, features))
    # LSTM returns a single vector (last timestep) of shape (lstm_units,).
    encoded = LSTM(lstm_units, return_sequences=False)(input_layer)
    # Dense maps bottleneck → full window length; no activation = linear decode.
    decoded = Dense(flat_dim)(encoded)
    # Functional API: explicit inputs and outputs (not a linear stack object).
    autoencoder = Model(input_layer, decoded)
    autoencoder.compile(optimizer="adam", loss="mse")
    return autoencoder
