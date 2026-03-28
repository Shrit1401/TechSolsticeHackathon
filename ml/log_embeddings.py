"""
Dense vector representations of log lines for distance-based anomaly detection.

Uses ``sentence-transformers`` (default ``all-MiniLM-L6-v2``): small, fast, and
fine for semantic similarity. Override with ``LOG_EMBED_MODEL`` to swap in a
larger BERT-family model if disk and latency allow.

The model is cached process-wide so repeated calls in the log worker do not
reload weights. First inference may download weights from Hugging Face Hub.

this module creates numerical vector representations (embeddings) of log entries so we can easily compare them and detect anomalies.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Sequence

import numpy as np
from sentence_transformers import SentenceTransformer

# Lightweight general-purpose embedding; good default for log lines.
DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"

# this function is used to load the model
@lru_cache(maxsize=1) # this is used to cache the model so we don't need to load it again and again
def _load_model(model_name: str) -> SentenceTransformer:
    """Load exactly one ``SentenceTransformer`` per distinct ``model_name``."""
    return SentenceTransformer(model_name)

# this function is used to get the embedding model
def embedding_model() -> SentenceTransformer:
    """Return the shared model instance (name from env or ``DEFAULT_MODEL_NAME``)."""
    name = os.environ.get("LOG_EMBED_MODEL", DEFAULT_MODEL_NAME)
    return _load_model(name)

# this function is used to get the embeddings, and return the embeddings as a numpy array
def get_embeddings(
    logs: str | Sequence[str],
) -> np.ndarray:
    """
    Encode one string or a batch to a 2-D ``numpy`` array (rows = embeddings).

    Shape matches ``SentenceTransformer.encode`` conventions: (d,) for a
    single string becomes (1, d) when a list of one element is passed; a bare
    string returns a 1-D vector — callers in ``log_anomaly_distance`` coerce
    shapes as needed.
    """
    model = embedding_model() # get the embedding model
    return model.encode(logs)
