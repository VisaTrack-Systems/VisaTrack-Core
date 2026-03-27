/** AdminDashboard: Administrative dashboard for system and organization management. Provides system overview, user management, organization settings, and billing controls. */

import { RefreshCw } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';

import {
  assignAdminRole,
  assignAdminCaseLawyer,
  type AdminCreateOrganizationInput,
  type AdminCreateUserInput,
  type CurrentUser,
  type OrganizationListItem,
  type UserListItem,
  createAdminOrganization,
  createAdminUser,
  deleteAdminOrganization,
  deleteAdminUser,
  removeAdminRole,
  revokeAdminInvitation,
  resendAdminInvitation,
} from '@/lib/api';

import { InvitationLinkDialog } from './InvitationLinkDialog';

import { ActiveCasesPanel } from './lawyer-dashboard/ActiveCasesPanel';
import { useLawyerDashboardData } from './lawyer-dashboard/useLawyerDashboardData';

import { AdminCaseHistory } from './admin-dashboard/AdminCaseHistory';
import { AdminSettingsBilling } from './admin-dashboard/AdminSettingsBilling';
import { AdminSettingsGeneral } from './admin-dashboard/AdminSettingsGeneral';
import { AdminSidebar } from './admin-dashboard/AdminSidebar';
import { AdminStatsGrid } from './admin-dashboard/AdminStatsGrid';
import { AgingCasesPanel } from './admin-dashboard/AgingCasesPanel';
import { CaseAssignmentQueue } from './admin-dashboard/CaseAssignmentQueue';
import { ConfirmDialog } from './admin-dashboard/ConfirmDialog';
import { CreateOrgPanel } from './admin-dashboard/CreateOrgPanel';
import { CreateSummaryDialog } from './admin-dashboard/CreateSummaryDialog';
import { CreateUserForm } from './admin-dashboard/CreateUserForm';
import { InvitationsPanel } from './admin-dashboard/InvitationsPanel';
import { LawyerWorkloadPanel } from './admin-dashboard/LawyerWorkloadPanel';
import { MembersTable } from './admin-dashboard/MembersTable';
import { useAdminData } from './admin-dashboard/useAdminData';
import type { AdminSection, ConfirmDialogState, FlashState } from './admin-dashboard/types';

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
  onSelectCase?: (caseId: string) => void;
};

export function AdminDashboard({ currentUser, onSelectCase }: AdminDashboardProps) {
  const {
    loading,
    error,
    refreshing,
    organizations,
    users,
    roles,
    operations,
    roleDraftByUserId,
    setRoleDraftByUserId,
    caseAssignmentDraft,
    setCaseAssignmentDraft,
    refresh,
  } = useAdminData(currentUser?.active_role);

  const { cases: lawyerCases, isLoading: casesLoading } = useLawyerDashboardData();

  const [flash, setFlash] = useState<FlashState>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>('home');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [pendingOrgCreate, setPendingOrgCreate] = useState<AdminCreateOrganizationInput | null>(null);
  const [pendingUserCreate, setPendingUserCreate] = useState<AdminCreateUserInput | null>(null);
  const [busyRoleUserId, setBusyRoleUserId] = useState<string | null>(null);
  const [busyCaseNumber, setBusyCaseNumber] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const [busyOrganizationId, setBusyOrganizationId] = useState<string | null>(null);
  const [busyDeleteUserId, setBusyDeleteUserId] = useState<string | null>(null);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [invitedUserName, setInvitedUserName] = useState<string | null>(null);
  const [invitedUserEmail, setInvitedUserEmail] = useState('');
  const [invitedOrgName, setInvitedOrgName] = useState<string | undefined>(undefined);
  const [orgForm, setOrgForm] = useState(initialOrgForm);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [userNameFilter, setUserNameFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [membersStacked, setMembersStacked] = useState(false);
  const membersScrollRef = useRef<HTMLDivElement>(null);
  const membersGridRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = currentUser?.active_role === 'super_admin';

  // Redirect super_admin away from sections they can't access
  useEffect(() => {
    if (isSuperAdmin && (activeSection === 'case-history' || activeSection === 'settings-general' || activeSection === 'settings-billing')) {
      setActiveSection('home');
    }
  }, [isSuperAdmin, activeSection]);

  useEffect(() => {
    if (!userForm.organization_id && organizations.length > 0) {
      setUserForm((prev) => ({ ...prev, organization_id: organizations[0].id }));
    }
  }, [organizations, userForm.organization_id]);

  // ── Members layout: single observer on the stable grid container ────────────
  // The grid container width never changes when we switch grid-cols — it is
  // always determined by the viewport minus the sidebar. So observing it is
  // loop-safe: layout switches don't trigger the observer.
  // We READ (not observe) the scroll container on each resize event.
  useEffect(() => {
    if (activeSection !== 'org-members') return;

    const GAP_PX = 32;       // gap-8
    const RATIO = 7 / 10;    // 7fr of 7fr+3fr
    const UNSTACK_BUFFER = 50; // require 50 px of spare room before unstacking

    const gridEl = membersGridRef.current;
    const scrollEl = membersScrollRef.current;
    if (!gridEl || !scrollEl) return;

    setMembersStacked(false); // reset to side-by-side; check() will correct immediately
    let naturalWidth = 0;
    let isStacked = false;
    let debounceId: ReturnType<typeof setTimeout>;

    const check = () => {
      if (isStacked) {
        if (naturalWidth > 0 && (gridEl.clientWidth - GAP_PX) * RATIO > naturalWidth + UNSTACK_BUFFER) {
          isStacked = false;
          setMembersStacked(false);
        }
      } else {
        if (scrollEl.scrollWidth > scrollEl.clientWidth) {
          naturalWidth = scrollEl.scrollWidth;
          isStacked = true;
          setMembersStacked(true);
        }
      }
    };

    const observer = new ResizeObserver(() => {
      clearTimeout(debounceId);
      debounceId = setTimeout(check, 150);
    });

    observer.observe(gridEl);
    setTimeout(check, 50); // initial check after first paint

    return () => {
      clearTimeout(debounceId);
      observer.disconnect();
    };
  }, [activeSection]);

  const flash$ = (msg: string, kind: 'success' | 'error' = 'success') =>
    setFlash({ kind, message: msg });

  // ── handlers ───────────────────────────────────────────────────────────────

  const handleCreateOrganization = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingOrgCreate({ ...orgForm, slug: orgForm.slug.trim() });
  };

  const executeCreateOrganization = async () => {
    if (!pendingOrgCreate) return;
    try {
      const created = await createAdminOrganization(pendingOrgCreate);
      setOrgForm(initialOrgForm);
      flash$(`Organization created: ${created.name}`);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to create organization', 'error');
    }
  };

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPendingUserCreate({ ...userForm });
  };

  const executeCreateUser = async () => {
    if (!pendingUserCreate) return;
    try {
      const payload =
        pendingUserCreate.status === 'invited'
          ? { ...pendingUserCreate, password: undefined }
          : pendingUserCreate;
      const created = await createAdminUser(payload);
      setUserForm((prev) => ({ ...initialUserForm, organization_id: prev.organization_id }));
      if (created.invitation_url) {
        setInvitedUserName(`${pendingUserCreate.first_name} ${pendingUserCreate.last_name}`.trim());
        setInvitedUserEmail(pendingUserCreate.email);
        setInvitedOrgName(organizations.find((o) => o.id === pendingUserCreate.organization_id)?.name);
        setInvitationUrl(created.invitation_url);
      } else {
        flash$(`User created: ${created.full_name}`);
      }
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to create user', 'error');
    }
  };

  const handleAssignRole = async (user: UserListItem) => {
    const nextRole = roleDraftByUserId[user.id]?.trim();
    if (!nextRole || user.roles.includes(nextRole)) return;
    setBusyRoleUserId(user.id);
    try {
      await assignAdminRole(user.id, nextRole);
      flash$(`Assigned ${nextRole} to ${user.full_name}`);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to assign role', 'error');
    } finally {
      setBusyRoleUserId(null);
    }
  };

  const handleRemoveRole = async (user: UserListItem, roleSlug: string) => {
    setBusyRoleUserId(user.id);
    try {
      await removeAdminRole(user.id, roleSlug);
      flash$(`Removed ${roleSlug} from ${user.full_name}`);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to remove role', 'error');
    } finally {
      setBusyRoleUserId(null);
    }
  };

  const handleAssignCase = async (caseNumber: string) => {
    const lawyerId = caseAssignmentDraft[caseNumber];
    if (!lawyerId) return;
    setBusyCaseNumber(caseNumber);
    try {
      await assignAdminCaseLawyer(caseNumber, { lawyer_user_id: lawyerId });
      flash$(`Assigned case ${caseNumber}`);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to assign case', 'error');
    } finally {
      setBusyCaseNumber(null);
    }
  };

  const handleDeleteOrganization = async (org: OrganizationListItem) => {
    if (!isSuperAdmin) return;
    setBusyOrganizationId(org.id);
    try {
      await deleteAdminOrganization(org.id);
      flash$(`Deleted organization: ${org.name}`);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to delete organization', 'error');
    } finally {
      setBusyOrganizationId(null);
    }
  };

  const handleDeleteUser = async (user: UserListItem) => {
    setBusyDeleteUserId(user.id);
    try {
      await deleteAdminUser(user.id);
      flash$(`Deleted user: ${user.full_name}`);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to delete user', 'error');
    } finally {
      setBusyDeleteUserId(null);
    }
  };

  const handleRevokeInvitation = async (invitationId: string, email: string) => {
    setBusyInvitationId(invitationId);
    try {
      await revokeAdminInvitation(invitationId);
      flash$(`Revoked invitation for ${email}`);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to revoke invitation', 'error');
    } finally {
      setBusyInvitationId(null);
    }
  };

  const handleResendInvitation = async (invitationId: string, email: string) => {
    setBusyInvitationId(invitationId);
    try {
      const result = await resendAdminInvitation(invitationId);
      setInvitedUserName(null);
      setInvitedUserEmail(email);
      setInvitedOrgName(undefined);
      setInvitationUrl(result.invitation_url);
      refresh();
    } catch (err) {
      flash$(err instanceof Error ? err.message : 'Failed to resend invitation', 'error');
    } finally {
      setBusyInvitationId(null);
    }
  };

  // ── render guards ───────────────────────────────────────────────────────────

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Loading admin dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-50 p-10 text-red-600">Failed to load admin dashboard: {error}</div>;
  }

  // ── derived values ──────────────────────────────────────────────────────────

  const adminFirstName = currentUser?.full_name?.trim().split(/\s+/)[0] ?? 'Admin';
  const invitations = operations?.invitations ?? [];
  const pendingInvitationsCount = invitations.filter((i) => i.status === 'pending').length;

  const refreshButton = (
    <button
      className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
      onClick={refresh}
      disabled={refreshing}
    >
      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  );

  const sectionHeader = (title: string, subtitle: string) => (
    <header className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        {refreshButton}
      </div>
    </header>
  );

  // ── layout ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar activeSection={activeSection} onNavigate={setActiveSection} isSuperAdmin={isSuperAdmin} />

      <div className="flex-1 min-w-0">
        {flash ? (
          <div
            className={`mx-4 sm:mx-6 lg:mx-8 mt-4 rounded-lg border px-4 py-3 text-sm ${
              flash.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {flash.message}
          </div>
        ) : null}

        {/* ── HOME ──────────────────────────────────────────────── */}
        {activeSection === 'home' ? (
          <>
            {sectionHeader(
              `Welcome back, ${adminFirstName}`,
              "Here's an overview of your organization today.",
            )}
            <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-8">
              <AdminStatsGrid
                activeCases={operations?.aging_cases.length ?? 0}
                totalMembers={users.length}
                pendingInvitations={pendingInvitationsCount}
                unassignedCases={operations?.unassigned_cases.length ?? 0}
              />

              {/* Active Cases + Lawyer Workload — hidden for super_admin */}
              {!isSuperAdmin && (
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                    <ActiveCasesPanel
                      cases={lawyerCases}
                      isLoading={casesLoading}
                      onSelectCase={() => setActiveSection('case-history')}
                      onViewActiveCases={() => setActiveSection('case-history')}
                    />
                  </div>
                  <LawyerWorkloadPanel workload={operations?.lawyer_workload ?? []} />
                </div>
              )}

              {/* Case assignment + Aging cases — hidden for super_admin */}
              {!isSuperAdmin && (
                <div className="grid lg:grid-cols-2 gap-8">
                  <CaseAssignmentQueue
                    unassignedCases={operations?.unassigned_cases ?? []}
                    lawyerWorkload={operations?.lawyer_workload ?? []}
                    assignmentDraft={caseAssignmentDraft}
                    busyCaseNumber={busyCaseNumber}
                    onDraftChange={(caseNumber, lawyerId) =>
                      setCaseAssignmentDraft((prev) => ({ ...prev, [caseNumber]: lawyerId }))
                    }
                    onAssign={(caseNumber) => void handleAssignCase(caseNumber)}
                  />
                  <AgingCasesPanel cases={operations?.aging_cases ?? []} />
                </div>
              )}

              {/* Super admin: org management */}
              {isSuperAdmin ? (
                <CreateOrgPanel
                  organizations={organizations}
                  orgForm={orgForm}
                  onFormChange={setOrgForm}
                  onSubmit={handleCreateOrganization}
                  busyOrganizationId={busyOrganizationId}
                  currentUserOrgId={currentUser?.organization_id}
                  openConfirm={(opts) => setConfirmDialog(opts)}
                  onDeleteOrganization={(org) => void handleDeleteOrganization(org)}
                />
              ) : null}
            </div>
          </>
        ) : null}

        {/* ── CASE HISTORY ──────────────────────────────────────── */}
        {activeSection === 'case-history' ? (
          <>
            {sectionHeader('Case History', 'All organization cases — click a row to open the case.')}
            <div className="px-4 sm:px-6 lg:px-8 py-8">
              <AdminCaseHistory
                onSelectCase={onSelectCase ?? (() => {})}
                orgLawyerNames={operations?.lawyer_workload.map((l) => l.full_name)}
              />
            </div>
          </>
        ) : null}

        {/* ── ORG MEMBERS ───────────────────────────────────────── */}
        {activeSection === 'org-members' ? (
          <>
            {sectionHeader('Members', 'Manage organization members and create new users.')}
            <div className="px-4 sm:px-6 lg:px-8 py-8 space-y-8">
              <CreateUserForm
                organizations={organizations}
                roles={roles}
                userForm={userForm}
                onFormChange={setUserForm}
                onSubmit={handleCreateUser}
              />
              {/* Members table + Invitations: 70/30 side-by-side, stacks on overflow */}
              <div
                ref={membersGridRef}
                className={`grid gap-8 items-start ${membersStacked ? 'grid-cols-1' : 'grid-cols-[7fr_3fr]'}`}
              >
                <MembersTable
                  users={users}
                  organizations={organizations}
                  roles={roles}
                  isSuperAdmin={isSuperAdmin}
                  currentUserId={currentUser?.id}
                  roleDraftByUserId={roleDraftByUserId}
                  busyRoleUserId={busyRoleUserId}
                  busyDeleteUserId={busyDeleteUserId}
                  nameFilter={userNameFilter}
                  roleFilter={userRoleFilter}
                  onNameFilterChange={setUserNameFilter}
                  onRoleFilterChange={setUserRoleFilter}
                  onRoleDraftChange={(userId, roleSlug) =>
                    setRoleDraftByUserId((prev) => ({ ...prev, [userId]: roleSlug }))
                  }
                  openConfirm={(opts) => setConfirmDialog(opts)}
                  onAssignRole={(user) => void handleAssignRole(user)}
                  onRemoveRole={(user, role) => void handleRemoveRole(user, role)}
                  onDeleteUser={(user) => void handleDeleteUser(user)}
                  scrollContainerRef={membersScrollRef}
                />
                <InvitationsPanel
                  invitations={invitations}
                  busyInvitationId={busyInvitationId}
                  onRevoke={(id, email) => void handleRevokeInvitation(id, email)}
                  onResend={(id, email) => void handleResendInvitation(id, email)}
                />
              </div>
            </div>
          </>
        ) : null}

        {/* ── SETTINGS: GENERAL ─────────────────────────────────── */}
        {activeSection === 'settings-general' ? (
          <>
            {sectionHeader('General Settings', 'Branding, organization configuration, and email templates.')}
            <div className="px-4 sm:px-6 lg:px-8 py-8">
              <AdminSettingsGeneral />
            </div>
          </>
        ) : null}

        {/* ── SETTINGS: BILLING ─────────────────────────────────── */}
        {activeSection === 'settings-billing' ? (
          <>
            {sectionHeader('Billing & Plan', 'Manage your subscription and payment details.')}
            <div className="px-4 sm:px-6 lg:px-8 py-8">
              <AdminSettingsBilling />
            </div>
          </>
        ) : null}
      </div>

      {confirmDialog ? (
        <ConfirmDialog {...confirmDialog} onClose={() => setConfirmDialog(null)} />
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

      {invitationUrl ? (
        <InvitationLinkDialog
          invitationUrl={invitationUrl}
          recipientName={invitedUserName}
          defaultEmail={invitedUserEmail}
          organizationName={invitedOrgName}
          onClose={() => {
            setInvitationUrl(null);
            setInvitedUserName(null);
            setInvitedUserEmail('');
            setInvitedOrgName(undefined);
          }}
        />
      ) : null}

      {pendingUserCreate ? (
        <CreateSummaryDialog
          title="Confirm Create User"
          fields={[
            {
              label: 'Organization',
              value:
                organizations.find((o) => o.id === pendingUserCreate.organization_id)?.name ??
                pendingUserCreate.organization_id,
            },
            { label: 'First Name', value: pendingUserCreate.first_name },
            { label: 'Last Name', value: pendingUserCreate.last_name },
            { label: 'Email', value: pendingUserCreate.email },
            { label: 'Role', value: pendingUserCreate.role_slug ?? '' },
            { label: 'Status', value: pendingUserCreate.status ?? '' },
            ...(pendingUserCreate.status !== 'invited' ? [{ label: 'Temporary Password', value: '••••••••' }] : []),
          ]}
          onConfirm={() => void executeCreateUser()}
          onClose={() => setPendingUserCreate(null)}
        />
      ) : null}
    </div>
  );
}
