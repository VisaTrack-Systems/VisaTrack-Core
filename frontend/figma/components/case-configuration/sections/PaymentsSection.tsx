import { Edit2, Info, Plus } from 'lucide-react';

import type { CaseWorkspace } from '@/lib/api';

import { formatDate } from '../utils';

type PaymentsSectionProps = {
  workspace: CaseWorkspace;
};

export function PaymentsSection({ workspace }: PaymentsSectionProps) {
  const paid = workspace.payment_items.reduce((sum, payment) => sum + payment.amount_paid, 0);
  const pending = workspace.payment_items.reduce((sum, payment) => sum + payment.amount_due, 0);
  const total = workspace.payment_items.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Payments & Invoices</h2>
          <p className="text-gray-600">Manage payment requests and invoices</p>
        </div>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Payment Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-700">${paid.toLocaleString()}</div>
          <div className="text-sm text-green-600">Total Paid</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-700">${pending.toLocaleString()}</div>
          <div className="text-sm text-yellow-600">Pending Payment</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-700">${total.toLocaleString()}</div>
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
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {workspace.payment_items.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{payment.description}</div>
                  {payment.paid_date ? <div className="text-xs text-gray-500 mt-0.5">Paid: {formatDate(payment.paid_date)}</div> : null}
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">${payment.amount.toLocaleString()}</td>
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
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {payment.amount_due > 0 ? (
                      <button className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors">
                        Send Request
                      </button>
                    ) : null}
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
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
              Total fees: ${workspace.billing_summary.total_fees.toLocaleString()} | Remaining: ${workspace.billing_summary.remaining.toLocaleString()} | Payment method: {workspace.billing_summary.payment_method ?? 'Not set'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
