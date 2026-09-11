# Production readiness and assurance gates

Code completion is not evidence that production controls work. A release handling real
immigration, identity, document, or financial data must attach evidence for every gate.

## Required technical evidence

- Empty PostgreSQL database migrated to Alembic head in CI.
- API and worker images built from the committed lockfiles and scanned.
- `/health/live` and `/health/ready` gate rollout; rollback is tested.
- S3 public-access block, KMS default encryption, versioning, lifecycle, and access logs
  verified from the target AWS account.
- Quarantine IAM denies API reads and denies users all direct access.
- Scanner detects EICAR in staging and clean documents become downloadable.
- Audit bucket has Object Lock COMPLIANCE mode and a successful exported event.
- RDS automated backups and point-in-time recovery are enabled.
- A database restore and S3 recovery drill meets approved RPO/RTO.
- Alert delivery reaches the named on-call owner.
- Browser E2E, automated accessibility, tenant-isolation, and dependency gates pass.
- An independent penetration test covers IDOR, tenant boundaries, sessions, MFA, upload
  handling, invitations, and privilege delegation.

## Initial SLO proposals

These require product/operations approval:

| Workflow | Proposed objective |
| --- | --- |
| API availability | 99.9% successful non-user-error requests per 30 days |
| API latency | 95% under 500 ms, excluding asynchronous exports |
| Document scan | 99% complete within 5 minutes |
| Invitation/reminder delivery | 99% accepted by provider within 10 minutes |
| Audit export | 99.99% exported to immutable storage within 5 minutes |

Alert on error-budget burn, database saturation, oldest job age, scan failures, stale
virus definitions, audit-export backlog, authentication failure spikes, privileged role
changes, and bulk downloads.

## Ownership record

Before release, record:

- release approver
- security approver
- privacy/legal approver
- on-call primary and escalation
- rollback owner
- restore-drill date and evidence link
- penetration-test report and remediation confirmation
- accepted residual risks and expiration dates
