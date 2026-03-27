"""
Anomaly detector: estimates API error rate and can restart a container via Docker.

Flow:
- Prefer a short sample of the gateway /metrics endpoint (counter deltas).
- If that fails, fall back to a Prometheus instant query (15s error rate).

When error rate exceeds THRESHOLD, optionally runs docker restart (cooldown-gated).
"""

import asyncio
import logging
import math
import os
import re
import time
from urllib.parse import urlencode

import httpx
from fastapi import FastAPI, HTTPException

THRESHOLD = 0.2

ERROR_RATE_QUERY = (
    "(sum(rate(error_count_total{instance=\"api-gateway:8000\"}[15s])) or vector(0))"
    " / "
    "(sum(rate(request_count_total{instance=\"api-gateway:8000\"}[15s])) or vector(1))"
)

_COUNTER_LINE = re.compile(r"^(error_count_total|request_count_total)\s+([0-9.eE+-]+)\s*$")

app = FastAPI()

logging.basicConfig(level=logging.INFO)

_last_remediate_monotonic = 0.0


def gateway_metrics_url() -> str:
    raw = os.environ.get("GATEWAY_METRICS_URL", "http://127.0.0.1:8000").rstrip("/")
    if raw.endswith("/metrics"):
        return raw
    return raw + "/metrics"


def prometheus_base() -> str:
    return os.environ.get("PROMETHEUS_URL", "http://localhost:9090").rstrip("/")


def sample_interval_s() -> float:
    return float(os.environ.get("DETECTOR_SAMPLE_INTERVAL_S", "0.03"))


def remediate_cooldown_s() -> float:
    return float(os.environ.get("REMEDIATE_COOLDOWN_S", "90"))


def remediate_container() -> str:
    return os.environ.get("REMEDIATE_CONTAINER", "payment-service")


def try_remediate() -> bool:
    global _last_remediate_monotonic
    now = time.monotonic()
    if now - _last_remediate_monotonic < remediate_cooldown_s():
        return False
    code = os.system(f"docker restart {remediate_container()}")
    if code == 0:
        _last_remediate_monotonic = now
        return True
    return False


def json_safe_rate(x: float) -> float:
    if math.isnan(x):
        return 0.0
    if math.isinf(x):
        return 1.0 if x > 0 else 0.0
    return x


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


@app.get("/detect")
async def detect():
    metrics_url = gateway_metrics_url()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            error_rate = await instant_error_rate(client, metrics_url)
            source = "gateway"
            if error_rate is None:
                error_rate = await prometheus_error_rate(client)
                source = "prometheus"
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    error_rate = json_safe_rate(error_rate)
    anomaly = error_rate > THRESHOLD
    remediated = False
    if anomaly:
        logging.warning("anomaly: error_rate=%.4f threshold=%s", error_rate, THRESHOLD)
        remediated = try_remediate()
    return {
        "anomaly": anomaly,
        "error_rate": error_rate,
        "threshold": THRESHOLD,
        "source": source,
        "remediated": remediated,
    }
