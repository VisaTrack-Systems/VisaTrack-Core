/** InvitationsPanel: Paginated list of open and expired invitations with revoke and resend actions. */

import { useState } from 'react';

import { Badge, Button, Card, CardHeader, Pagination } from '../ui';
import type { Invitation } from './types';
import { formatDate } from './utils';

const PAGE_SIZE = 10;

type Props = {
  invitations: Invitation[];
  busyInvitationId: string | null;
  onRevoke: (invitationId: string, email: string) => void;
  onResend: (invitationId: string, email: string) => void;
};

function StatusTag({ status }: { status: string }) {
  if (status === 'pending') {
    return <Badge tone="success">Open</Badge>;
  }
  if (status === 'expired') {
    return <Badge>Expired</Badge>;
  }
  return <Badge>{status}</Badge>;
}

export function InvitationsPanel({ invitations, busyInvitationId, onRevoke, onResend }: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  const pending = invitations.filter((i) => i.status === 'pending');
  const expired = invitations.filter((i) => i.status === 'expired');
  const sorted = [...pending, ...expired];

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginated = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Invitations"
        actions={
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              {pending.length} open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-gray-300" aria-hidden="true" />
              {expired.length} expired
            </span>
          </div>
        }
      />
      <ul className="divide-y divide-gray-200">
        {sorted.length === 0 ? (
          <li className="px-5 py-4 text-sm text-gray-500">No invitations found.</li>
        ) : (
          paginated.map((invite) => (
            <li key={invite.invitation_id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">{invite.email}</p>
                  <StatusTag status={invite.status} />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {invite.role_slug}
                  {invite.invited_by_name ? ` • Invited by ${invite.invited_by_name}` : ''}
                  {' • '}Sent {formatDate(invite.created_at)}
                  {invite.status === 'expired'
                    ? ` • Expired ${formatDate(invite.expires_at)}`
                    : ` • Expires ${formatDate(invite.expires_at)}`}
                </p>
              </div>
              {invite.status === 'pending' ? (
                <Button
                  type="button"
                  variant="danger-subtle"
                  size="sm"
                  className="shrink-0"
                  disabled={busyInvitationId === invite.invitation_id}
                  onClick={() => onRevoke(invite.invitation_id, invite.email)}
                >
                  Revoke
                </Button>
              ) : invite.status === 'expired' ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  disabled={busyInvitationId === invite.invitation_id}
                  onClick={() => onResend(invite.invitation_id, invite.email)}
                >
                  {busyInvitationId === invite.invitation_id ? 'Sending…' : 'Resend'}
                </Button>
              ) : (
                <span className="w-16 shrink-0" />
              )}
            </li>
          ))
        )}
      </ul>

      {sorted.length > PAGE_SIZE && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          summary={`${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, sorted.length)} of ${sorted.length}`}
        />
      )}
    </Card>
  );
}
