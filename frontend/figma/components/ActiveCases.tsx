import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CasesTable } from './active-cases/CasesTable';
import { FilterBar } from './active-cases/FilterBar';
import { SummaryCards } from './active-cases/SummaryCards';
import { useActiveCasesData } from './active-cases/useActiveCasesData';

interface ActiveCasesProps {
  onSelectCase: (caseId: string) => void;
  onBack: () => void;
}

export function ActiveCases({ onSelectCase, onBack }: ActiveCasesProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const { cases } = useActiveCasesData();

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors"
            type="button"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Active Cases</h1>
          <p className="text-gray-600">Manage and configure all your immigration cases</p>
        </div>

        <FilterBar
          searchTerm={searchTerm}
          filterStatus={filterStatus}
          onSearchTermChange={setSearchTerm}
          onFilterStatusChange={setFilterStatus}
        />

        <SummaryCards cases={cases} />

        <CasesTable filteredCases={filteredCases} onSelectCase={onSelectCase} />
      </div>
    </div>
  );
}
