/** PaymentsSection: Configuration section for Payments settings and options. */

import { Info } from 'lucide-react';

type PaymentsSectionProps = {
  workspace: unknown;
};

export function PaymentsSection({ workspace: _workspace }: PaymentsSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payments & Invoices</h2>
          <p className="text-gray-600">Payment and invoice tools are temporarily hidden</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-8">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-lg font-semibold text-gray-900">Coming Soon</p>
            <p className="mt-2 text-sm text-gray-600">
              Payments and invoice management are not available yet. This section will be enabled in a later update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
