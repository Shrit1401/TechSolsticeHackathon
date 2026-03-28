import logging
import time
import uuid

from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest

app = FastAPI()

REQUEST_COUNT = Counter("request_count", "Total requests")
REQUEST_LATENCY = Histogram("request_latency_seconds", "Request latency")

logging.basicConfig(level=logging.INFO)

_ORDERS = [{"id": "ord-1", "item": "widget", "qty": 2}]


@app.get("/orders")
def list_orders():
    start = time.time()
    REQUEST_COUNT.inc()
    time.sleep(0.05)
    REQUEST_LATENCY.observe(time.time() - start)
    return {"orders": _ORDERS}


@app.post("/orders")
def create_order():
    start = time.time()
    REQUEST_COUNT.inc()
    oid = f"ord-{uuid.uuid4().hex[:8]}"
    _ORDERS.append({"id": oid, "item": "widget", "qty": 1})
    REQUEST_LATENCY.observe(time.time() - start)
    return {"id": oid, "status": "created"}


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "order-service healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
