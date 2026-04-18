variable "environment"        { type = string }
variable "vpc_id"             { type = string }
variable "subnet_ids"         { type = list(string) }
variable "db_name"            { type = string }
variable "db_username"        { type = string; sensitive = true }
variable "db_password"        { type = string; sensitive = true }
variable "instance_class"     { type = string }
variable "allocated_storage"  { type = number }
variable "kms_key_arn" {
  description = "ARN of the KMS CMK for RDS storage encryption (HIPAA)"
  type        = string
}
