"""
Payment microservice with Prometheus metrics.

Optional failure modes simulate latency, errors, or CPU load for demos;
Prometheus scrapes this service directly. The gateway also scrapes its own copy.
"""

import logging
import random
import time

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest

app = FastAPI()

REQUEST_COUNT = Counter("request_count", "Total requests")
REQUEST_LATENCY = Histogram("request_latency_seconds", "Request latency")

logging.basicConfig(level=logging.INFO)

FAILURE_MODE = "off"
FAILURE_MODES = frozenset({"off", "latency", "error", "cpu", "mixed"})


def _apply_failure_mode() -> None:
    if FAILURE_MODE == "off":
        return
    if FAILURE_MODE == "latency":
        if random.random() < 0.3:
            time.sleep(3)
        return
    if FAILURE_MODE == "error":
        if random.random() < 0.3:
            logging.error("Payment failed due to forced error mode")
            raise HTTPException(status_code=500, detail="Random failure")
        return
    if FAILURE_MODE == "cpu":
        if random.random() < 0.1:
            for _ in range(10**7):
                pass
        return
    if FAILURE_MODE == "mixed":
        if random.random() < 0.3:
            time.sleep(3)
        if random.random() < 0.3:
            logging.error("Payment failed due to forced mixed mode")
            raise HTTPException(status_code=500, detail="Random failure")
        if random.random() < 0.1:
            for _ in range(10**7):
                pass


@app.post("/pay")
def make_payment():
    start = time.time()
    REQUEST_COUNT.inc()
    logging.info("Payment request received")
    _apply_failure_mode()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "success"}


@app.post("/toggle-failure")
def toggle_failure():
    global FAILURE_MODE
    FAILURE_MODE = "mixed" if FAILURE_MODE == "off" else "off"
    return {"failure_mode": FAILURE_MODE}


@app.post("/failure-mode/{mode}")
def set_failure_mode(mode: str):
    global FAILURE_MODE
    normalized = mode.lower()
    if normalized not in FAILURE_MODES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode. Use one of: {', '.join(sorted(FAILURE_MODES))}",
        )
    FAILURE_MODE = normalized
    return {"failure_mode": FAILURE_MODE}


@app.get("/failure-mode")
def get_failure_mode():
    return {"failure_mode": FAILURE_MODE}


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "payment-service healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
