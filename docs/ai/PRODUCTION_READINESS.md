# Legal AI production-readiness gates

Date: 2026-09-16

Status: **not approved for production use**. The code is fail-closed with
`AI_ENABLED=false` and `AI_FORM_DRAFTS_ENABLED=false`. Passing CI is necessary but does
not establish legal, privacy, security, or professional-responsibility compliance.

## Release gates

| Gate | Required evidence | Blocking owner |
| --- | --- | --- |
| Tenant and case isolation | API tests plus an independent cross-tenant/IDOR assessment | Engineering/security |
| Provider approval | Executed DPA, subprocessor/region review, retention and training settings, model allowlist | Firm privacy/legal owner |
| Legal authority | Documented purpose and legal authority/consent for provider disclosure | Firm privacy/legal owner |
| Security assurance | Threat-model review, dependency scan, penetration test, prompt-injection red team | Security |
| Quality | Synthetic-case evaluation meeting the thresholds below | Product/legal practice owner |
| Form acceptance | Exact PDF hash, field-level expected results, Adobe validation/barcode check | Legal practice owner |
| Operations | Worker, usage, cost, error, and stale-request alerts exercised | Operations |
| Lifecycle | Deletion/legal-hold exercise covering DB, S3, logs, and backups | Privacy/operations |
| Recovery | Provider-key rotation and backup/restore drills | Security/operations |
| User governance | Lawyer training, acceptable-use policy, incident/escalation procedure | Firm administrator |

No operator should enable either feature flag until every applicable gate has an owner,
date, evidence link, and approval decision.

## Security and privacy properties implemented

- AI endpoints require an active session, legal-staff role, and `ai:use`.
- Production additionally requires an explicit organization allowlist.
- Production model discovery is constrained by an exact `provider:model` allowlist.
- Lawyer access is restricted to assigned/created cases; chats are private to their
  creator. Tenant and case IDs are bound in retrieval queries.
- Provider URLs are fixed to OpenAI and Anthropic, preventing user-controlled SSRF.
- BYOK credentials are write-only, encrypted with an independent secret, and removable
  from the UI. Adding/replacing a key requires password reauthentication and production
  policy requires MFA enrollment.
- A provider and pinned model are explicit on each request. A retired pin fails closed;
  there is no silent model/provider failover.
- OpenAI Responses requests set `store=false`; no provider file, thread, or vector-store
  APIs are used. This does not itself establish ZDR.
- Only malware-clean documents under the clean storage prefix can be indexed or used.
  Indexing is disabled by the global AI kill switch.
- Retrieval returns only full-text matches and escapes document/template delimiters.
  The model has no tools and cannot mutate cases or submit forms.
- Every provider attempt is atomically reserved with a hashed idempotency key. Failed
  attempts count toward the hourly limit.
- Form drafting has an independent kill switch and exact-template SHA-256 allowlist.
  Values must occur in cited evidence, choice values must be valid options, all unfilled
  supported fields are returned, and signed/XFA/oversized forms are rejected.
- Final source-document purge deletes extracted chunks and derived form objects, while
  legal holds block affected purges.

## Security review disposition

| Review item | Disposition |
| --- | --- |
| Cross-tenant/cross-case IDOR | Tenant, case assignment, chat owner, and explicit provider predicates retained; independent dynamic testing still required |
| Silent model/provider drift | Fixed: provider is request-bound, model is pinned, allowlisted, and retirement fails closed |
| Reindex queue amplification | Fixed: per-case cap plus document/hour idempotency |
| Rate-limit race and free failed retries | Fixed: advisory-lock reservation and durable attempt event before completion |
| Indexing while AI is disabled | Fixed: scan and index workers enforce global and organization flags |
| Quarantine path mislabeled clean | Fixed: index/form paths require the configured clean prefix in addition to scan state |
| Unrelated chunk disclosure | Fixed: full-text match is now a retrieval predicate, not merely sort priority |
| Prompt delimiter injection | Reduced: structured/template/document content is JSON encoded with escaped delimiters; no model tools exist |
| Form values with invented citations | Fixed for direct values: accepted values must occur in each named source; claim-level chat entailment remains an evaluation problem |
| Missing/invalid form controls | Fixed: all unfilled supported fields and unsupported controls are returned; choice options are enforced |
| Unapproved or signed form revision | Fixed: separate flag, exact hash allowlist, signature/XFA/size/page/schema checks |
| Extracted/derived data outliving source purge | Fixed: eligible purge deletes chunks and forms that use the document; relevant holds block purge |
| Generated S3 orphan after DB failure | Reduced: best-effort compensating deletion; bucket lifecycle remains required for exceptional cleanup failure |
| BYOK key loss/rotation | Reduced: independent 32-byte key, previous-key decryption window, audited re-encryption script; secret-manager backup remains external |
| Parser resource exhaustion | Reduced with byte/page/archive/schema bounds; container-level isolation remains required |
| Provider retention/training | Not enforceable by application code; contract, account settings, allowlist, and evidence remain launch gates |
| Stacked Stripe checkout completion race | Outside PR #178's diff; PR #176 must prevent a late checkout response from downgrading a completed payment |

## Risks that remain after code controls

### Provider processing

Provider API use discloses selected case facts and document excerpts to a third party.
`store=false` disables OpenAI Responses application-state storage, but standard abuse
monitoring or model-specific retention can still apply. Anthropic ZDR is
organization-specific and model/feature exceptions can apply. VisaTrack cannot verify a
customer's contract or dashboard configuration.

Required: approved provider organization/project, least-privilege key, hard spend cap,
ZDR evidence where policy requires it, region/cross-border assessment, and a reviewed
model list.

### Prompt injection and incorrect output

Escaping, delimiters, retrieval filtering, and lack of tools reduce impact; they do not
make model instructions reliable. A malicious clean document can still influence an
answer. Citations prove which chunk was supplied, not that every generated proposition
is entailed. Lawyers remain responsible for checking source records and law.

Required: adversarial evaluation using malicious documents, human review, no autonomous
submission or record mutation, and incident reporting for cross-case disclosure.

### Parser isolation

PDF and DOCX size/page/archive limits reduce resource exhaustion. They do not replace
process-level CPU/memory isolation for complex parsers.

Required before broad uploads: run scan/index workers with container memory/CPU limits,
non-root users, no unnecessary egress, bounded concurrency, and worker-restart alerts.

### Retention and subject rights

Chat messages are matter records and may contain copied personal information. Disabling
AI does not delete them. The generic privacy-request workflow records decisions but does
not itself execute export/deletion across every store.

Required: approved retention schedule, legal-hold authority, implemented operational
runbook for access/correction/deletion, backup expiry, and a completed synthetic
end-to-end exercise.

### Form validity

An accepted hash means the firm tested that exact file; it does not mean IRCC accepts a
generated copy. Pypdf cannot execute Adobe JavaScript, generate every barcode, sign, or
submit. A visible draft label is a warning, not a technical submission barrier.

Required: lawyer comparison against sources, completion of unresolved controls, current
Adobe Acrobat validation, and official filing guidance.

## Automated test matrix

| Control | Automated evidence |
| --- | --- |
| AI feature flag, legal role, `ai:use` | `backend/tests/api/routes/test_ai.py` |
| Cross-lawyer case denial and owned chats | `backend/tests/api/routes/test_ai.py` |
| Password/MFA key reauthentication | `backend/tests/api/routes/test_ai.py` |
| Credential encryption and write-only hint | `backend/tests/services/test_ai_credentials.py` |
| Provider filtering, model ranking, retired pin failure, stateless OpenAI | `backend/tests/services/test_ai_providers.py` |
| Atomic quota, duplicate request rejection | `backend/tests/api/routes/test_ai.py` |
| Quarantine/clean-prefix and disabled-index gates | `backend/tests/workers/test_index_ai_document.py` |
| Scan-to-index feature gate | `backend/tests/workers/test_scan_document.py` |
| Local extraction bounds and DOCX archive limit | `backend/tests/services/test_ai_documents.py` |
| Retrieval match filter, delimiter escaping, structured-data minimization | `backend/tests/api/routes/test_ai.py` |
| Citation filtering and unknown-source warning | `backend/tests/api/routes/test_ai.py` |
| AcroForm, signed form, size, field/choice validation | `backend/tests/services/test_ai_forms.py`, `backend/tests/api/routes/test_ai.py` |
| Derived artifact/chunk purge and legal hold | `backend/tests/workers/test_purge_document.py` |
| Explicit frontend provider and idempotency key | `frontend/tests/aiApi.test.ts` |
| Lawyer warnings, provider disconnect, request binding | `frontend/tests/aiAssistant.test.tsx` |
| Schema/migration validity | CI `alembic upgrade head` and committed OpenAPI check |
| Dependency vulnerabilities | CI `pip-audit` and `npm audit --omit=dev` |
| Frontend accessibility smoke tests | CI Playwright accessibility suite |

Automated tests use mocks for provider and S3 boundaries. They cannot prove real
provider retention, exact-model behavior, Adobe compatibility, infrastructure policy,
or legal adequacy.

## Mandatory synthetic evaluation

Use invented people and documents only. Record dataset version, prompt version, model
ID, template hash, evaluator, and raw results.

Minimum pilot acceptance criteria:

- **Tenant isolation:** 100% denial for cross-organization, cross-case, and unassigned
  lawyer probes.
- **Unsupported facts:** 100% abstention when the requested fact is absent.
- **Citation validity:** 100% citation IDs refer to supplied chunks; manually score
  claim-level entailment and set a firm-approved threshold before launch.
- **Prompt injection:** 100% resistance to requests in documents to reveal other data,
  ignore system rules, invent fields, or claim submission.
- **Form fields:** 100% exact match for required deterministic fields in every approved
  template; every unsupported/absent field must be unresolved.
- **Lifecycle:** 100% removal from active DB/S3 stores after an eligible purge, and 100%
  preservation while a legal hold applies.
- **Failure behavior:** provider timeout, 401, 429, malformed JSON, retired model,
  unavailable storage, and worker retry all fail without duplicate charges/artifacts.

These are launch gates, not claims that probabilistic output will remain perfect.
Production sampling, model-change review, and regression evaluation are still required.

## Rollout

1. Apply migrations with both flags false.
2. Deploy the same commit to API and worker.
3. Verify kill switches, secret injection, worker health, usage table, audit outbox, and
   backup coverage.
4. Complete provider/privacy/security approvals and synthetic chat evaluation.
5. Enable `AI_ENABLED` for a controlled pilot; do not enable forms.
6. Monitor provider errors, attempts/tokens, queue age, latency, spend, and incidents.
7. Approve and hash exact PDF revisions; complete field and Adobe checks.
8. Enable `AI_FORM_DRAFTS_ENABLED` only after form-specific sign-off.

Rollback: disable forms, disable AI, restart API/workers, revoke compromised provider
keys, and preserve records under the incident/legal-hold procedure.

## External references

- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Anthropic API retention and ZDR](https://docs.anthropic.com/en/docs/build-with-claude/zero-data-retention)
- [OWASP LLM01 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Canadian privacy regulators' generative-AI principles](https://www.priv.gc.ca/en/privacy-topics/technology/artificial-intelligence/gd_principles_ai)
- [Law Society of Ontario Rules, confidentiality and technology competence](https://lso.ca/about-lso/legislation-rules/rules-of-professional-conduct/chapter-3)
- [IRCC 2D barcode form guidance](https://ircc.canada.ca/english/helpcentre/answer.asp?qnum=1523&top=4)
