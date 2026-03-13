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
    client.generate_presigned_url.return_value = 'https://example.com/upload'
    monkeypatch.setattr(storage, '_s3_client', lambda: client)
    monkeypatch.setattr(storage.settings, 'aws_kms_key_id', 'kms-key')
    monkeypatch.setattr(storage.settings, 's3_presign_expires_seconds', 300)
    monkeypatch.setattr(storage.settings, 's3_bucket_name', 'bucket-name')

    result = storage.create_presigned_upload(object_key='docs/test.pdf', content_type='application/pdf')

    assert result.url == 'https://example.com/upload'
    assert result.headers['x-amz-server-side-encryption'] == 'aws:kms'
    assert result.expires_in_seconds == 300


def test_create_presigned_upload_surfaces_missing_credentials(monkeypatch):
    client = MagicMock()
    client.generate_presigned_url.side_effect = NoCredentialsError()
    monkeypatch.setattr(storage, '_s3_client', lambda: client)
    monkeypatch.setattr(storage.settings, 'aws_kms_key_id', '')

    with pytest.raises(storage.StorageConfigurationError):
        storage.create_presigned_upload(object_key='docs/test.pdf', content_type='application/pdf')


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
    assert call_kwargs['Params']['ResponseContentDisposition'] == 'attachment; filename="report.pdf"'
