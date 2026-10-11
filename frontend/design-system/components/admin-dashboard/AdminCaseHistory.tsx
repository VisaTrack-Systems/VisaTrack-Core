/** AdminCaseHistory: Organization-wide case list for admins, filterable by search, status, and lawyer. */

import { useMemo, useState } from 'react';

import { CasesTable } from '../active-cases/CasesTable';
import { FilterBar } from '../active-cases/FilterBar';
import { SummaryCards } from '../active-cases/SummaryCards';
import { useActiveCasesData } from '../active-cases/useActiveCasesData';
import { Alert, Card } from '../ui';

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
      <Alert tone="danger" className="flex items-center justify-between gap-4">
        <p>{error}</p>
        <button className="font-medium underline underline-offset-2 hover:text-red-800" onClick={retry} type="button">
          Retry
        </button>
      </Alert>
    );
  }

  if (isLoading) {
    return <Card className="p-8 text-sm text-gray-500">Loading cases...</Card>;
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
