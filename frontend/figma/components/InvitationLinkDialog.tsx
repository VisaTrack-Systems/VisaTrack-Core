import { X } from 'lucide-react';
import { useState } from 'react';

import { sendInvitationEmail } from '@/lib/api';

type InvitationLinkDialogProps = {
  invitationUrl: string;
  recipientName: string | null;
  defaultEmail: string;
  organizationName?: string;
  onClose: () => void;
};

export function InvitationLinkDialog({
  invitationUrl,
  recipientName,
  defaultEmail,
  organizationName,
  onClose,
}: InvitationLinkDialogProps) {
  const [emailDraft, setEmailDraft] = useState(defaultEmail);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSend = () => {
    if (!emailDraft || !invitationUrl) return;
    setEmailStatus('sending');
    setEmailError(null);
    const name = recipientName ?? emailDraft;
    void sendInvitationEmail(emailDraft, name, invitationUrl, organizationName)
      .then(() => setEmailStatus('sent'))
      .catch((err: unknown) => {
        setEmailStatus('idle');
        setEmailError(err instanceof Error ? err.message : 'Failed to send email.');
      });
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Invitation link ready</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Share this link with the user so they can set their password and activate their
              account. It expires in 72 hours.
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={invitationUrl}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 bg-gray-50 truncate"
              />
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(invitationUrl)}
                className="border border-gray-300 px-3 py-2 rounded-lg text-xs hover:bg-gray-100 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Send via email</p>
            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="recipient@example.com"
                value={emailDraft}
                onChange={(e) => {
                  setEmailDraft(e.target.value);
                  setEmailError(null);
                }}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                disabled={!emailDraft || emailStatus === 'sending' || emailStatus === 'sent'}
                onClick={handleSend}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white transition-colors"
              >
                {emailStatus === 'sending' ? 'Sending…' : emailStatus === 'sent' ? 'Sent ✓' : 'Send'}
              </button>
            </div>
            {emailStatus === 'sent' && (
              <p className="mt-1.5 text-xs text-green-600">Email sent successfully.</p>
            )}
            {emailError ? <p className="mt-1.5 text-xs text-red-600">{emailError}</p> : null}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
