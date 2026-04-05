"""Celery application factory for VaxAI Vision."""
from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "vaxai_vision",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.ingestion_tasks", "app.workers.forecast_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Retry failed tasks up to 3 times with exponential back-off
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Result expiry: 24 h
    result_expires=86400,
    # Routing
    task_routes={
        "app.workers.ingestion_tasks.*": {"queue": "ingestion"},
        "app.workers.forecast_tasks.*": {"queue": "ml_training"},
    },
)
