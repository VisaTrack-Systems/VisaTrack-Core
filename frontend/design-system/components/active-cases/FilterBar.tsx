/** FilterBar: Search box plus status (and optional lawyer) filters for the case list. */

import { Search } from 'lucide-react';

import { Card, Input, Select } from '../ui';

type FilterBarProps = {
  searchTerm: string;
  filterStatus: string;
  onSearchTermChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  filterLawyer?: string;
  onFilterLawyerChange?: (value: string) => void;
  lawyerOptions?: string[];
};

export function FilterBar({
  searchTerm,
  filterStatus,
  onSearchTermChange,
  onFilterStatusChange,
  filterLawyer,
  onFilterLawyerChange,
  lawyerOptions,
}: FilterBarProps) {
  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <Input
            type="text"
            aria-label="Search cases"
            placeholder="Search by client name, case type, or case ID..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="w-44">
            <Select aria-label="Filter by status" value={filterStatus} onChange={(e) => onFilterStatusChange(e.target.value)}>
              <option value="all">All Status</option>
              <option value="Awaiting Client">Awaiting Client</option>
              <option value="Intake">Intake</option>
              <option value="In Progress">In Progress</option>
              <option value="Closed">Closed</option>
            </Select>
          </div>

          {lawyerOptions && onFilterLawyerChange ? (
            <div className="w-44">
              <Select
                aria-label="Filter by lawyer"
                value={filterLawyer ?? 'all'}
                onChange={(e) => onFilterLawyerChange(e.target.value)}
              >
                <option value="all">All Lawyers</option>
                {lawyerOptions.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
