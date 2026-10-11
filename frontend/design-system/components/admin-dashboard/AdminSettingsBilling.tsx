/** AdminSettingsBilling: Billing & Plan settings panel (not yet implemented; shows a coming-soon notice). */

import { CreditCard } from 'lucide-react';

import { Card, CardHeader } from '../ui';

export function AdminSettingsBilling() {
  return (
    <Card>
      <CardHeader title="Billing & Plan" description="Manage your subscription and payment details." />
      <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
          <CreditCard className="h-6 w-6 text-primary-600" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-gray-700">Billing management coming soon</p>
        <p className="max-w-sm text-sm text-gray-500">
          This section will allow you to view your current plan, update payment methods, and manage your subscription.
        </p>
      </div>
    </Card>
  );
}
