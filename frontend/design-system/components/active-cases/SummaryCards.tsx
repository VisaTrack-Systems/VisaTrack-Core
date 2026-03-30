/** SummaryCards: summarycards implementation. */

import { AlertCircle, Clock, DollarSign, FileText } from 'lucide-react';

import type { UiCase } from './types';

type SummaryCardsProps = {
  cases: UiCase[];
};

export function SummaryCards({ cases }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Cases</p>
            <p className="text-2xl font-bold text-gray-900">{cases.length}</p>
          </div>
          <FileText className="w-8 h-8 text-blue-600" />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">High Priority</p>
            <p className="text-2xl font-bold text-gray-900">
              {cases.filter((c) => c.priority === 'high' || c.priority === 'urgent').length}
            </p>
          </div>
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Outstanding Docs</p>
            <p className="text-2xl font-bold text-gray-900">{cases.reduce((sum, c) => sum + c.outstandingDocs, 0)}</p>
          </div>
          <Clock className="w-8 h-8 text-yellow-600" />
        </div>
      </div>
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Unpaid Invoices</p>
            <p className="text-2xl font-bold text-gray-900">{cases.reduce((sum, c) => sum + c.outstandingPayments, 0)}</p>
          </div>
          <DollarSign className="w-8 h-8 text-green-600" />
        </div>
      </div>
    </div>
  );
}
