# Lawyer guide: case AI assistant

The assistant is a research and draft-preparation aid. It is not counsel, does not
replace professional judgment, and cannot submit, sign, or validate an application.

## Before first use

1. Confirm that your firm approved the provider account, processing region, retention,
   training controls, model, and use of client confidential information.
2. Enroll VisaTrack MFA.
3. Create a least-privilege provider key in the approved organization/project.
4. Open a case's **AI Assistant**, choose the provider, and enter the key, current
   VisaTrack password, MFA/recovery code, and approval acknowledgement.
5. Confirm the pinned model. “Recommended” is a technical heuristic, not a statement
   that the model satisfies your firm's privacy policy.

VisaTrack displays only the key's last four characters after saving. Use **Disconnect
provider** to erase the stored credential. Revoke a suspected compromised key at the
provider first, then disconnect it from VisaTrack.

## Case chat

- Select the intended provider before sending.
- Ask a narrow factual question. VisaTrack sends selected structured case fields and
  matching excerpts from malware-clean documents.
- Open every cited source and verify the statement and page.
- Treat a response without adequate support as unverified even if it sounds confident.
- Do not ask the assistant to make a legal decision, communicate with IRCC, sign,
  submit, or modify a case; those capabilities do not exist.
- Report suspected cross-case content immediately and stop using the assistant.

Documents can contain malicious instructions. VisaTrack marks them as untrusted and the
assistant has no tools, but prompt injection cannot be eliminated solely by prompting.

## PDF review drafts

Form drafting may remain unavailable while chat is enabled. The firm must approve the
exact blank PDF revision first.

1. Upload the official blank PDF through the normal quarantine flow.
2. Wait until malware scanning reports it clean.
3. Select it and generate a review draft.
4. Compare every populated value with the displayed source and original record.
5. Complete every unresolved field manually.
6. Open the file in current Adobe Acrobat Reader and use the official form's validation
   and barcode controls.
7. Follow current IRCC instructions before filing.

Generated drafts remain in the case's recent-draft history under the approved retention
policy. Request a fresh short-lived download link when needed. A draft can be marked
reviewed only when it has no unresolved/unsupported controls and the reviewer attests
that Adobe validation was completed; otherwise supersede it with corrected work.

VisaTrack rejects unapproved hashes, XFA-only forms, signed/certified files, unsupported
field types, oversized forms, values absent from their cited source, and invalid choice
values. It does not guarantee that an accepted PDF is current or filing-ready.

## Data and retention

Questions, responses, citations, extracted document text, usage metadata, and generated
drafts are firm matter records. Deleting a visible item may not authorize immediate
erasure where retention or legal-hold duties apply. Use the firm's approved privacy and
records process for access, correction, deletion, or hold requests.
