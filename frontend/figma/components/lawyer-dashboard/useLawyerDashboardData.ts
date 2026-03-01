import { useEffect, useMemo, useState } from 'react';

import { getLawyerCases } from '@/lib/api';

import type { ActivityItem, DashboardCase, DashboardStats, DeadlineItem } from './types';
import { daysUntil, relativeTime, titleize } from './utils';

const fallbackStats: DashboardStats = {
  activeCases: 0,
  totalUsers: 0,
  upcomingMilestones: 0,
  completedCases: 0,
};

const fallbackDeadlines: DeadlineItem[] = [];

type LawyerDashboardData = {
  cases: DashboardCase[];
  stats: DashboardStats;
  upcomingDeadlines: DeadlineItem[];
  derivedActivity: ActivityItem[];
};

export function useLawyerDashboardData(): LawyerDashboardData {
  const [cases, setCases] = useState<DashboardCase[]>([]);
  const [stats, setStats] = useState<DashboardStats>(fallbackStats);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<DeadlineItem[]>(fallbackDeadlines);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      try {
        const caseRows = await getLawyerCases(100);
        if (ignore) {
          return;
        }

        setCases(
          caseRows.slice(0, 8).map((entry) => ({
            id: entry.case_number,
            clientName: entry.client_name,
            caseType: entry.case_type,
            status: titleize(entry.status),
            lastUpdate: relativeTime(entry.created_at),
            priority: entry.priority,
            nextDeadline: entry.target_filing_date
              ? new Date(entry.target_filing_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not set',
          }))
        );

        const activeCases = caseRows.filter(
          (entry) => !['approved', 'refused', 'withdrawn', 'closed'].includes(entry.status)
        ).length;
        const completedCases = caseRows.filter((entry) => ['approved', 'closed'].includes(entry.status)).length;

        setStats({
          activeCases,
          totalUsers: 0,
          upcomingMilestones: caseRows.filter((entry) => !!entry.target_filing_date).length,
          completedCases,
        });

        const deadlines = caseRows
          .filter((entry) => entry.target_filing_date)
          .slice(0, 3)
          .map((entry) => ({
            task: `${entry.case_type} filing`,
            client: entry.case_number,
            date: entry.target_filing_date
              ? new Date(entry.target_filing_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              : 'Not set',
            daysLeft: entry.target_filing_date ? daysUntil(entry.target_filing_date) : 0,
          }));
        setUpcomingDeadlines(deadlines);
      } catch {
        setCases([]);
        setStats(fallbackStats);
        setUpcomingDeadlines(fallbackDeadlines);
      }
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  const derivedActivity = useMemo<ActivityItem[]>(
    () =>
      cases.slice(0, 4).map((entry, index) => ({
        action: 'Case updated',
        client: entry.clientName,
        detail: `${entry.caseType} (${entry.id})`,
        time: entry.lastUpdate,
        type: (['document', 'message', 'payment', 'milestone'] as ActivityItem['type'][])[index % 4],
      })),
    [cases]
  );

  return { cases, stats, upcomingDeadlines, derivedActivity };
}
