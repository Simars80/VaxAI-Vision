# VaxAI Vision — Product Development Roadmap

> Last updated: April 19, 2026
> Owner: VaxAI Vision Founding Team
> Contact: partnerships@vaxaivision.com

---

## Mission

Eliminate vaccine stockouts and cold chain failures in low- and middle-income countries through AI-powered supply chain intelligence — starting with sub-Saharan Africa.

---

## Current State: Platform v1.0 (April 2026)

### What's Built

| Module | Status | Maturity |
|--------|--------|----------|
| Landing site (Next.js → Vercel) | **Live** | Production |
| Dashboard frontend (Vite + React → GitHub Pages) | **Live** | Production |
| Backend API (FastAPI → AWS EC2) | **Live** | Production |
| JWT authentication + RBAC | **Done** | Production |
| PostgreSQL + Redis data layer | **Done** | Production |
| Real-time inventory tracking | **Done** | Production |
| Cold chain temperature monitoring | **Done** | Production |
| AI demand forecasting (Prophet + LightGBM) | **Done** | Production |
| Geospatial coverage mapping | **Done** | Production |
| Computer vision — VVM classifier | **Done** | Production |
| AR stock counter (YOLOv8-nano) | **Done** | Beta |
| Data ingestion (CSV, Excel) | **Done** | Production |
| DHIS2 integration | **Done** | Production |
| OpenLMIS integration | **Done** | Production |
| mSupply integration | **Done** | Production |
| FHIR interoperability layer | **Done** | Beta |
| PWA offline caching (Workbox + IndexedDB) | **Done** | Beta |
| Impact reporting + export | **Done** | Production |
| CI/CD pipeline (GitHub Actions) | **Done** | Production |
| Docker + Kubernetes deployment configs | **Done** | Staging |
| MLflow model tracking | **Done** | Staging |
| Computer vision — Equipment inspector | **Done** | Beta |
| End-to-end integration test suite (113 tests) | **Done** | Production |
| Pilot data validation pipeline | **Done** | Production |
| Security hardening (rate limiting, encryption, audit) | **Done** | Production |
| Monitoring stack (Prometheus, Grafana, structured logging) | **Done** | Staging |
| Mobile app (React Native / Expo) | **Done** | Beta |
| Multi-tenant architecture (country/org/facility) | **Done** | Beta |

### Key Gaps — RESOLVED (April 2026)

All eight previously identified gaps have been addressed:

| Gap | Resolution | New Files |
|-----|-----------|-----------|
| ~~Deploy workflow failing~~ | Fixed deploy.yml: added workflow_dispatch, gated AWS steps, fixed secret fallback in deploy-pages.yml | `.github/workflows/deploy.yml`, `deploy-pages.yml` |
| ~~Equipment inspection model stubbed~~ | Built real EquipmentInspector with ONNX→sklearn→heuristic fallback chain, synthetic data generator, and training script | `vision/equipment_inspector.py`, `ml/equipment_synthetic.py`, `ml/equipment_train.py` |
| ~~No end-to-end integration testing~~ | 113 E2E tests across 7 test files covering auth, inventory, cold chain, vision, ingestion, forecasting, and integration sync | `tests/test_*_e2e.py`, `tests/test_integration_sync.py` |
| ~~No pilot data validation~~ | Full validation pipeline with 6 business rule validators, quality scoring (4 dimensions), and API endpoints | `validation/` package (schemas, rules, pipeline, quality), `api/v1/validation.py` |
| ~~Security audit not performed~~ | Rate limiting (slowapi), API key auth, audit logging, input sanitization, field encryption, security headers, tightened CORS | `core/rate_limiter.py`, `core/api_keys.py`, `core/audit.py`, `core/input_sanitizer.py`, `core/encryption.py` |
| ~~No monitoring/observability~~ | Structured JSON logging, Prometheus metrics + alerting rules, Grafana dashboard, enhanced health checks, request tracing middleware | `core/logging_config.py`, `core/metrics.py`, `core/middleware.py`, `monitoring/` configs |
| ~~Mobile app not started~~ | React Native (Expo) app with offline-first sync, barcode scanning, push notifications, 6 screens, 5 components | `mobile/` directory (28 files) |
| ~~Multi-tenant architecture~~ | Country→Org→District→Facility hierarchy, tenant-scoped queries, hierarchical RBAC, JWT tenant claims, Alembic migration | `models/tenant.py`, `core/tenant_context.py`, `core/tenant_filter.py`, `api/v1/tenants.py` |

---

## Roadmap Framework: Now / Next / Later

We use a phased approach aligned to fundraising milestones and deployment readiness.

---

## Phase 1: NOW — Foundation & Pilot Readiness (Q2–Q3 2026)

**Theme:** Get the platform deployment-ready for first pilot facilities in sub-Saharan Africa.

**Success Criteria:** 5 facilities running VaxAI Vision with real data, zero critical bugs, core workflows validated by health workers.

### 1.1 Infrastructure & DevOps

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Fix CI/CD deploy workflow (GitHub Actions) | P0 | 1 day | Engineering | **Done** |
| Set up staging environment on AWS | P0 | 3 days | Engineering | **Not Started** |
| Configure domain SSL for api.vaxaivision.com | P0 | 1 day | Engineering | **Done** |
| Deploy PostgreSQL on AWS RDS (prod) | P0 | 2 days | Engineering | **Not Started** |
| Deploy Redis on ElastiCache (prod) | P1 | 1 day | Engineering | **Not Started** |
| Set up Prometheus/Grafana monitoring + alerts | P1 | 3 days | Engineering | **Done** |
| Configure automated database backups | P0 | 1 day | Engineering | **Not Started** |
| Set up error tracking (structured logging + middleware) | P1 | 1 day | Engineering | **Done** |
| Load testing — validate 50 concurrent users | P1 | 3 days | Engineering | **Not Started** |

### 1.2 Security & Compliance

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Security audit of auth flow + API endpoints | P0 | 5 days | Security | **Done** |
| Implement rate limiting on all public endpoints | P0 | 2 days | Engineering | **Done** |
| Add API key authentication for integration endpoints | P1 | 3 days | Engineering | **Done** |
| Data encryption at rest (field-level Fernet + KMS) | P0 | 2 days | Engineering | **Done** |
| GDPR/data protection compliance review | P1 | 5 days | Legal/Compliance | **Not Started** |
| Audit logging for all data mutations | P1 | 3 days | Engineering | **Done** |
| Penetration testing | P2 | 5 days | External | **Not Started** |

### 1.3 Pilot Features

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Multi-facility user management (tenant architecture) | P0 | 5 days | Engineering | **Done** |
| Facility onboarding wizard (guided setup) | P1 | 5 days | Engineering | **Done** |
| Offline data sync — queue uploads when disconnected | P0 | 5 days | Engineering | **Done** |
| Low-bandwidth mode (compressed API responses) | P1 | 3 days | Engineering | **Not Started** |
| SMS/WhatsApp alerts for critical stockouts | P1 | 5 days | Engineering | **Not Started** |
| Dashboard localization — French, Portuguese, Swahili | P1 | 5 days | Engineering | **Not Started** |
| Data validation rules (reject bad CSV rows with clear errors) | P0 | 3 days | Engineering | **Done** |
| Export to PDF for offline facility reports | P1 | 3 days | Engineering | **Not Started** |

### 1.4 AI/ML Hardening

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Validate forecasting accuracy on real facility data | P0 | 5 days | ML | **Not Started** |
| Train VVM classifier on expanded dataset (1,000+ images) | P1 | 10 days | ML | **Not Started** |
| Complete equipment inspection vision model | P2 | 10 days | ML | **Done** |
| AR stock counter field testing (real pharmacy shelves) | P1 | 5 days | ML | **Not Started** |
| Model performance monitoring (drift detection) | P2 | 5 days | ML | **Not Started** |

### 1.5 Pilot Operations

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Identify 5 pilot facilities in target country | P0 | — | Partnerships | **Not Started** |
| Conduct facility needs assessment | P0 | — | Field Ops | **Not Started** |
| Create facility training materials (user guides) | P0 | 5 days | Product | **Not Started** |
| Set up on-site training sessions | P0 | — | Field Ops | **Not Started** |
| Establish feedback collection process | P1 | 2 days | Product | **Not Started** |
| Define KPIs for pilot success | P0 | 2 days | Product | **Not Started** |

**Dependencies:**
- Pilot facilities depend on partnership agreements and country selection
- Offline sync and low-bandwidth mode are critical for sub-Saharan deployment
- Security audit must complete before any real patient-adjacent data flows

**Milestone:** 5 pilot facilities live with real data — **Target: Q3 2026**

---

## Phase 2: NEXT — Scale & Integration (Q4 2026 – Q2 2027)

**Theme:** Expand from pilot to 200+ facilities across 3 countries. Deepen integrations with national health information systems. Build the data flywheel.

**Success Criteria:** 200+ facilities across 3 countries, DHIS2/OpenLMIS live sync in at least 2 countries, measurable reduction in stockouts at pilot sites.

### 2.1 Multi-Tenancy & Scale

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Multi-tenant architecture (country/org isolation) | P0 | 15 days | Engineering | **Done** |
| Role-based access: National → District → Facility hierarchy | P0 | 10 days | Engineering | **Done** |
| Horizontal scaling — auto-scaling backend on EKS | P1 | 10 days | Engineering | **Not Started** |
| CDN for static assets + dashboard (CloudFront) | P1 | 3 days | Engineering | **Not Started** |
| Database read replicas for reporting queries | P2 | 5 days | Engineering | **Not Started** |

### 2.2 National Health System Integration

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| DHIS2 bidirectional sync (push aggregated data back) | P0 | 10 days | Engineering | **Not Started** |
| OpenLMIS requisition auto-generation | P1 | 10 days | Engineering | **Not Started** |
| HL7 FHIR R4 full compliance certification | P2 | 15 days | Engineering | **Not Started** |
| LMIS data reconciliation engine | P1 | 10 days | Engineering | **Not Started** |
| National-level aggregate dashboards | P0 | 10 days | Engineering | **Not Started** |

### 2.3 Advanced Analytics

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Predictive stockout alerts (7-day, 14-day, 30-day) | P0 | 10 days | ML | **Not Started** |
| Cold chain failure prediction model | P1 | 15 days | ML | **Not Started** |
| Supply chain optimization engine (reorder point calculation) | P1 | 15 days | ML | **Not Started** |
| Coverage gap analysis with demographic overlays | P1 | 10 days | ML | **Not Started** |
| What-if scenario modeling (campaign planning) | P2 | 10 days | ML | **Not Started** |

### 2.4 Mobile & Field Tools

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| React Native mobile app (iOS + Android) | P1 | 30 days | Engineering | **Done** |
| Barcode/QR scanning for stock intake | P0 | 10 days | Engineering | **Done** |
| Camera-based VVM checking (mobile) | P1 | 10 days | ML | **Done** |
| Offline-first mobile with background sync | P0 | 10 days | Engineering | **Done** |
| Push notifications for alerts | P1 | 5 days | Engineering | **Done** |

### 2.5 Partnerships & Expansion

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Onboard 2nd and 3rd pilot countries | P0 | — | Partnerships | **Not Started** |
| Establish MoU with national health ministries | P0 | — | Partnerships | **Not Started** |
| Gavi/UNICEF partnership exploration | P1 | — | Partnerships | **Not Started** |
| Publish pilot impact report | P0 | 5 days | Product | **Not Started** |
| Conference presentations (Africa Health, GHSA) | P2 | — | Marketing | **Not Started** |

**Dependencies:**
- Multi-tenancy must be complete before onboarding additional countries
- National integrations require MoU with health ministries
- Mobile app depends on finalized API contracts from Phase 1

**Milestone:** 200+ facilities, 3 countries, measurable impact — **Target: Q2 2027**

---

## Phase 3: LATER — Platform Maturity & Market (Q3 2027 – Q4 2027)

**Theme:** Evolve from a tool into a platform. Build the ecosystem for donors, governments, and partners. Expand to 8+ LMIC countries.

**Success Criteria:** 1,000+ facilities across 8+ countries, self-serve onboarding for new countries, donor dashboard live, evidence of 30%+ stockout reduction.

### 3.1 Platform & Ecosystem

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Self-serve country onboarding (config-driven setup) | P0 | 20 days | Engineering | **Not Started** |
| Donor/partner dashboard (read-only aggregate views) | P0 | 15 days | Engineering | **Not Started** |
| API marketplace for third-party integrations | P2 | 20 days | Engineering | **Not Started** |
| White-label capability for ministry branding | P2 | 10 days | Engineering | **Not Started** |
| Plugin architecture for country-specific workflows | P2 | 15 days | Engineering | **Not Started** |

### 3.2 Advanced AI

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Federated learning across facilities (privacy-preserving) | P2 | 20 days | ML | **Not Started** |
| Natural language querying ("Show me stockout risk in Nairobi") | P2 | 15 days | ML | **Not Started** |
| Automated anomaly detection across supply chain | P1 | 10 days | ML | **Not Started** |
| Satellite imagery integration for facility mapping | P2 | 15 days | ML | **Not Started** |

### 3.3 Evidence & Impact

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| Peer-reviewed publication on platform impact | P1 | — | Research | **Not Started** |
| Automated impact dashboards for grant reporting | P0 | 10 days | Engineering | **Not Started** |
| Health economic analysis (cost per dose saved) | P1 | — | Research | **Not Started** |
| Data sharing agreements with research institutions | P2 | — | Partnerships | **Not Started** |

### 3.4 Sustainability & Revenue

| Item | Priority | Effort | Owner | Status |
|------|----------|--------|-------|--------|
| SaaS pricing model for self-funded countries | P1 | — | Business | **Not Started** |
| Premium analytics tier for donors/NGOs | P2 | — | Business | **Not Started** |
| Data-as-a-service offering (anonymized aggregate insights) | P2 | — | Business | **Not Started** |
| Government procurement pathway documentation | P1 | — | Business | **Not Started** |

**Milestone:** 1,000+ facilities, 8+ LMICs, proven impact, path to sustainability — **Target: Q4 2027**

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pilot country internet connectivity issues | High | High | PWA offline mode, low-bandwidth API, SMS fallback |
| Health ministry approval delays | High | High | Start engagement early, leverage WHO/Gavi introductions |
| Data quality from manual facility entry | Medium | High | Validation rules, training materials, data cleaning pipeline |
| ML model performance on real-world data | Medium | Medium | Continuous validation, fallback to rule-based alerts |
| Security breach / data leak | Low | Critical | Security audit, encryption, penetration testing, audit logging |
| Key personnel dependency | Medium | High | Document everything, cross-train, hire early |
| Funding gap between seed and growth | Medium | Critical | Diversify funding sources (grants, impact investors, government) |
| Competing platforms gain traction | Low | Medium | Move fast, build integrations that create lock-in, publish evidence |

---

## Capacity Allocation (Target)

| Category | Phase 1 | Phase 2 | Phase 3 |
|----------|---------|---------|---------|
| Feature development | 60% | 50% | 40% |
| Infrastructure & DevOps | 20% | 15% | 10% |
| Security & compliance | 10% | 10% | 10% |
| Tech debt & reliability | 5% | 15% | 20% |
| Research & experimentation | 5% | 10% | 20% |

---

## Key Metrics to Track

### Product Health
- **Uptime**: Target 99.5% (Phase 1), 99.9% (Phase 3)
- **API response time**: P95 < 500ms
- **Offline sync success rate**: > 95%
- **Active facilities**: 5 → 200 → 1,000

### Impact Metrics
- **Stockout incidents**: Measure reduction vs baseline at each facility
- **Cold chain breach response time**: Time from alert to action
- **Forecast accuracy**: MAPE < 20% on 30-day predictions
- **Coverage improvement**: % increase in immunization coverage at active facilities

### Business Metrics
- **Facilities onboarded per month**
- **Countries active**
- **Grant pipeline value**
- **Cost per facility per month** (target: < $50 at scale)

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Apr 2026 | Start with sub-Saharan Africa, expand to broader LMICs | Highest need, strong partner networks, aligns with Gavi mandate |
| Apr 2026 | PWA-first over native mobile for Phase 1 | Faster to deploy, works offline, avoids app store friction |
| Apr 2026 | PostgreSQL over NoSQL | Relational data (facilities, inventory, cold chain) fits well; JSONB for flexibility |
| Apr 2026 | Prophet + LightGBM for forecasting | Proven on sparse time series, interpretable, runs on modest hardware |
| Apr 2026 | Monorepo architecture | Single team, shared types, easier CI/CD, will split later if needed |

---

## How to Use This Roadmap

1. **Weekly**: Review Phase 1 items in your current sprint, update statuses
2. **Monthly**: Reassess priorities within the current phase based on learnings
3. **Quarterly**: Review phase progress against milestones, adjust timelines
4. **When adding items**: Always ask "what comes off?" — the roadmap is capacity-bound
5. **When sharing externally**: Use the phase summaries and milestones, not the item tables

---

*This roadmap is a living document. Update it as you learn from pilots, partnerships, and the market.*
