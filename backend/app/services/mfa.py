"""TOTP enrollment, encrypted secret storage, and single-use recovery codes."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.mfa_recovery_code import MfaRecoveryCode
from app.models.user import User


def _fernet() -> Fernet:
    source = settings.mfa_encryption_key or settings.auth_secret_key
    key = base64.urlsafe_b64encode(hashlib.sha256(source.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("ascii")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("ascii")
    except (InvalidToken, ValueError) as exc:
        raise ValueError("MFA secret cannot be decrypted") from exc


def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def provisioning_uri(*, secret: str, email: str, issuer: str = "VisaTrack") -> str:
    label = quote(f"{issuer}:{email}", safe="")
    return (
        f"otpauth://totp/{label}?secret={secret}"
        f"&issuer={quote(issuer, safe='')}&algorithm=SHA1&digits=6&period=30"
    )


def _totp(secret: str, counter: int) -> str:
    padded = secret + ("=" * ((8 - len(secret) % 8) % 8))
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"


def verify_totp(secret: str, code: str, *, now: int | None = None) -> bool:
    normalized = code.replace(" ", "").strip()
    if len(normalized) != 6 or not normalized.isdigit():
        return False
    current = (now if now is not None else int(time.time())) // 30
    return any(
        hmac.compare_digest(_totp(secret, current + offset), normalized)
        for offset in (-1, 0, 1)
    )


def hash_recovery_code(code: str) -> str:
    normalized = code.replace("-", "").strip().upper()
    return hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        normalized.encode("ascii"),
        hashlib.sha256,
    ).hexdigest()


def replace_recovery_codes(db: Session, user: User, *, count: int = 10) -> list[str]:
    db.execute(delete(MfaRecoveryCode).where(MfaRecoveryCode.user_id == user.id))
    plaintext_codes: list[str] = []
    for _ in range(count):
        raw = secrets.token_hex(5).upper()
        display = f"{raw[:5]}-{raw[5:]}"
        plaintext_codes.append(display)
        db.add(MfaRecoveryCode(user_id=user.id, code_hash=hash_recovery_code(display)))
    return plaintext_codes


def consume_recovery_code(db: Session, user: User, code: str) -> bool:
    candidate = db.scalar(
        select(MfaRecoveryCode)
        .where(
            MfaRecoveryCode.user_id == user.id,
            MfaRecoveryCode.code_hash == hash_recovery_code(code),
            MfaRecoveryCode.used_at.is_(None),
        )
        .with_for_update()
    )
    if candidate is None:
        return False

    from datetime import datetime, timezone

    candidate.used_at = datetime.now(timezone.utc)
    db.add(candidate)
    return True


def verify_user_mfa(db: Session, user: User, code: str) -> bool:
    if not user.mfa_secret:
        return False
    try:
        if verify_totp(decrypt_secret(user.mfa_secret), code):
            return True
    except ValueError:
        return False
    return consume_recovery_code(db, user, code)
