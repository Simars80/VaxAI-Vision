output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.api.arn
}

output "alb_dns_name" {
  description = "DNS name of the ALB (use for CNAME if Route 53 is managed externally)"
  value       = aws_lb.api.dns_name
}

output "alb_zone_id" {
  description = "Canonical hosted zone ID of the ALB (for Route 53 alias records)"
  value       = aws_lb.api.zone_id
}

output "target_group_arn" {
  description = "ARN of the ALB target group — attach ECS service to this"
  value       = aws_lb_target_group.api.arn
}

output "https_listener_arn" {
  description = "ARN of the HTTPS (443) listener"
  value       = aws_lb_listener.https.arn
}

output "alb_security_group_id" {
  description = "Security group ID of the ALB"
  value       = aws_security_group.alb.id
}

output "certificate_arn" {
  description = "ARN of the ACM certificate"
  value       = aws_acm_certificate.api.arn
}
