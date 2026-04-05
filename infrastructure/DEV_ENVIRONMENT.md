# VaxAI Vision — Local Dev Data Environment

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) ≥ 4.x
- AWS CLI (for LocalStack interaction) — `brew install awscli`

## Quick Start

```bash
# From the infrastructure/ directory:
bash scripts/dev-up.sh
```

This starts PostgreSQL, Redis, LocalStack (S3), and Adminer, then runs all pending DB migrations.

## Services

| Service       | URL / Connection String                                           | Notes                     |
|---------------|-------------------------------------------------------------------|---------------------------|
| PostgreSQL    | `postgresql://vaxai:vaxai_dev_password@localhost:5432/vaxai_vision` | Main app database        |
| Redis         | `redis://:vaxai_redis_dev@localhost:6379`                         | Cache + session store     |
| LocalStack S3 | `http://localhost:4566`                                           | Local S3 emulation        |
| Adminer UI    | `http://localhost:8080`                                           | Web DB browser            |

## Environment Variables

Copy `infrastructure/.env.example` to `infrastructure/.env` and load it in your shell or app config.

```bash
cp .env.example .env
# Edit .env if needed
source .env   # or use dotenv in your app
```

## Database Migrations

Migrations use [Flyway](https://flywaydb.org/) via Docker (no local install required).

```bash
# Run pending migrations
bash scripts/migrate.sh migrate

# Show migration status
bash scripts/migrate.sh info

# Validate applied migrations
bash scripts/migrate.sh validate
```

Migration files live in `migrations/` and follow the naming convention:

```
V{VERSION}__{description}.sql
```

e.g. `V003__add_users_table.sql`

## S3 Data Lake Layout

| Bucket                    | Purpose                                   |
|---------------------------|-------------------------------------------|
| `vaxai-raw-data`          | Landing zone — raw LMIS / partner feeds   |
| `vaxai-processed-data`    | Cleaned & transformed datasets            |
| `vaxai-model-artifacts`   | Trained ML models & prediction outputs    |
| `vaxai-reports`           | Dashboard exports & generated reports     |
| `vaxai-app-logs`          | Structured application logs               |

In local dev these are created automatically in LocalStack. Configure your app's S3 client with `AWS_ENDPOINT_URL=http://localhost:4566`.

## Stopping the Stack

```bash
bash scripts/dev-down.sh
```

## Production (AWS)

See `terraform/` for Terraform modules that provision:

- **RDS PostgreSQL 16** (encrypted, multi-AZ in prod, Performance Insights enabled)
- **ElastiCache Redis 7** (TLS, AUTH token, automatic failover in prod)
- **S3 Data Lake** (KMS encryption, public-access blocked, versioning on model artifacts)
- **IAM Roles** — `data-pipeline-role` and `bi-readonly-role`

```bash
cd terraform/
terraform init
terraform workspace select dev   # or staging / prod
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```
