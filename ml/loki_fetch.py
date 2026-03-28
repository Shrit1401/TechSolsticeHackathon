"""
HTTP client for Grafana Loki log query APIs.

Supports ``/loki/api/v1/query`` (instant) and ``/loki/api/v1/query_range``
(time window). ``_loki_base`` accepts either ``http://host:3100`` or a full query
URL and strips the suffix so both styles work. Parsed responses flatten Loki
streams into log lines or ``(ts_ns, line)`` rows for CSV export.
"""

from __future__ import annotations

import argparse
import os
import time
from typing import Any, Optional

import pandas as pd
import requests


def _loki_base(base_or_full: Optional[str] = None) -> str:
    """Return Loki base URL without trailing ``/loki/api/v1/query`` if duplicated."""
    raw = (base_or_full or os.environ.get("LOKI_URL", "http://localhost:3100")).rstrip(
        "/"
    )
    suf = "/loki/api/v1/query"
    if raw.endswith(suf):
        return raw[: -len(suf)]
    return raw


def loki_query_endpoint(base_or_full: Optional[str] = None) -> str:
    """Full URL for Loki instant (non-range) queries."""
    return f"{_loki_base(base_or_full)}/loki/api/v1/query"


def loki_query_range_endpoint(base_or_full: Optional[str] = None) -> str:
    """Full URL for ``query_range`` with ``start``/``end`` in nanoseconds."""
    return f"{_loki_base(base_or_full)}/loki/api/v1/query_range"


def _raise_if_loki_error(body: dict[str, Any]) -> None:
    if body.get("status") != "success":
        raise RuntimeError(str(body.get("error") or body))


def _streams_to_lines(body: dict[str, Any]) -> list[str]:
    """Extract log text only (second column of each ``[ts, line]`` value)."""
    _raise_if_loki_error(body)
    result = (body.get("data") or {}).get("result") or []
    logs: list[str] = []
    for stream in result:
        for value in stream.get("values") or []:
            if len(value) >= 2:
                logs.append(str(value[1]))
    return logs


def _streams_to_rows(body: dict[str, Any]) -> list[tuple[int, str]]:
    """Preserve nanosecond timestamps for sorted CSV / dataframe export."""
    _raise_if_loki_error(body)
    result = (body.get("data") or {}).get("result") or []
    rows: list[tuple[int, str]] = []
    for stream in result:
        for value in stream.get("values") or []:
            if len(value) >= 2:
                rows.append((int(value[0]), str(value[1])))
    return rows


def fetch_logs(
    query: str = '{job="docker"}',
    limit: int = 50,
    loki_url: Optional[str] = None,
    timeout: float = 30.0,
) -> list[str]:
    """Instant query: recent lines matching LogQL (no explicit start/end)."""
    url = loki_query_endpoint(loki_url)
    params: dict[str, str | int] = {"query": query, "limit": limit}
    r = requests.get(url, params=params, timeout=timeout)
    r.raise_for_status()
    return _streams_to_lines(r.json())


def fetch_logs_range(
    query: str,
    start_ns: int,
    end_ns: int,
    limit: int = 500,
    loki_url: Optional[str] = None,
    timeout: float = 30.0,
) -> list[str]:
    """Time-bounded query; ``start_ns``/``end_ns`` are Unix epoch in nanoseconds."""
    url = loki_query_range_endpoint(loki_url)
    params: dict[str, str | int] = {
        "query": query,
        "limit": limit,
        "start": str(start_ns),
        "end": str(end_ns),
    }
    r = requests.get(url, params=params, timeout=timeout)
    r.raise_for_status()
    return _streams_to_lines(r.json())


def fetch_logs_recent(
    query: str = '{job="docker"}',
    limit: int = 200,
    minutes: float = 15.0,
    loki_url: Optional[str] = None,
    timeout: float = 30.0,
) -> list[str]:
    """Convenience: last ``minutes`` of logs ending at ``now`` (used by anomaly path)."""
    end = time.time_ns()
    start = end - int(minutes * 60 * 1e9)
    return fetch_logs_range(
        query, start, end, limit=limit, loki_url=loki_url, timeout=timeout
    )


def fetch_logs_frame(
    query: str = '{job="docker"}',
    limit: int = 50,
    loki_url: Optional[str] = None,
    timeout: float = 30.0,
) -> pd.DataFrame:
    """Tabular form for ``--output`` CSV in the CLI ``main``."""
    url = loki_query_endpoint(loki_url)
    params = {"query": query, "limit": limit}
    r = requests.get(url, params=params, timeout=timeout)
    r.raise_for_status()
    rows = _streams_to_rows(r.json())
    if not rows:
        return pd.DataFrame(columns=["ts_ns", "line"])
    return pd.DataFrame(rows, columns=["ts_ns", "line"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch log lines from Loki instant query API.")
    parser.add_argument(
        "--loki-url",
        default=None,
        help="Loki base (e.g. http://localhost:3100) or full .../loki/api/v1/query URL.",
    )
    parser.add_argument("--query", default='{job="docker"}', help="LogQL stream selector / filter.")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument(
        "-o",
        "--output",
        default=None,
        help="Optional CSV path with columns ts_ns,line.",
    )
    args = parser.parse_args()

    if args.output:
        df = fetch_logs_frame(
            query=args.query, limit=args.limit, loki_url=args.loki_url
        )
        df.to_csv(args.output, index=False)
    else:
        for line in fetch_logs(query=args.query, limit=args.limit, loki_url=args.loki_url):
            print(line)


if __name__ == "__main__":
    main()
