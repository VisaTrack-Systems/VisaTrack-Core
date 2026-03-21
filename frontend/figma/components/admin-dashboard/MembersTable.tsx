import type { AdminRoleItem, OrganizationListItem, UserListItem } from '@/lib/api';

import type { ConfirmDialogState } from './types';
import { formatDate } from './utils';

type Props = {
  users: UserListItem[];
  organizations: OrganizationListItem[];
  roles: AdminRoleItem[];
  isSuperAdmin: boolean;
  currentUserId: string | undefined;
  roleDraftByUserId: Record<string, string>;
  busyRoleUserId: string | null;
  busyDeleteUserId: string | null;
  nameFilter: string;
  roleFilter: string;
  onNameFilterChange: (v: string) => void;
  onRoleFilterChange: (v: string) => void;
  onRoleDraftChange: (userId: string, roleSlug: string) => void;
  openConfirm: (opts: ConfirmDialogState) => void;
  onAssignRole: (user: UserListItem) => void;
  onRemoveRole: (user: UserListItem, roleSlug: string) => void;
  onDeleteUser: (user: UserListItem) => void;
};

export function MembersTable({
  users,
  organizations,
  roles,
  isSuperAdmin,
  currentUserId,
  roleDraftByUserId,
  busyRoleUserId,
  busyDeleteUserId,
  nameFilter,
  roleFilter,
  onNameFilterChange,
  onRoleFilterChange,
  onRoleDraftChange,
  openConfirm,
  onAssignRole,
  onRemoveRole,
  onDeleteUser,
}: Props) {
  const filtered = users.filter((u) => {
    const nameMatch = u.full_name.toLowerCase().includes(nameFilter.toLowerCase());
    const roleMatch = roleFilter === '' || u.roles.includes(roleFilter);
    return nameMatch && roleMatch;
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-gray-900 mr-auto">All Members</h3>
        <input
          type="text"
          placeholder="Filter by name…"
          value={nameFilter}
          onChange={(e) => onNameFilterChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-500 w-48"
        />
        <select
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          <option value="">All roles</option>
          {roles
            .filter((r) => r.slug !== 'super_admin')
            .map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
        </select>
        {(nameFilter !== '' || roleFilter !== '') && (
          <button
            type="button"
            onClick={() => {
              onNameFilterChange('');
              onRoleFilterChange('');
            }}
            className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors text-gray-700"
          >
            Reset filters
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Name</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Email</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Organization</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Roles</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Created</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Manage Roles</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((user) => {
              const org = organizations.find((o) => o.id === user.organization_id);
              const assignable = roles.filter(
                (r) => !user.roles.includes(r.slug) && (isSuperAdmin || r.slug !== 'super_admin'),
              );
              const selectedRole = roleDraftByUserId[user.id] ?? assignable[0]?.slug ?? '';
              const roleBusy = busyRoleUserId === user.id;

              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{org?.name ?? 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className="flex flex-wrap gap-2">
                      {user.roles.length === 0 ? (
                        <span className="text-xs text-gray-500">No roles</span>
                      ) : (
                        user.roles.map((role) => (
                          <button
                            key={role}
                            type="button"
                            onClick={() =>
                              openConfirm({
                                title: 'Remove Role',
                                message: `Remove "${role}" from ${user.full_name}? They will lose access to features granted by this role.`,
                                confirmLabel: 'Remove',
                                variant: 'danger',
                                onConfirm: () => onRemoveRole(user, role),
                              })
                            }
                            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            disabled={roleBusy}
                            title="Remove role"
                          >
                            {role} ×
                          </button>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{user.status}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(user.created_at)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedRole}
                        onChange={(e) => onRoleDraftChange(user.id, e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-xs"
                        disabled={roleBusy || assignable.length === 0}
                      >
                        {assignable.length === 0 ? (
                          <option value="">No available roles</option>
                        ) : (
                          assignable.map((r) => (
                            <option key={r.id} value={r.slug}>
                              {r.name}
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        className="border border-gray-300 px-3 py-1 rounded-lg text-xs hover:bg-gray-100 disabled:opacity-50"
                        disabled={roleBusy || !selectedRole || assignable.length === 0}
                        onClick={() =>
                          openConfirm({
                            title: 'Assign Role',
                            message: `Assign "${selectedRole}" to ${user.full_name}?`,
                            confirmLabel: 'Assign',
                            variant: 'info',
                            onConfirm: () => onAssignRole(user),
                          })
                        }
                      >
                        Add
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <button
                      type="button"
                      className="border border-red-200 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                      disabled={busyDeleteUserId === user.id || currentUserId === user.id}
                      onClick={() =>
                        openConfirm({
                          title: 'Delete User',
                          message: `Permanently delete ${user.full_name} (${user.email})? This action cannot be undone.`,
                          confirmLabel: 'Delete',
                          variant: 'danger',
                          onConfirm: () => onDeleteUser(user),
                        })
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
