import {
  Briefcase,
  FileText,
  Settings,
  Shield,
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
import { InvitationLinkDialog } from './components/InvitationLinkDialog';
import { CaseConfiguration } from './components/CaseConfiguration';
import { ClientDashboard } from './components/ClientDashboard';
import { NewCaseDialog, type NewCaseDialogSubmitPayload } from './components/NewCaseDialog';
import { PortalAuthGate } from './components/PortalAuthGate';
import { ProfileSettingsDialog } from './components/ProfileSettingsDialog';
import { LawyerDashboard } from './components/LawyerDashboard';

type AppView = 'login' | 'lawyer' | 'client' | 'admin' | 'active-cases' | 'case-config';

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

  useEffect(() => {
    if (canAccessView(currentUser, currentView)) {
      return;
    }

    const fallbackView = getDefaultViewForUser(currentUser);
    if (fallbackView !== currentView) {
      setCurrentView(fallbackView);
    }
  }, [currentUser, currentView]);

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

  const handleOpenProfileDialog = () => {
    setIsProfileDialogOpen(true);
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

  const handleSubmitProfileSettings = async (payload: UpdateCurrentUserSettingsInput) => {
    setSavingProfileSettings(true);
    setProfileSettingsError(null);
    try {
      const updatedSettings = await updateCurrentUserSettings(payload);
      setProfileSettings(updatedSettings);
      const updatedCurrentUser = await getCurrentUser();
      setCurrentUser(updatedCurrentUser);
      setIsProfileDialogOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setProfileSettingsError(`Failed to save profile settings: ${message}`);
    } finally {
      setSavingProfileSettings(false);
    }
  };

  const renderDashboardHeader = () => (
    <header className="bg-black text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-5 lg:px-6">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6" />
            <div>
              <h1 className="font-semibold text-lg">VisaTrack</h1>
              <p className="text-xs text-gray-400">Immigration Case Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2">
                {currentUser.roles.length > 1 ? (
                  <div className="flex items-center gap-2 border border-gray-700 bg-gray-900/70 rounded-xl px-2 py-1.5">
                    <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gray-800 border border-gray-700">
                      {currentUser.active_role === 'org_admin' || currentUser.active_role === 'admin' || currentUser.active_role === 'super_admin' ? (
                        <Shield className="w-3.5 h-3.5 text-gray-200" />
                      ) : (
                        <Briefcase className="w-3.5 h-3.5 text-gray-200" />
                      )}
                    </div>
                    <div className="leading-tight">
                      <div className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
                        {sortedUserRoles.map((role) => {
                          const isActive = role === currentUser.active_role;
                          return (
                            <button
                              key={role}
                              type="button"
                              disabled={switchingRole || isActive}
                              onClick={() => {
                                void handleSwitchRole(role);
                              }}
                              className={`px-2 py-1 text-[11px] rounded-md transition-colors ${
                                isActive
                                  ? 'bg-white text-gray-900 font-semibold'
                                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
                              }`}
                            >
                              {roleDisplayName(role)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
                <button
                  onClick={handleOpenProfileDialog}
                  className="text-xs border border-gray-700 hover:border-gray-500 px-3 py-2 rounded-lg flex items-center gap-1"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="text-xs border border-gray-700 hover:border-gray-500 px-3 py-2 rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );

  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-gray-50">
        {renderDashboardHeader()}
        <PortalAuthGate
          portalTitle="VisaTrack"
          requiredRoles={[]}
          currentUser={currentUser}
          authLoading={authLoading}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  return (
    <div>
      {renderDashboardHeader()}

      {currentView === 'lawyer' ? (
        <LawyerDashboard
          onViewActiveCases={handleViewActiveCases}
          onSelectCase={handleSelectCase}
          onCreateCase={handleOpenNewCaseDialog}
          lawyerName={currentUser?.full_name}
        />
      ) : null}

      {currentView === 'active-cases' ? (
        <ActiveCases onSelectCase={handleSelectCase} onBack={handleBackToDashboard} />
      ) : null}

      {currentView === 'case-config' ? (
        selectedCaseId ? (
          <CaseConfiguration caseId={selectedCaseId} onBack={handleBackToDashboard} />
        ) : (
          <div className="min-h-screen bg-gray-50 p-10 text-gray-600">
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

      {currentView === 'client' ? <ClientDashboard /> : null}
      {currentView === 'admin' ? <AdminDashboard currentUser={currentUser} onSelectCase={handleSelectCase} /> : null}
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
          onSubmit={handleSubmitProfileSettings}
        />
      ) : null}
    </div>
  );
}
