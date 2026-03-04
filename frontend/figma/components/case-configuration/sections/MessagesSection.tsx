import { EyeOff, Send } from 'lucide-react';
import { useState } from 'react';

import type { CaseWorkspace } from '@/lib/api';

import { formatDateTime } from '../utils';

type OutboundMessage = {
  subject: string;
  body: string;
  sendEmail: boolean;
};

type MessagesSectionProps = {
  workspace: CaseWorkspace;
  caseNumber: string;
  sending: boolean;
  onSendMessage: (message: OutboundMessage) => Promise<boolean>;
  onNotify: (message: string) => void;
};

type TemplateOption = {
  label: string;
  subject: string;
  body: string;
};

const templates: TemplateOption[] = [
  {
    label: 'Document Reminder',
    subject: 'Document Submission Reminder',
    body: 'Please upload the requested documents in the client portal as soon as possible.',
  },
  {
    label: 'Milestone Update',
    subject: 'Case Milestone Update',
    body: 'A case milestone has been updated. Please review your dashboard for the latest status.',
  },
  {
    label: 'Payment Request',
    subject: 'Payment Request',
    body: 'A new payment request is available in your portal. Please review and complete it by the due date.',
  },
  {
    label: 'General Update',
    subject: 'Case Update',
    body: 'We have posted a new update regarding your case. Please check your portal for details.',
  },
  {
    label: 'Good News',
    subject: 'Great Progress on Your Case',
    body: 'Good news: we have made strong progress on your case and will share the next steps shortly.',
  },
  {
    label: 'Action Required',
    subject: 'Action Required on Your Case',
    body: 'Action is required on your side to keep the case moving. Please review the instructions in your portal.',
  },
];

function readDraft(storageKey: string): { templateLabel: string; subject: string; body: string; sendEmail: boolean } {
  if (typeof window === 'undefined') {
    return { templateLabel: '', subject: '', body: '', sendEmail: false };
  }

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { templateLabel: '', subject: '', body: '', sendEmail: false };
    }

    const parsed = JSON.parse(raw) as { templateLabel?: string; subject?: string; body?: string; sendEmail?: boolean };
    return {
      templateLabel: parsed.templateLabel ?? '',
      subject: parsed.subject ?? '',
      body: parsed.body ?? '',
      sendEmail: Boolean(parsed.sendEmail),
    };
  } catch {
    return { templateLabel: '', subject: '', body: '', sendEmail: false };
  }
}

export function MessagesSection({ workspace, caseNumber, sending, onSendMessage, onNotify }: MessagesSectionProps) {
  const recentNotes = workspace.messages.slice(0, 6);
  const draftStorageKey = `visatrack-message-draft-${caseNumber}`;
  const initialDraft = readDraft(draftStorageKey);
  const [templateLabel, setTemplateLabel] = useState(initialDraft.templateLabel);
  const [subject, setSubject] = useState(initialDraft.subject);
  const [body, setBody] = useState(initialDraft.body);
  const [sendEmail, setSendEmail] = useState(initialDraft.sendEmail);

  const saveDraft = () => {
    const draft = JSON.stringify({ templateLabel, subject, body, sendEmail });
    localStorage.setItem(draftStorageKey, draft);
    onNotify('Draft saved locally.');
  };

  const handleTemplateChange = (nextLabel: string) => {
    setTemplateLabel(nextLabel);

    const selected = templates.find((template) => template.label === nextLabel);
    if (!selected) {
      return;
    }

    setSubject(selected.subject);
    setBody(selected.body);
  };

  const handleSend = async () => {
    const normalizedSubject = subject.trim();
    const normalizedBody = body.trim();

    if (!normalizedSubject || !normalizedBody) {
      onNotify('Subject and message are required before sending.');
      return;
    }

    const success = await onSendMessage({
      subject: normalizedSubject,
      body: normalizedBody,
      sendEmail,
    });
    if (!success) {
      return;
    }

    setTemplateLabel('');
    setSubject('');
    setBody('');
    setSendEmail(false);
    localStorage.removeItem(draftStorageKey);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Messages / Notes</h2>
        <p className="text-gray-600">Client-visible updates and lawyer-only notes</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Client-Visible Update Composer</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={templateLabel}
            onChange={(event) => handleTemplateChange(event.target.value)}
          >
            <option value="">Select a template...</option>
            {templates.map((template) => (
              <option key={template.label} value={template.label}>
                {template.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <input
            type="text"
            placeholder="e.g., Document Submission Reminder"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
          <textarea
            rows={6}
            placeholder="Write your message to the client..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            onClick={() => {
              void handleSend();
            }}
            disabled={sending}
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send to Client Portal'}
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" onClick={saveDraft}>
            Save as Draft
          </button>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={sendEmail}
              onChange={(event) => setSendEmail(event.target.checked)}
            />
            Send email notification
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Case Messages</h3>
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Internal + client messages</span>
          </div>
        </div>

        <div className="space-y-3">
          {recentNotes.map((message) => (
            <div key={message.id} className="border-l-4 border-red-500 bg-gray-50 p-3">
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">{formatDateTime(message.sent_at)}</span>
                <span className={`px-2 py-0.5 text-xs rounded ${message.from_client ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {message.from_client ? 'client' : 'firm'}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900">{message.subject}</p>
              <p className="text-sm text-gray-700 mt-1">{message.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
