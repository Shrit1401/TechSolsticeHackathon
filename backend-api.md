# Dashboard API (port 8010)

This document describes the **HTTP surface your client application should use**: the **dashboard service** listening on **8010**. It aggregates observability backends (Prometheus, Loki, Grafana API, Jaeger, anomaly detector) and optional load simulation.

Do **not** point the app at individual microservice ports (8001–8007) or the API gateway (8000) unless you intentionally bypass the dashboard; those are internal deployment details.

---

## Base URL


| Environment              | Example base URL                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Local Docker Compose     | `http://localhost:8010`                                                                |
| Same host, custom bind   | `http://<host>:8010`                                                                   |
| Behind TLS reverse proxy | `https://api.example.com` (proxy forwards to `http://127.0.0.1:8010` or the container) |


All paths below are relative to that base (e.g. `GET /health` → `http://localhost:8010/health`).

---

## Deployment checklist

1. **Expose 8010** (or only 443/80 if a reverse proxy terminates TLS and forwards to 8010).
2. **Set environment variables** on the dashboard container so URLs resolve from *inside* the Docker network (see [Environment variables](#environment-variables)). Your **app** only needs the public base URL; it does not use `PROMETHEUS_URL` etc. directly.
3. **CORS**: configure `CORS_ORIGINS` for browser apps (comma-separated origins, or `*` for development only).
4. **Grafana API**: set `GRAFANA_API_KEY` to a service account token with the permissions you need. Without a key, `/api/grafana/...` returns 503.
5. **Load simulation**: `/api/simulate/*` requires `locust` in the image (included) and `ENABLE_SIMULATION` not set to `0`/`false`/`no`. Simulation calls the API gateway from inside the stack using `LOCUST_HOST` / `GATEWAY_URL`.

---

## Authentication

There is **no app-level JWT or API key** on the dashboard itself. **Grafana** calls are authenticated server-side with `GRAFANA_API_KEY`. If you expose 8010 on the public internet, put it **behind** a VPN, IP allowlist, or reverse proxy auth—do not rely on this service alone for perimeter security.

---

## Capabilities by endpoint

What you can **build or operate** with each route (conceptual map from app or automation).


| Endpoint                                           | What you can use it for                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `**GET /health`**                                  | **Readiness / dependency checks** before showing the main UI; **ops status pages** (“is the stack up?”); **CI smoke tests** after deploy; **load balancer or orchestrator health** if you wire this URL (note: it calls several backends, so it is deeper than a trivial ping).                                                                                                            |
| `**GET /api/charts/presets`**                      | **Bootstrap dashboards** with consistent PromQL without duplicating strings in the client; **documentation for analysts** (titles + queries together); **quick “add chart”** flows that list known panels by `id`.                                                                                                                                                                         |
| `**GET /api/prometheus/query`**                    | **Single-number widgets** (current error rate, current `up`, memory now); **alert-style checks** at a point in time (`time=`); **ad-hoc debugging** (“what is the value of X right now?”). Anything that needs a **scalar or instant vector** from PromQL.                                                                                                                                 |
| `**GET /api/prometheus/query_range`**              | **Line charts over time** (request rate, latency percentiles, error ratio); **correlate incidents** by zooming `start`/`end`; **export series** for your own charting library. Use whenever the UI needs **history**, not just the latest sample.                                                                                                                                          |
| `**GET /api/loki/query`**                          | **Log search at a moment** (or small window depending on LogQL); **fetch sample lines** for a detail view; **validate LogQL** from a query bar. Good for “**what matched right now**” or bounded instant queries.                                                                                                                                                                          |
| `**GET /api/loki/query_range`**                    | **Logs over a time window** (incident timelines); **log volume / counts over time** when using metric-style LogQL; **tie log results to charts** that share the same `start`/`end`. Use for **range** log exploration and dashboards driven by Loki.                                                                                                                                       |
| `**GET` / `POST` / … `/api/grafana/{path}`**       | Anything the **Grafana HTTP API** supports **without** putting the Grafana API key in the browser: **list/search dashboards and folders**; **run queriees** via `ds/query` if you proxy that path; **manage annotations**; **fetch dashboard JSON** for embedding or backup. Path is everything after Grafana’s `/api/` (e.g. `searceh`, `dashboards/uid/:uid`, `folders`, `datasources`). |
| `**GET /api/jaeger/traces`**                       | **Distributed trace search**: filter by **service**, **operation**, **time range**, **tags**, **limits**; **incident investigation** (“show traces for checkout around the outage”); **feed a trace list UI** before opening a specific trace ID in Jaeger UI if you link out.                                                                                                             |
| `**GET /api/jaeger/services`**                     | **Populate service pickers** in trace search; **discover** which services report traces; **validate** instrumentation (empty list → nothing reaching Jaeger).                                                                                                                                                                                                                              |
| `**GET /api/detector/detect`**                     | **Single “is the system anomalous?”** call with **fused** signals: gateway error rate, optional ML, logs, traces, confidence, suggested **root cause**, **remediation** flag. Use for **status widgets**, **alerting hooks**, or **SOC-style overview** without calling Prometheus/Loki/Jaeger separately.                                                                                 |
| `**GET /api/detector/traces`**                     | **Trace-only deep dive** when you care about **slow-service / trace anomaly** output without the full `/detect` payload; **503** if trace features are disabled server-side.                                                                                                                                                                                                               |
| `**GET /api/detector/logs`**                       | **On-demand log anomaly** for a chosen LogQL window (`query`, `minutes`, `limit`, `z`) **without** running the full fusion pipeline of `/detect`. Use for **drill-down** or **testing a log query** against the detector’s scoring.                                                                                                                                                        |
| `**POST /api/simulate/attack`**                    | **Load and chaos testing**: drive **Locust** profiles against your gateway (`host` / `LOCUST_HOST`); **optional payment failure modes** via `failure_mode` to stress error paths; **demos and capacity experiments**. Not for production user traffic—**ops and test** scenarios.                                                                                                          |
| `**GET /api/simulate/status/{run_id}`**            | **Poll a running load test**: progress, **stdout/stderr tails** for debugging Locust, **exit code** when finished. Build a **“test run”** UI or script that waits until `finished` / `error`.                                                                                                                                                                                              |
| `**POST /api/simulate/stop/{run_id}`**             | **Cancel** a long or mistaken simulation; **forces failure mode off** on the gateway after stop. Use when a run must end early or you need to **clean up** state.                                                                                                                                                                                                                          |
| `**GET /docs`**, `**/redoc**`, `**/openapi.json**` | **Interactive try-it** UI (`/docs`, `/redoc`); **machine-readable schema** (`/openapi.json`) for codegen or Postman import. Handy for **discovery**, but proxied paths are best documented from **Prometheus/Loki/Jaeger** specs for query parameters.                                                                                                                                     |


---

## Endpoints

### `GET /health`

Liveness/deep health: checks Prometheus, Loki, detector, optional Grafana (if `GRAFANA_API_KEY` set), and Jaeger.

**Response (JSON):** `status` is `ok` or `degraded` if any checked backend is `down`. `backends` maps service name to `ok`, `down`, or `skipped_no_token` (Grafana when no key).

**Example:**

```bash
curl -sS "http://localhost:8010/health"
```

---

### `GET /api/charts/presets`

Returns built-in PromQL chart definitions for the UI.

**Response:** `{ "presets": [ { "id", "title", "promql" }, ... ] }`

**Example:**

```bash
curl -sS "http://localhost:8010/api/charts/presets"
```

---

### `GET /api/prometheus/query`

Proxy to Prometheus **instant** query API: `GET /api/v1/query`.

**Query parameters (pass through):** at minimum `query` (PromQL). Optional: `time` (Unix timestamp), `timeout`, etc., per Prometheus API.

**Example:**

```bash
curl -sS "http://localhost:8010/api/prometheus/query?query=up"
```

---

### `GET /api/prometheus/query_range`

Proxy to Prometheus **range** query API: `GET /api/v1/query_range`.

**Query parameters:** `query`, `start`, `end`, `step` (Prometheus semantics).

**Example:**

```bash
curl -sG "http://localhost:8010/api/prometheus/query_range" \
  --data-urlencode "query=up" \
  --data-urlencode "start=$(date -u -v-15M +%s)" \
  --data-urlencode "end=$(date -u +%s)" \
  --data-urlencode "step=15"
```

---

### `GET /api/loki/query`

Proxy to Loki `**/loki/api/v1/query**` (instant/log queries).

**Query parameters:** Loki expects at least `query` (LogQL); optional `limit`, `time`, etc.

**Example:**

```bash
curl -sS "http://localhost:8010/api/loki/query?query=%7Bjob%3D%22docker%22%7D&limit=10"
```

---

### `GET /api/loki/query_range`

Proxy to Loki `**/loki/api/v1/query_range**`.

**Query parameters:** `query`, `start`, `end`, `limit`, `step`, etc. (nanosecond Unix timestamps per Loki API).

**Example:**

```bash
curl -sS "http://localhost:8010/api/loki/query_range?query=%7Bjob%3D%22docker%22%7D&start=1700000000000000000&end=1700000060000000000&limit=100"
```

---

### `GET|POST|PUT|PATCH|DELETE /api/grafana/{path}`

Reverse proxy to **Grafana HTTP API** at `{GRAFANA_URL}/api/{path}`. The dashboard adds `Authorization: Bearer <GRAFANA_API_KEY>`. Your request body and `Content-Type` are forwarded for mutating methods.

**Examples:**

```bash
curl -sS "http://localhost:8010/api/grafana/search?type=dash-db"
curl -sS -X POST "http://localhost:8010/api/grafana/ds/query" \
  -H "Content-Type: application/json" \
  -d '{"queries":[]}'
```

If `GRAFANA_API_KEY` is unset or empty, the handler returns **503** with a message that Grafana API is disabled.

---

### `GET /api/jaeger/traces`

Proxy to Jaeger `**/api/traces`** (trace search).

**Query parameters:** Jaeger UI API parameters, e.g. `service`, `operation`, `tags`, `start`, `end`, `limit`, `lookback`, etc.

**Example:**

```bash
curl -sS "http://localhost:8010/api/jaeger/traces?service=my-service&limit=20"
```

---

### `GET /api/jaeger/services`

Proxy to Jaeger `**/api/services**` (list of service names).

**Example:**

```bash
curl -sS "http://localhost:8010/api/jaeger/services"
```

---

### `GET /api/detector/detect`

Proxy to the anomaly detector `**GET /detect**`. Returns fused anomaly signals (metrics, optional ML, logs, traces), confidence, root-cause hints, and remediation flags. No query parameters required.

**Example:**

```bash
curl -sS "http://localhost:8010/api/detector/detect"
```

---

### `GET /api/detector/traces`

Proxy to `**GET /detect/traces**` (on-demand trace anomaly report). Returns **503** if trace anomaly is disabled on the detector.

**Example:**

```bash
curl -sS "http://localhost:8010/api/detector/traces"
```

---

### `GET /api/detector/logs`

Proxy to `**GET /detect/logs**` (on-demand log anomaly analysis via Loki).

**Query parameters (defaults in parentheses):**


| Param     | Description                               |
| --------- | ----------------------------------------- |
| `query`   | LogQL (`{job="docker"}`)                  |
| `limit`   | Max lines (default `200`)                 |
| `minutes` | Lookback window in minutes (default `15`) |
| `z`       | Z-score style threshold (default `2.0`)   |


**Example:**

```bash
curl -sS "http://localhost:8010/api/detector/logs?query=%7Bjob%3D%22docker%22%7D&limit=100&minutes=10"
```

---

### `POST /api/simulate/attack`

Starts a **headless Locust** run against `LOCUST_HOST` (or overridden `host`). Disabled when `ENABLE_SIMULATION` is off (**403**).

**Request body (JSON):**


| Field          | Type           | Default       | Notes                                                                                         |
| -------------- | -------------- | ------------- | --------------------------------------------------------------------------------------------- |
| `profile`      | string         | `"all"`       | Passed as `LOCUST_PROFILE` to Locust                                                          |
| `users`        | int            | `20`          | 1–500                                                                                         |
| `spawn_rate`   | float          | `5.0`         | Users spawned per second                                                                      |
| `run_time_s`   | float          | `15.0`        | Duration in seconds (1–600)                                                                   |
| `host`         | string         | `LOCUST_HOST` | Base URL to load-test                                                                         |
| `failure_mode` | string or null | null          | If set and not `"off"`, sets payment failure mode via gateway before the run and resets after |


**Response:** `{ "run_id": "<uuid>", "status": "started" }`

**Example:**

```bash
curl -sS -X POST "http://localhost:8010/api/simulate/attack" \
  -H "Content-Type: application/json" \
  -d '{"profile":"all","users":10,"spawn_rate":2,"run_time_s":30}'
```

---

### `GET /api/simulate/status/{run_id}`

Poll status for a simulation started by `POST /api/simulate/attack`.

**Response:** Fields include `status` (`starting`, `running`, `finished`, `error`, `stopped`), `exit_code`, `stdout_tail`, `stderr_tail`, `error`, and metadata. **404** if `run_id` is unknown.

**Example:**

```bash
curl -sS "http://localhost:8010/api/simulate/status/<run_id>"
```

---

### `POST /api/simulate/stop/{run_id}`

Attempts to **terminate** the Locust process for that run and sets gateway failure mode to `off`. Disabled when simulation is off (**403**). **404** if `run_id` unknown.

**Response:** `{ "run_id", "stopped": true|false, "detail"? }`

**Example:**

```bash
curl -sS -X POST "http://localhost:8010/api/simulate/stop/<run_id>"
```

---

## CORS

The service uses FastAPI `CORSMiddleware`. With `CORS_ORIGINS=*`, browsers may call any origin; for production, set explicit origins.

---

## Errors

- **403**: simulation disabled.
- **404**: unknown `run_id` on simulate status/stop.
- **502/503/504**: upstream (Prometheus, Loki, Grafana, Jaeger, detector) failures or timeouts; body is usually forwarded from upstream or a JSON `detail` from FastAPI.

---

## Quick reference (8010 only)


| Method                        | Path                            |
| ----------------------------- | ------------------------------- |
| GET                           | `/health`                       |
| GET                           | `/api/charts/presets`           |
| GET                           | `/api/prometheus/query`         |
| GET                           | `/api/prometheus/query_range`   |
| GET                           | `/api/loki/query`               |
| GET                           | `/api/loki/query_range`         |
| GET, POST, PUT, PATCH, DELETE | `/api/grafana/{path}`           |
| GET                           | `/api/jaeger/traces`            |
| GET                           | `/api/jaeger/services`          |
| GET                           | `/api/detector/detect`          |
| GET                           | `/api/detector/traces`          |
| GET                           | `/api/detector/logs`            |
| POST                          | `/api/simulate/attack`          |
| GET                           | `/api/simulate/status/{run_id}` |
| POST                          | `/api/simulate/stop/{run_id}`   |
| GET                           | `/docs`                         |
| GET                           | `/redoc`                        |
| GET                           | `/openapi.json`                 |


The `/openapi.json` schema may not describe every proxied query parameter; use the sections above for Prometheus, Loki, and Jaeger.