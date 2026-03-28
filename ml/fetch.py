"""
Step 1 — Pull a single Prometheus series via the HTTP ``query_range`` API.

``PRESETS`` maps friendly names to PromQL for this repo's ``api-gateway`` labels.
The HTTP response may contain multiple series; we keep the **first** only — same
as ad-hoc notebooks. If nothing matches, return an empty DataFrame with columns
``[time, value]`` so training code can exit cleanly without exceptions.
"""

from __future__ import annotations

import argparse
import os
import time
from typing import Optional, Union

import pandas as pd
import requests

from ml.paths import DEFAULT_RAW_CSV, ensure_parent

# Curated PromQL aligned with ``prometheus/prometheus.yml`` scrape labels.
PRESETS = {
    "error_rate": 'rate(error_count_total{instance="api-gateway:8000"}[1m])',
    "latency": (
        "rate(request_latency_seconds_sum{instance=\"api-gateway:8000\"}[1m])"
        " / "
        "rate(request_latency_seconds_count{instance=\"api-gateway:8000\"}[1m])"
    ),
}


def fetch_metric(
    query: str,
    start: Union[int, float, str],
    end: Union[int, float, str],
    step: str = "5s",
    prom_url: Optional[str] = None,
) -> pd.DataFrame:
    """
    Query Prometheus ``/api/v1/query_range`` and return [time, value].

    ``start``/``end`` are passed through to Prometheus (unix seconds or RFC3339).
    """
    base = (prom_url or os.environ.get("PROM_URL", "http://localhost:9090")).rstrip(
        "/"
    )
    url = f"{base}/api/v1/query_range"
    params = {"query": query, "start": start, "end": end, "step": step} # query parameters
    r = requests.get(url, params=params, timeout=120) # get the response from the url
    r.raise_for_status()
    body = r.json() # get the body from the response

    if body.get("status") != "success":
        raise RuntimeError(str(body.get("error") or body)) # raise an error if the status is not success

    # Multiple series can exist; we take the first (same as a quick notebook probe).
    series = body.get("data", {}).get("result") or [] # get the series from the body
    if not series:
        return pd.DataFrame(columns=["time", "value"])

    values = series[0].get("values") or []
    if not values:
        return pd.DataFrame(columns=["time", "value"])

    df = pd.DataFrame(values, columns=["time", "value"])
    df["time"] = pd.to_datetime(df["time"], unit="s")
    df["value"] = df["value"].astype(float)
    return df


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export one Prometheus series to CSV (time, value)."
    )
    parser.add_argument(
        "--prom-url",
        default=os.environ.get("PROM_URL", "http://localhost:9090"),
        help="Prometheus base URL (no /api path).",
    )
    parser.add_argument("--query", default=None, help="Raw PromQL expression.")
    parser.add_argument(
        "--preset",
        choices=list(PRESETS.keys()),
        default=None,
        help="Use a built-in query for this stack instead of --query.",
    )
    parser.add_argument(
        "--start", type=float, default=None, help="Range start (unix seconds)."
    )
    parser.add_argument(
        "--end", type=float, default=None, help="Range end (default: now)."
    )
    parser.add_argument("--step", default="5s", help="query_range resolution.")
    parser.add_argument(
        "-o",
        "--output",
        default=str(DEFAULT_RAW_CSV),
        help=f"CSV path (default: {DEFAULT_RAW_CSV}).",
    )
    args = parser.parse_args()

    end = args.end if args.end is not None else time.time()
    start = args.start if args.start is not None else end - 3600.0

    if args.preset and args.query:
        raise SystemExit("Use either --preset or --query, not both.")
    if args.preset:
        query = PRESETS[args.preset]
    elif args.query:
        query = args.query
    else:
        raise SystemExit("Provide --query or --preset.")

    df = fetch_metric(query, start, end, step=args.step, prom_url=args.prom_url)
    ensure_parent(args.output)
    df.to_csv(args.output, index=False)


if __name__ == "__main__":
    main()
