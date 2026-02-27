import { ChevronDown, Filter, Search } from 'lucide-react';

type FilterBarProps = {
  searchTerm: string;
  filterStatus: string;
  onSearchTermChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
};

export function FilterBar({
  searchTerm,
  filterStatus,
  onSearchTermChange,
  onFilterStatusChange,
}: FilterBarProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by client name, case type, or case ID..."
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white"
            >
              <option value="all">All Status</option>
              <option value="Document Review">Document Review</option>
              <option value="Awaiting Client">Awaiting Client</option>
              <option value="In Progress">In Progress</option>
              <option value="Ready To Submit">Ready To Submit</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">More Filters</span>
          </button>
        </div>
      </div>
    </div>
  );
}
