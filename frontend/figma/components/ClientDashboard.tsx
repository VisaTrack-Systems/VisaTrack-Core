import { AppointmentsPanel } from './client-dashboard/AppointmentsPanel';
import { CaseSummaryCard } from './client-dashboard/CaseSummaryCard';
import { DocumentChecklistPanel } from './client-dashboard/DocumentChecklistPanel';
import { RemindersPanel } from './client-dashboard/RemindersPanel';
import { MilestonesPanel } from './client-dashboard/MilestonesPanel';
import { useClientDashboardData } from './client-dashboard/useClientDashboardData';

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
    uploadDocument,
    deleteUploadedDocument,
    downloadDocument,
    markReminderRead,
    uploadingDocumentId,
    deletingDocumentId,
    downloadingDocumentId,
  } = useClientDashboardData();

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Loading client dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-50 p-10 text-red-600">Failed to load dashboard: {error}</div>;
  }

  if (!workspace) {
    return <div className="min-h-screen bg-gray-50 p-10 text-gray-600">No client case data found.</div>;
  }

  const isPortalDisabled = capabilities.portalAccess === 'disabled';
  const hasVisibleSections =
    capabilities.canViewCaseStatus ||
    capabilities.canViewDocuments ||
    capabilities.canViewMilestones ||
    capabilities.canViewReminders;
  const firstName = workspace.case.client_name.trim().split(/\s+/)[0] || workspace.case.client_name;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {firstName}</h1>
              <p className="text-sm text-gray-500 mt-1">Here&apos;s the latest on your immigration case.</p>
            </div>
            {clientCases.length > 1 ? (
              <div className="w-72">
                <label className="block text-xs font-medium text-gray-500 mb-1">Select Case</label>
                <select
                  value={selectedCaseNumber ?? workspace.case.case_number}
                  onChange={(event) => setSelectedCaseNumber(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-900"
                >
                  {clientCases.map((caseItem) => (
                    <option key={caseItem.case_number} value={caseItem.case_number}>
                      {caseItem.case_number} - {caseItem.case_type}
                    </option>
                  ))}
                </select>
                {switchingCase ? (
                  <p className="mt-1 text-xs text-gray-500">Loading selected case...</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isPortalDisabled ? (
          <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl p-8">
            <h1 className="text-2xl font-semibold text-gray-900">Portal access is temporarily disabled</h1>
            <p className="mt-3 text-sm text-gray-600">
              Your legal team has temporarily restricted this case portal. Please select another case or contact your assigned law firm for access.
            </p>
          </div>
        ) : null}

        {!isPortalDisabled && capabilities.canViewCaseStatus && caseInfo ? (
          <CaseSummaryCard caseInfo={caseInfo} />
        ) : !isPortalDisabled ? (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900">Case Overview</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your legal team has limited detailed case status visibility for this portal.
            </p>
          </div>
        ) : null}

        {!isPortalDisabled ? (
          <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
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
            {capabilities.canViewMilestones ? <MilestonesPanel milestones={milestones} /> : null}
          </div>

          <div className="space-y-6">
            {capabilities.canViewReminders ? (
              <RemindersPanel
                allReminders={allReminders}
                recentReminders={recentReminders}
                onMarkRead={markReminderRead}
              />
            ) : null}
            {capabilities.canViewMilestones ? (
              <AppointmentsPanel upcomingAppointments={upcomingAppointments} />
            ) : null}
          </div>
          </div>
        ) : null}

        {!isPortalDisabled && !hasVisibleSections ? (
          <div className="mt-8 bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-600">
            No sections are currently visible for this case portal.
          </div>
        ) : null}
      </div>
    </div>
  );
}
