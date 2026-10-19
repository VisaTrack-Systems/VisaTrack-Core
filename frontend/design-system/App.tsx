/** App: Main application root component. Renders portal authentication gate and top-level dashboard routing based on user role and organization context. */

import {
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  type AuthLoginInput,
  type CurrentUser,
  type CurrentUserSettings,
  type UpdateCurrentUserSettingsInput,
  type UserListItem,
  clearAccessToken,
  createLawyerClient,
  createLawyerCase,
  getCurrentUser,
  getCurrentUserSettings,
  getLawyerClients,
  login,
  logout,
  switchActiveRole,
  updateCurrentUserSettings,
} from '@/lib/api';

import { ActiveCases } from './components/ActiveCases';
import { AdminDashboard } from './components/AdminDashboard';
import type { AdminSection } from './components/admin-dashboard/types';
import { AppShell, SidebarGroup, SidebarNavItem } from './components/AppShell';
import { InvitationLinkDialog } from './components/InvitationLinkDialog';
import { CaseConfiguration } from './components/CaseConfiguration';
import { ClientDashboard } from './components/ClientDashboard';
import { NewCaseDialog, type NewCaseDialogSubmitPayload } from './components/NewCaseDialog';
import { PortalAuthGate } from './components/PortalAuthGate';
import { ProfileSettingsDialog } from './components/ProfileSettingsDialog';
import { LawyerDashboard } from './components/LawyerDashboard';
import { LawyerSettings } from './components/LawyerSettings';

type AppView = 'login' | 'lawyer' | 'client' | 'admin' | 'active-cases' | 'case-config' | 'lawyer-settings';

function getDefaultViewForUser(user: CurrentUser | null): AppView {
  if (!user) {
    return 'login';
  }

  if (user.active_role === 'org_admin' || user.active_role === 'admin' || user.active_role === 'super_admin') {
    return 'admin';
  }

  if (user.active_role === 'lawyer') {
    return 'lawyer';
  }

  if (user.active_role === 'client') {
    return 'client';
  }

  return 'login';
}

function canAccessView(user: CurrentUser | null, view: AppView): boolean {
  if (view === 'login') {
    return true;
  }

  if (!user) {
    return false;
  }

  const isAdmin =
    user.active_role === 'org_admin' || user.active_role === 'admin' || user.active_role === 'super_admin';
  const isLawyer = user.active_role === 'lawyer';
  const isClient = user.active_role === 'client';

  if (view === 'admin') {
    return isAdmin;
  }

  if (view === 'client') {
    return isClient;
  }

  if (view === 'lawyer' || view === 'active-cases' || view === 'case-config') {
    return isLawyer || isAdmin;
  }

  if (view === 'lawyer-settings') {
    return isLawyer;
  }

  return false;
}

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('login');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isNewCaseDialogOpen, setIsNewCaseDialogOpen] = useState(false);
  const [lawyerClients, setLawyerClients] = useState<UserListItem[]>([]);
  const [loadingLawyerClients, setLoadingLawyerClients] = useState(false);
  const [creatingNewCase, setCreatingNewCase] = useState(false);
  const [newCaseError, setNewCaseError] = useState<string | null>(null);
  const [lawyerInvitationUrl, setLawyerInvitationUrl] = useState<string | null>(null);
  const [lawyerInvitedUserName, setLawyerInvitedUserName] = useState<string | null>(null);
  const [lawyerInvitedUserEmail, setLawyerInvitedUserEmail] = useState('');
  const [lawyerInvitedOrgName, setLawyerInvitedOrgName] = useState<string | undefined>(undefined);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [profileSettings, setProfileSettings] = useState<CurrentUserSettings | null>(null);
  const [loadingProfileSettings, setLoadingProfileSettings] = useState(false);
  const [savingProfileSettings, setSavingProfileSettings] = useState(false);
  const [profileSettingsError, setProfileSettingsError] = useState<string | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [caseReturnView, setCaseReturnView] = useState<AppView>('lawyer');
  const [adminSection, setAdminSection] = useState<AdminSection>('home');

  useEffect(() => {
    let ignore = false;

    async function hydrateSession() {
      try {
        const user = await getCurrentUser();
        if (!ignore) {
          setCurrentUser(user);
          setCurrentView(getDefaultViewForUser(user));
        }
      } catch {
        clearAccessToken();
        if (!ignore) {
          setCurrentUser(null);
          setCurrentView('login');
        }
      } finally {
        if (!ignore) {
          setAuthLoading(false);
        }
      }
    }

    void hydrateSession();

    return () => {
      ignore = true;
    };
  }, []);

  // If the current view is no longer allowed (e.g. after a role switch), fall back to the
  // user's default view. Adjusting state during render avoids an extra effect-driven render;
  // the fallback is always accessible, so this settles after one update.
  if (!canAccessView(currentUser, currentView)) {
    const fallbackView = getDefaultViewForUser(currentUser);
    if (fallbackView !== currentView) {
      setCurrentView(fallbackView);
    }
  }

  const handleLogin = async (credentials: AuthLoginInput) => {
    await login(credentials);
    const user = await getCurrentUser();
    setCurrentUser(user);
    setCurrentView(getDefaultViewForUser(user));
  };

  const handleLogout = () => {
    void logout();
    setCurrentUser(null);
    setCurrentView('login');
    setSelectedCaseId(null);
    setAdminSection('home');
    setIsProfileDialogOpen(false);
    setProfileSettings(null);
    setProfileSettingsError(null);
  };

  const handleSelectCase = (caseId: string) => {
    setCaseReturnView(currentView);
    setSelectedCaseId(caseId);
    setCurrentView('case-config');
  };

  const handleBackToDashboard = () => {
    setCurrentView(caseReturnView);
    setSelectedCaseId(null);
  };

  const handleViewActiveCases = () => {
    setCurrentView('active-cases');
  };

  const loadLawyerClients = async () => {
    setLoadingLawyerClients(true);
    try {
      const clients = await getLawyerClients(200);
      setLawyerClients(clients);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setNewCaseError(`Failed to load clients: ${message}`);
      setLawyerClients([]);
    } finally {
      setLoadingLawyerClients(false);
    }
  };

  const handleOpenNewCaseDialog = () => {
    setNewCaseError(null);
    setIsNewCaseDialogOpen(true);
    void loadLawyerClients();
  };

  const handleCloseNewCaseDialog = () => {
    if (creatingNewCase) {
      return;
    }
    setIsNewCaseDialogOpen(false);
    setNewCaseError(null);
  };

  const handleSubmitNewCase = async (payload: NewCaseDialogSubmitPayload) => {
    setCreatingNewCase(true);
    setNewCaseError(null);
    try {
      let clientUserId = payload.client_user_id ?? null;

      if (payload.client_mode === 'new') {
        const email = payload.email?.trim() ?? '';
        const firstName = payload.first_name?.trim() ?? '';
        const lastName = payload.last_name?.trim() ?? '';
        if (!email || !firstName || !lastName) {
          throw new Error('New client details are required.');
        }

        const createdClient = await createLawyerClient({
          email,
          first_name: firstName,
          last_name: lastName,
          send_invite: true,
        });
        clientUserId = createdClient.user_id;

        if (createdClient.invitation_url) {
          setLawyerInvitedUserName(`${firstName} ${lastName}`.trim());
          setLawyerInvitedUserEmail(email);
          setLawyerInvitedOrgName(createdClient.organization_name);
          setLawyerInvitationUrl(createdClient.invitation_url);
        }
      }

      if (!clientUserId) {
        throw new Error('Client selection is required.');
      }

      const createdCase = await createLawyerCase({
        client_user_id: clientUserId,
        case_type: payload.case_type.trim(),
        priority: payload.priority,
        target_filing_date: payload.target_filing_date,
      });

      setIsNewCaseDialogOpen(false);
      setSelectedCaseId(createdCase.case_number);
      setCurrentView('case-config');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setNewCaseError(`Failed to create case: ${message}`);
    } finally {
      setCreatingNewCase(false);
    }
  };

  const loadProfileSettings = () => {
    setProfileSettingsError(null);
    setLoadingProfileSettings(true);
    setProfileSettings(null);

    void getCurrentUserSettings()
      .then((settings) => {
        setProfileSettings(settings);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        setProfileSettingsError(`Failed to load profile settings: ${message}`);
      })
      .finally(() => {
        setLoadingProfileSettings(false);
      });
  };

  const handleOpenLawyerSettings = () => {
    setSelectedCaseId(null);
    setCurrentView('lawyer-settings');
    loadProfileSettings();
  };

  const handleOpenProfileDialog = () => {
    // Lawyers manage their profile on the Settings page; other roles use the dialog.
    if (currentUser?.active_role === 'lawyer') {
      handleOpenLawyerSettings();
      return;
    }
    setIsProfileDialogOpen(true);
    loadProfileSettings();
  };

  const handleSwitchRole = async (nextRole: string) => {
    if (!currentUser || nextRole === currentUser.active_role || switchingRole) {
      return;
    }

    setSwitchingRole(true);
    try {
      await switchActiveRole(nextRole);
      const updatedUser = await getCurrentUser();
      setCurrentUser(updatedUser);
      setCurrentView(getDefaultViewForUser(updatedUser));
      setSelectedCaseId(null);
      setAdminSection('home');
      setNewCaseError(null);
    } catch {
      handleLogout();
    } finally {
      setSwitchingRole(false);
    }
  };

  const roleDisplayName = (role: string): string => {
    if (role === 'super_admin') {
      return 'Super Admin';
    }
    if (role === 'org_admin') {
      return 'Admin';
    }
    if (role === 'admin') {
      return 'Admin';
    }
    if (role === 'lawyer') {
      return 'Lawyer';
    }
    if (role === 'client') {
      return 'Client';
    }
    return role;
  };

  const sortedUserRoles = currentUser
    ? [...currentUser.roles].sort((a, b) => {
        const order: Record<string, number> = {
          super_admin: 0,
          org_admin: 1,
          admin: 1,
          lawyer: 2,
          client: 3,
        };
        return (order[a] ?? 99) - (order[b] ?? 99);
      })
    : [];

  const handleCloseProfileDialog = () => {
    if (savingProfileSettings) {
      return;
    }
    setIsProfileDialogOpen(false);
    setProfileSettingsError(null);
  };

  /** Resolves to true when the profile was saved, so the Settings page can confirm it. */
  const handleSubmitProfileSettings = async (payload: UpdateCurrentUserSettingsInput): Promise<boolean> => {
    setSavingProfileSettings(true);
    setProfileSettingsError(null);
    try {
      const updatedSettings = await updateCurrentUserSettings(payload);
      setProfileSettings(updatedSettings);
      const updatedCurrentUser = await getCurrentUser();
      setCurrentUser(updatedCurrentUser);
      setIsProfileDialogOpen(false);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setProfileSettingsError(`Failed to save profile settings: ${message}`);
      return false;
    } finally {
      setSavingProfileSettings(false);
    }
  };

  const isAdminRole =
    currentUser?.active_role === 'org_admin' ||
    currentUser?.active_role === 'admin' ||
    currentUser?.active_role === 'super_admin';
  const isSuperAdmin = currentUser?.active_role === 'super_admin';

  const goToView = (view: AppView) => {
    setSelectedCaseId(null);
    setCurrentView(view);
  };

  const goToAdminSection = (section: AdminSection) => {
    setAdminSection(section);
    goToView('admin');
  };

  const adminNavItem = (section: AdminSection, label: string, icon: typeof LayoutDashboard) => (
    <SidebarNavItem
      label={label}
      icon={icon}
      active={currentView === 'admin' && adminSection === section}
      onClick={() => goToAdminSection(section)}
    />
  );

  const renderNavigation = () => {
    if (isAdminRole) {
      return (
        <>
          <SidebarGroup label="Organization">
            {adminNavItem('home', 'Home', LayoutDashboard)}
            {!isSuperAdmin ? adminNavItem('case-history', 'Case History', FolderOpen) : null}
            {adminNavItem('org-members', 'Members', Users)}
          </SidebarGroup>
          {!isSuperAdmin ? (
            <SidebarGroup label="Settings">
              {adminNavItem('settings-general', 'General', Settings)}
              {adminNavItem('settings-billing', 'Billing & Plan', CreditCard)}
            </SidebarGroup>
          ) : null}
        </>
      );
    }

    if (currentUser?.active_role === 'lawyer') {
      return (
        <SidebarGroup>
          <SidebarNavItem
            label="Dashboard"
            icon={LayoutDashboard}
            active={currentView === 'lawyer'}
            onClick={() => goToView('lawyer')}
          />
          <SidebarNavItem
            label="Cases"
            icon={FolderOpen}
            active={currentView === 'active-cases' || currentView === 'case-config'}
            onClick={() => goToView('active-cases')}
          />
          <SidebarNavItem
            label="Settings"
            icon={Settings}
            active={currentView === 'lawyer-settings'}
            onClick={handleOpenLawyerSettings}
          />
        </SidebarGroup>
      );
    }

    return (
      <SidebarGroup>
        <SidebarNavItem label="Dashboard" icon={LayoutDashboard} active={currentView === 'client'} onClick={() => goToView('client')} />
      </SidebarGroup>
    );
  };

  const roleSwitcher =
    currentUser && currentUser.roles.length > 1 ? (
      <div role="group" aria-label="Active role" className="inline-flex rounded-md bg-primary-800/60 p-0.5">
        {sortedUserRoles.map((role) => {
          const isActive = role === currentUser.active_role;
          return (
            <button
              key={role}
              type="button"
              disabled={switchingRole || isActive}
              aria-pressed={isActive}
              onClick={() => {
                void handleSwitchRole(role);
              }}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive ? 'bg-white text-primary-700' : 'text-white/85 hover:bg-white/10 hover:text-white'
              }`}
            >
              {roleDisplayName(role)}
            </button>
          );
        })}
      </div>
    ) : null;

  if (currentView === 'login' || !currentUser) {
    return (
      <PortalAuthGate
        portalTitle="VisaTrack"
        requiredRoles={[]}
        currentUser={currentUser}
        authLoading={authLoading}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <AppShell
      navigation={renderNavigation()}
      topBarActions={roleSwitcher}
      userName={currentUser.full_name}
      userSubtitle={roleDisplayName(currentUser.active_role)}
      onOpenProfile={handleOpenProfileDialog}
      onSignOut={handleLogout}
    >
      {currentView === 'lawyer' ? (
        <LawyerDashboard
          onViewActiveCases={handleViewActiveCases}
          onSelectCase={handleSelectCase}
          onCreateCase={handleOpenNewCaseDialog}
          lawyerName={currentUser?.full_name}
        />
      ) : null}

      {currentView === 'active-cases' ? (
        <ActiveCases
          onSelectCase={handleSelectCase}
          onBack={handleBackToDashboard}
          enablePersonalFlags={currentUser.active_role === 'lawyer'}
        />
      ) : null}

      {currentView === 'case-config' ? (
        selectedCaseId ? (
          <CaseConfiguration caseId={selectedCaseId} onBack={handleBackToDashboard} />
        ) : (
          <div className="p-10 text-gray-600">
            <p className="mb-4">Select a case first.</p>
            <button
              onClick={handleBackToDashboard}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-100"
              type="button"
            >
              Back to Dashboard
            </button>
          </div>
        )
      ) : null}

      {currentView === 'lawyer-settings' ? (
        <LawyerSettings
          profileSettings={profileSettings}
          loadingProfile={loadingProfileSettings}
          savingProfile={savingProfileSettings}
          profileError={profileSettingsError}
          onSubmitProfile={handleSubmitProfileSettings}
        />
      ) : null}

      {currentView === 'client' ? <ClientDashboard /> : null}
      {currentView === 'admin' ? (
        <AdminDashboard
          currentUser={currentUser}
          onSelectCase={handleSelectCase}
          activeSection={adminSection}
          onSectionChange={setAdminSection}
        />
      ) : null}
      {isNewCaseDialogOpen &&
      (currentView === 'lawyer' || currentView === 'active-cases' || currentView === 'case-config') ? (
        <NewCaseDialog
          isOpen={isNewCaseDialogOpen}
          clients={lawyerClients}
          loadingClients={loadingLawyerClients}
          submitting={creatingNewCase}
          errorMessage={newCaseError}
          onClose={handleCloseNewCaseDialog}
          onSubmit={handleSubmitNewCase}
        />
      ) : null}

      {lawyerInvitationUrl ? (
        <InvitationLinkDialog
          invitationUrl={lawyerInvitationUrl}
          recipientName={lawyerInvitedUserName}
          defaultEmail={lawyerInvitedUserEmail}
          organizationName={lawyerInvitedOrgName}
          onClose={() => {
            setLawyerInvitationUrl(null);
            setLawyerInvitedUserName(null);
            setLawyerInvitedUserEmail('');
            setLawyerInvitedOrgName(undefined);
          }}
        />
      ) : null}

      {isProfileDialogOpen ? (
        <ProfileSettingsDialog
          key={profileSettings ? profileSettings.id : 'profile-settings-loading'}
          isOpen={isProfileDialogOpen}
          settings={profileSettings}
          loading={loadingProfileSettings}
          submitting={savingProfileSettings}
          errorMessage={profileSettingsError}
          onClose={handleCloseProfileDialog}
          onSubmit={async (payload) => {
            await handleSubmitProfileSettings(payload);
          }}
        />
      ) : null}
    </AppShell>
  );
}
