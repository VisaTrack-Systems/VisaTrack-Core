import { Calendar, Clock, Filter, Search } from 'lucide-react';

import type { DashboardCase } from './types';
import { caseStatusColor, priorityColor } from './utils';

type ActiveCasesPanelProps = {
  cases: DashboardCase[];
  onViewActiveCases?: () => void;
};

export function ActiveCasesPanel({ cases, onViewActiveCases }: ActiveCasesPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Cases</h2>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Search className="w-4 h-4 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Filter className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {cases.map((case_) => (
          <div key={case_.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{case_.clientName}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColor(case_.priority)}`}>
                    {case_.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {case_.caseType} • {case_.id}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${caseStatusColor(case_.status)}`}>
                {case_.status}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4 text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {case_.lastUpdate}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Deadline: {case_.nextDeadline}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-gray-200">
        <button className="text-sm text-red-600 hover:text-red-700 font-medium" onClick={onViewActiveCases}>
          View all cases →
        </button>
      </div>
    </div>
  );
}
