from fastapi import APIRouter

from app.api.v1 import auth, cold_chain, forecasting, ingestion, inventory

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(ingestion.router)
router.include_router(forecasting.router)
router.include_router(inventory.router)
router.include_router(cold_chain.router)
