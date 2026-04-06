###############################################################################
# ALB + ACM Module — stable HTTPS endpoint for api.vaxaivision.com
#
# Creates:
#   • Security group for the ALB (inbound 80 + 443)
#   • Security group rule opening ECS container port from ALB SG
#   • ACM certificate with DNS validation
#   • Internet-facing Application Load Balancer
#   • Target group (IP-mode for ECS Fargate)
#   • HTTP → HTTPS redirect listener
#   • HTTPS listener forwarding to the target group
#   • Optional Route 53 alias record
###############################################################################

# ─── Security group: ALB ─────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "vaxai-${var.environment}-alb"
  description = "VaxAI ALB — allow inbound HTTP/HTTPS"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "vaxai-${var.environment}-alb" }
}

# ─── Allow ALB → ECS on container port ───────────────────────────────────────
# Only created when caller supplies the ECS security group ID.

resource "aws_security_group_rule" "ecs_from_alb" {
  count = var.ecs_security_group_id != null ? 1 : 0

  type                     = "ingress"
  from_port                = var.container_port
  to_port                  = var.container_port
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = var.ecs_security_group_id
  description              = "Allow ALB to reach ECS on port ${var.container_port}"
}

# ─── ACM certificate ─────────────────────────────────────────────────────────

resource "aws_acm_certificate" "api" {
  domain_name       = var.certificate_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "vaxai-${var.environment}-api" }
}

# ─── Route 53 DNS validation records ─────────────────────────────────────────
# Created only when a hosted zone ID is supplied.

resource "aws_route53_record" "cert_validation" {
  for_each = var.route53_zone_id != "" ? {
    for dvo in aws_acm_certificate.api.domain_validation_options :
    dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  allow_overwrite = true
  zone_id         = var.route53_zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
}

resource "aws_acm_certificate_validation" "api" {
  count = var.route53_zone_id != "" ? 1 : 0

  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

# ─── Application Load Balancer ───────────────────────────────────────────────

resource "aws_lb" "api" {
  name               = "vaxai-${var.environment}-api"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.deletion_protection

  access_logs {
    bucket  = "vaxai-${var.environment}-alb-logs"
    prefix  = "api-alb"
    enabled = false   # enable once the S3 log bucket exists
  }

  tags = { Name = "vaxai-${var.environment}-api" }
}

# ─── Target group ────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "api" {
  name        = "vaxai-${var.environment}-api"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"   # required for ECS Fargate awsvpc networking

  health_check {
    path                = var.health_check_path
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = { Name = "vaxai-${var.environment}-api" }

  lifecycle {
    create_before_destroy = true
  }
}

# ─── Listeners ───────────────────────────────────────────────────────────────

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  depends_on = [aws_acm_certificate_validation.api]
}

# ─── Optional Route 53 alias record: api.vaxaivision.com → ALB ───────────────

resource "aws_route53_record" "api" {
  count = var.route53_zone_id != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.certificate_domain
  type    = "A"

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}
