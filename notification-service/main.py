import logging
import time

from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest

app = FastAPI()

REQUEST_COUNT = Counter("request_count", "Total requests")
REQUEST_LATENCY = Histogram("request_latency_seconds", "Request latency")

logging.basicConfig(level=logging.INFO)

_SENT = []


@app.post("/notify")
def notify():
    start = time.time()
    REQUEST_COUNT.inc()
    _SENT.append({"at": time.time(), "channel": "email"})
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "queued", "count": len(_SENT)}


@app.get("/notifications")
def list_notifications():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"notifications": _SENT[-20:]}


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "notification-service healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
