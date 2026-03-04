from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    normalized = password.strip()
    if not normalized:
        raise ValueError("Password cannot be empty")

    salt = os.urandom(16)
    salt_b64 = base64.b64encode(salt).decode("utf-8")

    if hasattr(hashlib, "scrypt"):
        n = 16384
        r = 8
        p = 1
        derived = hashlib.scrypt(
            normalized.encode("utf-8"),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=32,
        )
        hash_b64 = base64.b64encode(derived).decode("utf-8")
        return f"scrypt${n}${r}${p}${salt_b64}${hash_b64}"

    # Fallback for environments where OpenSSL lacks scrypt support.
    iterations = 260000
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        normalized.encode("utf-8"),
        salt,
        iterations,
        dklen=32,
    )
    hash_b64 = base64.b64encode(derived).decode("utf-8")
    return f"pbkdf2_sha256${iterations}${salt_b64}${hash_b64}"


def verify_password(password: str, stored_hash: str) -> bool:
    candidate = password.strip()
    if not stored_hash:
        return False

    if stored_hash.startswith("scrypt$"):
        try:
            _, n_raw, r_raw, p_raw, salt_b64, hash_b64 = stored_hash.split("$", 5)
            n = int(n_raw)
            r = int(r_raw)
            p = int(p_raw)
            salt = base64.b64decode(salt_b64.encode("utf-8"))
            expected = base64.b64decode(hash_b64.encode("utf-8"))
            actual = hashlib.scrypt(
                candidate.encode("utf-8"),
                salt=salt,
                n=n,
                r=r,
                p=p,
                dklen=len(expected),
            )
            return hmac.compare_digest(actual, expected)
        except Exception:
            return False

    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations_raw, salt_b64, hash_b64 = stored_hash.split("$", 3)
            iterations = int(iterations_raw)
            salt = base64.b64decode(salt_b64.encode("utf-8"))
            expected = base64.b64decode(hash_b64.encode("utf-8"))
            actual = hashlib.pbkdf2_hmac(
                "sha256",
                candidate.encode("utf-8"),
                salt,
                iterations,
                dklen=len(expected),
            )
            return hmac.compare_digest(actual, expected)
        except Exception:
            return False

    # Development compatibility for legacy/plain seeded passwords.
    return hmac.compare_digest(candidate, stored_hash)


def create_access_token(
    user_id: str,
    organization_id: str,
    roles: list[str],
    active_role: str | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.auth_access_token_minutes)
    payload: dict[str, Any] = {
        "sub": user_id,
        "org": organization_id,
        "roles": roles,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "type": "access",
    }
    if active_role:
        payload["active_role"] = active_role
    return jwt.encode(payload, settings.auth_secret_key, algorithm=settings.auth_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.auth_secret_key, algorithms=[settings.auth_algorithm])


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
