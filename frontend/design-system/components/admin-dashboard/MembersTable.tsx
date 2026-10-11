/** MembersTable: Paginated, filterable table of organization members with role management and delete actions. */

import { type RefObject, useState } from 'react';

import type { AdminRoleItem, OrganizationListItem, UserListItem } from '@/lib/api';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Pagination,
  Select,
  TableBody,
  TableHead,
  TableRow,
  Td,
  Th,
  type Tone,
} from '../ui';
import type { ConfirmDialogState } from './types';
import { formatDate } from './utils';

const PAGE_SIZE = 15;

/** Badge colour for a user account status. */
function statusTone(status: string): Tone {
  if (status === 'active') return 'success';
  if (status === 'invited' || status === 'pending') return 'warning';
  return 'neutral';
}

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
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
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
  scrollContainerRef,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = users.filter((u) => {
    const nameMatch = u.full_name.toLowerCase().includes(nameFilter.toLowerCase());
    const roleMatch = roleFilter === '' || u.roles.includes(roleFilter);
    return nameMatch && roleMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const handleFilterChange = (change: () => void) => {
    change();
    setCurrentPage(1);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="All Members"
        className="flex-wrap"
        actions={
          <>
            <div className="w-48">
              <Input
                compact
                type="text"
                aria-label="Filter by name"
                placeholder="Filter by name…"
                value={nameFilter}
                onChange={(e) => handleFilterChange(() => onNameFilterChange(e.target.value))}
              />
            </div>
            <div className="w-36">
              <Select
                compact
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(e) => handleFilterChange(() => onRoleFilterChange(e.target.value))}
              >
                <option value="">All roles</option>
                {roles
                  .filter((r) => r.slug !== 'super_admin')
                  .map((r) => (
                    <option key={r.id} value={r.slug}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            </div>
            {(nameFilter !== '' || roleFilter !== '') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleFilterChange(() => { onNameFilterChange(''); onRoleFilterChange(''); })}
              >
                Reset filters
              </Button>
            )}
          </>
        }
      />
      <div ref={scrollContainerRef} className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <TableHead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Organization</Th>
              <Th>Roles</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Manage Roles</Th>
              <Th>Actions</Th>
            </tr>
          </TableHead>
          <TableBody>
            {paginated.map((user) => {
              const org = organizations.find((o) => o.id === user.organization_id);
              const assignable = roles.filter(
                (r) => !user.roles.includes(r.slug) && (isSuperAdmin || r.slug !== 'super_admin'),
              );
              const selectedRole = roleDraftByUserId[user.id] ?? assignable[0]?.slug ?? '';
              const roleBusy = busyRoleUserId === user.id;

              return (
                <TableRow key={user.id}>
                  <Td className="whitespace-nowrap font-medium text-gray-900">{user.full_name}</Td>
                  <Td>{user.email}</Td>
                  <Td className="whitespace-nowrap">{org?.name ?? 'N/A'}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
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
                            className="inline-flex items-center rounded bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 ring-1 ring-inset ring-primary-200 transition-colors hover:bg-red-50 hover:text-red-700 hover:ring-red-200 disabled:opacity-50"
                            disabled={roleBusy}
                            title="Remove role"
                          >
                            {role} ×
                          </button>
                        ))
                      )}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-gray-500">{formatDate(user.created_at)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-36">
                        <Select
                          compact
                          aria-label={`Role to add for ${user.full_name}`}
                          value={selectedRole}
                          onChange={(e) => onRoleDraftChange(user.id, e.target.value)}
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
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
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
                      </Button>
                    </div>
                  </Td>
                  <Td>
                    <Button
                      type="button"
                      variant="danger-subtle"
                      size="sm"
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
                    </Button>
                  </Td>
                </TableRow>
              );
            })}
          </TableBody>
        </table>
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        summary={
          filtered.length === 0
            ? 'No members'
            : `${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, filtered.length)} of ${filtered.length}`
        }
      />
    </Card>
  );
}
