"""Encryption helpers for write-only lawyer-managed provider credentials."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.core.config import settings


def _fernet_for(source: str) -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(source.encode("utf-8")).digest())
    return Fernet(key)


def _primary_fernet() -> Fernet:
    source = settings.ai_provider_encryption_key or settings.auth_secret_key
    return _fernet_for(source)


def _decrypting_fernet() -> MultiFernet:
    sources = [
        settings.ai_provider_encryption_key or settings.auth_secret_key,
        *settings.ai_provider_encryption_key_previous,
    ]
    return MultiFernet([_fernet_for(source) for source in sources])


def encrypt_provider_key(api_key: str) -> str:
    return _primary_fernet().encrypt(api_key.encode("utf-8")).decode("ascii")


def decrypt_provider_key(ciphertext: str) -> str:
    try:
        return _decrypting_fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise ValueError("AI provider credential cannot be decrypted") from exc


def key_hint(api_key: str) -> str:
    normalized = api_key.strip()
    return f"…{normalized[-4:]}" if len(normalized) >= 4 else "configured"
