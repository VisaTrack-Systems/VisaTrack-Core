/** Chat-first legal workspace that keeps every matter workflow one click away. */

import {
  ArrowRight,
  Bot,
  Briefcase,
  CalendarClock,
  FileCheck2,
  FolderLock,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type AiCapabilities,
  type CaseListItem,
  type CaseWorkspace,
  type CurrentUser,
  getAiCapabilities,
  getCaseWorkspaceByNumber,
  getLawyerCases,
} from '@/lib/api';

import { AiAssistantSection } from './case-configuration/sections/AiAssistantSection';

type LegalAiWorkspaceProps = {
  currentUser: CurrentUser;
  onOpenMatter: (caseNumber: string) => void;
  onOpenDashboard: () => void;
  onOpenCases: () => void;
  onCreateCase: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
  onSwitchRole: (role: string) => void;
  switchingRole: boolean;
};

function statusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || 'Counsel';
}

export function LegalAiWorkspace({
  currentUser,
  onOpenMatter,
  onOpenDashboard,
  onOpenCases,
  onCreateCase,
  onOpenProfile,
  onSignOut,
  onSwitchRole,
  switchingRole,
}: LegalAiWorkspaceProps) {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null);
  const [selectedCaseNumber, setSelectedCaseNumber] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<CaseWorkspace | null>(null);
  const [search, setSearch] = useState('');
  const [loadingCases, setLoadingCases] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const workspaceRequest = useRef(0);

  const loadWorkspace = useCallback(async (caseNumber: string): Promise<void> => {
    const requestId = workspaceRequest.current + 1;
    workspaceRequest.current = requestId;
    setLoadingWorkspace(true);
    setError(null);
    try {
      const nextWorkspace = await getCaseWorkspaceByNumber(caseNumber);
      if (workspaceRequest.current === requestId) setWorkspace(nextWorkspace);
    } catch (loadError) {
      if (workspaceRequest.current === requestId) {
        setWorkspace(null);
        setError(loadError instanceof Error ? loadError.message : 'Could not load this matter.');
      }
    } finally {
      if (workspaceRequest.current === requestId) setLoadingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      setLoadingCases(true);
      setError(null);
      try {
        const [caseResult, capabilityResult] = await Promise.allSettled([
          getLawyerCases(100),
          getAiCapabilities(),
        ]);
        if (ignore) return;
        if (caseResult.status === 'rejected') throw caseResult.reason;
        const result = caseResult.value;
        setCases(result);
        if (capabilityResult.status === 'fulfilled') {
          setCapabilities(capabilityResult.value);
        } else {
          setCapabilities({
            chat_enabled: false,
            form_drafts_enabled: false,
            credential_management_allowed: false,
            reason: 'AI availability could not be verified.',
          });
        }
        const initialCase = result[0]?.case_number ?? null;
        setSelectedCaseNumber((current) => current ?? initialCase);
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load matters.');
        }
      } finally {
        if (!ignore) setLoadingCases(false);
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCaseNumber) {
      workspaceRequest.current += 1;
      setWorkspace(null);
      setLoadingWorkspace(false);
      return;
    }
    void loadWorkspace(selectedCaseNumber);
  }, [loadWorkspace, selectedCaseNumber]);

  const visibleCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((item) =>
      [item.client_name, item.case_number, item.case_type]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [cases, search]);

  const matterRail = (
    <>
      <div className="flex items-center justify-between px-4 py-4">
        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex items-center gap-3 text-left"
          aria-label="Open VisaTrack dashboard"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c8cff] to-[#35d0ba] text-white shadow-lg shadow-indigo-950/30">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide text-white">VisaTrack</span>
            <span className="block text-[11px] text-slate-400">Counsel AI workspace</span>
          </span>
        </button>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setMobileNavigationOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="space-y-1 px-3" aria-label="Primary workspace navigation">
        <button
          type="button"
          aria-current="page"
          className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-medium text-white"
        >
          <Bot className="h-4 w-4 text-[#75e6d4]" />
          AI workspace
        </button>
        <button
          type="button"
          onClick={onOpenDashboard}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/8 hover:text-white"
        >
          <LayoutDashboard className="h-4 w-4" />
          Practice overview
        </button>
        <button
          type="button"
          onClick={onOpenCases}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/8 hover:text-white"
        >
          <Briefcase className="h-4 w-4" />
          All matters
        </button>
      </nav>

      <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-white/10 px-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Matter context
          </p>
          <button
            type="button"
            onClick={onCreateCase}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Create new matter"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <label className="relative mt-3 block">
          <span className="sr-only">Search matters</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search matters"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-[#75e6d4] focus:outline-none"
          />
        </label>
        <div className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {loadingCases ? (
            <p className="px-3 py-3 text-xs text-slate-500">Loading matters…</p>
          ) : null}
          {!loadingCases && visibleCases.length === 0 ? (
            <p className="px-3 py-3 text-xs leading-5 text-slate-500">
              {cases.length === 0 ? 'Create a matter to begin a case-grounded conversation.' : 'No matching matters.'}
            </p>
          ) : null}
          {visibleCases.map((item) => {
            const selected = item.case_number === selectedCaseNumber;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedCaseNumber(item.case_number);
                  setMobileNavigationOpen(false);
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
                  selected
                    ? 'bg-[#6674e8] text-white shadow-lg shadow-indigo-950/25'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <span className="block truncate text-sm font-medium">{item.client_name}</span>
                <span className={`mt-0.5 block truncate text-[11px] ${selected ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {item.case_number} · {item.case_type}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/10 p-3">
        {currentUser.roles.length > 1 ? (
          <label className="mb-3 block px-1 text-[11px] text-slate-400">
            Active role
            <select
              value={currentUser.active_role}
              disabled={switchingRole}
              onChange={(event) => onSwitchRole(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
            >
              {currentUser.roles.map((role) => (
                <option key={role} value={role}>{statusLabel(role)}</option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="rounded-xl bg-[#122d3a] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#75e6d4]">
            <ShieldCheck className="h-4 w-4" />
            Case-scoped by design
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-400">
            Review every AI answer and cited source before relying on it.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f3f5fa] text-[#172033]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[17rem] flex-col bg-[#10182b] lg:flex">
        {matterRail}
      </aside>

      {mobileNavigationOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation overlay"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileNavigationOpen(false)}
          />
          <aside className="relative flex h-full w-[min(19rem,86vw)] flex-col bg-[#10182b] shadow-2xl">
            {matterRail}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[17rem]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden"
                onClick={() => setMobileNavigationOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {workspace?.case.client_name ?? 'AI workspace'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {workspace
                    ? `${workspace.case.case_number} · ${workspace.case.case_type}`
                    : 'Select a matter to ground the conversation'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCreateCase}
                className="hidden items-center gap-2 rounded-xl bg-[#5b67d8] px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#4f5bc8] sm:flex"
              >
                <Plus className="h-4 w-4" />
                New matter
              </button>
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8eafe] text-sm font-semibold text-[#4651b5]"
                aria-label="Open profile settings"
                title={currentUser.full_name}
              >
                {firstName(currentUser.full_name).slice(0, 1).toUpperCase()}
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="hidden rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 sm:block"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[96rem] px-4 py-5 sm:px-6 lg:px-8">
          <div className="relative mb-5 overflow-hidden rounded-3xl bg-[#111c34] p-5 text-white shadow-xl shadow-slate-300/40 sm:p-6">
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-2xl">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#75e6d4]">
                  <Sparkles className="h-4 w-4" />
                  Counsel intelligence
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Good day, {firstName(currentUser.full_name)}. What should we work through?
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  Research the matter record, prepare a source-linked answer, or move directly into the full case workflow.
                </p>
              </div>
              {workspace ? (
                <button
                  type="button"
                  onClick={() => onOpenMatter(workspace.case.case_number)}
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/15"
                >
                  Open full matter
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-[#6674e8]/20 blur-3xl" />
          </div>

          {error ? (
            <div role="alert" className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          {!selectedCaseNumber && !loadingCases ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#5661ce]">
                <Briefcase className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-xl font-semibold text-slate-900">Start with a matter</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Create your first matter, invite the client, and build a secure record the assistant can reference.
              </p>
              <button
                type="button"
                onClick={onCreateCase}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#5b67d8] px-4 py-2.5 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                Create matter
              </button>
            </div>
          ) : null}

          {loadingWorkspace ? (
            <div aria-label="Loading matter workspace" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="h-[34rem] animate-pulse rounded-3xl bg-white shadow-sm" />
              <div className="h-72 animate-pulse rounded-3xl bg-white shadow-sm" />
            </div>
          ) : null}

          {workspace && !loadingWorkspace ? (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-w-0 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
                {capabilities?.chat_enabled ? (
                  <AiAssistantSection
                    workspace={workspace}
                    workspaceMode
                    onWorkspaceRefresh={() => loadWorkspace(workspace.case.case_number)}
                  />
                ) : (
                  <div className="flex min-h-[34rem] items-center justify-center px-4 py-12 text-center">
                    <div className="max-w-lg">
                      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#5661ce]">
                        <Bot className="h-6 w-6" />
                      </span>
                      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#5661ce]">
                        Controlled firm capability
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                        Your legal workflows are ready. AI is not enabled yet.
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        {capabilities?.reason ?? 'Ask your firm administrator about the controlled AI pilot.'}
                        {' '}You can continue using matters, documents, deadlines, billing, and client collaboration.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={onOpenDashboard}
                          className="rounded-xl bg-[#5b67d8] px-4 py-2.5 text-sm font-medium text-white"
                        >
                          Open practice overview
                        </button>
                        <button
                          type="button"
                          onClick={onOpenCases}
                          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                        >
                          Browse matters
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-4 xl:sticky xl:top-20" aria-label="Matter snapshot">
                <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Matter snapshot
                      </p>
                      <h2 className="mt-2 text-lg font-semibold text-slate-900">
                        {workspace.case.client_name}
                      </h2>
                    </div>
                    <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-[11px] font-semibold text-[#4b56bd]">
                      {statusLabel(workspace.case.status)}
                    </span>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Case progress</span>
                        <span>{workspace.case.progress_percent}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#6674e8] to-[#35c9b0]"
                          style={{ width: `${Math.min(100, Math.max(0, workspace.case.progress_percent))}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <FileCheck2 className="h-4 w-4 text-[#5b67d8]" />
                        <p className="mt-2 text-lg font-semibold text-slate-900">{workspace.documents.length}</p>
                        <p className="text-[11px] text-slate-500">Documents</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <CalendarClock className="h-4 w-4 text-[#199a87]" />
                        <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                          {workspace.case.target_filing_date
                            ? new Date(workspace.case.target_filing_date).toLocaleDateString('en-CA', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'Not set'}
                        </p>
                        <p className="text-[11px] text-slate-500">Target filing</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-[#cbeee8] bg-[#edfaf7] p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#116b5e]">
                    <FolderLock className="h-4 w-4" />
                    Professional safeguards
                  </div>
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-[#315e58]">
                    <li>Case-scoped retrieval</li>
                    <li>Source-linked responses</li>
                    <li>No autonomous filing or signing</li>
                    <li>Lawyer review remains required</li>
                  </ul>
                </section>
              </aside>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
