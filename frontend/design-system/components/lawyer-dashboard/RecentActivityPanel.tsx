/** RecentActivityPanel: Feed of recent document, reminder, payment, and milestone activity across the lawyer's cases. */

import { AlertCircle, BellRing, FileText, TrendingUp, type LucideIcon } from 'lucide-react';

import { Card, CardHeader } from '../ui';
import type { ActivityItem } from './types';

type RecentActivityPanelProps = {
  activityItems: ActivityItem[];
  isLoading?: boolean;
};

const ACTIVITY_ICONS: Record<ActivityItem['type'], LucideIcon> = {
  document: FileText,
  reminder: BellRing,
  payment: TrendingUp,
  milestone: AlertCircle,
};

export function RecentActivityPanel({ activityItems, isLoading = false }: RecentActivityPanelProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Recent Activity" />
      <ul className="divide-y divide-gray-200">
        {isLoading ? (
          <li className="px-5 py-4 text-sm text-gray-500">Loading recent activity...</li>
        ) : activityItems.length === 0 ? (
          <li className="px-5 py-4 text-sm text-gray-500">No recent activity yet.</li>
        ) : (
          activityItems.map((activity, index) => {
            const Icon = ACTIVITY_ICONS[activity.type];
            return (
              <li key={`${activity.client}-${activity.time}-${index}`} className="flex items-start gap-3 px-5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-600">
                      {activity.client} • {activity.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-500">{activity.time}</span>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}
