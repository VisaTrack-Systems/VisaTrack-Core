import { Clock, FileText, TrendingUp, Users } from 'lucide-react';

import type { DashboardStats } from './types';

type StatsGridProps = {
  stats: DashboardStats;
};

export function StatsGrid({ stats }: StatsGridProps) {
  const cards = [
    {
      label: 'Active Cases',
      value: String(stats.activeCases),
      icon: FileText,
      trend: 'Live from database',
      color: 'text-red-600',
    },
    {
      label: 'Total Users',
      value: String(stats.totalUsers),
      icon: Users,
      trend: 'Clients in your roster',
      color: 'text-blue-600',
    },
    {
      label: 'Upcoming Milestones',
      value: String(stats.upcomingMilestones),
      icon: Clock,
      trend: 'Needs follow-up',
      color: 'text-yellow-600',
    },
    {
      label: 'Completed Cases',
      value: String(stats.completedCases),
      icon: TrendingUp,
      trend: 'Marked approved/closed',
      color: 'text-green-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((stat) => (
        <div key={stat.label} className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <stat.icon className={`w-8 h-8 ${stat.color}`} />
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
          <div className="text-sm text-gray-600 mb-2">{stat.label}</div>
          <div className="text-xs text-gray-500">{stat.trend}</div>
        </div>
      ))}
    </div>
  );
}
