/** ActiveCasesPanel: activecasespanel implementation. */

import { useMemo, useRef, useState } from 'react';

import { Clock } from 'lucide-react';

import type { DashboardCase } from './types';
import { caseStatusColor } from './utils';

type ActiveCasesPanelProps = {
  cases: DashboardCase[];
  isLoading?: boolean;
  onViewActiveCases?: () => void;
  onSelectCase?: (caseId: string) => void;
};

export function ActiveCasesPanel({
  cases,
  isLoading = false,
  onViewActiveCases,
  onSelectCase,
}: ActiveCasesPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filterSelectRef = useRef<HTMLSelectElement | null>(null);

  const defaultStatusOptions = useMemo(
    () => [
      'Intake',
      'Awaiting Client',
      'In Progress',
      'Closed',
    ],
    []
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set([...defaultStatusOptions, ...cases.map((entry) => entry.status)])).sort((a, b) =>
        a.localeCompare(b)
      ),
    [cases, defaultStatusOptions]
  );

  const filteredCases = useMemo(
    () =>
      cases.filter((entry) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch =
          normalizedSearch.length === 0 ||
          entry.clientName.toLowerCase().includes(normalizedSearch) ||
          entry.caseType.toLowerCase().includes(normalizedSearch) ||
          entry.id.toLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [cases, searchTerm, statusFilter]
  );

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Cases</h2>
          <button
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              searchInputRef.current?.focus();
            }}
            type="button"
          >
            Reset filters
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            ref={searchInputRef}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Search by client, case type, or case #"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            ref={filterSelectRef}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Loading active cases...</div>
        ) : cases.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No active cases yet.</div>
        ) : filteredCases.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No cases match your current search/filter.</div>
        ) : (
          filteredCases.map((case_) => (
            <button
              key={case_.id}
              className="w-full p-6 hover:bg-gray-50 transition-colors cursor-pointer text-left"
              onClick={() => onSelectCase?.(case_.id)}
              type="button"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">{case_.clientName}</h3>
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
                </div>
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-4 border-t border-gray-200">
        <button className="text-sm text-red-600 hover:text-red-700 font-medium" onClick={onViewActiveCases}>
          View all cases →
        </button>
      </div>
    </div>
  );
}
