"""File Storage Service: Handles document storage, retrieval, and file management operations."""
from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Optional
from urllib.parse import quote

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
    fields: dict[str, str]
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


def create_presigned_upload(
    *,
    object_key: str,
    content_type: str,
    max_bytes: int,
) -> PresignedUpload:
    client = _s3_client()
    fields: dict[str, str] = {
        "key": object_key,
        "Content-Type": content_type,
    }
    conditions: list[Any] = [
        {"key": object_key},
        {"Content-Type": content_type},
        ["content-length-range", 1, max_bytes],
    ]
    if settings.aws_kms_key_id:
        fields["x-amz-server-side-encryption"] = "aws:kms"
        fields["x-amz-server-side-encryption-aws-kms-key-id"] = settings.aws_kms_key_id
        conditions.extend(
            [
                {"x-amz-server-side-encryption": "aws:kms"},
                {
                    "x-amz-server-side-encryption-aws-kms-key-id": settings.aws_kms_key_id
                },
            ]
        )

    try:
        presigned = client.generate_presigned_post(
            Bucket=settings.s3_bucket_name,
            Key=object_key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=settings.s3_presign_expires_seconds,
        )
    except (NoCredentialsError, PartialCredentialsError) as exc:
        raise StorageConfigurationError(
            "AWS credentials are not configured for document uploads"
        ) from exc
    except (BotoCoreError, ClientError) as exc:
        raise StorageOperationError("Failed to create upload URL") from exc

    return PresignedUpload(
        url=presigned["url"],
        fields=presigned["fields"],
        expires_in_seconds=settings.s3_presign_expires_seconds,
    )


def _content_disposition(disposition: str, download_name: str) -> str:
    normalized = download_name.replace("\\", "/").rsplit("/", 1)[-1]
    normalized = re.sub(r"[\x00-\x1f\x7f\";]+", "_", normalized).strip()
    ascii_name = re.sub(r"[^A-Za-z0-9._ -]+", "_", normalized)[:255] or "document"
    encoded_name = quote(normalized[:255] or "document", safe="")
    return (
        f'{disposition}; filename="{ascii_name}"; '
        f"filename*=UTF-8''{encoded_name}"
    )


def create_presigned_download(*, object_key: str, download_name: Optional[str] = None) -> str:
    """Create a presigned URL that opens the object inline in the browser (for viewing)."""
    client = _s3_client()
    params: dict[str, str] = {
        "Bucket": settings.s3_bucket_name,
        "Key": object_key,
    }
    if download_name:
        params["ResponseContentDisposition"] = _content_disposition(
            "inline",
            download_name,
        )

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
    params["ResponseContentDisposition"] = _content_disposition(
        "attachment",
        disposition_name,
    )

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


def delete_object(*, object_key: str) -> None:
    client = _s3_client()
    try:
        client.delete_object(Bucket=settings.s3_bucket_name, Key=object_key)
    except (BotoCoreError, ClientError) as exc:
        raise StorageOperationError("Failed to delete invalid uploaded file") from exc


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
