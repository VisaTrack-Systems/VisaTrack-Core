/** ActiveCases: Wrapper component displaying active cases list for all user types. Integrates filtering, sorting, and tabular case display with status details. */

import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CasesTable } from './active-cases/CasesTable';
import { FilterBar } from './active-cases/FilterBar';
import { SummaryCards } from './active-cases/SummaryCards';
import { useActiveCasesData } from './active-cases/useActiveCasesData';
import { PageHeader } from './AppShell';
import { Alert, Button, Card } from './ui';

interface ActiveCasesProps {
  onSelectCase: (caseId: string) => void;
  onBack: () => void;
  enablePersonalFlags?: boolean;
}

export function ActiveCases({ onSelectCase, onBack, enablePersonalFlags = false }: ActiveCasesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { cases, isLoading, error, retry, flagError, flaggingCaseNumbers, toggleFlag } = useActiveCasesData();

  const filteredCases = useMemo(
    () =>
      cases.filter((entry) => {
        const matchesSearch =
          entry.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.caseType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || entry.status === filterStatus;
        return matchesSearch && matchesFilter;
      }),
    [cases, filterStatus, searchTerm]
  );

  return (
    <div>
      <PageHeader
        title="Active Cases"
        description="Manage and configure all your immigration cases"
        actions={
          <Button type="button" variant="secondary" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Dashboard
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <Alert tone="danger" className="flex items-center justify-between gap-4">
            <p>{error}</p>
            <button className="font-medium underline underline-offset-2 hover:text-red-800" onClick={retry} type="button">
              Retry
            </button>
          </Alert>
        ) : null}

        {enablePersonalFlags && flagError ? <Alert tone="danger">{flagError}</Alert> : null}

        {enablePersonalFlags ? <p className="text-sm text-gray-600">Flag cases for your attention. Your flags are visible only to you and stay at the top.</p> : null}

        {!isLoading ? <SummaryCards cases={cases} /> : null}

        <FilterBar
          searchTerm={searchTerm}
          filterStatus={filterStatus}
          onSearchTermChange={setSearchTerm}
          onFilterStatusChange={setFilterStatus}
        />

        {isLoading ? (
          <Card className="p-8 text-sm text-gray-500">Loading active cases...</Card>
        ) : (
          <CasesTable
            filteredCases={filteredCases}
            onSelectCase={onSelectCase}
            onToggleFlag={enablePersonalFlags ? (caseNumber, isFlagged) => { void toggleFlag(caseNumber, isFlagged); } : undefined}
            flaggingCaseNumbers={flaggingCaseNumbers}
          />
        )}
      </div>
    </div>
  );
}
