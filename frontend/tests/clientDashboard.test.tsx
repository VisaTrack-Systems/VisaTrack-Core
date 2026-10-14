/** clientDashboard: Component tests for the client portal dashboard flows (loading, case switching, payments, documents, reminders). */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getClientCases: vi.fn(),
  getCaseWorkspaceByNumber: vi.fn(),
  createInvoiceCheckoutSession: vi.fn(),
  markCaseReminderRead: vi.fn(async () => ({})),
  acknowledgeCaseReminder: vi.fn(async () => ({})),
  initiateCaseDocumentUpload: vi.fn(),
  completeCaseDocumentUpload: vi.fn(async () => ({})),
  deleteClientUploadedDocument: vi.fn(async () => undefined),
  getCaseDocumentDownloadUrl: vi.fn(),
}));

vi.mock('@/lib/download', () => ({
  triggerFileDownload: vi.fn(async () => undefined),
}));

import {
  completeCaseDocumentUpload,
  createInvoiceCheckoutSession,
  deleteClientUploadedDocument,
  getCaseDocumentDownloadUrl,
  getCaseWorkspaceByNumber,
  getClientCases,
  initiateCaseDocumentUpload,
  markCaseReminderRead,
  type CaseDocumentUploadInitiateResponse,
} from '@/lib/api';
import { triggerFileDownload } from '@/lib/download';

import { ClientDashboard } from '../design-system/components/ClientDashboard';
import {
  mockCaseWorkspace,
  mockCaseWorkspaceSecondary,
  mockClientCases,
  mockPortalPermissions,
} from '../design-system/storybook/fixtures';
import { cloneWorkspace, displayDate, failOnUnmockedNetwork } from './support/componentTestKit';

function uploadSession(overrides: Partial<CaseDocumentUploadInitiateResponse> = {}): CaseDocumentUploadInitiateResponse {
  return {
    document_id: 'doc-travel-history',
    upload_url: 'https://storage.example.test/upload',
    upload_method: 'POST',
    upload_fields: {},
    storage_key: 'uploads/travel.pdf',
    expires_in_seconds: 300,
    max_upload_bytes: 10_000_000,
    ...overrides,
  };
}

// Checklist items are plain list items with no accessible name, so locate the item holding the document title.
function documentRow(name: string) {
  return screen.getByText(name).closest('li')!;
}

failOnUnmockedNetwork();

beforeEach(() => {
  vi.mocked(getClientCases).mockResolvedValue(mockClientCases);
  vi.mocked(getCaseWorkspaceByNumber).mockImplementation(async (caseNumber) =>
    cloneWorkspace(caseNumber === 'C-2026-002' ? mockCaseWorkspaceSecondary : mockCaseWorkspace)
  );
});

afterEach(() => {
  cleanup();
});

describe('ClientDashboard loading states', () => {
  it('CT-CLIENT-01: shows a loading message, then greets the client by first name', async () => {
    render(<ClientDashboard />);

    expect(screen.getByText('Loading client dashboard...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Welcome back, Jordan' })).toBeInTheDocument();
    expect(getCaseWorkspaceByNumber).toHaveBeenCalledWith('C-2026-001');
  });

  it('CT-CLIENT-02: shows an error when cases fail to load', async () => {
    vi.mocked(getClientCases).mockRejectedValue(new Error('Service unavailable'));
    render(<ClientDashboard />);

    expect(await screen.findByText('Failed to load dashboard: Service unavailable')).toBeInTheDocument();
  });

  it('CT-CLIENT-03: shows an empty state when the client has no cases', async () => {
    vi.mocked(getClientCases).mockResolvedValue([]);
    render(<ClientDashboard />);

    expect(await screen.findByText('No client case data found.')).toBeInTheDocument();
    expect(getCaseWorkspaceByNumber).not.toHaveBeenCalled();
  });

  it('CT-CLIENT-04: explains when the portal has been disabled', async () => {
    vi.mocked(getCaseWorkspaceByNumber).mockResolvedValue({
      ...cloneWorkspace(),
      portal_permissions: { ...mockPortalPermissions, portal_access: 'disabled' },
    });
    render(<ClientDashboard />);

    expect(await screen.findByRole('heading', { name: 'Portal access is temporarily disabled' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Document Checklist' })).not.toBeInTheDocument();
  });

  it('CT-CLIENT-05: switches between the client cases', async () => {
    const user = userEvent.setup();
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Reminders' });

    await user.selectOptions(screen.getByLabelText('Select Case'), 'C-2026-002');

    await waitFor(() => expect(getCaseWorkspaceByNumber).toHaveBeenLastCalledWith('C-2026-002'));
    // The second case has reminders turned off.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Reminders' })).not.toBeInTheDocument());
    expect(screen.getByLabelText('Select Case')).toHaveValue('C-2026-002');
  });
});

describe('ClientDashboard billing', () => {
  it('CT-CLIENT-06: shows totals and the paid percentage', async () => {
    render(<ClientDashboard />);

    await screen.findByRole('heading', { name: 'Billing Summary' });
    expect(screen.getByRole('progressbar', { name: 'Payment progress' })).toHaveAttribute('aria-valuenow', '83');
    expect(screen.getByText('Due Mar 8, 2026')).toBeInTheDocument();
    expect(screen.getByText('Visa ending in 4242')).toBeInTheDocument();
  });

  it('CT-CLIENT-07: sends the client to checkout for the first unpaid invoice', async () => {
    const user = userEvent.setup();
    // jsdom can only navigate within the page, so the fake checkout URL is a same-page anchor.
    // A real Stripe URL is checked by the browser suite; here we prove the app follows checkout_url.
    const checkoutUrl = `${window.location.origin}${window.location.pathname}#stripe-checkout-test`;
    vi.mocked(createInvoiceCheckoutSession).mockResolvedValue({
      payment_id: 'payment-1',
      checkout_url: checkoutUrl,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    render(<ClientDashboard />);

    try {
      await user.click(await screen.findByRole('button', { name: /Make Payment/ }));

      expect(createInvoiceCheckoutSession).toHaveBeenCalledWith('invoice-002', expect.stringMatching(/^portal-/));
      await waitFor(() => expect(window.location.href).toBe(checkoutUrl));
      expect(screen.getByRole('button', { name: /Opening secure checkout/ })).toBeDisabled();
    } finally {
      window.history.replaceState(null, '', window.location.pathname);
    }
  });

  it('CT-CLIENT-08: shows checkout errors and lets the client retry', async () => {
    const user = userEvent.setup();
    vi.mocked(createInvoiceCheckoutSession).mockRejectedValue(new Error('Checkout unavailable'));
    render(<ClientDashboard />);

    await user.click(await screen.findByRole('button', { name: /Make Payment/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Checkout unavailable');
    expect(screen.getByRole('button', { name: /Make Payment/ })).toBeEnabled();
  });

  it('CT-CLIENT-09: has nothing to pay when every invoice is settled', async () => {
    const workspace = cloneWorkspace();
    workspace.payment_items = workspace.payment_items.map((item) => ({ ...item, amount_due: 0, status: 'paid' }));
    vi.mocked(getCaseWorkspaceByNumber).mockResolvedValue(workspace);
    render(<ClientDashboard />);

    expect(await screen.findByRole('button', { name: /No payment due/ })).toBeDisabled();
  });

  it('CT-CLIENT-10: ignores open invoices that have nothing left to pay', async () => {
    const workspace = cloneWorkspace();
    workspace.payment_items = workspace.payment_items.map((item) => ({ ...item, amount_due: 0, status: 'partial' }));
    vi.mocked(getCaseWorkspaceByNumber).mockResolvedValue(workspace);
    render(<ClientDashboard />);

    expect(await screen.findByRole('button', { name: /No payment due/ })).toBeDisabled();
  });

  it.each(['draft', 'cancelled', 'refunded'])('CT-CLIENT-11: does not offer payment for a %s invoice', async (status) => {
    const workspace = cloneWorkspace();
    workspace.payment_items = [{ ...workspace.payment_items[1], status }];
    vi.mocked(getCaseWorkspaceByNumber).mockResolvedValue(workspace);
    render(<ClientDashboard />);

    expect(await screen.findByRole('button', { name: /No payment due/ })).toBeDisabled();
  });
});

describe('ClientDashboard documents', () => {
  it('CT-CLIENT-12: summarizes required documents and shows rejection notes', async () => {
    render(<ClientDashboard />);

    await screen.findByRole('heading', { name: 'Document Checklist' });
    // Passport accepted; reference rejected; pay stubs under review.
    expect(screen.getByText('1 of 3 required')).toBeInTheDocument();
    expect(
      within(documentRow('Employer Reference Letter')).getByText(/Please upload a revised letter/)
    ).toBeInTheDocument();
    const payStubs = documentRow('Recent Pay Stubs');
    expect(within(payStubs).getByLabelText('Lawyer status: Received')).toBeInTheDocument();
    expect(within(payStubs).getByText(`Uploaded ${displayDate('2026-02-20T10:15:00Z')}`)).toBeInTheDocument();
    expect(within(payStubs).getByText('File: paystubs.zip')).toBeInTheDocument();
  });

  it('CT-CLIENT-13: uploads a file with a note and refreshes the case', async () => {
    const user = userEvent.setup();
    const storageFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', storageFetch);
    vi.mocked(initiateCaseDocumentUpload).mockResolvedValue(
      uploadSession({ upload_fields: { key: 'uploads/travel.pdf' } })
    );
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Document Checklist' });

    await user.click(within(documentRow('Travel History Summary')).getByRole('button', { name: 'Upload' }));
    const dialog = screen.getByRole('dialog', { name: 'Upload Document' });
    const file = new File(['trip list'], 'travel.pdf', { type: 'application/pdf' });
    await user.upload(within(dialog).getByLabelText('Select File'), file);
    await user.type(within(dialog).getByLabelText('Note for your lawyer (optional)'), '  Last ten years  ');
    await user.click(within(dialog).getByRole('button', { name: 'Upload Document' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Upload Document' })).not.toBeInTheDocument());
    expect(initiateCaseDocumentUpload).toHaveBeenCalledWith('C-2026-001', 'doc-travel-history', {
      file_name: 'travel.pdf',
      file_type: 'application/pdf',
      file_size_bytes: file.size,
    });
    expect(storageFetch).toHaveBeenCalledWith('https://storage.example.test/upload', expect.objectContaining({ method: 'POST' }));
    expect(completeCaseDocumentUpload).toHaveBeenCalledWith('C-2026-001', 'doc-travel-history', {
      storage_key: 'uploads/travel.pdf',
      file_name: 'travel.pdf',
      file_type: 'application/pdf',
      file_size_bytes: file.size,
      client_note: 'Last ten years',
    });
    // Initial load plus the refresh after upload.
    expect(getCaseWorkspaceByNumber).toHaveBeenCalledTimes(2);
  });

  it('CT-CLIENT-14: requires a file before uploading', async () => {
    const user = userEvent.setup();
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Document Checklist' });

    await user.click(within(documentRow('Travel History Summary')).getByRole('button', { name: 'Upload' }));
    await user.click(screen.getByRole('button', { name: 'Upload Document' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Select a file before uploading.');
    expect(initiateCaseDocumentUpload).not.toHaveBeenCalled();
  });

  it('CT-CLIENT-15: keeps the dialog open with the error when storage rejects the file', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Access denied', { status: 403 })));
    vi.mocked(initiateCaseDocumentUpload).mockResolvedValue(uploadSession());
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Document Checklist' });

    await user.click(within(documentRow('Travel History Summary')).getByRole('button', { name: 'Upload' }));
    await user.upload(screen.getByLabelText('Select File'), new File(['x'], 'travel.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Upload Document' }));

    expect(await screen.findByText('Storage upload failed: 403 - Access denied')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Upload Document' })).toBeInTheDocument();
    expect(completeCaseDocumentUpload).not.toHaveBeenCalled();
  });

  it('CT-CLIENT-16: deletes an uploaded file after confirmation', async () => {
    const user = userEvent.setup();
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Document Checklist' });

    // A document with no uploaded file has nothing to delete.
    expect(within(documentRow('Travel History Summary')).getByRole('button', { name: 'Delete' })).toBeDisabled();

    await user.click(within(documentRow('Passport Biographical Page')).getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Document' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(deleteClientUploadedDocument).toHaveBeenCalledWith('C-2026-001', 'doc-passport');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete Document' })).not.toBeInTheDocument());
  });

  it('CT-CLIENT-17: downloads an uploaded file', async () => {
    const user = userEvent.setup();
    vi.mocked(getCaseDocumentDownloadUrl).mockResolvedValue({
      document_id: 'doc-passport',
      case_document_id: 'case-doc-passport',
      download_url: 'https://storage.example.test/passport.pdf',
      file_name: 'passport.pdf',
      expires_in_seconds: 300,
    });
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Document Checklist' });

    await user.click(within(documentRow('Passport Biographical Page')).getByRole('button', { name: 'View' }));

    expect(getCaseDocumentDownloadUrl).toHaveBeenCalledWith('C-2026-001', 'doc-passport');
    await waitFor(() =>
      expect(triggerFileDownload).toHaveBeenCalledWith('https://storage.example.test/passport.pdf', 'passport.pdf')
    );
  });
});

describe('ClientDashboard reminders', () => {
  it('CT-CLIENT-18: opens an unread reminder and marks it read', async () => {
    const user = userEvent.setup();
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Reminders' });

    await user.click(screen.getByRole('button', { name: /Updated review status/ }));

    const dialog = screen.getByRole('dialog', { name: 'Updated review status' });
    expect(within(dialog).getByText(/Please upload a revised version with salary information/)).toBeInTheDocument();
    expect(markCaseReminderRead).toHaveBeenCalledWith('C-2026-001', 'msg-001');
  });

  it('CT-CLIENT-19: does not re-mark a reminder that was already read', async () => {
    const user = userEvent.setup();
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Reminders' });

    await user.click(screen.getByRole('button', { name: /Travel history follow-up/ }));

    expect(screen.getByRole('dialog', { name: 'Travel history follow-up' })).toBeInTheDocument();
    expect(markCaseReminderRead).not.toHaveBeenCalled();
  });

  it('CT-CLIENT-20: lists every reminder in the board view', async () => {
    const user = userEvent.setup();
    render(<ClientDashboard />);
    await screen.findByRole('heading', { name: 'Reminders' });

    await user.click(screen.getByRole('button', { name: 'View All' }));

    const board = screen.getByRole('dialog', { name: 'All Reminders' });
    expect(within(board).getByText('Select a reminder to read it.')).toBeInTheDocument();
    expect(within(board).getByText('Updated review status')).toBeInTheDocument();
    expect(within(board).getByText('Travel history follow-up')).toBeInTheDocument();

    await user.click(within(board).getByRole('button', { name: 'Close all reminders' }));
    expect(screen.queryByRole('dialog', { name: 'All Reminders' })).not.toBeInTheDocument();
  });
});
