import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LegalAiWorkspace } from '../design-system/components/LegalAiWorkspace';
import {
  mockCaseWorkspace,
  mockCaseWorkspaceSecondary,
  mockCurrentUserLawyer,
  mockLawyerCases,
} from '../design-system/storybook/fixtures';
import { getAiCapabilities, getCaseWorkspaceByNumber, getLawyerCases } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  getLawyerCases: vi.fn(),
  getAiCapabilities: vi.fn(),
  getCaseWorkspaceByNumber: vi.fn(),
}));

vi.mock(
  '../design-system/components/case-configuration/sections/AiAssistantSection',
  () => ({
    AiAssistantSection: ({ workspace }: { workspace: typeof mockCaseWorkspace }) => (
      <div data-testid="matter-copilot">Copilot for {workspace.case.case_number}</div>
    ),
  })
);

const callbacks = {
  onOpenMatter: vi.fn(),
  onOpenDashboard: vi.fn(),
  onOpenCases: vi.fn(),
  onCreateCase: vi.fn(),
  onOpenProfile: vi.fn(),
  onSignOut: vi.fn(),
  onSwitchRole: vi.fn(),
};

describe('LegalAiWorkspace', () => {
  beforeEach(() => {
    vi.mocked(getLawyerCases).mockResolvedValue(mockLawyerCases);
    vi.mocked(getAiCapabilities).mockResolvedValue({
      chat_enabled: true,
      form_drafts_enabled: false,
      credential_management_allowed: true,
      reason: null,
    });
    vi.mocked(getCaseWorkspaceByNumber).mockImplementation(async (caseNumber) =>
      caseNumber === mockCaseWorkspaceSecondary.case.case_number
        ? mockCaseWorkspaceSecondary
        : mockCaseWorkspace
    );
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens as a chat-first, case-grounded lawyer workspace', async () => {
    render(
      <LegalAiWorkspace
        currentUser={mockCurrentUserLawyer}
        {...callbacks}
        switchingRole={false}
      />
    );

    expect(
      await screen.findByRole('heading', {
        name: /good day, avery/i,
      })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('matter-copilot')).toHaveTextContent(
      mockCaseWorkspace.case.case_number
    );
    expect(screen.getByText('Case-scoped by design')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open full matter' })).toBeInTheDocument();
  });

  it('switches matter context without leaving the AI workspace', async () => {
    render(
      <LegalAiWorkspace
        currentUser={mockCurrentUserLawyer}
        {...callbacks}
        switchingRole={false}
      />
    );

    await screen.findByTestId('matter-copilot');
    await userEvent.click(
      screen.getByRole('button', {
        name: new RegExp(mockCaseWorkspaceSecondary.case.client_name, 'i'),
      })
    );

    await waitFor(() => {
      expect(getCaseWorkspaceByNumber).toHaveBeenCalledWith(
        mockCaseWorkspaceSecondary.case.case_number
      );
    });
    expect(await screen.findByTestId('matter-copilot')).toHaveTextContent(
      mockCaseWorkspaceSecondary.case.case_number
    );
  });

  it('keeps dashboard, matters, profile, and matter creation accessible', async () => {
    render(
      <LegalAiWorkspace
        currentUser={mockCurrentUserLawyer}
        {...callbacks}
        switchingRole={false}
      />
    );

    await screen.findByText('Counsel intelligence');
    await userEvent.click(screen.getByRole('button', { name: 'Practice overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'All matters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create new matter' }));
    await userEvent.click(screen.getByRole('button', { name: 'Open profile settings' }));

    expect(callbacks.onOpenDashboard).toHaveBeenCalled();
    expect(callbacks.onOpenCases).toHaveBeenCalled();
    expect(callbacks.onCreateCase).toHaveBeenCalled();
    expect(callbacks.onOpenProfile).toHaveBeenCalled();
  });

  it('keeps the practice usable when the controlled AI capability is disabled', async () => {
    vi.mocked(getAiCapabilities).mockResolvedValue({
      chat_enabled: false,
      form_drafts_enabled: false,
      credential_management_allowed: true,
      reason: 'Your firm has not enabled the AI workspace.',
    });

    render(
      <LegalAiWorkspace
        currentUser={mockCurrentUserLawyer}
        {...callbacks}
        switchingRole={false}
      />
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Your legal workflows are ready. AI is not enabled yet.',
      })
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Browse matters' }));
    expect(callbacks.onOpenCases).toHaveBeenCalled();
  });
});
