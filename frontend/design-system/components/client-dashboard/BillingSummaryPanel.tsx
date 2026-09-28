/** BillingSummaryPanel: billingsummarypanel implementation. */

import { ChevronRight } from 'lucide-react';

import type { BillingInfo } from './types';

function formatCad(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

type BillingSummaryPanelProps = {
  billingInfo: BillingInfo;
  canPay: boolean;
  paying: boolean;
  error: string | null;
  onPay: () => Promise<void>;
};

export function BillingSummaryPanel({
  billingInfo,
  canPay,
  paying,
  error,
  onPay,
}: BillingSummaryPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Billing Summary</h2>
      </div>
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-800">Professional fees</span>
          <span className="font-semibold text-gray-900">{formatCad(billingInfo.feesBeforeTax ?? billingInfo.totalFees)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-800">Tax</span>
          <span className="font-semibold text-gray-900">{formatCad(billingInfo.tax ?? 0)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-800">Total</span>
          <span className="font-semibold text-gray-900">{formatCad(billingInfo.totalFees)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-800">Paid</span>
          <span className="font-semibold text-green-800">{formatCad(billingInfo.paid)}</span>
        </div>
        <div className="flex justify-between items-center pb-4 border-b border-gray-200">
          <span className="text-sm text-gray-800">Remaining</span>
          <span className="font-semibold text-red-800">{formatCad(billingInfo.remaining)}</span>
        </div>
        <p className="text-sm text-gray-800">
          These amounts are the invoice totals. VisaTrack does not add a checkout fee.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs font-medium text-yellow-800 mb-1">Next Payment</p>
          <p className="text-sm text-yellow-900">{billingInfo.nextPayment}</p>
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={!canPay || paying}
          onClick={() => void onPay()}
          className="w-full bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {paying ? 'Opening secure checkout…' : canPay ? 'Make Payment' : 'No payment due'}
          <ChevronRight className="w-4 h-4" />
        </button>
        <p className="text-sm text-gray-800 text-center">Secure card entry is hosted by Stripe. The card form charges the remaining total shown above.</p>
        <p className="text-sm text-gray-800 text-center">{billingInfo.paymentMethod}</p>
      </div>
    </div>
  );
}
