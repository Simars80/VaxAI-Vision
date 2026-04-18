# Paperclip Agent Tasks — Dashboard Frontend

These tasks are for Paperclip agents working on the `frontend/` directory (Vite + React dashboard at app.vaxaivision.com).
Each task should be done on its own `paperclip/*` branch and submitted as a PR.

**Important:** Read `CLAUDE.md` and `CONTRIBUTING.md` before starting any task.

---

## Task 1: Data Ingestion Page — UX Simplification

**Branch:** `paperclip/fe-ingestion-ux`  
**Files:** `frontend/src/pages/IngestionPage.tsx`  
**Priority:** High

The current Data Ingestion page is confusing — it shows a generic CSV/Excel upload form with a job history table, but it's unclear what data should be uploaded, in what format, and why.

**Requirements:**
1. Add a clear heading and description: "Import Facility Data — Upload vaccine inventory, cold chain readings, or coverage data from your facility systems"
2. Add format guidance: show expected CSV column headers for each data type (inventory, cold chain, coverage)
3. Add a "Download Template" button for each data type that provides a sample CSV
4. Rename the upload section from generic "Upload" to "Select Data Type" → choose type → then upload
5. Keep the job history table but add clearer status labels and a "View Results" action for completed jobs
6. Ensure demo mode (`?demo=true`) works with the changes

---

## Task 2: OpenLMIS Integration Frontend

**Branch:** `paperclip/fe-openlmis-ui`  
**Files:** New file `frontend/src/pages/admin/OpenlmisConfig.tsx`, update `frontend/src/components/Layout.tsx`  
**Priority:** Medium

Backend integration for OpenLMIS exists (`backend/app/integrations/openlmis/`) with models, API endpoints, and a connector. But there is NO frontend page to configure or view the integration.

**Requirements:**
1. Create `frontend/src/pages/admin/OpenlmisConfig.tsx` similar to the existing `Dhis2Config.tsx`
2. Include: connection form (server URL, credentials), facility mapping preview, sync controls (manual sync button, schedule selector)
3. Add a sidebar entry under the Admin section in `frontend/src/components/Layout.tsx`
4. Route: `/admin/openlmis`
5. Use the existing API endpoints from `backend/app/integrations/openlmis/router.py`

---

## Task 3: mSupply Integration Frontend

**Branch:** `paperclip/fe-msupply-ui`  
**Files:** New file `frontend/src/pages/admin/MsupplyConfig.tsx`, update `frontend/src/components/Layout.tsx`  
**Priority:** Medium

Backend integration for mSupply exists (`backend/app/integrations/msupply/`) with models, API endpoints, and a connector. But there is NO frontend page to configure or view the integration.

**Requirements:**
1. Create `frontend/src/pages/admin/MsupplyConfig.tsx` similar to the existing `Dhis2Config.tsx`
2. Include: connection form (server URL, API key), facility mapping, sync controls
3. Add a sidebar entry under the Admin section in `frontend/src/components/Layout.tsx`
4. Route: `/admin/msupply`
5. Use the existing API endpoints from `backend/app/integrations/msupply/router.py`

---

## Task 4: DHIS2 Sidebar Duplication Check

**Branch:** `paperclip/fix-dhis2-nav`  
**Files:** `frontend/src/components/Layout.tsx`  
**Priority:** Low

The user reported DHIS2 appearing twice in the dashboard navigation. Investigate and fix:
1. Check if DHIS2 appears in both the main nav section AND the admin section
2. It should ONLY appear under Admin → DHIS2 Integration (route: `/admin/dhis2`)
3. If it appears elsewhere, remove the duplicate entry
4. Verify the sidebar renders correctly in demo mode

---

## Notes for All Tasks

- Always test with `cd frontend && npm run build` before pushing
- Use `paperclip/<prefix>-<feature>` branch naming
- Submit PRs — never push directly to main
- Demo mode (`?demo=true` URL param) must continue to work
