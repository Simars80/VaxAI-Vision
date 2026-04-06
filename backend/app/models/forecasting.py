"""SQLAlchemy models for forecasting model runs and predictions."""

import enum
import uuid

from sqlalchemy import DateTime, Enum, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ModelRunStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"


class ModelRun(Base):
    """Tracks each model training run."""

    __tablename__ = "forecast_model_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    supply_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    facility_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[ModelRunStatus] = mapped_column(
        Enum(ModelRunStatus, name="model_run_status"),
        nullable=False,
        default=ModelRunStatus.queued,
    )
    mlflow_run_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    model_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    triggered_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[DateTime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class ForecastPrediction(Base):
    """Stores generated forecast predictions for serving."""

    __tablename__ = "forecast_predictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    model_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    supply_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    facility_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    forecast_date: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    horizon_periods: Mapped[int] = mapped_column(Integer, nullable=False)
    # Predicted demand quantity
    yhat: Mapped[float] = mapped_column(nullable=False)
    yhat_lower: Mapped[float] = mapped_column(nullable=False)
    yhat_upper: Mapped[float] = mapped_column(nullable=False)
    model_source: Mapped[str | None] = mapped_column(
        String(32), nullable=True
    )  # prophet | lgbm | ensemble
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
