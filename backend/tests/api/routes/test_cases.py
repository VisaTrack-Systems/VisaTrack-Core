from __future__ import annotations

from datetime import date, datetime, timezone
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi import HTTPException

from app.api.routes import cases
from app.schemas.case import (
    CaseCreateRequest,
    CaseCustomDocumentCreateRequest,
    CaseCustomDocumentSuiteCreateRequest,
    CaseDetailsUpdateRequest,
    CaseDocumentRenameRequest,
    CaseDocumentStatusUpdateRequest,
    CaseDocumentUploadCompleteRequest,
    CaseDocumentUploadInitiateRequest,
    CaseMessageCreateRequest,
    CaseMilestoneCreateRequest,
    CaseMilestoneUpdateRequest,
    CasePortalPermissionsUpdateRequest,
)
from tests.support import FakeResult, row


def test_case_helper_normalizers_and_sanitizers():
    normalized = cases._normalized_portal_permissions({'portal_access': 'READ_ONLY', 'document_upload': 'disabled'})
    custom_docs = cases._normalized_custom_documents([
        {'id': 'doc-1', 'name': 'Passport', 'required': True, 'status': 'under review'},
        {'id': '', 'name': 'Ignored'},
    ])

    assert normalized['portal_access'] == 'read_only'
    assert normalized['document_upload'] == 'disabled'
    assert custom_docs == [
        {
            'id': 'doc-1',
            'name': 'Passport',
            'suite_id': None,
            'required': True,
            'due_date': None,
            'instructions': None,
            'status': 'under_review',
        }
    ]
    assert cases._sanitize_file_name(' My File?.pdf ') == 'My_File_.pdf'


def test_archive_name_generation_handles_duplicates():
    seen = {}

    first = cases._archive_entry_name(base_name='Passport Scan', original_file_name='passport.pdf', seen_names=seen)
    second = cases._archive_entry_name(base_name='Passport Scan', original_file_name='passport.pdf', seen_names=seen)

    assert first == 'Passport_Scan.pdf'
    assert second == 'Passport_Scan (2).pdf'


def test_client_portal_capabilities_respect_permissions(make_auth_context):
    case = type('CaseStub', (), {'custom_fields': {'portal_permissions': {'portal_access': 'read_only', 'document_upload': 'enabled', 'show_document_requirements': True}}})()

    capabilities = cases._client_portal_capabilities(case)

    assert capabilities['can_view_documents'] is True
    assert capabilities['can_upload_documents'] is False


def test_create_case_returns_created_case(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    client_user = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        first_name='Client',
        last_name='One',
    )
    lawyer_user = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        first_name='Law',
        last_name='Yer',
    )
    db = MagicMock()
    db.scalar.side_effect = [auth.organization_id, client_user, lawyer_user, None]

    created_objects = []

    def capture_add(obj):
        created_objects.append(obj)

    def flush_side_effect():
        for obj in created_objects:
            if getattr(obj, 'id', None) is None:
                obj.id = uuid4()
            if getattr(obj, 'created_at', None) is None:
                obj.created_at = datetime.now(timezone.utc)

    db.add.side_effect = capture_add
    db.flush.side_effect = flush_side_effect
    db.refresh.side_effect = lambda obj: None
    monkeypatch.setattr(cases, '_generate_case_number', lambda db, organization_id: 'C-2026-010')

    result = cases.create_case(
        payload=CaseCreateRequest(
            organization_id=auth.organization_id,
            client_id=client_user.id,
            primary_lawyer_id=lawyer_user.id,
            case_type='Express Entry',
            status='intake',
            priority='medium',
            description='Case description',
        ),
        auth=auth,
        db=db,
    )

    assert result.case_number == 'C-2026-010'
    assert result.client_name == 'Client One'
    assert result.primary_lawyer_name == 'Law Yer'


def test_list_cases_returns_joined_rows(make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        case_number='C-2026-001',
        case_type='Express Entry',
        status='intake',
        priority='medium',
        target_filing_date=None,
        created_at=datetime.now(timezone.utc),
    )
    db = MagicMock()
    db.execute.return_value.all.return_value = [(case, 'Client', 'One', 'Law', 'Yer')]

    result = cases.list_cases(limit=25, offset=0, auth=auth, db=db)

    assert result[0].case_number == 'C-2026-001'
    assert result[0].primary_lawyer_name == 'Law Yer'


def test_get_case_by_number_returns_summary(make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(
        id=uuid4(),
        case_number='C-2026-001',
        case_type='Express Entry',
        status='intake',
        priority='medium',
        target_filing_date=None,
        estimated_completion_from=None,
        estimated_completion_to=None,
        description='Desc',
        internal_notes='Notes',
    )
    milestone = row(
        id=uuid4(),
        name='Collect passport',
        status='in_progress',
        due_date=None,
        completion_percentage=60,
    )
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(rows=[(case, 'Client', 'One', 'Law', 'Yer')]),
        FakeResult(rows=[milestone]),
    ]

    result = cases.get_case_by_number(case_number='C-2026-001', auth=auth, db=db)

    assert result.case_number == 'C-2026-001'
    assert result.milestones[0].name == 'Collect passport'


def test_update_case_details_by_number_updates_case(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        client_id=uuid4(),
        case_number='C-2026-001',
        case_type='Old Type',
        priority='low',
        status='intake',
        target_filing_date=None,
        description=None,
        internal_notes=None,
        updated_at=datetime.now(timezone.utc),
    )
    db = MagicMock()
    db.refresh.side_effect = lambda obj: None
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    result = cases.update_case_details_by_number(
        case_number='C-2026-001',
        payload=CaseDetailsUpdateRequest(
            case_type='Express Entry',
            priority='high',
            status='submitted',
            target_filing_date=date(2026, 2, 28),
            description='Updated',
            internal_notes='Internal',
        ),
        auth=auth,
        db=db,
    )

    assert result.status == 'submitted'
    assert case.case_type == 'Express Entry'
    db.commit.assert_called_once()


def test_create_case_milestone_returns_workspace_milestone(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, client_id=uuid4())
    inserted_row = {
        'id': uuid4(),
        'name': 'Gather docs',
        'description': 'Collect required files',
        'status': 'in_progress',
        'due_date': None,
        'completion_percentage': 60,
        'client_visible': True,
        'depends_on': [],
        'completed_at': None,
    }
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(scalar_value=1),
        FakeResult(rows=[inserted_row]),
    ]
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    result = cases.create_case_milestone(
        case_number='C-2026-001',
        payload=CaseMilestoneCreateRequest(name='Gather docs', description='Collect required files', status='in_progress'),
        auth=auth,
        db=db,
    )

    assert result.name == 'Gather docs'
    assert result.status == 'in_progress'


def test_update_case_milestone_returns_updated_row(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, client_id=uuid4())
    milestone_id = str(uuid4())
    existing_row = {
        'id': uuid4(),
        'name': 'Old',
        'description': None,
        'status': 'not_started',
        'due_date': None,
        'completion_percentage': 0,
        'client_visible': True,
        'depends_on': [],
        'completed_by': None,
        'completed_at': None,
    }
    updated_row = {
        'id': existing_row['id'],
        'name': 'New',
        'description': 'Updated',
        'status': 'completed',
        'due_date': None,
        'completion_percentage': 100,
        'client_visible': False,
        'depends_on': [],
        'completed_at': datetime.now(timezone.utc),
    }
    db = MagicMock()
    db.execute.side_effect = [FakeResult(rows=[existing_row]), FakeResult(rows=[updated_row])]
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    result = cases.update_case_milestone(
        case_number='C-2026-001',
        milestone_id=milestone_id,
        payload=CaseMilestoneUpdateRequest(name='New', description='Updated', status='completed', client_visible=False),
        auth=auth,
        db=db,
    )

    assert result.name == 'New'
    assert result.completion_percentage == 100


def test_delete_case_milestone_commits(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, client_id=uuid4())
    db = MagicMock()
    db.execute.return_value = FakeResult(
        rows=[{'id': uuid4(), 'name': 'Old milestone', 'status': 'blocked', 'due_date': None, 'client_visible': True}]
    )
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    cases.delete_case_milestone(
        case_number='C-2026-001',
        milestone_id=str(uuid4()),
        auth=auth,
        db=db,
    )

    db.commit.assert_called_once()


def test_create_case_message_returns_message(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, client_id=uuid4())
    inserted_row = {
        'id': uuid4(),
        'subject': 'Need passport',
        'body': 'Please upload it.',
        'sent_at': datetime.now(timezone.utc),
        'read_at': None,
    }
    db = MagicMock()
    db.execute.return_value = FakeResult(rows=[inserted_row])
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    result = cases.create_case_message(
        case_number='C-2026-001',
        payload=CaseMessageCreateRequest(subject='Need passport', body='Please upload it.', visible_to_client=True),
        auth=auth,
        db=db,
    )

    assert result.subject == 'Need passport'
    assert result.from_client is False


def test_get_case_workspace_by_number_returns_workspace(make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case_row = {
        'id': uuid4(),
        'organization_id': auth.organization_id,
        'client_id': uuid4(),
        'primary_lawyer_id': auth.user_id,
        'created_by': auth.user_id,
        'case_number': 'C-2026-001',
        'case_type': 'Express Entry',
        'status': 'intake',
        'priority': 'medium',
        'start_date': None,
        'target_filing_date': None,
        'estimated_completion_from': None,
        'estimated_completion_to': None,
        'completion_confidence': None,
        'description': 'Desc',
        'internal_notes': 'Notes',
        'custom_fields': {},
        'client_name': 'Client One',
        'primary_lawyer_name': 'Law Yer',
    }
    document_rows = [
        {
            'suite_id': uuid4(),
            'suite_name': 'Identity',
            'suite_description': 'Identity docs',
            'suite_is_system': True,
            'template_id': uuid4(),
            'template_name': 'Passport',
            'instructions': 'Upload a copy',
            'is_required': True,
            'latest_case_document_id': None,
            'doc_status': 'pending',
            'uploaded_at': None,
            'expiry_date': None,
            'file_name': None,
        }
    ]
    billing_row = {'total_fees': 0, 'total_paid': 0, 'total_remaining': 0, 'next_payment_due': None}
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(rows=[case_row]),
        FakeResult(rows=document_rows),
        FakeResult(rows=[]),
        FakeResult(rows=[]),
        FakeResult(rows=[]),
        FakeResult(rows=[]),
        FakeResult(rows=[billing_row]),
        FakeResult(rows=[]),
        FakeResult(rows=[]),
    ]

    result = cases.get_case_workspace_by_number(case_number='C-2026-001', auth=auth, db=db)

    assert result.case.case_number == 'C-2026-001'
    assert result.document_suites[0].documents[0].name == 'Passport'


def test_update_case_portal_permissions_persists_custom_fields(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, custom_fields={})
    db = MagicMock()
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)

    result = cases.update_case_portal_permissions(
        case_number='C-2026-001',
        payload=CasePortalPermissionsUpdateRequest(
            show_case_status_progress=False,
            show_milestone_details=True,
            show_document_requirements=True,
            portal_access='limited_access',
            document_upload='disabled',
            messaging='one_way',
        ),
        auth=auth,
        db=db,
    )

    assert result.portal_access == 'limited_access'
    assert case.custom_fields['portal_permissions']['document_upload'] == 'disabled'


def test_create_case_custom_document_suite_adds_suite(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, custom_fields={})
    db = MagicMock()
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)

    result = cases.create_case_custom_document_suite(
        case_number='C-2026-001',
        payload=CaseCustomDocumentSuiteCreateRequest(name='Additional Docs', description='Extra'),
        auth=auth,
        db=db,
    )

    assert result.name == 'Additional Docs'
    assert case.custom_fields['custom_document_suites'][0]['name'] == 'Additional Docs'


def test_create_case_custom_document_adds_document(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, client_id=uuid4(), custom_fields={})
    db = MagicMock()
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    result = cases.create_case_custom_document(
        case_number='C-2026-001',
        payload=CaseCustomDocumentCreateRequest(name='National ID', required=True, instructions='Both sides'),
        auth=auth,
        db=db,
    )

    assert result.name == 'National ID'
    assert case.custom_fields['custom_documents'][0]['name'] == 'National ID'


def test_rename_case_document_updates_name_override(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    document_id = str(uuid4())
    case = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        client_id=uuid4(),
        case_type='Express Entry',
        custom_fields={'custom_documents': [{'id': document_id, 'name': 'Old Name', 'required': True}]},
    )
    db = MagicMock()
    db.execute.side_effect = [FakeResult(rows=[]), FakeResult(rows=[])]
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    result = cases.rename_case_document(
        case_number='C-2026-001',
        document_id=document_id,
        payload=CaseDocumentRenameRequest(name='New Name'),
        auth=auth,
        db=db,
    )

    assert result.name == 'New Name'
    assert case.custom_fields['document_name_overrides'][document_id] == 'New Name'


def test_delete_case_document_hides_document(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    document_id = str(uuid4())
    case = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        client_id=uuid4(),
        case_type='Express Entry',
        custom_fields={'custom_documents': [{'id': document_id, 'name': 'Old Name', 'required': True}]},
    )
    db = MagicMock()
    db.execute.side_effect = [FakeResult(rows=[]), FakeResult(rows=[])]
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)

    cases.delete_case_document(
        case_number='C-2026-001',
        document_id=document_id,
        auth=auth,
        db=db,
    )

    assert document_id in case.custom_fields['hidden_document_ids']
    db.commit.assert_called_once()


def test_update_case_document_status_updates_custom_document(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    document_id = str(uuid4())
    case = row(
        id=uuid4(),
        organization_id=auth.organization_id,
        case_type='Express Entry',
        custom_fields={'custom_documents': [{'id': document_id, 'name': 'Passport', 'required': True, 'status': 'pending'}]},
    )
    db = MagicMock()
    db.execute.side_effect = [FakeResult(rows=[]), FakeResult(rows=[])]
    monkeypatch.setattr(cases, '_get_case_with_write_access', lambda **kwargs: case)

    result = cases.update_case_document_status(
        case_number='C-2026-001',
        document_id=document_id,
        payload=CaseDocumentStatusUpdateRequest(status='approved'),
        auth=auth,
        db=db,
    )

    assert result.status == 'approved'
    assert case.custom_fields['custom_documents'][0]['status'] == 'approved'


def test_initiate_case_document_upload_returns_presigned_upload(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['client'])
    case = row(id=uuid4(), organization_id=auth.organization_id, custom_fields={})
    slot = {
        'logical_document_id': str(uuid4()),
        'name': 'Passport',
        'required': True,
        'instructions': 'Upload passport',
    }
    db = MagicMock()
    monkeypatch.setattr(cases, '_get_case_with_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, '_resolve_document_slot', lambda **kwargs: slot)
    monkeypatch.setattr(cases, 'create_presigned_upload', lambda **kwargs: row(url='https://upload', headers={'Content-Type': 'application/pdf'}, expires_in_seconds=900))

    result = cases.initiate_case_document_upload(
        case_number='C-2026-001',
        document_id=slot['logical_document_id'],
        payload=CaseDocumentUploadInitiateRequest(file_name='passport.pdf', file_type='application/pdf', file_size_bytes=1024),
        auth=auth,
        db=db,
    )

    assert result.upload_url == 'https://upload'
    assert result.storage_key.startswith(f'org/{auth.organization_id}/case/{case.id}/documents/')


def test_complete_case_document_upload_records_upload(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['client'])
    document_id = str(uuid4())
    case = row(id=uuid4(), organization_id=auth.organization_id, client_id=auth.user_id, custom_fields={})
    slot = {
        'kind': 'template',
        'logical_document_id': document_id,
        'template_id': document_id,
        'name': 'Passport',
        'required': True,
        'instructions': 'Upload passport',
        'previous_case_document_id': None,
        'next_version': 1,
    }
    storage_key = f'org/{case.organization_id}/case/{case.id}/documents/{document_id}/uuid-passport.pdf'
    db = MagicMock()
    db.execute.return_value = FakeResult(rows=[{'id': uuid4(), 'uploaded_at': datetime.now(timezone.utc)}])
    monkeypatch.setattr(cases, '_get_case_with_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, '_resolve_document_slot', lambda **kwargs: slot)
    monkeypatch.setattr(cases, 'head_object', lambda **kwargs: {'ContentLength': 1024, 'ContentType': 'application/pdf'})
    monkeypatch.setattr(cases, 'log_activity', lambda *args, **kwargs: None)
    monkeypatch.setattr(cases, 'log_document_access', lambda *args, **kwargs: None)

    result = cases.complete_case_document_upload(
        case_number='C-2026-001',
        document_id=document_id,
        payload=CaseDocumentUploadCompleteRequest(
            storage_key=storage_key,
            file_name='passport.pdf',
            file_type='application/pdf',
            file_size_bytes=1024,
        ),
        request=row(client=row(host='127.0.0.1'), headers={'user-agent': 'pytest'}),
        auth=auth,
        db=db,
    )

    assert result.status == 'received'
    assert result.can_download is True


def test_get_case_document_download_url_returns_presigned_link(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), organization_id=auth.organization_id, custom_fields={})
    slot = {
        'logical_document_id': str(uuid4()),
        'name': 'Passport',
        'bound_case_document': {
            'id': uuid4(),
            'file_path': 'org/x/doc.pdf',
            'file_name': 'passport.pdf',
        },
    }
    db = MagicMock()
    monkeypatch.setattr(cases, '_get_case_with_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, '_resolve_document_slot', lambda **kwargs: slot)
    monkeypatch.setattr(cases, 'create_presigned_download', lambda **kwargs: 'https://download')
    monkeypatch.setattr(cases, 'log_document_access', lambda *args, **kwargs: None)

    result = cases.get_case_document_download_url(
        case_number='C-2026-001',
        document_id=slot['logical_document_id'],
        request=row(client=row(host='127.0.0.1'), headers={'user-agent': 'pytest'}),
        auth=auth,
        db=db,
    )

    assert result.download_url == 'https://download'
    assert result.file_name == 'passport.pdf'


def test_download_all_case_documents_returns_zip(monkeypatch, make_auth_context):
    auth = make_auth_context(roles=['lawyer'])
    case = row(id=uuid4(), case_number='C-2026-001', organization_id=auth.organization_id, custom_fields={})
    db = MagicMock()
    db.execute.side_effect = [
        FakeResult(rows=[{'id': uuid4(), 'name': 'Passport', 'file_name': 'passport.pdf', 'file_path': 'path/passport.pdf', 'uploaded_at': datetime.now(timezone.utc)}]),
        FakeResult(rows=[]),
    ]
    monkeypatch.setattr(cases, '_get_case_with_access', lambda **kwargs: case)
    monkeypatch.setattr(cases, 'get_object_bytes', lambda **kwargs: b'file-bytes')
    monkeypatch.setattr(cases, 'log_document_access', lambda *args, **kwargs: None)

    response = cases.download_all_case_documents(
        case_number='C-2026-001',
        request=row(client=row(host='127.0.0.1'), headers={'user-agent': 'pytest'}),
        auth=auth,
        db=db,
    )

    assert response.media_type == 'application/zip'
    assert response.headers['Content-Disposition'].endswith('"C-2026-001-documents.zip"')
