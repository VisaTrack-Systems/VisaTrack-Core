from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from app.schemas.admin import AdminCreateOrganizationRequest
from app.schemas.auth import LoginRequest
from app.schemas.case import CaseDocumentUploadInitiateRequest
from app.schemas.client import ClientCaseListItem
from app.schemas.dashboard import DashboardStats
from app.schemas.lawyer import LawyerClientCreateRequest
from app.schemas.organization import OrganizationRead
from app.schemas.user import UserRead


def test_schema_objects_validate_expected_fields():
    now = datetime.now(timezone.utc)
    assert AdminCreateOrganizationRequest(name='Acme', contact_email='a@b.com', slug='acme').subscription_tier == 'basic'
    assert LoginRequest(organization_slug='acme', email='user@example.com', password='secret').organization_slug == 'acme'
    assert CaseDocumentUploadInitiateRequest(file_name='doc.pdf', file_type='application/pdf', file_size_bytes=10).file_type == 'application/pdf'
    assert DashboardStats(organizations=1, users=2, active_cases=3, completed_cases=4).users == 2
    assert LawyerClientCreateRequest(email='c@example.com', first_name='C', last_name='L').send_invite is True

    org = OrganizationRead(id=uuid4(), name='Acme', slug='acme', contact_email='a@b.com', subscription_status='active', created_at=now)
    user = UserRead(id=uuid4(), organization_id=None, email='user@example.com', first_name='Test', last_name='User', status='active', created_at=now)
    client_case = ClientCaseListItem(id=uuid4(), case_number='C-1', case_type='Express Entry', status='intake', priority='medium', primary_lawyer_name=None, target_filing_date=None, created_at=now)

    assert org.slug == 'acme'
    assert user.email == 'user@example.com'
    assert client_case.case_number == 'C-1'
