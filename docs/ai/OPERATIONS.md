# Legal AI assistant operations

## Required configuration

```dotenv
AI_PROVIDER_ENCRYPTION_KEY=<independent random secret>
AI_ENABLED=false
AI_REQUEST_TIMEOUT_SECONDS=60
AI_MAX_DOCUMENT_CHARS=500000
AI_MAX_CONTEXT_CHUNKS=8
AI_MAX_HISTORY_MESSAGES=12
AI_MAX_REQUESTS_PER_HOUR=60
```

`AI_PROVIDER_ENCRYPTION_KEY` must not equal the JWT or MFA keys. Back it up in the
production secret manager: losing it makes stored BYOK credentials unreadable. Rotation
requires a controlled decrypt/re-encrypt migration; changing it in place is not a
rotation procedure.

Keep `AI_ENABLED=false` through deployment and synthetic-case validation. Enable it
only after the provider/privacy approvals and pilot controls below are recorded.

The existing API and document worker deployments must run the same release. Apply
Alembic migrations before starting the new worker code.

## Provider setup

Each lawyer or administrator connects their own OpenAI or Anthropic API key from a case
AI Assistant. VisaTrack verifies the key by listing available models and stores only an
encrypted credential plus its last four-character hint. VisaTrack initially selects the
strongest full-size general-purpose model returned for that key. The lawyer must override
that recommendation when the model is not approved for the firm's retention, residency,
cost, or latency requirements; “strongest” is a capability recommendation, not a privacy
approval.

Adding or replacing a provider key requires the current VisaTrack password and an MFA
or recovery code when MFA is enabled. AI routes additionally require the `ai:use`
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
`index_ai_document`. Extraction occurs locally:

- text PDFs: page-aware extraction, maximum 250 pages;
- DOCX: paragraph extraction;
- image-only PDFs and images: skipped with an audit event because OCR is not in the MVP;
- maximum extracted characters: `AI_MAX_DOCUMENT_CHARS`.

The lawyer may use **Refresh document index** for clean documents uploaded before this
feature was deployed. Monitor failed/retry `background_jobs` and `ai_index_skipped`
audit events. A clean antivirus result does not make document text trustworthy; the
assistant continues to delimit it as untrusted evidence.

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

Pilot each exact form and revision with synthetic data. Generated files are review
drafts only. The MVP fills AcroForm text and choice fields; it does not populate
signature controls. Official IRCC forms may require Adobe JavaScript validation and barcode
generation that pypdf cannot execute. Lawyers must download the draft, verify every
field, resolve omissions, and use current Adobe Acrobat Reader and the official guide.
Never upload a generated draft to IRCC without that review and validation.
