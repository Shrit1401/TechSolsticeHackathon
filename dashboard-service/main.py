import asyncio
import os
import uuid
from typing import Any, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

def _env(name: str, default: str) -> str:
    v = os.environ.get(name)
    return v if v is not None and v != "" else default


def prometheus_url() -> str:
    return _env("PROMETHEUS_URL", "http://prometheus:9090").rstrip("/")


def loki_url() -> str:
    return _env("LOKI_URL", "http://loki:3100/loki").rstrip("/")


def grafana_url() -> str:
    return _env("GRAFANA_URL", "http://grafana:3000").rstrip("/")


def jaeger_url() -> str:
    return _env("JAEGER_URL", "http://jaeger:16686").rstrip("/")


def detector_url() -> str:
    return _env("DETECTOR_URL", "http://detector-service:8003").rstrip("/")


def gateway_url() -> str:
    return _env("GATEWAY_URL", "http://api-gateway:8000").rstrip("/")


def locust_host_default() -> str:
    return _env("LOCUST_HOST", "http://api-gateway:8000")


def simulation_enabled() -> bool:
    return _env("ENABLE_SIMULATION", "1").strip().lower() not in ("0", "false", "no")


def cors_origins() -> list[str]:
    raw = _env("CORS_ORIGINS", "*")
    if raw == "*":
        return ["*"]
    return [x.strip() for x in raw.split(",") if x.strip()]


CHART_PRESETS: list[dict[str, Any]] = [
    {
        "id": "gateway_request_rate",
        "title": "API gateway requests per second",
        "promql": 'sum(rate(request_count_total{instance="api-gateway:8000"}[1m]))',
    },
    {
        "id": "gateway_error_rate",
        "title": "API gateway error rate",
        "promql": (
            'sum(rate(error_count_total{instance="api-gateway:8000"}[1m])) '
            '/ clamp_min(sum(rate(request_count_total{instance="api-gateway:8000"}[1m])), 1e-9)'
        ),
    },
    {
        "id": "all_services_request_rate",
        "title": "Request rate by service instance",
        "promql": 'sum by (instance) (rate(request_count_total[1m]))',
    },
    {
        "id": "payment_latency_p95",
        "title": "Payment service latency p95 (seconds)",
        "promql": (
            'histogram_quantile(0.95, sum(rate(request_latency_seconds_bucket'
            '{instance="payment-service:8002"}[5m])) by (le))'
        ),
    },
]

app = FastAPI()

_origins = cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_runs: dict[str, dict[str, Any]] = {}
_run_lock = asyncio.Lock()


async def _check_url(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    headers: Optional[dict[str, str]] = None,
) -> bool:
    try:
        r = await client.request(method, url, timeout=5.0, headers=headers)
        return r.status_code < 500
    except httpx.RequestError:
        return False


@app.get("/health")
async def health():
    out: dict[str, Any] = {"status": "ok", "backends": {}}
    async with httpx.AsyncClient(timeout=5.0) as client:
        prom_ok = await _check_url(
            client, "GET", f"{prometheus_url()}/-/ready"
        ) or await _check_url(client, "GET", f"{prometheus_url()}/api/v1/query?query=up")
        out["backends"]["prometheus"] = "ok" if prom_ok else "down"

        loki_base = _env("LOKI_HTTP_URL", "http://loki:3100").rstrip("/")
        loki_ok = await _check_url(
            client, "GET", f"{loki_base}/ready"
        ) or await _check_url(client, "GET", f"{loki_url()}/api/v1/labels")
        out["backends"]["loki"] = "ok" if loki_ok else "down"

        det_ok = await _check_url(client, "GET", f"{detector_url()}/detect")
        out["backends"]["detector"] = "ok" if det_ok else "down"

        grafana_key = os.environ.get("GRAFANA_API_KEY", "").strip()
        if grafana_key:
            gr_ok = await _check_url(
                client, "GET",
                f"{grafana_url()}/api/health",
                headers={"Authorization": f"Bearer {grafana_key}"},
            )
            out["backends"]["grafana"] = "ok" if gr_ok else "down"
        else:
            out["backends"]["grafana"] = "skipped_no_token"

        ja_ok = await _check_url(client, "GET", f"{jaeger_url()}/api/services")
        out["backends"]["jaeger"] = "ok" if ja_ok else "down"

    bad = [k for k, v in out["backends"].items() if v == "down"]
    if bad:
        out["status"] = "degraded"
    return out


@app.get("/api/charts/presets")
def chart_presets():
    return {"presets": CHART_PRESETS}


@app.get("/api/prometheus/query")
async def prometheus_query(request: Request):
    url = f"{prometheus_url()}/api/v1/query"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.get("/api/prometheus/query_range")
async def prometheus_query_range(request: Request):
    url = f"{prometheus_url()}/api/v1/query_range"
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.get("/api/loki/query_range")
async def loki_query_range(request: Request):
    url = f"{loki_url()}/api/v1/query_range"
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.get("/api/loki/query")
async def loki_query(request: Request):
    url = f"{loki_url()}/api/v1/query"
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.api_route("/api/grafana/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def grafana_proxy(path: str, request: Request):
    key = os.environ.get("GRAFANA_API_KEY", "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Grafana API disabled: set GRAFANA_API_KEY",
        )
    url = f"{grafana_url()}/api/{path}"
    body = await request.body()
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": request.headers.get("accept", "application/json"),
    }
    ct = request.headers.get("content-type")
    if ct:
        headers["Content-Type"] = ct
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.request(
            request.method,
            url,
            params=request.query_params,
            content=body if body else None,
            headers=headers,
        )
    return Response(
        content=r.content,
        status_code=r.status_code,
        media_type=r.headers.get("content-type", "application/json"),
    )


@app.get("/api/jaeger/traces")
async def jaeger_traces(request: Request):
    url = f"{jaeger_url()}/api/traces"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.get("/api/jaeger/services")
async def jaeger_services():
    url = f"{jaeger_url()}/api/services"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.get("/api/detector/detect")
async def detector_detect(request: Request):
    url = f"{detector_url()}/detect"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.get("/api/detector/traces")
async def detector_traces(request: Request):
    url = f"{detector_url()}/detect/traces"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


@app.get("/api/detector/logs")
async def detector_logs(request: Request):
    url = f"{detector_url()}/detect/logs"
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(url, params=request.query_params)
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"))


async def _set_gateway_failure_mode(mode: str) -> None:
    gw = gateway_url()
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(f"{gw}/failure-mode/{mode}")
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"gateway failure-mode: {r.text}")


def _locust_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "locustfile.py")


class SimulateAttackBody(BaseModel):
    profile: str = Field(default="all")
    users: int = Field(default=20, ge=1, le=500)
    spawn_rate: float = Field(default=5.0, ge=0.1, le=200)
    run_time_s: float = Field(default=15.0, ge=1, le=600)
    host: Optional[str] = None
    failure_mode: Optional[str] = None


async def _run_locust(
    run_id: str,
    profile: str,
    users: int,
    spawn_rate: float,
    run_time_s: float,
    host: str,
    failure_mode_before: Optional[str],
) -> None:
    try:
        if failure_mode_before and failure_mode_before != "off":
            await _set_gateway_failure_mode(failure_mode_before)
        env = {
            **os.environ,
            "LOCUST_PROFILE": profile,
            "LOCUST_HOST": host,
        }
        locustfile = _locust_path()
        rt = f"{int(run_time_s)}s"
        proc = await asyncio.create_subprocess_exec(
            "locust",
            "-f",
            locustfile,
            "--headless",
            "-u",
            str(users),
            "-r",
            str(spawn_rate),
            "--run-time",
            rt,
            "--host",
            host,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        async with _run_lock:
            if run_id in _runs:
                _runs[run_id]["proc"] = proc
                _runs[run_id]["status"] = "running"
        out_b, err_b = await proc.communicate()
        exit_code = proc.returncode
        out_s = (out_b or b"").decode(errors="replace")[-8000:]
        err_s = (err_b or b"").decode(errors="replace")[-8000:]
        async with _run_lock:
            if run_id in _runs:
                _runs[run_id]["status"] = "finished"
                _runs[run_id]["exit_code"] = exit_code
                _runs[run_id]["stdout_tail"] = out_s
                _runs[run_id]["stderr_tail"] = err_s
                _runs[run_id]["proc"] = None
    except Exception as e:
        async with _run_lock:
            if run_id in _runs:
                _runs[run_id]["status"] = "error"
                _runs[run_id]["error"] = str(e)
                _runs[run_id]["proc"] = None
    finally:
        if failure_mode_before and failure_mode_before != "off":
            try:
                await _set_gateway_failure_mode("off")
            except HTTPException:
                pass


@app.post("/api/simulate/attack")
async def simulate_attack(body: SimulateAttackBody):
    if not simulation_enabled():
        raise HTTPException(status_code=403, detail="simulation disabled")
    profile = body.profile
    users = body.users
    spawn_rate = body.spawn_rate
    run_time_s = body.run_time_s
    host = body.host if body.host else locust_host_default()
    fm: Optional[str] = None
    if body.failure_mode is not None:
        fm = str(body.failure_mode)
    run_id = str(uuid.uuid4())
    async with _run_lock:
        _runs[run_id] = {
            "status": "starting",
            "profile": profile,
            "users": users,
            "spawn_rate": spawn_rate,
            "run_time_s": run_time_s,
            "host": host,
            "failure_mode": fm,
            "proc": None,
        }
    asyncio.create_task(
        _run_locust(run_id, profile, users, spawn_rate, run_time_s, host, fm)
    )
    return {"run_id": run_id, "status": "started"}


@app.get("/api/simulate/status/{run_id}")
async def simulate_status(run_id: str):
    async with _run_lock:
        info = _runs.get(run_id)
    if not info:
        raise HTTPException(status_code=404, detail="unknown run_id")
    out = {k: v for k, v in info.items() if k != "proc"}
    return out


@app.post("/api/simulate/stop/{run_id}")
async def simulate_stop(run_id: str):
    if not simulation_enabled():
        raise HTTPException(status_code=403, detail="simulation disabled")
    async with _run_lock:
        info = _runs.get(run_id)
        if not info:
            raise HTTPException(status_code=404, detail="unknown run_id")
        proc = info.get("proc")
    if proc is None:
        return {"run_id": run_id, "stopped": False, "detail": "not running"}
    try:
        proc.terminate()
        await asyncio.wait_for(proc.wait(), timeout=10.0)
    except asyncio.TimeoutError:
        proc.kill()
    except (ProcessLookupError, OSError):
        pass
    async with _run_lock:
        if run_id in _runs:
            _runs[run_id]["status"] = "stopped"
            _runs[run_id]["proc"] = None
    try:
        await _set_gateway_failure_mode("off")
    except HTTPException:
        pass
    return {"run_id": run_id, "stopped": True}
