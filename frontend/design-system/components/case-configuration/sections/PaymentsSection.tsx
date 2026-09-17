/** Lawyer invoice creation and payment-status view. */

import { FormEvent, useState } from 'react';

import { createCaseInvoice, type CaseWorkspace } from '@/lib/api';

type PaymentsSectionProps = {
  workspace: CaseWorkspace;
  onInvoiceCreated: () => Promise<void>;
};

function formatMoney(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function PaymentsSection({ workspace, onInvoiceCreated }: PaymentsSectionProps) {
  const [description, setDescription] = useState('Professional legal services');
  const [amount, setAmount] = useState('');
  const [taxPercent, setTaxPercent] = useState('13');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitInvoice = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    const parsedTaxPercent = Number(taxPercent);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedTaxPercent) || parsedTaxPercent < 0 || parsedTaxPercent > 100) {
      setError('Tax must be between 0 and 100 percent.');
      return;
    }

    setSubmitting(true);
    try {
      await createCaseInvoice(
        workspace.case.case_number,
        {
          due_date: dueDate,
          tax_rate: parsedTaxPercent / 100,
          notes: notes.trim() || null,
          items: [
            {
              description: description.trim(),
              quantity: 1,
              unit_price: parsedAmount,
              category: 'professional_fees',
            },
          ],
        },
        `invoice-${crypto.randomUUID()}`
      );
      setAmount('');
      setNotes('');
      await onInvoiceCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payments & Invoices</h2>
        <p className="text-gray-600">
          Bill the client for a retainer installment, professional fees, or disbursements.
          Card entry is handled by Stripe Checkout.
        </p>
      </div>

      <form onSubmit={submitInvoice} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Create invoice</h3>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="invoice-description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              id="invoice-description"
              required
              maxLength={500}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="invoice-amount" className="block text-sm font-medium text-gray-700">
              Amount before tax (CAD)
            </label>
            <input
              id="invoice-amount"
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="invoice-tax" className="block text-sm font-medium text-gray-700">
              Tax (%)
            </label>
            <input
              id="invoice-tax"
              required
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxPercent}
              onChange={(event) => setTaxPercent(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="invoice-due-date" className="block text-sm font-medium text-gray-700">
              Due date
            </label>
            <input
              id="invoice-due-date"
              required
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="invoice-notes" className="block text-sm font-medium text-gray-700">
              Client note (optional)
            </label>
            <input
              id="invoice-notes"
              maxLength={5000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-60"
        >
          {submitting ? 'Creating invoice…' : 'Create and send invoice'}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="font-semibold text-gray-900">Case invoices</h3>
        </div>
        {workspace.payment_items.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-500">No invoices have been created.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Paid</th>
                  <th className="px-4 py-3">Outstanding</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {workspace.payment_items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium">{item.invoice_number}</td>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3">{item.due_date ?? '—'}</td>
                    <td className="px-4 py-3">{formatMoney(item.amount_paid)}</td>
                    <td className="px-4 py-3">{formatMoney(item.amount_due)}</td>
                    <td className="px-4 py-3 capitalize">{item.status.replaceAll('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
