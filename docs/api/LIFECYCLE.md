# API lifecycle policy

## Contract source

FastAPI OpenAPI is the canonical contract. `docs/api/openapi.json` and
`frontend/lib/api.generated.ts` are generated artifacts checked for drift in CI:

```bash
cd backend && python scripts/export_openapi.py
cd ../frontend && npm run api:generate
```

New frontend code should use generated operation/schema types. Existing handwritten
adapters may be migrated incrementally without changing UI behavior.

## Versioning and compatibility

- Stable endpoints use `/api/v1`.
- Additive optional fields and new endpoints may ship within v1.
- Removing/renaming fields, changing semantics, making optional input required, or
  replacing response envelopes requires a new API version or a documented compatibility
  period.
- Deprecated endpoints return `Deprecation: true`, a standards-formatted `Sunset`
  timestamp, and a `Link` to migration instructions for at least one supported release.
- Security fixes may shorten a compatibility period when continued behavior creates a
  material exposure; the release note must state the forced migration.

## Write safety

- Creation, email delivery, payments, exports, and other retry-prone writes require an
  `Idempotency-Key` once their route adopts idempotency storage.
- Concurrent editable resources use a version/ETag precondition and return `409` or
  `412` for stale writes.
- Validation errors use FastAPI's structured error format; operational errors expose a
  correlation ID, not internal exception text.

## Pagination

New list endpoints return:

```json
{"items": [], "total": 0, "limit": 25, "offset": 0}
```

Existing bare-list endpoints remain compatible in v1 until consumers migrate. Every list
must enforce a maximum page size and deterministic ordering.

## Review requirements

Contract changes require:

- authorization and tenant-isolation negative tests
- regenerated OpenAPI and frontend types
- explicit migration notes for consumers
- query-count/plan review for list changes
- threat-model update for new trust boundaries or sensitive data
