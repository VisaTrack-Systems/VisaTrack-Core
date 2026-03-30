/** AdminCaseHistory: admincasehistory implementation. */

import { useMemo, useState } from 'react';

import { CasesTable } from '../active-cases/CasesTable';
import { FilterBar } from '../active-cases/FilterBar';
import { SummaryCards } from '../active-cases/SummaryCards';
import { useActiveCasesData } from '../active-cases/useActiveCasesData';

type Props = {
  onSelectCase: (caseId: string) => void;
  /** All lawyers in the org — passed from admin data so unassigned cases don't cause gaps */
  orgLawyerNames?: string[];
};

export function AdminCaseHistory({ onSelectCase, orgLawyerNames }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLawyer, setFilterLawyer] = useState('all');
  const { cases, isLoading, error, retry } = useActiveCasesData();

  const lawyerOptions = useMemo(() => {
    if (orgLawyerNames && orgLawyerNames.length > 0) {
      return [...orgLawyerNames].sort();
    }
    const names = new Set(cases.map((c) => c.lawyerName));
    return Array.from(names).sort();
  }, [orgLawyerNames, cases]);

  const filteredCases = useMemo(
    () =>
      cases.filter((entry) => {
        const matchesSearch =
          entry.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.caseType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || entry.status === filterStatus;
        const matchesLawyer = filterLawyer === 'all' || entry.lawyerName === filterLawyer;
        return matchesSearch && matchesFilter && matchesLawyer;
      }),
    [cases, filterStatus, filterLawyer, searchTerm],
  );

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-red-700">{error}</p>
        <button className="text-sm font-medium text-red-700 hover:text-red-800" onClick={retry} type="button">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="bg-white rounded-lg shadow-sm p-8 text-sm text-gray-500">Loading cases...</div>;
  }

  return (
    <div className="space-y-6">
      <FilterBar
        searchTerm={searchTerm}
        filterStatus={filterStatus}
        onSearchTermChange={setSearchTerm}
        onFilterStatusChange={setFilterStatus}
        filterLawyer={filterLawyer}
        onFilterLawyerChange={setFilterLawyer}
        lawyerOptions={lawyerOptions}
      />
      <SummaryCards cases={cases} />
      <CasesTable filteredCases={filteredCases} onSelectCase={onSelectCase} />
    </div>
  );
}
