import { useEffect, useState } from 'react';

import { getLawyerCases } from '@/lib/api';

import type { UiCase } from './types';
import { completionFromStatus, relativeTime, titleize } from './utils';

const fallbackCases: UiCase[] = [
  {
    id: 'C-2024-001',
    clientName: 'Sarah Chen',
    caseType: 'Express Entry',
    status: 'Document Review',
    priority: 'high',
    lastActivity: '2 hours ago',
    nextMilestone: 'Submit to IRCC',
    nextDeadline: 'Feb 15, 2026',
    outstandingDocs: 3,
    outstandingPayments: 1,
    completionPercent: 65,
  },
  {
    id: 'C-2024-002',
    clientName: 'Michael Rodriguez',
    caseType: 'Work Permit',
    status: 'Awaiting Client',
    priority: 'medium',
    lastActivity: '5 hours ago',
    nextMilestone: 'Document Collection',
    nextDeadline: 'Feb 20, 2026',
    outstandingDocs: 7,
    outstandingPayments: 0,
    completionPercent: 30,
  },
];

export function useActiveCasesData() {
  const [cases, setCases] = useState<UiCase[]>(fallbackCases);

  useEffect(() => {
    let ignore = false;

    async function loadCases() {
      try {
        const data = await getLawyerCases(100);
        if (ignore || data.length === 0) {
          return;
        }

        setCases(
          data.map((entry) => ({
            id: entry.case_number,
            clientName: entry.client_name,
            caseType: entry.case_type,
            status: titleize(entry.status),
            priority: entry.priority,
            lastActivity: relativeTime(entry.created_at),
            nextMilestone: `Status: ${titleize(entry.status)}`,
            nextDeadline: entry.target_filing_date
              ? new Date(entry.target_filing_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not set',
            outstandingDocs: 0,
            outstandingPayments: 0,
            completionPercent: completionFromStatus(entry.status),
          }))
        );
      } catch {
        // Keep fallback mock data when API is unavailable.
      }
    }

    loadCases();

    return () => {
      ignore = true;
    };
  }, []);

  return { cases };
}
