#!/usr/bin/env bash
# LocalStack init script — runs once on container startup
# Creates the S3 data lake bucket structure and IAM policies for local dev.

set -euo pipefail

AWS="aws --endpoint-url=http://localhost:4566 --region us-east-1 --no-cli-pager"

echo "==> VaxAI Vision: initializing LocalStack S3 data lake..."

# ─── Buckets ──────────────────────────────────────────────────────────────────
# Raw landing zone — unprocessed LMIS / partner data
$AWS s3api create-bucket --bucket vaxai-raw-data || true

# Processed / cleaned data
$AWS s3api create-bucket --bucket vaxai-processed-data || true

# ML model artifacts (trained models, predictions)
$AWS s3api create-bucket --bucket vaxai-model-artifacts || true

# Reports and exports for dashboards
$AWS s3api create-bucket --bucket vaxai-reports || true

# Application logs (structured JSON)
$AWS s3api create-bucket --bucket vaxai-app-logs || true

# ─── Folder structure (placeholder objects) ───────────────────────────────────
# raw/
for prefix in inventory_snapshots demand_reports facility_data external_feeds; do
    $AWS s3api put-object --bucket vaxai-raw-data --key "${prefix}/.keep" --body /dev/null
done

# processed/
for prefix in inventory demand_forecasts alerts geospatial; do
    $AWS s3api put-object --bucket vaxai-processed-data --key "${prefix}/.keep" --body /dev/null
done

# model-artifacts/
for prefix in forecast anomaly_detection optimization; do
    $AWS s3api put-object --bucket vaxai-model-artifacts --key "${prefix}/.keep" --body /dev/null
done

# ─── Bucket versioning on model artifacts ─────────────────────────────────────
$AWS s3api put-bucket-versioning \
    --bucket vaxai-model-artifacts \
    --versioning-configuration Status=Enabled

# ─── Lifecycle policy on raw bucket (expire after 365 days) ──────────────────
$AWS s3api put-bucket-lifecycle-configuration \
    --bucket vaxai-raw-data \
    --lifecycle-configuration '{
        "Rules": [{
            "ID": "expire-raw-after-1-year",
            "Status": "Enabled",
            "Filter": {"Prefix": ""},
            "Expiration": {"Days": 365}
        }]
    }'

# ─── IAM: service role for data pipeline ─────────────────────────────────────
$AWS iam create-role \
    --role-name vaxai-data-pipeline-role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "lambda.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }' || true

$AWS iam put-role-policy \
    --role-name vaxai-data-pipeline-role \
    --policy-name vaxai-s3-data-lake-access \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": ["s3:GetObject","s3:PutObject","s3:DeleteObject"],
                "Resource": [
                    "arn:aws:s3:::vaxai-raw-data/*",
                    "arn:aws:s3:::vaxai-processed-data/*",
                    "arn:aws:s3:::vaxai-model-artifacts/*",
                    "arn:aws:s3:::vaxai-reports/*",
                    "arn:aws:s3:::vaxai-app-logs/*"
                ]
            },
            {
                "Effect": "Allow",
                "Action": ["s3:ListBucket"],
                "Resource": [
                    "arn:aws:s3:::vaxai-raw-data",
                    "arn:aws:s3:::vaxai-processed-data",
                    "arn:aws:s3:::vaxai-model-artifacts",
                    "arn:aws:s3:::vaxai-reports",
                    "arn:aws:s3:::vaxai-app-logs"
                ]
            }
        ]
    }' || true

echo "==> LocalStack S3 initialization complete."
$AWS s3 ls
