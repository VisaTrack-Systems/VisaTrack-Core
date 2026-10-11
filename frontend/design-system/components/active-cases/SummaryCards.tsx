/** SummaryCards: Totals across the listed cases (all, high priority, outstanding documents, unpaid invoices). */

import { AlertCircle, Clock, DollarSign, FileText } from 'lucide-react';

import { StatCard } from '../ui';
import type { UiCase } from './types';

type SummaryCardsProps = {
  cases: UiCase[];
};

export function SummaryCards({ cases }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Total Cases" value={cases.length} icon={FileText} iconClassName="text-blue-600" />
      <StatCard
        label="High Priority"
        value={cases.filter((c) => c.priority === 'high' || c.priority === 'urgent').length}
        icon={AlertCircle}
        iconClassName="text-red-600"
      />
      <StatCard
        label="Outstanding Docs"
        value={cases.reduce((sum, c) => sum + c.outstandingDocs, 0)}
        icon={Clock}
        iconClassName="text-yellow-600"
      />
      <StatCard
        label="Unpaid Invoices"
        value={cases.reduce((sum, c) => sum + c.outstandingPayments, 0)}
        icon={DollarSign}
        iconClassName="text-green-600"
      />
    </div>
  );
}
