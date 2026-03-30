/** RecentActivityPanel: recentactivitypanel implementation. */

import { AlertCircle, BellRing, FileText, TrendingUp } from 'lucide-react';

import type { ActivityItem } from './types';

type RecentActivityPanelProps = {
  activityItems: ActivityItem[];
  isLoading?: boolean;
};

export function RecentActivityPanel({ activityItems, isLoading = false }: RecentActivityPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading recent activity...</div>
        ) : activityItems.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No recent activity yet.</div>
        ) : (
          activityItems.map((activity, index) => (
            <div key={`${activity.client}-${activity.time}-${index}`} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activity.type === 'document'
                      ? 'bg-blue-100'
                      : activity.type === 'reminder'
                        ? 'bg-purple-100'
                        : activity.type === 'payment'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                  }`}
                >
                  {activity.type === 'document' && <FileText className="w-5 h-5 text-blue-600" />}
                  {activity.type === 'reminder' && <BellRing className="w-5 h-5 text-purple-600" />}
                  {activity.type === 'payment' && <TrendingUp className="w-5 h-5 text-green-600" />}
                  {activity.type === 'milestone' && <AlertCircle className="w-5 h-5 text-red-600" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{activity.action}</p>
                      <p className="text-sm text-gray-600">
                        {activity.client} • {activity.detail}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500">{activity.time}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
