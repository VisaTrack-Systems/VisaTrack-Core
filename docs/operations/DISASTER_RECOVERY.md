# Disaster recovery runbook

## Targets

RPO and RTO are product and legal decisions. Until approved, the engineering proposal is:

- PostgreSQL RPO: 5 minutes using point-in-time recovery.
- PostgreSQL RTO: 2 hours.
- Documents RPO: 15 minutes using versioning and cross-region replication.
- Documents RTO: 4 hours.

## Database restore drill

1. Open an incident record and identify the approved recovery timestamp.
2. Restore RDS to an isolated subnet/security group; never overwrite the source.
3. Run `alembic current --check-heads`.
4. Validate tenant counts, foreign-key integrity, recent cases, session revocation state,
   background jobs, and audit outbox continuity.
5. Point a non-production API task at the restored database and run smoke/E2E tests.
6. Record actual RPO/RTO, data gaps, logs, approvers, and cleanup.

## Document recovery drill

1. Select synthetic documents with known versions and checksums.
2. Restore deleted/noncurrent versions to an isolated recovery prefix.
3. Re-run signature and malware scanning before promotion.
4. Verify KMS decrypt permissions, legal holds, metadata, and audit events.
5. Record elapsed time, missing versions, replication lag, and evidence.

## Rollback

- Application rollback must use the previous signed image digest.
- Database migrations are forward-only in production unless a tested downgrade is
  explicitly approved. Restore from snapshot/PITR for destructive migration failures.
- Never bypass document quarantine or audit export to recover availability.

Run both drills at least twice yearly and after material database/storage architecture
changes. A checklist without a completed drill record does not satisfy this control.
