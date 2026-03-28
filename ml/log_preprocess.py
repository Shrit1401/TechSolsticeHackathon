"""
Lightweight normalization before sentence embedding.

Digits are stripped so timestamps and HTTP codes perturb the embedding less.
Lowercasing reduces duplicate clusters that differ only by case. Tokenization is
whitespace split — no stemming; the embedding model handles morphology.
"""

from __future__ import annotations

import re


def clean_log(log: str) -> str:
    """Remove digit runs and fold to lowercase."""
    log = re.sub(r"\d+", "", log)
    log = log.lower()
    return log


def tokenize(log: str) -> list[str]:
    """Split on whitespace for re-joining into a single space-separated string."""
    return log.split()
