variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be dev, staging, or prod"
  }
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "vaxai_vision"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "vaxai"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "rds_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 50
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_auth_token" {
  description = "Redis AUTH token"
  type        = string
  sensitive   = true
}

# ─── ALB / API endpoint ───────────────────────────────────────────────────────

variable "api_domain" {
  description = "Public domain for the backend API (ACM certificate + optional Route 53 record)"
  type        = string
  default     = "api.vaxaivision.com"
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for api.vaxaivision.com. Leave empty to skip DNS record creation (manual CNAME required)."
  type        = string
  default     = ""
}

variable "backend_container_port" {
  description = "Port the ECS Fargate backend container listens on"
  type        = number
  default     = 8000
}

variable "backend_health_check_path" {
  description = "Health check path for the ALB target group"
  type        = string
  default     = "/health"
}
