"use client";

import { FormEvent, useState } from "react";

import { LegalDocument, LegalSection } from "@/components/compliance/LegalDocument";
import { business } from "@/lib/business";
import { createPrivacyRequest, submitPublicDeletionRequest } from "@/lib/api";

export default function DeletionRequestPage() {
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitPublic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!confirmed) {
      setError("Confirm that you want the account data deleted.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitPublicDeletionRequest({
        organization_slug: organizationSlug.trim(),
        email: email.trim(),
        details: details.trim() || null,
        confirm_deletion: true,
      });
      setMessage(result.message);
      setConfirmed(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit the request.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSignedIn = async () => {
    setError(null);
    setMessage(null);
    if (!confirmed) {
      setError("Confirm that you want the account data deleted.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPrivacyRequest({
        request_type: "deletion",
        details: details.trim() || null,
      });
      setMessage(`Request ${result.id} is ${result.status}. We will respond by ${result.due_at}.`);
      setConfirmed(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to submit the request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LegalDocument title="Data deletion request">
      <LegalSection heading="Ask us to delete your information">
        <p>
          You can ask {business.legalName} to delete the personal information tied to your
          VisaTrack account. Records under a legal hold are kept until that hold ends, and we will
          tell you if that applies. You can also email {business.email}.
        </p>
      </LegalSection>
      <form onSubmit={(event) => void submitPublic(event)} className="space-y-4 rounded-lg border border-gray-300 p-4">
        <h2 className="text-lg font-semibold">Request without signing in</h2>
        <p className="text-sm leading-6 text-gray-800">
          We use the organization slug and email only to find the account. The reply is the same
          whether or not an account exists.
        </p>
        {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-gray-900">{message}</p> : null}
        <div>
          <label htmlFor="deletion-org" className="block text-sm font-medium">Organization slug</label>
          <input
            id="deletion-org"
            required
            value={organizationSlug}
            onChange={(event) => setOrganizationSlug(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-400 px-3 py-2"
            autoComplete="organization"
          />
        </div>
        <div>
          <label htmlFor="deletion-email" className="block text-sm font-medium">Email</label>
          <input
            id="deletion-email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-400 px-3 py-2"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="deletion-details" className="block text-sm font-medium">Details (optional)</label>
          <textarea
            id="deletion-details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            maxLength={2000}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-400 px-3 py-2"
          />
        </div>
        <label htmlFor="deletion-confirm" className="flex items-start gap-3 text-sm leading-6">
          <input
            id="deletion-confirm"
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>I want VisaTrack to delete the personal information for this account.</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg border-2 border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit deletion request"}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submitSignedIn()}
            className="rounded-lg border-2 border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
          >
            Submit with my signed-in account
          </button>
        </div>
      </form>
    </LegalDocument>
  );
}
