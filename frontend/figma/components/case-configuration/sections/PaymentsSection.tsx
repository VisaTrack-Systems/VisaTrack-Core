import { Info } from 'lucide-react';

import type { CaseWorkspace } from '@/lib/api';

import { formatDate } from '../utils';

type PaymentsSectionProps = {
  workspace: CaseWorkspace;
};

export function PaymentsSection({ workspace }: PaymentsSectionProps) {
  const paid = workspace.payment_items.reduce((sum, payment) => sum + payment.amount_paid, 0);
  const pending = workspace.payment_items.reduce((sum, payment) => sum + payment.amount_due, 0);
  const total = workspace.payment_items.reduce((sum, payment) => sum + payment.amount, 0);
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payments & Invoices</h2>
          <p className="text-gray-600">Payment summary and invoice history</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">{formatCurrency(paid)}</div>
          <div className="text-sm text-green-600">Total Paid</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">{formatCurrency(pending)}</div>
          <div className="text-sm text-yellow-600">Pending Payment</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700">{formatCurrency(total)}</div>
          <div className="text-sm text-gray-600">Total Amount</div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {workspace.payment_items.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{payment.description}</div>
                  {payment.paid_date ? <div className="text-xs text-gray-500 mt-0.5">Paid: {formatDate(payment.paid_date)}</div> : null}
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      payment.amount_due <= 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {payment.amount_due <= 0 ? 'Paid' : 'Pending'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{formatDate(payment.due_date)}</td>
                <td className="px-6 py-4">
                  {payment.invoice_number ? (
                    <span className="text-sm text-blue-600 hover:underline cursor-pointer">{payment.invoice_number}</span>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Compliance Snapshot</p>
            <p className="text-sm text-blue-700 mt-1">
              Total fees: {formatCurrency(workspace.billing_summary.total_fees)} | Remaining: {formatCurrency(workspace.billing_summary.remaining)} | Payment method: {workspace.billing_summary.payment_method ?? 'Not set'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
