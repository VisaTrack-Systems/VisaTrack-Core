import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientDashboard } from '../figma/components/ClientDashboard';
import { mockCaseWorkspace, mockClientCases, mockPortalPermissions } from '../figma/storybook/fixtures';

vi.mock('@/lib/api', () => ({
  getClientCases: vi.fn(),
  getCaseWorkspaceByNumber: vi.fn(),
  markCaseReminderRead: vi.fn(async () => ({})),
  acknowledgeCaseReminder: vi.fn(async () => ({})),
  initiateCaseDocumentUpload: vi.fn(async () => ({})),
  completeCaseDocumentUpload: vi.fn(async () => ({})),
  deleteClientUploadedDocument: vi.fn(async () => undefined),
  getCaseDocumentDownloadUrl: vi.fn(async () => ({ download_url: 'https://example.com/file', file_name: 'file.pdf' })),
}));

import { getCaseWorkspaceByNumber, getClientCases } from '@/lib/api';

function makeWorkspaceWithPermissions(overrides: Partial<(typeof mockPortalPermissions)>) {
  return {
    ...JSON.parse(JSON.stringify(mockCaseWorkspace)),
    portal_permissions: {
      ...mockPortalPermissions,
      ...overrides,
    },
  };
}

describe('ClientDashboard permission behavior', () => {
  beforeEach(() => {
    vi.mocked(getClientCases).mockResolvedValue(mockClientCases);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('hides detailed case status when show_case_status_progress is disabled', async () => {
    vi.mocked(getCaseWorkspaceByNumber).mockResolvedValue(
      makeWorkspaceWithPermissions({
        portal_access: 'full_access',
        show_case_status_progress: false,
      })
    );

    render(<ClientDashboard />);

    await screen.findByText('Case Overview');
    expect(
      screen.getByText('Your legal team has limited detailed case status visibility for this portal.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Case ID: C-2026-001')).not.toBeInTheDocument();
  });

  it('shows checklist/reminders but hides milestones and billing for limited access', async () => {
    vi.mocked(getCaseWorkspaceByNumber).mockResolvedValue(
      makeWorkspaceWithPermissions({
        portal_access: 'limited_access',
        show_case_status_progress: true,
        show_document_requirements: true,
        reminders: 'enabled',
      })
    );

    render(<ClientDashboard />);

    await screen.findByRole('heading', { name: 'Document Checklist' });
    expect(screen.getByRole('heading', { name: 'Reminders' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Case Milestones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Billing Summary' })).not.toBeInTheDocument();
  });

  it('disables document upload actions when document_upload is disabled', async () => {
    vi.mocked(getCaseWorkspaceByNumber).mockResolvedValue(
      makeWorkspaceWithPermissions({
        portal_access: 'full_access',
        show_document_requirements: true,
        document_upload: 'disabled',
      })
    );

    render(<ClientDashboard />);

    await screen.findByRole('heading', { name: 'Document Checklist' });
    const disabledUploadButtons = screen.getAllByRole('button', { name: 'Uploads Disabled' });
    expect(disabledUploadButtons.length).toBeGreaterThan(0);
    expect(disabledUploadButtons[0]).toBeDisabled();
  });
});
