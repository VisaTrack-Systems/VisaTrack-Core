/** caseConfiguration: Component tests for the lawyer's case workspace (overview, details, documents, milestones, payments, reminders, permissions). */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Every API call these tests can trigger is listed, so an unexpected call fails instead of reaching a server.
// The AI Assistant tab is covered by aiAssistant.test.tsx, so its calls are not mocked here.
vi.mock('@/lib/api', () => ({
  getCaseWorkspaceByNumber: vi.fn(),
  createCaseInvoice: vi.fn(),
  createCaseCustomDocument: vi.fn(),
  createCaseCustomDocumentSuite: vi.fn(),
  downloadCaseDocumentsArchive: vi.fn(),
  initiateCaseDocumentUpload: vi.fn(),
  completeCaseDocumentUpload: vi.fn(),
  updateCaseDetails: vi.fn(),
  updateCaseDocumentStatus: vi.fn(),
  createCaseReminder: vi.fn(),
  getCaseDocumentDownloadUrl: vi.fn(),
  getCaseDocumentViewUrl: vi.fn(),
  renameCaseDocument: vi.fn(async () => ({})),
  deleteCaseDocument: vi.fn(async () => undefined),
  createCaseMilestone: vi.fn(),
  updateCaseMilestone: vi.fn(),
  deleteCaseMilestone: vi.fn(async () => undefined),
  updateCasePortalPermissions: vi.fn(),
}));

vi.mock('@/lib/download', () => ({
  triggerFileDownload: vi.fn(async () => undefined),
}));

import {
  completeCaseDocumentUpload,
  createCaseCustomDocument,
  createCaseCustomDocumentSuite,
  createCaseInvoice,
  createCaseMilestone,
  createCaseReminder,
  deleteCaseDocument,
  downloadCaseDocumentsArchive,
  deleteCaseMilestone,
  getCaseDocumentDownloadUrl,
  getCaseDocumentViewUrl,
  getCaseWorkspaceByNumber,
  initiateCaseDocumentUpload,
  renameCaseDocument,
  updateCaseDetails,
  updateCaseDocumentStatus,
  updateCaseMilestone,
  updateCasePortalPermissions,
  type CaseDocumentUploadInitiateResponse,
  type CaseDocumentViewResponse,
} from '@/lib/api';
import { triggerFileDownload } from '@/lib/download';

import { CaseConfiguration } from '../design-system/components/CaseConfiguration';
import { mockCaseWorkspace, mockPortalPermissions } from '../design-system/storybook/fixtures';
import { cloneWorkspace, failOnUnmockedNetwork, rowStartingWith } from './support/componentTestKit';

const CASE_NUMBER = 'C-2026-001';

async function renderCase() {
  const user = userEvent.setup();
  const onBack = vi.fn();
  render(<CaseConfiguration caseId={CASE_NUMBER} onBack={onBack} />);
  await screen.findByRole('heading', { name: 'Case Overview' });
  return { user, onBack };
}

async function openSection(user: ReturnType<typeof userEvent.setup>, label: string) {
  const nav = screen.getByRole('navigation', { name: 'Case sections' });
  await user.click(within(nav).getByRole('button', { name: label }));
}

// Case details, reminders and add-document fields have <label>s that are not linked to their inputs
// (an accessibility bug in the app), so find the field inside the label's wrapper instead.
function fieldBelowLabel(labelText: string, role: 'textbox' | 'combobox' = 'textbox') {
  return within(screen.getByText(labelText).parentElement!).getByRole(role);
}

function uploadSession(documentId: string): CaseDocumentUploadInitiateResponse {
  return {
    document_id: documentId,
    upload_url: 'https://storage.example.test/upload',
    upload_method: 'POST',
    upload_fields: {},
    storage_key: `uploads/${documentId}.pdf`,
    expires_in_seconds: 300,
    max_upload_bytes: 10_000_000,
  };
}

const viewResponse: CaseDocumentViewResponse = {
  document_id: 'doc-passport',
  case_document_id: 'case-doc-passport',
  view_url: 'https://storage.example.test/view',
  file_name: 'passport.pdf',
  expires_in_seconds: 300,
};

// Milestone cards have no landmark role; the card is the block that holds the heading and its action buttons.
function milestoneCard(name: string) {
  return screen.getByRole('heading', { name }).parentElement!.parentElement!;
}

failOnUnmockedNetwork();

beforeEach(() => {
  vi.mocked(getCaseWorkspaceByNumber).mockImplementation(async () => cloneWorkspace());
});

afterEach(() => {
  cleanup();
});

describe('CaseConfiguration overview', () => {
  it('CT-CASECFG-01: loads the case and summarizes milestones, documents, and payments', async () => {
    render(<CaseConfiguration caseId={CASE_NUMBER} onBack={vi.fn()} />);

    expect(screen.getByText('Loading case configuration...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Jordan Client' })).toBeInTheDocument();
    expect(getCaseWorkspaceByNumber).toHaveBeenCalledWith(CASE_NUMBER);

    expect(screen.getByText('Lawyer review')).toBeInTheDocument();
    expect(screen.getByText('Due: Mar 4, 2026')).toBeInTheDocument();
    // Reference letter is rejected and pay stubs are only received.
    expect(screen.getByText('Missing Documents').closest('div')!.nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('$800')).toBeInTheDocument();
  });

  it('CT-CASECFG-02: shows an error when the case cannot be loaded', async () => {
    vi.mocked(getCaseWorkspaceByNumber).mockRejectedValue(new Error('Case not found'));
    render(<CaseConfiguration caseId={CASE_NUMBER} onBack={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load case: Case not found');
  });

  it('CT-CASECFG-03: jumps to a section from a quick action and marks the tab current', async () => {
    const { user } = await renderCase();

    await user.click(screen.getByRole('button', { name: /Add Milestone/ }));

    expect(screen.getByRole('heading', { level: 2, name: 'Milestones' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Case sections' });
    expect(within(nav).getByRole('button', { name: 'Milestones' })).toHaveAttribute('aria-current', 'page');
  });

  it('CT-CASECFG-04: goes back to the dashboard', async () => {
    const { user, onBack } = await renderCase();

    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('CaseConfiguration case details', () => {
  it('CT-CASECFG-05: saves edited details', async () => {
    vi.mocked(updateCaseDetails).mockImplementation(async (caseNumber, updates) => ({
      case_number: caseNumber,
      ...updates,
      updated_at: '2026-03-01T12:00:00Z',
    }));
    const { user } = await renderCase();
    await openSection(user, 'Case Details');

    const caseType = fieldBelowLabel('Case Type');
    await user.clear(caseType);
    await user.type(caseType, '  Express Entry (CEC)  ');
    await user.selectOptions(fieldBelowLabel('Priority', 'combobox'), 'high');
    await user.selectOptions(fieldBelowLabel('Status', 'combobox'), 'in_progress');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(updateCaseDetails).toHaveBeenCalledWith(CASE_NUMBER, {
      case_type: 'Express Entry (CEC)',
      priority: 'high',
      status: 'in_progress',
      target_filing_date: '2026-03-15',
      description: mockCaseWorkspace.case.description,
      internal_notes: mockCaseWorkspace.case.internal_notes,
    });
    expect(await screen.findByText('Case details updated.')).toBeInTheDocument();
    expect(screen.getByText('Express Entry (CEC) · C-2026-001')).toBeInTheDocument();
  });

  it('CT-CASECFG-06: keeps the saved status when other details change', async () => {
    vi.mocked(updateCaseDetails).mockImplementation(async (caseNumber, updates) => ({
      case_number: caseNumber,
      ...updates,
      updated_at: '2026-03-01T12:00:00Z',
    }));
    const { user } = await renderCase();
    await openSection(user, 'Case Details');

    await user.selectOptions(fieldBelowLabel('Priority', 'combobox'), 'urgent');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(updateCaseDetails).toHaveBeenCalledWith(CASE_NUMBER, expect.objectContaining({ status: 'application_prep' }));
  });

  // Known bug: the Status dropdown lists only four statuses, so a case in any other status
  // (application_prep here) is shown as "Intake". Change `it.fails` to `it` once the dropdown is fixed.
  it.fails('CT-CASECFG-07: shows the saved status even when it is not one of the listed options', async () => {
    const { user } = await renderCase();
    await openSection(user, 'Case Details');

    expect(fieldBelowLabel('Status', 'combobox')).toHaveValue('application_prep');
  });

  it('CT-CASECFG-08: reports a failed save', async () => {
    vi.mocked(updateCaseDetails).mockRejectedValue(new Error('Validation failed'));
    const { user } = await renderCase();
    await openSection(user, 'Case Details');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText('Failed to update case details: Validation failed')).toBeInTheDocument();
  });
});

describe('CaseConfiguration documents', () => {
  async function openDocuments() {
    const result = await renderCase();
    await openSection(result.user, 'Document Requests');
    await result.user.click(screen.getByRole('button', { name: 'Expand Suites' }));
    return result;
  }

  it('CT-CASECFG-09: accepts a received document', async () => {
    vi.mocked(updateCaseDocumentStatus).mockResolvedValue({
      document_id: 'doc-paystubs',
      status: 'accepted',
      rejection_note: null,
    });
    const { user } = await openDocuments();

    await user.selectOptions(within(rowStartingWith('Recent Pay Stubs')).getByRole('combobox'), 'accepted');

    expect(updateCaseDocumentStatus).toHaveBeenCalledWith(CASE_NUMBER, 'doc-paystubs', 'accepted', null);
    expect(await screen.findByText('Document status updated.')).toBeInTheDocument();
    expect(within(rowStartingWith('Recent Pay Stubs')).getByRole('combobox')).toHaveValue('accepted');
  });

  it('CT-CASECFG-10: requires a note before rejecting a document', async () => {
    vi.mocked(updateCaseDocumentStatus).mockResolvedValue({
      document_id: 'doc-paystubs',
      status: 'rejected',
      rejection_note: 'Missing March pay stub',
    });
    const { user } = await openDocuments();

    await user.selectOptions(within(rowStartingWith('Recent Pay Stubs')).getByRole('combobox'), 'rejected');
    const dialog = screen.getByRole('dialog', { name: 'Reject Document' });
    await user.click(within(dialog).getByRole('button', { name: 'Reject Document' }));
    expect(within(dialog).getByText('Add a short note explaining why the document was rejected.')).toBeInTheDocument();
    expect(updateCaseDocumentStatus).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('Rejection note'), '  Missing March pay stub ');
    await user.click(within(dialog).getByRole('button', { name: 'Reject Document' }));

    expect(updateCaseDocumentStatus).toHaveBeenCalledWith(CASE_NUMBER, 'doc-paystubs', 'rejected', 'Missing March pay stub');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Reject Document' })).not.toBeInTheDocument());
  });

  it('CT-CASECFG-11: sends one reminder listing the outstanding required documents', async () => {
    vi.mocked(createCaseReminder).mockResolvedValue({
      id: 'msg-bulk',
      sender_name: 'Avery Counsel',
      title: 'Document Submission Reminder',
      body: 'Please upload the following pending required documents.',
      sent_at: '2026-03-01T12:00:00Z',
      read_at: null,
      acknowledged_at: null,
    });
    const { user } = await openDocuments();

    await user.click(screen.getByRole('button', { name: 'Send Reminders' }));

    expect(createCaseReminder).toHaveBeenCalledWith(CASE_NUMBER, {
      title: 'Document Submission Reminder',
      body: 'Please upload the following pending required documents:\n- Employer Reference Letter\n- Recent Pay Stubs',
      send_email_notification: true,
      visible_to_client: true,
    });
    expect(await screen.findByText('Reminder sent for 2 required documents.')).toBeInTheDocument();
  });

  it('CT-CASECFG-12: downloads an uploaded document', async () => {
    vi.mocked(getCaseDocumentDownloadUrl).mockResolvedValue({
      document_id: 'doc-passport',
      case_document_id: 'case-doc-passport',
      download_url: 'https://storage.example.test/passport.pdf',
      file_name: 'passport.pdf',
      expires_in_seconds: 300,
    });
    const { user } = await openDocuments();

    await user.click(within(rowStartingWith('Passport Biographical Page')).getByRole('button', { name: 'Download submitted file' }));

    expect(getCaseDocumentDownloadUrl).toHaveBeenCalledWith(CASE_NUMBER, 'doc-passport');
    await waitFor(() =>
      expect(triggerFileDownload).toHaveBeenCalledWith('https://storage.example.test/passport.pdf', 'passport.pdf')
    );
    expect(await screen.findByText('Downloading passport.pdf.')).toBeInTheDocument();
  });

  it('CT-CASECFG-13: cannot view or download a document that has no file', async () => {
    await openDocuments();

    const row = rowStartingWith('Travel History Summary');
    expect(within(row).getAllByRole('button', { name: 'No file uploaded yet' })).toHaveLength(2);
    within(row).getAllByRole('button', { name: 'No file uploaded yet' }).forEach((button) => expect(button).toBeDisabled());
  });

  it('CT-CASECFG-14: opens an uploaded document in a new tab', async () => {
    // Only the parts of a window the app uses: it points the new tab at the document URL.
    const popup = { closed: false, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    vi.mocked(getCaseDocumentViewUrl).mockResolvedValue(viewResponse);
    const { user } = await openDocuments();

    await user.click(within(rowStartingWith('Passport Biographical Page')).getByRole('button', { name: 'View submitted file in browser' }));

    expect(open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(popup.location.href).toBe('https://storage.example.test/view'));
    expect(await screen.findByText('Viewing passport.pdf.')).toBeInTheDocument();
  });

  it('CT-CASECFG-15: closes the blank tab when the document link cannot be fetched', async () => {
    const popup = { closed: false, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    vi.mocked(getCaseDocumentViewUrl).mockRejectedValue(new Error('Link expired'));
    const { user } = await openDocuments();

    await user.click(within(rowStartingWith('Passport Biographical Page')).getByRole('button', { name: 'View submitted file in browser' }));

    expect(await screen.findByText('Failed to open document for viewing: Link expired')).toBeInTheDocument();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('CT-CASECFG-16: warns when the browser blocks the document viewer pop-up', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    vi.mocked(getCaseDocumentViewUrl).mockResolvedValue(viewResponse);
    const { user } = await openDocuments();

    await user.click(within(rowStartingWith('Passport Biographical Page')).getByRole('button', { name: 'View submitted file in browser' }));

    expect(await screen.findByText('Could not open the document — please allow pop-ups for this site.')).toBeInTheDocument();
  });

  it('CT-CASECFG-17: renames a document', async () => {
    const { user } = await openDocuments();

    await user.click(within(rowStartingWith('Recent Pay Stubs')).getByRole('button', { name: 'Rename Document' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename Document' });
    await user.clear(within(dialog).getByRole('textbox'));
    await user.type(within(dialog).getByRole('textbox'), 'Pay Stubs (Jan–Mar)');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(renameCaseDocument).toHaveBeenCalledWith(CASE_NUMBER, 'doc-paystubs', { name: 'Pay Stubs (Jan–Mar)' });
    expect(await screen.findByText('Document renamed.')).toBeInTheDocument();
  });

  it('CT-CASECFG-18: deletes a document after confirmation', async () => {
    const { user } = await openDocuments();

    await user.click(within(rowStartingWith('Travel History Summary')).getByRole('button', { name: 'Delete Document' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete Document' })).getByRole('button', { name: 'Delete' }));

    expect(deleteCaseDocument).toHaveBeenCalledWith(CASE_NUMBER, 'doc-travel-history');
    expect(await screen.findByText('Document deleted.')).toBeInTheDocument();
  });
});

describe('CaseConfiguration document requests and uploads', () => {
  async function openDocuments() {
    const result = await renderCase();
    await openSection(result.user, 'Document Requests');
    await result.user.click(screen.getByRole('button', { name: 'Expand Suites' }));
    return result;
  }

  it('CT-CASECFG-19: adds a custom document request to the first suite', async () => {
    vi.mocked(createCaseCustomDocument).mockResolvedValue({
      ...mockCaseWorkspace.documents[0],
      id: 'doc-proof',
      name: 'Proof of Funds',
    });
    const { user } = await openDocuments();

    await user.click(screen.getByRole('button', { name: 'Add Custom Document' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Custom Document' });
    await user.type(within(dialog).getByPlaceholderText('e.g., Additional Proof of Employment'), '  Proof of Funds ');
    await user.click(within(dialog).getByRole('button', { name: 'Add Document' }));

    expect(createCaseCustomDocument).toHaveBeenCalledWith(CASE_NUMBER, {
      name: 'Proof of Funds',
      suite_id: 'suite-identity',
      required: true,
      due_date: null,
      instructions: null,
    });
    expect(await screen.findByText('Added document: Proof of Funds')).toBeInTheDocument();
  });

  it('CT-CASECFG-20: requires a name for a custom document request', async () => {
    const { user } = await openDocuments();

    await user.click(screen.getByRole('button', { name: 'Add Custom Document' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Custom Document' });
    await user.click(within(dialog).getByRole('button', { name: 'Add Document' }));

    expect(within(dialog).getByText('Document name is required.')).toBeInTheDocument();
    expect(createCaseCustomDocument).not.toHaveBeenCalled();
  });

  it('CT-CASECFG-21: creates a custom suite', async () => {
    vi.mocked(createCaseCustomDocumentSuite).mockResolvedValue({
      id: 'suite-country',
      name: 'Country Requirements',
      reason: 'Country-specific documents.',
      recommended: false,
      documents: [],
    });
    const { user } = await openDocuments();

    await user.click(screen.getByRole('button', { name: 'Create Suite' }));
    const dialog = screen.getByRole('dialog', { name: 'Create Custom Suite' });
    await user.type(within(dialog).getByPlaceholderText('e.g., Country-Specific Requirements'), 'Country Requirements');
    await user.click(within(dialog).getByRole('button', { name: 'Create Suite' }));

    expect(createCaseCustomDocumentSuite).toHaveBeenCalledWith(CASE_NUMBER, { name: 'Country Requirements', description: null });
    expect(await screen.findByText('Created suite: Country Requirements')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Country Requirements' })).toBeInTheDocument();
  });

  it('CT-CASECFG-22: uploads a firm document for a request and refreshes the case', async () => {
    const storage = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', storage);
    vi.mocked(initiateCaseDocumentUpload).mockResolvedValue(uploadSession('doc-travel-history'));
    const { user } = await openDocuments();

    const file = new File(['trip list'], 'travel.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Upload Travel History Summary'), file);

    expect(await screen.findByText('travel.pdf uploaded for malware scanning.')).toBeInTheDocument();
    expect(storage).toHaveBeenCalledWith('https://storage.example.test/upload', expect.objectContaining({ method: 'POST' }));
    expect(completeCaseDocumentUpload).toHaveBeenCalledWith(CASE_NUMBER, 'doc-travel-history', {
      storage_key: 'uploads/doc-travel-history.pdf',
      file_name: 'travel.pdf',
      file_type: 'application/pdf',
      file_size_bytes: file.size,
      client_note: 'Uploaded by the legal team for client review.',
    });
    expect(getCaseWorkspaceByNumber).toHaveBeenCalledTimes(2);
  });

  it('CT-CASECFG-23: reports a storage failure without completing the upload', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 500 })));
    vi.mocked(initiateCaseDocumentUpload).mockResolvedValue(uploadSession('doc-travel-history'));
    const { user } = await openDocuments();

    await user.upload(screen.getByLabelText('Upload Travel History Summary'), new File(['x'], 'travel.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText('Failed to upload document: Storage upload failed: 500')).toBeInTheDocument();
    expect(completeCaseDocumentUpload).not.toHaveBeenCalled();
  });

  it('CT-CASECFG-24: adds a retainer as an optional document and uploads it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    vi.mocked(createCaseCustomDocument).mockResolvedValue({
      ...mockCaseWorkspace.documents[0],
      id: 'doc-retainer',
      name: 'Retainer Agreement',
    });
    vi.mocked(initiateCaseDocumentUpload).mockResolvedValue(uploadSession('doc-retainer'));
    const { user } = await openDocuments();

    await user.upload(screen.getByLabelText('Add Retainer'), new File(['agreement'], 'retainer.pdf', { type: 'application/pdf' }));

    expect(await screen.findByText('retainer.pdf uploaded for malware scanning.')).toBeInTheDocument();
    expect(createCaseCustomDocument).toHaveBeenCalledWith(CASE_NUMBER, {
      name: 'Retainer Agreement',
      suite_id: 'suite-identity',
      required: false,
      due_date: null,
      instructions: 'Review this agreement and contact your legal team with any questions.',
    });
    expect(initiateCaseDocumentUpload).toHaveBeenCalledWith(CASE_NUMBER, 'doc-retainer', expect.objectContaining({ file_name: 'retainer.pdf' }));
  });

  it('CT-CASECFG-25: downloads every case document as one archive', async () => {
    const archive = new Blob(['zip']);
    vi.mocked(downloadCaseDocumentsArchive).mockResolvedValue({ blob: archive, filename: 'C-2026-001-documents.zip' });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:case-archive');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    // jsdom cannot save files, so record the download the app starts instead of following the link.
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    const { user } = await openDocuments();

    await user.click(screen.getByRole('button', { name: 'Download All' }));

    expect(await screen.findByText('Downloaded case documents archive.')).toBeInTheDocument();
    expect(downloadCaseDocumentsArchive).toHaveBeenCalledWith(CASE_NUMBER);
    expect(createObjectURL).toHaveBeenCalledWith(archive);
    expect(downloads).toEqual(['C-2026-001-documents.zip']);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:case-archive');
  });
});

describe('CaseConfiguration payments', () => {
  function dueDateInAMonth() {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  it('CT-CASECFG-26: lists the case invoices with what is still owed', async () => {
    const { user } = await renderCase();
    await openSection(user, 'Payments & Invoices');

    const invoice = rowStartingWith('INV-2026-002');
    expect(within(invoice).getByText('Filing preparation fee')).toBeInTheDocument();
    expect(within(invoice).getByText('$800.00')).toBeInTheDocument();
    expect(within(invoice).getByText('partial')).toBeInTheDocument();
  });

  it('CT-CASECFG-27: creates an invoice with tax and refreshes the case', async () => {
    vi.mocked(createCaseInvoice).mockResolvedValue({
      id: 'invoice-new',
      invoice_number: 'INV-2026-003',
      status: 'sent',
      subtotal: 1000,
      tax_rate: 0.13,
      tax_amount: 130,
      total_amount: 1130,
      amount_paid: 0,
      amount_due: 1130,
      currency: 'CAD',
      issue_date: '2026-03-01',
      due_date: '2026-04-01',
    });
    const { user } = await renderCase();
    await openSection(user, 'Payments & Invoices');
    const dueDate = dueDateInAMonth();

    await user.type(screen.getByLabelText('Amount before tax (CAD)'), '1000');
    await user.type(screen.getByLabelText('Due date'), dueDate);
    await user.type(screen.getByLabelText('Client note (optional)'), '  Second installment ');
    expect(screen.getByText('Total: $1,130.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create and send invoice' }));

    expect(createCaseInvoice).toHaveBeenCalledWith(
      CASE_NUMBER,
      {
        due_date: dueDate,
        tax_rate: 0.13,
        notes: 'Second installment',
        items: [{ description: 'Professional legal services', quantity: 1, unit_price: 1000, category: 'professional_fees' }],
      },
      expect.stringMatching(/^invoice-/)
    );
    await waitFor(() => expect(getCaseWorkspaceByNumber).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('Amount before tax (CAD)')).toHaveValue(null);
  });

  it('CT-CASECFG-28: shows the error and keeps the form when invoice creation fails', async () => {
    vi.mocked(createCaseInvoice).mockRejectedValue(new Error('Stripe is not configured'));
    const { user } = await renderCase();
    await openSection(user, 'Payments & Invoices');

    await user.type(screen.getByLabelText('Amount before tax (CAD)'), '250');
    await user.type(screen.getByLabelText('Due date'), dueDateInAMonth());
    await user.click(screen.getByRole('button', { name: 'Create and send invoice' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Stripe is not configured');
    expect(screen.getByLabelText('Amount before tax (CAD)')).toHaveValue(250);
  });
});

describe('CaseConfiguration milestones', () => {
  it('CT-CASECFG-29: adds a milestone to the timeline', async () => {
    vi.mocked(createCaseMilestone).mockImplementation(async (_caseNumber, input) => ({
      id: 'mile-new',
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'not_started',
      due_date: input.due_date ?? null,
      completion_percentage: 0,
      client_visible: input.client_visible ?? true,
      dependencies: [],
      completed_at: null,
    }));
    const { user } = await renderCase();
    await openSection(user, 'Milestones');

    await user.click(screen.getByRole('button', { name: 'Add Milestone' }));
    const dialog = screen.getByRole('dialog', { name: 'Add Milestone' });
    await user.type(within(dialog).getByPlaceholderText('e.g., Application submitted to IRCC'), 'Biometrics appointment');
    await user.click(within(dialog).getByRole('button', { name: 'Add Milestone' }));

    expect(createCaseMilestone).toHaveBeenCalledWith(CASE_NUMBER, expect.objectContaining({ name: 'Biometrics appointment' }));
    expect(await screen.findByRole('heading', { name: 'Biometrics appointment' })).toBeInTheDocument();
    expect(screen.getByText('Milestone added: Biometrics appointment')).toBeInTheDocument();
  });

  it('CT-CASECFG-30: hides a milestone from the client', async () => {
    vi.mocked(updateCaseMilestone).mockImplementation(async (_caseNumber, milestoneId, updates) => ({
      ...mockCaseWorkspace.milestones.find((milestone) => milestone.id === milestoneId)!,
      ...updates,
    }));
    const { user } = await renderCase();
    await openSection(user, 'Milestones');

    await user.click(within(milestoneCard('Lawyer review')).getByRole('button', { name: 'Hide from Client' }));

    expect(updateCaseMilestone).toHaveBeenCalledWith(CASE_NUMBER, 'mile-review', { client_visible: false });
    expect(await within(milestoneCard('Lawyer review')).findByRole('button', { name: 'Show to Client' })).toBeInTheDocument();
  });

  it('CT-CASECFG-31: deletes a milestone after confirmation', async () => {
    const { user } = await renderCase();
    await openSection(user, 'Milestones');

    await user.click(within(milestoneCard('Submit application')).getByRole('button', { name: 'Delete Milestone' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete Milestone' })).getByRole('button', { name: 'Delete' }));

    expect(deleteCaseMilestone).toHaveBeenCalledWith(CASE_NUMBER, 'mile-submit');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Submit application' })).not.toBeInTheDocument());
  });

  it('CT-CASECFG-32: reports a failed milestone update', async () => {
    vi.mocked(updateCaseMilestone).mockRejectedValue(new Error('Milestone locked'));
    const { user } = await renderCase();
    await openSection(user, 'Milestones');

    await user.click(within(milestoneCard('Lawyer review')).getByRole('button', { name: 'Hide from Client' }));

    expect(await screen.findByText('Failed to update milestone: Milestone locked')).toBeInTheDocument();
  });
});

describe('CaseConfiguration reminders and permissions', () => {
  it('CT-CASECFG-33: fills a reminder from a template and posts it to the portal', async () => {
    vi.mocked(createCaseReminder).mockResolvedValue({
      id: 'msg-new',
      sender_name: 'Avery Counsel',
      title: 'Payment Reminder',
      body: 'A payment is pending in your portal. Please review and complete it by the due date.',
      sent_at: '2026-03-01T12:00:00Z',
      read_at: null,
      acknowledged_at: null,
    });
    const { user } = await renderCase();
    await openSection(user, 'Reminders');

    await user.selectOptions(screen.getByRole('combobox'), 'Payment Reminder');
    expect(screen.getByPlaceholderText('e.g., Document Submission Reminder')).toHaveValue('Payment Reminder');
    await user.click(screen.getByRole('button', { name: 'Post Reminder' }));

    expect(createCaseReminder).toHaveBeenCalledWith(CASE_NUMBER, {
      title: 'Payment Reminder',
      body: 'A payment is pending in your portal. Please review and complete it by the due date.',
      send_email_notification: false,
      visible_to_client: true,
    });
    expect(await screen.findByText('Reminder posted to client portal.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Document Submission Reminder')).toHaveValue('');
  });

  it('CT-CASECFG-34: requires a title and text before posting', async () => {
    const { user } = await renderCase();
    await openSection(user, 'Reminders');

    await user.click(screen.getByRole('button', { name: 'Post Reminder' }));

    expect(screen.getByText('Title and reminder text are required.')).toBeInTheDocument();
    expect(createCaseReminder).not.toHaveBeenCalled();
  });

  it('CT-CASECFG-35: saves portal permissions', async () => {
    vi.mocked(updateCasePortalPermissions).mockImplementation(async (_caseNumber, permissions) => permissions);
    const { user } = await renderCase();
    await openSection(user, 'Sharing / Permissions');

    const portalAccess = within(screen.getByText('Client Portal Access').parentElement!).getByRole('combobox');
    await user.selectOptions(portalAccess, 'read_only');
    await user.click(screen.getByRole('button', { name: 'Save Permissions' }));

    expect(updateCasePortalPermissions).toHaveBeenCalledWith(CASE_NUMBER, { ...mockPortalPermissions, portal_access: 'read_only' });
    expect(await screen.findByText('Client portal visibility updated.')).toBeInTheDocument();
  });
});
