###############################################################################
# S3 Data Lake Module
# HIPAA § 164.312(e)(1) — Transmission Security (deny HTTP, enforce TLS)
# HIPAA § 164.312(a)(2)(iv) — Encryption at rest via CMK
###############################################################################

locals {
  buckets = {
    raw       = "vaxai-${var.environment}-raw-data"
    processed = "vaxai-${var.environment}-processed-data"
    models    = "vaxai-${var.environment}-model-artifacts"
    reports   = "vaxai-${var.environment}-reports"
    logs      = "vaxai-${var.environment}-app-logs"
  }
}

# ─── Bucket resources ─────────────────────────────────────────────────────────
resource "aws_s3_bucket" "buckets" {
  for_each = local.buckets
  bucket   = each.value
  tags     = { Role = each.key }
}

resource "aws_s3_bucket_versioning" "models" {
  bucket = aws_s3_bucket.buckets["models"].id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "all" {
  for_each = aws_s3_bucket.buckets
  bucket   = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn   # Customer-managed key (HIPAA)
    }
    bucket_key_enabled = true
  }
}

# ─── HIPAA: Deny non-TLS access to all buckets ───────────────────────────────
resource "aws_s3_bucket_policy" "deny_http" {
  for_each = aws_s3_bucket.buckets
  bucket   = each.value.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          each.value.arn,
          "${each.value.arn}/*",
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

resource "aws_s3_bucket_public_access_block" "all" {
  for_each                = aws_s3_bucket.buckets
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── Lifecycle: expire raw data after 1 year ──────────────────────────────────
resource "aws_s3_bucket_lifecycle_configuration" "raw" {
  bucket = aws_s3_bucket.buckets["raw"].id

  rule {
    id     = "expire-raw-after-1-year"
    status = "Enabled"
    filter { prefix = "" }
    expiration { days = 365 }
    noncurrent_version_expiration { noncurrent_days = 30 }
  }
}

# ─── IAM: data pipeline service role ─────────────────────────────────────────
data "aws_iam_policy_document" "pipeline_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com", "ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "data_pipeline" {
  name               = "vaxai-${var.environment}-data-pipeline"
  assume_role_policy = data.aws_iam_policy_document.pipeline_assume.json
}

data "aws_iam_policy_document" "data_lake_access" {
  statement {
    sid     = "S3BucketList"
    effect  = "Allow"
    actions = ["s3:ListBucket"]
    resources = [for b in aws_s3_bucket.buckets : b.arn]
  }

  statement {
    sid    = "S3ObjectReadWrite"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObjectVersion",
    ]
    resources = [for b in aws_s3_bucket.buckets : "${b.arn}/*"]
  }
}

resource "aws_iam_role_policy" "data_lake_access" {
  name   = "data-lake-access"
  role   = aws_iam_role.data_pipeline.id
  policy = data.aws_iam_policy_document.data_lake_access.json
}

# ─── IAM: read-only role for BI / dashboards ──────────────────────────────────
resource "aws_iam_role" "bi_readonly" {
  name               = "vaxai-${var.environment}-bi-readonly"
  assume_role_policy = data.aws_iam_policy_document.pipeline_assume.json
}

data "aws_iam_policy_document" "bi_readonly" {
  statement {
    effect  = "Allow"
    actions = ["s3:GetObject", "s3:ListBucket"]
    resources = [
      aws_s3_bucket.buckets["processed"].arn,
      "${aws_s3_bucket.buckets["processed"].arn}/*",
      aws_s3_bucket.buckets["reports"].arn,
      "${aws_s3_bucket.buckets["reports"].arn}/*",
    ]
  }
}

resource "aws_iam_role_policy" "bi_readonly" {
  name   = "bi-readonly"
  role   = aws_iam_role.bi_readonly.id
  policy = data.aws_iam_policy_document.bi_readonly.json
}
