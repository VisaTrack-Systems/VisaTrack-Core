# Privacy data inventory and retention draft

This is an engineering inventory, not legal advice. Privacy counsel and product owners
must approve purposes, lawful bases, notices, residency, and retention periods.

| Data class | Representative storage | Sensitivity | Draft retention trigger |
| --- | --- | --- | --- |
| Identity/contact | `users`, `user_profiles` | High | account/case closure plus approved legal period |
| Immigration case | `cases`, milestones, custom fields | Very high | matter closure plus professional-obligation period |
| Documents | S3 + `case_documents` | Very high | matter closure; blocked by legal hold |
| Financial/trust | invoices, payments, trust entries | Very high | statutory/accounting period |
| Authentication | sessions, MFA recovery hashes, login events | High | short operational/security period |
| Audit/security | activity, document access, immutable archive | High | approved compliance period |
| Support | bug reports and screenshots | Potentially very high | triage resolution plus short support period |
| Backups | RDS snapshots, S3 versions | Same as source | backup lifecycle and legal holds |

## Subprocessors requiring contractual review

- AWS: compute, RDS, S3, KMS, logging and backup regions.
- Resend: invitation/support email addresses and message content.
- Vercel: frontend request and deployment metadata.
- GitHub: source, CI logs, and issue/support content.
- Any monitoring, SIEM, error tracking, or support vendor enabled in production.

## Required subject-rights workflows

- authenticated access/export with tenant and relationship checks
- correction request and audit trail
- deletion request with legal-hold and professional-record exceptions
- machine-readable document manifest without exposing internal legal notes
- completion evidence across primary data, object storage, logs, and backup lifecycle

## Approval record

Before production, attach:

- qualified Canadian privacy/legal review
- privacy impact assessment
- approved privacy notice and customer terms/DPA
- residency and cross-border transfer assessment
- subprocessor register and notification procedure
- approved retention schedule and legal-hold authority
- breach response and notification decision tree
- completed access/deletion exercise using synthetic data

Engineering must not claim compliance until these approvals and exercises exist.
