"""
API gateway: single public HTTP entrypoint.

Proxies to user-service and payment-service, records Prometheus metrics
(request count, 5xx errors, latency), and exposes /metrics for scraping.
"""

import logging
import time

import httpx
from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import Counter, Histogram, generate_latest

app = FastAPI()

REQUEST_COUNT = Counter("request_count", "Total requests")
ERROR_COUNT = Counter("error_count", "Upstream 5xx responses")
REQUEST_LATENCY = Histogram("request_latency_seconds", "Request latency")

logging.basicConfig(level=logging.INFO)

USER_SERVICE = "http://user-service:8001"
PAYMENT_SERVICE = "http://payment-service:8002"

_UPSTREAM_TIMEOUT = httpx.Timeout(10.0)


async def _proxy(method: str, url: str) -> Response:
    start = time.time()
    REQUEST_COUNT.inc()
    async with httpx.AsyncClient(timeout=_UPSTREAM_TIMEOUT) as client:
        response = await client.request(method, url)
    if response.status_code >= 500:
        ERROR_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type", "application/json"),
    )


@app.get("/users")
async def users():
    return await _proxy("GET", f"{USER_SERVICE}/users")


@app.post("/pay")
async def pay():
    return await _proxy("POST", f"{PAYMENT_SERVICE}/pay")


@app.post("/toggle-failure")
async def toggle_failure():
    return await _proxy("POST", f"{PAYMENT_SERVICE}/toggle-failure")


@app.post("/failure-mode/{mode}")
async def set_failure_mode(mode: str):
    return await _proxy("POST", f"{PAYMENT_SERVICE}/failure-mode/{mode}")


@app.get("/failure-mode")
async def get_failure_mode():
    return await _proxy("GET", f"{PAYMENT_SERVICE}/failure-mode")


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "api-gateway healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")
