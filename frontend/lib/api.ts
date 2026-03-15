export type DashboardOverview = {
  stats: {
    organizations: number;
    users: number;
    active_cases: number;
    completed_cases: number;
  };
  recent_cases: Array<{
    id: string;
    case_number: string;
    case_type: string;
    status: string;
    priority: string;
    client_name: string;
  }>;
  upcoming_milestones: Array<{
    id: string;
    case_id: string;
    case_number: string;
    name: string;
    due_date: string | null;
    status: string;
  }>;
};

export type CaseListItem = {
  id: string;
  organization_id: string;
  case_number: string;
  case_type: string;
  status: string;
  priority: string;
  client_name: string;
  primary_lawyer_name: string | null;
  target_filing_date: string | null;
  created_at: string;
};

export type ClientCaseListItem = {
  id: string;
  case_number: string;
  case_type: string;
  status: string;
  priority: string;
  primary_lawyer_name: string | null;
  target_filing_date: string | null;
  created_at: string;
};

export type CreateCaseInput = {
  organization_id: string;
  client_id: string;
  primary_lawyer_id?: string | null;
  case_number?: string | null;
  case_type: string;
  status?: string;
  priority?: string;
  target_filing_date?: string | null;
  description?: string | null;
  internal_notes?: string | null;
};

export type LawyerCaseCreateInput = {
  client_user_id: string;
  case_type: string;
  priority?: string;
  target_filing_date?: string | null;
  description?: string | null;
};

export type InviteClientInput = {
  email: string;
  first_name: string;
  last_name: string;
  relationship_type?: string;
};

export type InviteClientResponse = {
  case_number: string;
  client_email: string;
  invited_user_id: string;
  invitation_url: string;
};

export type LawyerClientCreateInput = {
  email: string;
  first_name: string;
  last_name: string;
  send_invite?: boolean;
};

export type LawyerClientCreateResponse = {
  user_id: string;
  email: string;
  full_name: string;
  status: string;
  invitation_url: string | null;
};

export type OrganizationListItem = {
  id: string;
  name: string;
  slug: string;
  contact_email: string;
  subscription_status: string;
  created_at: string;
};

export type UserListItem = {
  id: string;
  email: string;
  full_name: string;
  status: string;
  organization_id: string | null;
  created_at: string;
  roles: string[];
};

export type AdminOverview = {
  stats: {
    organizations: number;
    users: number;
    active_users: number;
    active_cases: number;
    completed_cases: number;
  };
  recent_organizations: Array<{
    id: string;
    name: string;
    slug: string;
    contact_email: string;
    subscription_status: string;
    created_at: string;
  }>;
  recent_users: Array<{
    id: string;
    organization_id: string | null;
    email: string;
    full_name: string;
    status: string;
    created_at: string;
  }>;
  recent_cases: Array<{
    id: string;
    case_number: string;
    case_type: string;
    status: string;
    priority: string;
    client_name: string;
    created_at: string;
  }>;
};

export type AdminRoleItem = {
  id: string;
  organization_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  permissions: string[];
};

export type AdminCreateOrganizationInput = {
  name: string;
  contact_email: string;
  slug: string;
  subscription_tier?: string;
  subscription_status?: string;
};

export type AdminCreateUserInput = {
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  status?: string;
  role_slug?: string;
};

export type AdminCreateUserResult = UserListItem & {
  invitation_url: string | null;
};

export type VerifyInvitationResult = {
  email: string;
  full_name: string;
  organization_id: string;
  expires_at: string;
};

export type AcceptInvitationResult = {
  message: string;
  email: string;
  organization_id: string;
};

export type AdminOperations = {
  organization_id: string;
  unassigned_cases: Array<{
    case_id: string;
    case_number: string;
    case_type: string;
    status: string;
    priority: string;
    created_at: string;
    days_open: number;
    primary_lawyer_id: string | null;
    primary_lawyer_name: string | null;
  }>;
  aging_cases: Array<{
    case_id: string;
    case_number: string;
    case_type: string;
    status: string;
    priority: string;
    created_at: string;
    days_open: number;
    primary_lawyer_id: string | null;
    primary_lawyer_name: string | null;
  }>;
  lawyer_workload: Array<{
    lawyer_user_id: string;
    full_name: string;
    active_cases: number;
  }>;
  pending_invitations: Array<{
    invitation_id: string;
    user_id: string;
    email: string;
    role_slug: string;
    created_at: string;
    expires_at: string;
    status: string;
    invited_by_name: string | null;
  }>;
};

export type AdminCaseAssignmentInput = {
  lawyer_user_id: string | null;
};

export type AdminCaseAssignmentResult = {
  case_id: string;
  case_number: string;
  primary_lawyer_id: string | null;
  primary_lawyer_name: string | null;
};

export type MilestoneSummary = {
  id: string;
  name: string;
  status: string;
  due_date: string | null;
  completion_percentage: number;
};

export type CaseSummary = {
  id: string;
  case_number: string;
  case_type: string;
  status: string;
  priority: string;
  client_name: string;
  primary_lawyer_name: string | null;
  target_filing_date: string | null;
  estimated_completion_from: string | null;
  estimated_completion_to: string | null;
  description: string | null;
  internal_notes: string | null;
  milestones: MilestoneSummary[];
};

export type CaseWorkspace = {
  case: {
    id: string;
    case_number: string;
    case_type: string;
    status: string;
    priority: string;
    client_id: string;
    client_name: string;
    primary_lawyer_name: string | null;
    start_date: string | null;
    target_filing_date: string | null;
    estimated_completion_from: string | null;
    estimated_completion_to: string | null;
    completion_confidence: number | null;
    progress_percent: number;
    description: string | null;
    internal_notes: string | null;
  };
  document_suites: Array<{
    id: string;
    name: string;
    reason: string;
    recommended: boolean;
    documents: Array<{
      id: string;
      name: string;
      required: boolean;
      status: string;
      due_date: string | null;
      uploaded_at: string | null;
      instructions: string | null;
      client_note?: string | null;
      rejection_note?: string | null;
      file_name: string | null;
      latest_case_document_id: string | null;
      can_download: boolean;
    }>;
  }>;
  documents: Array<{
    id: string;
    name: string;
    required: boolean;
    status: string;
    due_date: string | null;
    uploaded_at: string | null;
    instructions: string | null;
    client_note?: string | null;
    rejection_note?: string | null;
    file_name: string | null;
    latest_case_document_id: string | null;
    can_download: boolean;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    due_date: string | null;
    completion_percentage: number;
    client_visible: boolean;
    dependencies: string[];
    completed_at: string | null;
  }>;
  payment_items: Array<{
    id: string;
    description: string;
    amount: number;
    amount_paid: number;
    amount_due: number;
    status: string;
    due_date: string | null;
    paid_date: string | null;
    invoice_number: string | null;
  }>;
  reminders: Array<{
    id: string;
    sender_name: string;
    title: string;
    body: string;
    sent_at: string | null;
    read_at: string | null;
    acknowledged_at: string | null;
  }>;
  appointments: Array<{
    title: string;
    date: string;
    time: string;
    appointment_type: string;
  }>;
  billing_summary: {
    total_fees: number;
    paid: number;
    remaining: number;
    next_payment: string | null;
    payment_method: string | null;
  };
  assignments: Array<{
    id: string;
    member_name: string;
    role: string;
    assigned_at: string;
  }>;
  portal_permissions: CasePortalPermissions;
};

export type CasePortalPermissions = {
  show_case_status_progress: boolean;
  show_milestone_details: boolean;
  show_document_requirements: boolean;
  portal_access: 'full_access' | 'limited_access' | 'read_only' | 'disabled';
  document_upload: 'enabled' | 'disabled';
  reminders: 'enabled' | 'disabled';
};

export type CaseCustomDocumentSuiteCreateInput = {
  name: string;
  description?: string | null;
};

export type CaseDocumentStatus =
  | 'requested'
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'not_requested';

export type CaseDetailsUpdateInput = {
  case_type: string;
  priority: string;
  status: string;
  target_filing_date: string | null;
  description: string | null;
  internal_notes: string | null;
};

export type CaseDetailsUpdateResponse = {
  case_number: string;
  case_type: string;
  priority: string;
  status: string;
  target_filing_date: string | null;
  description: string | null;
  internal_notes: string | null;
  updated_at: string;
};

export type CaseMilestoneCreateInput = {
  name: string;
  description?: string | null;
  due_date?: string | null;
  status?: string;
  client_visible?: boolean;
};

export type CaseMilestoneUpdateInput = {
  name?: string;
  description?: string | null;
  due_date?: string | null;
  status?: string;
  client_visible?: boolean;
};

export type CaseReminderCreateInput = {
  title: string;
  body: string;
  send_email_notification?: boolean;
  visible_to_client?: boolean;
};

export type CaseCustomDocumentCreateInput = {
  name: string;
  suite_id?: string | null;
  required: boolean;
  due_date?: string | null;
  instructions?: string | null;
};

export type CaseDocumentRenameInput = {
  name: string;
};

export type CaseDocumentRenameResponse = {
  document_id: string;
  name: string;
};

export type CaseDocumentUploadInitiateInput = {
  file_name: string;
  file_type: string;
  file_size_bytes: number;
};

export type CaseDocumentUploadInitiateResponse = {
  document_id: string;
  upload_url: string;
  upload_headers: Record<string, string>;
  storage_key: string;
  expires_in_seconds: number;
  max_upload_bytes: number;
};

export type CaseDocumentUploadCompleteInput = {
  storage_key: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  file_hash?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  client_note?: string | null;
};

export type CaseDocumentDownloadResponse = {
  document_id: string;
  case_document_id: string;
  file_name: string;
  download_url: string;
  expires_in_seconds: number;
};

export type CaseDocumentViewResponse = {
  document_id: string;
  case_document_id: string;
  file_name: string;
  view_url: string;
  expires_in_seconds: number;
};

export type AuthLoginInput = {
  organization_slug: string;
  email: string;
  password: string;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
};

export type CurrentUser = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
  active_role: string;
  onboarding_required: boolean;
  last_login_at: string | null;
};

export type SwitchActiveRoleResponse = {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  active_role: string;
  roles: string[];
};

export type CurrentUserSettings = {
  id: string;
  organization_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  mfa_enabled: boolean;
  timezone: string;
  locale: string;
  status: string;
};

export type UpdateCurrentUserSettingsInput = {
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  mfa_enabled: boolean;
  timezone: string;
  locale: string;
};

const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const authTokenStorageKey = 'visatrack.access_token';

let inMemoryAccessToken: string | null = null;

type RequestOptions = {
  includeAuth?: boolean;
};

type BlobResponse = {
  blob: Blob;
  filename: string | null;
};

function readStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return inMemoryAccessToken;
  }

  if (inMemoryAccessToken) {
    return inMemoryAccessToken;
  }

  const fromStorage = window.localStorage.getItem(authTokenStorageKey);
  if (fromStorage) {
    inMemoryAccessToken = fromStorage;
  }
  return fromStorage;
}

export function getAccessToken(): string | null {
  return readStoredAccessToken();
}

export function setAccessToken(token: string): void {
  inMemoryAccessToken = token;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(authTokenStorageKey, token);
  }
}

export function clearAccessToken(): void {
  inMemoryAccessToken = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(authTokenStorageKey);
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };
    return payload.detail ? ` - ${payload.detail}` : '';
  } catch {
    return '';
  }
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = { includeAuth: true }
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (options.includeAuth !== false) {
    const token = readStoredAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new Error(`Request failed: ${response.status}${detail}`);
  }

  return (await response.json()) as T;
}

async function requestVoid(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = { includeAuth: true }
): Promise<void> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (options.includeAuth !== false) {
    const token = readStoredAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new Error(`Request failed: ${response.status}${detail}`);
  }
}

async function requestBlob(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = { includeAuth: true }
): Promise<BlobResponse> {
  const headers = new Headers(init.headers);

  if (options.includeAuth !== false) {
    const token = readStoredAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await parseErrorDetail(response);
    throw new Error(`Request failed: ${response.status}${detail}`);
  }

  const disposition = response.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="([^"]+)"/i);

  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? null,
  };
}

export async function login(input: AuthLoginInput): Promise<AuthTokenResponse> {
  const token = await requestJson<AuthTokenResponse>(
    '/api/v1/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    { includeAuth: false }
  );
  setAccessToken(token.access_token);
  return token;
}

export async function logout(): Promise<void> {
  clearAccessToken();
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return requestJson<CurrentUser>('/api/v1/auth/me');
}

export async function switchActiveRole(role: string): Promise<SwitchActiveRoleResponse> {
  const response = await requestJson<SwitchActiveRoleResponse>('/api/v1/auth/switch-role', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
  setAccessToken(response.access_token);
  return response;
}

export async function getCurrentUserSettings(): Promise<CurrentUserSettings> {
  return requestJson<CurrentUserSettings>('/api/v1/auth/me/settings');
}

export async function updateCurrentUserSettings(
  input: UpdateCurrentUserSettingsInput
): Promise<CurrentUserSettings> {
  return requestJson<CurrentUserSettings>('/api/v1/auth/me/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return requestJson<DashboardOverview>('/api/v1/dashboard/overview');
}

export async function getCases(limit = 10): Promise<CaseListItem[]> {
  return requestJson<CaseListItem[]>(`/api/v1/cases?limit=${limit}`);
}

export async function createCase(input: CreateCaseInput): Promise<CaseListItem> {
  return requestJson<CaseListItem>('/api/v1/cases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getOrganizations(limit = 10): Promise<OrganizationListItem[]> {
  return requestJson<OrganizationListItem[]>(`/api/v1/organizations?limit=${limit}`);
}

export async function getUsers(limit = 10): Promise<UserListItem[]> {
  return requestJson<UserListItem[]>(`/api/v1/users?limit=${limit}`);
}

export async function getLawyerCases(limit = 100): Promise<CaseListItem[]> {
  return requestJson<CaseListItem[]>(`/api/v1/lawyer/cases?limit=${limit}`);
}

export async function getLawyerClients(limit = 200, search?: string): Promise<UserListItem[]> {
  const query = search?.trim()
    ? `?limit=${limit}&search=${encodeURIComponent(search.trim())}`
    : `?limit=${limit}`;
  return requestJson<UserListItem[]>(`/api/v1/lawyer/clients${query}`);
}

export async function createLawyerCase(input: LawyerCaseCreateInput): Promise<CaseListItem> {
  return requestJson<CaseListItem>('/api/v1/lawyer/cases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createLawyerClient(
  input: LawyerClientCreateInput
): Promise<LawyerClientCreateResponse> {
  return requestJson<LawyerClientCreateResponse>('/api/v1/lawyer/clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function inviteClientToCase(
  caseNumber: string,
  input: InviteClientInput
): Promise<InviteClientResponse> {
  return requestJson<InviteClientResponse>(
    `/api/v1/lawyer/cases/${encodeURIComponent(caseNumber)}/clients/invite`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function getClientCases(): Promise<ClientCaseListItem[]> {
  return requestJson<ClientCaseListItem[]>('/api/v1/client/cases');
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return requestJson<AdminOverview>('/api/v1/admin/overview');
}

export async function getAdminOperations(organizationId?: string): Promise<AdminOperations> {
  const query = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : '';
  return requestJson<AdminOperations>(`/api/v1/admin/operations${query}`);
}

export async function getAdminOrganizations(limit = 50): Promise<OrganizationListItem[]> {
  return requestJson<OrganizationListItem[]>(`/api/v1/admin/organizations?limit=${limit}`);
}

export async function getAdminUsers(limit = 100): Promise<UserListItem[]> {
  return requestJson<UserListItem[]>(`/api/v1/admin/users?limit=${limit}`);
}

export async function getAdminRoles(): Promise<AdminRoleItem[]> {
  return requestJson<AdminRoleItem[]>('/api/v1/admin/roles');
}

export async function createAdminOrganization(
  input: AdminCreateOrganizationInput
): Promise<OrganizationListItem> {
  return requestJson<OrganizationListItem>('/api/v1/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminOrganization(organizationId: string): Promise<void> {
  return requestVoid(`/api/v1/admin/organizations/${encodeURIComponent(organizationId)}`, {
    method: 'DELETE',
  });
}

export async function createAdminUser(input: AdminCreateUserInput): Promise<AdminCreateUserResult> {
  return requestJson<AdminCreateUserResult>('/api/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function verifyInvitation(token: string): Promise<VerifyInvitationResult> {
  return requestJson<VerifyInvitationResult>(
    `/api/v1/auth/verify-invitation?token=${encodeURIComponent(token)}`
  );
}

export async function acceptInvitation(token: string, password: string): Promise<AcceptInvitationResult> {
  return requestJson<AcceptInvitationResult>('/api/v1/auth/accept-invitation', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function deleteAdminUser(userId: string): Promise<void> {
  return requestVoid(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
}

export async function assignAdminRole(userId: string, roleSlug: string): Promise<void> {
  return requestVoid(`/api/v1/admin/users/${encodeURIComponent(userId)}/roles`, {
    method: 'POST',
    body: JSON.stringify({ role_slug: roleSlug }),
  });
}

export async function removeAdminRole(userId: string, roleSlug: string): Promise<void> {
  return requestVoid(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleSlug)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function assignAdminCaseLawyer(
  caseNumber: string,
  input: AdminCaseAssignmentInput
): Promise<AdminCaseAssignmentResult> {
  return requestJson<AdminCaseAssignmentResult>(`/api/v1/admin/cases/${encodeURIComponent(caseNumber)}/assign`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function sendInvitationEmail(
  toEmail: string,
  recipientName: string,
  invitationUrl: string,
  organizationName?: string,
): Promise<void> {
  return requestVoid('/api/v1/admin/send-invitation-email', {
    method: 'POST',
    body: JSON.stringify({
      to_email: toEmail,
      recipient_name: recipientName,
      invitation_url: invitationUrl,
      organization_name: organizationName,
    }),
  });
}

export async function revokeAdminInvitation(invitationId: string): Promise<void> {
  return requestVoid(`/api/v1/admin/invitations/${encodeURIComponent(invitationId)}/revoke`, {
    method: 'POST',
  });
}

export async function getCaseSummaryByNumber(caseNumber: string): Promise<CaseSummary> {
  return requestJson<CaseSummary>(`/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}`);
}

export async function getCaseWorkspaceByNumber(caseNumber: string): Promise<CaseWorkspace> {
  return requestJson<CaseWorkspace>(`/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/workspace`);
}

export async function updateCaseDetails(
  caseNumber: string,
  payload: CaseDetailsUpdateInput
): Promise<CaseDetailsUpdateResponse> {
  return requestJson<CaseDetailsUpdateResponse>(`/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createCaseMilestone(
  caseNumber: string,
  payload: CaseMilestoneCreateInput
): Promise<CaseWorkspace['milestones'][number]> {
  return requestJson<CaseWorkspace['milestones'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/milestones`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function updateCaseMilestone(
  caseNumber: string,
  milestoneId: string,
  payload: CaseMilestoneUpdateInput
): Promise<CaseWorkspace['milestones'][number]> {
  return requestJson<CaseWorkspace['milestones'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/milestones/${encodeURIComponent(milestoneId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCaseMilestone(caseNumber: string, milestoneId: string): Promise<void> {
  return requestVoid(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/milestones/${encodeURIComponent(milestoneId)}`,
    {
      method: 'DELETE',
    }
  );
}

export async function createCaseReminder(
  caseNumber: string,
  payload: CaseReminderCreateInput
): Promise<CaseWorkspace['reminders'][number]> {
  return requestJson<CaseWorkspace['reminders'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/reminders`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function markCaseReminderRead(
  caseNumber: string,
  reminderId: string
): Promise<CaseWorkspace['reminders'][number]> {
  return requestJson<CaseWorkspace['reminders'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/reminders/${encodeURIComponent(reminderId)}/read`,
    { method: 'POST' }
  );
}

export async function acknowledgeCaseReminder(
  caseNumber: string,
  reminderId: string
): Promise<CaseWorkspace['reminders'][number]> {
  return requestJson<CaseWorkspace['reminders'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/reminders/${encodeURIComponent(reminderId)}/acknowledge`,
    { method: 'POST' }
  );
}

export async function createCaseCustomDocument(
  caseNumber: string,
  payload: CaseCustomDocumentCreateInput
): Promise<CaseWorkspace['documents'][number]> {
  return requestJson<CaseWorkspace['documents'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/custom`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function renameCaseDocument(
  caseNumber: string,
  documentId: string,
  payload: CaseDocumentRenameInput
): Promise<CaseDocumentRenameResponse> {
  return requestJson<CaseDocumentRenameResponse>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteCaseDocument(caseNumber: string, documentId: string): Promise<void> {
  return requestVoid(`/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });
}

export async function updateCasePortalPermissions(
  caseNumber: string,
  permissions: CasePortalPermissions
): Promise<CasePortalPermissions> {
  return requestJson<CasePortalPermissions>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/permissions`,
    {
      method: 'PUT',
      body: JSON.stringify(permissions),
    }
  );
}

export async function createCaseCustomDocumentSuite(
  caseNumber: string,
  input: CaseCustomDocumentSuiteCreateInput
): Promise<CaseWorkspace['document_suites'][number]> {
  return requestJson<CaseWorkspace['document_suites'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/custom-document-suites`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    }
  );
}

export async function updateCaseDocumentStatus(
  caseNumber: string,
  documentId: string,
  status: CaseDocumentStatus,
  rejectionNote?: string | null
): Promise<{ document_id: string; status: CaseDocumentStatus; rejection_note?: string | null }> {
  return requestJson<{ document_id: string; status: CaseDocumentStatus; rejection_note?: string | null }>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, rejection_note: rejectionNote ?? null }),
    }
  );
}

export async function initiateCaseDocumentUpload(
  caseNumber: string,
  documentId: string,
  payload: CaseDocumentUploadInitiateInput
): Promise<CaseDocumentUploadInitiateResponse> {
  return requestJson<CaseDocumentUploadInitiateResponse>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}/upload-initiate`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function completeCaseDocumentUpload(
  caseNumber: string,
  documentId: string,
  payload: CaseDocumentUploadCompleteInput
): Promise<CaseWorkspace['documents'][number]> {
  return requestJson<CaseWorkspace['documents'][number]>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}/upload-complete`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteClientUploadedDocument(
  caseNumber: string,
  documentId: string
): Promise<void> {
  return requestVoid(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}/uploaded-file`,
    {
      method: 'DELETE',
    }
  );
}

export async function getCaseDocumentViewUrl(
  caseNumber: string,
  documentId: string
): Promise<CaseDocumentViewResponse> {
  return requestJson<CaseDocumentViewResponse>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}/view-url`
  );
}

export async function getCaseDocumentDownloadUrl(
  caseNumber: string,
  documentId: string
): Promise<CaseDocumentDownloadResponse> {
  return requestJson<CaseDocumentDownloadResponse>(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/${encodeURIComponent(documentId)}/download-url`
  );
}

export async function downloadCaseDocumentsArchive(
  caseNumber: string
): Promise<BlobResponse> {
  return requestBlob(
    `/api/v1/cases/by-number/${encodeURIComponent(caseNumber)}/documents/download-all`
  );
}
