"""
API gateway: single public HTTP entrypoint.

Proxies to backend microservices, records Prometheus metrics
(request count, 5xx errors, latency), and exposes /metrics for scraping.
"""

import atexit
import logging
import os
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
ORDER_SERVICE = "http://order-service:8004"
INVENTORY_SERVICE = "http://inventory-service:8005"
NOTIFICATION_SERVICE = "http://notification-service:8006"
AUTH_SERVICE = "http://auth-service:8007"

_UPSTREAM_TIMEOUT = httpx.Timeout(10.0)


def _setup_otel() -> bool:
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not endpoint:
        return False
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    service_name = os.environ.get("OTEL_SERVICE_NAME", "api-gateway")
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    insecure = not endpoint.lower().startswith("https://")
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=insecure)
    provider.add_span_processor(
        BatchSpanProcessor(
            exporter,
            max_queue_size=2048,
            schedule_delay_millis=1000,
            max_export_batch_size=512,
        )
    )
    trace.set_tracer_provider(provider)
    atexit.register(provider.shutdown)
    HTTPXClientInstrumentor().instrument()
    return True


_OTEL_ENABLED = _setup_otel()


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


@app.get("/orders")
async def orders():
    return await _proxy("GET", f"{ORDER_SERVICE}/orders")


@app.post("/orders")
async def create_order():
    return await _proxy("POST", f"{ORDER_SERVICE}/orders")


@app.get("/inventory")
async def inventory():
    return await _proxy("GET", f"{INVENTORY_SERVICE}/inventory")


@app.post("/notify")
async def notify():
    return await _proxy("POST", f"{NOTIFICATION_SERVICE}/notify")


@app.get("/notifications")
async def notifications():
    return await _proxy("GET", f"{NOTIFICATION_SERVICE}/notifications")


@app.post("/login")
async def login():
    return await _proxy("POST", f"{AUTH_SERVICE}/login")


@app.get("/me")
async def me():
    return await _proxy("GET", f"{AUTH_SERVICE}/me")


@app.get("/health")
def health():
    start = time.time()
    REQUEST_COUNT.inc()
    REQUEST_LATENCY.observe(time.time() - start)
    return {"status": "api-gateway healthy"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type="text/plain")


if _OTEL_ENABLED:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    FastAPIInstrumentor.instrument_app(
        app, excluded_urls="/health,/metrics"
    )
