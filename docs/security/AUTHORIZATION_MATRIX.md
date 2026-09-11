# Deny-by-default authorization matrix

The selected `active_role`, current database assignments, tenant, resource relationship,
and resource state are authoritative. Roles embedded in access tokens are informational
and never grant access.

| Action | client | lawyer | org_admin | super_admin |
| --- | --- | --- | --- | --- |
| Read own/member case portal | related case only | assigned/created case | own organization | permitted platform scope |
| Modify case workflow | denied | assigned/created case | own organization | permitted platform scope |
| Upload requested document | related case + portal enabled | assigned/created case | own organization | permitted platform scope |
| Download document | related case + portal visible + scan clean | assigned/created + scan clean | own org + scan clean | scan clean |
| Manage users | denied | denied | own organization, below privilege ceiling | permitted platform scope |
| Grant/revoke `super_admin` | denied | denied | denied | allowed with audit event |
| Apply/release legal hold | denied | denied | own organization | permitted platform scope |
| View trust/financial records | explicitly related/visible only | assigned scope | own organization | permitted platform scope |

## Mandatory policy rules

1. Default deny when no explicit action rule matches.
2. Return `404` for inaccessible tenant/resource identifiers where `403` would disclose
   existence.
3. A user assigned multiple roles receives only the selected active role's privileges.
4. A caller cannot delegate a role or permission above their privilege ceiling.
5. Every document read requires `scan_status=clean`.
6. Disabled/deleted/locked users and revoked/expired sessions fail before policy checks.
7. Sensitive writes emit an immutable audit event with actor, tenant, action, target,
   result, and correlation ID.

## Required negative tests

- every resource identifier from organization A queried by each role in organization B
- dual-role user operating with `active_role=client`
- org admin granting/removing `super_admin`
- client reading internal notes or hidden documents
- pending/infected/failed document download
- stale/replayed refresh token
- legal-hold purge and cross-tenant legal-hold mutation

Route-specific exceptions must be documented here and tested. Inline role checks that are
not represented in this matrix are defects.
