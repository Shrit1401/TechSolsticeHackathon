"""
User microservice: minimal read API with simulated latency and Prometheus metrics.
"""

import logging
import time

from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest

app = FastAPI()

REQUEST_COUNT = Counter("request_count", "Total requests")
REQUEST_LATENCY = Histogram("request_latency_seconds", "Request latency")

logging.basicConfig(level=logging.INFO)


@app.get("/users")
def get_users():
    start = time.time()
    REQUEST_COUNT.inc()
    time.sleep(0.2)
    REQUEST_LATENCY.observe(time.time() - start)
    return {"users": ["Alice", "Bob"]}


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "user-service healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
