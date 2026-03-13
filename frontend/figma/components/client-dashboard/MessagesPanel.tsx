import { MessageSquare, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DashboardMessage } from './types';

type MessagesPanelProps = {
  allMessages?: DashboardMessage[];
  recentMessages: DashboardMessage[];
  canSendMessages: boolean;
};

export function MessagesPanel({ allMessages, recentMessages, canSendMessages }: MessagesPanelProps) {
  const [selectedMessage, setSelectedMessage] = useState<DashboardMessage | null>(null);
  const [isBoardOpen, setIsBoardOpen] = useState(false);

  const messageList = useMemo(
    () => (allMessages && allMessages.length > 0 ? allMessages : recentMessages),
    [allMessages, recentMessages]
  );

  const openMessage = (message: DashboardMessage) => {
    setSelectedMessage(message);
  };

  const openBoard = () => {
    if (messageList.length === 0) {
      return;
    }
    setIsBoardOpen(true);
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
            <button
              className="text-sm text-red-600 hover:text-red-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              onClick={openBoard}
              disabled={messageList.length === 0}
            >
              View All
            </button>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentMessages.map((message, index) => (
            <button
              key={`${message.subject}-${index}`}
              type="button"
              onClick={() => openMessage(message)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors cursor-pointer ${message.unread ? 'bg-red-50' : ''}`}
            >
              <div className="flex items-start justify-between mb-1">
                <p className={`text-sm font-medium ${message.unread ? 'text-gray-900' : 'text-gray-700'}`}>
                  {message.from}
                </p>
                <span className="text-xs text-gray-500">{message.time}</span>
              </div>
              <p className={`text-sm mb-1 ${message.unread ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                {message.subject}
              </p>
              <p className="text-xs text-gray-500 line-clamp-2">{message.preview}</p>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200">
          <button
            className={`w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors ${
              canSendMessages
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!canSendMessages}
          >
            <MessageSquare className="w-4 h-4" />
            {canSendMessages ? 'Send Message' : 'Messaging Disabled'}
          </button>
        </div>
      </div>
      {selectedMessage ? (
        <div className="fixed inset-0 z-[120] w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{selectedMessage.subject}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedMessage.from} · {selectedMessage.time}
                </p>
              </div>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setSelectedMessage(null)}
                aria-label="Close message"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.body}</p>
            </div>
          </div>
        </div>
      ) : null}
      {isBoardOpen ? (
        <div className="fixed inset-0 z-[121] w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-5xl bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">All Messages</h3>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setIsBoardOpen(false)}
                aria-label="Close all messages"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="grid md:grid-cols-[320px_1fr] min-h-[420px]">
              <div className="border-r border-gray-200 overflow-y-auto max-h-[70vh]">
                {messageList.map((message, index) => {
                  const isSelected =
                    selectedMessage?.subject === message.subject &&
                    selectedMessage?.time === message.time &&
                    selectedMessage?.from === message.from;
                  return (
                    <button
                      key={`${message.subject}-${message.time}-${index}`}
                      type="button"
                      onClick={() => setSelectedMessage(message)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                        isSelected ? 'bg-gray-100' : message.unread ? 'bg-red-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-medium text-gray-700">{message.from}</p>
                        <span className="text-[11px] text-gray-500">{message.time}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900">{message.subject}</p>
                      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{message.preview}</p>
                    </button>
                  );
                })}
              </div>
              <div className="p-5 overflow-y-auto max-h-[70vh]">
                {selectedMessage ? (
                  <>
                    <h4 className="text-base font-semibold text-gray-900">{selectedMessage.subject}</h4>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedMessage.from} · {selectedMessage.time}
                    </p>
                    <p className="mt-4 text-sm text-gray-700 whitespace-pre-wrap">{selectedMessage.body}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Select a message to read it.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
