# VaxAI Vision

> AI-driven vaccine supply chain intelligence platform for last-mile immunisation programmes.

VaxAI Vision helps health supply chain managers, NGOs, and government immunisation programmes make smarter decisions — faster. It combines real-time computer vision, ML-powered forecasting, cold chain monitoring, and deep integrations with DHIS2, mSupply, OpenLMIS, and FHIR to give field teams and planners a single, reliable picture of vaccine availability and coverage.

**Live site:** [vaxaivision.com](https://vaxaivision.com)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Local Setup](#local-setup)
  - [Prerequisites](#prerequisites)
  - [1 — Infrastructure (Postgres, Redis, LocalStack)](#1--infrastructure-postgres-redis-localstack)
  - [2 — Backend API](#2--backend-api)
  - [3 — Dashboard Frontend](#3--dashboard-frontend)
  - [4 — Marketing / Landing Site](#4--marketing--landing-site)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)
- [CI / CD](#ci--cd)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [ML Models](#ml-models)
- [Integrations](#integrations)
- [Security & Compliance](#security--compliance)
- [Contributing](#contributing)

---

## Features

| Module | Description |
|---|---|
| **VVM Scanner** | Camera-based AI classifier that reads Vaccine Vial Monitor (VVM) heat indicators and flags expired vials (Stage 1–4) |
| **AR Stock Counter** | Augmented-reality YOLOv8 object detector that counts vaccine vials, syringes, cold boxes, and ancillary supplies in real time via device camera |
| **Demand Forecasting** | Prophet + LightGBM ensemble that generates short- and medium-term stock forecasts per facility, accounting for seasonality and historical coverage trends |
| **Inventory Management** | Real-time stock ledger with low-stock alerts, expiry tracking, and ingestion pipeline for CSV/XLSX uploads |
| **Cold Chain Monitoring** | Temperature log ingestion, excursion alerts, and equipment status dashboards per facility |
| **Coverage Maps** | Interactive Leaflet maps showing immunisation coverage rates by district and facility |
| **DHIS2 Integration** | Scheduled bi-directional sync of facility hierarchies, stock values, coverage indicators, and cold chain equipment status |
| **mSupply / OpenLMIS / FHIR** | Adapter-based connectors for additional LMIS and health information systems |
| **Offline-first PWA** | Dashboard works offline using IndexedDB (Dexie) with background sync when connectivity returns |
| **Multilingual** | English, French, and Arabic UI via i18next |
| **Impact Dashboard** | Aggregated metrics and shareable impact reports for donors and programme managers |

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Marketing Site (Next.js 14)   vaxaivision.com         │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│  Dashboard SPA (React + Vite)   app.vaxaivision.com    │
│  - React Router · Recharts · Leaflet · Dexie (PWA)     │
└───────────────────────────┬────────────────────────────┘
                            │ REST  /api/v1/
┌───────────────────────────▼────────────────────────────┐
│  Backend API  (FastAPI + Python 3.12)                  │
│  - JWT auth · RBAC · PHI audit · HIPAA middleware      │
│  - Celery workers  (ingestion · forecasting jobs)      │
└──────┬─────────────────────────────┬───────────────────┘
       │                             │
┌──────▼──────┐        ┌────────────▼────────────────────┐
│ PostgreSQL  │        │  External integrations          │
│  (RDS 16)  │        │  - DHIS2  (REST API)            │
└─────────────┘        │  - mSupply (SOAP/REST)          │
┌─────────────┐        │  - OpenLMIS (REST API)          │
│    Redis    │        │  - FHIR R4 (HTTP)               │
│ (ElastiCache│        └─────────────────────────────────┘
│   + Celery) │
└─────────────┘
```

---

## Tech Stack

### Marketing site
| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| UI | Chakra UI · Framer Motion · AOS |

### Dashboard app (`frontend/`)
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 6 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| State | Zustand |
| Charts | Recharts |
| Maps | React Leaflet |
| Offline | Dexie (IndexedDB) + Vite PWA Plugin |
| i18n | i18next (EN / FR / AR) |

### Backend (`backend/`)
| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115 |
| Language | Python 3.12 |
| ORM | SQLAlchemy 2 (async) + asyncpg |
| Migrations | Alembic |
| Task queue | Celery 5 + Redis |
| Auth | JWT (python-jose) + bcrypt |
| Linting | Ruff · Mypy |
| Testing | pytest + pytest-asyncio |

### ML / AI
| Model | Purpose | Framework |
|---|---|---|
| VVM Classifier | VVM stage detection from camera images | scikit-learn RandomForest / SmallCNN (ONNX) |
| Stock Counter | Real-time vaccine product detection & counting | YOLOv8-nano (ultralytics) + ByteTrack |
| Demand Forecasting | Facility-level stock forecasting | Prophet + LightGBM ensemble |

### Infrastructure
| Component | Technology |
|---|---|
| Cloud | AWS (EC2 / ECS / RDS / ElastiCache / S3) |
| IaC | Terraform (modules: RDS, Redis, S3, ALB, KMS) |
| Containers | Docker + Kubernetes (EKS) |
| Helm | `helm/vaxai-backend/` (API + worker deployments) |
| GitOps | ArgoCD |
| Monitoring | Prometheus + Grafana |
| CI/CD | GitHub Actions |

---

## Repository Layout

```
VaxAI Vision Dev/
├── src/                    # Next.js marketing site (App Router)
│   ├── app/                # Pages: home, about, solutions, blog, impact, demo
│   └── components/         # Shared UI components
├── frontend/               # React + Vite dashboard SPA
│   ├── src/
│   │   ├── api/            # API client modules per domain
│   │   ├── pages/          # Route-level page components
│   │   ├── components/     # Reusable UI & domain components
│   │   ├── store/          # Zustand stores
│   │   └── lib/            # DB (Dexie), sync, i18n, utils
│   └── .env.example
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── api/v1/         # Route handlers per domain
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── integrations/   # DHIS2 / mSupply / OpenLMIS / FHIR connectors
│   │   ├── ml/             # Forecasting models & training scripts
│   │   ├── vision/         # VVM classifier & AR stock counter inference
│   │   ├── core/           # HIPAA middleware, RBAC, PHI classification
│   │   └── workers/        # Celery task definitions
│   ├── migrations/         # Alembic migration versions
│   ├── tests/              # pytest test suite
│   └── .env.example
├── infrastructure/
│   ├── terraform/          # AWS infrastructure modules
│   ├── docker/             # docker-compose for local dev stack
│   ├── argocd/             # ArgoCD application manifests
│   ├── monitoring/         # Prometheus rules + Grafana dashboards
│   └── scripts/            # dev-up.sh, dev-down.sh, migrate.sh
├── helm/
│   └── vaxai-backend/      # Helm chart for API + worker pods
├── docs/
│   └── dhis2-integration.md
└── .github/workflows/      # CI (lint + test + Docker build), Deploy
```

---

## Local Setup

### Prerequisites

- **Node.js** ≥ 20 + npm
- **Python** 3.12
- **Docker Desktop** ≥ 4.x
- **AWS CLI** (for LocalStack interaction) — `brew install awscli`

---

### 1 — Infrastructure (Postgres, Redis, LocalStack)

```bash
cd infrastructure/
bash scripts/dev-up.sh
```

This starts PostgreSQL 16, Redis 7, LocalStack (S3), and Adminer, then runs all pending database migrations.

| Service | URL |
|---|---|
| PostgreSQL | `postgresql://vaxai:vaxai_dev_password@localhost:5432/vaxai_vision` |
| Redis | `redis://:vaxai_redis_dev@localhost:6379` |
| LocalStack S3 | `http://localhost:4566` |
| Adminer | `http://localhost:8080` |

To stop: `bash scripts/dev-down.sh`

---

### 2 — Backend API

```bash
cd backend/

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your local values if needed

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

**Start Celery workers** (in a separate terminal):

```bash
source .venv/bin/activate
celery -A app.workers.celery_app worker -Q ingestion -c 4 --loglevel=info
```

**Seed demo data:**

```bash
python scripts/create_demo_user.py
python scripts/seed_demo_data.py
```

---

### 3 — Dashboard Frontend

```bash
cd frontend/

npm install

# Configure environment
cp .env.example .env.local
# Set VITE_API_URL=http://localhost:8000/api/v1

npm run dev
```

Dashboard available at `http://localhost:5173`

---

### 4 — Marketing / Landing Site

```bash
# From the repo root
npm install
npm run dev
```

Site available at `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (asyncpg) |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens — **must be changed in production** |
| `JWT_ALGORITHM` | JWT signing algorithm (default: `HS256`) |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime in minutes |
| `ENV` | `development` / `staging` / `production` |
| `ALLOWED_ORIGINS` | JSON array of CORS-allowed origins |

See `backend/.env.example` for the full list.

### Dashboard frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:8000/api/v1`) |

See `frontend/.env.example` for details.

---

## Running Tests

```bash
cd backend/

# Ensure test services are running (Postgres + Redis from infrastructure/)
pytest tests/ -v --asyncio-mode=auto
```

Individual test modules:
```bash
pytest tests/test_dhis2_client.py -v
pytest tests/test_fhir_mapper.py -v
pytest tests/test_ar_stock_counter.py -v
```

---

## CI / CD

Three GitHub Actions workflows live in `.github/workflows/`:

| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | Push / PR to `main`, `develop` | Ruff lint · Mypy type check · pytest · Docker build validation |
| `deploy.yml` | Push to `main` (staging) / version tag `v*` (production) | Build & push to Amazon ECR · Deploy via Helm to EKS |
| `deploy-pages.yml` | Push to `main` | Build & deploy marketing site to GitHub Pages / Vercel |

All merges to `main` must pass CI before deploy.

---

## Infrastructure & Deployment

Infrastructure is provisioned with Terraform under `infrastructure/terraform/`. Modules:

| Module | Resources |
|---|---|
| `rds/` | PostgreSQL 16 on RDS (encrypted, multi-AZ in prod) |
| `redis/` | ElastiCache Redis 7 (TLS + AUTH, automatic failover in prod) |
| `s3/` | Data lake buckets (raw, processed, model artifacts, reports, logs) |
| `alb/` | Application Load Balancer |
| `kms/` | Encryption key management |

```bash
cd infrastructure/terraform/
terraform init
terraform workspace select dev   # dev | staging | prod
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

Kubernetes deployments are managed with Helm (`helm/vaxai-backend/`) and ArgoCD for GitOps-style continuous delivery.

---

## ML Models

### VVM Stage Classifier

Classifies Vaccine Vial Monitor images into 4 heat-exposure stages to determine vaccine usability.

- **Backends:** scikit-learn RandomForest (demo, ~2 MB) · SmallCNN exported to ONNX (~0.11 MB)
- **Input:** 224×224 RGB image
- **Classes:** Stage 1 (safe) → Stage 4 (discard)
- **Status:** Trained on synthetic data. Real-world deployment requires fine-tuning on annotated field photos.

See `backend/app/ml/MODEL_CARD.md` for full details.

### AR Stock Counter

Detects and counts vaccine products on warehouse shelves in real time using the device camera.

- **Model:** YOLOv8-nano with ByteTrack multi-object tracking
- **Classes:** vaccine vial · syringe · cold box · diluent · ancillary product
- **Target latency:** <100 ms on mid-range Android (Snapdragon 6-series)
- **Export:** ONNX (opset 12) for cross-platform inference
- **Status:** Trained on synthetic procedural data. Production use requires real annotated images.

See `backend/app/vision/models/STOCK_COUNTER_MODEL_CARD.md` for full details.

### Demand Forecasting

Prophet + LightGBM ensemble model that generates per-facility stock forecasts.

- **Inputs:** historical stock levels, doses administered, coverage rates, seasonality signals
- **Output:** forecast quantities per SKU per facility with confidence intervals
- **Training:** `backend/app/ml/forecaster.py` + `training.py`
- **Experiment tracking:** MLflow

---

## Integrations

| System | Type | Description |
|---|---|---|
| **DHIS2** | REST (Basic Auth / PAT) | Facility hierarchy, stock data values, immunisation indicators, cold chain equipment |
| **mSupply** | REST | Stock transactions and LMIS data |
| **OpenLMIS** | REST | Requisitions, stock cards, and supply plan data |
| **FHIR R4** | HTTP (SMART on FHIR) | Patient and immunisation records |

All connectors implement the `ExternalDataSource` abstract interface (`backend/app/integrations/`), enabling adapter-pattern extensibility. Sync runs incrementally using high-watermark timestamps.

See `docs/dhis2-integration.md` for DHIS2 architecture details.

---

## Security & Compliance

- **HIPAA safeguards:** `PhiAuditMiddleware` logs all PHI field access; `HttpsEnforcementMiddleware` enforces TLS in staging/production.
- **Authentication:** JWT with short-lived access tokens (30 min) and rotating refresh tokens (7 days).
- **RBAC:** Role-based access control at the route level (`backend/app/core/rbac.py`).
- **Secrets management:** All secrets via environment variables; never committed to git. KMS encryption at rest for data lake.
- **No hardcoded credentials:** All service URLs and credentials are environment-variable driven.

---

## Contributing

1. Branch off `develop` — use `feat/`, `fix/`, or `chore/` prefixes.
2. Run `ruff check app/ && ruff format app/` before committing.
3. Add or update tests for any changed business logic.
4. Open a PR targeting `develop`; CI must pass before review.
5. All merges to `main` trigger a staging deploy.
