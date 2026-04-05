###############################################################################
# ElastiCache Redis Module
###############################################################################

resource "aws_security_group" "redis" {
  name        = "vaxai-${var.environment}-redis"
  description = "VaxAI ElastiCache Redis access"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "Redis from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "vaxai-${var.environment}-redis" }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "vaxai-${var.environment}"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "vaxai-${var.environment}"
  description          = "VaxAI Vision Redis — ${var.environment}"

  node_type            = var.node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1
  port                 = 6379

  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  engine_version       = "7.2"
  parameter_group_name = "default.redis7"

  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                  = var.auth_token

  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled           = var.environment == "prod"

  # Session data TTL handled at application layer
  # Cache eviction policy configured via auth_token startup params

  snapshot_retention_limit = var.environment == "prod" ? 7 : 1
  snapshot_window          = "05:00-06:00"

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  tags = { Name = "vaxai-${var.environment}-redis" }
}

resource "aws_cloudwatch_log_group" "redis_slow" {
  name              = "/vaxai/${var.environment}/redis/slow-log"
  retention_in_days = 30
}
