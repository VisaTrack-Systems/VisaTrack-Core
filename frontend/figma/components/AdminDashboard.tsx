import { RefreshCw, Shield, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

import {
  assignAdminRole,
  assignAdminCaseLawyer,
  type AdminCreateOrganizationInput,
  type AdminOperations,
  type AdminRoleItem,
  type AdminCreateUserInput,
  type CurrentUser,
  type OrganizationListItem,
  type UserListItem,
  createAdminOrganization,
  createAdminUser,
  deleteAdminOrganization,
  deleteAdminUser,
  getAdminOrganizations,
  getAdminOperations,
  getAdminRoles,
  getAdminUsers,
  removeAdminRole,
  revokeAdminInvitation,
  sendInvitationEmail,
} from '@/lib/api';

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'info';
  onConfirm: () => void;
};

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  variant,
  onConfirm,
  onClose,
}: ConfirmDialogState & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${
              variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type CreateSummaryField = { label: string; value: string };

function CreateSummaryDialog({
  title,
  fields,
  onConfirm,
  onClose,
}: {
  title: string;
  fields: CreateSummaryField[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-500 mb-4">Please review the details below before confirming.</p>
          <dl className="space-y-3">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <dt className="text-gray-500 font-medium shrink-0">{label}</dt>
                <dd className="text-gray-900 text-right break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type FlashState = {
  kind: 'success' | 'error';
  message: string;
} | null;

const initialOrgForm: AdminCreateOrganizationInput = {
  name: '',
  contact_email: '',
  slug: '',
  subscription_tier: 'basic',
  subscription_status: 'active',
};

const initialUserForm: AdminCreateUserInput = {
  organization_id: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  status: 'active',
  role_slug: 'lawyer',
};

type AdminDashboardProps = {
  currentUser: CurrentUser | null;
};

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState>(null);

  const [operations, setOperations] = useState<AdminOperations | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);

  const [orgForm, setOrgForm] = useState(initialOrgForm);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<string, string>>({});
  const [busyRoleUserId, setBusyRoleUserId] = useState<string | null>(null);
  const [caseAssignmentDraft, setCaseAssignmentDraft] = useState<Record<string, string>>({});
  const [busyCaseNumber, setBusyCaseNumber] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [busyOrganizationId, setBusyOrganizationId] = useState<string | null>(null);
  const [busyDeleteUserId, setBusyDeleteUserId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const openConfirm = (options: ConfirmDialogState) => setConfirmDialog(options);
  const closeConfirm = () => setConfirmDialog(null);
  const [pendingOrgCreate, setPendingOrgCreate] = useState<AdminCreateOrganizationInput | null>(null);
  const [pendingUserCreate, setPendingUserCreate] = useState<AdminCreateUserInput | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [inviteEmailDraft, setInviteEmailDraft] = useState('');
  const [inviteEmailStatus, setInviteEmailStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [inviteEmailError, setInviteEmailError] = useState<string | null>(null);
  const [userNameFilter, setUserNameFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');

  const isSuperAdmin = currentUser?.active_role === 'super_admin';

  const loadAdminData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [organizationsData, usersData, rolesData, operationsData] = await Promise.all([
        getAdminOrganizations(100),
        getAdminUsers(200),
        getAdminRoles(),
        getAdminOperations(),
      ]);

      setOrganizations(organizationsData);
      setUsers(usersData);
      setRoles(rolesData);
      setOperations(operationsData);
      setError(null);

      if (!userForm.organization_id && organizationsData.length > 0) {
        setUserForm((previous) => ({
          ...previous,
          organization_id: organizationsData[0].id,
        }));
      }

      setRoleDraftByUserId((previous) => {
        const next = { ...previous };
        for (const user of usersData) {
          if (!next[user.id]) {
            const firstMissingRole = rolesData.find((role) => !user.roles.includes(role.slug));
            next[user.id] = firstMissingRole?.slug ?? rolesData[0]?.slug ?? 'lawyer';
          }
        }
        return next;
      });

      setCaseAssignmentDraft((previous) => {
        const next = { ...previous };
        for (const caseItem of operationsData.unassigned_cases) {
          if (!next[caseItem.case_number]) {
            next[caseItem.case_number] = operationsData.lawyer_workload[0]?.lawyer_user_id ?? '';
          }
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAdminData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.active_role]);

  const handleCreateOrganization = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingOrgCreate({ ...orgForm, slug: orgForm.slug.trim() });
  };

  const executeCreateOrganization = async () => {
    if (!pendingOrgCreate) return;
    try {
      const created = await createAdminOrganization(pendingOrgCreate);
      setOrgForm(initialOrgForm);
      setFlash({ kind: 'success', message: `Organization created: ${created.name}` });
      await loadAdminData(true);
    } catch (createError) {
      setFlash({
        kind: 'error',
        message: createError instanceof Error ? createError.message : 'Failed to create organization',
      });
    }
  };

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingUserCreate({ ...userForm });
  };

  const executeCreateUser = async () => {
    if (!pendingUserCreate) return;
    try {
      const created = await createAdminUser(pendingUserCreate);
      setUserForm((previous) => ({
        ...initialUserForm,
        organization_id: previous.organization_id,
      }));
      if (created.invitation_url) {
        setInvitationUrl(created.invitation_url);
      } else {
        setFlash({ kind: 'success', message: `User created: ${created.full_name}` });
      }
      await loadAdminData(true);
    } catch (createError) {
      setFlash({
        kind: 'error',
        message: createError instanceof Error ? createError.message : 'Failed to create user',
      });
    }
  };

  const handleAssignRole = async (user: UserListItem) => {
    const nextRole = roleDraftByUserId[user.id]?.trim();
    if (!nextRole || user.roles.includes(nextRole)) {
      return;
    }

    setBusyRoleUserId(user.id);
    try {
      await assignAdminRole(user.id, nextRole);
      setFlash({ kind: 'success', message: `Assigned ${nextRole} to ${user.full_name}` });
      await loadAdminData(true);
    } catch (roleError) {
      setFlash({
        kind: 'error',
        message: roleError instanceof Error ? roleError.message : 'Failed to assign role',
      });
    } finally {
      setBusyRoleUserId(null);
    }
  };

  const handleRemoveRole = async (user: UserListItem, roleSlug: string) => {
    setBusyRoleUserId(user.id);
    try {
      await removeAdminRole(user.id, roleSlug);
      setFlash({ kind: 'success', message: `Removed ${roleSlug} from ${user.full_name}` });
      await loadAdminData(true);
    } catch (roleError) {
      setFlash({
        kind: 'error',
        message: roleError instanceof Error ? roleError.message : 'Failed to remove role',
      });
    } finally {
      setBusyRoleUserId(null);
    }
  };

  const handleAssignCase = async (caseNumber: string) => {
    const selectedLawyerId = caseAssignmentDraft[caseNumber];
    if (!selectedLawyerId) {
      return;
    }

    setBusyCaseNumber(caseNumber);
    try {
      await assignAdminCaseLawyer(caseNumber, { lawyer_user_id: selectedLawyerId });
      setFlash({ kind: 'success', message: `Assigned case ${caseNumber}` });
      await loadAdminData(true);
    } catch (assignError) {
      setFlash({
        kind: 'error',
        message: assignError instanceof Error ? assignError.message : 'Failed to assign case',
      });
    } finally {
      setBusyCaseNumber(null);
    }
  };

  const handleDeleteOrganization = async (organization: OrganizationListItem) => {
    if (!isSuperAdmin) {
      return;
    }

    setBusyOrganizationId(organization.id);
    try {
      await deleteAdminOrganization(organization.id);
      setFlash({ kind: 'success', message: `Deleted organization: ${organization.name}` });
      await loadAdminData(true);
    } catch (deleteError) {
      setFlash({
        kind: 'error',
        message: deleteError instanceof Error ? deleteError.message : 'Failed to delete organization',
      });
    } finally {
      setBusyOrganizationId(null);
    }
  };

  const handleDeleteUser = async (user: UserListItem) => {
    setBusyDeleteUserId(user.id);
    try {
      await deleteAdminUser(user.id);
      setFlash({ kind: 'success', message: `Deleted user: ${user.full_name}` });
      await loadAdminData(true);
    } catch (deleteError) {
      setFlash({
        kind: 'error',
        message: deleteError instanceof Error ? deleteError.message : 'Failed to delete user',
      });
    } finally {
      setBusyDeleteUserId(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    setBusyInvitationId(invitationId);
    try {
      await revokeAdminInvitation(invitationId);
      setFlash({ kind: 'success', message: `Revoked invitation for ${email}` });
      await loadAdminData(true);
    } catch (inviteError) {
      setFlash({
        kind: 'error',
        message: inviteError instanceof Error ? inviteError.message : 'Failed to revoke invitation',
      });
    } finally {
      setBusyInvitationId(null);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Loading admin dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-50 p-10 text-red-600">Failed to load admin dashboard: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-red-600" />
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">Manage organizations, users, and platform activity.</p>
            </div>
            <button
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              onClick={() => void loadAdminData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {flash ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              flash.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {flash.message}
          </div>
        ) : null}

        <div className="grid xl:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Case Assignment Queue</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {(operations?.unassigned_cases ?? []).length === 0 ? (
                <div className="px-6 py-5 text-sm text-gray-500">No unassigned active cases.</div>
              ) : (
                (operations?.unassigned_cases ?? []).map((caseItem) => (
                  <div key={caseItem.case_id} className="px-6 py-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                      <p className="text-sm text-gray-600">
                        {caseItem.case_type} • {caseItem.status} • Open {caseItem.days_open} days
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={caseAssignmentDraft[caseItem.case_number] ?? ''}
                        onChange={(event) =>
                          setCaseAssignmentDraft((previous) => ({
                            ...previous,
                            [caseItem.case_number]: event.target.value,
                          }))
                        }
                        className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-xs"
                        disabled={(operations?.lawyer_workload ?? []).length === 0 || busyCaseNumber === caseItem.case_number}
                      >
                        {(operations?.lawyer_workload ?? []).length === 0 ? (
                          <option value="">No lawyers available</option>
                        ) : (
                          (operations?.lawyer_workload ?? []).map((lawyer) => (
                            <option key={lawyer.lawyer_user_id} value={lawyer.lawyer_user_id}>
                              {lawyer.full_name} ({lawyer.active_cases})
                            </option>
                          ))
                        )}
                      </select>
                      <button
                        type="button"
                        className="border border-gray-300 px-3 py-1 rounded-lg text-xs hover:bg-gray-100 disabled:opacity-50"
                        disabled={busyCaseNumber === caseItem.case_number || !caseAssignmentDraft[caseItem.case_number]}
                        onClick={() => void handleAssignCase(caseItem.case_number)}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Lawyer Workload</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {(operations?.lawyer_workload ?? []).length === 0 ? (
                <div className="px-6 py-5 text-sm text-gray-500">No active lawyers found.</div>
              ) : (
                (operations?.lawyer_workload ?? [])
                  .slice()
                  .sort((a, b) => b.active_cases - a.active_cases)
                  .map((lawyer) => (
                    <div key={lawyer.lawyer_user_id} className="px-6 py-4 flex items-center justify-between">
                      <p className="text-sm text-gray-800">{lawyer.full_name}</p>
                      <span className="text-sm font-semibold text-gray-900">{lawyer.active_cases} active</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Aging Cases</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {(operations?.aging_cases ?? []).length === 0 ? (
                <div className="px-6 py-5 text-sm text-gray-500">No active cases found.</div>
              ) : (
                (operations?.aging_cases ?? []).slice(0, 12).map((caseItem) => (
                  <div key={caseItem.case_id} className="px-6 py-4">
                    <p className="font-medium text-gray-900">{caseItem.case_number}</p>
                    <p className="text-sm text-gray-600">
                      {caseItem.case_type} • {caseItem.status} • {caseItem.days_open} days open
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Lawyer: {caseItem.primary_lawyer_name ?? 'Unassigned'}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Pending Invitations</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {(operations?.pending_invitations ?? []).length === 0 ? (
                <div className="px-6 py-5 text-sm text-gray-500">No pending invitations.</div>
              ) : (
                (operations?.pending_invitations ?? []).map((invite) => (
                  <div key={invite.invitation_id} className="px-6 py-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{invite.email}</p>
                      <p className="text-sm text-gray-600">
                        {invite.role_slug} • Sent {formatDate(invite.created_at)} • Expires {formatDate(invite.expires_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="border border-red-200 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                      disabled={busyInvitationId === invite.invitation_id}
                      onClick={() => void handleRevokeInvitation(invite.invitation_id, invite.email)}
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {isSuperAdmin ? (
            <form onSubmit={handleCreateOrganization} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Organization</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
                <input
                  required
                  type="text"
                  value={orgForm.name}
                  onChange={(event) => setOrgForm((previous) => ({ ...previous, name: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  required
                  type="email"
                  value={orgForm.contact_email}
                  onChange={(event) => setOrgForm((previous) => ({ ...previous, contact_email: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  required
                  type="text"
                  value={orgForm.slug}
                  onChange={(event) => setOrgForm((previous) => ({ ...previous, slug: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                  placeholder="acme-immigration"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                  <select
                    value={orgForm.subscription_tier}
                    onChange={(event) => setOrgForm((previous) => ({ ...previous, subscription_tier: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={orgForm.subscription_status}
                    onChange={(event) => setOrgForm((previous) => ({ ...previous, subscription_status: event.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
                Create Organization
              </button>
            </form>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold text-gray-900">Organization Scope</h2>
              <p className="mt-2 text-sm text-gray-600">
                Organization admins can manage users and case operations only for their own organization.
              </p>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create User</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <select
                required
                value={userForm.organization_id}
                onChange={(event) => setUserForm((previous) => ({ ...previous, organization_id: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="" disabled>
                  Select organization
                </option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  required
                  type="text"
                  placeholder="First"
                  value={userForm.first_name}
                  onChange={(event) => setUserForm((previous) => ({ ...previous, first_name: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  required
                  type="text"
                  placeholder="Last"
                  value={userForm.last_name}
                  onChange={(event) => setUserForm((previous) => ({ ...previous, last_name: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                required
                type="email"
                placeholder="first@example.com"
                value={userForm.email}
                onChange={(event) => setUserForm((previous) => ({ ...previous, email: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
              <input
                required
                minLength={8}
                type="password"
                placeholder="Min. 8 characters"
                value={userForm.password}
                onChange={(event) => setUserForm((previous) => ({ ...previous, password: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={userForm.status}
                onChange={(event) => setUserForm((previous) => ({ ...previous, status: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="invited">Invited</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={userForm.role_slug}
                onChange={(event) => setUserForm((previous) => ({ ...previous, role_slug: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                {roles.length === 0 ? (
                  <option value="lawyer">Lawyer</option>
                ) : (
                  roles
                    .filter((role) => isSuperAdmin || role.slug !== 'super_admin')
                    .map((role) => (
                      <option key={role.id} value={role.slug}>
                        {role.name}
                      </option>
                    ))
                )}
              </select>
            </div>
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
              Create User
            </button>
          </form>
        </div>

        <div className="grid xl:grid-cols-2 gap-8">
          {isSuperAdmin ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Organizations</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {organizations.map((organization) => (
                  <div key={organization.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{organization.name}</p>
                        <p className="text-sm text-gray-600">{organization.slug} • {organization.contact_email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{formatDate(organization.created_at)}</p>
                        <p className="text-xs font-medium text-green-700">{organization.subscription_status}</p>
                        <button
                          type="button"
                          className="mt-2 border border-red-200 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
                          disabled={
                            busyOrganizationId === organization.id || currentUser?.organization_id === organization.id
                          }
                          onClick={() =>
                            openConfirm({
                              title: 'Delete Organization',
                              message: `Delete "${organization.name}"? This will block all logins for this organization and cannot be undone.`,
                              confirmLabel: 'Delete',
                              variant: 'danger',
                              onConfirm: () => {
                                void handleDeleteOrganization(organization);
                              },
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Recent Users</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {users.slice(0, 8).map((user) => (
                <div key={user.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(user.created_at)}</p>
                      <p className="text-xs font-medium text-blue-700">{user.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-gray-900 mr-auto">All Users</h3>
            <input
              type="text"
              placeholder="Filter by name…"
              value={userNameFilter}
              onChange={(event) => setUserNameFilter(event.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-red-500 w-48"
            />
            <select
              value={userRoleFilter}
              onChange={(event) => setUserRoleFilter(event.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
            >
              <option value="">All roles</option>
              {roles
                .filter((role) => role.slug !== 'super_admin')
                .map((role) => (
                  <option key={role.id} value={role.slug}>
                    {role.name}
                  </option>
                ))}
            </select>
            {(userNameFilter !== '' || userRoleFilter !== '') && (
              <button
                type="button"
                onClick={() => { setUserNameFilter(''); setUserRoleFilter(''); }}
                className="bg-red-500 border border-gray-300 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50 transition-colors"
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
                {users
                  .filter((user) => {
                    const nameMatch = user.full_name.toLowerCase().includes(userNameFilter.toLowerCase());
                    const roleMatch = userRoleFilter === '' || user.roles.includes(userRoleFilter);
                    return nameMatch && roleMatch;
                  })
                  .map((user) => {
                  const organization = organizations.find((entry) => entry.id === user.organization_id);
                  const assignableRoles = roles.filter(
                    (role) => !user.roles.includes(role.slug) && (isSuperAdmin || role.slug !== 'super_admin')
                  );
                  const selectedRole = roleDraftByUserId[user.id] ?? assignableRoles[0]?.slug ?? '';
                  const roleBusy = busyRoleUserId === user.id;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{organization?.name ?? 'N/A'}</td>
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
                                    onConfirm: () => {
                                      void handleRemoveRole(user, role);
                                    },
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
                            onChange={(event) =>
                              setRoleDraftByUserId((previous) => ({
                                ...previous,
                                [user.id]: event.target.value,
                              }))
                            }
                            className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-xs"
                            disabled={roleBusy || assignableRoles.length === 0}
                          >
                            {assignableRoles.length === 0 ? (
                              <option value="">No available roles</option>
                            ) : (
                              assignableRoles.map((role) => (
                                <option key={role.id} value={role.slug}>
                                  {role.name}
                                </option>
                              ))
                            )}
                          </select>
                          <button
                            type="button"
                            className="border border-gray-300 px-3 py-1 rounded-lg text-xs hover:bg-gray-100 disabled:opacity-50"
                            disabled={roleBusy || !selectedRole || assignableRoles.length === 0}
                            onClick={() =>
                              openConfirm({
                                title: 'Assign Role',
                                message: `Assign "${selectedRole}" to ${user.full_name}?`,
                                confirmLabel: 'Assign',
                                variant: 'info',
                                onConfirm: () => {
                                  void handleAssignRole(user);
                                },
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
                          disabled={busyDeleteUserId === user.id || currentUser?.id === user.id}
                          onClick={() =>
                            openConfirm({
                              title: 'Delete User',
                              message: `Permanently delete ${user.full_name} (${user.email})? This action cannot be undone.`,
                              confirmLabel: 'Delete',
                              variant: 'danger',
                              onConfirm: () => {
                                void handleDeleteUser(user);
                              },
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
      </div>

      {confirmDialog ? (
        <ConfirmDialog
          {...confirmDialog}
          onClose={closeConfirm}
        />
      ) : null}

      {pendingOrgCreate ? (
        <CreateSummaryDialog
          title="Confirm Create Organization"
          fields={[
            { label: 'Organization Name', value: pendingOrgCreate.name },
            { label: 'Contact Email', value: pendingOrgCreate.contact_email },
            { label: 'Slug', value: pendingOrgCreate.slug },
            { label: 'Subscription Tier', value: pendingOrgCreate.subscription_tier ?? '' },
            { label: 'Subscription Status', value: pendingOrgCreate.subscription_status ?? '' },
          ]}
          onConfirm={() => void executeCreateOrganization()}
          onClose={() => setPendingOrgCreate(null)}
        />
      ) : null}

      {pendingUserCreate ? (
        <CreateSummaryDialog
          title="Confirm Create User"
          fields={[
            {
              label: 'Organization',
              value: organizations.find((o) => o.id === pendingUserCreate.organization_id)?.name ?? pendingUserCreate.organization_id,
            },
            { label: 'First Name', value: pendingUserCreate.first_name },
            { label: 'Last Name', value: pendingUserCreate.last_name },
            { label: 'Email', value: pendingUserCreate.email },
            { label: 'Role', value: pendingUserCreate.role_slug ?? '' },
            { label: 'Status', value: pendingUserCreate.status ?? '' },
            { label: 'Temporary Password', value: '••••••••' },
          ]}
          onConfirm={() => void executeCreateUser()}
          onClose={() => setPendingUserCreate(null)}
        />
      ) : null}

      {invitationUrl ? (
        <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-xl">
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Invitation link ready</h2>
              <button
                type="button"
                onClick={() => { setInvitationUrl(null); setInviteEmailDraft(''); setInviteEmailStatus('idle'); setInviteEmailError(null); }}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Share this link with the user so they can set their password and activate their account. It expires in 72 hours.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={invitationUrl}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 bg-gray-50 truncate"
                  />
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(invitationUrl)}
                    className="border border-gray-300 px-3 py-2 rounded-lg text-xs hover:bg-gray-100 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Send via email</p>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="recipient@example.com"
                    value={inviteEmailDraft}
                    onChange={(e) => { setInviteEmailDraft(e.target.value); setInviteEmailError(null); }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    disabled={!inviteEmailDraft || inviteEmailStatus === 'sending' || inviteEmailStatus === 'sent'}
                    onClick={() => {
                      if (!inviteEmailDraft || !invitationUrl) return;
                      setInviteEmailStatus('sending');
                      setInviteEmailError(null);
                      const recipientName = pendingUserCreate
                        ? `${pendingUserCreate.first_name} ${pendingUserCreate.last_name}`.trim()
                        : inviteEmailDraft;
                      const orgName = organizations.find((o) => o.id === userForm.organization_id)?.name;
                      void sendInvitationEmail(inviteEmailDraft, recipientName, invitationUrl, orgName)
                        .then(() => setInviteEmailStatus('sent'))
                        .catch((err: unknown) => {
                          setInviteEmailStatus('idle');
                          setInviteEmailError(err instanceof Error ? err.message : 'Failed to send email.');
                        });
                    }}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white transition-colors"
                  >
                    {inviteEmailStatus === 'sending' ? 'Sending…' : inviteEmailStatus === 'sent' ? 'Sent ✓' : 'Send'}
                  </button>
                </div>
                {inviteEmailStatus === 'sent' && (
                  <p className="mt-1.5 text-xs text-green-600">Email sent successfully.</p>
                )}
                {inviteEmailError ? (
                  <p className="mt-1.5 text-xs text-red-600">{inviteEmailError}</p>
                ) : null}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => { setInvitationUrl(null); setInviteEmailDraft(''); setInviteEmailStatus('idle'); setInviteEmailError(null); }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
