import type {
  AdminOperations,
  AdminOverview,
  AdminRoleItem,
  CaseListItem,
  CasePortalPermissions,
  CaseWorkspace,
  ClientCaseListItem,
  CurrentUser,
  CurrentUserSettings,
  OrganizationListItem,
  UserListItem,
} from '@/lib/api';
import type { UiCase } from '../components/active-cases/types';
import type {
  BillingInfo,
  CaseInfo,
  DashboardAppointment,
  DashboardDocument,
  DashboardReminder,
  DashboardMilestone,
} from '../components/client-dashboard/types';
import type {
  ActivityItem,
  DashboardCase,
  DashboardStats,
} from '../components/lawyer-dashboard/types';

export const authTokenStorageKey = 'visatrack.access_token';
export const organizationId = '7921a758-d51c-4ead-83a6-9413fa5c2143';
export const lawyerUserId = '98827b56-2b1f-4095-ae39-4dbbfe6511a3';
export const clientUserId = 'a924f8ad-fa36-474d-bc89-45dafd0d4695';

export const mockCurrentUserLawyer: CurrentUser = {
  id: lawyerUserId,
  organization_id: organizationId,
  email: 'lawyer@example.com',
  full_name: 'Avery Counsel',
  status: 'active',
  roles: ['lawyer'],
  active_role: 'lawyer',
  onboarding_required: false,
  last_login_at: '2026-02-27T14:00:00Z',
};

export const mockCurrentUserClient: CurrentUser = {
  id: clientUserId,
  organization_id: organizationId,
  email: 'client@example.com',
  full_name: 'Jordan Client',
  status: 'active',
  roles: ['client'],
  active_role: 'client',
  onboarding_required: false,
  last_login_at: '2026-02-27T14:05:00Z',
};

export const mockCurrentUserAdmin: CurrentUser = {
  id: 'fad082d0-e7ce-42fd-a50d-f142ab024104',
  organization_id: organizationId,
  email: 'admin@example.com',
  full_name: 'Morgan Admin',
  status: 'active',
  roles: ['org_admin'],
  active_role: 'org_admin',
  onboarding_required: false,
  last_login_at: '2026-02-27T13:45:00Z',
};

export const mockCurrentUserSettings: CurrentUserSettings = {
  id: lawyerUserId,
  organization_id: organizationId,
  email: 'lawyer@example.com',
  first_name: 'Avery',
  last_name: 'Counsel',
  phone: '+1 416 555 0100',
  avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&q=80',
  email_verified: true,
  phone_verified: false,
  mfa_enabled: true,
  timezone: 'America/Toronto',
  locale: 'en-CA',
  status: 'active',
};

export const mockLawyerClients: UserListItem[] = [
  {
    id: clientUserId,
    email: 'client@example.com',
    full_name: 'Jordan Client',
    status: 'active',
    organization_id: organizationId,
    created_at: '2026-02-01T12:00:00Z',
    roles: ['client'],
  },
  {
    id: '5b8a7167-c5d2-4352-a7a0-6a1a58e4f211',
    email: 'family.member@example.com',
    full_name: 'Taylor Family',
    status: 'invited',
    organization_id: organizationId,
    created_at: '2026-02-03T10:00:00Z',
    roles: ['client'],
  },
];

export const mockLawyerCases: CaseListItem[] = [
  {
    id: '4265bd2d-1c67-4436-873e-beb3548ab60f',
    organization_id: organizationId,
    case_number: 'C-2026-001',
    case_type: 'Express Entry',
    status: 'application_prep',
    priority: 'medium',
    client_name: 'Jordan Client',
    primary_lawyer_name: 'Avery Counsel',
    target_filing_date: '2026-03-15',
    created_at: '2026-02-10T06:22:35Z',
  },
  {
    id: 'f34db32e-c2ad-42e9-a3a8-4f3bb7e740de',
    organization_id: organizationId,
    case_number: 'C-2026-002',
    case_type: 'Work Permit Extension',
    status: 'intake',
    priority: 'urgent',
    client_name: 'Jordan Client',
    primary_lawyer_name: 'Avery Counsel',
    target_filing_date: '2026-03-01',
    created_at: '2026-02-13T21:16:13Z',
  },
  {
    id: '61e4424b-99d2-4bd8-b47d-4ea88e4ae4fe',
    organization_id: organizationId,
    case_number: 'C-2026-003',
    case_type: 'Study Permit',
    status: 'document_review',
    priority: 'high',
    client_name: 'Taylor Family',
    primary_lawyer_name: 'Avery Counsel',
    target_filing_date: '2026-03-22',
    created_at: '2026-02-18T17:30:00Z',
  },
];

export const mockClientCases: ClientCaseListItem[] = mockLawyerCases.slice(0, 2).map((entry) => ({
  id: entry.id,
  case_number: entry.case_number,
  case_type: entry.case_type,
  status: entry.status,
  priority: entry.priority,
  primary_lawyer_name: entry.primary_lawyer_name,
  target_filing_date: entry.target_filing_date,
  created_at: entry.created_at,
}));

export const mockPortalPermissions: CasePortalPermissions = {
  show_case_status_progress: true,
  show_milestone_details: true,
  show_document_requirements: true,
  portal_access: 'full_access',
  document_upload: 'enabled',
  reminders: 'enabled',
};

export const mockCaseWorkspace: CaseWorkspace = {
  case: {
    id: '4265bd2d-1c67-4436-873e-beb3548ab60f',
    case_number: 'C-2026-001',
    case_type: 'Express Entry',
    status: 'application_prep',
    priority: 'medium',
    client_id: clientUserId,
    client_name: 'Jordan Client',
    primary_lawyer_name: 'Avery Counsel',
    start_date: '2026-02-10',
    target_filing_date: '2026-03-15',
    estimated_completion_from: '2026-06-01',
    estimated_completion_to: '2026-08-15',
    completion_confidence: 72,
    progress_percent: 68,
    description: 'Express Entry permanent residence application for a software engineer.',
    internal_notes: 'Waiting on employment reference and police certificate.',
  },
  document_suites: [
    {
      id: 'suite-identity',
      name: 'Identity Documents',
      reason: 'Core identity verification documents required for filing.',
      recommended: true,
      documents: [
        {
          id: 'doc-passport',
          name: 'Passport Biographical Page',
          required: true,
          status: 'accepted',
          due_date: '2026-03-01',
          uploaded_at: '2026-02-12T14:00:00Z',
          instructions: 'Upload a clear color scan of the main passport page.',
          file_name: 'passport.pdf',
          latest_case_document_id: 'case-doc-passport',
          can_download: true,
        },
        {
          id: 'doc-national-id',
          name: 'National ID Card',
          required: false,
          status: 'not_requested',
          due_date: null,
          uploaded_at: null,
          instructions: 'Optional if available.',
          file_name: null,
          latest_case_document_id: null,
          can_download: false,
        },
      ],
    },
    {
      id: 'suite-employment',
      name: 'Employment Evidence',
      reason: 'Required to validate skilled work history.',
      recommended: true,
      documents: [
        {
          id: 'doc-reference',
          name: 'Employer Reference Letter',
          required: true,
          status: 'rejected',
          due_date: '2026-03-05',
          uploaded_at: '2026-02-19T16:30:00Z',
          instructions: 'Must include duties, salary, and duration.',
          rejection_note: 'Please upload a revised letter that includes salary and a full duties breakdown.',
          file_name: 'reference-letter.pdf',
          latest_case_document_id: 'case-doc-reference',
          can_download: true,
        },
        {
          id: 'doc-paystubs',
          name: 'Recent Pay Stubs',
          required: true,
          status: 'received',
          due_date: '2026-03-05',
          uploaded_at: '2026-02-20T10:15:00Z',
          instructions: 'Upload the last three months.',
          file_name: 'paystubs.zip',
          latest_case_document_id: 'case-doc-paystubs',
          can_download: true,
        },
      ],
    },
    {
      id: 'suite-custom',
      name: 'Custom Requests',
      reason: 'Matter-specific follow-up documents.',
      recommended: false,
      documents: [
        {
          id: 'doc-travel-history',
          name: 'Travel History Summary',
          required: false,
          status: 'requested',
          due_date: '2026-03-10',
          uploaded_at: null,
          instructions: 'Provide a list of trips taken in the last 10 years.',
          file_name: null,
          latest_case_document_id: null,
          can_download: false,
        },
      ],
    },
  ],
  documents: [],
  milestones: [
    {
      id: 'mile-collect-docs',
      name: 'Collect supporting documents',
      description: 'Gather identity, employment, and education evidence.',
      status: 'completed',
      due_date: '2026-02-25',
      completion_percentage: 100,
      client_visible: true,
      dependencies: [],
      completed_at: '2026-02-24T15:00:00Z',
    },
    {
      id: 'mile-review',
      name: 'Lawyer review',
      description: 'Review drafts and evidence for completeness.',
      status: 'in_progress',
      due_date: '2026-03-04',
      completion_percentage: 60,
      client_visible: true,
      dependencies: ['mile-collect-docs'],
      completed_at: null,
    },
    {
      id: 'mile-submit',
      name: 'Submit application',
      description: 'Finalize forms and submit to IRCC.',
      status: 'not_started',
      due_date: '2026-03-15',
      completion_percentage: 0,
      client_visible: true,
      dependencies: ['mile-review'],
      completed_at: null,
    },
  ],
  payment_items: [
    {
      id: 'invoice-001',
      description: 'Initial retainer',
      amount: 3500,
      amount_paid: 3500,
      amount_due: 0,
      status: 'paid',
      due_date: '2026-02-15',
      paid_date: '2026-02-14',
      invoice_number: 'INV-2026-001',
    },
    {
      id: 'invoice-002',
      description: 'Filing preparation fee',
      amount: 1200,
      amount_paid: 400,
      amount_due: 800,
      status: 'partial',
      due_date: '2026-03-08',
      paid_date: null,
      invoice_number: 'INV-2026-002',
    },
  ],
  reminders: [
    {
      id: 'msg-001',
      sender_name: 'Avery Counsel',
      title: 'Updated review status',
      body: 'We reviewed the employer letter. Please upload a revised version with salary information.',
      sent_at: '2026-02-21T14:00:00Z',
      read_at: null,
      acknowledged_at: null,
    },
    {
      id: 'msg-002',
      sender_name: 'Avery Counsel',
      title: 'Travel history follow-up',
      body: 'Please upload the travel history summary draft for review.',
      sent_at: '2026-02-22T17:45:00Z',
      read_at: '2026-02-22T18:00:00Z',
      acknowledged_at: '2026-02-22T18:15:00Z',
    },
  ],
  appointments: [
    {
      title: 'Application submission target',
      date: '2026-03-15',
      time: '10:00 AM',
      appointment_type: 'Filing deadline',
    },
    {
      title: 'Document review call',
      date: '2026-03-04',
      time: '2:30 PM',
      appointment_type: 'Client call',
    },
  ],
  billing_summary: {
    total_fees: 4700,
    paid: 3900,
    remaining: 800,
    next_payment: '2026-03-08',
    payment_method: 'Visa ending in 4242',
  },
  assignments: [
    {
      id: 'assignment-1',
      member_name: 'Avery Counsel',
      role: 'lead_lawyer',
      assigned_at: '2026-02-10T12:00:00Z',
    },
    {
      id: 'assignment-2',
      member_name: 'Riley Paralegal',
      role: 'paralegal',
      assigned_at: '2026-02-11T13:00:00Z',
    },
  ],
  portal_permissions: mockPortalPermissions,
};

mockCaseWorkspace.documents = mockCaseWorkspace.document_suites.flatMap((suite) => suite.documents);

export const mockCaseWorkspaceSecondary: CaseWorkspace = {
  ...JSON.parse(JSON.stringify(mockCaseWorkspace)),
  case: {
    ...mockCaseWorkspace.case,
    id: 'f34db32e-c2ad-42e9-a3a8-4f3bb7e740de',
    case_number: 'C-2026-002',
    case_type: 'Work Permit Extension',
    status: 'intake',
    priority: 'urgent',
    target_filing_date: '2026-03-01',
    estimated_completion_from: '2026-04-01',
    estimated_completion_to: '2026-05-20',
    completion_confidence: 58,
    progress_percent: 24,
    description: 'Work permit extension matter for an in-Canada applicant.',
    internal_notes: 'Waiting on updated employer support letter.',
  },
  portal_permissions: {
    ...mockPortalPermissions,
    reminders: 'disabled',
  },
};

mockCaseWorkspaceSecondary.document_suites = mockCaseWorkspaceSecondary.document_suites.map((suite) => ({
  ...suite,
  documents: suite.documents.map((document) =>
    document.id === 'doc-reference'
      ? {
          ...document,
          status: 'pending',
          uploaded_at: null,
          file_name: null,
          latest_case_document_id: null,
          can_download: false,
        }
      : document.id === 'doc-paystubs'
        ? {
            ...document,
            status: 'received',
            uploaded_at: '2026-02-18T10:15:00Z',
            file_name: 'work-permit-paystubs.zip',
            latest_case_document_id: 'case-doc-work-permit-paystubs',
            can_download: true,
          }
        : document
  ),
}));
mockCaseWorkspaceSecondary.documents = mockCaseWorkspaceSecondary.document_suites.flatMap((suite) => suite.documents);

export const mockUiCases: UiCase[] = [
  {
    id: 'C-2026-001',
    clientName: 'Jordan Client',
    caseType: 'Express Entry',
    status: 'Document Review',
    priority: 'high',
    lastActivity: '2 hours ago',
    nextMilestone: 'Lawyer review',
    nextDeadline: 'Mar 15, 2026',
    outstandingDocs: 2,
    outstandingPayments: 1,
    completionPercent: 68,
  },
  {
    id: 'C-2026-002',
    clientName: 'Jordan Client',
    caseType: 'Work Permit Extension',
    status: 'Intake',
    priority: 'urgent',
    lastActivity: '1 day ago',
    nextMilestone: 'Collect documents',
    nextDeadline: 'Mar 1, 2026',
    outstandingDocs: 4,
    outstandingPayments: 0,
    completionPercent: 20,
  },
];

export const mockDashboardCases: DashboardCase[] = mockLawyerCases.map((entry) => ({
  id: entry.case_number,
  clientName: entry.client_name,
  caseType: entry.case_type,
  status: entry.status.replaceAll('_', ' '),
  lastUpdate: '2 hours ago',
  priority: entry.priority,
  nextDeadline: entry.target_filing_date ?? 'Not set',
}));

export const mockDashboardStats: DashboardStats = {
  activeCases: 3,
  totalUsers: 11,
  upcomingMilestones: 3,
  completedCases: 1,
};

export const mockActivityItems: ActivityItem[] = [
  { action: 'Document uploaded', client: 'Jordan Client', detail: 'Passport Biographical Page', time: '10 minutes ago', type: 'document' },
  { action: 'Reminder sent', client: 'Jordan Client', detail: 'Follow-up for employer letter', time: '1 hour ago', type: 'reminder' },
  { action: 'Payment recorded', client: 'Jordan Client', detail: 'Retainer payment settled', time: 'Yesterday', type: 'payment' },
  { action: 'Milestone completed', client: 'Taylor Family', detail: 'Collect supporting documents', time: '2 days ago', type: 'milestone' },
];

export const mockDashboardDocuments: DashboardDocument[] = mockCaseWorkspace.documents
  .filter((document) => document.status !== 'not_requested')
  .map((document) => {
    const isRejected = document.status === 'rejected';

    return {
      id: document.id,
      name: document.name,
      status:
        document.status === 'accepted' || document.status === 'approved'
          ? 'completed'
          : document.status === 'received' || document.status === 'under_review'
            ? 'review'
            : document.required
              ? 'pending'
              : 'optional',
      lawyerStatus: document.status
        .replaceAll('_', ' ')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join(' '),
      rejectionNote: document.rejection_note ?? null,
      uploadedDate: isRejected ? 'Not set' : (document.uploaded_at ?? 'Pending'),
      required: document.required,
      instructions: document.instructions,
      fileName: isRejected ? null : document.file_name,
      canDownload: isRejected ? false : document.can_download,
    };
  });

export const mockDashboardMilestones: DashboardMilestone[] = [
  { title: 'Collect supporting documents', status: 'completed', date: 'Feb 24, 2026', description: 'Identity and employment package completed.' },
  { title: 'Lawyer review', status: 'in-progress', date: 'Mar 4, 2026', description: 'Reviewing revised employer letter.' },
  { title: 'Submit application', status: 'upcoming', date: 'Mar 15, 2026', description: 'Ready to file once revisions are approved.' },
];

export const mockDashboardReminders: DashboardReminder[] = [
  {
    id: 'dash-reminder-1',
    from: 'Avery Counsel',
    title: 'Updated review status',
    preview: 'Please upload a revised employer letter including salary.',
    body: 'Please upload a revised employer letter including salary and responsibilities. Once uploaded, we will review and proceed with the submission package.',
    time: '2 hours ago',
    unread: true,
    acknowledged: false,
  },
  {
    id: 'dash-reminder-2',
    from: 'Billing',
    title: 'Invoice reminder',
    preview: 'Your filing preparation balance is due next week.',
    body: 'Your filing preparation balance is due next week. You can complete payment in the billing section of your portal.',
    time: '1 day ago',
    unread: false,
    acknowledged: true,
  },
];

export const mockDashboardAppointments: DashboardAppointment[] = [
  { title: 'Document review call', date: 'Mar 4, 2026', time: '2:30 PM', type: 'Client call' },
  { title: 'Submission target', date: 'Mar 15, 2026', time: '10:00 AM', type: 'Deadline' },
];

export const mockBillingInfo: BillingInfo = {
  totalFees: 4700,
  paid: 3900,
  remaining: 800,
  nextPayment: 'Due Mar 8, 2026',
  paymentMethod: 'Visa ending in 4242',
};

export const mockCaseInfo: CaseInfo = {
  id: 'C-2026-001',
  type: 'Express Entry',
  status: 'Application Prep',
  assignedLawyer: 'Avery Counsel',
  startDate: 'Feb 10, 2026',
  estimatedCompletion: 'Jun 1, 2026 - Aug 15, 2026',
};

export const mockOrganizations: OrganizationListItem[] = [
  {
    id: organizationId,
    name: 'North Star Immigration',
    slug: 'north-star-immigration',
    contact_email: 'contact@northstar.example',
    subscription_status: 'active',
    created_at: '2026-01-12T09:00:00Z',
  },
];

export const mockAdminUsers: UserListItem[] = [
  {
    id: lawyerUserId,
    email: 'lawyer@example.com',
    full_name: 'Avery Counsel',
    status: 'active',
    organization_id: organizationId,
    created_at: '2026-01-12T09:30:00Z',
    roles: ['lawyer'],
  },
  {
    id: clientUserId,
    email: 'client@example.com',
    full_name: 'Jordan Client',
    status: 'active',
    organization_id: organizationId,
    created_at: '2026-01-15T11:15:00Z',
    roles: ['client'],
  },
];

export const mockAdminRoles: AdminRoleItem[] = [
  {
    id: 'role-lawyer',
    organization_id: null,
    name: 'Lawyer',
    slug: 'lawyer',
    description: 'Can manage assigned matters',
    is_system: true,
    permissions: ['cases:manage', 'documents:manage'],
  },
  {
    id: 'role-client',
    organization_id: null,
    name: 'Client',
    slug: 'client',
    description: 'Can access assigned portal data',
    is_system: true,
    permissions: ['portal:view'],
  },
];

export const mockAdminOperations: AdminOperations = {
  organization_id: organizationId,
  unassigned_cases: [],
  aging_cases: [],
  lawyer_workload: [],
  pending_invitations: [],
};

export const mockAdminOverview: AdminOverview = {
  stats: {
    organizations: 1,
    users: 11,
    active_users: 9,
    active_cases: 3,
    completed_cases: 1,
  },
  recent_organizations: mockOrganizations.map((organization) => ({ ...organization })),
  recent_users: mockAdminUsers.map((user) => ({ ...user })),
  recent_cases: mockLawyerCases.map((entry) => ({
    id: entry.id,
    case_number: entry.case_number,
    case_type: entry.case_type,
    status: entry.status,
    priority: entry.priority,
    client_name: entry.client_name,
    created_at: entry.created_at,
  })),
};

export const mockAdminOperations: AdminOperations = {
  organization_id: organizationId,
  unassigned_cases: [],
  aging_cases: [],
  lawyer_workload: [],
  pending_invitations: [],
};
