###############################################################################
# VaxAI Vision — Core Data Infrastructure (Terraform)
# Provisions: RDS PostgreSQL, ElastiCache Redis, S3 Data Lake, IAM
###############################################################################

terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — update bucket/key before first apply
  backend "s3" {
    bucket         = "vaxai-terraform-state"
    key            = "infra/core/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "vaxai-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "VaxAI Vision"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ─── VPC (data reference — VPC provisioned separately) ───────────────────────
data "aws_vpc" "main" {
  tags = { Name = "vaxai-${var.environment}" }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  tags = { Tier = "private" }
}

# ─── Modules ──────────────────────────────────────────────────────────────────

# HIPAA: Customer-managed KMS key — must be provisioned before RDS and S3
module "kms" {
  source      = "./modules/kms"
  environment = var.environment
}

module "rds" {
  source      = "./modules/rds"
  environment = var.environment
  vpc_id      = data.aws_vpc.main.id
  subnet_ids  = data.aws_subnets.private.ids
  db_name     = var.db_name
  db_username = var.db_username
  db_password = var.db_password
  instance_class      = var.rds_instance_class
  allocated_storage   = var.rds_allocated_storage
  kms_key_arn         = module.kms.key_arn
}

module "redis" {
  source      = "./modules/redis"
  environment = var.environment
  vpc_id      = data.aws_vpc.main.id
  subnet_ids  = data.aws_subnets.private.ids
  node_type   = var.redis_node_type
  auth_token  = var.redis_auth_token
}

module "s3" {
  source      = "./modules/s3"
  environment = var.environment
  kms_key_arn = module.kms.key_arn
}
