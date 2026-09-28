"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { LegalFooter } from "@/components/compliance/LegalFooter";
import { business } from "@/lib/business";
import { unsubscribeFromEmails } from "@/lib/api";

function UnsubscribeForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await unsubscribeFromEmails({ email: email.trim(), token: token.trim() });
      setMessage("You are unsubscribed from VisaTrack case, document, and payment emails.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to unsubscribe.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Unsubscribe</h1>
        <p className="mt-3 text-base leading-7">
          This stops VisaTrack emails for {email || "the address on the link"}. {business.legalName},{" "}
          {business.address}.
        </p>
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
          {message ? <p role="status" className="text-sm text-gray-900">{message}</p> : null}
          <div>
            <label htmlFor="unsubscribe-email" className="block text-sm font-medium">Email</label>
            <input
              id="unsubscribe-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-400 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="unsubscribe-token" className="block text-sm font-medium">Unsubscribe code</label>
            <input
              id="unsubscribe-token"
              required
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-400 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg border-2 border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
          >
            {submitting ? "Unsubscribing…" : "Unsubscribe"}
          </button>
        </form>
      </main>
      <LegalFooter />
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<p className="p-10 text-gray-800">Loading unsubscribe form…</p>}>
      <UnsubscribeForm />
    </Suspense>
  );
}
