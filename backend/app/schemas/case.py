from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CaseListItem(BaseModel):
    id: UUID
    organization_id: UUID
    case_number: str
    case_type: str
    status: str
    priority: str
    client_name: str
    primary_lawyer_name: Optional[str]
    target_filing_date: Optional[date]
    created_at: datetime


class CaseCreateRequest(BaseModel):
    organization_id: UUID
    client_id: UUID
    primary_lawyer_id: Optional[UUID] = None
    case_number: Optional[str] = None
    case_type: str
    status: str = "intake"
    priority: str = "medium"
    target_filing_date: Optional[date] = None
    description: Optional[str] = None
    internal_notes: Optional[str] = None


class MilestoneSummary(BaseModel):
    id: UUID
    name: str
    status: str
    due_date: Optional[date]
    completion_percentage: int


class CaseSummary(BaseModel):
    id: UUID
    case_number: str
    case_type: str
    status: str
    priority: str
    client_name: str
    primary_lawyer_name: Optional[str]
    target_filing_date: Optional[date]
    estimated_completion_from: Optional[date]
    estimated_completion_to: Optional[date]
    description: Optional[str]
    internal_notes: Optional[str]
    milestones: list[MilestoneSummary]


class CaseWorkspaceInfo(BaseModel):
    id: UUID
    case_number: str
    case_type: str
    status: str
    priority: str
    client_id: UUID
    client_name: str
    primary_lawyer_name: Optional[str]
    start_date: Optional[date]
    target_filing_date: Optional[date]
    estimated_completion_from: Optional[date]
    estimated_completion_to: Optional[date]
    completion_confidence: Optional[int]
    progress_percent: int
    description: Optional[str]
    internal_notes: Optional[str]


class CaseWorkspaceDocument(BaseModel):
    id: str
    name: str
    required: bool
    status: str
    due_date: Optional[date]
    uploaded_at: Optional[datetime]
    instructions: Optional[str]
    client_note: Optional[str] = None
    file_name: Optional[str] = None
    latest_case_document_id: Optional[str] = None
    can_download: bool = False


class CaseWorkspaceDocumentSuite(BaseModel):
    id: str
    name: str
    reason: str
    recommended: bool
    documents: list[CaseWorkspaceDocument]


class CaseWorkspaceMilestone(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    status: str
    due_date: Optional[date]
    completion_percentage: int
    client_visible: bool
    dependencies: list[str]
    completed_at: Optional[datetime]


class CaseWorkspacePaymentItem(BaseModel):
    id: str
    description: str
    amount: float
    amount_paid: float
    amount_due: float
    status: str
    due_date: Optional[date]
    paid_date: Optional[date]
    invoice_number: Optional[str]


class CaseWorkspaceMessage(BaseModel):
    id: UUID
    sender_name: str
    subject: str
    body: str
    sent_at: Optional[datetime]
    read_at: Optional[datetime]
    from_client: bool


class CaseWorkspaceAppointment(BaseModel):
    title: str
    date: date
    time: str
    appointment_type: str


class CaseWorkspaceBillingSummary(BaseModel):
    total_fees: float
    paid: float
    remaining: float
    next_payment: Optional[date]
    payment_method: Optional[str]


class CaseWorkspaceAssignment(BaseModel):
    id: UUID
    member_name: str
    role: str
    assigned_at: datetime


class CasePortalPermissions(BaseModel):
    show_case_status_progress: bool
    show_milestone_details: bool
    show_document_requirements: bool
    portal_access: str
    document_upload: str
    messaging: str


class CasePortalPermissionsUpdateRequest(BaseModel):
    show_case_status_progress: bool
    show_milestone_details: bool
    show_document_requirements: bool
    portal_access: str
    document_upload: str
    messaging: str


class CaseCustomDocumentSuiteCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CaseDocumentStatusUpdateRequest(BaseModel):
    status: str


class CaseDocumentStatusUpdateResponse(BaseModel):
    document_id: str
    status: str


class CaseDocumentUploadInitiateRequest(BaseModel):
    file_name: str
    file_type: str
    file_size_bytes: int


class CaseDocumentUploadInitiateResponse(BaseModel):
    document_id: str
    upload_url: str
    upload_headers: dict[str, str]
    storage_key: str
    expires_in_seconds: int
    max_upload_bytes: int


class CaseDocumentUploadCompleteRequest(BaseModel):
    storage_key: str
    file_name: str
    file_type: str
    file_size_bytes: int
    file_hash: Optional[str] = None
    issue_date: Optional[date] = None
    expiry_date: Optional[date] = None
    client_note: Optional[str] = None


class CaseDocumentDownloadResponse(BaseModel):
    document_id: str
    case_document_id: str
    file_name: str
    download_url: str
    expires_in_seconds: int


class CaseCustomDocumentCreateRequest(BaseModel):
    name: str
    suite_id: Optional[str] = None
    required: bool = True
    due_date: Optional[date] = None
    instructions: Optional[str] = None


class CaseDocumentRenameRequest(BaseModel):
    name: str


class CaseDocumentRenameResponse(BaseModel):
    document_id: str
    name: str


class CaseDetailsUpdateRequest(BaseModel):
    case_type: str
    priority: str
    status: str
    target_filing_date: Optional[date] = None
    description: Optional[str] = None
    internal_notes: Optional[str] = None


class CaseDetailsUpdateResponse(BaseModel):
    case_number: str
    case_type: str
    priority: str
    status: str
    target_filing_date: Optional[date]
    description: Optional[str]
    internal_notes: Optional[str]
    updated_at: datetime


class CaseMilestoneCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "not_started"
    client_visible: bool = True


class CaseMilestoneUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    client_visible: Optional[bool] = None


class CaseMessageCreateRequest(BaseModel):
    subject: str
    body: str
    send_email: bool = False
    visible_to_client: bool = True


class CaseWorkspace(BaseModel):
    case: CaseWorkspaceInfo
    document_suites: list[CaseWorkspaceDocumentSuite]
    documents: list[CaseWorkspaceDocument]
    milestones: list[CaseWorkspaceMilestone]
    payment_items: list[CaseWorkspacePaymentItem]
    messages: list[CaseWorkspaceMessage]
    appointments: list[CaseWorkspaceAppointment]
    billing_summary: CaseWorkspaceBillingSummary
    assignments: list[CaseWorkspaceAssignment]
    portal_permissions: CasePortalPermissions
