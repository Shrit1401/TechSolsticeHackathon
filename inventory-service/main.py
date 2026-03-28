import logging
import time

from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest

app = FastAPI()

REQUEST_COUNT = Counter("request_count", "Total requests")
REQUEST_LATENCY = Histogram("request_latency_seconds", "Request latency")

logging.basicConfig(level=logging.INFO)


@app.get("/inventory")
def get_inventory():
    start = time.time()
    REQUEST_COUNT.inc()
    time.sleep(0.05)
    REQUEST_LATENCY.observe(time.time() - start)
    return {"items": [{"sku": "W-100", "stock": 42}, {"sku": "W-200", "stock": 7}]}


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "inventory-service healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
