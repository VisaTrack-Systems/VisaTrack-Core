import type { Invitation } from './types';
import { formatDate } from './utils';

type Props = {
  invitations: Invitation[];
  busyInvitationId: string | null;
  onRevoke: (invitationId: string, email: string) => void;
};

function StatusTag({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-medium text-green-700">
        Open
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
      {status}
    </span>
  );
}

export function InvitationsPanel({ invitations, busyInvitationId, onRevoke }: Props) {
  const pending = invitations.filter((i) => i.status === 'pending');
  const expired = invitations.filter((i) => i.status === 'expired');
  const sorted = [...pending, ...expired];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Invitations</h3>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            {pending.length} open
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
            {expired.length} expired
          </span>
        </div>
      </div>
      <div className="divide-y divide-gray-200">
        {sorted.length === 0 ? (
          <div className="px-6 py-5 text-sm text-gray-500">No invitations found.</div>
        ) : (
          sorted.map((invite) => (
            <div key={invite.invitation_id} className="px-6 py-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900 truncate">{invite.email}</p>
                  <StatusTag status={invite.status} />
                </div>
                <p className="text-sm text-gray-600 mt-0.5">
                  {invite.role_slug}
                  {invite.invited_by_name ? ` • Invited by ${invite.invited_by_name}` : ''}
                  {' • '}Sent {formatDate(invite.created_at)}
                  {invite.status === 'expired'
                    ? ` • Expired ${formatDate(invite.expires_at)}`
                    : ` • Expires ${formatDate(invite.expires_at)}`}
                </p>
              </div>
              {invite.status === 'pending' ? (
                <button
                  type="button"
                  className="shrink-0 border border-red-200 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                  disabled={busyInvitationId === invite.invitation_id}
                  onClick={() => onRevoke(invite.invitation_id, invite.email)}
                >
                  Revoke
                </button>
              ) : (
                <span className="shrink-0 w-16" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
