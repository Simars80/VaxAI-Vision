output "bucket_names"           { value = { for k, v in aws_s3_bucket.buckets : k => v.id } }
output "bucket_arns"            { value = { for k, v in aws_s3_bucket.buckets : k => v.arn } }
output "pipeline_role_arn"      { value = aws_iam_role.data_pipeline.arn }
output "bi_readonly_role_arn"   { value = aws_iam_role.bi_readonly.arn }
