from fastapi import APIRouter

from app.api.v1 import auth, forecasting, ingestion

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(ingestion.router)
router.include_router(forecasting.router)
