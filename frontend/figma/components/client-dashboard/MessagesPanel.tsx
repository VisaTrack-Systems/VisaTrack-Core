import { MessageSquare } from 'lucide-react';

import type { DashboardMessage } from './types';

type MessagesPanelProps = {
  recentMessages: DashboardMessage[];
  canSendMessages: boolean;
};

export function MessagesPanel({ recentMessages, canSendMessages }: MessagesPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          <button className="text-sm text-red-600 hover:text-red-700 font-medium">View All</button>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {recentMessages.map((message, index) => (
          <div
            key={`${message.subject}-${index}`}
            className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${message.unread ? 'bg-red-50' : ''}`}
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
          </div>
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
  );
}
