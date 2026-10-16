/** ActiveCasesPanel: Searchable, status-filterable list of active cases; clicking a row opens the case. */

import { useCallback, useMemo, useRef, useState } from 'react';

import { Clock } from 'lucide-react';

import { Badge, Button, Card, Input, Select } from '../ui';
import { CaseFlagButton } from '../CaseFlagButton';
import type { DashboardCase } from './types';
import { caseStatusTone } from './utils';

type ActiveCasesPanelProps = {
  cases: DashboardCase[];
  isLoading?: boolean;
  onViewActiveCases?: () => void;
  onSelectCase?: (caseId: string) => void;
  onToggleFlag?: (caseNumber: string, isFlagged: boolean) => void;
  flaggingCaseNumbers?: string[];
};

export function ActiveCasesPanel({
  cases,
  isLoading = false,
  onViewActiveCases,
  onSelectCase,
  onToggleFlag,
  flaggingCaseNumbers = [],
}: ActiveCasesPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const filterSelectRef = useRef<HTMLSelectElement | null>(null);
  const focusSearch = useCallback(() => { searchInputRef.current?.focus(); }, []);

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
    <Card className="overflow-hidden">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900">Active Cases</h2>
            {onToggleFlag && cases.some((entry) => entry.isFlagged) ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                {cases.filter((entry) => entry.isFlagged).length} flagged
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              searchInputRef.current?.focus();
            }}
            type="button"
          >
            Reset filters
          </Button>
        </div>
        {onToggleFlag ? <p className="mt-1 text-xs text-gray-600">Your flags are personal. Flagged cases stay at the top.</p> : null}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            ref={searchInputRef}
            aria-label="Search active cases"
            placeholder="Search by client, case type, or case #"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <Select
            ref={filterSelectRef}
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {statusOption}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {isLoading ? (
          <div className="px-5 py-4 text-sm text-gray-500">Loading active cases...</div>
        ) : cases.length === 0 ? (
          <div className="px-5 py-4 text-sm text-gray-500">No active cases yet.</div>
        ) : filteredCases.length === 0 ? (
          <div className="px-5 py-4 text-sm text-gray-500">No cases match your current search/filter.</div>
        ) : (
          filteredCases.map((case_) => (
            <div
              key={case_.id}
              className={`flex items-center gap-3 pr-5 ${onToggleFlag && case_.isFlagged ? 'bg-amber-50/50' : ''}`}
            >
              <button
                className="min-w-0 flex-1 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                onClick={() => onSelectCase?.(case_.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900">{case_.clientName}</h3>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {case_.caseType} • <span className="text-primary-700">{case_.id}</span>
                    </p>
                  </div>
                  <Badge tone={caseStatusTone(case_.status)}>{case_.status}</Badge>
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  {case_.lastUpdate}
                </p>
              </button>
              {onToggleFlag ? (
                <CaseFlagButton
                  caseNumber={case_.id}
                  flagged={Boolean(case_.isFlagged)}
                  saving={flaggingCaseNumbers.includes(case_.id)}
                  onToggle={() => onToggleFlag(case_.id, !case_.isFlagged)}
                  onFocusRemoved={focusSearch}
                />
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-gray-200 px-5 py-3">
        <button
          type="button"
          className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          onClick={onViewActiveCases}
        >
          View all cases →
        </button>
      </div>
    </Card>
  );
}
