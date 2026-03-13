from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import boto3
from botocore.client import BaseClient, Config
from botocore.exceptions import BotoCoreError, ClientError, NoCredentialsError, PartialCredentialsError

from app.core.config import settings


class StorageConfigurationError(RuntimeError):
    pass


class StorageOperationError(RuntimeError):
    pass


@dataclass(frozen=True)
class PresignedUpload:
    url: str
    headers: dict[str, str]
    expires_in_seconds: int


@lru_cache(maxsize=1)
def _s3_client() -> BaseClient:
    if not settings.s3_bucket_name:
        raise StorageConfigurationError("S3_BUCKET_NAME is not configured")

    session = boto3.session.Session(region_name=settings.aws_region)
    return session.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        config=Config(signature_version="s3v4"),
    )


def create_presigned_upload(*, object_key: str, content_type: str) -> PresignedUpload:
    client = _s3_client()
    params: dict[str, str] = {
        "Bucket": settings.s3_bucket_name,
        "Key": object_key,
        "ContentType": content_type,
    }
    headers = {"Content-Type": content_type}
    if settings.aws_kms_key_id:
        params["ServerSideEncryption"] = "aws:kms"
        params["SSEKMSKeyId"] = settings.aws_kms_key_id
        headers["x-amz-server-side-encryption"] = "aws:kms"
        headers["x-amz-server-side-encryption-aws-kms-key-id"] = settings.aws_kms_key_id

    try:
        url = client.generate_presigned_url(
            ClientMethod="put_object",
            Params=params,
            ExpiresIn=settings.s3_presign_expires_seconds,
            HttpMethod="PUT",
        )
    except (NoCredentialsError, PartialCredentialsError) as exc:
        raise StorageConfigurationError(
            "AWS credentials are not configured for document uploads"
        ) from exc
    except (BotoCoreError, ClientError) as exc:
        raise StorageOperationError("Failed to create upload URL") from exc

    return PresignedUpload(
        url=url,
        headers=headers,
        expires_in_seconds=settings.s3_presign_expires_seconds,
    )


def create_presigned_download(*, object_key: str, download_name: Optional[str] = None) -> str:
    """Create a presigned URL that opens the object inline in the browser (for viewing)."""
    client = _s3_client()
    params: dict[str, str] = {
        "Bucket": settings.s3_bucket_name,
        "Key": object_key,
    }
    if download_name:
        params["ResponseContentDisposition"] = f'inline; filename="{download_name}"'

    try:
        return client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=settings.s3_presign_expires_seconds,
            HttpMethod="GET",
        )
    except (NoCredentialsError, PartialCredentialsError) as exc:
        raise StorageConfigurationError(
            "AWS credentials are not configured for document downloads"
        ) from exc
    except (BotoCoreError, ClientError) as exc:
        raise StorageOperationError("Failed to create download URL") from exc


def create_presigned_force_download(*, object_key: str, download_name: Optional[str] = None) -> str:
    """Create a presigned URL with Content-Disposition: attachment to force a file download."""
    client = _s3_client()
    params: dict[str, str] = {
        "Bucket": settings.s3_bucket_name,
        "Key": object_key,
    }
    disposition_name = download_name or "document"
    params["ResponseContentDisposition"] = f'attachment; filename="{disposition_name}"'

    try:
        return client.generate_presigned_url(
            ClientMethod="get_object",
            Params=params,
            ExpiresIn=settings.s3_presign_expires_seconds,
            HttpMethod="GET",
        )
    except (NoCredentialsError, PartialCredentialsError) as exc:
        raise StorageConfigurationError(
            "AWS credentials are not configured for document downloads"
        ) from exc
    except (BotoCoreError, ClientError) as exc:
        raise StorageOperationError("Failed to create download URL") from exc


def head_object(*, object_key: str) -> dict:
    client = _s3_client()
    try:
        return client.head_object(Bucket=settings.s3_bucket_name, Key=object_key)
    except client.exceptions.NoSuchKey as exc:
        raise StorageOperationError("Uploaded file not found in storage") from exc
    except (BotoCoreError, ClientError) as exc:
        raise StorageOperationError("Failed to validate uploaded file") from exc


def get_object_bytes(*, object_key: str) -> bytes:
    client = _s3_client()
    try:
        response = client.get_object(Bucket=settings.s3_bucket_name, Key=object_key)
        return response["Body"].read()
    except client.exceptions.NoSuchKey as exc:
        raise StorageOperationError("Requested file was not found in storage") from exc
    except (NoCredentialsError, PartialCredentialsError) as exc:
        raise StorageConfigurationError(
            "AWS credentials are not configured for document downloads"
        ) from exc
    except (BotoCoreError, ClientError) as exc:
        raise StorageOperationError("Failed to retrieve file from storage") from exc
