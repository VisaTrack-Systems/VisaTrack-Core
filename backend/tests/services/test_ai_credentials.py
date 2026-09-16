from app.services import ai_credentials


def test_provider_key_is_encrypted_and_write_only_hint_is_short(monkeypatch):
    monkeypatch.setattr(
        ai_credentials.settings,
        "ai_provider_encryption_key",
        "ai-test-key-" + ("x" * 32),
    )
    plaintext = "sk-provider-secret-1234"

    encrypted = ai_credentials.encrypt_provider_key(plaintext)

    assert plaintext not in encrypted
    assert ai_credentials.decrypt_provider_key(encrypted) == plaintext
    assert ai_credentials.key_hint(plaintext) == "…1234"
