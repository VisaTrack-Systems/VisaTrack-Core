# Document security, retention, and audit export

## Upload lifecycle

1. The API presigns uploads only under the configured `quarantine/` prefix.
2. Upload completion records the document as `pending`/`scanning`, disables download,
   and enqueues an idempotent `scan_document` job.
3. A worker downloads the object to a bounded temporary file, verifies its file
   signature, and runs the configured ClamAV-compatible scanner.
4. Clean files are copied to `clean/` with KMS encryption and the quarantined object is
   deleted. Only then can the API issue view or download URLs.
5. Invalid or infected files are deleted, rejected, and retained as audit metadata only.
   Scanner failures remain unavailable and retry through the durable job queue.

Run a worker separately from the API:

```bash
python -m app.workers.main
```

The worker image/host must include a maintained ClamAV engine and current signatures.
`DOCUMENT_SCANNER_COMMAND` may point to a compatible wrapper. Deployments must alarm on
failed jobs, old pending jobs, and stale signature versions.

## S3 controls required in production

- Block all public access.
- Require the configured KMS key in bucket policy.
- Permit the API role to write only to `quarantine/`.
- Permit the worker role to read/delete `quarantine/` and write `clean/`.
- Enable versioning, access logging, lifecycle rules, and storage-growth alarms.
- Use a distinct `AUDIT_ARCHIVE_BUCKET` with Object Lock enabled at bucket creation.

The application fails startup outside local/test environments when the document bucket,
KMS key, or audit archive bucket is missing.

## Retention and legal hold

Soft-deleted files receive `retention_delete_after` and an idempotent purge job. The
worker refuses purge while `legal_hold=true` and records `storage_purged_at` after S3
deletion. `DOCUMENT_RETENTION_DAYS` is a technical default only; legal/privacy owners
must approve the production period before deployment.

## Audit integrity

Database triggers reject updates and deletes from `activity_log` and
`document_access_log`. Every new event is also written transactionally to
`audit_outbox`. The worker exports normalized JSON to the audit bucket using KMS and S3
Object Lock `COMPLIANCE` retention.

Application-level immutability does not protect against a PostgreSQL superuser or cloud
account compromise. Production controls must also restrict DBA/IAM access, monitor
Object Lock configuration, and route export failures to the on-call system.

Never place passwords, bearer/refresh/invitation tokens, cookies, or MFA secrets in event
fields. The audit service recursively redacts recognized credential keys.
