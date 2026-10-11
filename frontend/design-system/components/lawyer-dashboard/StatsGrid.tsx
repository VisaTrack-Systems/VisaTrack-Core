/** StatsGrid: Row of headline caseload metrics on the lawyer dashboard, with loading skeletons. */

import { Clock, FileText, TrendingUp, Users } from 'lucide-react';

import { Card, StatCard } from '../ui';
import type { DashboardStats } from './types';

type StatsGridProps = {
  stats: DashboardStats;
  isLoading?: boolean;
};

export function StatsGrid({ stats, isLoading = false }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={`stat-skeleton-${index}`} className="p-5 animate-pulse">
            <div className="mb-3 h-4 w-24 rounded bg-gray-200" />
            <div className="mb-2 h-8 w-16 rounded bg-gray-200" />
            <div className="h-3 w-28 rounded bg-gray-100" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Active Cases" value={stats.activeCases} icon={FileText} iconClassName="text-red-600" hint="Live from database" />
      <StatCard label="Total Users" value={stats.totalUsers} icon={Users} iconClassName="text-blue-600" hint="Clients in your roster" />
      <StatCard label="Upcoming Milestones" value={stats.upcomingMilestones} icon={Clock} iconClassName="text-yellow-600" hint="Needs follow-up" />
      <StatCard label="Completed Cases" value={stats.completedCases} icon={TrendingUp} iconClassName="text-green-600" hint="Marked approved/closed" />
    </div>
  );
}
