variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for the ALB"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID of the ECS Fargate tasks (will receive ingress from ALB)"
  type        = string
  default     = null
}

variable "container_port" {
  description = "Port the backend container listens on"
  type        = number
  default     = 8000
}

variable "health_check_path" {
  description = "HTTP path for the ALB target group health check"
  type        = string
  default     = "/health"
}

variable "certificate_domain" {
  description = "Domain name for the ACM certificate (e.g. api.vaxaivision.com)"
  type        = string
  default     = "api.vaxaivision.com"
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID for api.vaxaivision.com. If empty, no DNS record is created."
  type        = string
  default     = ""
}

variable "deletion_protection" {
  description = "Enable ALB deletion protection"
  type        = bool
  default     = false
}
