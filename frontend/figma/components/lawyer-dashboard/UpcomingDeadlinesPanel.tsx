import type { DeadlineItem } from './types';

type UpcomingDeadlinesPanelProps = {
  deadlines: DeadlineItem[];
};

export function UpcomingDeadlinesPanel({ deadlines }: UpcomingDeadlinesPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Deadlines</h2>
      </div>
      <div className="p-6 space-y-4">
        {deadlines.map((deadline, index) => (
          <div key={`${deadline.task}-${deadline.client}-${index}`} className="border-l-4 border-red-500 pl-4">
            <div className="flex items-start justify-between mb-1">
              <p className="font-medium text-gray-900 text-sm">{deadline.task}</p>
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${
                  deadline.daysLeft <= 7 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {deadline.daysLeft}d
              </span>
            </div>
            <p className="text-sm text-gray-600">{deadline.client}</p>
            <p className="text-xs text-gray-500 mt-1">{deadline.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
