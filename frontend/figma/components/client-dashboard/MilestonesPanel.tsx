import type { DashboardMilestone } from './types';

type MilestonesPanelProps = {
  milestones: DashboardMilestone[];
};

function milestoneDotColor(status: DashboardMilestone['status']) {
  switch (status) {
    case 'completed':
      return 'bg-green-500';
    case 'in-progress':
      return 'bg-blue-500';
    default:
      return 'bg-gray-300';
  }
}

export function MilestonesPanel({ milestones }: MilestonesPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Case Milestones</h2>
      <div className="space-y-6">
        {milestones.map((milestone, index) => (
          <div key={`${milestone.title}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-4 h-4 rounded-full ${milestoneDotColor(milestone.status)}`} />
              {index < milestones.length - 1 ? (
                <div className={`w-0.5 h-full mt-2 ${milestone.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`} />
              ) : null}
            </div>
            <div className="flex-1 pb-8">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium text-gray-900">{milestone.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                </div>
                <span
                  className={`text-sm font-medium px-3 py-1 rounded-full ${
                    milestone.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : milestone.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {milestone.status === 'completed'
                    ? 'Completed'
                    : milestone.status === 'in-progress'
                      ? 'In Progress'
                      : 'Upcoming'}
                </span>
              </div>
              <p className="text-xs text-gray-500">{milestone.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
