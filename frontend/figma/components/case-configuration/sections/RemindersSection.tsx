import { BellRing, Send } from 'lucide-react';
import { useState } from 'react';

import type { CaseWorkspace } from '@/lib/api';

import { formatDateTime } from '../utils';

type OutboundReminder = {
  title: string;
  body: string;
  sendEmail: boolean;
};

type RemindersSectionProps = {
  workspace: CaseWorkspace;
  creating: boolean;
  onCreateReminder: (reminder: OutboundReminder) => Promise<boolean>;
  onNotify: (message: string) => void;
};

type TemplateOption = {
  label: string;
  title: string;
  body: string;
};

const templates: TemplateOption[] = [
  {
    label: 'Document Reminder',
    title: 'Document Submission Reminder',
    body: 'Please upload the requested documents in the client portal as soon as possible.',
  },
  {
    label: 'Milestone Update',
    title: 'Case Milestone Update',
    body: 'A case milestone has been updated. Please review your dashboard for the latest status.',
  },
  {
    label: 'Payment Reminder',
    title: 'Payment Reminder',
    body: 'A payment is pending in your portal. Please review and complete it by the due date.',
  },
  {
    label: 'General Update',
    title: 'Case Update',
    body: 'We have posted a new update regarding your case. Please check your portal for details.',
  },
];

export function RemindersSection({ workspace, creating, onCreateReminder, onNotify }: RemindersSectionProps) {
  const recentReminders = workspace.reminders.slice(0, 8);
  const [templateLabel, setTemplateLabel] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const handleTemplateChange = (nextLabel: string) => {
    setTemplateLabel(nextLabel);
    const selected = templates.find((template) => template.label === nextLabel);
    if (!selected) {
      return;
    }
    setTitle(selected.title);
    setBody(selected.body);
  };

  const handleCreate = async () => {
    const normalizedTitle = title.trim();
    const normalizedBody = body.trim();
    if (!normalizedTitle || !normalizedBody) {
      onNotify('Title and reminder text are required.');
      return;
    }

    const success = await onCreateReminder({
      title: normalizedTitle,
      body: normalizedBody,
      sendEmail: false,
    });
    if (!success) {
      return;
    }

    setTemplateLabel('');
    setTitle('');
    setBody('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Client Reminders</h2>
        <p className="text-gray-600">One-way reminders from legal team to client portal</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Compose Reminder</h3>

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
          <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <input
            type="text"
            placeholder="e.g., Document Submission Reminder"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Reminder</label>
          <textarea
            rows={6}
            placeholder="Write the reminder for the client..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            onClick={() => {
              void handleCreate();
            }}
            disabled={creating}
          >
            <Send className="w-4 h-4" />
            {creating ? 'Posting...' : 'Post Reminder'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <BellRing className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Recent Reminders</h3>
        </div>
        <div className="space-y-3">
          {recentReminders.length === 0 ? (
            <p className="text-sm text-gray-500">No reminders posted yet.</p>
          ) : (
            recentReminders.map((reminder) => (
              <div key={reminder.id} className="border-l-4 border-red-500 bg-gray-50 p-3">
                <div className="flex items-start justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">{formatDateTime(reminder.sent_at)}</span>
                  <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">firm</span>
                </div>
                <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                <p className="text-sm text-gray-700 mt-1">{reminder.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {reminder.acknowledged_at ? (
                    <>
                      <span className="px-2 py-0.5 text-xs rounded bg-emerald-100 text-emerald-700">
                        Acknowledged
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(reminder.acknowledged_at)}
                      </span>
                    </>
                  ) : reminder.read_at ? (
                    <>
                      <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700">Read</span>
                      <span className="text-xs text-gray-500">{formatDateTime(reminder.read_at)}</span>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded bg-amber-100 text-amber-700">Unread</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
