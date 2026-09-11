"use client";

import { AlertCircle, Bug, Mail, Send, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getAccessToken, submitBugReport } from "@/lib/api";
import { DialogPanel } from "./DialogPanel";

type DeliveryChannel = "email" | "github";
type ScreenshotState = "idle" | "capturing" | "copied" | "downloaded" | "failed";
type ScreenshotAttachmentPayload = {
  filename: string;
  content_type: string;
  base64_content: string;
};

const DEFAULT_GITHUB_ISSUES_URL = "https://github.com/VisaTrack-Systems/VisaTrack-Core/issues/new";

function buildPathWithQuery(pathname: string, searchParams: URLSearchParams): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function BugReportWidget() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<DeliveryChannel>("github");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [screenshotState, setScreenshotState] = useState<ScreenshotState>("idle");
  const [screenshotMessage, setScreenshotMessage] = useState<string | null>(null);
  const [screenshotCapturedAt, setScreenshotCapturedAt] = useState<string | null>(null);
  const [screenshotAttachment, setScreenshotAttachment] = useState<ScreenshotAttachmentPayload | null>(
    null
  );
  const [isUiHiddenForCapture, setIsUiHiddenForCapture] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canSendEmail, setCanSendEmail] = useState(false);

  const githubIssuesUrl = (
    process.env.NEXT_PUBLIC_GITHUB_ISSUES_URL || DEFAULT_GITHUB_ISSUES_URL
  ).trim();

  const pathWithQuery = useMemo(
    () => buildPathWithQuery(pathname || "/", searchParams),
    [pathname, searchParams]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [isOpen]);

  const resetForm = () => {
    setTitle("");
    setDetails("");
    setValidationError(null);
    setScreenshotState("idle");
    setScreenshotMessage(null);
    setScreenshotCapturedAt(null);
    setScreenshotAttachment(null);
    setIsUiHiddenForCapture(false);
    setIsSubmitting(false);
  };

  const closeModal = () => {
    setIsOpen(false);
    resetForm();
  };

  const openModal = () => {
    setCanSendEmail(Boolean(getAccessToken()));
    setIsOpen(true);
  };

  const isScreenshotCaptureSupported = (): boolean => {
    return Boolean(navigator.mediaDevices?.getDisplayMedia);
  };

  const waitForNextPaint = () => {
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  };

  const captureScreenshotBlob = async (): Promise<Blob> => {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });

    try {
      // Hide bug report UI before we read a frame from the shared tab.
      setIsUiHiddenForCapture(true);
      await waitForNextPaint();
      await waitForNextPaint();

      const track = stream.getVideoTracks()[0];
      if (!track) {
        throw new Error("No video track returned by browser.");
      }

      const video = document.createElement("video");
      video.srcObject = new MediaStream([track]);
      video.playsInline = true;
      video.muted = true;

      await video.play();
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve();
          return;
        }
        video.onloadeddata = () => resolve();
      });

      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Unable to create image context.");
      }

      context.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob) {
        throw new Error("Unable to generate screenshot image.");
      }

      return blob;
    } finally {
      setIsUiHiddenForCapture(false);
      stream.getTracks().forEach((currentTrack) => currentTrack.stop());
    }
  };

  const tryCopyImageToClipboard = async (blob: Blob): Promise<boolean> => {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      return false;
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return true;
    } catch {
      return false;
    }
  };

  const downloadImageBlob = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Failed to convert screenshot to base64."));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => reject(new Error("Failed to read screenshot blob."));
      reader.readAsDataURL(blob);
    });

    const parts = dataUrl.split(",", 2);
    if (parts.length < 2 || !parts[1]) {
      throw new Error("Invalid screenshot encoding.");
    }
    return parts[1];
  };

  const captureScreenshot = async () => {
    if (!isScreenshotCaptureSupported()) {
      setScreenshotState("failed");
      setScreenshotMessage("Tab screenshot is not supported in this browser.");
      return;
    }

    setScreenshotState("capturing");
    setScreenshotMessage("Choose the current tab in the browser prompt.");

    try {
      const screenshotBlob = await captureScreenshotBlob();
      const screenshotBase64 = await blobToBase64(screenshotBlob);
      const screenshotFilename = `visatrack-bug-${Date.now()}.png`;
      setScreenshotAttachment({
        filename: screenshotFilename,
        content_type: screenshotBlob.type || "image/png",
        base64_content: screenshotBase64,
      });

      const copied = await tryCopyImageToClipboard(screenshotBlob);
      const nowUtc = new Date().toISOString();
      setScreenshotCapturedAt(nowUtc);

      if (copied) {
        setScreenshotState("copied");
        setScreenshotMessage(
          "Screenshot copied and will be attached to internal email reports."
        );
        return;
      }

      downloadImageBlob(screenshotBlob, screenshotFilename);
      setScreenshotState("downloaded");
      setScreenshotMessage(
        `Clipboard image copy is unavailable. Downloaded ${screenshotFilename}. It will still be attached to internal email reports.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setScreenshotState("failed");
      if (message.toLowerCase().includes("permission")) {
        setScreenshotMessage("Screenshot capture was denied. Please allow screen/tab sharing.");
        return;
      }
      setScreenshotMessage("Screenshot capture was cancelled or failed. Please try again.");
    }
  };

  const buildReportBody = (summary: string, description: string): string => {
    const now = new Date().toISOString();
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
    const origin = typeof window !== "undefined" ? window.location.origin : "unknown";

    return [
      "## Bug summary",
      summary,
      "",
      "## What happened",
      description,
      "",
      "## Context",
      `- URL path: ${pathWithQuery}`,
      `- Site origin: ${origin}`,
      `- Reported at (UTC): ${now}`,
      `- Browser: ${userAgent}`,
      `- Screenshot captured: ${screenshotCapturedAt ? `Yes (${screenshotCapturedAt})` : "No"}`,
    ].join("\n");
  };

  const createGithubIssueUrl = (summary: string, description: string): string => {
    const url = new URL(githubIssuesUrl);
    url.searchParams.set("title", `[Bug] ${summary}`);
    url.searchParams.set("body", buildReportBody(summary, description));
    return url.toString();
  };

  const submitReport = async () => {
    const normalizedTitle = title.trim();
    const normalizedDetails = details.trim();

    if (!normalizedTitle || normalizedTitle.length < 3) {
      setValidationError("Title must be at least 3 characters.");
      return;
    }

    if (!normalizedDetails || normalizedDetails.length < 5) {
      setValidationError("Details must be at least 5 characters.");
      return;
    }

    setValidationError(null);

    if (channel === "github") {
      const issueUrl = createGithubIssueUrl(normalizedTitle, normalizedDetails);
      window.open(issueUrl, "_blank", "noopener,noreferrer");
      closeModal();
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "unknown";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
    const reportedAtUtc = new Date().toISOString();

    setIsSubmitting(true);
    try {
      await submitBugReport({
        title: normalizedTitle,
        details: normalizedDetails,
        channel,
        context: {
          path: pathWithQuery,
          origin,
          reported_at_utc: reportedAtUtc,
          user_agent: userAgent,
          screenshot_captured_at: screenshotCapturedAt,
        },
        screenshot: screenshotAttachment,
      });
      closeModal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send bug report email.";
      setValidationError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Report a bug"
        onClick={openModal}
        className={`fixed bottom-5 right-5 z-[95] inline-flex items-center gap-2 rounded-full border border-red-500 bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-red-700 ${
          isUiHiddenForCapture ? "hidden" : ""
        }`}
      >
        <Bug className="h-4 w-4" />
        Report a bug
      </button>

      {isOpen ? (
        <div
          className={`fixed inset-0 z-[99] flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center ${
            isUiHiddenForCapture ? "hidden" : ""
          }`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <DialogPanel
            labelledBy="bug-report-title"
            onClose={closeModal}
            className="my-2 flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 id="bug-report-title" className="text-lg font-semibold text-gray-900">Report a bug</h2>
                <p className="text-xs text-gray-500">Send bug details from anywhere in the app.</p>
              </div>
              <button
                type="button"
                aria-label="Close bug report dialog"
                onClick={closeModal}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Where should this go?</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setChannel("github")}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      channel === "github"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <p className="font-semibold">GitHub issue</p>
                    <p className="text-xs opacity-80 break-all">{githubIssuesUrl}</p>
                  </button>
                  <button
                    type="button"
                    disabled={!canSendEmail}
                    onClick={() => {
                      if (canSendEmail) {
                        setChannel("email");
                      }
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      channel === "email"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    }`}
                  >
                    <p className="font-semibold">Email</p>
                    <p className="text-xs opacity-80 break-all">
                      {canSendEmail ? "Sent by VisaTrack support system" : "Sign in to send email"}
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="bug-title">
                  Title
                </label>
                <input
                  id="bug-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={3}
                  placeholder="Short summary of the bug"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="bug-details">
                  Details
                </label>
                <textarea
                  id="bug-details"
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  minLength={5}
                  rows={6}
                  placeholder="What did you expect, what happened, and steps to reproduce?"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                <p className="font-medium">Auto-attached context</p>
                <p>Path: {pathWithQuery}</p>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Screenshot</p>
                    <p className="text-xs text-gray-600">
                      Capture the current tab, then paste or attach it to your report.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={captureScreenshot}
                    disabled={screenshotState === "capturing"}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {screenshotState === "capturing" ? "Capturing..." : "Capture screenshot"}
                  </button>
                </div>
                {screenshotMessage ? (
                  <p className="mt-2 text-xs text-gray-700">{screenshotMessage}</p>
                ) : null}
              </div>

              {validationError ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{validationError}</p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {channel === "email" ? <Mail className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {isSubmitting
                  ? "Sending..."
                  : channel === "email"
                    ? "Send bug report"
                    : "Open GitHub issue"}
              </button>
            </div>
          </DialogPanel>
        </div>
      ) : null}
    </>
  );
}
