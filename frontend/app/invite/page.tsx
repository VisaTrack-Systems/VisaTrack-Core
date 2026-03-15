"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvitation, verifyInvitation, type VerifyInvitationResult } from "@/lib/api";

type PageState =
  | { kind: "loading" }
  | { kind: "invalid"; reason: string }
  | { kind: "ready"; info: VerifyInvitationResult }
  | { kind: "submitting"; info: VerifyInvitationResult }
  | { kind: "success"; email: string };

function InviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<PageState>(() =>
    token ? { kind: "loading" } : { kind: "invalid", reason: "No invitation token found in the URL." }
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    verifyInvitation(token)
      .then((info) => setState({ kind: "ready", info }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Invalid or expired invitation.";
        setState({ kind: "invalid", reason: message });
      });
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.kind !== "ready") return;

    if (password !== confirmPassword) {
      setFieldError("Passwords do not match.");
      return;
    }

    setFieldError(null);
    setState({ kind: "submitting", info: state.info });

    try {
      const result = await acceptInvitation(token, password);
      setState({ kind: "success", email: result.email });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to accept invitation.";
      setState({ kind: "ready", info: (state as { kind: "submitting"; info: VerifyInvitationResult }).info });
      setFieldError(message);
    }
  };

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Verifying invitation…</p>
      </div>
    );
  }

  if (state.kind === "invalid") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Invalid Invitation</h1>
          <p className="text-sm text-gray-600">{state.reason}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Account activated</h1>
          <p className="text-sm text-gray-600">
            Your account for <span className="font-medium">{state.email}</span> is ready. You can now sign in.
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  const info = state.kind === "submitting" ? state.info : state.info;
  const isSubmitting = state.kind === "submitting";

  const expiresAt = new Date(info.expires_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Set up your account</h1>
        <p className="text-sm text-gray-500 mb-6">Invitation expires {expiresAt}</p>

        <div className="mb-6 space-y-1 text-sm">
          <p>
            <span className="text-gray-500">Name: </span>
            <span className="text-gray-900 font-medium">{info.full_name}</span>
          </p>
          <p>
            <span className="text-gray-500">Email: </span>
            <span className="text-gray-900 font-medium">{info.email}</span>
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
              placeholder="At least 8 characters"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
            <input
              required
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
              placeholder="Re-enter password"
              disabled={isSubmitting}
            />
          </div>

          {fieldError ? (
            <p className="text-sm text-red-600">{fieldError}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Activating account…" : "Activate account"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">Loading…</p>
        </div>
      }
    >
      <InviteForm />
    </Suspense>
  );
}
