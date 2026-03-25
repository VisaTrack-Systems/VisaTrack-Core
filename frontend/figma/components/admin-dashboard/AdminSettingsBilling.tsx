import { CreditCard } from 'lucide-react';

export function AdminSettingsBilling() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Billing & Plan</h3>
        <p className="text-sm text-gray-500 mt-0.5">Manage your subscription and payment details.</p>
      </div>
      <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700">Billing management coming soon</p>
        <p className="text-sm text-gray-500 max-w-sm">
          This section will allow you to view your current plan, update payment methods, and manage your subscription.
        </p>
      </div>
    </div>
  );
}
