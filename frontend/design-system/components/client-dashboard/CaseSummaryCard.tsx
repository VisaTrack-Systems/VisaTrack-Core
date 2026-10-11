/**
 * CaseSummaryCard: Client's case details (Clio "Details" card style) as label/value rows.
 * LegalTeamCard: Clio "Contacts"-style card showing the client's assigned lawyer.
 */

import { Badge, Card, CardHeader } from '../ui';
import type { CaseInfo } from './types';

type CaseInfoProps = {
  caseInfo: CaseInfo;
};

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2.5 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{children}</dd>
    </div>
  );
}

export function CaseSummaryCard({ caseInfo }: CaseInfoProps) {
  return (
    <Card>
      <CardHeader title="Case Details" />
      <div className="px-5 py-2">
        <dl className="divide-y divide-gray-100">
          <DetailRow label="Case type">{caseInfo.type}</DetailRow>
          <DetailRow label="Case ID">{caseInfo.id}</DetailRow>
          <DetailRow label="Status">
            <Badge tone="primary">{caseInfo.status}</Badge>
          </DetailRow>
          <DetailRow label="Start date">{caseInfo.startDate}</DetailRow>
          <DetailRow label="Estimated completion">{caseInfo.estimatedCompletion}</DetailRow>
        </dl>
      </div>
      {caseInfo.description ? (
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Case Description</p>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{caseInfo.description}</p>
        </div>
      ) : null}
    </Card>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

export function LegalTeamCard({ caseInfo }: CaseInfoProps) {
  return (
    <Card>
      <CardHeader title="Legal Team" />
      <div className="flex items-center gap-3 px-5 py-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700"
        >
          {initialsOf(caseInfo.assignedLawyer)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{caseInfo.assignedLawyer}</p>
          <p className="text-sm text-gray-500">Assigned Lawyer</p>
        </div>
      </div>
    </Card>
  );
}
