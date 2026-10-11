/** AdminStatsGrid: Row of headline organization metrics shown on the admin Home section. */

import { FileText, Mail, TrendingUp, Users } from 'lucide-react';

import { StatCard } from '../ui';

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
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Active Cases" value={activeCases} icon={FileText} iconClassName="text-red-600" hint="Live from database" />
      <StatCard label="Total Members" value={totalMembers} icon={Users} iconClassName="text-blue-600" hint="All organization members" />
      <StatCard label="Pending Invitations" value={pendingInvitations} icon={Mail} iconClassName="text-yellow-600" hint="Awaiting response" />
      <StatCard label="Unassigned Cases" value={unassignedCases} icon={TrendingUp} iconClassName="text-green-600" hint="Needs a lawyer assigned" />
    </div>
  );
}
