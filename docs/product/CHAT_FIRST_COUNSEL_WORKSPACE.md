# VisaTrack Counsel AI: chat-first product design

Date: 2026-09-17

## Product position

VisaTrack Counsel AI is a case-grounded workspace for immigration legal teams. The
conversation is the starting point, not the entire product: a lawyer can research the
matter record, inspect source documents, and then move directly into case details,
documents, forms, milestones, reminders, client access, retainers, invoices, and firm
operations.

Pitch statement:

> Start with the question. Keep the matter, evidence, deadlines, client collaboration,
> and business workflow in the same secure workspace.

This is product and engineering language—not a claim that AI output is legal advice or
that the system is compliant merely because controls exist.

## Industry-pattern alignment

The redesign follows observable patterns in current legal products without claiming
feature parity:

- [Harvey Spaces](https://www.harvey.ai/platform/spaces) keeps AI, documents, work
  product, permissions, and teams inside a governed matter/project context.
- [Harvey Vault](https://www.harvey.ai/platform/vault) emphasizes persistent source
  navigation and cited document analysis.
- [Thomson Reuters CoCounsel Legal](https://legal.thomsonreuters.com/en/products/cocounsel-legal)
  connects a plain-language request to research, document analysis, drafting, and cited
  work product.
- [Clio Manage AI](https://www.clio.com/ca/features/legal-ai-software/) integrates AI
  into matter, scheduling, billing, and client workflows while retaining human review.

VisaTrack's current differentiator is narrower and immigration-practice-specific:
case-scoped evidence chat sits beside forms, document intake, client collaboration,
milestones, retainers, invoices, and payments. It does not yet provide authoritative
legal-research databases or autonomous workflow agents.

## Design principles

1. **Conversation first, evidence always.** The primary legal-team screen opens on the
   selected matter's copilot and keeps cited sources visible.
2. **Matter context never disappears.** Client, case number, type, status, progress,
   filing date, and document count remain adjacent to the conversation.
3. **Operations stay one click away.** Practice overview, all matters, full matter
   configuration, profile, role switching, and matter creation remain in primary
   navigation.
4. **AI is bounded, not magical.** The interface states that sources require review and
   that VisaTrack cannot sign, submit, or replace counsel.
5. **Progressive disclosure.** Chat appears before provider configuration and PDF form
   tooling in the dedicated AI workspace. Advanced controls remain available below it.
6. **Role-aware defaults.** Lawyers and administrators enter the AI workspace; clients
   continue to enter their application portal.
7. **Professional calm.** Dense legal work uses restrained colour, clear hierarchy,
   generous spacing, and minimal decorative motion.

## Information architecture

### Legal team

- **AI workspace** (default)
  - searchable matter rail
  - matter-grounded chat
  - source citations and document deep links
  - provider/model governance
  - approved PDF review drafts and draft history
  - matter snapshot and safeguards
- **Practice overview**
  - workload statistics
  - active matters
  - recent activity
  - matter creation
- **All matters**
  - search/filter
  - priority, deadline, outstanding work, progress
- **Full matter**
  - overview and case details
  - document requests/uploads
  - AI assistant
  - milestones and timeline
  - invoices/payments
  - reminders
  - portal sharing/permissions
- **Firm operations** (administrators)
  - organization overview
  - assignments and aging matters
  - members/invitations/roles
  - organization and billing settings

### Client

The client continues to receive a purpose-built portal rather than the legal AI
workspace:

- case progress
- document checklist and secure upload/download
- milestones and appointments
- reminders
- invoice balance and Stripe-hosted payment

## Visual system

| Token | Value | Purpose |
| --- | --- | --- |
| Midnight | `#10182b` | primary navigation and trust anchor |
| Ink | `#172033` | primary text |
| Counsel indigo | `#5b67d8` | primary action and selected state |
| Evidence mint | `#35c9b0` | source/safety accents |
| Soft indigo | `#eef0ff` | selected rows and AI context |
| Workspace | `#f3f5fa` | application background |
| Paper | `#ffffff` | content surfaces |
| Line | `#dfe3ec` | low-contrast boundaries |

Typography uses Geist with compact headings, readable 14–16px body text, and explicit
labels for dense workflows. Cards use 16–24px radii, subtle borders, and low-elevation
shadows. Error and warning colours remain semantically red/amber; the old red brand
accent is replaced by indigo and mint.

## Core interaction model

1. On sign-in, a legal user lands in the AI workspace.
2. The first assigned matter is selected; the lawyer can search and switch without
   leaving the conversation surface.
3. Starter prompts demonstrate evidence-based uses without pretending to offer legal
   conclusions.
4. Sending a prompt uses the existing provider/model, quota, idempotency, case scope,
   and citation controls.
5. Source buttons open the existing authenticated document-view flow at the cited page.
6. **Open full matter** transitions to the complete existing workflow and **Back**
   returns to the AI workspace.
7. Practice overview, all matters, new matter, profile, sign-out, and active-role
   switching remain available in the workspace shell.
8. The current authorized view and case number are mirrored to non-sensitive query
   parameters so a refresh or shared internal link can restore context. Secrets and
   chat content never enter the URL.

## Existing-functionality preservation matrix

| Existing capability | Redesign location |
| --- | --- |
| Lawyer dashboard | Practice overview |
| Active-case table | All matters |
| Case configuration | Open full matter |
| Documents and retainers | Full matter → Document Requests |
| AI provider/model settings | AI workspace → provider section |
| Case chat and citations | AI workspace primary surface |
| PDF draft generation/history | AI workspace → form tools |
| Milestones/timeline/reminders | Full matter navigation |
| Invoices and Stripe Checkout | Full matter and client portal |
| Portal permissions | Full matter → Sharing / Permissions |
| Admin organizations/users/roles | Firm operations |
| Client portal | Client role default |
| Profile and MFA | Profile settings |
| Multi-role switching | Workspace role selector and legacy header |
| Bug reporting | Existing global bug widget |

## Trust and professional-responsibility UX

- “Case-scoped by design” and source-review language remain persistent.
- AI output is labelled as incomplete or potentially wrong.
- Provider keys remain write-only and approved-model controls are retained.
- No interface suggests autonomous filing, signature, government-portal access, or
  replacement of professional judgment.
- Form drafts remain review artifacts with unresolved/unsupported controls and
  provenance.
- The client role does not receive legal-team AI access.

See:

- [`../ai/LEGAL_AI_ASSISTANT_DESIGN.md`](../ai/LEGAL_AI_ASSISTANT_DESIGN.md)
- [`../ai/PRODUCTION_READINESS.md`](../ai/PRODUCTION_READINESS.md)
- [`../ai/LAWYER_USER_GUIDE.md`](../ai/LAWYER_USER_GUIDE.md)

## Accessibility and responsive behaviour

- Semantic navigation landmarks and `aria-current` identify the active destination.
- Every icon-only control has an accessible name.
- The matter rail becomes a modal drawer on narrow screens.
- The transcript is keyboard focusable; messages identify the speaker.
- Loading, failure, empty, AI-disabled, and no-matter states remain visible text.
- Reduced-motion global handling is retained.
- Existing sign-in axe/keyboard checks and Storybook accessibility checks remain gates.

## Acceptance criteria

- Lawyer/admin sign-in lands on the chat-first workspace.
- Client sign-in still lands on the client dashboard.
- A lawyer can select a matter, see its snapshot, use the existing AI assistant, and
  open its complete case workflow.
- Dashboard, matters, case creation, profile, sign-out, and role switching are reachable
  without a page reload.
- Existing case, document, billing, reminder, admin, and client tests remain green.
- New workspace tests cover default rendering, matter switching, navigation, starter
  prompts, and responsive/accessibility semantics.
- Production build, Storybook, type-check, lint, and browser accessibility checks pass.

## Deliberate non-claims and next product steps

The redesign does not remove the production gates documented for legal AI. It also does
not add authoritative legal research, OCR, government submission, autonomous actions,
or client-facing legal advice.

Future product phases should add:

- capability-driven navigation when AI is disabled;
- explicit document/data-category selection before disclosure;
- authoritative, dated legal-source retrieval;
- structured claim/quote review;
- organization AI policy and spend dashboards;
- prompt evaluation and bilingual quality reporting;
- saved prompt/playbook libraries; and
- reviewed workflow actions that always require human confirmation.
