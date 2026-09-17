"""Re-encrypt active BYOK credentials with the configured primary AI key.

Deploy the new ``AI_PROVIDER_ENCRYPTION_KEY`` while listing the old key in
``AI_PROVIDER_ENCRYPTION_KEY_PREVIOUS``, run this script once, verify every API
instance and worker uses the new key, then remove the previous key.
"""

from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal
from app.services.ai_credentials import decrypt_provider_key, encrypt_provider_key
from app.services.audit import log_activity


def rotate() -> int:
    with SessionLocal() as db:
        connections = db.execute(
            text(
                """
                SELECT id, organization_id, user_id, provider, encrypted_api_key
                FROM ai_provider_connections
                WHERE is_active = TRUE AND encrypted_api_key <> ''
                FOR UPDATE
                """
            )
        ).mappings().all()
        for connection in connections:
            plaintext = decrypt_provider_key(str(connection["encrypted_api_key"]))
            db.execute(
                text(
                    """
                    UPDATE ai_provider_connections
                    SET encrypted_api_key = :ciphertext, updated_at = NOW()
                    WHERE id = :connection_id
                    """
                ),
                {
                    "connection_id": str(connection["id"]),
                    "ciphertext": encrypt_provider_key(plaintext),
                },
            )
            log_activity(
                db,
                organization_id=connection["organization_id"],
                user_id=None,
                action="ai_provider_key_reencrypted",
                entity_type="ai_provider",
                entity_id=connection["id"],
                new_values={"provider": connection["provider"]},
            )
        db.commit()
        return len(connections)


if __name__ == "__main__":
    print(f"Re-encrypted {rotate()} AI provider credential(s).")
