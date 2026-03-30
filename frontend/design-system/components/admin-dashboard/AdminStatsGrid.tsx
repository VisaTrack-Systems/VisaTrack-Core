/** AdminStatsGrid: adminstatsgrid implementation. */

import { FileText, Mail, TrendingUp, Users } from 'lucide-react';

type StatCard = {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  trend: string;
};

type AdminStatsGridProps = {
  activeCases: number;
  totalMembers: number;
  pendingInvitations: number;
  unassignedCases: number;
};

export function AdminStatsGrid({
  activeCases,
  totalMembers,
  pendingInvitations,
  unassignedCases,
}: AdminStatsGridProps) {
  const cards: StatCard[] = [
    {
      label: 'Active Cases',
      value: activeCases,
      icon: FileText,
      color: 'text-red-600',
      trend: 'Live from database',
    },
    {
      label: 'Total Members',
      value: totalMembers,
      icon: Users,
      color: 'text-blue-600',
      trend: 'All organization members',
    },
    {
      label: 'Pending Invitations',
      value: pendingInvitations,
      icon: Mail,
      color: 'text-yellow-600',
      trend: 'Awaiting response',
    },
    {
      label: 'Unassigned Cases',
      value: unassignedCases,
      icon: TrendingUp,
      color: 'text-green-600',
      trend: 'Needs a lawyer assigned',
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
