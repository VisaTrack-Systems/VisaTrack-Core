/**
 * Triggers a file download for a URL that may be cross-origin (e.g. an AWS S3 pre-signed URL).
 *
 * Strategy
 * ────────
 * 1. Fetch the URL as a Blob with mode:'cors'.
 *    When the S3 bucket permits CORS GET requests from the app origin, this produces
 *    a same-origin object URL and the <a download> attribute is honoured by every browser.
 *    The object URL is revoked after a short delay to avoid memory leaks.
 *
 * 2. If the fetch fails (CORS rejection, network error, or non-2xx status), fall back to
 *    opening a blank window synchronously — preserving the user-gesture token — then
 *    navigating it to the pre-signed URL.  The URL already carries
 *    `Content-Disposition: attachment` (set server-side by create_presigned_force_download),
 *    so the browser will show a "Save As" prompt rather than rendering the file in-tab.
 *
 * 3. If the popup was blocked (window.open returns null), throw so the caller can surface
 *    an actionable error notice.
 *
 * @param url      A pre-signed S3 URL with Content-Disposition: attachment already set.
 * @param fileName Suggested file name for the saved file.
 */
export async function triggerFileDownload(url: string, fileName: string): Promise<void> {
  // ── Strategy 1: Blob fetch → object URL (works when S3 CORS allows the origin) ──
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) {
      throw new Error(`S3 fetch failed: HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Revoke after a generous delay to ensure the browser has started the download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  } catch {
    // CORS or network error — fall through to the pre-emptive window fallback.
  }

  // ── Strategy 2: pre-emptive blank window (popup-blocker safe, CORS-free) ──────
  // Open synchronously while the user gesture is still active (we are already inside
  // an async function that was kicked off by a click handler, so the gesture is live).
  const dlWindow = window.open('', '_blank');
  if (!dlWindow) {
    throw new Error(
      'Download failed: the CORS fetch was rejected and pop-ups are blocked for this site. ' +
        'Please allow pop-ups and try again.'
    );
  }
  dlWindow.location.href = url;
}
