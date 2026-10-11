/**
 * ClientDashboard: Main dashboard view for client/applicant users, laid out like Clio's matter dashboard.
 * Left: billing summary, document checklist. Right: legal team, case details, milestone timeline, reminders, appointments.
 * Each section is still gated by the portal capabilities the lawyer configured.
 */

import { useState } from 'react';

import { createInvoiceCheckoutSession } from '@/lib/api';

import { AppointmentsPanel } from './client-dashboard/AppointmentsPanel';
import { BillingSummaryPanel } from './client-dashboard/BillingSummaryPanel';
import { CaseSummaryCard, LegalTeamCard } from './client-dashboard/CaseSummaryCard';
import { DocumentChecklistPanel } from './client-dashboard/DocumentChecklistPanel';
import { RemindersPanel } from './client-dashboard/RemindersPanel';
import { MilestonesPanel } from './client-dashboard/MilestonesPanel';
import { useClientDashboardData } from './client-dashboard/useClientDashboardData';
import { PageHeader } from './AppShell';
import { Alert, Card, CardHeader, Select } from './ui';

export function ClientDashboard() {
  const {
    clientCases,
    selectedCaseNumber,
    setSelectedCaseNumber,
    workspace,
    loading,
    switchingCase,
    error,
    caseInfo,
    documents,
    milestones,
    allReminders,
    recentReminders,
    upcomingAppointments,
    requiredDocuments,
    completedRequiredDocuments,
    capabilities,
    billingInfo,
    uploadDocument,
    deleteUploadedDocument,
    downloadDocument,
    markReminderRead,
    uploadingDocumentId,
    deletingDocumentId,
    downloadingDocumentId,
  } = useClientDashboardData();
  const [paymentPending, setPaymentPending] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (loading) {
    return <div className="p-8 text-sm text-gray-600">Loading client dashboard...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <Alert tone="danger">Failed to load dashboard: {error}</Alert>
      </div>
    );
  }

  if (!workspace) {
    return <div className="p-8 text-sm text-gray-600">No client case data found.</div>;
  }

  const isPortalDisabled = capabilities.portalAccess === 'disabled';
  const hasVisibleSections =
    capabilities.canViewCaseStatus ||
    capabilities.canViewDocuments ||
    capabilities.canViewMilestones ||
    capabilities.canViewReminders ||
    capabilities.canViewBilling;
  const firstName = workspace.case.client_name.trim().split(/\s+/)[0] || workspace.case.client_name;
  const payableInvoice = workspace.payment_items.find(
    (invoice) => invoice.amount_due > 0 && !['draft', 'cancelled', 'paid', 'refunded'].includes(invoice.status)
  );

  const makePayment = async () => {
    if (!payableInvoice) {
      return;
    }
    setPaymentPending(true);
    setPaymentError(null);
    try {
      const checkout = await createInvoiceCheckoutSession(
        payableInvoice.id,
        `portal-${crypto.randomUUID()}`
      );
      window.location.assign(checkout.checkout_url);
    } catch (requestError) {
      setPaymentError(requestError instanceof Error ? requestError.message : 'Unable to open secure checkout');
      setPaymentPending(false);
    }
  };

  const showCaseDetails = capabilities.canViewCaseStatus && Boolean(caseInfo);
  const showAppointments = capabilities.canViewMilestones;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here's the latest on your immigration case."
        actions={
          clientCases.length > 1 ? (
            <div className="w-72">
              <label htmlFor="client-case-select" className="mb-1 block text-xs font-medium text-gray-500">
                Select Case
              </label>
              <Select
                id="client-case-select"
                compact
                value={selectedCaseNumber ?? workspace.case.case_number}
                onChange={(event) => setSelectedCaseNumber(event.target.value)}
              >
                {clientCases.map((caseItem) => (
                  <option key={caseItem.case_number} value={caseItem.case_number}>
                    {caseItem.case_number} - {caseItem.case_type}
                  </option>
                ))}
              </Select>
              {switchingCase ? (
                <p className="mt-1 text-xs text-gray-500">Loading selected case...</p>
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {isPortalDisabled ? (
          <Card className="mx-auto max-w-3xl p-8">
            <h2 className="text-xl font-semibold text-gray-900">Portal access is temporarily disabled</h2>
            <p className="mt-3 text-sm text-gray-600">
              Your legal team has temporarily restricted this case portal. Please select another case or contact your assigned law firm for access.
            </p>
          </Card>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-3">
            {/* ── Main column ── */}
            <div className="space-y-6 lg:col-span-2">
              {capabilities.canViewBilling ? (
                <BillingSummaryPanel
                  billingInfo={billingInfo}
                  canPay={Boolean(payableInvoice)}
                  paying={paymentPending}
                  error={paymentError}
                  onPay={makePayment}
                />
              ) : null}

              {capabilities.canViewDocuments ? (
                <DocumentChecklistPanel
                  documents={documents}
                  completedRequiredDocuments={completedRequiredDocuments}
                  requiredDocuments={requiredDocuments}
                  canUploadDocuments={capabilities.canUploadDocuments}
                  onUploadDocument={uploadDocument}
                  onDeleteUploadedDocument={deleteUploadedDocument}
                  onDownloadDocument={downloadDocument}
                  uploadingDocumentId={uploadingDocumentId}
                  deletingDocumentId={deletingDocumentId}
                  downloadingDocumentId={downloadingDocumentId}
                />
              ) : null}

              {!hasVisibleSections ? (
                <Alert>No sections are currently visible for this case portal.</Alert>
              ) : null}
            </div>

            {/* ── Side column ── */}
            <div className="space-y-6">
              {showCaseDetails && caseInfo ? (
                <>
                  <LegalTeamCard caseInfo={caseInfo} />
                  <CaseSummaryCard caseInfo={caseInfo} />
                </>
              ) : (
                <Card>
                  <CardHeader title="Case Overview" />
                  <p className="px-5 py-4 text-sm text-gray-600">
                    Your legal team has limited detailed case status visibility for this portal.
                  </p>
                </Card>
              )}
              {capabilities.canViewMilestones ? <MilestonesPanel milestones={milestones} /> : null}
              {capabilities.canViewReminders ? (
                <RemindersPanel
                  allReminders={allReminders}
                  recentReminders={recentReminders}
                  onMarkRead={markReminderRead}
                />
              ) : null}
              {showAppointments ? <AppointmentsPanel upcomingAppointments={upcomingAppointments} /> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
