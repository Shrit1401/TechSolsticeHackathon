"""
Detector-facing observability: Jaeger trace fetch/parse and multi-signal fusion.

``detector-service`` calls:
  - ``jaeger_analysis_snapshot`` / ``trace_anomaly_report`` — periodic worker pulls
    recent traces for a service, derives a slow-service or error-tag root cause.
  - ``fuse_signals`` — merges normalized metric, log, and trace evidence into one
    ``anomaly`` flag, a ``confidence`` in [0, 1], and optional ``root_cause``.

Log lines are not fetched here; the service passes in booleans/scores produced
by ``ml.log_pipeline`` (Loki + embeddings) into ``fuse_signals``.
"""

from __future__ import annotations

import math
import os
import time
from collections import defaultdict
from typing import Any, Optional

import numpy as np
import requests

DEFAULT_JAEGER_TRACES_URL = "http://localhost:16686/api/traces"

# This is WHERE we make the traces query:
def fetch_traces(
    service: str = "api-gateway",
    limit: int = 20,
    jaeger_url: Optional[str] = None,
    timeout: float = 30.0,
) -> list[Any]:
    """GET /api/traces from Jaeger query service; returns [] if data missing."""
    url = (jaeger_url or os.environ.get("JAEGER_TRACES_URL", DEFAULT_JAEGER_TRACES_URL)).rstrip(
        "/"
    )
    params = {"service": service, "limit": limit}
    res = requests.get(url, params=params, timeout=timeout)
    res.raise_for_status()
    body = res.json()
    data = body.get("data")
    return data if isinstance(data, list) else []

# This is WHERE we map the service names:
def map_service_names(trace: dict[str, Any]) -> list[dict[str, Any]]:
    """Resolve each span's ``processID`` to a human-readable ``serviceName``."""
    # Jaeger JSON nests process metadata outside the span list; join here for analytics.
    process_map = trace["processes"]
    spans: list[dict[str, Any]] = []
    for span in trace["spans"]:
        service = process_map[span["processID"]]["serviceName"]
        spans.append(
            {
                "service": service,
                "operation": span["operationName"],
                "duration": span["duration"] / 1000,
                "tags": span.get("tags", []),
            }
        )
    return spans

# this function is used to flatten the traces into a list of spans
def extract_spans(traces: list[Any]) -> list[dict[str, Any]]:
    """Flatten multiple Jaeger trace objects into one list of span dicts."""
    out: list[dict[str, Any]] = []
    for trace in traces:
        out.extend(map_service_names(trace))
    return out

# this function is used to get the service latency
def get_service_latency(spans: list[dict[str, Any]]) -> dict[str, float]:
    """Per-service mean span duration in ms."""
    service_latency: defaultdict[str, list[float]] = defaultdict(list)
    for span in spans:
        service_latency[span["service"]].append(span["duration"])
    return {s: sum(v) / len(v) for s, v in service_latency.items()}

# this function is used to detect the errors in the spans, we get error by tag "error" and value "true"
def detect_errors(spans: list[dict[str, Any]]) -> list[str]:
    """Services that emitted a span with error=true (bool or string)."""
    error_services: list[str] = []
    for span in spans:
        for tag in span.get("tags") or []:
            v = tag.get("value")
            if tag.get("key") == "error" and (v is True or v == "true"):
                error_services.append(span["service"])
    return list(set(error_services))

# this function is used to get the training errors
def _trace_training_errors() -> np.ndarray:
    raw = os.environ.get("TRACE_TRAINING_ERRORS", "5,6,7,8,9,10,12")
    try:
        arr = np.array([float(x.strip()) for x in raw.split(",") if x.strip()], dtype=float)
        if arr.size:
            return arr
    except ValueError:
        pass
    return np.array([5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0], dtype=float)

# This function analyzes a list of Jaeger traces to detect anomalies.
def analyze_traces(traces: list[Any]) -> tuple[bool, Optional[str], float]:
    # 1. Flatten traces to a list of span dictionaries
    all_spans: list[dict[str, Any]] = []
    for trace in traces:
        all_spans.extend(map_service_names(trace))

    # 2. If empty, no anomaly
    if not all_spans:
        return False, None, 0.0

    # 3. If any service has an error span, it's considered an anomaly (score=1.0)
    err_svc = detect_errors(all_spans)
    if err_svc:
        return True, sorted(err_svc)[0], 1.0

    # 4. Compute average latency for each service
    avg_latency = get_service_latency(all_spans)
    # 5. Get the normal ("baseline") latency and statistical anomaly threshold
    baseline = float(os.environ.get("TRACE_BASELINE_MS", "120"))
    te = _trace_training_errors()
    threshold_t = float(np.percentile(te, 95))
    if threshold_t <= 0:
        threshold_t = 1.0

    # 6. Find the service with the largest anomaly score versus the baseline
    best_score = 0.0
    best_svc: Optional[str] = None
    for svc, actual in avg_latency.items():
        error_t = abs(float(actual) - baseline)
        sc = min(1.0, error_t / threshold_t)
        if sc > best_score:
            best_score = sc
            best_svc = svc

    # 7. Compare to strong anomaly threshold
    strong = float(os.environ.get("TRACE_STRONG_THRESHOLD", "0.6"))
    trace_anomaly = best_score > strong
    root = best_svc if trace_anomaly else None
    return trace_anomaly, root, float(best_score)

# this function is used to return the trace analysis output
def trace_analysis_output(
    anomaly: bool, service: Optional[str], trace_score: float
) -> dict[str, Any]:
    return {
        "trace_anomaly": anomaly,
        "slow_service": service,
        "trace_score": trace_score,
    }

# this function is used to get the jaeger analysis snapshot, we get the service name and the limit and the jaeger url
def jaeger_analysis_snapshot(
    service: Optional[str] = None,
    limit: Optional[int] = None,
    jaeger_url: Optional[str] = None,
) -> dict[str, Any]:
    """Snapshot for background workers: trace anomaly flag, root service, fetch ok, timestamp."""
    svc = service or os.environ.get("JAEGER_SERVICE", "api-gateway")
    lim = (
        int(os.environ.get("JAEGER_TRACE_LIMIT", "20"))
        if limit is None
        else limit
    )
    resolved_url = jaeger_url or os.environ.get("JAEGER_TRACES_URL")
    try:
        traces = fetch_traces(service=svc, limit=lim, jaeger_url=resolved_url)
        anomaly, root, tsc = analyze_traces(traces)
        out = trace_analysis_output(anomaly, root, tsc)
        out["trace_fetch_ok"] = True
        out["updated"] = time.time()
        return out
    except (requests.RequestException, OSError, ValueError, KeyError, TypeError):
        now = time.time()
        return {
            "trace_anomaly": False,
            "slow_service": None,
            "trace_score": 0.0,
            "trace_fetch_ok": False,
            "updated": now,
        }

# this line is used to get the trace anomaly report
trace_anomaly_report = jaeger_analysis_snapshot


# this function is used to get the log distance to score, this is used to get the log score
def log_distance_to_score(distance: float, tau: float) -> float:
    if tau <= 0:
        return 0.0
    p = math.exp(-float(distance) / tau)
    return 1.0 - p

# Fuses metric, log, and trace signals to calculate an overall anomaly confidence score.
# Combines scores and flags from metrics, logs, and traces using configurable weights, thresholds, 
#and distance metrics to determine a final confidence value and whether strong anomalies are present.
def fuse_signals(
    *,
    metric_score: float,
    metric_anomaly: bool,
    log_enabled: bool,
    log_anomaly: bool,
    log_distance: float,
    trace_enabled: bool,
    trace_anomaly: bool,
    trace_score: float,
    trace_slow_service: Optional[str],
    weight_metric: float = 0.4,
    weight_log: float = 0.35,
    weight_trace: float = 0.25,
    log_distance_tau: float = 3.0,
    strong_signal_threshold: float = 0.6,
) -> dict[str, Any]:
    # 1. Normalize metric score to [0,1]
    m = min(1.0, max(0.0, float(metric_score)))
    # 2. If log enabled, calculate log score based on distance and tau
    if log_enabled and log_anomaly and log_distance_tau > 0:
        l = min(1.0, log_distance_to_score(float(log_distance), float(log_distance_tau)))
    else:
        l = 0.0
    # 3. If trace enabled, normalize trace score to [0,1]
    if trace_enabled:
        t = min(1.0, max(0.0, float(trace_score)))
    else:
        t = 0.0

    # 4. Calculate weights for each signal type
    w_m = float(weight_metric) # weight for the metric
    w_l = float(weight_log) if log_enabled else 0.0 # weight for the log
    w_t = float(weight_trace) if trace_enabled else 0.0 # weight for the trace
    sum_w = w_m + w_l + w_t # sum of the weights
    # 5. If no active weights, set confidence to 0
    if sum_w <= 0:
        confidence = 0.0
    else:
        # 6. Calculate weighted average confidence
        confidence = (w_m * m + w_l * l + w_t * t) / sum_w
    # 7. Calculate strong signal count
    st = float(strong_signal_threshold)
    parts: list[float] = [m]
    # 8. If log enabled, add log score to parts
    if log_enabled:
        parts.append(l)
    # 9. If trace enabled, add trace score to parts
    if trace_enabled:
        parts.append(t)
    # 10. Calculate strong signal count
    strong_count = sum(1 for v in parts if v > st)
    # 11. If there are at least 2 parts, set multi_pass to true if strong count is >= 2
    if len(parts) >= 2:
        multi_pass = strong_count >= 2
    else:
        multi_pass = strong_count >= 1

    # 12. If log enabled and log anomaly, set log_effective to true
    log_effective = log_enabled and log_anomaly
    # 13. If trace enabled and trace anomaly, set trace_effective to true
    trace_effective = trace_enabled and trace_anomaly
    # 14. Get root slow service from trace slow service or empty string, strip whitespace, or None
    root_slow = (trace_slow_service or "").strip() or None
    # 15. If multi_pass and root slow service and trace effective and trace score is greater than strong threshold, set root cause to root slow service
    root_cause: Optional[str] = None
    if multi_pass and root_slow and trace_effective and t > st:
        root_cause = root_slow

    # 16. Return the fused signals
    return {
        "anomaly": multi_pass,
        "confidence": float(confidence),
        "root_cause": root_cause,
        "metric_anomaly": metric_anomaly,
        "log_anomaly": log_effective,
        "trace_anomaly": trace_effective,
        "metric_score": m,
        "log_score": l,
        "trace_score": t,
        "strong_signals": strong_count,
        "multi_signal_pass": multi_pass,
    }
