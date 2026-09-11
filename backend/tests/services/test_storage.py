from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from botocore.exceptions import NoCredentialsError

from app.services import storage


class DummyBody:
    def __init__(self, payload: bytes):
        self.payload = payload

    def read(self) -> bytes:
        return self.payload


def test_create_presigned_upload_includes_kms_headers(monkeypatch):
    client = MagicMock()
    client.generate_presigned_post.return_value = {
        'url': 'https://example.com/upload',
        'fields': {
            'Content-Type': 'application/pdf',
            'x-amz-server-side-encryption': 'aws:kms',
        },
    }
    monkeypatch.setattr(storage, '_s3_client', lambda: client)
    monkeypatch.setattr(storage.settings, 'aws_kms_key_id', 'kms-key')
    monkeypatch.setattr(storage.settings, 's3_presign_expires_seconds', 300)
    monkeypatch.setattr(storage.settings, 's3_bucket_name', 'bucket-name')

    result = storage.create_presigned_upload(
        object_key='docs/test.pdf',
        content_type='application/pdf',
        max_bytes=1024,
    )

    assert result.url == 'https://example.com/upload'
    assert result.fields['x-amz-server-side-encryption'] == 'aws:kms'
    assert result.expires_in_seconds == 300
    _, call_kwargs = client.generate_presigned_post.call_args
    assert ['content-length-range', 1, 1024] in call_kwargs['Conditions']


def test_create_presigned_upload_surfaces_missing_credentials(monkeypatch):
    client = MagicMock()
    client.generate_presigned_post.side_effect = NoCredentialsError()
    monkeypatch.setattr(storage, '_s3_client', lambda: client)
    monkeypatch.setattr(storage.settings, 'aws_kms_key_id', '')

    with pytest.raises(storage.StorageConfigurationError):
        storage.create_presigned_upload(
            object_key='docs/test.pdf',
            content_type='application/pdf',
            max_bytes=1024,
        )


def test_download_and_object_fetch_helpers(monkeypatch):
    client = MagicMock()
    client.generate_presigned_url.return_value = 'https://example.com/download'
    client.head_object.return_value = {'ContentLength': 42}
    client.get_object.return_value = {'Body': DummyBody(b'document-bytes')}
    monkeypatch.setattr(storage, '_s3_client', lambda: client)
    monkeypatch.setattr(storage.settings, 's3_bucket_name', 'bucket-name')

    assert storage.create_presigned_download(object_key='docs/test.pdf') == 'https://example.com/download'
    assert storage.head_object(object_key='docs/test.pdf')['ContentLength'] == 42
    assert storage.get_object_bytes(object_key='docs/test.pdf') == b'document-bytes'


def test_create_presigned_force_download_sets_attachment_disposition(monkeypatch):
    client = MagicMock()
    client.generate_presigned_url.return_value = 'https://example.com/force-download'
    monkeypatch.setattr(storage, '_s3_client', lambda: client)
    monkeypatch.setattr(storage.settings, 's3_bucket_name', 'bucket-name')
    monkeypatch.setattr(storage.settings, 's3_presign_expires_seconds', 300)

    result = storage.create_presigned_force_download(object_key='docs/test.pdf', download_name='report.pdf')

    assert result == 'https://example.com/force-download'
    _, call_kwargs = client.generate_presigned_url.call_args
    assert call_kwargs['Params']['ResponseContentDisposition'] == (
        'attachment; filename="report.pdf"; filename*=UTF-8\'\'report.pdf'
    )


def test_download_name_strips_header_control_characters(monkeypatch):
    client = MagicMock()
    client.generate_presigned_url.return_value = 'https://example.com/download'
    monkeypatch.setattr(storage, '_s3_client', lambda: client)
    monkeypatch.setattr(storage.settings, 's3_bucket_name', 'bucket-name')

    storage.create_presigned_force_download(
        object_key='docs/test.pdf',
        download_name='bad"\r\nname.pdf',
    )

    disposition = client.generate_presigned_url.call_args.kwargs['Params'][
        'ResponseContentDisposition'
    ]
    assert '\r' not in disposition
    assert '\n' not in disposition
    assert disposition.count('"') == 2
