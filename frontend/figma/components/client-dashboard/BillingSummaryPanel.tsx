import { ChevronRight } from 'lucide-react';

import type { BillingInfo } from './types';

type BillingSummaryPanelProps = {
  billingInfo: BillingInfo;
};

export function BillingSummaryPanel({ billingInfo }: BillingSummaryPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Billing Summary</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Fees</span>
          <span className="font-semibold text-gray-900">${billingInfo.totalFees.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Paid</span>
          <span className="font-semibold text-green-600">${billingInfo.paid.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <span className="text-sm text-gray-600">Remaining</span>
          <span className="font-semibold text-red-600">${billingInfo.remaining.toLocaleString()}</span>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs font-medium text-yellow-800 mb-1">Next Payment</p>
          <p className="text-sm text-yellow-900">{billingInfo.nextPayment}</p>
        </div>
        <button className="w-full bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
          Make Payment
          <ChevronRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-gray-500 text-center">{billingInfo.paymentMethod}</p>
      </div>
    </div>
  );
}
