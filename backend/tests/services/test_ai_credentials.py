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


def test_provider_key_rotation_reads_previous_key_and_writes_primary(monkeypatch):
    old_key = "old-ai-key-" + ("o" * 32)
    new_key = "new-ai-key-" + ("n" * 32)
    plaintext = "sk-provider-secret-5678"
    monkeypatch.setattr(ai_credentials.settings, "ai_provider_encryption_key", old_key)
    monkeypatch.setattr(
        ai_credentials.settings,
        "ai_provider_encryption_key_previous",
        (),
    )
    old_ciphertext = ai_credentials.encrypt_provider_key(plaintext)

    monkeypatch.setattr(ai_credentials.settings, "ai_provider_encryption_key", new_key)
    monkeypatch.setattr(
        ai_credentials.settings,
        "ai_provider_encryption_key_previous",
        (old_key,),
    )

    assert ai_credentials.decrypt_provider_key(old_ciphertext) == plaintext
    new_ciphertext = ai_credentials.encrypt_provider_key(plaintext)
    assert new_ciphertext != old_ciphertext
    assert ai_credentials.decrypt_provider_key(new_ciphertext) == plaintext
