import { useCallback, useEffect, useRef, useState } from 'react';

import { setLawyerCaseFlag } from '@/lib/api';

export function useCaseFlagging(onSaved: (caseNumber: string, isFlagged: boolean) => void) {
  const [flaggingCaseNumbers, setFlaggingCaseNumbers] = useState<string[]>([]);
  const [flagError, setFlagError] = useState<string | null>(null);
  const pending = useRef(new Set<string>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const toggleFlag = useCallback(async (caseNumber: string, isFlagged: boolean) => {
    if (pending.current.has(caseNumber)) return;
    pending.current.add(caseNumber);
    setFlaggingCaseNumbers([...pending.current]);
    setFlagError(null);
    try {
      const saved = await setLawyerCaseFlag(caseNumber, isFlagged);
      if (mounted.current) onSaved(saved.case_number, saved.is_flagged);
    } catch (error) {
      if (mounted.current) {
        setFlagError(error instanceof Error ? error.message : 'Unable to save your case flag. Please try again.');
      }
    } finally {
      pending.current.delete(caseNumber);
      if (mounted.current) setFlaggingCaseNumbers([...pending.current]);
    }
  }, [onSaved]);

  return { flaggingCaseNumbers, flagError, toggleFlag };
}
