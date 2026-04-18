###############################################################################
# KMS Customer-Managed Key Module
# HIPAA § 164.312(a)(2)(iv) — Encryption and Decryption
# Creates a single CMK per environment used for RDS, S3, and Secrets Manager.
###############################################################################

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "vaxai" {
  description             = "VaxAI Vision ${var.environment} CMK — PHI encryption"
  deletion_window_in_days = var.environment == "prod" ? 30 : 7
  enable_key_rotation     = true   # Required for HIPAA

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS Service"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:CreateGrant",
          "kms:DescribeKey",
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow S3 Service"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey",
        ]
        Resource = "*"
      },
    ]
  })

  tags = {
    Name        = "vaxai-${var.environment}-cmk"
    HIPAAScope  = "phi-encryption"
    Environment = var.environment
  }
}

resource "aws_kms_alias" "vaxai" {
  name          = "alias/vaxai-${var.environment}"
  target_key_id = aws_kms_key.vaxai.key_id
}
