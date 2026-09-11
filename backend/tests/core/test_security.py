from __future__ import annotations

from app.core import security


def test_hash_and_verify_password_round_trip():
    stored = security.hash_password('password123')

    assert stored != 'password123'
    assert security.verify_password('password123', stored) is True
    assert security.verify_password('wrong-password', stored) is False


def test_hash_password_rejects_empty_input():
    try:
        security.hash_password('   ')
    except ValueError as exc:
        assert 'Password cannot be empty' in str(exc)
    else:
        raise AssertionError('Expected ValueError for empty password')


def test_verify_password_rejects_unknown_hash_format():
    assert security.verify_password('secret', 'secret') is False


def test_access_token_can_be_decoded(monkeypatch):
    monkeypatch.setattr(security.settings, 'auth_secret_key', 'x' * 32)
    token = security.create_access_token('user-1', 'org-1', ['lawyer'])
    payload = security.decode_access_token(token)

    assert payload['sub'] == 'user-1'
    assert payload['org'] == 'org-1'
    assert payload['roles'] == ['lawyer']
    assert payload['type'] == 'access'


def test_decode_access_token_rejects_wrong_token_type(monkeypatch):
    monkeypatch.setattr(
        security.jwt,
        'decode',
        lambda *args, **kwargs: {
            'sub': 'user-1',
            'org': 'org-1',
            'iat': 1,
            'exp': 2,
            'type': 'refresh',
        },
    )

    try:
        security.decode_access_token('token')
    except security.jwt.InvalidTokenError:
        pass
    else:
        raise AssertionError('Expected invalid token type to be rejected')


def test_invitation_token_hash_is_deterministic():
    token = security.generate_invitation_token()

    assert security.hash_invitation_token(token) == security.hash_invitation_token(token)
