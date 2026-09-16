# Legal AI case assistant: research, architecture, and delivery plan

Date: 2026-09-15

This is an engineering design, not legal advice or a claim of regulatory compliance.

## Product interpretation

The requested product is a lawyer-only, case-scoped workspace:

- a lawyer connects an approved LLM account using their own API key;
- each conversation belongs to one case and may use structured client/case facts;
- only malware-clean case documents are extracted and retrieved;
- answers identify the source document and page for supporting context;
- uploaded PDF forms may be populated into a **draft for lawyer review** when their
  field technology is supported; and
- no AI action submits an application, signs for a client, changes source records, or
  represents that an IRCC form is complete or valid.

This is deliberately not an autonomous immigration adviser.

## Market research

Public product material establishes the expected baseline:

- [8am DocketWise](https://www.docketwise.com/) combines immigration case
  management, intake, forms, billing, and payments. Its public AI material describes
  document data capture into immigration workflows and plain-language access to firm
  data.
- [DocketWise IQ](https://www.docketwise.com/blog/docketwise-iq-legal-ai/) describes
  extracting names, dates, and document numbers from immigration documents and
  populating Smart Forms.
- [INSZoom](https://mitratech.com/products/inszoom/) advertises Canadian/global
  immigration case management, a forms library, automation, and a virtual assistant.
- [Clio's immigration product](https://www.clio.com/practice-types/immigration-law-software/)
  describes intake, retainer automation, secure document sharing, e-signatures, and
  form preparation through Clio Draft and immigration integrations.

The market therefore treats form automation and matter context as core workflows, not
standalone chat features. VisaTrack's differentiator should be transparent, case-bound
retrieval with bring-your-own-provider controls and explicit review gates.

## Provider and government-form constraints

Provider privacy is contractual, not guaranteed merely by using an API key:

- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
  state that eligible customers may obtain Zero Data Retention (ZDR), with endpoint and
  feature limitations. This design uses stateless requests with `store=false` and does
  not create provider-hosted files, threads, or vector stores. `store=false` disables
  Responses application-state storage; it does **not** by itself disable provider abuse
  monitoring retention or establish ZDR.
- [Anthropic API retention](https://docs.anthropic.com/en/docs/build-with-claude/zero-data-retention)
  states that ZDR is an organization-level arrangement for qualified customers. Model
  and feature exceptions may apply.

VisaTrack cannot inspect the customer's provider contract. Connection setup therefore
requires an acknowledgement that the firm approved the provider, region, retention,
and data-processing terms.

IRCC explains that some official PDFs use special encoding, Adobe JavaScript
validation, and 2D barcodes:

- [IRCC 2D barcode form instructions](https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1523&top=4)
- [IRCC validation troubleshooting](https://www.ircc.canada.ca/english/helpcentre/answer.asp?qnum=767&top=18)
- [IRCC upload validation guidance](https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1312)

The MVP supports standard AcroForm text and choice fields. It rejects XFA-only,
fieldless, and already-signed PDFs rather than flattening, forging, or corrupting them.
Every generated page carries a visible AI review-draft annotation. A generated draft
must be opened in current Adobe
Acrobat Reader, reviewed against source evidence, completed where unresolved, and
validated using the form's official controls. VisaTrack does not generate IRCC
barcodes or submit forms.

## Trust boundaries and data flow

```text
Lawyer browser
  -> VisaTrack API (session, active lawyer/admin role, tenant + case relationship)
     -> PostgreSQL (encrypted provider credential, chats, messages, text chunks)
     -> S3 clean prefix (source documents and generated form drafts)
     -> selected provider API (minimum retrieved excerpts + structured case facts)

S3 quarantine -> ClamAV worker -> S3 clean -> local text extraction worker
```

Provider keys are encrypted with a dedicated application secret and adding/replacing
one requires the lawyer's current password plus MFA when enabled. They are never
returned after creation, written to logs, included in audit payloads, or sent to the
frontend. Model API hosts are fixed in code; users cannot provide a URL, preventing
server-side request forgery.

## Threat model and controls

| Threat | Control |
| --- | --- |
| Cross-tenant/client disclosure | Every query binds organization, case, lawyer assignment, and chat owner; rollout is organization-allowlisted |
| Quarantined document exposure | Indexing requires `scan_status='clean'`; downloads use existing clean gate |
| Prompt injection in documents | Document/template text is escaped and delimited as untrusted evidence; the model has no tools or mutation authority; red-team testing remains required |
| Hallucinated facts | Source labels/page citations, explicit uncertainty instruction, retrieved context only |
| Provider credential theft | Dedicated Fernet key, write-only API, masked display, revocation/delete endpoint |
| Provider retention/training | Firm acknowledgement, stateless APIs, OpenAI `store=false`, no provider file/vector stores |
| Excessive disclosure/cost | Matching chunks only, query-selected structured fields, bounded context/output, fixed providers, atomic attempt quota |
| Unauthorized mutation | `ai:use` permission plus legal-staff role; chat has no write tools; form generation is a separate explicit endpoint |
| Form corruption or silent submission | AcroForm-only support, output marked draft, unresolved fields and field-level evidence returned, no submit/sign action |
| Document deletion/legal hold | Final storage purge deletes extracted chunks and derived drafts; cited legal holds block derived-draft purge |

Document text and model output remain untrusted content. Rendering uses ordinary React
text nodes, not raw HTML.

## MVP architecture

### Storage

- `ai_provider_connections`: per-user BYOK provider, encrypted key, selected model,
  approval acknowledgement, and last verification time.
- `ai_chats`: organization/case/creator-bound conversation metadata.
- `ai_chat_messages`: user/assistant messages, citations, model/provider, and token
  usage where returned, plus the prompt-policy version and complete source-disclosure
  manifest used for legal-hold/audit decisions. Monotonic sequence numbers and a
  single in-flight turn prevent chronology ambiguity.
- `ai_document_chunks`: page-aware extracted text tied to a clean `case_document`.
- `ai_form_drafts`: immutable source document reference, generated clean S3 key,
  source hash, populated-field evidence, citations, unresolved fields, model/provider,
  prompt-policy version, creator, review note/status, and Adobe-validation attestation.
- `ai_usage_events`: atomic, idempotent request reservations, completion state, model,
  and token counts without prompt content.

### Retrieval

The first release uses PostgreSQL full-text ranking. This keeps document text inside the
existing controlled database and avoids sending every document to a separate embedding
provider. It can later be replaced with hybrid `pgvector` retrieval after an embedding
model, residency, deletion, and re-indexing policy is approved.

### Supported providers

- OpenAI Responses API with `store=false`
- Anthropic Messages API

Model discovery calls each provider's model-list endpoint using the stored credential.
The ranking is a recommendation based on model naming and recency, not an objective
capability or privacy guarantee. The top recommendation is pinned when a key is
connected. VisaTrack never silently replaces a pinned model: retirement requires an
explicit lawyer selection, preserving the firm's ZDR, processing-region, latency, and
cost decision. Production discovery is intersected with an operator-managed exact-model
allowlist, and each AI request names the provider explicitly. There is no
arbitrary OpenAI-compatible endpoint in the MVP.

### Form drafts

The lawyer uploads an official PDF into the existing quarantine/scanning flow or
selects a clean PDF already attached to the case. VisaTrack reads AcroForm
field names, verifies the exact template SHA-256 against the deployment allowlist, asks
the selected model for a strict field mapping grounded in case context, discards
unknown or unsupported values, fills a copied PDF, stores it under the clean
derived-artifact prefix, and returns every unfilled field plus a short-lived download
URL. Form drafting has a separate feature flag from chat.

## Delivery phases

1. **MVP in this change:** encrypted BYOK, model discovery, clean-document indexing,
   case chat with citations, AcroForm draft generation, lawyer UI, audit events, tests,
   and operating documentation.
2. **Controlled pilot:** approved provider contracts/ZDR, synthetic-case evaluation,
   prompt-injection red team, citation accuracy scoring, cost/rate limits, retention
   approval, and a small set of explicitly tested IRCC forms.
3. **Production expansion:** OCR for image-only documents, hybrid retrieval,
   organization-level key management, granular AI permissions, form-specific schemas,
   bilingual evaluation, usage budgets, and e-sign integration if separately approved.

Out of scope: legal conclusions without evidence, autonomous case changes, government
portal login/submission, signature, IRCC validation/barcode generation, web browsing,
and training models on customer data.
