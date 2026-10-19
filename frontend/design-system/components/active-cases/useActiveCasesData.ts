/** useActiveCasesData: React hook for handling activecasesdata logic and state management. */

import { useCallback, useEffect, useState } from 'react';

import { loadAllLawyerCases, sortFlaggedCases } from '@/lib/lawyerCases';

import { useCaseFlagging } from '../useCaseFlagging';

import type { UiCase } from './types';
import { completionFromStatus, relativeTime, titleize } from './utils';

export function useActiveCasesData() {
  const [cases, setCases] = useState<UiCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const onFlagSaved = useCallback((caseNumber: string, isFlagged: boolean) => {
    setCases((current) => sortFlaggedCases(current.map((entry) =>
      entry.id === caseNumber ? { ...entry, isFlagged } : entry
    )));
  }, []);
  const flagging = useCaseFlagging(onFlagSaved);

  useEffect(() => {
    let ignore = false;

    async function loadCases() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await loadAllLawyerCases();
        if (ignore) {
          return;
        }

        setCases(
          sortFlaggedCases(data.map((entry) => ({
            id: entry.case_number,
            clientName: entry.client_name,
            caseType: entry.case_type,
            status: titleize(entry.status),
            priority: entry.priority,
            isFlagged: entry.is_flagged ?? false,
            createdAt: entry.created_at,
            lawyerName: entry.primary_lawyer_name ?? 'Unassigned',
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
          })))
        );
      } catch {
        if (!ignore) {
          setCases([]);
          setError('Failed to load active cases.');
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadCases();

    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  const retry = () => {
    setReloadToken((current) => current + 1);
  };

  return { cases, isLoading, error, retry, ...flagging };
}
