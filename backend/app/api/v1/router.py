from fastapi import APIRouter

from app.api.v1 import auth, cold_chain, coverage, dhis2, forecasting, ingestion, inventory, msupply, openlmis, reports

router = APIRouter(prefix="/v1")
router.include_router(auth.router)
router.include_router(ingestion.router)
router.include_router(forecasting.router)
router.include_router(inventory.router)
router.include_router(cold_chain.router)
router.include_router(coverage.router)
router.include_router(dhis2.router)
router.include_router(msupply.router)
router.include_router(openlmis.router)
router.include_router(reports.router)
