import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../design-system/App';
import {
  mockCurrentUserClient,
  mockCurrentUserLawyer,
} from '../design-system/storybook/fixtures';
import { getCurrentUser } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  clearAccessToken: vi.fn(),
  createLawyerClient: vi.fn(),
  createLawyerCase: vi.fn(),
  getCurrentUser: vi.fn(),
  getCurrentUserSettings: vi.fn(),
  getLawyerClients: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  switchActiveRole: vi.fn(),
  updateCurrentUserSettings: vi.fn(),
}));

vi.mock('../design-system/components/LegalAiWorkspace', () => ({
  LegalAiWorkspace: ({
    onOpenCases,
  }: {
    onOpenCases: () => void;
  }) => (
    <div>
      <h1>Counsel workspace</h1>
      <button type="button" onClick={onOpenCases}>Open all matters</button>
    </div>
  ),
}));
vi.mock('../design-system/components/ActiveCases', () => ({
  ActiveCases: () => <h1>All matters view</h1>,
}));
vi.mock('../design-system/components/CaseConfiguration', () => ({
  CaseConfiguration: ({ caseId }: { caseId: string }) => (
    <h1>Case workspace {caseId}</h1>
  ),
}));
vi.mock('../design-system/components/ClientDashboard', () => ({
  ClientDashboard: () => <h1>Client portal view</h1>,
}));
vi.mock('../design-system/components/AdminDashboard', () => ({
  AdminDashboard: () => <h1>Admin operations view</h1>,
}));
vi.mock('../design-system/components/LawyerDashboard', () => ({
  LawyerDashboard: () => <h1>Practice overview view</h1>,
}));
vi.mock('../design-system/components/PortalAuthGate', () => ({
  PortalAuthGate: () => <h1>Sign in view</h1>,
}));
vi.mock('../design-system/components/NewCaseDialog', () => ({
  NewCaseDialog: () => null,
}));
vi.mock('../design-system/components/InvitationLinkDialog', () => ({
  InvitationLinkDialog: () => null,
}));
vi.mock('../design-system/components/ProfileSettingsDialog', () => ({
  ProfileSettingsDialog: () => null,
}));

describe('chat-first application shell', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('hydrates a lawyer into the counsel workspace and preserves navigation', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUserLawyer);

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Counsel workspace' })
    ).toBeInTheDocument();
    expect(window.location.search).toBe('?view=copilot');

    await userEvent.click(screen.getByRole('button', { name: 'Open all matters' }));
    expect(
      await screen.findByRole('heading', { name: 'All matters view' })
    ).toBeInTheDocument();
    expect(window.location.search).toBe('?view=active-cases');
  });

  it('restores an authorized case deep link after session hydration', async () => {
    window.history.replaceState(
      {},
      '',
      '/?view=case-config&case=C-2026-001'
    );
    vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUserLawyer);

    render(<App />);

    expect(
      await screen.findByRole('heading', {
        name: 'Case workspace C-2026-001',
      })
    ).toBeInTheDocument();
    expect(window.location.search).toBe(
      '?view=case-config&case=C-2026-001'
    );
  });

  it('keeps clients in the non-AI portal', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockCurrentUserClient);

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Client portal view' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Counsel workspace')).not.toBeInTheDocument();
    expect(window.location.search).toBe('?view=client');
  });
});
