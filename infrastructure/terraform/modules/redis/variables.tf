variable "environment"  { type = string }
variable "vpc_id"       { type = string }
variable "subnet_ids"   { type = list(string) }
variable "node_type"    { type = string }
variable "auth_token"   { type = string; sensitive = true }
