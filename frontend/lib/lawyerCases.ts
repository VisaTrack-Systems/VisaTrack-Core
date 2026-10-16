import { getLawyerCases, type CaseListItem } from './api';

/** Read every page so older cases and personal flags are not hidden by a page limit. */
export async function loadAllLawyerCases(): Promise<CaseListItem[]> {
  const pageSize = 100;
  let page = await getLawyerCases(pageSize);
  const cases = [...page];
  while (page.length === pageSize) {
    page = await getLawyerCases(pageSize, cases.length);
    cases.push(...page);
  }
  return cases;
}

/** Preserve newest-first ordering within the flagged and unflagged groups. */
export function sortFlaggedCases<T extends { isFlagged?: boolean; createdAt?: string }>(cases: T[]): T[] {
  return [...cases].sort((a, b) => {
    const flagOrder = Number(Boolean(b.isFlagged)) - Number(Boolean(a.isFlagged));
    if (flagOrder !== 0) return flagOrder;
    return (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0);
  });
}
