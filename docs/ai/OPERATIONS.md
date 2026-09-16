# Legal AI assistant operations

## Required configuration

```dotenv
AI_PROVIDER_ENCRYPTION_KEY=<independent random secret>
AI_PROVIDER_ENCRYPTION_KEY_PREVIOUS=
AI_ENABLED=false
AI_ENABLED_ORGANIZATION_IDS=<approved organization UUIDs>
AI_ALLOWED_MODELS=openai:<approved-model>,anthropic:<approved-model>
AI_REQUIRE_MFA_FOR_KEYS=true
AI_FORM_DRAFTS_ENABLED=false
AI_APPROVED_FORM_SHA256=<comma-separated approved template hashes>
AI_REQUEST_TIMEOUT_SECONDS=60
AI_MAX_DOCUMENT_CHARS=500000
AI_MAX_CONTEXT_CHUNKS=8
AI_MAX_HISTORY_MESSAGES=12
AI_MAX_HISTORY_CHARS=40000
AI_MAX_REQUESTS_PER_HOUR=60
AI_MAX_REINDEX_DOCUMENTS=100
```

`AI_PROVIDER_ENCRYPTION_KEY` must not equal the JWT or MFA keys. Back it up in the
production secret manager, use at least 32 random bytes, and never derive it from another
application secret: losing it makes stored BYOK credentials unreadable.

Rotate it without downtime:

1. set the new value as `AI_PROVIDER_ENCRYPTION_KEY`;
2. temporarily place the old value in `AI_PROVIDER_ENCRYPTION_KEY_PREVIOUS`;
3. deploy the API and worker everywhere;
4. run `python scripts/rotate_ai_provider_keys.py` once from the backend release;
5. verify provider connections; then remove the previous key and redeploy.

Never place authentication/MFA keys in the previous-key list. The script emits one
audit event per re-encrypted connection and never prints plaintext keys.

Keep `AI_ENABLED=false` through deployment and synthetic-case validation.
Production startup requires an explicit `AI_ENABLED_ORGANIZATION_IDS` allowlist so a
pilot cannot expose every tenant accidentally. Use `*` only after broad rollout approval.
`AI_ALLOWED_MODELS` limits provider discovery and selection to exact models approved for
retention, residency, quality, and cost policy; models omitted from the list cannot be
connected or selected.
`AI_FORM_DRAFTS_ENABLED` is a second, stricter gate and must remain false until every
accepted PDF revision is hashed and listed in `AI_APPROVED_FORM_SHA256`. Production
startup rejects AI key management without MFA and rejects form drafting without an
approved hash list.

The existing API and document worker deployments must run the same release. Apply
Alembic migrations before starting the new worker code.

## Provider setup

Each lawyer or administrator connects their own OpenAI or Anthropic API key from a case
AI Assistant. VisaTrack verifies the key by listing available models and stores only an
encrypted credential plus its last four-character hint. The current recommendation is
pinned when the connection is created. A retired pin fails closed and requires an
explicit replacement; VisaTrack does not silently move confidential data to a newly
released model. “Recommended” is a name/recency heuristic, not a capability, retention,
residency, or privacy approval.

Adding or replacing a provider key requires the current VisaTrack password and MFA or a
single-use recovery code. AI routes additionally require the `ai:use`
permission on an active lawyer, organization-admin, or super-admin role.

Before pilot use, the firm must:

1. approve the provider contract, subprocessor terms, processing region, retention, and
   model-training controls;
2. obtain and verify ZDR or equivalent controls if required by policy;
3. set provider-side spend limits and alerts;
4. restrict provider-account access and require MFA; and
5. use synthetic cases for acceptance and red-team testing.

VisaTrack does not verify a customer's contractual privacy settings.

## Document indexing

After ClamAV promotes a document to the clean S3 prefix, the worker queues
`index_ai_document` only while `AI_ENABLED=true`. The index worker independently checks
the feature flag, clean scan state, and clean S3 prefix before reading. Extraction
occurs locally:

- text PDFs: page-aware extraction, maximum 250 pages;
- DOCX: paragraph extraction;
- image-only PDFs and images: skipped with an audit event because OCR is not in the MVP;
- maximum extracted characters: `AI_MAX_DOCUMENT_CHARS`.

The lawyer may use **Refresh document index** for clean documents uploaded before this
feature was deployed. Manual refresh is capped by `AI_MAX_REINDEX_DOCUMENTS` and
deduplicated per document/hour. Retrieval sends only chunks matching the question; it
does not fill unused context capacity with unrelated recent chunks. Monitor failed/retry
`background_jobs` and `ai_index_skipped` audit events. A clean antivirus result does not
make document text trustworthy; the assistant escapes and delimits it as untrusted
evidence.

When a deleted document reaches its approved purge date, the purge worker also deletes
its extracted chunks and any derived form that used it as template or cited evidence.
A legal hold on a template or cited document blocks the affected derived-form purge.
Chat/message retention remains a
separate matter-record decision and must be included in the approved retention schedule.

## Usage control and idempotency

Chat and form calls require an `Idempotency-Key`. The API atomically reserves an
`ai_usage_events` row under a per-user PostgreSQL advisory lock before contacting the
provider. Failed attempts count toward the hourly limit, preventing retries and
concurrent requests from bypassing the cost control. The table stores request type,
provider/model, status, token counts, and only a SHA-256 of the idempotency key—not
prompts or responses.

Alert on `started` rows older than the request timeout, failure-rate spikes, and hourly
usage approaching the configured limit. Provider-side hard spend limits remain required
because a local request limit is not a financial guarantee.

## Monitoring and incident response

Alert on:

- provider authentication failures and unusual request volume;
- repeated hourly quota responses;
- worker failures or a growing document-index queue;
- form-mapping failures and unsupported XFA forms;
- unexpected provider/model changes; and
- abnormal token costs in provider dashboards.

For a suspected provider-key compromise, revoke the key at the provider, disconnect it
in VisaTrack, review immutable audit events, and create a replacement key only after
the provider account is secured.

For a suspected cross-case disclosure, disable the AI feature at deployment level,
preserve logs/audit records under incident procedure, revoke affected keys, and perform
the approved privacy/breach assessment.

## PDF form acceptance

Pilot each exact form and revision with synthetic data. Record the lowercase SHA-256:

```bash
sha256sum path/to/approved-blank-form.pdf
```

Add only reviewed hashes to `AI_APPROVED_FORM_SHA256`; any other revision fails closed.
Generated files are review drafts only. The MVP fills AcroForm text and choice fields;
values must appear in a model-cited source, choice values must match the PDF options,
every unfilled supported field is reported as unresolved, and unsupported controls are
listed for manual completion. It does not populate signature controls. Official IRCC
forms may require Adobe JavaScript validation and
barcode generation that pypdf cannot execute. Lawyers must download the draft, verify
every field, resolve omissions, and use current Adobe Acrobat Reader and the official
guide. Never upload a generated draft to IRCC without that review and validation.

## Rollout and rollback

1. Deploy the migration while both AI feature flags remain false.
2. Deploy the API and worker from the same commit; verify migrations and worker health.
3. Complete the gates in `PRODUCTION_READINESS.md` with synthetic data.
4. Enable chat for one approved organization and monitor usage/provider failures.
5. Enable form drafts only after exact template hashes and Adobe checks are recorded.

Emergency rollback is configuration-first: set `AI_FORM_DRAFTS_ENABLED=false`, then
`AI_ENABLED=false`, restart API and workers, and preserve usage/audit records. Disabling
AI stops new indexing and provider calls; it does not erase existing matter records.
