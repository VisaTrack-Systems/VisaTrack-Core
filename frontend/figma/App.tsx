import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  FolderOpen,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
  updateCurrentUserSettings,
} from '@/lib/api';

import { ActiveCases } from './components/ActiveCases';
import { AdminDashboard } from './components/AdminDashboard';
import { CaseConfiguration } from './components/CaseConfiguration';
import { ClientDashboard } from './components/ClientDashboard';
import { NewCaseDialog, type NewCaseDialogSubmitPayload } from './components/NewCaseDialog';
import { PortalAuthGate } from './components/PortalAuthGate';
import { ProfileSettingsDialog } from './components/ProfileSettingsDialog';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { LawyerDashboard } from './components/LawyerDashboard';

type AppView = 'landing' | 'lawyer' | 'client' | 'admin' | 'active-cases' | 'case-config';

function getRequiredRoles(view: AppView): string[] {
  if (view === 'admin') {
    return ['org_admin', 'super_admin'];
  }
  if (view === 'client') {
    return ['client'];
  }
  if (view === 'lawyer' || view === 'active-cases' || view === 'case-config') {
    return ['lawyer', 'org_admin', 'super_admin'];
  }
  return [];
}

function hasAnyRole(user: CurrentUser | null, requiredRoles: string[]): boolean {
  if (!user) {
    return false;
  }
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.some((role) => user.roles.includes(role));
}

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isNewCaseDialogOpen, setIsNewCaseDialogOpen] = useState(false);
  const [lawyerClients, setLawyerClients] = useState<UserListItem[]>([]);
  const [loadingLawyerClients, setLoadingLawyerClients] = useState(false);
  const [creatingNewCase, setCreatingNewCase] = useState(false);
  const [newCaseError, setNewCaseError] = useState<string | null>(null);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [profileSettings, setProfileSettings] = useState<CurrentUserSettings | null>(null);
  const [loadingProfileSettings, setLoadingProfileSettings] = useState(false);
  const [savingProfileSettings, setSavingProfileSettings] = useState(false);
  const [profileSettingsError, setProfileSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function hydrateSession() {
      try {
        const user = await getCurrentUser();
        if (!ignore) {
          setCurrentUser(user);
        }
      } catch {
        clearAccessToken();
        if (!ignore) {
          setCurrentUser(null);
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

  const requiredRoles = useMemo(() => getRequiredRoles(currentView), [currentView]);
  const isAuthedForView = useMemo(
    () => hasAnyRole(currentUser, requiredRoles),
    [currentUser, requiredRoles]
  );

  const handleLogin = async (credentials: AuthLoginInput) => {
    await login(credentials);
    const user = await getCurrentUser();
    setCurrentUser(user);
  };

  const handleLogout = () => {
    void logout();
    setCurrentUser(null);
    setSelectedCaseId(null);
    setIsProfileDialogOpen(false);
    setProfileSettings(null);
    setProfileSettingsError(null);
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('case-config');
  };

  const handleBackToCases = () => {
    setCurrentView('active-cases');
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

  const renderDashboardHeader = (active: 'lawyer' | 'client' | 'admin') => (
    <header className="bg-black text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('landing')}>
            <FileText className="w-6 h-6" />
            <div>
              <h1 className="font-semibold text-lg">VisaTrack</h1>
              <p className="text-xs text-gray-400">Immigration Case Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
              <button
                onClick={() => setCurrentView('lawyer')}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                  active === 'lawyer' ? 'bg-red-600 text-white' : 'hover:bg-gray-700 text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                Lawyer
              </button>
              <button
                onClick={() => setCurrentView('client')}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                  active === 'client' ? 'bg-red-600 text-white' : 'hover:bg-gray-700 text-white'
                }`}
              >
                <User className="w-4 h-4" />
                Client
              </button>
              <button
                onClick={() => setCurrentView('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                  active === 'admin' ? 'bg-red-600 text-white' : 'hover:bg-gray-700 text-white'
                }`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            </div>

            {currentUser ? (
              <div className="flex items-center gap-2">
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

  if (currentView !== 'landing') {
    const activeNav = currentView === 'admin' ? 'admin' : currentView === 'client' ? 'client' : 'lawyer';

    return (
      <div>
        {renderDashboardHeader(activeNav)}

        {!isAuthedForView ? (
          <PortalAuthGate
            portalTitle={
              currentView === 'admin'
                ? 'Admin Portal'
                : currentView === 'client'
                  ? 'Client Portal'
                  : 'Lawyer Portal'
            }
            requiredRoles={requiredRoles}
            currentUser={currentUser}
            authLoading={authLoading}
            onLogin={handleLogin}
            onLogout={handleLogout}
          />
        ) : null}

        {isAuthedForView && currentView === 'lawyer' ? (
          <LawyerDashboard onViewActiveCases={handleViewActiveCases} onCreateCase={handleOpenNewCaseDialog} />
        ) : null}

        {isAuthedForView && currentView === 'active-cases' ? (
          <ActiveCases onSelectCase={handleSelectCase} />
        ) : null}

        {isAuthedForView && currentView === 'case-config' ? (
          selectedCaseId ? (
            <CaseConfiguration caseId={selectedCaseId} onBack={handleBackToCases} />
          ) : (
            <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Select a case first.</div>
          )
        ) : null}

        {isAuthedForView && currentView === 'client' ? <ClientDashboard /> : null}
        {isAuthedForView && currentView === 'admin' ? <AdminDashboard /> : null}
        {isAuthedForView &&
        isNewCaseDialogOpen &&
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

        {isAuthedForView && isProfileDialogOpen ? (
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

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-black text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6" />
              <div>
                <h1 className="font-semibold text-lg">VisaTrack</h1>
                <p className="text-xs text-gray-400">Immigration Case Management</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm hover:text-red-500 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm hover:text-red-500 transition-colors">
                How It Works
              </a>
              <button
                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded text-sm transition-colors"
                onClick={() => setCurrentView('admin')}
              >
                Open Portals
              </button>
            </nav>

            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileMenuOpen ? (
            <nav className="md:hidden pb-4 flex flex-col gap-4">
              <a href="#features" className="text-sm hover:text-red-500 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm hover:text-red-500 transition-colors">
                How It Works
              </a>
              <button
                className="bg-red-600 hover:bg-red-700 px-6 py-2 rounded text-sm transition-colors"
                onClick={() => setCurrentView('admin')}
              >
                Open Portals
              </button>
            </nav>
          ) : null}
        </div>
      </header>

      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1722312770621-e19e81430ba5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBpbW1pZ3JhdGlvbiUyMGxhd3llciUyMG9mZmljZXxlbnwxfHx8fDE3NzAzOTg1MzB8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Professional office"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-3xl">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Immigration Case Management,
              <span className="text-red-500"> Simplified</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-300 mb-8 leading-relaxed">
              Streamline your immigration workflow with secure case operations, client collaboration, and role-based portals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <button
                onClick={() => setCurrentView('lawyer')}
                className="bg-red-600 hover:bg-red-700 px-8 py-4 rounded-lg text-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                Open Lawyer Portal
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>PIPEDA Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>24/7 Access</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                <span>Tenant-Isolated Data</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Built for multi-tenant legal operations</h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <FolderOpen className="w-6 h-6 text-red-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Case Workspaces</h4>
              <p className="text-gray-600">Organize documents, milestones, billing, and communication for every file.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6 text-red-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Client Collaboration</h4>
              <p className="text-gray-600">Invite clients per case with least-privilege access and secure communication.</p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <CreditCard className="w-6 h-6 text-red-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Admin Governance</h4>
              <p className="text-gray-600">Manage organizations, users, and roles with audit-ready operations.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
