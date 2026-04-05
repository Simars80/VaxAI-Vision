output "key_arn" {
  description = "ARN of the VaxAI CMK"
  value       = aws_kms_key.vaxai.arn
}

output "key_id" {
  description = "ID of the VaxAI CMK"
  value       = aws_kms_key.vaxai.key_id
}
