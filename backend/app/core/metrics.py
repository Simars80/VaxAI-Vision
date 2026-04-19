"""Application metrics for VaxAI Vision using prometheus_client.

Exposes a /metrics endpoint (Prometheus text format) and provides
pre-defined metric objects for use throughout the application.

Usage
-----
Import the metric singletons and call .observe() / .inc() / .set() directly:

    from app.core.metrics import ML_INFERENCE_DURATION, COLD_CHAIN_ALERTS

    with ML_INFERENCE_DURATION.labels(model="prophet", facility_id="KE-001").time():
        result = run_forecast(...)

    COLD_CHAIN_ALERTS.labels(facility_id="KE-001", severity="critical").inc()
"""

from __future__ import annotations

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)
from starlette.requests import Request
from starlette.responses import Response

# ── Registry ───────────────────────────────────────────────────────────────────
# Using the default registry (prometheus_client.REGISTRY) keeps compatibility
# with the default process-collector metrics (CPU, memory, GC, etc.)

# ── Histogram bucket sets ──────────────────────────────────────────────────────

# API latency: fine-grained below 1 s, coarser above
_API_LATENCY_BUCKETS = (
    0.005, 0.01, 0.025, 0.05, 0.075,
    0.1, 0.25, 0.5, 0.75,
    1.0, 2.0, 5.0, 10.0,
)

# DB query latency: sub-millisecond to several seconds
_DB_LATENCY_BUCKETS = (
    0.001, 0.005, 0.01, 0.025, 0.05,
    0.1, 0.25, 0.5, 1.0, 2.0, 5.0,
)

# ML inference: typically 100 ms → 30 s range
_ML_LATENCY_BUCKETS = (
    0.01, 0.05, 0.1, 0.25, 0.5,
    1.0, 2.0, 5.0, 10.0, 30.0, 60.0,
)

# ── HTTP / API metrics ─────────────────────────────────────────────────────────

REQUEST_COUNT = Counter(
    "vaxai_http_requests_total",
    "Total HTTP requests received",
    ["method", "endpoint", "status_code"],
)

REQUEST_LATENCY = Histogram(
    "vaxai_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "endpoint"],
    buckets=_API_LATENCY_BUCKETS,
)

ACTIVE_CONNECTIONS = Gauge(
    "vaxai_http_active_connections",
    "Number of currently active HTTP connections",
)

# ── Database metrics ───────────────────────────────────────────────────────────

DB_QUERY_DURATION = Histogram(
    "vaxai_db_query_duration_seconds",
    "Database query duration in seconds",
    ["operation", "table"],
    buckets=_DB_LATENCY_BUCKETS,
)

DB_CONNECTION_POOL_SIZE = Gauge(
    "vaxai_db_connection_pool_size",
    "Current size of the SQLAlchemy async connection pool",
)

DB_CONNECTION_POOL_CHECKED_OUT = Gauge(
    "vaxai_db_connection_pool_checked_out",
    "Number of connections currently checked out from the pool",
)

# ── ML / inference metrics ─────────────────────────────────────────────────────

ML_INFERENCE_DURATION = Histogram(
    "vaxai_ml_inference_duration_seconds",
    "ML model inference duration in seconds",
    ["model", "facility_id"],
    buckets=_ML_LATENCY_BUCKETS,
)

ML_INFERENCE_ERRORS = Counter(
    "vaxai_ml_inference_errors_total",
    "Total ML inference errors",
    ["model", "error_type"],
)

# ── Cold-chain / supply-chain domain metrics ───────────────────────────────────

COLD_CHAIN_ALERTS = Counter(
    "vaxai_cold_chain_alerts_total",
    "Total cold-chain temperature breach alerts generated",
    ["facility_id", "severity"],
)

COLD_CHAIN_TEMPERATURE = Gauge(
    "vaxai_cold_chain_temperature_celsius",
    "Last recorded cold-chain temperature reading (Celsius)",
    ["facility_id", "sensor_id"],
)

STOCKOUT_EVENTS = Counter(
    "vaxai_stockout_events_total",
    "Total stockout events detected",
    ["facility_id", "vaccine_type"],
)

SYNC_OPERATIONS = Counter(
    "vaxai_sync_operations_total",
    "Total external-system sync operations",
    ["system", "direction", "status"],
)

INVENTORY_LEVEL = Gauge(
    "vaxai_inventory_doses_available",
    "Current inventory level in doses",
    ["facility_id", "vaccine_type"],
)

# ── /metrics endpoint ──────────────────────────────────────────────────────────


async def metrics_endpoint(request: Request) -> Response:
    """Prometheus scrape endpoint — mount at /metrics in main.py."""
    output = generate_latest()
    return Response(content=output, media_type=CONTENT_TYPE_LATEST)
