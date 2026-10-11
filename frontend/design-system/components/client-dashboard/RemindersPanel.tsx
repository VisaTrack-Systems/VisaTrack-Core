/** RemindersPanel: Recent lawyer reminders for the client, with a detail view and an all-reminders board. */

import { BellRing, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DashboardReminder } from './types';
import { DialogPanel } from '../DialogPanel';
import { Card } from '../ui';

type RemindersPanelProps = {
  allReminders?: DashboardReminder[];
  recentReminders: DashboardReminder[];
  onMarkRead: (reminderId: string) => Promise<void>;
};

export function RemindersPanel({
  allReminders,
  recentReminders,
  onMarkRead,
}: RemindersPanelProps) {
  const [selectedReminderId, setSelectedReminderId] = useState<string | null>(null);
  const [isBoardOpen, setIsBoardOpen] = useState(false);

  const reminderList = useMemo(
    () => (allReminders && allReminders.length > 0 ? allReminders : recentReminders),
    [allReminders, recentReminders]
  );

  const selectedReminder = useMemo(
    () => reminderList.find((reminder) => reminder.id === selectedReminderId) ?? null,
    [reminderList, selectedReminderId]
  );

  const openReminder = (reminder: DashboardReminder) => {
    setSelectedReminderId(reminder.id);
    if (reminder.unread) {
      void onMarkRead(reminder.id).catch(() => {
        // Handled by dashboard state; swallow to avoid unhandled promise rejections in UI handlers.
      });
    }
  };

  const openBoard = () => {
    if (reminderList.length === 0) {
      return;
    }
    setIsBoardOpen(true);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Reminders</h2>
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline font-medium disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
              onClick={openBoard}
              disabled={reminderList.length === 0}
            >
              View All
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentReminders.map((reminder, index) => (
            <button
              key={`${reminder.title}-${reminder.time}-${index}`}
              type="button"
              onClick={() => openReminder(reminder)}
              className={`w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${reminder.unread ? 'bg-primary-50 border-l-2 border-primary-600' : ''}`}
            >
              <div className="flex items-start justify-between mb-1">
                <p className={`text-sm font-medium ${reminder.unread ? 'text-gray-900' : 'text-gray-700'}`}>
                  {reminder.from}
                </p>
                <span className="text-xs text-gray-500">{reminder.time}</span>
              </div>
              <p className={`text-sm mb-1 ${reminder.unread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                {reminder.title}
              </p>
              <p className="text-xs text-gray-500 line-clamp-2">{reminder.preview}</p>
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
          <p className="flex items-center justify-center gap-2 text-xs font-medium text-gray-600">
            <BellRing className="w-3.5 h-3.5" aria-hidden="true" />
            Lawyer Reminders
          </p>
        </div>
      </Card>
      {selectedReminder && !isBoardOpen ? (
        <div className="fixed inset-0 z-[120] w-screen h-screen bg-navy-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <DialogPanel labelledBy="reminder-detail-title" onClose={() => setSelectedReminderId(null)} className="w-full max-w-2xl bg-white rounded-md border border-gray-200 shadow-popover overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 id="reminder-detail-title" className="text-base font-semibold text-gray-900">{selectedReminder.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedReminder.from} · {selectedReminder.time}
                </p>
              </div>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setSelectedReminderId(null)}
                aria-label="Close reminder"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedReminder.body}</p>
            </div>
          </DialogPanel>
        </div>
      ) : null}
      {isBoardOpen ? (
        <div className="fixed inset-0 z-[121] w-screen h-screen bg-navy-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <DialogPanel labelledBy="reminder-board-title" onClose={() => setIsBoardOpen(false)} className="w-full max-w-5xl bg-white rounded-md border border-gray-200 shadow-popover overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 id="reminder-board-title" className="text-base font-semibold text-gray-900">All Reminders</h3>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setIsBoardOpen(false)}
                aria-label="Close all reminders"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="grid md:grid-cols-[320px_1fr] min-h-[420px]">
              <div className="border-r border-gray-200 overflow-y-auto max-h-[70vh]">
                {reminderList.map((reminder, index) => {
                  const isSelected =
                    selectedReminder?.id === reminder.id;
                  return (
                    <button
                      key={`${reminder.id}-${index}`}
                      type="button"
                      onClick={() => openReminder(reminder)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                        isSelected ? 'bg-primary-50' : reminder.unread ? 'bg-gray-50 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-medium text-gray-700">{reminder.from}</p>
                        <span className="text-[11px] text-gray-500">{reminder.time}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900">{reminder.title}</p>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{reminder.preview}</p>
                    </button>
                  );
                })}
              </div>
              <div className="p-5 overflow-y-auto max-h-[70vh]">
                {selectedReminder ? (
                  <>
                    <h4 className="text-base font-semibold text-gray-900">{selectedReminder.title}</h4>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedReminder.from} · {selectedReminder.time}
                    </p>
                    <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{selectedReminder.body}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Select a reminder to read it.</p>
                )}
              </div>
            </div>
          </DialogPanel>
        </div>
      ) : null}
    </>
  );
}
