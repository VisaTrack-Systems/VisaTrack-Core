# Authentication, sessions, and MFA

## Browser session model

- Access tokens expire after 15 minutes by default and are held in browser memory only.
- A random opaque refresh token is stored in a `Secure`, `HttpOnly` cookie scoped to
  `/api/v1/auth`.
- Refresh tokens rotate on every use. Reusing any consumed token revokes its entire
  server-side session family.
- Access tokens carry `sid`, `jti`, and `tv` claims. Every authenticated request checks
  that the session is active and that its token version still matches the user.
- Logout, password changes, account disablement, MFA disablement, and role revocation
  revoke server-side sessions.
- Refresh and logout require an `Origin` listed in `FRONTEND_ORIGIN`.

Existing stateless JWTs are intentionally invalid after this migration because they do
not contain a server-side session identifier.

## MFA model

VisaTrack supports RFC 6238-compatible TOTP authenticator codes and single-use recovery
codes. TOTP secrets are encrypted before storage with a dedicated key. Recovery codes
are shown once and stored as keyed hashes.

Set these production values:

```dotenv
AUTH_ACCESS_TOKEN_MINUTES=15
AUTH_REFRESH_TOKEN_DAYS=30
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=lax
MFA_ENCRYPTION_KEY=<independent-random-secret>
MFA_REQUIRED_ROLES=super_admin,org_admin
```

## Privileged-role rollout

1. Deploy the session migration with `MFA_ENFORCEMENT_ENABLED=false`.
2. Require all existing `super_admin` and `org_admin` users to enroll from Profile
   Settings and securely retain their recovery codes.
3. Verify at least two authorized recovery paths and the admin support procedure.
4. Set `MFA_ENFORCEMENT_ENABLED=true` and restart the API.
5. Confirm that an unenrolled privileged account is denied and an enrolled account is
   challenged at login.

Do not enable enforcement before existing privileged users enroll; doing so deliberately
blocks their login. A production operator must record completion of this rollout.

## Incident response

- Suspected refresh-token theft: revoke the affected session; reuse detection also
  revokes the family automatically.
- Suspected account compromise: increment `users.token_version`, revoke all sessions,
  reset the password, rotate recovery codes, and review audit events.
- Lost authenticator: use one recovery code, enroll a replacement authenticator, and
  regenerate recovery codes.
- Lost authenticator and recovery codes: follow the identity-verification support
  procedure before an authorized administrator resets MFA.
