/** MilestonesPanel: Vertical timeline (Clio "Timeline" card style) of the client's case milestones. */

import { Badge, Card, CardHeader, type Tone } from '../ui';
import type { DashboardMilestone } from './types';

type MilestonesPanelProps = {
  milestones: DashboardMilestone[];
};

const STATUS_META: Record<DashboardMilestone['status'], { dot: string; tone: Tone; label: string }> = {
  completed: { dot: 'bg-green-500', tone: 'success', label: 'Completed' },
  'in-progress': { dot: 'bg-primary-600', tone: 'primary', label: 'In Progress' },
  upcoming: { dot: 'bg-gray-300', tone: 'neutral', label: 'Upcoming' },
};

export function MilestonesPanel({ milestones }: MilestonesPanelProps) {
  return (
    <Card>
      <CardHeader title="Case Milestones" />
      {milestones.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">No milestones have been added to this case yet.</p>
      ) : (
        <ol className="px-5 py-4">
          {milestones.map((milestone, index) => {
            const meta = STATUS_META[milestone.status] ?? STATUS_META.upcoming;
            const isLast = index === milestones.length - 1;
            return (
              <li key={`${milestone.title}-${index}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-white ${meta.dot}`} aria-hidden="true" />
                  {!isLast ? (
                    <span
                      className={`w-px flex-1 ${milestone.status === 'completed' ? 'bg-green-400' : 'bg-gray-200'}`}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-5'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-gray-900">{milestone.title}</h3>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">{milestone.date}</p>
                  {milestone.description ? (
                    <p className="mt-1 text-sm text-gray-600">{milestone.description}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
