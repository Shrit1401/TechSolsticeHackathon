import logging
import time

from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest

app = FastAPI()

REQUEST_COUNT = Counter("request_count", "Total requests")
REQUEST_LATENCY = Histogram("request_latency_seconds", "Request latency")

logging.basicConfig(level=logging.INFO)


@app.post("/login")
def login():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"token": "demo-token", "expires_in": 3600}


@app.get("/me")
def me():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"user_id": "u-demo", "role": "user"}


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "auth-service healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
