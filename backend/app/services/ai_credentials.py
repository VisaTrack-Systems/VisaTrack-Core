"""Encryption helpers for write-only lawyer-managed provider credentials."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    source = settings.ai_provider_encryption_key or settings.auth_secret_key
    key = base64.urlsafe_b64encode(hashlib.sha256(source.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_provider_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode("utf-8")).decode("ascii")


def decrypt_provider_key(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise ValueError("AI provider credential cannot be decrypted") from exc


def key_hint(api_key: str) -> str:
    normalized = api_key.strip()
    return f"…{normalized[-4:]}" if len(normalized) >= 4 else "configured"
