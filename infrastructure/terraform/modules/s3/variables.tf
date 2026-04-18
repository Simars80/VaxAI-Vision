variable "environment" { type = string }

variable "kms_key_arn" {
  description = "ARN of the KMS CMK for S3 server-side encryption (HIPAA)"
  type        = string
}
