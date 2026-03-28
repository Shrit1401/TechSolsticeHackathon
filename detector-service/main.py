"""
Anomaly detector: gateway/Prometheus error rate + optional realtime ML on latency.

Realtime loop (ENABLE_ML_ANOMALY): pulls Prometheus, LSTM predict, autoencoder
if LSTM errors. GET /detect returns the latest ML snapshot merged with error rate.
"""

import asyncio
import logging
import math
import os
import re
import statistics
import subprocess
import time
from collections import deque
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException

from ml.detector_signals import fuse_signals, trace_anomaly_report
from ml.log_pipeline import log_fusion_report, loki_logs_anomaly
from ml_detect import ml_anomaly_enabled, run_realtime_ml_cycle

THRESHOLD = 0.2

ERROR_RATE_QUERY = (
    "(sum(rate(error_count_total{instance=\"api-gateway:8000\"}[15s])) or vector(0))"
    " / "
    "(sum(rate(request_count_total{instance=\"api-gateway:8000\"}[15s])) or vector(1))"
)

_COUNTER_LINE = re.compile(r"^(error_count_total|request_count_total)\s+([0-9.eE+-]+)\s*$")

REALTIME_SNAPSHOT = {
    "metric_anomaly": False,
    "score": 0.0,
    "source": "NONE",
    "updated": 0.0,
}

TRACE_SNAPSHOT = {
    "trace_anomaly": False,
    "slow_service": None,
    "trace_score": 0.0,
    "trace_fetch_ok": True,
    "updated": 0.0,
}

LOG_SNAPSHOT = {
    "log_anomaly": False,
    "log_score": 0.0,
    "log_fetch_ok": True,
    "updated": 0.0,
}

app = FastAPI()

logging.basicConfig(level=logging.INFO)

_last_remediate_monotonic: Optional[float] = None

_CONFIDENCE_HISTORY: deque[float] = deque(maxlen=3)


# Full URL to the API gateway /metrics scrape endpoint (env or default).
def gateway_metrics_url() -> str:
    raw = os.environ.get("GATEWAY_METRICS_URL", "http://127.0.0.1:8000").rstrip("/")
    if raw.endswith("/metrics"):
        return raw
    return raw + "/metrics"


# Base URL for Prometheus (no trailing slash).
def prometheus_base() -> str:
    return os.environ.get("PROMETHEUS_URL", "http://localhost:9090").rstrip("/")


# Seconds between two gateway /metrics samples when deriving instant error rate.
def sample_interval_s() -> float:
    return float(os.environ.get("DETECTOR_SAMPLE_INTERVAL_S", "0.03"))


# Minimum seconds between docker restart remediations.
def remediate_cooldown_s() -> float:
    return float(os.environ.get("REMEDIATE_COOLDOWN_S", "90"))


# Docker container name passed to `docker restart` when remediating.
def remediate_container() -> str:
    return os.environ.get("REMEDIATE_CONTAINER", "payment-service")


# Whether automatic container restart on anomaly is allowed.
def remediate_enabled() -> bool:
    v = os.environ.get("REMEDIATE_ENABLED", "1").strip().lower()
    return v not in ("0", "false", "no")


# Sleep between background realtime ML cycles updating REALTIME_SNAPSHOT.
def realtime_ml_interval_s() -> float:
    return float(os.environ.get("REALTIME_ML_INTERVAL_S", "30"))


# Feature flag: Loki log fusion in /detect and log analysis worker.
def log_anomaly_detection_enabled() -> bool:
    v = os.environ.get("ENABLE_LOG_ANOMALY", "1").strip().lower()
    return v not in ("0", "false", "no")


# Feature flag: trace-based anomaly signals in /detect and trace worker.
def trace_anomaly_detection_enabled() -> bool:
    v = os.environ.get("ENABLE_TRACE_ANOMALY", "1").strip().lower()
    return v not in ("0", "false", "no")


# Sleep between background trace analysis cycles updating TRACE_SNAPSHOT.
def trace_analysis_interval_s() -> float:
    return float(os.environ.get("TRACE_ANALYSIS_INTERVAL_S", "30"))


# Sleep between background log fusion cycles updating LOG_SNAPSHOT.
def log_analysis_interval_s() -> float:
    return float(os.environ.get("LOG_ANALYSIS_INTERVAL_S", "30"))


def fusion_weights_and_log_tau() -> tuple[float, float, float, float]:
    w_m = float(os.environ.get("FUSION_W_METRIC", "0.4"))
    w_l = float(os.environ.get("FUSION_W_LOG", "0.35"))
    w_t = float(os.environ.get("FUSION_W_TRACE", "0.25"))
    tau = float(os.environ.get("LOG_DISTANCE_TAU", "3.0"))
    return w_m, w_l, w_t, tau


def remediate_min_smooth_samples() -> int:
    return int(os.environ.get("REMEDIATE_MIN_CONSECUTIVE_CHECKS", "3"))


# Restart remediate_container via docker if enabled and outside cooldown.
def try_remediate() -> bool:
    global _last_remediate_monotonic
    if not remediate_enabled():
        return False
    now = time.monotonic()
    if _last_remediate_monotonic is not None:
        elapsed = now - _last_remediate_monotonic
        if elapsed < remediate_cooldown_s():
            logging.info(
                "remediate skipped: cooldown %.0fs remaining",
                remediate_cooldown_s() - elapsed,
            )
            return False
    name = remediate_container()
    try:
        proc = subprocess.run(
            ["docker", "restart", name],
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        logging.error("remediate failed: docker restart %s: %s", name, e)
        return False
    if proc.returncode == 0:
        _last_remediate_monotonic = now
        logging.warning("remediated: restarted container %s", name)
        return True
    logging.error(
        "remediate failed: docker restart %s exit=%s stderr=%s",
        name,
        proc.returncode,
        (proc.stderr or proc.stdout or "").strip(),
    )
    return False


# Coerce NaN/Inf floats to JSON-friendly values for error rates.
def json_safe_rate(x: float) -> float:
    if math.isnan(x):
        return 0.0
    if math.isinf(x):
        return 1.0 if x > 0 else 0.0
    return x


# Parse error_count_total and request_count_total from Prometheus text exposition.
def parse_counters(text: str) -> tuple[float, float]:
    err = 0.0
    req = 0.0
    for line in text.splitlines():
        m = _COUNTER_LINE.match(line.strip())
        if not m:
            continue
        name, val = m.group(1), float(m.group(2))
        if name == "error_count_total":
            err = val
        else:
            req = val
    return err, req


# Error rate from delta of gateway counters over sample_interval_s; None if invalid.
async def instant_error_rate(client: httpx.AsyncClient, base_metrics: str) -> float | None:
    r1 = await client.get(base_metrics)
    if r1.status_code != 200:
        return None
    e1, q1 = parse_counters(r1.text)
    await asyncio.sleep(sample_interval_s())
    r2 = await client.get(base_metrics)
    if r2.status_code != 200:
        return None
    e2, q2 = parse_counters(r2.text)
    dq = q2 - q1
    de = e2 - e1
    if dq <= 0:
        return None
    return max(0.0, min(1.0, de / dq))


# Error rate from Prometheus instant query (ERROR_RATE_QUERY).
async def prometheus_error_rate(client: httpx.AsyncClient) -> float:
    base = prometheus_base()
    url = f"{base}/api/v1/query?{urlencode({'query': ERROR_RATE_QUERY})}"
    r = await client.get(url)
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=r.text)
    try:
        payload = r.json()
    except ValueError as e:
        raise HTTPException(status_code=502, detail="invalid json from prometheus") from e
    if payload.get("status") != "success":
        raise HTTPException(status_code=502, detail=payload.get("error", "query failed"))
    data = payload.get("data") or {}
    if data.get("resultType") != "vector":
        raise HTTPException(status_code=502, detail="unexpected result type")
    results = data.get("result") or []
    if not results:
        return 0.0
    try:
        raw = float(results[0]["value"][1])
    except (KeyError, IndexError, TypeError, ValueError) as e:
        raise HTTPException(status_code=502, detail="malformed prometheus result") from e
    return json_safe_rate(raw)


# Background loop: run_realtime_ml_cycle and refresh REALTIME_SNAPSHOT.
async def realtime_ml_worker() -> None:
    interval = realtime_ml_interval_s()
    while True:
        try:
            if ml_anomaly_enabled():
                snap = await asyncio.to_thread(
                    run_realtime_ml_cycle, prometheus_base()
                )
                REALTIME_SNAPSHOT["metric_anomaly"] = snap["metric_anomaly"]
                REALTIME_SNAPSHOT["score"] = snap["score"]
                REALTIME_SNAPSHOT["source"] = snap["source"]
                REALTIME_SNAPSHOT["updated"] = time.time()
        except Exception:
            logging.exception("realtime ml worker iteration")
        await asyncio.sleep(interval)


# Background loop: trace_anomaly_report and refresh TRACE_SNAPSHOT.
async def trace_analysis_worker() -> None:
    interval = trace_analysis_interval_s()
    while True:
        try:
            if trace_anomaly_detection_enabled():
                snap = await asyncio.to_thread(trace_anomaly_report)
                TRACE_SNAPSHOT["trace_anomaly"] = bool(snap.get("trace_anomaly"))
                TRACE_SNAPSHOT["slow_service"] = snap.get("slow_service")
                TRACE_SNAPSHOT["trace_score"] = float(snap.get("trace_score") or 0.0)
                TRACE_SNAPSHOT["trace_fetch_ok"] = bool(snap.get("trace_fetch_ok"))
                TRACE_SNAPSHOT["updated"] = float(snap.get("updated") or time.time())
        except Exception:
            logging.exception("trace analysis worker iteration")
        await asyncio.sleep(interval)


# Background loop: log_fusion_report and refresh LOG_SNAPSHOT.
async def log_analysis_worker() -> None:
    interval = log_analysis_interval_s()
    while True:
        try:
            if log_anomaly_detection_enabled():
                snap = await asyncio.to_thread(log_fusion_report)
                LOG_SNAPSHOT["log_anomaly"] = bool(snap.get("log_anomaly"))
                LOG_SNAPSHOT["log_score"] = float(snap.get("log_score") or 0.0)
                LOG_SNAPSHOT["log_fetch_ok"] = bool(snap.get("log_fetch_ok"))
                LOG_SNAPSHOT["updated"] = float(snap.get("updated") or time.time())
        except Exception:
            logging.exception("log analysis worker iteration")
        await asyncio.sleep(interval)


# On startup: optional initial ML cycle, then spawn realtime_ml_worker.
@app.on_event("startup")
async def startup_realtime_ml() -> None:
    if not ml_anomaly_enabled():
        return
    try:
        snap = await asyncio.to_thread(run_realtime_ml_cycle, prometheus_base())
        REALTIME_SNAPSHOT["metric_anomaly"] = snap["metric_anomaly"]
        REALTIME_SNAPSHOT["score"] = snap["score"]
        REALTIME_SNAPSHOT["source"] = snap["source"]
        REALTIME_SNAPSHOT["updated"] = time.time()
    except Exception:
        logging.exception("initial realtime ml cycle")
    asyncio.create_task(realtime_ml_worker())


# On startup: optional initial trace snapshot, then spawn trace_analysis_worker.
@app.on_event("startup")
async def startup_trace_analysis() -> None:
    if not trace_anomaly_detection_enabled():
        return
    try:
        snap = await asyncio.to_thread(trace_anomaly_report)
        TRACE_SNAPSHOT["trace_anomaly"] = bool(snap.get("trace_anomaly"))
        TRACE_SNAPSHOT["slow_service"] = snap.get("slow_service")
        TRACE_SNAPSHOT["trace_score"] = float(snap.get("trace_score") or 0.0)
        TRACE_SNAPSHOT["trace_fetch_ok"] = bool(snap.get("trace_fetch_ok"))
        TRACE_SNAPSHOT["updated"] = float(snap.get("updated") or time.time())
    except Exception:
        logging.exception("initial trace analysis cycle")
    asyncio.create_task(trace_analysis_worker())


# On startup: optional initial log fusion snapshot, then spawn log_analysis_worker.
@app.on_event("startup")
async def startup_log_analysis() -> None:
    if not log_anomaly_detection_enabled():
        return
    try:
        snap = await asyncio.to_thread(log_fusion_report)
        LOG_SNAPSHOT["log_anomaly"] = bool(snap.get("log_anomaly"))
        LOG_SNAPSHOT["log_score"] = float(snap.get("log_score") or 0.0)
        LOG_SNAPSHOT["log_fetch_ok"] = bool(snap.get("log_fetch_ok"))
        LOG_SNAPSHOT["updated"] = float(snap.get("updated") or time.time())
    except Exception:
        logging.exception("initial log fusion cycle")
    asyncio.create_task(log_analysis_worker())


# Main detection: error rate, ML/trace/log snapshots, fusion, optional remediate.
@app.get("/detect")
async def detect():
    # Main detection endpoint for combined anomaly signals

    # Get the API gateway metrics scrape endpoint
    metrics_url = gateway_metrics_url()

    try:
        # Try to get error rate from the gateway /metrics endpoint
        async with httpx.AsyncClient(timeout=5.0) as client:
            error_rate = await instant_error_rate(client, metrics_url)
            metrics_source = "gateway"
            # If unavailable, fallback to Prometheus query directly
            if error_rate is None:
                error_rate = await prometheus_error_rate(client)
                metrics_source = "prometheus"
    except httpx.RequestError as e:
        # If error on HTTP, return 503 error to client
        raise HTTPException(status_code=503, detail=str(e)) from e

    # Ensure error rate always valid float (never None or nan)
    error_rate = json_safe_rate(error_rate)
    # Determine if error rate is anomalous (above threshold)
    error_anomaly = error_rate > THRESHOLD

    # Get ML-based anomaly if enabled and its auxiliary state
    ml_flag = REALTIME_SNAPSHOT["metric_anomaly"] if ml_anomaly_enabled() else False
    ml_score = float(REALTIME_SNAPSHOT["score"])
    ml_src = str(REALTIME_SNAPSHOT["source"])

    trace_flag = (
        TRACE_SNAPSHOT["trace_anomaly"] if trace_anomaly_detection_enabled() else False
    )
    trace_score_snap = (
        float(TRACE_SNAPSHOT["trace_score"])
        if trace_anomaly_detection_enabled()
        else 0.0
    )

    # Get log-based anomaly if enabled
    log_flag = LOG_SNAPSHOT["log_anomaly"] if log_anomaly_detection_enabled() else False
    log_score_snap = float(LOG_SNAPSHOT["log_score"])

    metric_anomaly = error_anomaly or ml_flag

    if error_anomaly and THRESHOLD > 0:
        err_norm = min(1.0, error_rate / THRESHOLD)
    elif error_anomaly:
        err_norm = 1.0
    else:
        err_norm = 0.0
    if ml_anomaly_enabled():
        ml_part = min(1.0, ml_score) if ml_flag else 0.0
        metric_score = max(err_norm, ml_part)
    else:
        metric_score = err_norm

    w_m, w_l, w_t, log_tau = fusion_weights_and_log_tau()
    fused = fuse_signals(
        metric_score=metric_score,
        metric_anomaly=metric_anomaly,
        log_enabled=log_anomaly_detection_enabled(),
        log_anomaly=bool(LOG_SNAPSHOT["log_anomaly"]),
        log_distance=log_score_snap,
        trace_enabled=trace_anomaly_detection_enabled(),
        trace_anomaly=trace_flag,
        trace_score=trace_score_snap,
        trace_slow_service=TRACE_SNAPSHOT["slow_service"],
        weight_metric=w_m,
        weight_log=w_l,
        weight_trace=w_t,
        log_distance_tau=log_tau,
    )

    fused_anomaly = bool(fused["anomaly"])
    fused_confidence = float(fused["confidence"])
    root_cause = fused["root_cause"]
    m_f = float(fused["metric_score"])
    l_f = float(fused["log_score"])
    t_f = float(fused["trace_score"])

    _CONFIDENCE_HISTORY.append(fused_confidence)
    smoothed_confidence = float(statistics.mean(_CONFIDENCE_HISTORY))

    if ml_flag:
        display_source = ml_src
        display_score = m_f
    elif error_anomaly:
        display_source = "ERROR_RATE"
        display_score = m_f
    elif log_flag:
        display_source = "LOGS"
        display_score = l_f
    elif trace_flag:
        display_source = "TRACE"
        display_score = t_f
    else:
        display_source = "NONE"
        display_score = m_f

    remediated = False
    need_smooth = remediate_min_smooth_samples()
    if fused_anomaly:
        logging.warning(
            "anomaly: fused=%s confidence=%.4f smoothed=%.4f root_cause=%s source=%s "
            "error_rate=%.4f metric=%s log=%s trace=%s trace_svc=%s strong=%s",
            fused_anomaly,
            fused_confidence,
            smoothed_confidence,
            root_cause,
            display_source,
            error_rate,
            metric_anomaly,
            log_flag,
            trace_flag,
            TRACE_SNAPSHOT["slow_service"],
            fused.get("strong_signals"),
        )
        if len(_CONFIDENCE_HISTORY) >= need_smooth:
            remediated = try_remediate()

    # Return as JSON the full break-down of detection signals and status
    return {
        "anomaly": fused_anomaly,
        "confidence": smoothed_confidence,
        "confidence_instant": fused_confidence,
        "root_cause": root_cause,
        "metric_anomaly": metric_anomaly,
        "metric_score": m_f,
        "score": display_score,
        "source": display_source,
        "error_rate": error_rate,
        "error_rate_anomaly": error_anomaly,
        "ml_anomaly": ml_flag,
        "ml_score": ml_score,
        "ml_source": ml_src,
        "ml_updated": REALTIME_SNAPSHOT["updated"],
        "threshold": THRESHOLD,
        "metrics_source": metrics_source,
        "remediated": remediated,
        "log_anomaly": log_flag,
        "log_score": log_score_snap,
        "log_score_fused": l_f,
        "log_fetch_ok": LOG_SNAPSHOT["log_fetch_ok"],
        "log_updated": LOG_SNAPSHOT["updated"],
        "trace_anomaly": trace_flag,
        "trace_score": trace_score_snap,
        "trace_score_fused": t_f,
        "trace_root_service": TRACE_SNAPSHOT["slow_service"],
        "trace_fetch_ok": TRACE_SNAPSHOT["trace_fetch_ok"],
        "trace_updated": TRACE_SNAPSHOT["updated"],
        "strong_signals": fused.get("strong_signals"),
        "multi_signal_pass": fused.get("multi_signal_pass"),
    }

# On-demand trace anomaly report (same logic as background trace worker).
@app.get("/detect/traces")
async def detect_traces():
    if not trace_anomaly_detection_enabled():
        raise HTTPException(
            status_code=503,
            detail="trace anomaly detection disabled",
        )

    try:
        return await asyncio.to_thread(trace_anomaly_report)
    except Exception as e:
        logging.exception("detect traces")
        raise HTTPException(status_code=502, detail=str(e)) from e


# On-demand Loki log anomaly with query/limit/minutes/z parameters.
@app.get("/detect/logs")
async def detect_logs(
    query: str = '{job="docker"}',
    limit: int = 200,
    minutes: float = 15.0,
    z: float = 2.0,
):
    if not log_anomaly_detection_enabled():
        raise HTTPException(
            status_code=503,
            detail="log anomaly detection disabled",
        )

    # Thread target: run loki_logs_anomaly with endpoint query params.
    def run() -> dict[str, bool | float]:
        return loki_logs_anomaly(
            logql=query,
            limit=limit,
            minutes=minutes,
            z=z,
        )

    try:
        return await asyncio.to_thread(run)
    except Exception as e:
        logging.exception("detect logs")
        raise HTTPException(status_code=502, detail=str(e)) from e
