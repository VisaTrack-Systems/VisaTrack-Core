/**
 * BillingSummaryPanel: Client's financial overview (Clio "Financial" card style): total, paid,
 * and remaining amounts, a payment-progress bar, the fee breakdown, and the secure checkout button.
 */

import { ChevronRight } from 'lucide-react';

import { Button, Card, CardHeader, cx } from '../ui';
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

/** One headline amount with a coloured accent along its top edge. */
function AmountCell({ label, amount, accentClassName }: { label: string; amount: number; accentClassName: string }) {
  return (
    <div className={cx('border-t-2 px-4 py-4 text-center', accentClassName)}>
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-gray-900">{formatCad(amount)}</p>
    </div>
  );
}

export function BillingSummaryPanel({
  billingInfo,
  canPay,
  paying,
  error,
  onPay,
}: BillingSummaryPanelProps) {
  const paidPercent =
    billingInfo.totalFees > 0 ? Math.min(100, Math.round((billingInfo.paid / billingInfo.totalFees) * 100)) : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Billing Summary" />

      <div className="grid grid-cols-1 divide-y divide-gray-200 border-b border-gray-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <AmountCell label="Total" amount={billingInfo.totalFees} accentClassName="border-t-primary-500" />
        <AmountCell label="Paid" amount={billingInfo.paid} accentClassName="border-t-green-500" />
        <AmountCell label="Remaining" amount={billingInfo.remaining} accentClassName="border-t-amber-500" />
      </div>

      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-gray-900">Payment progress</p>
          <p className="text-xs text-gray-500">{paidPercent}% paid</p>
        </div>
        <div
          className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200"
          role="progressbar"
          aria-label="Payment progress"
          aria-valuenow={paidPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-green-600" style={{ width: `${paidPercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {formatCad(billingInfo.paid)} of {formatCad(billingInfo.totalFees)}
        </p>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-200 text-sm">
        <div className="flex items-center justify-between gap-2 px-5 py-3">
          <span className="text-gray-600">Professional fees</span>
          <span className="font-semibold text-gray-900">{formatCad(billingInfo.feesBeforeTax ?? billingInfo.totalFees)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-3">
          <span className="text-gray-600">Tax</span>
          <span className="font-semibold text-gray-900">{formatCad(billingInfo.tax ?? 0)}</span>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next Payment</p>
            <p className="text-sm text-gray-900">{billingInfo.nextPayment}</p>
          </div>
          <Button type="button" disabled={!canPay || paying} onClick={() => void onPay()}>
            {paying ? 'Opening secure checkout…' : canPay ? 'Make Payment' : 'No payment due'}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <p className="text-xs text-gray-600">
          These amounts are the invoice totals. VisaTrack does not add a checkout fee.
        </p>
        <p className="text-xs text-gray-600">
          Secure card entry is hosted by Stripe. The card form charges the remaining total shown above.
        </p>
        <p className="text-xs text-gray-600">{billingInfo.paymentMethod}</p>
      </div>
    </Card>
  );
}
