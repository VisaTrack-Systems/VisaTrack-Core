from __future__ import annotations

from app.services import mfa


def test_totp_accepts_current_window_and_rejects_wrong_code():
    secret = "JBSWY3DPEHPK3PXP"
    now = 1_700_000_000
    expected = mfa._totp(secret, now // 30)

    assert mfa.verify_totp(secret, expected, now=now) is True
    assert mfa.verify_totp(secret, "000000", now=now) is False


def test_mfa_secret_encryption_round_trip(monkeypatch):
    monkeypatch.setattr(mfa.settings, "mfa_encryption_key", "mfa-test-key-" + ("x" * 32))
    plaintext = mfa.generate_totp_secret()

    ciphertext = mfa.encrypt_secret(plaintext)

    assert ciphertext != plaintext
    assert mfa.decrypt_secret(ciphertext) == plaintext


def test_recovery_code_hash_is_normalized_and_keyed(monkeypatch):
    monkeypatch.setattr(mfa.settings, "auth_secret_key", "x" * 32)

    assert mfa.hash_recovery_code("ABCDE-12345") == mfa.hash_recovery_code(
        "abcde12345"
    )
    assert mfa.hash_recovery_code("ABCDE-12345") != "ABCDE12345"
